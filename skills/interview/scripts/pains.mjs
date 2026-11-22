import { claimProblems, claimsOf, duplicatedIds, isSupported, isTableRow, numbersWithoutSupport } from './claims.mjs'
import { comparable } from './sources.mjs'
import { contract, sectionsByHeading } from './state-file.mjs'

const CANVAS_CLAIM_GROUPS = contract.canvas_claim_groups
const BLOCKS_WITHOUT_ADVISOR = contract.canvas_blocks_without_advisor
const PAINS_GROUP = 'pains'
const ADVISOR_GROUP = 'advisor'
const ADVISOR_LETTER = CANVAS_CLAIM_GROUPS.find((group) => group.key === ADVISOR_GROUP).id_letter
const ADVISOR_ID_PATTERN = new RegExp(`\\b${ADVISOR_LETTER}\\d+\\b`, 'g')
const BLOCK_HEADING_PREFIX = '## '
const QUOTED_WORDS_PATTERN = /["“«]([^"“”«»]{3,})["”»]/g

export const canvasClaims = (bodyLines, phrases) => claimsOf(bodyLines, phrases, CANVAS_CLAIM_GROUPS)

const isAdvisorPain = (claim, phrases) => claim.claim.includes(phrases.canvas.advisor.pain_mark)
const painWordsOf = (claim, phrases) => comparable(claim.claim.replace(phrases.canvas.advisor.pain_mark, ''))

function quotedPains(lines) {
  return lines
    .filter((line) => !isTableRow(line))
    .flatMap((line) => [...line.matchAll(QUOTED_WORDS_PATTERN)].map((match) => ({ words: match[1], line })))
}

export function painsOfCanvas({ bodyLines }, phrases) {
  const alternatives = sectionsByHeading(bodyLines, BLOCK_HEADING_PREFIX).get(phrases.canvas.sections.alternatives) ?? []
  const painClaims = canvasClaims(bodyLines, phrases).filter((claim) => claim.group === PAINS_GROUP)
  return quotedPains(alternatives).map((pain) => ({
    ...pain,
    row: painClaims.find((claim) => painWordsOf(claim, phrases) === comparable(pain.words)) ?? null,
  }))
}

const supportedPains = (canvasFile, phrases) => painsOfCanvas(canvasFile, phrases).filter((pain) => pain.row !== null && isSupported(pain.row))

export function painsProgress(canvasFile, phrases) {
  const pains = painsOfCanvas(canvasFile, phrases)
  const painClaims = canvasClaims(canvasFile.bodyLines, phrases).filter((claim) => claim.group === PAINS_GROUP)
  return {
    supported: painClaims.filter(isSupported).map((claim) => claim.id),
    unsupported: painClaims.filter((claim) => !isSupported(claim)).map((claim) => claim.id),
    unverified: pains.filter((pain) => pain.row === null).map((pain) => pain.words),
  }
}

function markProblems(pain, phrases) {
  if (!isAdvisorPain(pain.row, phrases) || pain.line.includes(phrases.canvas.advisor.pain_mark)) return []
  return [`${pain.row.id}: the advisor proposed this pain: mark it with "${phrases.canvas.advisor.pain_mark}" wherever it is quoted`]
}

function canvasPainProblems(pain, evidence, phrases) {
  if (pain.row === null) return [`the pain "${pain.words}" has no row in the sources table of the canvas: check it against sources before it stays in the alternatives block`]
  if (!isSupported(pain.row)) return [`${pain.row.id}: no source supports the pain "${pain.words}": take it out of the alternatives block; its row stays in the table`]
  const figures = numbersWithoutSupport(pain.words, evidence)
  return [
    ...figures.map((figure) => `${pain.row.id}: the pain carries the figure ${figure}, which is in no exact sentence of a supported claim`),
    ...markProblems(pain, phrases),
  ]
}

function advisorMarkProblems(bodyLines, claims, phrases) {
  const blockOfHeading = (heading) => Object.keys(phrases.canvas.sections).find((block) => phrases.canvas.sections[block] === heading) ?? heading
  const supportedIds = claims.filter(isSupported).map((claim) => claim.id)
  return [...sectionsByHeading(bodyLines, BLOCK_HEADING_PREFIX)].flatMap(([heading, lines]) => {
    const block = blockOfHeading(heading)
    const markedLines = lines.filter((line) => line.includes(phrases.canvas.advisor.mark))
    if (markedLines.length > 0 && BLOCKS_WITHOUT_ADVISOR.includes(block)) return [`${block} is the builder's alone: the advisor never proposes it`]
    return markedLines.flatMap((line) => {
      const ids = line.match(ADVISOR_ID_PATTERN) ?? []
      if (ids.length === 0) return [`${block}: the advisor's proposal names no row of the sources table (${ADVISOR_LETTER}1, ${ADVISOR_LETTER}2…)`]
      return ids.filter((id) => !supportedIds.includes(id)).map((id) => `${block}: ${id} is not a supported row of the sources table`)
    })
  })
}

export function canvasSourcesProblems(canvasFile, phrases, problemClaims) {
  const claims = canvasClaims(canvasFile.bodyLines, phrases)
  const evidence = [...claims, ...problemClaims].filter(isSupported)
  return [
    ...claims.flatMap(claimProblems),
    ...duplicatedIds(claims).map((id) => `${id} appears in more than one row`),
    ...painsOfCanvas(canvasFile, phrases).flatMap((pain) => canvasPainProblems(pain, evidence, phrases)),
    ...advisorMarkProblems(canvasFile.bodyLines, claims, phrases),
  ]
}

function briefPainProblems(pain, supported, phrases) {
  const canvasPain = supported.find((candidate) => comparable(candidate.words) === comparable(pain.words))
  if (!canvasPain) return [`the pain "${pain.words}" is not a pain of the canvas that a source supports`]
  const problems = markProblems({ ...pain, row: canvasPain.row }, phrases)
  if (canvasPain.row.url !== null && !pain.line.includes(canvasPain.row.url)) problems.push(`the pain "${pain.words}" needs the link of its source: ${canvasPain.row.url}`)
  return problems
}

export function briefPainsProblems(briefFile, canvasFile, phrases) {
  const supported = supportedPains(canvasFile, phrases)
  const headerPain = briefFile.header.pain
  const painSection = sectionsByHeading(briefFile.bodyLines, BLOCK_HEADING_PREFIX).get(phrases.brief.sections.pain) ?? []
  const problems = quotedPains(painSection).flatMap((pain) => briefPainProblems(pain, supported, phrases))
  if (typeof headerPain !== 'string' || headerPain === '') return problems
  if (supported.some((pain) => comparable(pain.words) === comparable(headerPain))) return problems
  return ['pain must be, word for word, a pain of the canvas that a source supports', ...problems]
}
