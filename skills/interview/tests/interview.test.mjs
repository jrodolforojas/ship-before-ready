import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const PLUGIN_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SCRIPT = join(PLUGIN_ROOT, 'skills/interview/scripts/brief.mjs')
const EXAMPLE = join(PLUGIN_ROOT, 'templates/example')
const STATE_FILES = ['problem.md', 'lean-canvas.md', 'brief.md']
const contract = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'templates/contract.json'), 'utf8'))
const phrases = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'locales/es/interview.json'), 'utf8'))

const PAGE_SENTENCE = 'El 46% de las respuestas llegó en la primera semana.'
const PAGES = {
  '/study': { type: 'text/html; charset=utf-8', body: `<html><body><script>var hidden = "46%"</script><p>El <strong>46%</strong> de las respuestas\n lleg&oacute; en la primera semana. Otra frase sin el dato.</p></body></html>` },
  '/report.pdf': { type: 'application/pdf', body: '%PDF-1.7' },
  '/only-curl': { type: 'text/html; charset=utf-8', body: `<p>${PAGE_SENTENCE}</p>` },
}

let server
let origin

before(async () => {
  server = createServer((request, response) => {
    const page = PAGES[request.url]
    const servesOnlyCurl = request.url === '/only-curl' && !request.headers['user-agent']?.startsWith('curl/')
    if (servesOnlyCurl) {
      response.writeHead(403).end()
      return
    }
    if (!page) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'content-type': page.type }).end(page.body)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

function run(args, stdin) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [SCRIPT, ...args], (error, stdout, stderr) => {
      const json = stdout.trim().startsWith('{') ? JSON.parse(stdout) : null
      resolve({ code: error?.code ?? 0, json, stderr })
    })
    child.stdin.end(stdin ?? '')
  })
}

function exampleRepo() {
  const stateDir = join(mkdtempSync(join(tmpdir(), 'sbr-interview-')), '.sbr')
  mkdirSync(stateDir)
  for (const name of STATE_FILES) copyFileSync(join(EXAMPLE, name), join(stateDir, name))
  return stateDir
}

function edited(stateDir, name, change) {
  const path = join(stateDir, name)
  const text = readFileSync(path, 'utf8')
  const changed = change(text)
  assert.notEqual(changed, text, `the edit of ${name} changed nothing`)
  writeFileSync(path, changed)
  return path
}

const row = (cells) => `| ${cells.join(' | ')} |`
const SOURCED_STATEMENT = 'En la primera semana llegó el 46% de las respuestas.'

function problemWithLocalSource({ quote = PAGE_SENTENCE, page = '/study', status = 'respaldada', type = 'estudio' } = {}) {
  const stateDir = join(mkdtempSync(join(tmpdir(), 'sbr-interview-')), '.sbr')
  mkdirSync(stateDir)
  const sourcedRow = row(['T1', 'El 46% de las respuestas llega en la primera semana', status, type, `[local](${origin}${page})`, `"${quote}"`])
  const component = (title, letter, numbers, firstRow) =>
    [`## ${title}`, '', ...numbers.flatMap((number) => [`**${number}. Pregunta**`, '', 'Respuesta.', '']), '### Fuentes', '', row(['#', 'Afirmación', 'Estado', 'Tipo de fuente', 'Fuente', 'Frase exacta']), '|---|---|---|---|---|---|', firstRow ?? row([`${letter}1`, 'Algo que vi', 'experiencia propia', '—', '—', '—']), '']
  const text = [
    '---',
    'locale: es',
    'confirmed: [trigger, frequency, relevance, viability]',
    `statement: "${SOURCED_STATEMENT}"`,
    'statement_claims: [T1]',
    '---',
    '',
    '# Problema: asunto de prueba',
    '',
    '## Declaración del problema',
    '',
    SOURCED_STATEMENT,
    '',
    ...component('Detonador', 'T', [1, 2, 3], sourcedRow),
    ...component('Frecuencia', 'F', [4, 5, 6]),
    ...component('Relevancia', 'R', [7, 8]),
    ...component('Viabilidad', 'V', [9, 10]),
  ].join('\n')
  const path = join(stateDir, 'problem.md')
  writeFileSync(path, text)
  return path
}

test('the contract names all have a phrase in the Spanish locale', () => {
  for (const status of contract.claim_statuses) assert.ok(phrases.sources.statuses[status], status)
  for (const type of contract.source_types) assert.ok(phrases.sources.types[type], type)
  for (const block of Object.values(contract.canvas_blocks).flat()) assert.ok(phrases.canvas.sections[block], block)
  for (const code of contract.brief_finding_codes) assert.ok(phrases.review.fields[code], code)
  for (const component of contract.problem_components) {
    assert.ok(phrases.problem.components[component.key].title, component.key)
    for (const number of component.questions) assert.deepEqual(Object.keys(phrases.problem.questions[number]), ['ask'], `question ${number} is asked as it is, with no hint`)
  }
  assert.deepEqual(contract.problem_components.flatMap((component) => component.questions), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test('status starts at the welcome in an empty repo', async () => {
  const { code, json } = await run(['status', join(mkdtempSync(join(tmpdir(), 'sbr-interview-')), '.sbr')])
  assert.equal(code, 0)
  assert.deepEqual(json, { stage: 'welcome', problem: null, canvas: null, brief: null })
})

test('status resumes at the first question without an answer', async () => {
  const stateDir = exampleRepo()
  edited(stateDir, 'problem.md', (text) =>
    text
      .replace(/^confirmed: .*$/m, 'confirmed: []')
      .replace(/^(statement|statement_claims|approved|statement_fingerprint): .*\n/gm, '')
      .replace(/\*\*3\. [\s\S]*$/, '**3. ¿Depende o es una reacción de una condición previa?**\n'),
  )
  const { json } = await run(['status', stateDir])
  assert.equal(json.stage, 'problem')
  assert.equal(json.problem.component, 'trigger')
  assert.deepEqual(json.problem.answered, [0, 1, 2])
  assert.equal(json.problem.next_question, 3)
})

test('status asks for the sources when a component has its answers and is not confirmed', async () => {
  const stateDir = exampleRepo()
  edited(stateDir, 'problem.md', (text) =>
    text.replace(/^confirmed: .*$/m, 'confirmed: [trigger]').replace(/^(statement|statement_claims|approved|statement_fingerprint): .*\n/gm, ''),
  )
  const { json } = await run(['status', stateDir])
  assert.equal(json.stage, 'problem')
  assert.equal(json.problem.component, 'frequency')
  assert.equal(json.problem.next_question, null)
})

test('status goes from statement to canvas to brief to review to done', async () => {
  const stateDir = exampleRepo()
  assert.equal((await run(['status', stateDir])).json.stage, 'review')

  edited(stateDir, 'brief.md', (text) => text.replace('reviewer: pending', 'reviewer: approved'))
  assert.equal((await run(['status', stateDir])).json.stage, 'done')

  edited(stateDir, 'brief.md', (text) => text.replace('reviewer: approved', 'reviewer: pending').replace(/^promise: .*\n/m, ''))
  assert.equal((await run(['status', stateDir])).json.stage, 'brief')

  edited(stateDir, 'lean-canvas.md', (text) => text.replace(/^chosen_segment: .*\n/m, ''))
  assert.equal((await run(['status', stateDir])).json.stage, 'canvas')

  edited(stateDir, 'problem.md', (text) => text.replace(/^approved: .*\n/m, ''))
  assert.equal((await run(['status', stateDir])).json.stage, 'statement')
})

test('the example files pass every check', async () => {
  const stateDir = exampleRepo()
  assert.equal((await run(['check-problem', join(stateDir, 'problem.md')])).code, 0)
  assert.equal((await run(['check-canvas', join(stateDir, 'lean-canvas.md')])).code, 0)
  assert.equal((await run(['check', join(stateDir, 'brief.md')])).code, 0)
})

const BROKEN_PROBLEMS = [
  { name: 'a claim without a status', change: (text) => text.replace('| T4 | Con AI un producto se construye en días | sin fuente |', '| T4 | Con AI un producto se construye en días |  |'), expected: /T4: "" is not a status/ },
  { name: 'a status that is not one of the five', change: (text) => text.replace('| F1 | Me pasa cada vez que arranco una idea nueva | experiencia propia |', '| F1 | Me pasa cada vez que arranco una idea nueva | probable |'), expected: /F1: "probable" is not a status/ },
  { name: 'a supported claim without its link', change: (text) => text.replace('[survey.stackoverflow.co](https://survey.stackoverflow.co/2025/ai)', 'Stack Overflow'), expected: /T3: a supported claim needs the link/ },
  { name: 'a supported claim without its sentence', change: (text) => text.replace(/"84% of respondents[^|]*\|/, '— |'), expected: /T3: a supported claim needs the exact sentence/ },
  { name: 'a supported claim without a source type', change: (text) => text.replace('| respaldada | estudio |', '| respaldada | — |'), expected: /T3: "—" is not a source type/ },
  { name: 'an id used twice', change: (text) => text.replace('| V2 |', '| V1 |'), expected: /V1 appears in more than one row/ },
  { name: 'components confirmed out of order', change: (text) => text.replace('confirmed: [trigger, frequency, relevance, viability]', 'confirmed: [frequency, trigger]'), expected: /confirmed must follow the order/ },
  { name: 'a confirmed component with a question left', change: (text) => text.replace(/\*\*5\. [^\n]*\n\nNo sé\.\n/, '**5. ¿Cuántas personas son afectadas?**\n'), expected: /frequency is confirmed but question 5 has no answer/ },
  { name: 'a statement longer than four lines', change: (text) => text.replaceAll('Programar con AI ya es lo normal:', `Programar con AI ya es lo normal ${'y sigue '.repeat(20)}:`), expected: /longer than four lines/ },
  { name: 'a statement that rests on no third-party source', change: (text) => text.replace('statement_claims: [T3, R2, R3]', 'statement_claims: [T1, V1]'), expected: /no figure backed by a third-party source/ },
  { name: "a statement that rests only on the builder's own research", change: (text) => text.replace('statement_claims: [T3, R2, R3]', 'statement_claims: [T3]').replace('| respaldada | estudio |', '| respaldada | investigación propia |'), expected: /no figure backed by a third-party source/ },
  { name: 'a statement that cites a claim that does not exist', change: (text) => text.replace('statement_claims: [T3, R2, R3]', 'statement_claims: [T3, R9]'), expected: /R9, which is not in any sources table/ },
  { name: 'a statement that differs between header and body', change: (text) => text.replace('\nProgramar con AI ya es lo normal:', '\nProgramar con AI es lo normal:'), expected: /body does not carry the statement/ },
  { name: 'a statement changed after its approval', change: (text) => text.replaceAll('por el 42%', 'por el 43%'), expected: /changed after the builder approved it/ },
]

for (const { name, change, expected } of BROKEN_PROBLEMS) {
  test(`check-problem rejects ${name}`, async () => {
    const stateDir = exampleRepo()
    const { code, stderr } = await run(['check-problem', edited(stateDir, 'problem.md', change)])
    assert.equal(code, 1)
    assert.match(stderr, expected)
  })
}

const BROKEN_CANVASES = [
  { name: 'no chosen segment', change: (text) => text.replace(/^chosen_segment: .*\n/m, ''), expected: /chosen_segment is missing/ },
  { name: 'a chosen segment that is not in the list', change: (text) => text.replace('chosen_segment: "Builders que programan solos con Claude Code"', 'chosen_segment: "Builders y participantes de hackathons"'), expected: /exactly one segment of the list/ },
  { name: 'two segments with the chosen name', change: (text) => text.replace('- **Participantes de hackathons**', '- **Builders que programan solos con Claude Code**'), expected: /exactly one segment of the list/ },
  { name: 'a required block left pending', change: (text) => text.replace('Antes de escribir código, averigua si alguien lo quiere.', 'Pendiente'), expected: /uvp is required/ },
  { name: 'a required block without its section', change: (text) => text.replace('## Solución', '## La solución'), expected: /solution is required/ },
  { name: 'alternatives without a frustration in the words of the person', change: (text) => text.replace(/^ {2}- ".*\n/gm, ''), expected: /frustration in the words of the person/ },
  { name: 'an invited block without its section', change: (text) => text.replace('## Canales', '## Otros'), expected: /channels needs its section/ },
]

for (const { name, change, expected } of BROKEN_CANVASES) {
  test(`check-canvas rejects ${name}`, async () => {
    const stateDir = exampleRepo()
    const { code, stderr } = await run(['check-canvas', edited(stateDir, 'lean-canvas.md', change)])
    assert.equal(code, 1)
    assert.match(stderr, expected)
  })
}

test('check-canvas accepts invited blocks left pending and the blocks that are only for the builder', async () => {
  const stateDir = exampleRepo()
  const path = edited(stateDir, 'lean-canvas.md', (text) =>
    `${text.replace(/## Canales\n\n[^\n]*\n/, '## Canales\n\nPendiente\n')}\n## Estructura de costos (solo para usted)\n\nServidores.\n\n## Fuentes de ingresos (solo para usted)\n\nUna comisión.\n`,
  )
  assert.equal((await run(['check-canvas', path])).code, 0)
})

test('check rejects a brief without its problem file or without an approved statement', async () => {
  const withoutProblem = join(mkdtempSync(join(tmpdir(), 'sbr-interview-')), '.sbr')
  mkdirSync(withoutProblem)
  copyFileSync(join(EXAMPLE, 'brief.md'), join(withoutProblem, 'brief.md'))
  const missing = await run(['check', join(withoutProblem, 'brief.md')])
  assert.equal(missing.code, 1)
  assert.match(missing.stderr, /problem\.md is missing/)

  const stateDir = exampleRepo()
  edited(stateDir, 'problem.md', (text) => text.replace(/^approved: .*\n/m, ''))
  const unapproved = await run(['check', join(stateDir, 'brief.md')])
  assert.equal(unapproved.code, 1)
  assert.match(unapproved.stderr, /has not approved the statement/)
})

test('record-review writes approved only after an approved answer', async () => {
  const stateDir = exampleRepo()
  const briefPath = join(stateDir, 'brief.md')
  const rejection = 'rejected\nstatement_names_solution: La declaración nombra la solución.\nsegment_not_single: Hay dos segmentos elegidos.\n'
  const rejected = await run(['record-review', briefPath], rejection)
  assert.equal(rejected.code, 0)
  assert.equal(rejected.json.reviewer, 'pending')
  assert.deepEqual(rejected.json.findings.map((finding) => finding.code), ['statement_names_solution', 'segment_not_single'])
  assert.match(readFileSync(briefPath, 'utf8'), /^reviewer: pending$/m)

  const approved = await run(['record-review', briefPath], 'approved\n')
  assert.equal(approved.json.reviewer, 'approved')
  assert.match(readFileSync(briefPath, 'utf8'), /^reviewer: approved$/m)
})

test('record-review refuses an answer outside the format or over an invalid brief', async () => {
  const stateDir = exampleRepo()
  const briefPath = join(stateDir, 'brief.md')
  assert.equal((await run(['record-review', briefPath], 'rejected\nprice: Menciona un precio.\n')).code, 2)
  assert.equal((await run(['record-review', briefPath], 'rejected\n')).code, 2)
  assert.equal((await run(['record-review', briefPath], 'Looks good to me.\n')).code, 2)

  edited(stateDir, 'lean-canvas.md', (text) => text.replace(/^chosen_segment: .*\n/m, ''))
  assert.equal((await run(['record-review', briefPath], 'approved\n')).code, 1)
  assert.match(readFileSync(briefPath, 'utf8'), /^reviewer: pending$/m)
})

test('verify-sources finds a sentence through tags, entities and line breaks', async () => {
  const { code, json } = await run(['verify-sources', problemWithLocalSource(), 'trigger'])
  assert.equal(code, 0)
  assert.deepEqual(json.results, [{ id: 'T1', url: `${origin}/study`, result: 'found' }])
})

test('verify-sources reports a sentence that the page does not carry', async () => {
  const { json } = await run(['verify-sources', problemWithLocalSource({ quote: 'El 90% de las respuestas llegó en la primera semana.' })])
  assert.deepEqual(json.not_found, ['T1'])
})

test('verify-sources does not read a figure hidden in a script', async () => {
  const { json } = await run(['verify-sources', problemWithLocalSource({ quote: 'var hidden = "46%"' })])
  assert.deepEqual(json.not_found, ['T1'])
})

test('verify-sources reports the pages it cannot open, a PDF among them', async () => {
  const gone = await run(['verify-sources', problemWithLocalSource({ page: '/gone' })])
  assert.deepEqual(gone.json.results, [{ id: 'T1', url: `${origin}/gone`, result: 'unreachable', reason: 'HTTP 404' }])
  const pdf = await run(['verify-sources', problemWithLocalSource({ page: '/report.pdf' })])
  assert.equal(pdf.json.results[0].result, 'unreachable')
  assert.match(pdf.json.results[0].reason, /application\/pdf/)
})

test('verify-sources opens with curl a page that refuses fetch', async () => {
  const { json } = await run(['verify-sources', problemWithLocalSource({ page: '/only-curl' })])
  assert.deepEqual(json.results, [{ id: 'T1', url: `${origin}/only-curl`, result: 'found' }])
})

test('excerpt prints the sentences of a page that carry the words', async () => {
  const { json } = await run(['excerpt', `${origin}/study`, 'primera', 'semana'])
  assert.equal(json.opened, true)
  assert.deepEqual(json.sentences, ['El 46% de las respuestas llegó en la primera semana.'])
})

test('approve-statement writes the approval only when every quote is on its page', async () => {
  const approvedPath = problemWithLocalSource()
  const approved = await run(['approve-statement', approvedPath])
  assert.equal(approved.code, 0)
  assert.match(readFileSync(approvedPath, 'utf8'), /^approved: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"$/m)
  assert.match(readFileSync(approvedPath, 'utf8'), /^statement_fingerprint: sha256:[0-9a-f]{64}$/m)
  assert.equal((await run(['check-problem', approvedPath])).code, 0)

  const refusedPath = problemWithLocalSource({ quote: 'El 90% de las respuestas llegó en la primera semana.' })
  const refused = await run(['approve-statement', refusedPath])
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /T1: the quote is not on/)
  assert.doesNotMatch(readFileSync(refusedPath, 'utf8'), /^approved:/m)
})

test('approve-statement refuses a statement with no third-party source', async () => {
  const path = problemWithLocalSource({ status: 'fuente de otro contexto' })
  const { code, stderr } = await run(['approve-statement', path])
  assert.equal(code, 1)
  assert.match(stderr, /no figure backed by a third-party source/)
})

test('approve-statement approves again after the statement changes', async () => {
  const path = problemWithLocalSource()
  await run(['approve-statement', path])
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll(SOURCED_STATEMENT, 'El 46% de las respuestas llegó en la primera semana.'))
  assert.equal((await run(['check-problem', path])).code, 1)
  assert.equal((await run(['approve-statement', path])).code, 0)
  assert.equal((await run(['check-problem', path])).code, 0)
})
