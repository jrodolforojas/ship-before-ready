import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import { BANNED_PHRASES, CHECKED_BY, GENERIC_BUTTON_LABELS, PRICE_WORDS } from '../verify-design.mjs';
import { REPO_ROOT, contract } from './helpers.mjs';

const read = (path) => readFileSync(join(REPO_ROOT, path), 'utf8');
const requirements = read('guides/landing-requirements.md');
const designSystem = read('guides/design-system.md');
const reviewer = read('agents/design-reviewer.md');

const cellsOf = (line) => line.split('|').slice(1, -1).map((cell) => cell.trim());
const rowsStartingWith = (text, pattern) => text.split('\n').filter((line) => pattern.test(line)).map(cellsOf);
const numbersIn = (cell) => cell.replaceAll('−', '-').match(/-?\d+(\.\d+)?/g).map(Number);

test('the requirements guide lists R1 to R32 with the tools that check each one', () => {
  const rows = rowsStartingWith(requirements, /^\| R\d+ \|/).filter((cells) => cells.length === 6);
  assert.deepEqual(rows.map((cells) => cells[0]), contract.requirement_ids);
  for (const [id, , , checkedBy] of rows) assert.deepEqual(checkedBy.split(', '), CHECKED_BY[id], id);
});

test('the design guide lists every phrase the verifier refuses', () => {
  const missing = [...BANNED_PHRASES, ...GENERIC_BUTTON_LABELS, ...PRICE_WORDS].filter((phrase) => !designSystem.includes(`\`${phrase}\``));
  assert.deepEqual(missing, []);
});

test('the ranges of the design guide are the ranges of the contract', () => {
  const styleRows = rowsStartingWith(designSystem, /^\| `(title|heading|lead|body|small|button|label)` \|/);
  assert.equal(styleRows.length, contract.tokens.text_styles.length);
  for (const [name, family, ...ranges] of styleRows) {
    const style = contract.tokens.text_styles.find((candidate) => `\`${candidate.name}\`` === name);
    assert.equal(family, style.family);
    assert.deepEqual(ranges.map(numbersIn), contract.tokens.text_style_keys.map((key) => style.ranges[key]), name);
  }
  const { spacing, shape, measure } = contract.tokens;
  const expected = {
    ...Object.fromEntries(Object.entries(spacing.ranges).map(([key, range]) => [`spacing.${key}`, range])),
    ...Object.fromEntries(Object.entries(shape.ranges).map(([key, range]) => [`shape.${key}`, range])),
    'shape.shadow_card': [...Object.values(shape.shadow_card.ranges).flat(), shape.shadow_card.opacity_max_when_blurred],
    ...Object.fromEntries(Object.entries(measure.ranges).map(([key, range]) => [`measure.${key}`, range])),
  };
  const tokenRows = rowsStartingWith(designSystem, /^\| `(spacing|shape|measure)\./);
  assert.deepEqual(tokenRows.map(([name]) => name.replaceAll('`', '')), Object.keys(expected));
  for (const [name, range, reading] of tokenRows) {
    const key = name.replaceAll('`', '');
    const stated = key === 'shape.shadow_card' ? [...numbersIn(range), ...numbersIn(reading)] : numbersIn(range);
    assert.deepEqual(stated, expected[key], key);
  }
});

test('the reviewer agent is a plugin agent that covers the reviewer requirements', () => {
  const [, frontmatter, body] = reviewer.split('---\n');
  assert.match(frontmatter, /^name: design-reviewer$/m);
  assert.match(frontmatter, /^description: .+$/m);
  assert.match(frontmatter, /^tools: Read$/m);
  const reviewed = contract.requirement_ids.filter((id) => CHECKED_BY[id].includes('reviewer'));
  assert.deepEqual(reviewed.filter((id) => !body.includes(`### ${id} `)), []);
});

const codesOfTable = (text, heading) => {
  const section = text.slice(text.indexOf(heading));
  const table = section.slice(0, section.indexOf('\n\n', section.indexOf('| Code |')));
  return rowsStartingWith(table, /^\| `[a-z_]+` \|/).map(([code]) => code.replaceAll('`', ''));
};

test('the design critic is a plugin agent whose codes are the ones of the reviewers contract', () => {
  const critic = read('agents/design-critic.md');
  const [, frontmatter] = critic.split('---\n');
  assert.match(frontmatter, /^name: design-critic$/m);
  assert.match(frontmatter, /^tools: Read$/m);
  const inAgent = codesOfTable(critic, '## The checks');
  assert.ok(inAgent.length >= 10);
  assert.deepEqual(codesOfTable(read('docs/contracts/reviewers.md'), '## Codes of `design-critic`'), inAgent);
});

test('every phrase the design skill names exists in its Spanish phrases file', () => {
  const skill = read('skills/design/SKILL.md');
  const phrases = JSON.parse(read('locales/es/design.json'));
  const valueAt = (path) => path.split('.').reduce((value, key) => value?.[key], phrases);
  const named = [...new Set([...skill.matchAll(/`([a-z_]+(?:\.[a-z_]+)+)`/g)].map(([, key]) => key))].filter((key) => key.split('.')[0] in phrases && !/\.(md|txt|json|html)$/.test(key));
  assert.ok(named.length > 30);
  assert.deepEqual(named.filter((key) => typeof valueAt(key) !== 'string' && typeof valueAt(key) !== 'object'), []);
});
