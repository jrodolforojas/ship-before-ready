import { contract, localeProblems, sectionsByHeading } from './state-file.mjs'

const REQUIRED_BLOCKS = contract.canvas_blocks.required
const INVITED_BLOCKS = contract.canvas_blocks.invited

const BLOCK_HEADING_PREFIX = '## '
const SEGMENT_NAME_PATTERN = /^- \*\*(.+?)\*\*/
const LIST_ITEM_PATTERN = /^\s*- \S/
const QUOTED_WORDS_PATTERN = /["“«][^"“”«»]{3,}["”»]/

function blockLines(sections, phrases, block) {
  return sections.get(phrases.canvas.sections[block]) ?? null
}

function isFilled(lines, phrases) {
  if (lines === null) return false
  const content = lines.join(' ').trim()
  return content !== '' && content !== phrases.canvas.pending
}

function segmentNames(sections, phrases) {
  return (blockLines(sections, phrases, 'segments') ?? []).map((line) => line.match(SEGMENT_NAME_PATTERN)?.[1]).filter(Boolean)
}

function chosenSegmentProblems(header, names) {
  if (typeof header.chosen_segment !== 'string' || header.chosen_segment === '') return ['chosen_segment is missing: one segment is chosen for this test']
  const matches = names.filter((name) => name === header.chosen_segment)
  if (matches.length === 1) return []
  return [`chosen_segment must be the name of exactly one segment of the list (${names.join(' | ') || 'no segment listed'})`]
}

function alternativesProblems(lines) {
  if (lines === null) return []
  const problems = []
  if (!lines.some((line) => LIST_ITEM_PATTERN.test(line))) problems.push('alternatives needs at least one alternative as a list item')
  if (!lines.some((line) => QUOTED_WORDS_PATTERN.test(line))) problems.push('alternatives needs at least one frustration in the words of the person, between quotes')
  return problems
}

export function missingBlocks({ bodyLines }, phrases) {
  const sections = sectionsByHeading(bodyLines, BLOCK_HEADING_PREFIX)
  return REQUIRED_BLOCKS.filter((block) => !isFilled(blockLines(sections, phrases, block), phrases))
}

export function canvasFileProblems({ header, bodyLines }, phrases) {
  const sections = sectionsByHeading(bodyLines, BLOCK_HEADING_PREFIX)
  const headingOf = (block) => `"${BLOCK_HEADING_PREFIX}${phrases.canvas.sections[block]}"`
  const absent = INVITED_BLOCKS.filter((block) => blockLines(sections, phrases, block) === null)
  return [
    ...localeProblems(header),
    ...missingBlocks({ bodyLines }, phrases).map((block) => `${block} is required: fill the section ${headingOf(block)}`),
    ...absent.map((block) => `${block} needs its section ${headingOf(block)}, even if it only says "${phrases.canvas.pending}"`),
    ...chosenSegmentProblems(header, segmentNames(sections, phrases)),
    ...alternativesProblems(blockLines(sections, phrases, 'alternatives')),
  ]
}
