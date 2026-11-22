import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const runFile = promisify(execFile)

const FETCH_TIMEOUT_MS = 20000
const PAGE_MAX_BYTES = 20 * 1024 * 1024
const HTTP_OK = 200
const CURL_REPORT_MARKER = '\nsbr-curl-report '
const USER_AGENT = 'ship-before-ready-source-check/1.0 (+https://github.com/jrodolforojas/ship-before-ready)'
const TEXT_CONTENT_TYPE = /^(text\/|application\/(xhtml\+xml|json|xml))/
const DEFAULT_CHARSET = 'utf-8'
const EXCERPT_MAX_SENTENCES = 8
const EXCERPT_SENTENCE_MAX_LENGTH = 500

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  iquest: '¿', iexcl: '¡', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', deg: '°', cent: '¢', euro: '€', pound: '£', percnt: '%',
}

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (entity, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (entity, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&([a-zA-Z]+);/g, (entity, name) => NAMED_ENTITIES[name] ?? entity)
}

export function pageText(html) {
  const withoutCode = html.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  return decodeEntities(withoutCode.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

const comparable = (text) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')

export const pageCarriesQuote = (text, quote) => comparable(quote) !== '' && comparable(text).includes(comparable(quote))

function charsetOf(contentType) {
  return contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? DEFAULT_CHARSET
}

function decodeBody(buffer, contentType) {
  try {
    return new TextDecoder(charsetOf(contentType)).decode(buffer)
  } catch {
    return new TextDecoder(DEFAULT_CHARSET).decode(buffer)
  }
}

function pageOrRefusal(status, contentType, readHtml) {
  if (status !== HTTP_OK) return { opened: false, refused: true, reason: `HTTP ${status}` }
  if (!TEXT_CONTENT_TYPE.test(contentType)) return { opened: false, reason: `not a text page (${contentType || 'unknown type'})` }
  return { opened: true, text: pageText(readHtml()) }
}

async function openWithFetch(url) {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const contentType = response.headers.get('content-type') ?? ''
    const body = await response.arrayBuffer()
    return pageOrRefusal(response.status, contentType, () => decodeBody(body, contentType))
  } catch (error) {
    return { opened: false, refused: true, reason: error.cause?.code ?? error.name }
  }
}

// Some sites refuse Node's fetch whatever it sends and still serve curl, which announces itself as curl.
async function openWithCurl(url) {
  try {
    const report = `${CURL_REPORT_MARKER}%{http_code} %{content_type}`
    const curlArguments = ['--silent', '--location', '--max-time', String(FETCH_TIMEOUT_MS / 1000), '--write-out', report, url]
    const { stdout } = await runFile('curl', curlArguments, { maxBuffer: PAGE_MAX_BYTES })
    const reportIndex = stdout.lastIndexOf(CURL_REPORT_MARKER)
    const [status, ...contentTypeWords] = stdout.slice(reportIndex + CURL_REPORT_MARKER.length).split(' ')
    return pageOrRefusal(Number(status), contentTypeWords.join(' '), () => stdout.slice(0, reportIndex))
  } catch {
    return { opened: false, reason: 'curl could not open it' }
  }
}

export async function openPage(url) {
  const page = await openWithFetch(url)
  if (!page.refused) return page
  const retried = await openWithCurl(url)
  if (retried.opened) return retried
  return { opened: false, reason: page.reason }
}

function quoteResult(page, claim) {
  if (!page.opened) return { id: claim.id, url: claim.url, result: 'unreachable', reason: page.reason }
  if (!pageCarriesQuote(page.text, claim.quote)) return { id: claim.id, url: claim.url, result: 'not_found' }
  return { id: claim.id, url: claim.url, result: 'found' }
}

export async function verifyQuotes(claims) {
  const urls = [...new Set(claims.map((claim) => claim.url))]
  const pages = new Map(await Promise.all(urls.map(async (url) => [url, await openPage(url)])))
  return claims.map((claim) => quoteResult(pages.get(claim.url), claim))
}

export async function excerptsOf(url, term) {
  const page = await openPage(url)
  if (!page.opened) return { url, opened: false, reason: page.reason, sentences: [] }
  const sentences = page.text
    .split(/(?<=[.!?…])\s+/)
    .filter((sentence) => pageCarriesQuote(sentence, term))
    .slice(0, EXCERPT_MAX_SENTENCES)
    .map((sentence) => sentence.slice(0, EXCERPT_SENTENCE_MAX_LENGTH))
  return { url, opened: true, sentences }
}
