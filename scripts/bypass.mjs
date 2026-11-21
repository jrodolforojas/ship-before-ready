#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { bypassLogPath, findProjectRoot, loadPhrases, projectRelativePath } from '../hooks/gate.mjs';

const EXIT_OK = 0;
const EXIT_USAGE = 2;

function singleLine(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function timestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseOptions() {
  try {
    return parseArgs({
      options: {
        session: { type: 'string' },
        file: { type: 'string' },
        reason: { type: 'string' },
        cwd: { type: 'string', default: process.cwd() },
      },
    }).values;
  } catch {
    return null;
  }
}

const options = parseOptions();
const projectRoot = findProjectRoot(options?.cwd ?? process.cwd());
const phrases = loadPhrases(projectRoot ?? process.cwd());

if (!projectRoot) {
  console.error(phrases.bypass.no_project);
  process.exit(EXIT_USAGE);
}

const session = singleLine(options?.session ?? '');
const reason = singleLine(options?.reason ?? '');
const file = singleLine(options?.file ?? '');
if (!session || !reason || !file) {
  console.error(phrases.bypass.usage);
  process.exit(EXIT_USAGE);
}

const loggedFile = projectRelativePath(projectRoot, options.cwd, file) ?? file;
const entry = { at: timestamp(), session_id: session, file: loggedFile, reason };
appendFileSync(bypassLogPath(projectRoot), JSON.stringify(entry) + '\n');
console.log(phrases.bypass.recorded);
process.exit(EXIT_OK);
