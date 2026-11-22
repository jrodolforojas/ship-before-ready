import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { budgetProblems, dealType, moodsFrom, TRAIT_MOODS } from '../scripts/type-deal.mjs';

const PLUGIN_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(join(PLUGIN_ROOT, path), 'utf8'));
const library = readJson('templates/type-library.json');
const contract = readJson('templates/contract.json');
const traitLabels = readJson('locales/es/design.json').questions.personality.traits;
const lexicon = readJson('locales/es/moods.json').words;
const MOODS = ['bold', 'calm', 'classic', 'friendly', 'playful', 'precise', 'refined', 'technical', 'trusted', 'warm'];

test('the library only holds faces of its moods, never a default display face, and every system can weigh its title over its button', () => {
  const defaults = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'DM Sans', 'Plus Jakarta Sans', 'Space Grotesk', 'Outfit', 'Playfair Display', 'Fraunces', 'Lora', 'Syne', 'IBM Plex Sans', 'Instrument Sans'];
  assert.ok(library.systems.length >= 20);
  for (const system of library.systems) {
    assert.ok(system.moods.every((mood) => MOODS.includes(mood)), system.id);
    assert.ok(!defaults.includes(system.display.family), system.id);
    assert.ok(Math.max(...system.display.weights) >= 500, system.id);
  }
  assert.deepEqual([...new Set(Object.values(TRAIT_MOODS).flat())].filter((mood) => !MOODS.includes(mood)), []);
  assert.deepEqual(Object.keys(TRAIT_MOODS).sort(), Object.keys(traitLabels).sort());
  assert.deepEqual([...new Set(Object.values(lexicon).flat())].filter((mood) => !MOODS.includes(mood)), []);
});

test('a trait counts once, the longest phrase wins, and words outside the lexicon count nothing', () => {
  const { weights, matched } = moodsFrom({ traitText: 'Cercano y cálido; con ENFOQUE', wordsText: 'quiero tomar acción, nada más', traitLabels, lexicon });
  assert.deepEqual(matched.map(({ word }) => word), ['Cercano y cálido', 'tomar accion', 'enfoque']);
  assert.deepEqual(weights, { warm: 2, friendly: 2, bold: 1, precise: 1 });
  assert.deepEqual(moodsFrom({ traitText: '', wordsText: 'xyz', traitLabels, lexicon }), { weights: {}, matched: [] });
});

test('the deal is the same for the same seed, differs across seeds, and gives three faces of different classes', () => {
  const weights = { warm: 2, bold: 1 };
  const first = dealType({ library, weights, seed: 'uno' });
  assert.deepEqual(dealType({ library, weights, seed: 'uno' }), first);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((system) => system.class)).size, 3);
  assert.equal(new Set(first.map((system) => system.display.family)).size, 3);
  const seeds = ['uno', 'dos', 'tres', 'cuatro', 'cinco'].map((seed) => dealType({ library, weights: {}, seed }).map(({ id }) => id).join());
  assert.ok(new Set(seeds).size > 1);
});

test('the deal favours the systems that carry the builder moods', () => {
  const [first] = dealType({ library, weights: { classic: 3, refined: 3 }, seed: 'x' });
  assert.ok(first.moods.includes('classic') && first.moods.includes('refined'), first.id);
  assert.deepEqual(first.answers.sort(), ['classic', 'refined']);
});

test('every system of the library, dealt, stays within the font budget', () => {
  for (const system of library.systems) {
    const [dealt] = dealType({ library: { systems: [system] }, weights: {}, seed: 'x', count: 1 });
    assert.deepEqual(budgetProblems(dealt, contract.tokens.fonts), [], system.id);
    assert.ok(dealt.display.weights.every((weight) => weight >= Math.max(...dealt.body.weights)), system.id);
    assert.ok(contract.tokens.fonts.weight_step && dealt.body.weights.every((weight) => weight % contract.tokens.fonts.weight_step === 0), system.id);
  }
  const tooMany = { id: 'x', display: { family: 'A', weights: [400, 500, 600] }, body: { family: 'B', weights: [400, 600] } };
  assert.deepEqual(budgetProblems(tooMany, contract.tokens.fonts), ['x: 5 family and weight pairs, at most 4']);
});

test('the deal leaves out families the canvas cannot load', () => {
  const fonts = new Set(library.systems.filter((system) => system.class !== 'serif').flatMap((system) => [system.display.family, system.body.family]));
  const dealt = dealType({ library, weights: { classic: 5 }, seed: 'x', fonts });
  assert.ok(dealt.every((system) => fonts.has(system.display.family) && fonts.has(system.body.family)));
});
