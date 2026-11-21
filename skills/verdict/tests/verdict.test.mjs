import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '../scripts/verdict.mjs')

const RULES_HEADER = `---
min_cold_visitors: 200
signup_rate_pass: 0.05
signup_rate_gray_min: 0.038
no_evidence_visitors: 300
calls_scheduled_pass: 3
cold_sources: [v1, v2, v3, bio]
verdict_date: 2099-01-01
sealed: 2026-11-21
---

# Reglas del veredicto
`

const COUNT_ROWS = [
  { source: 'v1', visitors: 12, cta_clicks: 6, signups: 3, answers: 2 },
  { source: 'bio', visitors: '4', cta_clicks: '1', signups: '1', answers: '1' },
  { source: 'friends', visitors: 9, cta_clicks: 8, signups: 7, answers: 3 },
  { source: 'test', visitors: 50, cta_clicks: 50, signups: 50, answers: 50 },
]

const answer = (source, flags) => ({
  source,
  has_email: true,
  wants_call: false,
  has_whatsapp: false,
  has_time_slot: false,
  real_case: false,
  ...flags,
})

const ANSWER_ROWS = [
  answer('v1', { real_case: true, wants_call: true, has_whatsapp: true, has_time_slot: true }),
  answer('v1', { real_case: false }),
  answer('bio', { real_case: 'true', wants_call: 'true', has_whatsapp: 'true', has_time_slot: 'false' }),
  answer('friends', { real_case: true, wants_call: true, has_whatsapp: true, has_time_slot: true }),
  answer('friends', { real_case: true, wants_call: true, has_whatsapp: true, has_time_slot: true }),
  answer('friends', { real_case: true, wants_call: true, has_whatsapp: true, has_time_slot: true }),
  answer('test', { real_case: true, wants_call: true, has_whatsapp: true, has_time_slot: true }),
]

function git(repo, ...gitArguments) {
  return execFileSync('git', gitArguments, { cwd: repo, encoding: 'utf8' }).trim()
}

function run(...scriptArguments) {
  const outcome = spawnSync(process.execPath, [SCRIPT, ...scriptArguments], { encoding: 'utf8' })
  return { status: outcome.status, stdout: outcome.stdout, stderr: outcome.stderr, json: outcome.status === 0 ? JSON.parse(outcome.stdout) : null }
}

function sealedRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'sbr-verdict-'))
  git(repo, 'init', '--quiet')
  git(repo, 'config', 'user.email', 'test@example.com')
  git(repo, 'config', 'user.name', 'Test')
  mkdirSync(join(repo, '.sbr'))
  writeFileSync(join(repo, '.sbr/brief.md'), '---\nreviewer: approved\nlocale: es\n---\n')
  writeFileSync(join(repo, '.sbr/rules.md'), RULES_HEADER)
  git(repo, 'add', '.sbr/rules.md')
  git(repo, 'commit', '--quiet', '-m', 'Seal the verdict rules')
  const commit = git(repo, 'rev-parse', 'HEAD')
  writeFileSync(join(repo, '.sbr/seal.json'), JSON.stringify({ sealed_at: '2026-11-21T03:12:45Z', commit }))
  git(repo, 'add', '.sbr/seal.json')
  git(repo, 'commit', '--quiet', '-m', 'Record the seal of the verdict rules')
  return { repo, commit }
}

function changeRules(repo) {
  writeFileSync(join(repo, '.sbr/rules.md'), RULES_HEADER.replace('min_cold_visitors: 200', 'min_cold_visitors: 10'))
  git(repo, 'commit', '--quiet', '-am', 'Change the sealed verdict rules\n\nQuería ver números antes.')
}

function writeJson(folder, name, value) {
  const file = join(folder, name)
  writeFileSync(file, JSON.stringify(value))
  return file
}

function verdictFor(repo, reviewText, callsHeld = '1') {
  const work = mkdtempSync(join(tmpdir(), 'sbr-verdict-work-'))
  const built = run('build', repo, writeJson(work, 'counts.json', COUNT_ROWS), writeJson(work, 'answers.json', ANSWER_ROWS), '--calls-held', callsHeld)
  assert.equal(built.status, 0, built.stderr)
  const decided = run('decide', writeJson(work, 'input.json', built.json))
  assert.equal(decided.status, 0, decided.stderr)
  const decisionFile = writeJson(work, 'decision.json', decided.json)
  const reviewFile = join(work, 'review.txt')
  writeFileSync(reviewFile, reviewText)
  const written = run('write', repo, decisionFile, reviewFile)
  assert.equal(written.status, 0, written.stderr)
  return { decision: decided.json, decisionFile, markdown: readFileSync(join(repo, '.sbr/verdict.md'), 'utf8') }
}

test('integrity reports sealed rules that did not change', () => {
  const { repo, commit } = sealedRepo()
  const report = run('integrity', repo).json
  assert.equal(report.rules_commit, commit)
  assert.equal(report.rules_changed_after_seal, false)
  assert.deepEqual(report.changes, [])
  assert.equal(report.since, '2026-11-21 03:12:45')
  assert.equal(report.rules.min_cold_visitors, 200)
})

test('integrity lists every change after the seal with its reason', () => {
  const { repo, commit } = sealedRepo()
  changeRules(repo)
  const report = run('integrity', repo).json
  assert.equal(report.rules_commit, commit)
  assert.equal(report.rules_changed_after_seal, true)
  assert.equal(report.changes.length, 1)
  assert.equal(report.changes[0].reason, 'Quería ver números antes.')
  assert.deepEqual(report.changed_keys, [{ key: 'min_cold_visitors', sealed: 200, now: 10 }])
  assert.equal(report.rules.min_cold_visitors, 200)
})

test('integrity without a seal fails and names it', () => {
  const repo = mkdtempSync(join(tmpdir(), 'sbr-verdict-'))
  git(repo, 'init', '--quiet')
  const outcome = run('integrity', repo)
  assert.equal(outcome.status, 1)
  assert.match(outcome.stderr, /not_sealed/)
})

test('build drops test traffic and computes leads and scheduled calls from the answers', () => {
  const { repo } = sealedRepo()
  const work = mkdtempSync(join(tmpdir(), 'sbr-verdict-work-'))
  const built = run('build', repo, writeJson(work, 'c.json', COUNT_ROWS), writeJson(work, 'a.json', ANSWER_ROWS), '--calls-held', '0')
  assert.equal(built.status, 0, built.stderr)
  assert.equal(built.json.counts.test, undefined)
  assert.deepEqual(built.json.counts.v1, { qualified_leads: 1, calls_scheduled: 1, visitors: 12, cta_clicks: 6, signups: 3, answers: 2 })
  assert.deepEqual(built.json.counts.bio, { qualified_leads: 1, calls_scheduled: 0, visitors: 4, cta_clicks: 1, signups: 1, answers: 1 })
  assert.equal(built.json.counts.friends.calls_scheduled, 3)
})

test('build refuses answer rows that do not match the counts', () => {
  const { repo } = sealedRepo()
  const work = mkdtempSync(join(tmpdir(), 'sbr-verdict-work-'))
  const outcome = run('build', repo, writeJson(work, 'c.json', COUNT_ROWS), writeJson(work, 'a.json', ANSWER_ROWS.slice(1)), '--calls-held', '0')
  assert.equal(outcome.status, 1)
  assert.match(outcome.stderr, /source v1: counts says 2 answers but answers.json has 1 rows/)
})

test('build refuses more calls held than cold calls scheduled', () => {
  const { repo } = sealedRepo()
  const work = mkdtempSync(join(tmpdir(), 'sbr-verdict-work-'))
  const outcome = run('build', repo, writeJson(work, 'c.json', COUNT_ROWS), writeJson(work, 'a.json', ANSWER_ROWS), '--calls-held', '2')
  assert.equal(outcome.status, 1)
  assert.match(outcome.stderr, /cannot exceed the cold calls scheduled \(1\)/)
})

test('friends with three calls do not make evidence to continue', () => {
  const { repo } = sealedRepo()
  const { decision } = verdictFor(repo, 'approved\n')
  assert.equal(decision.counts.friends.calls_scheduled, 3)
  assert.equal(decision.result, 'insufficient_sample')
})

test('verdict.md carries the contract header in order', () => {
  const { repo, commit } = sealedRepo()
  const { markdown } = verdictFor(repo, 'approved\n')
  const header = markdown.split('\n---\n')[0].split('\n').slice(1)
  const keys = header.map((line) => line.match(/^\s*([a-z_]+):/)[1])
  const group = ['visitors', 'cta_clicks', 'signups', 'answers', 'qualified_leads', 'calls_scheduled']
  assert.deepEqual(keys, [
    'result', 'computed_at', 'rules_commit', 'rules_changed_after_seal', 'reviewer', 'counts',
    'cold', ...group, 'friends', ...group, 'untagged', ...group, 'calls_held_declared',
  ])
  assert.match(markdown, new RegExp(`^rules_commit: ${commit}$`, 'm'))
  assert.match(markdown, /^reviewer: approved$/m)
  assert.match(markdown, /^calls_held_declared: 1$/m)
  assert.match(markdown, /^ {4}visitors: 16$/m)
})

test('a rejected review leaves the verdict pending and shows the finding', () => {
  const { repo } = sealedRepo()
  const { markdown } = verdictFor(repo, 'rejected\nresult_not_supported: Con 16 visitantes fríos la muestra no alcanza.\n')
  assert.match(markdown, /^reviewer: pending$/m)
  assert.match(markdown, /result_not_supported: Con 16 visitantes fríos/)
})

test('a malformed review is refused', () => {
  const { repo } = sealedRepo()
  assert.throws(() => verdictFor(repo, 'approved\nresult_not_supported: algo\n'))
  assert.throws(() => verdictFor(repo, 'rejected\nunknown_code: algo\n'))
})

test('a change after the seal appears before any number', () => {
  const { repo } = sealedRepo()
  changeRules(repo)
  const { markdown, decision } = verdictFor(repo, 'approved\n')
  const body = markdown.split('\n---\n').slice(1).join('\n---\n')
  const changeAt = body.indexOf('## Las reglas cambiaron después del sello')
  const firstNumberAt = body.search(/\d/)
  assert.ok(changeAt !== -1 && changeAt < firstNumberAt, 'the change is the first thing in the body')
  assert.match(markdown, /^rules_changed_after_seal: true$/m)
  assert.equal(decision.result, 'insufficient_sample')
  assert.equal(decision.with_rules_now.reason, 'filter_passed_calls_pending')
  assert.match(body, /Quería ver números antes\./)
  assert.match(body, /Muestra mínima \(visitantes fríos\): sellada en 200, ahora 10/)
  assert.match(body, /Con las varas de ahora, la respuesta sería: Muestra insuficiente\./)
})

test('every rate in verdict.md sits next to its raw count', () => {
  const { repo } = sealedRepo()
  const { markdown } = verdictFor(repo, 'approved\n')
  const ratesSection = markdown.split('## Tasas, cada una con su conteo')[1].split('\n## ')[0]
  const cells = ratesSection
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.startsWith('|---') && !line.startsWith('| Origen'))
    .flatMap((line) => line.split('|').slice(2, -1).map((cell) => cell.trim()))
  assert.ok(cells.length > 0)
  for (const cell of cells) assert.match(cell, /^(\d+(,\d)?% \(\d+ de \d+\)|sin base \(0 de 0\))$/)
  const percentsOutsideRates = markdown
    .replace(ratesSection, '')
    .split('\n')
    .filter((line) => /\d%/.test(line))
    .filter((line) => !/^\| (Filtro de registro|Inicio de la zona gris) \|/.test(line))
  assert.deepEqual(percentsOutsideRates, [])
})

test('review-input carries only numbers and thresholds', () => {
  const { repo } = sealedRepo()
  const { decisionFile } = verdictFor(repo, 'approved\n')
  const review = run('review-input', repo, decisionFile).json
  assert.deepEqual(Object.keys(review), [
    'result', 'thresholds', 'rules_changed_after_seal', 'rules_changes_shown_before_numbers',
    'counts', 'by_source', 'cold_signup_rate', 'rates_as_shown', 'declared',
  ])
  assert.equal(JSON.stringify(review).includes('@'), false)
  assert.ok(review.rates_as_shown.every((line) => /\(\d+ de \d+\)$/.test(line)))
})
