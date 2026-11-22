#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: build.mjs <output> [set...]';
const here = fileURLToPath(new URL('.', import.meta.url));
const scripts = fileURLToPath(new URL('../../scripts/', import.meta.url));
const examplePromise = fileURLToPath(new URL('../example/promise/', import.meta.url));

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function buildSet(set, output) {
  const folder = join(output, set.name);
  rmSync(folder, { recursive: true, force: true });
  const steps = [
    () => run('node', [join(scripts, 'copy-template.mjs'), folder, '--pm', 'bun'], here),
    () => writeSetData(set, folder),
    () => run('bun', ['install'], folder),
    () => run('bun', ['run', 'build'], folder),
    () => run('node', [join(scripts, 'verify-landing.mjs'), folder], here),
  ];
  for (const step of steps) {
    const result = step();
    if (!result.ok) return { folder, ...result };
  }
  return { folder, ok: true, output: '' };
}

function writeSetData(set, folder) {
  const tokens = readJson(join(here, set.tokens));
  const copy = readJson(join(here, set.copy));
  cpSync(examplePromise, join(folder, 'src/promise'), { recursive: true });
  mkdirSync(join(folder, 'src/data'), { recursive: true });
  mkdirSync(join(folder, 'src/i18n'), { recursive: true });
  writeFileSync(join(folder, 'src/data/tokens.json'), `${JSON.stringify(tokens, null, 2)}\n`);
  writeFileSync(join(folder, `src/i18n/${copy.lang}.json`), `${JSON.stringify(copy, null, 2)}\n`);
  return { ok: true, output: '' };
}

const [outputArgument, ...names] = process.argv.slice(2);
if (!outputArgument) {
  console.error(USAGE);
  process.exit(2);
}

const output = resolve(outputArgument);
const sets = readJson(join(here, 'sets.json')).filter((set) => names.length === 0 || names.includes(set.name));
let failed = false;
for (const set of sets) {
  const result = buildSet(set, output);
  console.log(`${set.name}\t${result.ok ? 'pass' : 'fail'}\t${result.folder}`);
  if (result.ok) continue;
  failed = true;
  console.error(result.output);
}
process.exit(failed ? 1 : 0);
