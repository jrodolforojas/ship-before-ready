#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'

const EXIT_OK = 0
const EXIT_CHECK_FAILED = 1
const EXIT_USAGE = 2

const HEADER_FENCE = '---'
const REVIEWER_STATES = ['pending', 'approved']
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/
const ANGLE_BY_SCRIPT_ID = { v1: 'pain', v2: 'top3', v3: 'founder' }
const SCRIPT_IDS = Object.keys(ANGLE_BY_SCRIPT_ID)
const PROFILE_SOURCE = 'bio'
const FRIENDS_SOURCE = 'friends'
const KEYWORD_PATTERN = /^[\p{Lu}\d]{3,20}$/u
const SECOND_SENTENCE_PATTERN = /[.!?…;]\s+\S/
const CREDITED_TEACHER = 'Guillie Collado'
const FINDING_CODES = [
  'smp_not_one_sentence',
  'outside_smp',
  'reveal_incomplete',
  'value_before_build_up',
  'product_before_cta',
  'claims_it_exists',
  'price',
  'invented_figure',
]

const USAGE = `Usage:
  video-scripts.mjs links <landing.json>
  video-scripts.mjs check <video-scripts.md> <landing.json> <phrases.json>
  video-scripts.mjs record-review <video-scripts.md>     (the reviewer's answer comes on stdin)`

class UsageError extends Error {}
class CheckFailed extends Error {}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new CheckFailed(`Cannot read ${path}: ${error.message}`)
  }
}

function readLandingUrl(landingPath) {
  const { url } = readJson(landingPath)
  if (typeof url !== 'string' || !URL.canParse(url)) throw new CheckFailed(`${landingPath} has no valid "url"`)
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new CheckFailed('The landing url must start with http:// or https://')
  if (parsed.search !== '' || parsed.hash !== '') throw new CheckFailed('The landing url must not carry a query or a fragment')
  return url
}

function linkWithSource(landingUrl, source) {
  return `${landingUrl}?src=${source}`
}

function linksFor(landingUrl) {
  return {
    bio_link: linkWithSource(landingUrl, PROFILE_SOURCE),
    friends_link: linkWithSource(landingUrl, FRIENDS_SOURCE),
    scripts: Object.fromEntries(SCRIPT_IDS.map((id) => [id, linkWithSource(landingUrl, id)])),
  }
}

function splitDocument(text) {
  const lines = text.split('\n')
  if (lines[0] !== HEADER_FENCE) throw new CheckFailed('The file does not start with a header between --- lines')
  const closingIndex = lines.indexOf(HEADER_FENCE, 1)
  if (closingIndex === -1) throw new CheckFailed('The header is not closed with ---')
  return { headerLines: lines.slice(1, closingIndex), bodyLines: lines.slice(closingIndex + 1) }
}

function unquote(value) {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  return trimmed
}

function parseHeader(headerLines) {
  const header = {}
  let listKey = null
  for (const line of headerLines) {
    if (line.trim() === '') continue
    const itemStart = line.match(/^ {2}- ([a-z_]+):(.*)$/)
    if (itemStart && listKey) {
      header[listKey].push({ [itemStart[1]]: unquote(itemStart[2]) })
      continue
    }
    const itemField = line.match(/^ {4}([a-z_]+):(.*)$/)
    if (itemField && listKey && header[listKey].length > 0) {
      header[listKey].at(-1)[itemField[1]] = unquote(itemField[2])
      continue
    }
    const topLevel = line.match(/^([a-z_]+):(.*)$/)
    if (!topLevel) throw new CheckFailed(`Header line not understood: ${line}`)
    const [, key, rawValue] = topLevel
    listKey = null
    if (rawValue.trim() !== '') {
      header[key] = unquote(rawValue)
      continue
    }
    header[key] = []
    listKey = key
  }
  return header
}

function isOneSentence(smp) {
  const withoutClosingMark = smp.trim().replace(/[.!?…]+$/, '')
  return withoutClosingMark !== '' && !SECOND_SENTENCE_PATTERN.test(withoutClosingMark)
}

function scriptHeaderProblems(script, expectedId, links) {
  const problems = []
  if (script.id !== expectedId) return [`scripts must be ${SCRIPT_IDS.join(', ')} in that order; found ${script.id ?? '(no id)'} where ${expectedId} goes`]
  if (script.angle !== ANGLE_BY_SCRIPT_ID[expectedId]) problems.push(`${expectedId}: angle must be ${ANGLE_BY_SCRIPT_ID[expectedId]}`)
  if (typeof script.smp !== 'string' || !isOneSentence(script.smp)) problems.push(`${expectedId}: smp must be one single sentence`)
  if (!KEYWORD_PATTERN.test(script.keyword ?? '')) problems.push(`${expectedId}: keyword must be one word of 3 to 20 capital letters or digits`)
  if (script.link !== links.scripts[expectedId]) problems.push(`${expectedId}: link must be ${links.scripts[expectedId]}`)
  return problems
}

function headerProblems(header, links) {
  const problems = []
  if (!REVIEWER_STATES.includes(header.reviewer)) problems.push(`reviewer must be one of: ${REVIEWER_STATES.join(', ')}`)
  if (!LOCALE_PATTERN.test(header.locale ?? '')) problems.push('locale is missing or invalid')
  if (header.bio_link !== links.bio_link) problems.push(`bio_link must be ${links.bio_link}`)
  if (header.friends_link !== links.friends_link) problems.push(`friends_link must be ${links.friends_link}`)
  const scripts = Array.isArray(header.scripts) ? header.scripts : []
  if (scripts.length !== SCRIPT_IDS.length) return [...problems, `scripts must list exactly ${SCRIPT_IDS.length} items`]
  SCRIPT_IDS.forEach((id, index) => problems.push(...scriptHeaderProblems(scripts[index], id, links)))
  const keywords = scripts.map((script) => script.keyword)
  if (new Set(keywords).size !== keywords.length) problems.push('each script needs its own keyword')
  return problems
}

function splitByHeading(lines, marker) {
  const sections = [{ title: null, lines: [] }]
  for (const line of lines) {
    if (line.startsWith(marker)) {
      sections.push({ title: line.slice(marker.length).trim(), lines: [] })
      continue
    }
    sections.at(-1).lines.push(line)
  }
  return sections
}

function escapeForPattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasLabelWithText(text, label) {
  return new RegExp(`\\*\\*${escapeForPattern(label)}:\\*\\*\\s*\\S`).test(text)
}

function missingLabels(text, labels) {
  return labels.filter((label) => !hasLabelWithText(text, label))
}

function partText(parts, title) {
  const part = parts.find((candidate) => candidate.title === title)
  return part ? part.lines.join('\n') : ''
}

function scriptSectionProblems(section, script, links, layout) {
  const [preamble, ...parts] = splitByHeading(section.lines, '### ')
  const expectedTitles = [...Object.values(layout.parts), ...Object.values(layout.extras)]
  const foundTitles = parts.map((part) => part.title)
  if (foundTitles.join('\n') !== expectedTitles.join('\n')) {
    return [`${script.id}: its parts must be, in this order: ${expectedTitles.join(', ')}`]
  }
  const problems = []
  const preambleText = preamble.lines.join('\n')
  for (const label of missingLabels(preambleText, [layout.smp1, layout.smp2])) problems.push(`${script.id}: "${label}" is missing`)
  if (!preambleText.includes(script.smp)) problems.push(`${script.id}: ${layout.smp1} in the body differs from smp in the header`)
  for (const part of parts) {
    if (part.lines.join('').trim() === '') problems.push(`${script.id}: "${part.title}" is empty`)
  }
  const revealText = partText(parts, layout.parts.reveal)
  for (const label of missingLabels(revealText, Object.values(layout.reveal))) problems.push(`${script.id}: the reveal lacks "${label}"`)
  const callToActionText = partText(parts, layout.parts.call_to_action)
  for (const label of missingLabels(callToActionText, Object.values(layout.call_to_action))) {
    problems.push(`${script.id}: the call to action lacks "${label}"`)
  }
  if (!callToActionText.includes(links.bio_link)) problems.push(`${script.id}: the call to action lacks the profile link`)
  if (!callToActionText.includes(script.link)) problems.push(`${script.id}: the call to action lacks the link of this video`)
  if (!callToActionText.includes(script.keyword)) problems.push(`${script.id}: the call to action lacks the keyword ${script.keyword}`)
  if (!hasLabelWithText(partText(parts, layout.extras.description), layout.search_terms)) {
    problems.push(`${script.id}: the description lacks "${layout.search_terms}"`)
  }
  return problems
}

function bodyProblems(bodyLines, header, links, layout) {
  const sections = splitByHeading(bodyLines, '## ').slice(1)
  const scriptSections = sections.slice(0, SCRIPT_IDS.length)
  if (scriptSections.map((section) => section.title).join(' ') !== SCRIPT_IDS.join(' ')) {
    return [`The body must open with the sections ${SCRIPT_IDS.join(', ')}, in that order`]
  }
  const problems = scriptSections.flatMap((section, index) => scriptSectionProblems(section, header.scripts[index], links, layout))
  const sources = sections.find((section) => section.title === layout.sources.title)
  if (!sources) return [...problems, `The closing section "${layout.sources.title}" is missing`]
  if (!sources.lines.join('\n').includes(CREDITED_TEACHER)) problems.push(`"${layout.sources.title}" must credit ${CREDITED_TEACHER}`)
  return problems
}

function readLayout(phrasesPath) {
  const layout = readJson(phrasesPath).document
  const groups = ['parts', 'reveal', 'call_to_action', 'extras', 'sources']
  const isComplete = layout && layout.smp1 && layout.smp2 && layout.search_terms && groups.every((group) => typeof layout[group] === 'object')
  if (!isComplete) throw new UsageError(`${phrasesPath} has no complete "document" section`)
  return layout
}

function links(landingPath) {
  if (!landingPath) throw new UsageError('links needs the path of landing.json')
  return linksFor(readLandingUrl(landingPath))
}

function check(documentPath, landingPath, phrasesPath) {
  if (!documentPath || !landingPath || !phrasesPath) throw new UsageError('check needs three paths')
  const layout = readLayout(phrasesPath)
  const expectedLinks = linksFor(readLandingUrl(landingPath))
  const { headerLines, bodyLines } = splitDocument(readFileSync(documentPath, 'utf8'))
  const header = parseHeader(headerLines)
  const problemsInHeader = headerProblems(header, expectedLinks)
  if (problemsInHeader.length > 0) throw new CheckFailed(problemsInHeader.join('\n'))
  const problemsInBody = bodyProblems(bodyLines, header, expectedLinks, layout)
  if (problemsInBody.length > 0) throw new CheckFailed(problemsInBody.join('\n'))
  return { result: 'valid' }
}

function parseReview(answer) {
  const lines = answer
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const [result, ...findingLines] = lines
  if (result !== 'approved' && result !== 'rejected') {
    throw new UsageError('The first line of the review must be "approved" or "rejected", alone')
  }
  const findings = findingLines.map((line) => {
    const match = line.match(/^([a-z_0-9]+):\s*(\S.*)$/)
    if (!match || !FINDING_CODES.includes(match[1])) throw new UsageError(`Finding not understood: ${line}`)
    return { code: match[1], sentence: match[2] }
  })
  if (result === 'rejected' && findings.length === 0) throw new UsageError('A rejected review needs at least one finding')
  if (result === 'approved' && findings.length > 0) throw new UsageError('An approved review cannot carry findings')
  return { result, findings }
}

function withReviewer(text, reviewerState) {
  const { headerLines, bodyLines } = splitDocument(text)
  if (!headerLines.some((line) => line.startsWith('reviewer:'))) throw new CheckFailed('The header has no reviewer line')
  const header = headerLines.map((line) => (line.startsWith('reviewer:') ? `reviewer: ${reviewerState}` : line))
  return [HEADER_FENCE, ...header, HEADER_FENCE, ...bodyLines].join('\n')
}

function recordReview(documentPath) {
  if (!documentPath) throw new UsageError('record-review needs the path of video-scripts.md')
  const review = parseReview(readFileSync(0, 'utf8'))
  const reviewerState = review.result === 'approved' ? 'approved' : 'pending'
  writeFileSync(documentPath, withReviewer(readFileSync(documentPath, 'utf8'), reviewerState))
  return { ...review, reviewer: reviewerState }
}

const COMMANDS = { links, check, 'record-review': recordReview }

function main() {
  const [commandName, ...paths] = process.argv.slice(2)
  const command = COMMANDS[commandName]
  if (!command) throw new UsageError(`Unknown command: ${commandName ?? '(none)'}`)
  return command(...paths)
}

function exitCodeFor(error) {
  if (error instanceof CheckFailed) return EXIT_CHECK_FAILED
  return EXIT_USAGE
}

try {
  console.log(JSON.stringify(main()))
  process.exit(EXIT_OK)
} catch (error) {
  console.error(error.message)
  if (error instanceof UsageError) console.error(USAGE)
  process.exit(exitCodeFor(error))
}
