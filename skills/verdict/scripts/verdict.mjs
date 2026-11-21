#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COUNT_KEYS, InvalidInput, TEST_SOURCE, THRESHOLD_KEYS, decide, thresholdProblems } from './ladder.mjs'
import { formatRate, rateLines, renderVerdict } from './report.mjs'

const EXIT_OK = 0
const EXIT_CHECK_FAILED = 1
const EXIT_USAGE = 2

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SEAL_PATH = '.sbr/seal.json'
const RULES_PATH = '.sbr/rules.md'
const BRIEF_PATH = '.sbr/brief.md'
const VERDICT_PATH = '.sbr/verdict.md'
const DEFAULT_LOCALE = 'es'
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/
const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z$/
const WHOLE_THRESHOLD_KEYS = ['min_cold_visitors', 'no_evidence_visitors', 'calls_scheduled_pass']
const RATE_THRESHOLD_KEYS = ['signup_rate_pass', 'signup_rate_gray_min']
const REVIEW_CODES = ['result_not_supported', 'rate_without_count', 'non_cold_counted', 'test_counted', 'rules_changed_not_shown']
const QUERY_COUNT_KEYS = ['visitors', 'cta_clicks', 'signups', 'answers']
const ANSWER_FLAGS = ['has_email', 'wants_call', 'has_whatsapp', 'has_time_slot', 'real_case']
const FIELD_SEPARATOR = '\x1f'
const RECORD_SEPARATOR = '\x1e'

const USAGE = `Usage:
  verdict.mjs integrity <repo>
  verdict.mjs build <repo> <counts.json> <answers.json> --calls-held <n>
  verdict.mjs decide <input.json>
  verdict.mjs review-input <repo> <decision.json>
  verdict.mjs write <repo> <decision.json> <review.txt>`

class UsageError extends Error {}
class CheckFailed extends Error {}

const contract = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'templates/contract.json'), 'utf8'))
const knownSources = contract.event_properties.source.values

const utcTimestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

function git(repo, gitArguments) {
  return execFileSync('git', gitArguments, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function readJsonFile(file) {
  if (!existsSync(file)) throw new UsageError(`File not found: ${file}`)
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new CheckFailed(`${file} is not valid JSON: ${error.message}`)
  }
}

function headerLines(text, name) {
  const lines = text.split('\n')
  if (lines[0] !== '---') throw new CheckFailed(`${name} does not start with a header between --- lines`)
  const closingIndex = lines.indexOf('---', 1)
  if (closingIndex === -1) throw new CheckFailed(`The header of ${name} is not closed with ---`)
  return lines.slice(1, closingIndex)
}

function parseValue(rawValue) {
  const value = rawValue.trim()
  const inlineList = value.match(/^\[(.*)\]$/)
  if (!inlineList) return value.replace(/^"(.*)"$/, '$1')
  return inlineList[1]
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

export function parseHeader(text, name) {
  const header = {}
  for (const line of headerLines(text, name)) {
    const match = line.match(/^([a-z_]+):(.*)$/)
    if (match) header[match[1]] = parseValue(match[2])
  }
  return header
}

function rulesFrom(text, name) {
  const header = parseHeader(text, name)
  const rules = { cold_sources: header.cold_sources }
  for (const key of WHOLE_THRESHOLD_KEYS) rules[key] = /^\d+$/.test(header[key] ?? '') ? Number(header[key]) : header[key]
  for (const key of RATE_THRESHOLD_KEYS) rules[key] = /^\d*\.?\d+$/.test(header[key] ?? '') ? Number(header[key]) : header[key]
  const problems = thresholdProblems(rules)
  if (problems.length > 0) throw new CheckFailed(`${name}: ${problems.join('; ')}`)
  return { rules, verdict_date: header.verdict_date ?? null }
}

function parseChanges(log) {
  return log
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [commit, date, message] = record.split(FIELD_SEPARATOR)
      const [subject, ...bodyLines] = message.trim().split('\n')
      return { commit, date, subject, reason: bodyLines.join(' ').trim() }
    })
}

function changedKeys(sealed, current) {
  const keys = [...THRESHOLD_KEYS, 'verdict_date']
  const sealedValues = { ...sealed.rules, verdict_date: sealed.verdict_date }
  const currentValues = { ...current.rules, verdict_date: current.verdict_date }
  return keys
    .filter((key) => JSON.stringify(sealedValues[key]) !== JSON.stringify(currentValues[key]))
    .map((key) => ({ key, sealed: sealedValues[key], now: currentValues[key] }))
}

function readSeal(repo) {
  const file = join(repo, SEAL_PATH)
  if (!existsSync(file)) throw new CheckFailed('not_sealed: .sbr/seal.json does not exist; run the rules skill first')
  const seal = readJsonFile(file)
  if (!TIMESTAMP_PATTERN.test(seal.sealed_at ?? '')) throw new CheckFailed('.sbr/seal.json: sealed_at must be a UTC timestamp such as 2026-11-21T03:12:45Z')
  if (!/^[0-9a-f]{40}$/.test(seal.commit ?? '')) throw new CheckFailed('.sbr/seal.json: commit must be a full SHA')
  return seal
}

export function integrity(repo) {
  try {
    git(repo, ['rev-parse', '--show-toplevel'])
  } catch {
    throw new UsageError(`Not a git repository: ${repo}`)
  }
  const seal = readSeal(repo)
  const rulesFile = join(repo, RULES_PATH)
  if (!existsSync(rulesFile)) throw new CheckFailed('not_sealed: .sbr/rules.md does not exist; run the rules skill first')
  let sealedText
  try {
    sealedText = git(repo, ['show', `${seal.commit}:${RULES_PATH}`])
  } catch {
    throw new CheckFailed(`The seal commit ${seal.commit} does not hold ${RULES_PATH}`)
  }
  const sealed = rulesFrom(sealedText, `${RULES_PATH} at the seal`)
  const current = rulesFrom(readFileSync(rulesFile, 'utf8'), RULES_PATH)
  const log = git(repo, ['log', `--format=%H${FIELD_SEPARATOR}%cI${FIELD_SEPARATOR}%B${RECORD_SEPARATOR}`, `${seal.commit}..HEAD`, '--', RULES_PATH])
  const changes = parseChanges(log)
  const [, day, time] = seal.sealed_at.match(TIMESTAMP_PATTERN)
  return {
    sealed_at: seal.sealed_at,
    rules_commit: seal.commit,
    rules_changed_after_seal: changes.length > 0,
    uncommitted_changes: git(repo, ['status', '--porcelain', '--', RULES_PATH]).trim() !== '',
    changes,
    changed_keys: changedKeys(sealed, current),
    since: `${day} ${time}`,
    verdict_date: sealed.verdict_date,
    rules: sealed.rules,
    rules_now: current.rules,
  }
}

function toCount(value, where, problems) {
  if (Number.isInteger(value) && value >= 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  problems.push(`${where} must be a whole number, zero or more`)
  return 0
}

function toFlag(value, where, problems) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  problems.push(`${where} must be true or false`)
  return false
}

function sourceProblem(source, where) {
  if (knownSources.includes(source)) return null
  return `${where}.source "${source}" is not one of ${knownSources.join(', ')}`
}

function countsFromRows(countRows, answerRows) {
  const problems = []
  const counts = {}
  countRows.forEach((row, index) => {
    const problem = sourceProblem(row.source, `counts[${index}]`)
    if (problem) return problems.push(problem)
    if (row.source === TEST_SOURCE) return
    if (counts[row.source]) return problems.push(`counts has two rows for source ${row.source}`)
    counts[row.source] = { qualified_leads: 0, calls_scheduled: 0 }
    for (const key of QUERY_COUNT_KEYS) counts[row.source][key] = toCount(row[key], `counts[${index}].${key}`, problems)
  })
  const answerTally = {}
  answerRows.forEach((row, index) => {
    const problem = sourceProblem(row.source, `answers[${index}]`)
    if (problem) return problems.push(problem)
    if (row.source === TEST_SOURCE) return
    if (!counts[row.source]) return problems.push(`answers[${index}] has source ${row.source}, which has no row in counts`)
    const flags = Object.fromEntries(ANSWER_FLAGS.map((flag) => [flag, toFlag(row[flag], `answers[${index}].${flag}`, problems)]))
    answerTally[row.source] = (answerTally[row.source] ?? 0) + 1
    if (flags.real_case && (flags.has_email || flags.has_whatsapp)) counts[row.source].qualified_leads += 1
    if (flags.wants_call && flags.has_whatsapp && flags.has_time_slot) counts[row.source].calls_scheduled += 1
  })
  for (const [source, row] of Object.entries(counts)) {
    const tallied = answerTally[source] ?? 0
    if (tallied !== row.answers) problems.push(`source ${source}: counts says ${row.answers} answers but answers.json has ${tallied} rows`)
  }
  if (problems.length > 0) throw new CheckFailed(problems.join('\n'))
  return counts
}

function coldCallsScheduled(counts, rules) {
  return rules.cold_sources.reduce((total, source) => total + (counts[source]?.calls_scheduled ?? 0), 0)
}

export function build(repo, countsFile, answersFile, callsHeld) {
  const report = integrity(repo)
  const countRows = readJsonFile(countsFile)
  const answerRows = readJsonFile(answersFile)
  if (!Array.isArray(countRows)) throw new CheckFailed(`${countsFile} must hold a JSON list of rows`)
  if (!Array.isArray(answerRows)) throw new CheckFailed(`${answersFile} must hold a JSON list of rows`)
  const counts = countsFromRows(countRows, answerRows)
  const scheduled = coldCallsScheduled(counts, report.rules)
  if (callsHeld > scheduled) throw new CheckFailed(`calls held (${callsHeld}) cannot exceed the cold calls scheduled (${scheduled})`)
  const { rules, rules_now: rulesNow, ...integrityReport } = report
  const input = { rules, counts, declared: { calls_held: callsHeld }, integrity: integrityReport, meta: { verdict_date: report.verdict_date } }
  const thresholdsChanged = report.changed_keys.some((change) => THRESHOLD_KEYS.includes(change.key))
  if (thresholdsChanged) input.rules_now = rulesNow
  return input
}

function decideOrFail(input) {
  try {
    return decide(input)
  } catch (error) {
    if (error instanceof InvalidInput) throw new CheckFailed(error.message)
    throw error
  }
}

export function localeOf(repo) {
  const briefFile = join(repo, BRIEF_PATH)
  if (!existsSync(briefFile)) return DEFAULT_LOCALE
  const locale = parseHeader(readFileSync(briefFile, 'utf8'), BRIEF_PATH).locale
  return LOCALE_PATTERN.test(locale ?? '') ? locale : DEFAULT_LOCALE
}

export function phrasesFor(locale) {
  const file = join(PLUGIN_ROOT, 'locales', locale, 'verdict.json')
  const fallback = join(PLUGIN_ROOT, 'locales', DEFAULT_LOCALE, 'verdict.json')
  return JSON.parse(readFileSync(existsSync(file) ? file : fallback, 'utf8'))
}

function requireBuiltDecision(decision, file) {
  if (!decision.integrity?.rules_commit) throw new CheckFailed(`${file} was not built from the repo: run build, then decide`)
  return decision
}

export function reviewInput(repo, decisionFile) {
  const decision = requireBuiltDecision(readJsonFile(decisionFile), decisionFile)
  const locale = localeOf(repo)
  const phrases = phrasesFor(locale)
  const integrityReport = decision.integrity
  const shownChanges = integrityReport.changes.length + integrityReport.changed_keys.length + (integrityReport.uncommitted_changes ? 1 : 0)
  return {
    result: decision.result,
    thresholds: decision.rules,
    rules_changed_after_seal: integrityReport.rules_changed_after_seal,
    rules_changes_shown_before_numbers: shownChanges,
    counts: decision.counts,
    by_source: decision.by_source.map((row) => ({
      source: row.source,
      group: row.group,
      ...Object.fromEntries(COUNT_KEYS.map((key) => [key, row[key]])),
    })),
    cold_signup_rate: decision.rates.signup_rate,
    rates_as_shown: [
      ...rateLines(decision, phrases, locale),
      `${phrases.table.cold_total} · ${phrases.rates.signup_rate}: ${formatRate(decision.rates.signup_rate, phrases, locale)}`,
    ],
    declared: { calls_held: decision.declared.calls_held, counts_toward_result: false },
  }
}

export function parseReview(text) {
  const lines = text
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const [status, ...findingLines] = lines
  if (status !== 'approved' && status !== 'rejected') throw new CheckFailed('The review must start with a line that is approved or rejected')
  if (status === 'approved' && findingLines.length > 0) throw new CheckFailed('An approved review cannot carry findings')
  if (status === 'rejected' && findingLines.length === 0) throw new CheckFailed('A rejected review needs at least one finding')
  const findings = findingLines.map((line) => {
    const match = line.match(/^([a-z_]+):\s*(.+)$/)
    if (!match || !REVIEW_CODES.includes(match[1])) throw new CheckFailed(`Finding not understood: ${line}`)
    return { code: match[1], sentence: match[2] }
  })
  return { status, findings }
}

export function write(repo, decisionFile, reviewFile) {
  const decision = requireBuiltDecision(readJsonFile(decisionFile), decisionFile)
  if (!existsSync(reviewFile)) throw new UsageError(`File not found: ${reviewFile}`)
  const review = parseReview(readFileSync(reviewFile, 'utf8'))
  const locale = localeOf(repo)
  const computedAt = utcTimestamp()
  const markdown = renderVerdict({ decision, review, computedAt, phrases: phrasesFor(locale), locale })
  writeFileSync(join(repo, VERDICT_PATH), markdown)
  return { written: VERDICT_PATH, result: decision.result, reviewer: review.status === 'approved' ? 'approved' : 'pending', computed_at: computedAt }
}

function callsHeldFrom(flag, value) {
  if (flag !== '--calls-held') throw new UsageError('build needs --calls-held <n>')
  if (!/^\d+$/.test(value ?? '')) throw new UsageError('--calls-held must be a whole number, zero or more')
  return Number(value)
}

function main(argv) {
  const [commandName, ...rest] = argv
  if (commandName === 'integrity' && rest.length === 1) return integrity(resolve(rest[0]))
  if (commandName === 'build' && rest.length === 5) return build(resolve(rest[0]), resolve(rest[1]), resolve(rest[2]), callsHeldFrom(rest[3], rest[4]))
  if (commandName === 'decide' && rest.length === 1) return decideOrFail(readJsonFile(resolve(rest[0])))
  if (commandName === 'review-input' && rest.length === 2) return reviewInput(resolve(rest[0]), resolve(rest[1]))
  if (commandName === 'write' && rest.length === 3) return write(resolve(rest[0]), resolve(rest[1]), resolve(rest[2]))
  throw new UsageError(`Unknown command or wrong arguments: ${argv.join(' ')}`)
}

function exitCodeFor(error) {
  if (error instanceof CheckFailed) return EXIT_CHECK_FAILED
  return EXIT_USAGE
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(main(process.argv.slice(2)), null, 2))
    process.exit(EXIT_OK)
  } catch (error) {
    console.error(error.stderr?.toString().trim() || error.message)
    if (error instanceof UsageError) console.error(USAGE)
    process.exit(exitCodeFor(error))
  }
}
