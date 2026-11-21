#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXIT_OK = 0
const EXIT_CHECK_FAILED = 1
const EXIT_USAGE = 2

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const DEFAULT_LOCALE = 'es'
const POSTHOG_REGIONS = ['us', 'eu']
const PUBLIC_KEY_PATTERN = /^phc_[A-Za-z0-9_-]+$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const VERCEL_PROJECT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/
const PAGE_ATTEMPTS = 8
const PAGE_WAIT_MS = 5000
const REQUEST_TIMEOUT_MS = 15000

const USAGE = `Usage:
  probe.mjs prepare [--locale <locale>]
  probe.mjs page <url> <probe_id>
  probe.mjs region <public_key>
  probe.mjs send <region> <public_key> <probe_id>
  probe.mjs save <repo> --package-manager <manager> --posthog-region <region>
                 --posthog-public-key <key> --posthog-project-id <id>
                 --vercel-project <name> --vercel-team <slug|none> --probe-url <url>`

class UsageError extends Error {}
class CheckFailed extends Error {}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const contract = readJson(join(PLUGIN_ROOT, 'templates/contract.json'))

const posthogHost = (region) => `https://${region}.i.posthog.com`

const utcTimestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds))

const escapeHtml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

function splitArguments(rawArguments) {
  const positional = []
  const flags = {}
  for (let index = 0; index < rawArguments.length; index += 1) {
    const argument = rawArguments[index]
    if (!argument.startsWith('--')) {
      positional.push(argument)
      continue
    }
    const value = rawArguments[index + 1]
    if (value === undefined || value.startsWith('--')) throw new UsageError(`Missing value for ${argument}`)
    flags[argument.slice(2)] = value
    index += 1
  }
  return { positional, flags }
}

function requireValue(value, name) {
  if (value === undefined || value === '') throw new UsageError(`Missing ${name}`)
  return value
}

function requirePublicKey(publicKey) {
  if (!PUBLIC_KEY_PATTERN.test(requireValue(publicKey, 'public_key'))) {
    throw new UsageError('The key is not a public project key: it must start with phc_')
  }
  return publicKey
}

function requireRegion(region) {
  if (!POSTHOG_REGIONS.includes(requireValue(region, 'region'))) {
    throw new UsageError(`Region must be one of: ${POSTHOG_REGIONS.join(', ')}`)
  }
  return region
}

function requireProbeId(probeId) {
  if (!UUID_PATTERN.test(requireValue(probeId, 'probe_id'))) throw new UsageError('probe_id must be a UUID')
  return probeId
}

function requireHttpsUrl(url, name) {
  if (!/^https:\/\/[^\s/]+/.test(requireValue(url, name))) throw new UsageError(`${name} must be an https URL`)
  return url.replace(/\/+$/, '')
}

function readPhrases(locale) {
  const localized = join(PLUGIN_ROOT, 'locales', locale, 'connect.json')
  if (existsSync(localized)) return { lang: locale, phrases: readJson(localized) }
  return { lang: DEFAULT_LOCALE, phrases: readJson(join(PLUGIN_ROOT, 'locales', DEFAULT_LOCALE, 'connect.json')) }
}

async function postJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

function prepare({ flags }) {
  const locale = flags.locale ?? DEFAULT_LOCALE
  if (!new RegExp(contract.copy.locale_pattern).test(locale)) throw new UsageError(`Invalid locale: ${locale}`)
  const { lang, phrases } = readPhrases(locale)
  const probeId = randomUUID()
  const folder = mkdtempSync(join(tmpdir(), 'sbr-probe-'))
  const page = readFileSync(join(PLUGIN_ROOT, 'templates/probe/index.html'), 'utf8')
    .replaceAll('{{lang}}', escapeHtml(lang))
    .replaceAll('{{title}}', escapeHtml(phrases.probe_page.title))
    .replaceAll('{{message}}', escapeHtml(phrases.probe_page.message))
  writeFileSync(join(folder, 'index.html'), page)
  writeFileSync(join(folder, 'probe.json'), `${JSON.stringify({ probe_id: probeId })}\n`)
  return { probe_id: probeId, folder }
}

async function readPublishedProbeId(url) {
  const response = await fetch(`${url}/probe.json`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!response.ok) return { status: response.status }
  const body = await response.json().catch(() => ({}))
  return { status: response.status, probe_id: body.probe_id }
}

async function page({ positional }) {
  const url = requireHttpsUrl(positional[0], 'url')
  const probeId = requireProbeId(positional[1])
  let lastAnswer = {}
  for (let attempt = 1; attempt <= PAGE_ATTEMPTS; attempt += 1) {
    lastAnswer = await readPublishedProbeId(url).catch((error) => ({ error: error.message }))
    if (lastAnswer.probe_id === probeId) return { url, status: lastAnswer.status, probe_id: probeId }
    if (attempt < PAGE_ATTEMPTS) await wait(PAGE_WAIT_MS)
  }
  throw new CheckFailed(`The probe page at ${url} did not answer with this run's probe_id: ${JSON.stringify(lastAnswer)}`)
}

async function acceptsPublicKey(region, publicKey) {
  const response = await postJson(`${posthogHost(region)}/flags/?v=2`, {
    api_key: publicKey,
    distinct_id: 'sbr-region-check',
  })
  return response.ok
}

async function region({ positional }) {
  const publicKey = requirePublicKey(positional[0])
  const answers = await Promise.all(
    POSTHOG_REGIONS.map(async (candidate) => ({
      region: candidate,
      accepted: await acceptsPublicKey(candidate, publicKey).catch(() => false),
    })),
  )
  const accepting = answers.filter((answer) => answer.accepted).map((answer) => answer.region)
  if (accepting.length !== 1) {
    throw new CheckFailed(`Expected exactly one region to accept the key, got: ${accepting.join(', ') || 'none'}`)
  }
  return { posthog_region: accepting[0] }
}

async function send({ positional }) {
  const posthogRegion = requireRegion(positional[0])
  const publicKey = requirePublicKey(positional[1])
  const probeId = requireProbeId(positional[2])
  const { name: event, source } = contract.probe_event
  const response = await postJson(`${posthogHost(posthogRegion)}/i/v0/e/`, {
    api_key: publicKey,
    event,
    distinct_id: probeId,
    properties: { source, probe_id: probeId },
  })
  if (!response.ok) throw new CheckFailed(`PostHog answered ${response.status} to the ${event} event`)
  return { event, probe_id: probeId, status: response.status }
}

function save({ positional, flags }) {
  const repo = resolve(requireValue(positional[0], 'repo'))
  if (!existsSync(repo)) throw new UsageError(`Folder not found: ${repo}`)
  const packageManager = requireValue(flags['package-manager'], '--package-manager')
  if (!contract.package_managers.includes(packageManager)) {
    throw new UsageError(`Package manager must be one of: ${contract.package_managers.join(', ')}`)
  }
  const projectId = requireValue(flags['posthog-project-id'], '--posthog-project-id')
  if (!/^\d+$/.test(projectId)) throw new UsageError('--posthog-project-id must be a number')
  const vercelProject = requireValue(flags['vercel-project'], '--vercel-project')
  if (!VERCEL_PROJECT_PATTERN.test(vercelProject)) throw new UsageError(`Invalid Vercel project name: ${vercelProject}`)
  const vercelTeam = requireValue(flags['vercel-team'], '--vercel-team')
  const connections = {
    package_manager: packageManager,
    posthog_region: requireRegion(flags['posthog-region']),
    posthog_public_key: requirePublicKey(flags['posthog-public-key']),
    posthog_project_id: projectId,
    vercel_project: vercelProject,
    vercel_team: vercelTeam === 'none' ? null : vercelTeam,
    probe_url: requireHttpsUrl(flags['probe-url'], '--probe-url'),
    verified_at: utcTimestamp(),
  }
  const stateFolder = join(repo, '.sbr')
  mkdirSync(stateFolder, { recursive: true })
  const file = join(stateFolder, 'connections.json')
  writeFileSync(file, `${JSON.stringify(connections, null, 2)}\n`)
  return { file, keys: Object.keys(connections) }
}

const COMMANDS = { prepare, page, region, send, save }

async function main() {
  const [commandName, ...rawArguments] = process.argv.slice(2)
  const command = COMMANDS[commandName]
  if (!command) throw new UsageError(`Unknown command: ${commandName ?? '(none)'}`)
  return command(splitArguments(rawArguments))
}

function exitCodeFor(error) {
  if (error instanceof CheckFailed) return EXIT_CHECK_FAILED
  return EXIT_USAGE
}

main()
  .then((result) => {
    console.log(JSON.stringify(result))
    process.exit(EXIT_OK)
  })
  .catch((error) => {
    console.error(error.message)
    if (error instanceof UsageError) console.error(USAGE)
    process.exit(exitCodeFor(error))
  })
