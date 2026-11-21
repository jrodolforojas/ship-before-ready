#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const EXIT_USAGE_OR_ENVIRONMENT = 2;
const USAGE = 'Usage: configure-landing.mjs <folder> --connections <json>';

const POSTHOG_HOSTS = {
  us: { ingestion: 'https://us.i.posthog.com', assets: 'https://us-assets.i.posthog.com' },
  eu: { ingestion: 'https://eu.i.posthog.com', assets: 'https://eu-assets.i.posthog.com' },
};
const PUBLIC_KEY_PATTERN = /^phc_[A-Za-z0-9_-]+$/;
const CAPTURE_ENDPOINT = 'i/v0/e/';
const ROUTE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const ROUTE_LENGTH = 10;
const ROUTE_PATTERN = new RegExp(`^/([a-z0-9]{${ROUTE_LENGTH}})/${CAPTURE_ENDPOINT.replaceAll('/', '\\/')}$`);
const WORDS_BLOCKERS_LOOK_FOR = /ph|hog|track|analytic|telemetry|ingest|collect|stat|metric|event|log|ads|pixel|beacon|tag/;

class UsageError extends Error {}

function parseArguments(argv) {
  const options = { folder: undefined, connections: undefined };
  const pending = [...argv];
  while (pending.length > 0) {
    const argument = pending.shift();
    if (argument === '--connections') {
      options.connections = pending.shift();
      continue;
    }
    if (argument.startsWith('--connections=')) {
      options.connections = argument.slice('--connections='.length);
      continue;
    }
    if (argument.startsWith('-')) throw new UsageError(`Unknown option: ${argument}`);
    if (options.folder) throw new UsageError('Only one folder is accepted.');
    options.folder = argument;
  }
  if (!options.folder) throw new UsageError('Missing <folder>.');
  if (!options.connections) throw new UsageError('Missing --connections <json>.');
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new UsageError(`Cannot read ${path}: ${error.message}`);
  }
}

function readConnections(path) {
  if (!existsSync(path)) throw new UsageError(`Connections file not found: ${path}`);
  const connections = readJson(path);
  if (!Object.hasOwn(POSTHOG_HOSTS, connections.posthog_region)) {
    throw new UsageError(`posthog_region must be one of: ${Object.keys(POSTHOG_HOSTS).join(', ')}.`);
  }
  if (!PUBLIC_KEY_PATTERN.test(connections.posthog_public_key ?? '')) {
    throw new UsageError('posthog_public_key must be a public project key starting with phc_.');
  }
  return connections;
}

function requireLandingFolder(folder) {
  if (!existsSync(join(folder, 'package.json'))) {
    throw new UsageError(`No landing project at ${folder}: package.json is missing. Run copy-template.mjs first.`);
  }
}

function randomRoute() {
  const bytes = randomBytes(ROUTE_LENGTH);
  return Array.from(bytes, (byte) => ROUTE_ALPHABET[byte % ROUTE_ALPHABET.length]).join('');
}

function newRoute() {
  const route = randomRoute();
  if (WORDS_BLOCKERS_LOOK_FOR.test(route)) return newRoute();
  return route;
}

function existingRoute(configFile) {
  if (!existsSync(configFile)) return undefined;
  const match = ROUTE_PATTERN.exec(readJson(configFile).capture_path ?? '');
  return match?.[1];
}

function rewritesFor(route, region) {
  const { ingestion, assets } = POSTHOG_HOSTS[region];
  return [
    { source: `/${route}/static/:path(.*)`, destination: `${assets}/static/:path` },
    { source: `/${route}/array/:path(.*)`, destination: `${assets}/array/:path` },
    { source: `/${route}/:path(.*)`, destination: `${ingestion}/:path` },
  ];
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(argv) {
  const options = parseArguments(argv);
  const folder = resolve(options.folder);
  requireLandingFolder(folder);
  const connections = readConnections(resolve(options.connections));
  const dataFolder = join(folder, 'src', 'data');
  const configFile = join(dataFolder, 'config.json');
  const vercelFile = join(folder, 'vercel.json');
  const route = existingRoute(configFile) ?? newRoute();
  const capturePath = `/${route}/${CAPTURE_ENDPOINT}`;
  mkdirSync(dataFolder, { recursive: true });
  writeJson(configFile, { posthog_key: connections.posthog_public_key, capture_path: capturePath });
  writeJson(vercelFile, { rewrites: rewritesFor(route, connections.posthog_region) });
  console.log(
    JSON.stringify({ config: configFile, vercel: vercelFile, region: connections.posthog_region, capture_path: capturePath }),
  );
}

try {
  run(process.argv.slice(2));
} catch (error) {
  const detail = error instanceof UsageError ? `${error.message}\n${USAGE}` : error.message;
  console.error(detail);
  process.exit(EXIT_USAGE_OR_ENVIRONMENT);
}
