import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const HEADER_FENCE = '---'
export const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/
export const DEFAULT_LOCALE = 'es'

const PLUGIN_ROOT = new URL('../../../', import.meta.url)
const LOCALES_ROOT = new URL('locales/', PLUGIN_ROOT)

export const contract = JSON.parse(readFileSync(new URL('templates/contract.json', PLUGIN_ROOT), 'utf8'))
const PHRASES_FILE = 'interview.json'

export class UsageError extends Error {}
export class CheckFailed extends Error {}

function splitStateFile(text, label) {
  const lines = text.split('\n')
  if (lines[0] !== HEADER_FENCE) throw new CheckFailed(`${label} does not start with a header between --- lines`)
  const closingIndex = lines.indexOf(HEADER_FENCE, 1)
  if (closingIndex === -1) throw new CheckFailed(`The header of ${label} is not closed with ---`)
  return { headerLines: lines.slice(1, closingIndex), bodyLines: lines.slice(closingIndex + 1) }
}

function unquote(value) {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  return trimmed
}

function parseValue(rawValue) {
  const trimmed = rawValue.trim()
  const inlineList = trimmed.match(/^\[(.*)\]$/)
  if (!inlineList) return unquote(trimmed)
  return inlineList[1]
    .split(',')
    .map((item) => unquote(item))
    .filter((item) => item !== '')
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
    header[key] = parseValue(rawValue)
    nestedKey = null
  }
  return header
}

export function parseStateFile(text, label) {
  const { headerLines, bodyLines } = splitStateFile(text, label)
  return { text, header: parseHeader(headerLines), bodyLines }
}

export function readStateFile(path, label) {
  if (!existsSync(path)) throw new CheckFailed(`${label} is missing`)
  return parseStateFile(readFileSync(path, 'utf8'), label)
}

export function withHeaderValues(text, values) {
  const [openingFence, ...rest] = text.split('\n')
  const closingIndex = rest.indexOf(HEADER_FENCE)
  const keyOf = (line) => line.match(/^([a-z_]+):/)?.[1]
  const keptLines = rest.slice(0, closingIndex).filter((line) => !(keyOf(line) in values))
  const newLines = Object.entries(values)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`)
  return [openingFence, ...keptLines, ...newLines, ...rest.slice(closingIndex)].join('\n')
}

export function sectionsByHeading(bodyLines, headingPrefix) {
  const sections = new Map()
  let currentLines = null
  for (const line of bodyLines) {
    if (line.startsWith(headingPrefix)) {
      currentLines = []
      sections.set(line.slice(headingPrefix.length).trim(), currentLines)
      continue
    }
    if (/^#{1,2} /.test(line)) {
      currentLines = null
      continue
    }
    currentLines?.push(line)
  }
  return sections
}

export function loadPhrases(locale) {
  const candidates = [locale, DEFAULT_LOCALE].map((name) => fileURLToPath(new URL(`${name}/${PHRASES_FILE}`, LOCALES_ROOT)))
  const phrasesPath = candidates.find((candidate) => existsSync(candidate))
  return JSON.parse(readFileSync(phrasesPath, 'utf8'))
}

export function localeProblems(header) {
  if (LOCALE_PATTERN.test(header.locale ?? '')) return []
  return ['locale is missing or invalid']
}
