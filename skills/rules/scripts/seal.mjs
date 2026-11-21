#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXIT_OK = 0
const EXIT_CHECK_FAILED = 1
const EXIT_USAGE = 2

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const RULES_PATH = '.sbr/rules.md'
const SEAL_PATH = '.sbr/seal.json'
const HEADER_FENCE = '---'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const COUNT_KEYS = ['min_cold_visitors', 'no_evidence_visitors', 'calls_scheduled_pass']
const RATE_KEYS = ['signup_rate_pass', 'signup_rate_gray_min']
const SEAL_MESSAGE = 'Seal the verdict rules'
const SEAL_RECORD_MESSAGE = 'Record the seal of the verdict rules'
const CHANGE_MESSAGE = 'Change the sealed verdict rules'

const USAGE = `Usage:
  seal.mjs check <repo>
  seal.mjs seal <repo> [--reason <why the sealed rules change>]`

class UsageError extends Error {}
class CheckFailed extends Error {}

const coldSourcesAllowed = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'templates/contract.json'), 'utf8')).sources.cold

const utcTimestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

function git(repo, gitArguments) {
  return execFileSync('git', gitArguments, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function requireGitRepo(repo) {
  try {
    git(repo, ['rev-parse', '--show-toplevel'])
  } catch {
    throw new UsageError(`Not a git repository: ${repo}`)
  }
}

function splitRules(text) {
  const lines = text.split('\n')
  if (lines[0] !== HEADER_FENCE) throw new CheckFailed('rules.md does not start with a header between --- lines')
  const closingIndex = lines.indexOf(HEADER_FENCE, 1)
  if (closingIndex === -1) throw new CheckFailed('The header of rules.md is not closed with ---')
  return { headerLines: lines.slice(1, closingIndex), restLines: lines.slice(closingIndex) }
}

function parseValue(rawValue) {
  const value = rawValue.trim()
  const inlineList = value.match(/^\[(.*)\]$/)
  if (inlineList) {
    return inlineList[1]
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '')
  }
  return value.replace(/^"(.*)"$/, '$1')
}

function parseHeader(headerLines) {
  const header = {}
  for (const line of headerLines) {
    if (line.trim() === '') continue
    const match = line.match(/^([a-z_]+):(.*)$/)
    if (!match) throw new CheckFailed(`Header line not understood: ${line}`)
    header[match[1]] = parseValue(match[2])
  }
  return header
}

function isRealDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

function thresholdProblems(header) {
  const problems = []
  for (const key of COUNT_KEYS) {
    if (!/^[1-9]\d*$/.test(header[key] ?? '')) problems.push(`${key} must be a whole number above zero`)
  }
  for (const key of RATE_KEYS) {
    const rate = Number(header[key])
    if (!/^0?\.\d+$/.test(header[key] ?? '') || rate <= 0 || rate >= 1) problems.push(`${key} must be a fraction between 0 and 1, such as 0.05`)
  }
  if (Number(header.signup_rate_gray_min) >= Number(header.signup_rate_pass)) {
    problems.push('signup_rate_gray_min must be below signup_rate_pass')
  }
  if (Number(header.no_evidence_visitors) < Number(header.min_cold_visitors)) {
    problems.push('no_evidence_visitors cannot be below min_cold_visitors')
  }
  const coldSources = Array.isArray(header.cold_sources) ? header.cold_sources : []
  if (coldSources.length === 0 || coldSources.some((source) => !coldSourcesAllowed.includes(source))) {
    problems.push(`cold_sources must be a list with values among: ${coldSourcesAllowed.join(', ')}`)
  }
  if (!isRealDate(header.verdict_date)) problems.push('verdict_date must be a date written as YYYY-MM-DD')
  return problems
}

function readRules(repo) {
  const file = join(repo, RULES_PATH)
  if (!existsSync(file)) throw new UsageError(`File not found: ${file}`)
  const text = readFileSync(file, 'utf8')
  const { headerLines, restLines } = splitRules(text)
  const header = parseHeader(headerLines)
  const problems = thresholdProblems(header)
  if (problems.length > 0) throw new CheckFailed(problems.join('\n'))
  return { file, header, headerLines, restLines }
}

function readSeal(repo) {
  const file = join(repo, SEAL_PATH)
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8'))
}

function hasPendingChange(repo, path) {
  return git(repo, ['status', '--porcelain', '--', path]) !== ''
}

function commitOnly(repo, path, message) {
  git(repo, ['add', '--', path])
  git(repo, ['commit', '--quiet', '-m', message, '--', path])
  return git(repo, ['rev-parse', 'HEAD'])
}

function sealedDateAt(repo, commit) {
  const sealedText = git(repo, ['show', `${commit}:${RULES_PATH}`])
  return parseHeader(splitRules(sealedText).headerLines).sealed
}

function sealForTheFirstTime(repo, rules) {
  const sealedAt = utcTimestamp()
  const sealedDate = sealedAt.slice(0, 10)
  if (rules.header.verdict_date <= sealedDate) throw new CheckFailed(`verdict_date must be after ${sealedDate}`)
  const headerWithoutSeal = rules.headerLines.filter((line) => !line.startsWith('sealed:') && line.trim() !== '')
  const sealedText = [HEADER_FENCE, ...headerWithoutSeal, `sealed: ${sealedDate}`, ...rules.restLines].join('\n')
  writeFileSync(rules.file, sealedText)
  const commit = commitOnly(repo, RULES_PATH, SEAL_MESSAGE)
  writeFileSync(join(repo, SEAL_PATH), `${JSON.stringify({ sealed_at: sealedAt, commit }, null, 2)}\n`)
  commitOnly(repo, SEAL_PATH, SEAL_RECORD_MESSAGE)
  return { action: 'sealed', sealed_at: sealedAt, commit }
}

function recordChangeAfterSeal(repo, rules, seal, reason) {
  if (hasPendingChange(repo, SEAL_PATH)) commitOnly(repo, SEAL_PATH, SEAL_RECORD_MESSAGE)
  if (!hasPendingChange(repo, RULES_PATH)) return { action: 'unchanged', ...seal }
  if (rules.header.sealed !== sealedDateAt(repo, seal.commit)) {
    throw new CheckFailed('The sealed date cannot change after the seal')
  }
  if (!reason) throw new UsageError('Changing sealed rules needs --reason')
  const changeCommit = commitOnly(repo, RULES_PATH, `${CHANGE_MESSAGE}\n\n${reason}`)
  return { action: 'changed', ...seal, change_commit: changeCommit }
}

function check(repo) {
  const { header } = readRules(repo)
  return { result: 'valid', sealed: readSeal(repo) !== null, header }
}

function seal(repo, reason) {
  requireGitRepo(repo)
  const rules = readRules(repo)
  const existingSeal = readSeal(repo)
  if (existingSeal) return recordChangeAfterSeal(repo, rules, existingSeal, reason)
  return sealForTheFirstTime(repo, rules)
}

function main() {
  const [commandName, repoArgument, flag, flagValue] = process.argv.slice(2)
  if (!repoArgument) throw new UsageError('Missing <repo>')
  const repo = resolve(repoArgument)
  if (flag !== undefined && (flag !== '--reason' || !flagValue)) throw new UsageError(`Unknown option: ${flag}`)
  if (commandName === 'check') return check(repo)
  if (commandName === 'seal') return seal(repo, flagValue)
  throw new UsageError(`Unknown command: ${commandName}`)
}

function exitCodeFor(error) {
  if (error instanceof CheckFailed) return EXIT_CHECK_FAILED
  return EXIT_USAGE
}

try {
  console.log(JSON.stringify(main()))
  process.exit(EXIT_OK)
} catch (error) {
  console.error(error.stderr?.toString().trim() || error.message)
  if (error instanceof UsageError) console.error(USAGE)
  process.exit(exitCodeFor(error))
}
