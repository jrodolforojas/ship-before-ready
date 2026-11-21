import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { test } from 'node:test';
import { findChrome } from '../capture.mjs';
import { SCRIPTS, rowOf, runScript, runScriptAsync, tempDir } from './helpers.mjs';

const manager = process.env.SBR_PACKAGE_MANAGER ?? 'bun';
const notRequested = process.env.SBR_INTEGRATION !== '1' && 'set SBR_INTEGRATION=1 to install and build the real template (needs the network)';
const chromeMissing = findChrome() === null && 'Chrome is not installed: the drawn page was not measured';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
}

// Not `astro preview`: it only detaches when an agent runs it, so in a terminal it would never return.
async function serveFolder(root) {
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    const file = join(root, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    const body = await readFile(file).catch(() => null);
    if (body === null) return response.writeHead(404).end();
    response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const close = () => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  };
  return { url: `http://127.0.0.1:${server.address().port}/`, close };
}

test(`a real copy made by copy-template.mjs --example and built with ${manager}`, { skip: notRequested }, async (context) => {
  const projectDir = join(tempDir('sbr-integration-'), 'landing');
  run(process.execPath, [SCRIPTS.copyTemplate, projectDir, '--pm', manager, '--example']);
  run(manager, ['install'], projectDir);
  run(manager, ['run', 'build'], projectDir);

  await context.test('passes the landing verifier, R28 included', () => {
    const verified = runScript(SCRIPTS.landing, [projectDir]);
    assert.equal(verified.code, 0, verified.stdout + verified.stderr);
    assert.equal(rowOf(verified.rows, 'R28').status, 'pass');
  });

  await context.test('passes the measurements of the drawn page', { skip: chromeMissing }, async (subtest) => {
    const server = await serveFolder(join(projectDir, 'dist'));
    subtest.after(server.close);
    const measured = await runScriptAsync(SCRIPTS.capture, [server.url, tempDir('sbr-shots-'), '--measure']);
    assert.equal(measured.code, 0, measured.stdout + measured.stderr);
    assert.doesNotMatch(measured.stderr, /did not react to \?screen=/);
  });
});
