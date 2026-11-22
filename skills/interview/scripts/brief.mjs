#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { canvasFileProblems, missingBlocks } from './canvas.mjs'
import { COMPONENTS, claimsOf, problemFileProblems, problemProgress, statementFingerprint } from './problem.mjs'
import { excerptsOf, verifyQuotes } from './sources.mjs'
import {
  CheckFailed,
  DEFAULT_LOCALE,
  HEADER_FENCE,
  UsageError,
  contract,
  loadPhrases,
  localeProblems,
  parseStateFile,
  readStateFile,
  withHeaderValues,
} from './state-file.mjs'

const EXIT_OK = 0
const EXIT_CHECK_FAILED = 1
const EXIT_USAGE = 2

const STATE_DIR = '.sbr'
const PROBLEM_FILE = 'problem.md'
const CANVAS_FILE = 'lean-canvas.md'
const BRIEF_FILE = 'brief.md'

const REVIEWER_STATES = ['pending', 'approved']
const ONE_LINE_KEYS = ['persona', 'pain', 'current_solution', 'promise']
const QUESTION_KEYS = ['current_solution', 'last_time', 'wants_call']
const QUESTION_MAX_LENGTH = 120
const FINDING_CODES = contract.brief_finding_codes

const USAGE = `Usage:
  brief.mjs status [.sbr]
  brief.mjs check-problem <problem.md>
  brief.mjs verify-sources <problem.md> [${COMPONENTS.map((component) => component.key).join('|')}]
  brief.mjs excerpt <url> <words to look for>
  brief.mjs approve-statement <problem.md>
  brief.mjs check-canvas <lean-canvas.md>
  brief.mjs check <brief.md>
  brief.mjs record-review <brief.md>     (the reviewer's answer comes on stdin)`

const nowStamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

function requirePath(path) {
  if (!path) throw new UsageError('A path is missing')
  return path
}

function failWith(problems) {
  if (problems.length > 0) throw new CheckFailed(problems.join('\n'))
}

const phrasesOf = (file) => loadPhrases(file.header.locale ?? DEFAULT_LOCALE)

function problemProblemsOf(file) {
  return problemFileProblems(file, phrasesOf(file))
}

function canvasProblemsOf(file) {
  return canvasFileProblems(file, phrasesOf(file))
}

function briefHeaderProblems(header) {
  const problems = localeProblems(header)
  if (!REVIEWER_STATES.includes(header.reviewer)) problems.push(`reviewer must be one of: ${REVIEWER_STATES.join(', ')}`)
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

function prefixed(label, problems) {
  return problems.map((problem) => `${label}: ${problem}`)
}

function siblingProblems(briefPath) {
  const problemPath = join(dirname(briefPath), PROBLEM_FILE)
  const canvasPath = join(dirname(briefPath), CANVAS_FILE)
  if (!existsSync(problemPath)) return [`${PROBLEM_FILE} is missing: the brief comes after the problem statement`]
  if (!existsSync(canvasPath)) return [`${CANVAS_FILE} is missing: the brief comes after the Lean Canvas`]
  const problemFile = readStateFile(problemPath, PROBLEM_FILE)
  const problems = [
    ...prefixed(PROBLEM_FILE, problemProblemsOf(problemFile)),
    ...prefixed(CANVAS_FILE, canvasProblemsOf(readStateFile(canvasPath, CANVAS_FILE))),
  ]
  if (!problemFile.header.approved) problems.push(`${PROBLEM_FILE}: the builder has not approved the statement`)
  return problems
}

function briefProblemsAt(path) {
  const { header, bodyLines } = readStateFile(path, BRIEF_FILE)
  const problems = briefHeaderProblems(header)
  if (bodyLines.join('').trim() === '') problems.push('the body is empty')
  return [...problems, ...siblingProblems(path)]
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

function claimsWithAPage(file, componentKey) {
  return claimsOf(file.bodyLines, phrasesOf(file))
    .filter((claim) => claim.url !== null && claim.quote !== '')
    .filter((claim) => !componentKey || claim.component === componentKey)
}

function canvasProgress(canvasPath) {
  if (!existsSync(canvasPath)) return null
  const file = readStateFile(canvasPath, CANVAS_FILE)
  return {
    missing: missingBlocks(file, phrasesOf(file)),
    chosen_segment: file.header.chosen_segment ?? null,
    problems: canvasProblemsOf(file),
  }
}

function briefProgress(briefPath) {
  if (!existsSync(briefPath)) return null
  return { reviewer: readStateFile(briefPath, BRIEF_FILE).header.reviewer ?? null, problems: briefProblemsAt(briefPath) }
}

function stageOf(problem, canvas, brief) {
  if (brief?.reviewer === 'approved') return 'done'
  if (problem === null) return 'welcome'
  if (problem.component !== null) return 'problem'
  if (!problem.statement_approved) return 'statement'
  if (canvas === null || canvas.problems.length > 0) return 'canvas'
  if (brief === null || brief.problems.length > 0) return 'brief'
  return 'review'
}

function status([stateDir = STATE_DIR]) {
  const problemPath = join(stateDir, PROBLEM_FILE)
  const problemFile = existsSync(problemPath) ? readStateFile(problemPath, PROBLEM_FILE) : null
  const problem = problemFile ? { ...problemProgress(problemFile), problems: problemProblemsOf(problemFile) } : null
  const canvas = canvasProgress(join(stateDir, CANVAS_FILE))
  const brief = briefProgress(join(stateDir, BRIEF_FILE))
  return { stage: stageOf(problem, canvas, brief), problem, canvas, brief }
}

function checkProblem([path]) {
  failWith(problemProblemsOf(readStateFile(requirePath(path), PROBLEM_FILE)))
  return { result: 'valid' }
}

async function verifySources([path, componentKey]) {
  if (componentKey && !COMPONENTS.some((component) => component.key === componentKey)) throw new UsageError(`Unknown component: ${componentKey}`)
  const results = await verifyQuotes(claimsWithAPage(readStateFile(requirePath(path), PROBLEM_FILE), componentKey))
  const idsWith = (result) => results.filter((entry) => entry.result === result).map((entry) => entry.id)
  return { results, not_found: idsWith('not_found'), unreachable: idsWith('unreachable') }
}

async function excerpt([url, ...words]) {
  if (!url || words.length === 0) throw new UsageError('excerpt needs a url and the words to look for')
  return excerptsOf(url, words.join(' '))
}

async function approveStatement([path]) {
  const { text } = readStateFile(requirePath(path), PROBLEM_FILE)
  const unapprovedText = withHeaderValues(text, { approved: null, statement_fingerprint: null })
  const file = parseStateFile(unapprovedText, PROBLEM_FILE)
  const problems = problemProblemsOf(file)
  if (file.header.confirmed?.length !== COMPONENTS.length) problems.push('every component must be confirmed before the statement is approved')
  if (typeof file.header.statement !== 'string') problems.push('the statement is missing')
  failWith(problems)
  const results = await verifyQuotes(claimsWithAPage(file))
  const notFound = results.filter((entry) => entry.result === 'not_found')
  failWith(notFound.map((entry) => `${entry.id}: the quote is not on ${entry.url}; copy the exact sentence or change the status`))
  const approved = nowStamp()
  const approvedText = withHeaderValues(unapprovedText, {
    approved: `"${approved}"`,
    statement_fingerprint: statementFingerprint(file.header.statement),
  })
  writeFileSync(path, approvedText)
  return { approved, unreachable: results.filter((entry) => entry.result === 'unreachable') }
}

function checkCanvas([path]) {
  failWith(canvasProblemsOf(readStateFile(requirePath(path), CANVAS_FILE)))
  return { result: 'valid' }
}

function check([path]) {
  failWith(briefProblemsAt(requirePath(path)))
  return { result: 'valid' }
}

function recordReview([path]) {
  const review = parseReview(readFileSync(0, 'utf8'))
  failWith(briefProblemsAt(requirePath(path)))
  const reviewerState = review.result === 'approved' ? 'approved' : 'pending'
  writeFileSync(path, withReviewer(readFileSync(path, 'utf8'), reviewerState))
  return { ...review, reviewer: reviewerState }
}

const COMMANDS = {
  status,
  'check-problem': checkProblem,
  'verify-sources': verifySources,
  excerpt,
  'approve-statement': approveStatement,
  'check-canvas': checkCanvas,
  check,
  'record-review': recordReview,
}

async function main() {
  const [commandName, ...args] = process.argv.slice(2)
  const command = COMMANDS[commandName]
  if (!command) throw new UsageError(`Unknown command: ${commandName ?? '(none)'}`)
  return command(args)
}

function exitCodeFor(error) {
  if (error instanceof CheckFailed) return EXIT_CHECK_FAILED
  return EXIT_USAGE
}

try {
  console.log(JSON.stringify(await main()))
  process.exit(EXIT_OK)
} catch (error) {
  console.error(error.message)
  if (error instanceof UsageError) console.error(USAGE)
  process.exit(exitCodeFor(error))
}
