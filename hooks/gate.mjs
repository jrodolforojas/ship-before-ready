#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const UNGUARDED_FOLDERS = ['.sbr', 'landing'];
const PASSING_RESULT = 'evidence_to_continue';
const FAILING_RESULTS = ['insufficient_sample', 'iterate_promise', 'no_evidence'];
const STDIN_WAIT_MS = 2000;

export function findProjectRoot(startDir) {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, '.sbr', 'brief.md'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

export function readHeader(path) {
  const text = readText(path);
  if (text === null) return null;
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const header = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!pair) continue;
    header[pair[1]] = pair[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return header;
}

function readJson(path) {
  const text = readText(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function loadPhrases(projectRoot) {
  const locale = readHeader(join(projectRoot, '.sbr', 'brief.md'))?.locale ?? 'es';
  const localized = readJson(join(PLUGIN_ROOT, 'locales', locale, 'gate.json'));
  if (localized) return localized;
  return readJson(join(PLUGIN_ROOT, 'locales', 'es', 'gate.json'));
}

export function projectRelativePath(projectRoot, cwd, filePath) {
  const relativePath = relative(projectRoot, resolve(cwd, filePath));
  if (relativePath === '' || relativePath.startsWith('..') || isAbsolute(relativePath)) return null;
  return relativePath;
}

function isUnguarded(relativePath) {
  if (relativePath === null) return true;
  const firstSegment = relativePath.split(sep)[0];
  return UNGUARDED_FOLDERS.includes(firstSegment);
}

export function bypassLogPath(projectRoot) {
  return join(projectRoot, '.sbr', 'bypass.log');
}

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function sessionHasBypass(projectRoot, sessionId) {
  const log = readText(bypassLogPath(projectRoot));
  if (log === null) return false;
  return log.split(/\r?\n/).some((line) => parseLine(line)?.session_id === sessionId);
}

export function missingPhase(projectRoot) {
  const state = (name) => join(projectRoot, '.sbr', name);
  const result = readHeader(state('verdict.md'))?.result;
  if (result === PASSING_RESULT) return null;
  if (FAILING_RESULTS.includes(result)) return result;
  if (readHeader(state('brief.md'))?.reviewer !== 'approved') return 'interview';
  if (!readHeader(state('rules.md'))?.sealed) return 'rules';
  if (!readHeader(state('design/choice.md'))?.approved) return 'design';
  if (!existsSync(state('landing.json'))) return 'landing';
  if (readHeader(state('video-scripts.md'))?.reviewer !== 'approved') return 'video_scripts';
  return 'verdict';
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (placeholder, key) => values[key] ?? placeholder);
}

export function decide(input) {
  const cwd = input?.cwd;
  const sessionId = input?.session_id;
  const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (typeof cwd !== 'string' || typeof sessionId !== 'string' || typeof filePath !== 'string') return null;

  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) return null;

  const relativePath = projectRelativePath(projectRoot, cwd, filePath);
  if (isUnguarded(relativePath)) return null;

  const verdict = readHeader(join(projectRoot, '.sbr', 'verdict.md'));
  if (verdict?.result === PASSING_RESULT) return null;
  if (sessionHasBypass(projectRoot, sessionId)) return null;

  const phrases = loadPhrases(projectRoot);
  if (!phrases) return null;

  const missing = missingPhase(projectRoot) ?? 'verdict';
  const reason = fill(phrases.deny, {
    missing: phrases.missing[missing],
    file: relativePath,
    session_id: sessionId,
    bypass_script: join(PLUGIN_ROOT, 'scripts', 'bypass.mjs'),
  });
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

function readStdin() {
  return new Promise((resolveInput) => {
    const chunks = [];
    const giveUp = setTimeout(() => resolveInput(null), STDIN_WAIT_MS);
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('error', () => resolveInput(null));
    process.stdin.on('end', () => {
      clearTimeout(giveUp);
      resolveInput(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) return;
    const decision = decide(JSON.parse(raw));
    if (decision) process.stdout.write(JSON.stringify(decision));
  } catch {
    return;
  }
}

function isEntryPoint() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  await main();
  process.exit(0);
}
