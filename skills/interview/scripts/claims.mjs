import { contract } from './state-file.mjs'

const CLAIM_STATUSES = contract.claim_statuses
const SOURCE_TYPES = contract.source_types
const THIRD_PARTY_SOURCE_TYPES = contract.third_party_source_types
const STATUSES_WITH_A_PAGE = contract.claim_statuses_with_a_page

const CLAIM_COLUMNS = 6
const URL_PATTERN = /https?:\/\/[^\s)>\]]+/
const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/g
const THOUSANDS_PATTERN = /^\d{1,3}(\.\d{3})+$/

export const isTableRow = (line) => line.trim().startsWith('|')
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

function claimOfRow(cells, phrases, groups) {
  const [id, claim, statusCell, typeCell] = cells
  const source = blankIfDash(cells[4])
  const quote = blankIfDash(cells[5])
  return {
    id,
    group: groups.find((group) => group.id_letter === id[0]).key,
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

export function claimsOf(bodyLines, phrases, groups) {
  const idPattern = new RegExp(`^[${groups.map((group) => group.id_letter).join('')}]\\d+$`)
  return bodyLines
    .filter(isTableRow)
    .map(tableCells)
    .filter((cells) => idPattern.test(cells[0] ?? ''))
    .map((cells) => claimOfRow(cells, phrases, groups))
}

export const isThirdParty = (claim) => THIRD_PARTY_SOURCE_TYPES.includes(claim.type)

export const isSupported = (claim) => claim.status === 'supported' && claim.quote !== ''

export function claimProblems(claim) {
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

export function duplicatedIds(claims) {
  const ids = claims.map((claim) => claim.id)
  return [...new Set(ids.filter((id, position) => ids.indexOf(id) !== position))]
}

function comparableNumber(number) {
  const withDots = number.replaceAll(',', '.')
  if (THOUSANDS_PATTERN.test(withDots)) return withDots.replaceAll('.', '')
  return withDots
}

export const numbersIn = (text) => [...new Set((text.match(NUMBER_PATTERN) ?? []).map(comparableNumber))]

export function numbersWithoutSupport(text, supportedClaims) {
  const supportedNumbers = new Set(supportedClaims.flatMap((claim) => numbersIn(claim.quote)))
  return numbersIn(text).filter((number) => !supportedNumbers.has(number))
}
