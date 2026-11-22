import { createHash } from 'node:crypto'
import { contract, localeProblems } from './state-file.mjs'

export const COMPONENTS = contract.problem_components
const CLAIM_STATUSES = contract.claim_statuses
const SOURCE_TYPES = contract.source_types
const THIRD_PARTY_SOURCE_TYPES = contract.third_party_source_types
const STATUSES_WITH_A_PAGE = contract.claim_statuses_with_a_page
const STATEMENT_MAX_LENGTH = contract.statement_max_characters

const CLAIM_ID_PATTERN = new RegExp(`^[${COMPONENTS.map((component) => component.id_letter).join('')}]\\d+$`)
const CLAIM_COLUMNS = 6
const URL_PATTERN = /https?:\/\/[^\s)>\]]+/
const QUESTION_PATTERN = /^\*\*(\d+)\.\s/

const isTableRow = (line) => line.trim().startsWith('|')
const collapseSpaces = (text) => text.replace(/\s+/g, ' ').trim()
const asList = (value) => (Array.isArray(value) ? value : [])
const blankIfDash = (cell) => (/^[—–-]$/.test(cell ?? '') ? '' : (cell ?? ''))

function tableCells(line) {
  return line
    .trim()
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((cell) => cell.trim())
}

function codeOfLabel(labels, codes, cell) {
  const wanted = cell.toLowerCase()
  return codes.find((code) => code === wanted || labels[code]?.toLowerCase() === wanted) ?? null
}

function claimOfRow(cells, phrases) {
  const [id, claim, statusCell, typeCell] = cells
  const source = blankIfDash(cells[4])
  const quote = blankIfDash(cells[5])
  return {
    id,
    component: COMPONENTS.find((component) => component.id_letter === id[0]).key,
    claim,
    columns: cells.length,
    statusCell,
    status: codeOfLabel(phrases.sources.statuses, CLAIM_STATUSES, statusCell ?? ''),
    typeCell,
    type: codeOfLabel(phrases.sources.types, SOURCE_TYPES, typeCell ?? ''),
    source,
    url: source.match(URL_PATTERN)?.[0] ?? null,
    quote: quote.replace(/^["“«]|["”»]$/g, ''),
  }
}

export function claimsOf(bodyLines, phrases) {
  return bodyLines
    .filter(isTableRow)
    .map(tableCells)
    .filter((cells) => CLAIM_ID_PATTERN.test(cells[0] ?? ''))
    .map((cells) => claimOfRow(cells, phrases))
}

export function answeredQuestions(bodyLines) {
  const answered = new Set()
  let openQuestion = null
  for (const line of bodyLines) {
    const question = line.match(QUESTION_PATTERN)
    if (question) {
      openQuestion = Number(question[1])
      continue
    }
    if (line.startsWith('#') || isTableRow(line)) {
      openQuestion = null
      continue
    }
    if (openQuestion !== null && line.trim() !== '') answered.add(openQuestion)
  }
  return [...answered].sort((first, second) => first - second)
}

const isThirdParty = (claim) => THIRD_PARTY_SOURCE_TYPES.includes(claim.type)

const isThirdPartyEvidence = (claim) => claim.status === 'supported' && isThirdParty(claim) && claim.url !== null && claim.quote !== ''

export const statementFingerprint = (statement) => `sha256:${createHash('sha256').update(collapseSpaces(statement)).digest('hex')}`

function claimProblems(claim) {
  const problems = []
  if (claim.columns !== CLAIM_COLUMNS) return [`${claim.id}: the row needs ${CLAIM_COLUMNS} columns and has ${claim.columns}`]
  if (claim.claim === '') problems.push(`${claim.id}: the claim is empty`)
  if (claim.status === null) return [...problems, `${claim.id}: "${claim.statusCell}" is not a status (${CLAIM_STATUSES.join(', ')})`]
  if (!STATUSES_WITH_A_PAGE.includes(claim.status)) return problems
  if (claim.type === null) problems.push(`${claim.id}: "${claim.typeCell}" is not a source type (${SOURCE_TYPES.join(', ')})`)
  if (claim.quote === '') problems.push(`${claim.id}: a ${claim.status} claim needs the exact sentence copied from its source`)
  if (claim.type !== null && !isThirdParty(claim) && claim.source === '') problems.push(`${claim.id}: say where the builder's own research is`)
  if (isThirdParty(claim) && claim.url === null) problems.push(`${claim.id}: a ${claim.status} claim needs the link of the page that was opened`)
  return problems
}

function duplicatedIds(claims) {
  const ids = claims.map((claim) => claim.id)
  return [...new Set(ids.filter((id, position) => ids.indexOf(id) !== position))]
}

function confirmedProblems(confirmed, answered, claims) {
  const expectedPrefix = COMPONENTS.slice(0, confirmed.length).map((component) => component.key)
  if (confirmed.join() !== expectedPrefix.join()) return [`confirmed must follow the order ${COMPONENTS.map((component) => component.key).join(', ')}`]
  return COMPONENTS.filter((component) => confirmed.includes(component.key)).flatMap((component) => {
    const unanswered = component.questions.filter((number) => !answered.includes(number))
    const problems = unanswered.map((number) => `${component.key} is confirmed but question ${number} has no answer`)
    if (!claims.some((claim) => claim.component === component.key)) problems.push(`${component.key} is confirmed but has no claim in its sources table`)
    return problems
  })
}

function statementProblems(header, bodyLines, claims) {
  const statement = header.statement
  const problems = []
  if ([...statement].length > STATEMENT_MAX_LENGTH) {
    problems.push(`the statement is longer than four lines (${STATEMENT_MAX_LENGTH} characters)`)
  }
  if (!collapseSpaces(bodyLines.join(' ')).includes(collapseSpaces(statement))) problems.push('the body does not carry the statement of the header, word for word')
  const citedIds = asList(header.statement_claims)
  const unknownIds = citedIds.filter((id) => !claims.some((claim) => claim.id === id))
  problems.push(...unknownIds.map((id) => `statement_claims names ${id}, which is not in any sources table`))
  const citedClaims = claims.filter((claim) => citedIds.includes(claim.id))
  if (!citedClaims.some(isThirdPartyEvidence)) {
    problems.push('the statement carries no figure backed by a third-party source: statement_claims needs at least one supported claim with its link and quote')
  }
  return problems
}

function approvalProblems(header) {
  const problems = []
  if (asList(header.confirmed).length !== COMPONENTS.length) problems.push('the statement is approved but not every component is confirmed')
  if (typeof header.statement !== 'string') return [...problems, 'the statement is approved but missing']
  if (header.statement_fingerprint !== statementFingerprint(header.statement)) {
    problems.push('the statement changed after the builder approved it: ask for the approval again')
  }
  return problems
}

export function problemFileProblems({ header, bodyLines }, phrases) {
  const claims = claimsOf(bodyLines, phrases)
  const problems = [
    ...localeProblems(header),
    ...claims.flatMap(claimProblems),
    ...duplicatedIds(claims).map((id) => `${id} appears in more than one row`),
    ...confirmedProblems(asList(header.confirmed), answeredQuestions(bodyLines), claims),
  ]
  if (typeof header.statement === 'string') problems.push(...statementProblems(header, bodyLines, claims))
  if (header.approved) problems.push(...approvalProblems(header))
  return problems
}

export function problemProgress({ header, bodyLines }) {
  const confirmed = asList(header.confirmed)
  const answered = answeredQuestions(bodyLines)
  const component = COMPONENTS.find((candidate) => !confirmed.includes(candidate.key)) ?? null
  return {
    confirmed,
    answered,
    component: component?.key ?? null,
    next_question: component?.questions.find((number) => !answered.includes(number)) ?? null,
    statement_written: typeof header.statement === 'string',
    statement_approved: Boolean(header.approved),
  }
}
