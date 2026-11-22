import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checklistRows, compareArtboards, mergeGate, nodeIsRecentEnough, reviewerExtras, rowsOf } from '../scripts/landing.mjs';
import { visitUrl } from '../scripts/visit.mjs';
import { loadContract } from '../../../scripts/verify-design.mjs';

const PLUGIN_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = join(PLUGIN_ROOT, 'skills/landing/scripts/landing.mjs');
const DESIGN_SCRIPT = join(PLUGIN_ROOT, 'skills/design/scripts/design.mjs');
const NEUTRAL = join(PLUGIN_ROOT, 'templates/neutral-design/tokens.json');
const EXAMPLE_COPY = join(PLUGIN_ROOT, 'templates/example/es.json');
const EXAMPLE_BRIEF = join(PLUGIN_ROOT, 'templates/example/brief.md');
const SITE_CONNECTIONS = join(PLUGIN_ROOT, 'site/.sbr/connections.json');

const contract = loadContract();
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function run(repo, ...args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repo, encoding: 'utf8' });
  const json = result.stdout.trim().startsWith('{') ? JSON.parse(result.stdout) : null;
  return { code: result.status, json, stdout: result.stdout, stderr: result.stderr };
}

function approvedRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'sbr-landing-'));
  mkdirSync(join(repo, '.sbr/design'), { recursive: true });
  mkdirSync(join(repo, '.sbr/sketches/a'), { recursive: true });
  writeFileSync(join(repo, '.sbr/brief.md'), readFileSync(EXAMPLE_BRIEF, 'utf8').replace(/^reviewer: .*$/m, 'reviewer: approved'));
  copyFileSync(NEUTRAL, join(repo, '.sbr/sketches/a/tokens.json'));
  copyFileSync(EXAMPLE_COPY, join(repo, '.sbr/design/copy.es.json'));
  writeFileSync(join(repo, '.sbr/design/system.md'), '# Sistema\n');
  copyFileSync(SITE_CONNECTIONS, join(repo, '.sbr/connections.json'));
  const approval = spawnSync(process.execPath, [DESIGN_SCRIPT, 'approve', '--chosen', 'a', '--canvas', 'none', '--reason', 'prueba'], { cwd: repo, encoding: 'utf8' });
  assert.equal(approval.status, 0, approval.stderr);
  return repo;
}

const allRows = (status) => Object.fromEntries(contract.requirement_ids.map((id) => [id, { status, detail: status }]));

test('status reads an approved design and valid connections', () => {
  const repo = approvedRepo();
  const { code, json } = run(repo, 'status');
  assert.equal(code, 0);
  assert.equal(json.choice.fingerprint_matches, true);
  assert.equal(json.choice.canvas, 'none');
  assert.deepEqual(json.connections.problems, []);
  assert.equal(json.landing.exists, false);
});

test('status sees an edit after the approval', () => {
  const repo = approvedRepo();
  const tokens = readJson(join(repo, '.sbr/design/tokens.json'));
  tokens.color.ink_muted = '#BBBBBB';
  writeJson(join(repo, '.sbr/design/tokens.json'), tokens);
  assert.equal(run(repo, 'status').json.choice.fingerprint_matches, false);
});

test('status without a design reports nothing approved', () => {
  const repo = mkdtempSync(join(tmpdir(), 'sbr-landing-empty-'));
  const { json } = run(repo, 'status');
  assert.equal(json.choice, null);
  assert.equal(json.connections, null);
});

test('place copies the approved files, removes other languages and stashes config.json', () => {
  const repo = approvedRepo();
  const work = mkdtempSync(join(tmpdir(), 'sbr-landing-work-'));
  mkdirSync(join(repo, 'landing/src/i18n'), { recursive: true });
  mkdirSync(join(repo, 'landing/src/data'), { recursive: true });
  writeFileSync(join(repo, 'landing/package.json'), '{}');
  writeFileSync(join(repo, 'landing/src/i18n/en.json'), '{}');
  writeJson(join(repo, 'landing/src/data/config.json'), { posthog_key: 'phc_x', capture_path: '/abc/i/v0/e/' });
  const { code, json } = run(repo, 'place', work);
  assert.equal(code, 0);
  assert.equal(json.stashed_config, true);
  assert.deepEqual(json.removed, ['landing/src/i18n/en.json']);
  assert.equal(readFileSync(join(repo, 'landing/src/i18n/es.json'), 'utf8'), readFileSync(EXAMPLE_COPY, 'utf8'));
  assert.equal(existsSync(join(repo, 'landing/src/data/config.json')), false);
  assert.equal(run(repo, 'unstash', work).json.restored, true);
  assert.equal(existsSync(join(repo, 'landing/src/data/config.json')), true);
});

test('place refuses files that differ from the approval', () => {
  const repo = approvedRepo();
  mkdirSync(join(repo, 'landing'), { recursive: true });
  writeFileSync(join(repo, 'landing/package.json'), '{}');
  writeFileSync(join(repo, '.sbr/design/copy.es.json'), readFileSync(EXAMPLE_COPY, 'utf8').replace('Ship Before Ready', 'Otro'));
  const { code, stderr } = run(repo, 'place', mkdtempSync(join(tmpdir(), 'sbr-work-')));
  assert.equal(code, 2);
  assert.match(stderr, /approved fingerprint/);
});

test('canvas writes the five artboards, and compare finds an edit', () => {
  const repo = approvedRepo();
  const expected = mkdtempSync(join(tmpdir(), 'sbr-expected-'));
  const live = mkdtempSync(join(tmpdir(), 'sbr-live-'));
  const { json } = run(repo, 'canvas', expected);
  assert.equal(json.files.length, 5);
  mkdirSync(join(live, 'project'));
  json.files.forEach((file) => copyFileSync(join(expected, file), join(live, file)));
  assert.equal(compareArtboards(expected, live).matches, true);
  const main = join(live, 'project/Main.dc.html');
  writeFileSync(main, readFileSync(main, 'utf8').replace('Quiero acceso anticipado', 'Quiero entrar'));
  writeFileSync(join(live, 'project/Extra.dc.html'), '<html></html>');
  const result = compareArtboards(expected, live);
  assert.deepEqual(result.changed, ['project/Main.dc.html']);
  assert.deepEqual(result.extra, ['project/Extra.dc.html']);
  assert.equal(run(repo, 'compare', expected, live).code, 1);
});

test('the gate passes a requirement only when every tool that checks it passed', () => {
  const result = mergeGate(contract, { design: allRows('pass'), landing: allRows('pass'), capture: allRows('pass'), reviewer: null });
  assert.equal(result.failed.length, 0);
  assert.ok(result.skipped.includes('R6'));
  assert.ok(result.skipped.includes('R27'));
  assert.ok(result.passed.includes('R3'));
});

test('a contrast the approved design breaks goes back to design, naming R12', () => {
  const design = { ...allRows('pass'), R12: { status: 'fail', detail: 'ink_muted on canvas is 2.1:1' } };
  const landing = { ...allRows('pass'), R12: { status: 'fail', detail: 'ink_muted on canvas is 2.1:1' } };
  const result = mergeGate(contract, { design, landing, capture: allRows('pass'), reviewer: null });
  assert.deepEqual(result.failed.map(({ id, origin }) => [id, origin]), [['R12', 'design']]);
});

test('a head that differs from the approved copy is fixed in the landing', () => {
  const landing = { ...allRows('pass'), R30: { status: 'fail', detail: 'og:title differs' } };
  const result = mergeGate(contract, { design: allRows('pass'), landing, capture: allRows('pass'), reviewer: null });
  assert.deepEqual(result.failed.map(({ id, origin }) => [id, origin]), [['R30', 'landing']]);
});

test('skeleton rows are the template and drawn-page rows are the design', () => {
  const landing = { ...allRows('pass'), R28: { status: 'fail', detail: 'src/styles/extra.css is outside the template' } };
  const capture = { ...allRows('pass'), R13: { status: 'fail', detail: 'subtitle 3.9:1' } };
  const result = mergeGate(contract, { design: allRows('pass'), landing, capture, reviewer: null });
  assert.deepEqual(result.failed.map(({ id, origin }) => [id, origin]), [['R13', 'design'], ['R28', 'template']]);
});

test('reviewer answers are read as rows plus audience, promise and notes', () => {
  const text = 'approved\nR7\tpass\theadline first\nR6\tpass\tholds in gray\naudience: builders\npromise: know before coding\nnote: something';
  assert.deepEqual(rowsOf(text).R6, { status: 'pass', detail: 'holds in gray' });
  assert.deepEqual(reviewerExtras(text), { audience: 'builders', promise: 'know before coding', notes: ['something'] });
});

test('the manual checklist never marks an unconfirmed line as passed', () => {
  const rows = Object.fromEntries(checklistRows(contract, ['R3'], ['R19']).map(([id, status]) => [id, status]));
  assert.equal(rows.R3, 'pass');
  assert.equal(rows.R19, 'fail');
  assert.equal(rows.R13, 'skip');
  assert.throws(() => checklistRows(contract, ['R12'], []));
});

test('record refuses a gate with failures and writes landing.json otherwise', () => {
  const repo = approvedRepo();
  const work = mkdtempSync(join(tmpdir(), 'sbr-work-'));
  writeJson(join(work, 'failed.json'), { passed: [], failed: [{ id: 'R12' }], skipped: [] });
  assert.equal(run(repo, 'record', '--url', 'https://x.vercel.app', '--gate', join(work, 'failed.json')).code, 2);
  writeJson(join(work, 'gate.json'), { passed: ['R1'], failed: [], skipped: ['R6'] });
  const { code } = run(repo, 'record', '--url', 'https://x.vercel.app/', '--gate', join(work, 'gate.json'));
  assert.equal(code, 0);
  const published = readJson(join(repo, '.sbr/landing.json'));
  assert.equal(published.url, 'https://x.vercel.app');
  assert.match(published.fingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(published.verification, { passed: ['R1'], failed: [], skipped: ['R6'] });
});

test('helpers: Node version and the visit URL', () => {
  assert.equal(nodeIsRecentEnough('v22.23.4'), true);
  assert.equal(nodeIsRecentEnough('v22.23.1'), false);
  assert.equal(nodeIsRecentEnough('v24.0.0'), true);
  assert.equal(visitUrl('https://a.vercel.app/?screen=2'), 'https://a.vercel.app/?src=test&debug=1');
});
