import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SCRIPTS = {
  design: join(REPO_ROOT, 'scripts/verify-design.mjs'),
  landing: join(REPO_ROOT, 'scripts/verify-landing.mjs'),
  capture: join(REPO_ROOT, 'scripts/capture.mjs'),
};

const readRepoJson = (path) => JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));

export const contract = readRepoJson('templates/contract.json');
export const neutralTokens = () => readRepoJson('templates/neutral-design/tokens.json');
export const exampleCopy = () => readRepoJson('templates/example/es.json');

export function withChange(source, path, value) {
  const copy = structuredClone(source);
  const keys = path.split('.');
  const parent = keys.slice(0, -1).reduce((node, key) => node[key], copy);
  parent[keys.at(-1)] = value;
  return copy;
}

export function withChanges(source, changes) {
  return Object.entries(changes).reduce((current, [path, value]) => withChange(current, path, value), source);
}

export function without(source, path) {
  const copy = structuredClone(source);
  const keys = path.split('.');
  const parent = keys.slice(0, -1).reduce((node, key) => node[key], copy);
  delete parent[keys.at(-1)];
  return copy;
}

export function tempDir(prefix = 'sbr-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function writeFiles(root, files) {
  Object.entries(files).forEach(([path, content]) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content, null, 2));
  });
  return root;
}

export function runScript(script, args, env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr, rows: parseRows(result.stdout) };
}

export function parseRows(stdout) {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, status, detail] = line.split('\t');
      return { id, status, detail };
    });
}

export const idsWithStatus = (rows, status) => rows.filter((row) => row.status === status).map((row) => row.id);
export const rowOf = (rows, id) => rows.find((row) => row.id === id);
