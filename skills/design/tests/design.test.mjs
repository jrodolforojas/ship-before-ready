import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = join(PLUGIN_ROOT, 'skills/design/scripts/design.mjs');
const NEUTRAL = join(PLUGIN_ROOT, 'templates/neutral-design/tokens.json');
const CONTRAST = join(PLUGIN_ROOT, 'templates/canvas/fixtures/contrast-tokens.json');
const EXAMPLE_COPY = join(PLUGIN_ROOT, 'templates/example/es.json');
const EXAMPLE_BRIEF = join(PLUGIN_ROOT, 'templates/example/brief.md');
const EXAMPLE_BOARDS = ['promise-phone.html', 'promise-desktop.html'].map((name) => join(PLUGIN_ROOT, 'templates/example', name));
const HERO = 'align-items: center; gap: var(--spacing-group); text-align: center';
const CARD_FILL = 'background-color: var(--color-surface); border: var(--line-width) solid var(--color-line)';
const BOARD_VARIANTS = {
  a: (html) => html,
  b: (html) => html.replaceAll(HERO, 'align-items: flex-start; gap: var(--spacing-group); text-align: left'),
  c: (html) => html.replaceAll(CARD_FILL, 'border: var(--line-width) solid var(--color-line)'),
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function run(repo, ...args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repo, encoding: 'utf8' });
  const json = result.stdout.trim().startsWith('{') ? JSON.parse(result.stdout) : null;
  return { code: result.status, json, stderr: result.stderr };
}

function thirdDirection() {
  const tokens = readJson(NEUTRAL);
  tokens.name = 'Verde';
  tokens.fonts.display.family = 'Archivo';
  tokens.fonts.body.family = 'Archivo';
  tokens.color.accent = '#1F6F4A';
  return tokens;
}

function makeRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'sbr-design-'));
  mkdirSync(join(repo, '.sbr/design'), { recursive: true });
  for (const letter of ['a', 'b', 'c']) mkdirSync(join(repo, '.sbr/sketches', letter), { recursive: true });
  writeFileSync(join(repo, '.sbr/brief.md'), readFileSync(EXAMPLE_BRIEF, 'utf8').replace('reviewer: pending', 'reviewer: approved'));
  copyFileSync(EXAMPLE_COPY, join(repo, '.sbr/design/copy.es.json'));
  copyFileSync(NEUTRAL, join(repo, '.sbr/sketches/a/tokens.json'));
  copyFileSync(CONTRAST, join(repo, '.sbr/sketches/b/tokens.json'));
  writeJson(join(repo, '.sbr/sketches/c/tokens.json'), thirdDirection());
  for (const [letter, variant] of Object.entries(BOARD_VARIANTS)) {
    for (const board of EXAMPLE_BOARDS) writeFileSync(join(repo, '.sbr/sketches', letter, board.split('/').at(-1)), variant(readFileSync(board, 'utf8')));
  }
  return repo;
}

const sketches = ['a', 'b', 'c'].map((letter) => `.sbr/sketches/${letter}/tokens.json`);

test('status reads the brief and finds nothing approved', () => {
  const repo = makeRepo();
  const { code, json } = run(repo, 'status');
  assert.equal(code, 0);
  assert.deepEqual(json.brief, { exists: true, approved: true, locale: 'es' });
  assert.equal(json.copy, '.sbr/design/copy.es.json');
  assert.equal(json.choice, null);
  assert.equal(json.landing, false);
});

test('distinct passes three different directions', () => {
  const { code, json } = run(makeRepo(), 'distinct');
  assert.equal(code, 0);
  assert.deepEqual(json.problems, []);
});

test('distinct names a repeated composition, a repeated pair and close accents', () => {
  const repo = makeRepo();
  const close = readJson(join(repo, sketches[0]));
  close.color.accent = '#1F6A55';
  writeJson(join(repo, sketches[2]), close);
  for (const board of EXAMPLE_BOARDS) copyFileSync(board, join(repo, '.sbr/sketches/c', board.split('/').at(-1)));
  const { code, json } = run(repo, 'distinct');
  assert.equal(code, 1);
  assert.match(json.problems.join('\n'), /a and c share their composition/);
  assert.match(json.problems.join('\n'), /a and c repeat the pair Public Sans \+ Public Sans/);
});

test('distinct exempts the palette when the builder brought it', () => {
  const repo = makeRepo();
  for (const path of sketches) {
    const tokens = readJson(join(repo, path));
    tokens.palette_source = 'builder';
    tokens.color.accent = '#1F6F4A';
    tokens.scheme = 'light';
    writeJson(join(repo, path), tokens);
  }
  const { json } = run(repo, 'distinct');
  assert.equal(json.builder_palette, true);
  assert.ok(json.problems.every((problem) => !/accents/.test(problem)));
});

test('distinct checks which direction follows and which departs from the market', () => {
  const repo = makeRepo();
  const market = ['--market-color', '#2E7D4F', '--market-scheme', 'light'];
  assert.equal(run(repo, 'distinct', ...market, '--follows', 'c', '--departs', 'b').code, 0);
  const wrong = run(repo, 'distinct', ...market, '--follows', 'b', '--departs', 'c');
  assert.equal(wrong.code, 1);
  assert.equal(wrong.json.problems.length, 2);
});

test('canvas draws six artboards, then one direction whole, removing the others', () => {
  const repo = makeRepo();
  const work = join(repo, 'work');
  const three = run(repo, 'canvas', work, 'a', 'b', 'c', '--title', 'Prueba', '--estimate');
  assert.equal(three.code, 0);
  assert.equal(three.json.entry, 'project/Main.dc.html');
  assert.equal(three.json.rest.length, 5);
  const index = readJson(join(work, 'project/canvas.json'));
  assert.equal(index.title, 'Prueba');
  assert.deepEqual(Object.keys(index.notes), ['direction-a', 'direction-b', 'direction-c']);

  const one = run(repo, 'canvas', work, 'b', '--title', 'Prueba', '--estimate');
  assert.equal(one.code, 0);
  assert.deepEqual(one.json.rest, ['project/Promise-desktop.dc.html', 'project/Email-phone.dc.html', 'project/Questions-phone.dc.html', 'project/Done-phone.dc.html']);
  assert.deepEqual(one.json.removed, ['project/A-desktop.dc.html', 'project/B-phone.dc.html', 'project/B-desktop.dc.html', 'project/C-phone.dc.html', 'project/C-desktop.dc.html']);
  assert.equal(existsSync(join(work, 'project/B-phone.dc.html')), false);
  assert.deepEqual(readJson(join(work, 'project/canvas.json')).createdOnFiles, index.createdOnFiles);
  assert.match(readFileSync(join(work, 'project/Main.dc.html'), 'utf8'), /#F5B83D/i);
  assert.match(readFileSync(join(work, 'project/Main.dc.html'), 'utf8'), /text-align: left/);
  assert.equal(one.json.measured, false);
});

test('canvas refuses a direction without its boards', () => {
  const repo = makeRepo();
  writeFileSync(join(repo, '.sbr/sketches/b/promise-desktop.html'), '');
  rmSync(join(repo, '.sbr/sketches/b/promise-desktop.html'));
  const result = run(repo, 'canvas', join(repo, 'work'), 'b', '--estimate');
  assert.equal(result.code, 2);
  assert.match(result.stderr, /promise-desktop\.html/);
});

test('preview writes plain pages without the error state', () => {
  const repo = makeRepo();
  const { code, json } = run(repo, 'preview', join(repo, 'work'), 'a');
  assert.equal(code, 0);
  assert.equal(json.pages.length, 5);
  const email = readFileSync(json.pages.find((page) => page.path.endsWith('Email-phone.html')).path, 'utf8');
  assert.doesNotMatch(email, /sc-if|email-error|support\.js/);
});

test('canvas refuses two directions', () => {
  const repo = makeRepo();
  assert.equal(run(repo, 'canvas', join(repo, 'work'), 'a', 'b', '--estimate').code, 2);
});

test('approve writes the choice with the fingerprint of tokens, copy and boards, and reopen withdraws it', () => {
  const repo = makeRepo();
  writeFileSync(join(repo, '.sbr/design/system.md'), '# Sistema\n');
  const { code, json } = run(repo, 'approve', '--chosen', 'c', '--canvas', 'https://claude.ai/artifact/abc', '--reason', 'Se lee "tranquila": me gusta');
  assert.equal(code, 0);
  const expected = createHash('sha256')
    .update(readFileSync(join(repo, '.sbr/design/tokens.json')))
    .update(readFileSync(join(repo, '.sbr/design/copy.es.json')))
    .update(readFileSync(join(repo, '.sbr/design/promise-phone.html')))
    .update(readFileSync(join(repo, '.sbr/design/promise-desktop.html')))
    .digest('hex');
  assert.equal(readFileSync(join(repo, '.sbr/design/promise-phone.html'), 'utf8'), readFileSync(join(repo, '.sbr/sketches/c/promise-phone.html'), 'utf8'));
  assert.equal(json.fingerprint, `sha256:${expected}`);
  const choice = readFileSync(join(repo, '.sbr/design/choice.md'), 'utf8');
  assert.match(choice, /^---\nchosen: c\napproved: \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\ncanvas: "https:\/\/claude.ai\/artifact\/abc"\n/);
  assert.match(choice, /reason: "Se lee 'tranquila': me gusta"/);
  assert.equal(run(repo, 'status').json.choice.fingerprint_matches, true);

  writeFileSync(join(repo, '.sbr/design/copy.es.json'), readFileSync(EXAMPLE_COPY, 'utf8').replace('Quiero acceso anticipado', 'Quiero entrar primero'));
  assert.equal(run(repo, 'status').json.choice.fingerprint_matches, false);
  writeFileSync(join(repo, '.sbr/design/copy.es.json'), readFileSync(EXAMPLE_COPY, 'utf8'));
  assert.equal(run(repo, 'status').json.choice.fingerprint_matches, true);
  writeFileSync(join(repo, '.sbr/design/promise-desktop.html'), `${readFileSync(join(repo, '.sbr/design/promise-desktop.html'), 'utf8')}\n`);
  assert.equal(run(repo, 'status').json.choice.fingerprint_matches, false);

  assert.equal(run(repo, 'reopen').code, 0);
  assert.equal(run(repo, 'status').json.choice.approved, null);
});

test('approve refuses a direction that fails the verifier, and one without system.md', () => {
  const repo = makeRepo();
  assert.equal(run(repo, 'approve', '--chosen', 'a', '--canvas', 'none', '--reason', 'x').code, 2);
  writeFileSync(join(repo, '.sbr/design/system.md'), '# Sistema\n');
  const tokens = readJson(join(repo, sketches[0]));
  tokens.color.ink_muted = '#BBBBBB';
  writeJson(join(repo, sketches[0]), tokens);
  const { code, json } = run(repo, 'approve', '--chosen', 'a', '--canvas', 'none', '--reason', 'x');
  assert.equal(code, 1);
  assert.ok(json.failed.some((row) => row.id === 'R12'));
  assert.equal(existsSync(join(repo, '.sbr/design/choice.md')), false);
});

test('approve refuses boards that break a rule of the free screen', () => {
  const repo = makeRepo();
  writeFileSync(join(repo, '.sbr/design/system.md'), '# Sistema\n');
  const phone = join(repo, '.sbr/sketches/a/promise-phone.html');
  writeFileSync(phone, readFileSync(phone, 'utf8').replace('</header>', '<a href="#">x</a></header>'));
  const { code, json } = run(repo, 'approve', '--chosen', 'a', '--canvas', 'none', '--reason', 'x');
  assert.equal(code, 1);
  assert.ok(json.failed.some((row) => row.id === 'R1'));
});
