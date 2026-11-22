import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SCRIPTS = {
  design: join(REPO_ROOT, 'scripts/verify-design.mjs'),
  landing: join(REPO_ROOT, 'scripts/verify-landing.mjs'),
  capture: join(REPO_ROOT, 'scripts/capture.mjs'),
  copyTemplate: join(REPO_ROOT, 'scripts/copy-template.mjs'),
};

const readRepoJson = (path) => JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));

export const contract = readRepoJson('templates/contract.json');
export const neutralTokens = () => readRepoJson('templates/neutral-design/tokens.json');
export const exampleCopy = () => readRepoJson('templates/example/es.json');
export const EXAMPLE_BOARDS = { phone: join(REPO_ROOT, 'templates/example/promise-phone.html'), desktop: join(REPO_ROOT, 'templates/example/promise-desktop.html') };
export const exampleBoardHtml = () => ({ phone: readFileSync(EXAMPLE_BOARDS.phone, 'utf8'), desktop: readFileSync(EXAMPLE_BOARDS.desktop, 'utf8') });

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

export function runScriptAsync(script, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...env } });
    const output = { stdout: '', stderr: '' };
    child.stdout.on('data', (chunk) => (output.stdout += chunk));
    child.stderr.on('data', (chunk) => (output.stderr += chunk));
    child.on('close', (code) => resolve({ code, ...output, rows: parseRows(output.stdout) }));
  });
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const distances = [Math.abs(estimate - left), Math.abs(estimate - up), Math.abs(estimate - upLeft)];
  const nearest = Math.min(...distances);
  if (nearest === distances[0]) return left;
  return nearest === distances[1] ? up : upLeft;
}

function pngChunks(buffer) {
  const chunks = [];
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    chunks.push({ type: buffer.toString('latin1', offset + 4, offset + 8), data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += length + 12;
  }
  return chunks;
}

export function readPng(path) {
  const chunks = pngChunks(readFileSync(path));
  const header = chunks.find((chunk) => chunk.type === 'IHDR').data;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const channels = { 2: 3, 6: 4 }[header[9]];
  const raw = inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    for (let column = 0; column < stride; column += 1) {
      const value = raw[row * (stride + 1) + 1 + column];
      const left = column >= channels ? pixels[row * stride + column - channels] : 0;
      const up = row > 0 ? pixels[(row - 1) * stride + column] : 0;
      const upLeft = row > 0 && column >= channels ? pixels[(row - 1) * stride + column - channels] : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      pixels[row * stride + column] = (value + predicted) & 255;
    }
  }
  const pixelAt = (x, y) => [...pixels.subarray(y * stride + x * channels, y * stride + x * channels + 3)];
  return { width, height, pixelAt };
}
