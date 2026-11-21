import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import { findChrome } from '../capture.mjs';
import { verifyLanding } from '../verify-landing.mjs';
import { REPO_ROOT, SCRIPTS, idsWithStatus, runScript, tempDir } from './helpers.mjs';

const PREVIEW_PORT = 4391;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;
const templateRoot = process.env.SBR_TEMPLATE_ROOT ?? REPO_ROOT;
const templateDir = join(templateRoot, 'templates/landing');
const manager = process.env.SBR_PACKAGE_MANAGER ?? 'bun';

function whyNotRun() {
  if (process.env.SBR_INTEGRATION !== '1') return 'set SBR_INTEGRATION=1 to build the real template (needs the network)';
  if (!existsSync(join(templateDir, 'package.json'))) return 'templates/landing/ is not in this copy of the plugin';
  return false;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
}

async function waitForPreview() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const isUp = await fetch(PREVIEW_URL).then((response) => response.ok, () => false);
    if (isUp) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail(`the preview did not answer at ${PREVIEW_URL}`);
}

test('the real template, built with the neutral design, passes the whole gate', { skip: whyNotRun() }, async (context) => {
  const projectDir = join(tempDir('sbr-integration-'), 'landing');
  run(process.execPath, [join(templateRoot, 'scripts/copy-template.mjs'), projectDir, '--pm', manager, '--example']);
  run(manager, ['install'], projectDir);
  run(manager, ['run', 'build'], projectDir);

  const rows = verifyLanding({ projectDir, templateDir }).rows();
  assert.deepEqual(idsWithStatus(rows, 'fail'), [], JSON.stringify(rows.filter((row) => row.status === 'fail')));
  assert.equal(rows.find((row) => row.id === 'R28').status, 'pass');

  if (findChrome() === null) return context.diagnostic('Chrome is not installed: the drawn page was not measured');
  run(manager, ['run', 'preview', '--port', String(PREVIEW_PORT), '--host', '127.0.0.1'], projectDir);
  context.after(() => spawnSync(manager, ['run', 'preview', 'stop'], { cwd: projectDir }));
  await waitForPreview();
  const measured = runScript(SCRIPTS.capture, [PREVIEW_URL, tempDir('sbr-shots-'), '--measure']);
  assert.equal(measured.code, 0, measured.stdout + measured.stderr);
  assert.doesNotMatch(measured.stderr, /did not react to \?screen=/);
});
