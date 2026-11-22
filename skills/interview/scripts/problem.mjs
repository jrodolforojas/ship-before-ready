import { createHash } from 'node:crypto'
import { claimProblems, claimsOf as claimsOfGroups, duplicatedIds, isSupported, isTableRow, isThirdParty } from './claims.mjs'
import { contract, localeProblems } from './state-file.mjs'

export const COMPONENTS = contract.problem_components
const STATEMENT_MAX_LENGTH = contract.statement_max_characters

const QUESTION_PATTERN = /^\*\*(\d+)\.\s/

const collapseSpaces = (text) => text.replace(/\s+/g, ' ').trim()
const asList = (value) => (Array.isArray(value) ? value : [])

export const claimsOf = (bodyLines, phrases) => claimsOfGroups(bodyLines, phrases, COMPONENTS)

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

const isThirdPartyEvidence = (claim) => isSupported(claim) && isThirdParty(claim) && claim.url !== null

export const statementFingerprint = (statement) => `sha256:${createHash('sha256').update(collapseSpaces(statement)).digest('hex')}`

function confirmedProblems(confirmed, answered, claims) {
  const expectedPrefix = COMPONENTS.slice(0, confirmed.length).map((component) => component.key)
  if (confirmed.join() !== expectedPrefix.join()) return [`confirmed must follow the order ${COMPONENTS.map((component) => component.key).join(', ')}`]
  return COMPONENTS.filter((component) => confirmed.includes(component.key)).flatMap((component) => {
    const unanswered = component.questions.filter((number) => !answered.includes(number))
    const problems = unanswered.map((number) => `${component.key} is confirmed but question ${number} has no answer`)
    if (!claims.some((claim) => claim.group === component.key)) problems.push(`${component.key} is confirmed but has no claim in its sources table`)
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
