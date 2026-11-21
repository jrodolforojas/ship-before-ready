import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it, test } from 'node:test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHECKED_BY } from '../verify-design.mjs';
import { findChrome } from '../capture.mjs';
import { SCRIPTS, contract, idsWithStatus, neutralTokens, readPng, runScript, runScriptAsync, tempDir, withChanges, writeFiles } from './helpers.mjs';
import { PAGE_CSS, PAGE_SCRIPT, distPage, writeLanding } from './landing-fixture.mjs';

const CAPTURE_ROWS = contract.requirement_ids.filter((id) => CHECKED_BY[id].includes('capture'));
const hasChrome = findChrome() !== null;
const skipWithoutChrome = { skip: hasChrome ? false : 'Chrome is not installed' };

const urlOf = (projectDir) => pathToFileURL(distPage(projectDir)).href;
const withCss = (extra) => ({ css: `${PAGE_CSS}${extra}` });
const withScript = (from, to) => {
  assert.ok(PAGE_SCRIPT.includes(from), `fixture script no longer contains ${from}`);
  return { script: PAGE_SCRIPT.replace(from, to) };
};
const measure = (options) => runScriptAsync(SCRIPTS.capture, [urlOf(writeLanding(options)), tempDir('sbr-shots-'), '--measure']);

const DRAWN_DEFECTS = [
  { name: 'a hero pushed under the first view', ids: ['R3'], ...withCss('[data-sbr="screen-promise"] header{padding-top:560px}') },
  { name: 'muted text too light for its background', ids: ['R13'], ...withCss('.text-ink-muted{color:#C4C4C4}') },
  { name: 'controls shorter than 44 px', ids: ['R18'], ...withCss('.touch-target{min-block-size:0;min-inline-size:0}.py-item{padding-block:2px}') },
  { name: 'a block wider than the window', ids: ['R19'], ...withCss('[data-sbr="pains"]{min-width:1600px}') },
  { name: 'a form as wide as the page', ids: ['R20'], ...withCss('.form-column{max-inline-size:none}') },
  { name: 'an error that never shows', ids: ['R21'], ...withScript('error.hidden = invalid.length === 0;', '') },
  { name: 'a focus ring of 1 px', ids: ['R22'], ...withCss('.focus-visible\\:outline-2:focus-visible{outline-width:1px}') },
  { name: 'a button that ignores the pointer', ids: ['R22'], ...withCss('.hover\\:opacity-90:hover{opacity:1}') },
  { name: 'a screen change that leaves the focus behind', ids: ['R22'], ...withScript('titles[number - 1].focus();', '') },
  { name: 'a submit that neither advances nor fails', ids: ['R24'], ...withScript('queueMicrotask(() => { button.textContent = label; button.disabled = false; show(next); });', '') },
  { name: 'a notice under the first view', ids: ['R25'], ...withCss('[data-sbr="done-title"]{padding-bottom:640px}') },
];

describe('capture.mjs with Chrome', { concurrency: 4, ...skipWithoutChrome }, () => {
  it('writes eight screenshots of the fixture at the two first-view sizes', async () => {
    const output = tempDir('sbr-shots-');
    const run = await runScriptAsync(SCRIPTS.capture, [urlOf(writeLanding()), output]);
    assert.equal(run.code, 0, run.stderr);
    const expected = contract.viewports.first_view.flatMap(({ width, height }) => contract.screens.map((screen) => `screen-${screen.number}-${width}x${height}.png`));
    assert.deepEqual(readdirSync(output).sort(), [...expected].sort());
    assert.deepEqual(run.stdout.trim().split('\n').sort(), expected.map((file) => join(output, file)).sort());
    const phone = readPng(join(output, 'screen-1-375x667.png'));
    const desktop = readPng(join(output, 'screen-4-1440x900.png'));
    assert.deepEqual([phone.width, phone.height, desktop.width, desktop.height], [375, 667, 1440, 900]);
  });

  it('measures the fixture and passes every drawn requirement', async () => {
    const run = await measure();
    assert.equal(run.code, 0, run.stdout + run.stderr);
    assert.deepEqual(run.rows.map((row) => row.id), contract.requirement_ids);
    assert.deepEqual(idsWithStatus(run.rows, 'pass'), CAPTURE_ROWS);
    assert.deepEqual(idsWithStatus(run.rows, 'fail'), []);
  });

  for (const defect of DRAWN_DEFECTS) {
    it(`drawn defect: ${defect.name} fails ${defect.ids.join(' and ')}`, async () => {
      const run = await measure(defect);
      assert.equal(run.code, 1, run.stdout + run.stderr);
      assert.deepEqual(idsWithStatus(run.rows, 'fail'), defect.ids);
    });
  }

  it('takes the screenshots without color with --gray', async () => {
    const tokens = withChanges(neutralTokens(), { 'color.accent': '#C62828' });
    const url = urlOf(writeLanding({ tokens }));
    const [colorDir, grayDir] = [tempDir('sbr-shots-'), tempDir('sbr-shots-')];
    const [color, gray] = await Promise.all([runScriptAsync(SCRIPTS.capture, [url, colorDir]), runScriptAsync(SCRIPTS.capture, [url, grayDir, '--gray'])]);
    assert.deepEqual([color.code, gray.code], [0, 0], color.stderr + gray.stderr);
    const spreadOf = (image) => {
      let widest = 0;
      for (let y = 0; y < image.height; y += 3) {
        for (let x = 0; x < image.width; x += 3) {
          const [red, green, blue] = image.pixelAt(x, y);
          widest = Math.max(widest, Math.abs(red - green), Math.abs(green - blue));
        }
      }
      return widest;
    };
    assert.ok(spreadOf(readPng(join(colorDir, 'screen-1-375x667.png'))) > 60);
    assert.ok(spreadOf(readPng(join(grayDir, 'screen-1-375x667-gray.png'))) <= 2);
  });

  it('captures only the first view of a page that is not a landing and refuses to measure it', async () => {
    const folder = writeFiles(tempDir(), { 'index.html': '<!doctype html><html lang="es"><body><h1>Hola</h1></body></html>' });
    const url = pathToFileURL(join(folder, 'index.html')).href;
    const output = tempDir('sbr-shots-');
    const run = await runScriptAsync(SCRIPTS.capture, [url, output]);
    assert.equal(run.code, 0, run.stderr);
    assert.deepEqual(readdirSync(output).sort(), ['screen-1-1440x900.png', 'screen-1-375x667.png']);
    assert.match(run.stderr, /not a landing built by the plugin/);
    const measured = await runScriptAsync(SCRIPTS.capture, [url, output, '--measure']);
    assert.equal(measured.code, 2);
    assert.equal(measured.stdout, '');
  });

  it('exits 2 when the page cannot be opened', async () => {
    const run = await runScriptAsync(SCRIPTS.capture, ['http://127.0.0.1:9/', tempDir('sbr-shots-')]);
    assert.equal(run.code, 2);
    assert.match(run.stderr, /cannot open/);
  });
});

test('capture.mjs exits 3 and says so when there is no Chrome', () => {
  const run = runScript(SCRIPTS.capture, ['http://localhost:4321/', tempDir('sbr-shots-')], { CHROME_PATH: '/nonexistent/chrome' });
  assert.equal(run.code, 3);
  assert.match(run.stderr, /Chrome is not available/);
  assert.equal(run.stdout, '');
});

test('capture.mjs exits 2 on wrong usage', () => {
  assert.equal(runScript(SCRIPTS.capture, []).code, 2);
  assert.equal(runScript(SCRIPTS.capture, ['not a url', tempDir()]).code, 2);
  assert.equal(runScript(SCRIPTS.capture, ['http://localhost:4321/', tempDir(), '--fast']).code, 2);
});

test('Chrome is found through CHROME_PATH, then the usual places, then PATH', () => {
  const folder = writeFiles(tempDir(), { chromium: '' });
  assert.equal(findChrome({ CHROME_PATH: join(folder, 'chromium') }, 'linux'), join(folder, 'chromium'));
  assert.equal(findChrome({ CHROME_PATH: join(folder, 'missing') }, 'linux'), null);
  assert.equal(findChrome({ PATH: folder }, 'linux'), join(folder, 'chromium'));
  assert.equal(findChrome({ PATH: tempDir() }, 'linux'), null);
});
