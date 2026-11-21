import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import {
  BANNED_PHRASES,
  CHECKED_BY,
  EXIT_CODES,
  PRICE_WORDS,
  checkDesign,
  contrastRatio,
  createReport,
  formatRows,
  hslOf,
  normalizeText,
  phrasesIn,
} from '../verify-design.mjs';
import {
  SCRIPTS,
  contract,
  exampleCopy,
  idsWithStatus,
  neutralTokens,
  rowOf,
  runScript,
  tempDir,
  withChange,
  withChanges,
  without,
  writeFiles,
} from './helpers.mjs';

const DESIGN_ROWS = contract.requirement_ids.filter((id) => CHECKED_BY[id].includes('design'));

function verify(tokens, copy, locale = 'es') {
  const report = createReport(contract, 'design');
  checkDesign({ tokens, copy, locale, contract, report });
  return report.rows();
}

const failuresOf = (tokens, copy) => idsWithStatus(verify(tokens, copy), 'fail');
const longTitle = 'Antes de escribir una sola línea de código, averigua de verdad si alguien lo quiere usar hoy.';

const SEEDED_DEFECTS = [
  { name: 'low contrast of the muted ink', id: 'R12', tokens: { 'color.ink_muted': '#9A9A9A' } },
  { name: 'a headline of more than 70 characters', id: 'R2', copy: { 'hero.title': longTitle } },
  { name: 'a tight body line height', id: 'R9', tokens: { 'text.body.line_height': 1.2 } },
  { name: 'a spacing value off the 4 px grid', id: 'R17', tokens: { 'spacing.item': 10 } },
  { name: 'a violet accent nobody asked for', id: 'R15', tokens: { 'color.accent': '#7C3AED' } },
];

const OTHER_DEFECTS = [
  { name: 'a heading off the scale', ids: ['R4'], tokens: { 'text.heading.size': 30 } },
  { name: 'a lead smaller than the body', ids: ['R5'], tokens: { 'text.lead.size': 16 } },
  { name: 'a label under 14 px', ids: ['R8'], tokens: { 'text.label.size': 12 } },
  { name: 'small text under 14 px', ids: ['R8', 'R26'], tokens: { 'text.small.size': 12 } },
  { name: 'crushed title tracking', ids: ['R10'], tokens: { 'text.title.letter_spacing': -0.08 } },
  { name: 'a measure of 90ch', ids: ['R10'], tokens: { 'measure.prose': 90 } },
  { name: 'five font files', ids: ['R11'], tokens: { 'fonts.body.weights': [300, 400, 500, 600] } },
  { name: 'a weight no font file carries', ids: ['R11'], tokens: { 'text.button.font_weight': 700 } },
  { name: 'pure black ink', ids: ['R12'], tokens: { 'color.ink': '#000000' } },
  { name: 'a dark scheme on a light canvas', ids: ['R12'], tokens: { scheme: 'dark' } },
  { name: 'a glowing shadow', ids: ['R15'], tokens: { 'shape.shadow_card': { x: 0, y: 0, blur: 24, opacity: 0.6 } } },
  { name: 'spacing levels out of order', ids: ['R17'], tokens: { 'spacing.group': 48 } },
  { name: 'a slow transition', ids: ['R23'], tokens: { 'measure.motion_duration': 600 } },
  { name: 'an emoji in the button', ids: ['R15'], copy: { cta: 'Quiero acceso 🚀' } },
  { name: 'a banned phrase', ids: ['R15'], copy: { 'hero.subtitle': 'La solución todo en uno para validar tu idea.' } },
  { name: 'a generic button label', ids: ['R15'], copy: { 'email.submit': 'Enviar' } },
  { name: 'four pains', ids: ['R2'], copy: { pains: ['Uno.', 'Dos.', 'Tres.', 'Cuatro.'] } },
  { name: 'two steps', ids: ['R2'], copy: { steps: ['Uno.', 'Dos.'] } },
  { name: 'a privacy line over its limit', ids: ['R26'], copy: { 'email.privacy': 'x'.repeat(161) } },
  { name: 'an amount of money', ids: ['R27'], copy: { closing: 'Pagaste $500 por algo que nadie usó.' } },
  { name: 'a price word', ids: ['R27'], copy: { closing: 'Pruébalo gratis antes de construirlo.' } },
  { name: 'an amount with a currency word', ids: ['R27'], copy: { closing: 'Ahorra 200 dólares antes de construir.' } },
  { name: 'a short meta description', ids: ['R30'], copy: { 'meta.description': 'Muy corta.' } },
  { name: 'a long meta title', ids: ['R30'], copy: { 'meta.title': 'x'.repeat(61) } },
];

test('the neutral design and the example copy pass every design requirement', () => {
  const rows = verify(neutralTokens(), exampleCopy());
  assert.deepEqual(rows.map((row) => row.id), contract.requirement_ids);
  assert.deepEqual(idsWithStatus(rows, 'fail'), []);
  assert.deepEqual(idsWithStatus(rows, 'pass'), DESIGN_ROWS);
});

for (const defect of SEEDED_DEFECTS) {
  test(`seeded defect: ${defect.name} fails ${defect.id} and nothing else`, () => {
    const tokens = withChanges(neutralTokens(), defect.tokens ?? {});
    const copy = withChanges(exampleCopy(), defect.copy ?? {});
    assert.deepEqual(failuresOf(tokens, copy), [defect.id]);
  });
}

test('five seeded defects give five failures, each with its number', () => {
  const tokens = SEEDED_DEFECTS.reduce((current, defect) => withChanges(current, defect.tokens ?? {}), neutralTokens());
  const copy = SEEDED_DEFECTS.reduce((current, defect) => withChanges(current, defect.copy ?? {}), exampleCopy());
  assert.deepEqual(failuresOf(tokens, copy), ['R2', 'R9', 'R12', 'R15', 'R17']);
});

for (const defect of OTHER_DEFECTS) {
  test(`defect: ${defect.name} fails ${defect.ids.join(' and ')}`, () => {
    const tokens = withChanges(neutralTokens(), defect.tokens ?? {});
    const copy = withChanges(exampleCopy(), defect.copy ?? {});
    assert.deepEqual(failuresOf(tokens, copy), defect.ids);
  });
}

test('a failure names the token, its value and the threshold', () => {
  const rows = verify(withChange(neutralTokens(), 'color.ink_muted', '#9A9A9A'), exampleCopy());
  assert.match(rowOf(rows, 'R12').detail, /ink-muted #9A9A9A on canvas #FAFAFA is 2\.\d\d:1, needs 4\.5:1/);
});

test('a violet accent passes when the builder asked for it', () => {
  const tokens = withChanges(neutralTokens(), { 'color.accent': '#7C3AED', palette_source: 'builder' });
  assert.deepEqual(failuresOf(tokens, exampleCopy()), []);
});

test('a key outside the contract fails R14 and leaves the value rows unchecked', () => {
  const rows = verify(withChange(neutralTokens(), 'color.brand', '#FF0000'), exampleCopy());
  assert.deepEqual(idsWithStatus(rows, 'fail'), ['R14']);
  assert.match(rowOf(rows, 'R14').detail, /color\.brand is not a key of the contract/);
  assert.equal(rowOf(rows, 'R12').status, 'skip');
  assert.equal(rowOf(rows, 'R2').status, 'pass');
});

test('malformed token values fail R14, not a crash', () => {
  const tokens = withChanges(neutralTokens(), { 'color.accent': 'red', 'text.title.size': '35', decor: 'blobs' });
  const detail = rowOf(verify(tokens, exampleCopy()), 'R14').detail;
  assert.match(detail, /color\.accent must be a six-digit hex color/);
  assert.match(detail, /text\.title\.size must be a number/);
  assert.match(detail, /decor is "blobs"/);
});

test('a missing copy key fails R32 and leaves the copy rows unchecked', () => {
  const rows = verify(neutralTokens(), without(exampleCopy(), 'done.notice'));
  assert.deepEqual(idsWithStatus(rows, 'fail'), ['R32']);
  assert.match(rowOf(rows, 'R32').detail, /done\.notice is missing/);
  assert.equal(rowOf(rows, 'R2').status, 'skip');
  assert.equal(rowOf(rows, 'R12').status, 'pass');
});

test('copy that is not plain text fails R32', () => {
  const cases = {
    closing: '<b>Averigua</b> si alguien lo quiere.',
    'done.next': 'Te avisaremos **pronto**.',
    'email.title': ' ¿A qué correo te avisamos?',
    'email.privacy': '',
    progress: 'Paso {current} de 2',
    lang: 'en',
    extra: 'no',
  };
  for (const [key, value] of Object.entries(cases)) {
    const rows = verify(neutralTokens(), withChange(exampleCopy(), key, value));
    assert.equal(rowOf(rows, 'R32').status, 'fail', key);
  }
});

test('words about effort are not price words', () => {
  assert.deepEqual(phrasesIn('Con AI construir es barato, pero sigue costando semanas. ¿Qué le costó?', PRICE_WORDS), []);
  assert.deepEqual(phrasesIn('Planes y precios', PRICE_WORDS).sort(), ['planes y precios', 'precios']);
});

test('banned phrases match whole words, without accents or case', () => {
  assert.deepEqual(phrasesIn('La SOLUCIÓN integral que esperabas', BANNED_PHRASES), ['solucion integral']);
  assert.deepEqual(phrasesIn('Una revolucionaria idea', BANNED_PHRASES), ['revolucionaria']);
  assert.deepEqual(phrasesIn('Evolucionamos contigo', BANNED_PHRASES), []);
  assert.equal(normalizeText('  ÁRBOL   Niño '), 'arbol nino');
});

test('contrast and hue follow WCAG 2 and HSL', () => {
  assert.equal(contrastRatio('#FFFFFF', '#000000'), 21);
  assert.equal(Math.round(contrastRatio('#1C1C1C', '#FAFAFA') * 100), 1633);
  assert.equal(Math.round(hslOf('#7C3AED').hue), 262);
  assert.equal(hslOf('#2E2E2E').saturation, 0);
});

test('names shared with the contract stay in sync', () => {
  assert.deepEqual(
    [EXIT_CODES.ok, EXIT_CODES.requirementFailed, EXIT_CODES.usage, EXIT_CODES.noChrome],
    [contract.exit_codes.ok, contract.exit_codes.requirement_failed, contract.exit_codes.usage_or_environment, contract.exit_codes.no_chrome],
  );
  assert.deepEqual(Object.keys(CHECKED_BY), contract.requirement_ids);
});

test('the command prints 32 tab-separated rows and exits 0 on the neutral design', () => {
  const run = runScript(SCRIPTS.design, ['templates/neutral-design/tokens.json', 'templates/example/es.json'].map((path) => join(SCRIPTS.design, '../..', path)));
  assert.equal(run.code, 0);
  assert.equal(run.stdout.trim().split('\n').length, 32);
  assert.ok(run.stdout.trim().split('\n').every((line) => line.split('\t').length === 3));
  assert.ok(run.rows.every((row) => contract.requirement_statuses.includes(row.status)));
});

test('the command exits 1 naming R12 and R2 when contrast drops and the headline grows', () => {
  const folder = writeFiles(tempDir(), {
    'tokens.json': withChange(neutralTokens(), 'color.ink_muted', '#9A9A9A'),
    'es.json': withChange(exampleCopy(), 'hero.title', longTitle),
  });
  const run = runScript(SCRIPTS.design, [join(folder, 'tokens.json'), join(folder, 'es.json')]);
  assert.equal(run.code, 1);
  assert.deepEqual(idsWithStatus(run.rows, 'fail'), ['R2', 'R12']);
});

test('the command exits 2 on wrong usage and on unreadable input', () => {
  const folder = writeFiles(tempDir(), { 'tokens.json': '{ not json', 'es.json': exampleCopy() });
  assert.equal(runScript(SCRIPTS.design, []).code, 2);
  assert.equal(runScript(SCRIPTS.design, [join(folder, 'missing.json'), join(folder, 'es.json')]).code, 2);
  const invalid = runScript(SCRIPTS.design, [join(folder, 'tokens.json'), join(folder, 'es.json')]);
  assert.equal(invalid.code, 2);
  assert.match(invalid.stderr, /not valid JSON/);
  assert.equal(invalid.stdout, '');
});

test('details never break the one-line format', () => {
  const rows = formatRows([{ id: 'R1', status: 'fail', detail: 'a\tb\nc' }]);
  assert.equal(rows, 'R1\tfail\ta b c');
});
