#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'

const EXIT_OK = 0
const EXIT_CHECK_FAILED = 1
const EXIT_USAGE = 2

const HEADER_FENCE = '---'
const REVIEWER_STATES = ['pending', 'approved']
const ONE_LINE_KEYS = ['persona', 'pain', 'current_solution', 'promise']
const QUESTION_KEYS = ['current_solution', 'last_time', 'wants_call']
const FINDING_CODES = [...ONE_LINE_KEYS, 'questions']
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/
const QUESTION_MAX_LENGTH = 120

const USAGE = `Usage:
  brief.mjs check <brief.md>
  brief.mjs record-review <brief.md>     (the reviewer's answer comes on stdin)`

class UsageError extends Error {}
class CheckFailed extends Error {}

function splitBrief(text) {
  const lines = text.split('\n')
  if (lines[0] !== HEADER_FENCE) throw new CheckFailed('The brief does not start with a header between --- lines')
  const closingIndex = lines.indexOf(HEADER_FENCE, 1)
  if (closingIndex === -1) throw new CheckFailed('The header of the brief is not closed with ---')
  return { headerLines: lines.slice(1, closingIndex), bodyLines: lines.slice(closingIndex + 1) }
}

function unquote(value) {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  return trimmed
}

function parseHeader(headerLines) {
  const header = {}
  let nestedKey = null
  for (const line of headerLines) {
    if (line.trim() === '') continue
    const nested = line.match(/^ {2}([a-z_]+):(.*)$/)
    if (nested && nestedKey) {
      header[nestedKey][nested[1]] = unquote(nested[2])
      continue
    }
    const topLevel = line.match(/^([a-z_]+):(.*)$/)
    if (!topLevel) throw new CheckFailed(`Header line not understood: ${line}`)
    const [, key, rawValue] = topLevel
    if (rawValue.trim() === '') {
      header[key] = {}
      nestedKey = key
      continue
    }
    header[key] = unquote(rawValue)
    nestedKey = null
  }
  return header
}

function headerProblems(header) {
  const problems = []
  if (!REVIEWER_STATES.includes(header.reviewer)) problems.push(`reviewer must be one of: ${REVIEWER_STATES.join(', ')}`)
  if (!LOCALE_PATTERN.test(header.locale ?? '')) problems.push('locale is missing or invalid')
  for (const key of ONE_LINE_KEYS) {
    if (typeof header[key] !== 'string' || header[key] === '') problems.push(`${key} is missing`)
  }
  const questions = typeof header.questions === 'object' ? header.questions : {}
  for (const key of QUESTION_KEYS) {
    const question = questions[key]
    if (typeof question !== 'string' || question === '') {
      problems.push(`questions.${key} is missing`)
      continue
    }
    if ([...question].length > QUESTION_MAX_LENGTH) problems.push(`questions.${key} is longer than ${QUESTION_MAX_LENGTH} characters`)
  }
  return problems
}

function readCheckedBrief(path) {
  const text = readFileSync(path, 'utf8')
  const { headerLines, bodyLines } = splitBrief(text)
  const problems = headerProblems(parseHeader(headerLines))
  if (bodyLines.join('').trim() === '') problems.push('the body is empty')
  if (problems.length > 0) throw new CheckFailed(problems.join('\n'))
  return text
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
    const match = line.match(/^([a-z_]+):\s*(\S.*)$/)
    if (!match || !FINDING_CODES.includes(match[1])) throw new UsageError(`Finding not understood: ${line}`)
    return { code: match[1], sentence: match[2] }
  })
  if (result === 'rejected' && findings.length === 0) throw new UsageError('A rejected review needs at least one finding')
  if (result === 'approved' && findings.length > 0) throw new UsageError('An approved review cannot carry findings')
  return { result, findings }
}

function withReviewer(text, reviewerState) {
  const [firstLine, ...rest] = text.split('\n')
  const closingIndex = rest.indexOf(HEADER_FENCE)
  const header = rest.slice(0, closingIndex).map((line) => (line.startsWith('reviewer:') ? `reviewer: ${reviewerState}` : line))
  return [firstLine, ...header, ...rest.slice(closingIndex)].join('\n')
}

function check(path) {
  readCheckedBrief(path)
  return { result: 'valid' }
}

function recordReview(path) {
  const review = parseReview(readFileSync(0, 'utf8'))
  const text = readCheckedBrief(path)
  const reviewerState = review.result === 'approved' ? 'approved' : 'pending'
  writeFileSync(path, withReviewer(text, reviewerState))
  return { ...review, reviewer: reviewerState }
}

const COMMANDS = { check, 'record-review': recordReview }

function main() {
  const [commandName, path] = process.argv.slice(2)
  const command = COMMANDS[commandName]
  if (!command || !path) throw new UsageError(`Unknown or incomplete command: ${commandName ?? '(none)'}`)
  return command(path)
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
