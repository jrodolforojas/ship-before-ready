import { createHash } from 'node:crypto';

export const TRAIT_MOODS = {
  serious: ['trusted', 'classic'],
  warm: ['warm', 'friendly'],
  technical: ['precise', 'technical'],
  bold: ['bold'],
  calm: ['calm', 'refined'],
  crafted: ['warm', 'classic'],
};

const TRAIT_WEIGHT = 2;
const WORD_WEIGHT = 1;
const SERIF_CLASSES = new Set(['serif', 'slab']);
const DISPLAY_WEIGHT = 600;
const BODY_WEIGHTS = [400, 600];

export const normalized = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const containsPhrase = (text, phrase) => ` ${text} `.includes(` ${normalized(phrase)} `);
const withoutPhrase = (text, phrase) => ` ${text} `.replaceAll(` ${normalized(phrase)} `, ' ').trim();

function consume(text, phrases) {
  const longestFirst = [...phrases].sort((first, second) => normalized(second).length - normalized(first).length);
  const found = [];
  const rest = longestFirst.reduce((remaining, phrase) => {
    if (!containsPhrase(remaining, phrase)) return remaining;
    found.push(phrase);
    return withoutPhrase(remaining, phrase);
  }, normalized(text));
  return { found, rest };
}

export function moodsFrom({ traitText, wordsText, traitLabels, lexicon }) {
  const labels = Object.entries(traitLabels).filter(([id]) => TRAIT_MOODS[id]);
  const traits = consume(traitText ?? '', labels.map(([, label]) => label));
  const words = consume(`${traits.rest} ${normalized(wordsText ?? '')}`, Object.keys(lexicon));
  const matched = [
    ...labels.filter(([, label]) => traits.found.includes(label)).map(([id, label]) => ({ word: label, trait: id, moods: TRAIT_MOODS[id], weight: TRAIT_WEIGHT })),
    ...words.found.map((word) => ({ word, moods: lexicon[word], weight: WORD_WEIGHT })),
  ];
  const weights = {};
  matched.forEach(({ moods, weight }) => moods.forEach((mood) => (weights[mood] = (weights[mood] ?? 0) + weight)));
  return { weights, matched };
}

const tieBreak = (seed, id) => parseInt(createHash('sha256').update(`${seed}:${id}`).digest('hex').slice(0, 8), 16);
const scoreOf = (system, weights) => system.moods.reduce((sum, mood) => sum + (weights[mood] ?? 0), 0);
const isListed = (fonts) => (system) => !fonts || (fonts.has(system.display.family) && fonts.has(system.body.family));

function closestWeights(available, wanted) {
  const listed = wanted.filter((weight) => available.includes(weight));
  if (listed.length === wanted.length) return listed;
  return [...new Set([Math.min(...available), Math.max(...available)])];
}

function dealtSystem(system, weights) {
  const fallback = SERIF_CLASSES.has(system.class) ? 'serif' : 'sans-serif';
  const displayWeight = system.display.weights.includes(DISPLAY_WEIGHT) ? DISPLAY_WEIGHT : Math.max(...system.display.weights);
  return {
    id: system.id,
    class: system.class,
    moods: system.moods,
    answers: system.moods.filter((mood) => weights[mood]),
    display: { family: system.display.family, weights: [displayWeight], fallback, tracking: system.display.tracking },
    body: { family: system.body.family, weights: closestWeights(system.body.weights, BODY_WEIGHTS), fallback: system.body.family === system.display.family ? fallback : 'sans-serif' },
    available: { display: system.display.weights, body: system.body.weights },
  };
}

export function budgetProblems(dealt, spec) {
  const pairs = new Set([...dealt.display.weights.map((weight) => `${dealt.display.family}/${weight}`), ...dealt.body.weights.map((weight) => `${dealt.body.family}/${weight}`)]);
  const families = new Set([dealt.display.family, dealt.body.family]);
  return [
    ...(families.size > spec.families_max ? [`${dealt.id}: ${families.size} families, at most ${spec.families_max}`] : []),
    ...(pairs.size > spec.family_weight_pairs_max ? [`${dealt.id}: ${pairs.size} family and weight pairs, at most ${spec.family_weight_pairs_max}`] : []),
  ];
}

export function dealType({ library, weights, seed, fonts = null, count = 3 }) {
  const ranked = library.systems
    .filter(isListed(fonts))
    .map((system) => ({ system, score: scoreOf(system, weights), tie: tieBreak(seed, system.id) }))
    .sort((first, second) => second.score - first.score || first.tie - second.tie)
    .map(({ system }) => system);
  const picked = [];
  const unlike = (system, strict) =>
    picked.every((other) => other.display.family !== system.display.family && (!strict || other.class !== system.class));
  while (picked.length < count) {
    const next = ranked.find((system) => !picked.includes(system) && unlike(system, true)) ?? ranked.find((system) => !picked.includes(system) && unlike(system, false));
    if (!next) break;
    picked.push(next);
  }
  return picked.map((system) => dealtSystem(system, weights));
}
