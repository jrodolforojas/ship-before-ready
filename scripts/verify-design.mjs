#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXIT_CODES = { ok: 0, requirementFailed: 1, usage: 2, noChrome: 3 };
export const CONTRACT_PATH = fileURLToPath(new URL('../templates/contract.json', import.meta.url));

export const TOOLS = {
  design: 'verify-design.mjs',
  landing: 'verify-landing.mjs',
  capture: 'capture.mjs --measure',
  reviewer: 'the design-reviewer agent',
};

export const CHECKED_BY = {
  R1: ['landing'],
  R2: ['design', 'landing'],
  R3: ['capture'],
  R4: ['design', 'landing'],
  R5: ['design', 'landing'],
  R6: ['reviewer'],
  R7: ['reviewer'],
  R8: ['design', 'landing'],
  R9: ['design', 'landing'],
  R10: ['design', 'landing'],
  R11: ['design', 'landing'],
  R12: ['design', 'landing'],
  R13: ['capture'],
  R14: ['design', 'landing'],
  R15: ['design', 'landing'],
  R16: ['landing'],
  R17: ['design', 'landing'],
  R18: ['capture'],
  R19: ['capture'],
  R20: ['landing', 'capture'],
  R21: ['landing', 'capture'],
  R22: ['capture'],
  R23: ['design', 'landing'],
  R24: ['landing', 'capture'],
  R25: ['landing', 'capture'],
  R26: ['design', 'landing'],
  R27: ['design', 'landing', 'reviewer'],
  R28: ['landing'],
  R29: ['landing'],
  R30: ['design', 'landing'],
  R31: ['reviewer'],
  R32: ['design', 'landing'],
};

export const BANNED_PHRASES = [
  'bienvenido a',
  'bienvenida a',
  'bienvenidos a',
  'descubre el poder',
  'desata el poder',
  'libera el poder',
  'desbloquea el poder',
  'desbloquea tu potencial',
  'libera tu potencial',
  'todo en uno',
  'solucion integral',
  'al siguiente nivel',
  'revoluciona',
  'revolucionamos',
  'revolucionario',
  'revolucionaria',
  'innovador',
  'innovadora',
  'disruptivo',
  'disruptiva',
  'de vanguardia',
  'de ultima generacion',
  'de clase mundial',
  'sin esfuerzo',
  'sin friccion',
  'sin fricciones',
  'sin complicaciones',
  'en el mundo actual',
  'en el mundo de hoy',
  'en la era digital',
  'el futuro de',
  'el futuro es hoy',
  'el futuro ya esta aqui',
  'di adios a',
  'dile adios a',
  'unete a miles',
  'miles de usuarios',
  'miles de clientes',
  'miles de empresas',
  'no busques mas',
  'imagina un mundo',
  'en solo unos clics',
  'en pocos clics',
  'al alcance de tu mano',
  'al alcance de un clic',
  'cambia las reglas del juego',
  'un antes y un despues',
  'sinergia',
  'empodera',
  'empoderamos',
  'lider del mercado',
  'numero uno en',
  'la mejor solucion',
  'el mejor del mercado',
  'optimiza tu flujo de trabajo',
  'agiliza tu flujo de trabajo',
  'welcome to',
  'unlock the power',
  'unleash the power',
  'unlock your potential',
  'all-in-one',
  'all in one',
  'one-stop shop',
  'next level',
  'next-level',
  'next-gen',
  'next generation',
  'cutting-edge',
  'cutting edge',
  'state-of-the-art',
  'state of the art',
  'world-class',
  'world class',
  'best-in-class',
  'best in class',
  'game-changer',
  'game changer',
  'game-changing',
  'revolutionize',
  'revolutionary',
  'seamless',
  'seamlessly',
  'effortless',
  'effortlessly',
  'supercharge',
  'streamline your',
  'elevate your',
  'empower',
  'empowers',
  'the future of',
  'say goodbye to',
  'join thousands',
  'trusted by',
  'imagine a world',
  'look no further',
  'at your fingertips',
  'in just a few clicks',
  "in today's fast-paced world",
  'ready to transform',
  'synergy',
];

export const GENERIC_BUTTON_LABELS = [
  'empezar',
  'comenzar',
  'empieza ahora',
  'comienza ahora',
  'saber mas',
  'mas informacion',
  'leer mas',
  'continuar',
  'siguiente',
  'enviar',
  'aceptar',
  'ok',
  'clic aqui',
  'haz clic aqui',
  'get started',
  'start now',
  'learn more',
  'read more',
  'continue',
  'next',
  'submit',
  'send',
  'click here',
];

export const PRICE_WORDS = [
  'precio',
  'precios',
  'gratis',
  'gratuito',
  'gratuita',
  'gratuitos',
  'gratuitas',
  'descuento',
  'descuentos',
  'tarifa',
  'tarifas',
  'suscripcion',
  'suscripciones',
  'mensualidad',
  'mensualidades',
  'sin costo',
  'costo cero',
  'reembolso',
  'reembolsos',
  'plan basico',
  'plan pro',
  'plan premium',
  'plan mensual',
  'plan anual',
  'planes y precios',
  'oferta de lanzamiento',
  'oferta especial',
  'price',
  'prices',
  'pricing',
  'discount',
  'discounts',
  'for free',
  'free trial',
  'free plan',
  'free forever',
  'subscription',
  'subscriptions',
  'refund',
  'refunds',
  'money-back',
  'money back',
];

const AMOUNT_PATTERNS = [
  /\d[\d.,]*\s?(?:usd|eur|crc|mxn|clp|brl|gbp|dolares|dolar|euros|euro|colones|pesos|dollars|dollar|bucks)(?![\p{L}\p{N}])/u,
  /(?<![\p{L}\p{N}])(?:usd|eur|crc|mxn|clp|brl|gbp)\s?\d/u,
  /\d\s?\/\s?(?:mes|mo|month|ano|year|yr)(?![\p{L}\p{N}])/u,
];
const CURRENCY_SYMBOL = /\p{Sc}/u;
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️|⃣/u;
const HTML_TAG = /<\/?[a-zA-Z][^<>]*>/;
const MARKDOWN = /\*\*|__|`[^`]+`|\]\(|^#{1,6}\s|^[-*+]\s|^>\s/;

const VIEWPORT_SIZE_KEYS = ['size', 'size_desktop'];
const VIEWPORT_LABELS = { size: 'phone', size_desktop: 'desktop' };
const TOKEN_ROWS = ['R4', 'R5', 'R8', 'R9', 'R10', 'R11', 'R12', 'R15', 'R17', 'R23', 'R26'];
const COPY_ROWS = ['R2', 'R15', 'R26', 'R27', 'R30'];
const LENGTH_ROWS = {
  R2: 'every text is within its length limit',
  R26: 'email.privacy is present and within its limit',
  R30: 'meta.title and meta.description are within their limits',
};

export class UsageError extends Error {}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
const codePointCount = (text) => [...text].length;
const tokenKey = (cssName) => cssName.replaceAll('-', '_');
const joinPath = (path, key) => (path ? `${path}.${key}` : key);
const problemIf = (condition, message) => (condition ? [message] : []);
const valueAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function readJson(path, label) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new UsageError(`${label}: cannot read ${path}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new UsageError(`${label}: ${path} is not valid JSON (${error.message})`);
  }
}

export function loadContract(path = CONTRACT_PATH) {
  return readJson(path, 'contract');
}

export function localeOfFile(path, contract) {
  const name = basename(path, '.json').replace(/^copy\./, '');
  return new RegExp(contract.copy.locale_pattern).test(name) ? name : null;
}

export function createReport(contract, tool) {
  const notes = new Map(contract.requirement_ids.map((id) => [id, { fail: [], skip: [], pass: [] }]));
  const add = (status) => (id, detail) => notes.get(id)[status].push(detail);
  return {
    pass: add('pass'),
    fail: add('fail'),
    skip: add('skip'),
    rows: () => contract.requirement_ids.map((id) => rowOf(id, notes.get(id), tool)),
  };
}

function rowOf(id, note, tool) {
  if (note.fail.length) return { id, status: 'fail', detail: note.fail.join('; ') };
  if (note.skip.length) return { id, status: 'skip', detail: note.skip.join('; ') };
  if (note.pass.length) return { id, status: 'pass', detail: note.pass.join('; ') };
  return { id, status: 'skip', detail: outOfScopeDetail(id, tool) };
}

function outOfScopeDetail(id, tool) {
  const others = CHECKED_BY[id].filter((name) => name !== tool).map((name) => TOOLS[name]);
  return `checked by ${others.join(' and ')}`;
}

export function record(report, id, problems, passDetail) {
  if (problems.length === 0) return report.pass(id, passDetail);
  problems.forEach((problem) => report.fail(id, problem));
}

export function formatRows(rows) {
  return rows.map((row) => [row.id, row.status, row.detail.replace(/\s+/g, ' ')].join('\t')).join('\n');
}

export function exitCodeOf(rows) {
  return rows.some((row) => row.status === 'fail') ? EXIT_CODES.requirementFailed : EXIT_CODES.ok;
}

export function printReport(report) {
  const rows = report.rows();
  console.log(formatRows(rows));
  return exitCodeOf(rows);
}

export function isMainModule(moduleUrl) {
  if (!process.argv[1]) return false;
  return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl));
}

export async function runCli(main, exitCodeOfError = () => null) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    const knownCode = error instanceof UsageError ? EXIT_CODES.usage : exitCodeOfError(error);
    if (knownCode === null) throw error;
    console.error(error.message);
    process.exitCode = knownCode;
  }
}

export function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function phrasesIn(text, phrases) {
  const normalized = normalizeText(text);
  return phrases.filter((phrase) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, 'u').test(normalized),
  );
}

export function parseHex(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

export function relativeLuminance(channels) {
  const [red, green, blue] = channels.map((channel) => {
    const unit = channel / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastOfLuminances(first, second) {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function contrastRatio(firstHex, secondHex) {
  return contrastOfLuminances(relativeLuminance(parseHex(firstHex)), relativeLuminance(parseHex(secondHex)));
}

export function formatRatio(ratio) {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

export function hslOf(hex) {
  const [red, green, blue] = parseHex(hex).map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const sector = hueSector(red, green, blue, max, delta);
  return { hue: (sector * 60 + 360) % 360, saturation, lightness };
}

function hueSector(red, green, blue, max, delta) {
  if (max === red) return ((green - blue) / delta) % 6;
  if (max === green) return (blue - red) / delta + 2;
  return (red - green) / delta + 4;
}

function keySetProblems(value, allowed, optional, path) {
  if (!isPlainObject(value)) return [`${path || 'the file'} must be an object`];
  const keys = Object.keys(value);
  const missing = allowed
    .filter((key) => !optional.includes(key) && !keys.includes(key))
    .map((key) => `${joinPath(path, key)} is missing`);
  const unknown = keys
    .filter((key) => !allowed.includes(key))
    .map((key) => `${joinPath(path, key)} is not a key of the contract`);
  return [...missing, ...unknown];
}

function numberGroupProblems(group, keys, path) {
  if (group === undefined) return [];
  const problems = keySetProblems(group, keys, [], path);
  if (!isPlainObject(group)) return problems;
  const notNumbers = keys
    .filter((key) => group[key] !== undefined && !isFiniteNumber(group[key]))
    .map((key) => `${path}.${key} must be a number`);
  return [...problems, ...notNumbers];
}

function nameProblems(name, max) {
  if (name === undefined) return [];
  if (!isNonEmptyString(name)) return ['name must be a non-empty string'];
  const length = codePointCount(name);
  return problemIf(length > max, `name has ${length} characters, the limit is ${max}`);
}

function enumProblems(tokens, enums) {
  return ['scheme', 'composition', 'decor', 'palette_source']
    .filter((key) => tokens[key] !== undefined && !enums[key].includes(tokens[key]))
    .map((key) => `${key} is ${JSON.stringify(tokens[key])}, must be one of ${enums[key].join(', ')}`);
}

function fontRoleShapeProblems(font, path, spec) {
  if (font === undefined) return [];
  const problems = keySetProblems(font, spec.fonts.keys, [], path);
  if (!isPlainObject(font)) return problems;
  const isWeightList = Array.isArray(font.weights) && font.weights.length > 0 && font.weights.every(isFiniteNumber);
  return [
    ...problems,
    ...problemIf(font.family !== undefined && !isNonEmptyString(font.family), `${path}.family must be a font family name`),
    ...problemIf(font.weights !== undefined && !isWeightList, `${path}.weights must be a non-empty list of numbers`),
    ...problemIf(
      font.fallback !== undefined && !spec.enums.font_fallback.includes(font.fallback),
      `${path}.fallback must be one of ${spec.enums.font_fallback.join(', ')}`,
    ),
  ];
}

function fontShapeProblems(fonts, spec) {
  if (fonts === undefined) return [];
  const problems = keySetProblems(fonts, spec.fonts.roles, [], 'fonts');
  if (!isPlainObject(fonts)) return problems;
  return [...problems, ...spec.fonts.roles.flatMap((role) => fontRoleShapeProblems(fonts[role], `fonts.${role}`, spec))];
}

function colorShapeProblems(color, spec) {
  if (color === undefined) return [];
  const keys = spec.colors.map((entry) => tokenKey(entry.token));
  const problems = keySetProblems(color, keys, [], 'color');
  if (!isPlainObject(color)) return problems;
  const pattern = new RegExp(spec.color_pattern);
  const malformed = keys
    .filter((key) => color[key] !== undefined && !(typeof color[key] === 'string' && pattern.test(color[key])))
    .map((key) => `color.${key} must be a six-digit hex color such as #1C1C1C`);
  return [...problems, ...malformed];
}

function textShapeProblems(text, spec) {
  if (text === undefined) return [];
  const styles = spec.text_styles.map((style) => style.name);
  const problems = keySetProblems(text, styles, [], 'text');
  if (!isPlainObject(text)) return problems;
  return [...problems, ...styles.flatMap((style) => numberGroupProblems(text[style], spec.text_style_keys, `text.${style}`))];
}

function shapeGroupProblems(shape, spec) {
  if (shape === undefined) return [];
  const rangeKeys = Object.keys(spec.ranges);
  const problems = keySetProblems(shape, [...rangeKeys, 'shadow_card'], [], 'shape');
  if (!isPlainObject(shape)) return problems;
  const notNumbers = rangeKeys
    .filter((key) => shape[key] !== undefined && !isFiniteNumber(shape[key]))
    .map((key) => `shape.${key} must be a number`);
  return [...problems, ...notNumbers, ...numberGroupProblems(shape.shadow_card, spec.shadow_card.keys, 'shape.shadow_card')];
}

export function tokenShapeProblems(tokens, spec) {
  const problems = keySetProblems(tokens, spec.keys, spec.optional_keys, '');
  if (!isPlainObject(tokens)) return problems;
  return [
    ...problems,
    ...nameProblems(tokens.name, spec.name_max),
    ...enumProblems(tokens, spec.enums),
    ...fontShapeProblems(tokens.fonts, spec),
    ...colorShapeProblems(tokens.color, spec),
    ...textShapeProblems(tokens.text, spec),
    ...numberGroupProblems(tokens.spacing, spec.spacing.order, 'spacing'),
    ...shapeGroupProblems(tokens.shape, spec.shape),
    ...numberGroupProblems(tokens.measure, Object.keys(spec.measure.ranges), 'measure'),
  ];
}

function plainTextProblems(key, text) {
  if (typeof text !== 'string') return [`${key} must be a string`];
  if (text.trim() === '') return [`${key} is empty`];
  return [
    ...problemIf(text !== text.trim(), `${key} has leading or trailing spaces`),
    ...problemIf(/[\r\n\t]/.test(text), `${key} has a line break or a tab`),
    ...problemIf(HTML_TAG.test(text), `${key} contains HTML`),
    ...problemIf(MARKDOWN.test(text), `${key} contains Markdown`),
  ];
}

function copyLeafProblems(entry, value, locale, localePattern) {
  if (entry.type === 'list') {
    if (!Array.isArray(value)) return [`${entry.key} must be a list`];
    return value.flatMap((item, index) => plainTextProblems(`${entry.key}[${index}]`, item));
  }
  const problems = plainTextProblems(entry.key, value);
  if (problems.length) return problems;
  const missingPlaceholders = (entry.placeholders ?? [])
    .filter((placeholder) => !value.includes(placeholder))
    .map((placeholder) => `${entry.key} must contain ${placeholder}`);
  if (entry.equals !== 'locale') return missingPlaceholders;
  return [
    ...problemIf(!localePattern.test(value), `lang is "${value}", not a locale such as es or pt-BR`),
    ...problemIf(locale !== null && value !== locale, `lang is "${value}" but the file is for "${locale}"`),
  ];
}

function copyNodeProblems(node, path, leaves, branches, locale, localePattern) {
  return Object.keys(node).flatMap((key) => {
    const childPath = joinPath(path, key);
    if (leaves.has(childPath)) return copyLeafProblems(leaves.get(childPath), node[key], locale, localePattern);
    if (!branches.has(childPath)) return [`${childPath} is not a key of the contract`];
    if (!isPlainObject(node[key])) return [`${childPath} must be an object`];
    return copyNodeProblems(node[key], childPath, leaves, branches, locale, localePattern);
  });
}

export function copyShapeProblems(copy, spec, locale) {
  if (!isPlainObject(copy)) return ['the language file must be a JSON object'];
  const leaves = new Map(spec.keys.map((entry) => [entry.key, entry]));
  const branches = new Set(spec.keys.map((entry) => entry.key.split('.').slice(0, -1).join('.')).filter(Boolean));
  const missing = spec.keys.filter((entry) => valueAt(copy, entry.key) === undefined).map((entry) => `${entry.key} is missing`);
  return [...missing, ...copyNodeProblems(copy, '', leaves, branches, locale, new RegExp(spec.locale_pattern))];
}

function rangeProblems(value, [min, max], path) {
  return problemIf(value < min || value > max, `${path} is ${value}, outside ${min} to ${max}`);
}

function styleRangeProblems(text, styles, keys) {
  return styles.flatMap((style) =>
    keys.flatMap((key) => rangeProblems(text[style.name][key], style.ranges[key], `text.${style.name}.${key}`)),
  );
}

function scaleStep(size, body, ratio) {
  return Math.max(1, Math.round(Math.log(size / body) / Math.log(ratio)));
}

function fitsScale(size, body, ratio, tolerance) {
  const target = body * ratio ** scaleStep(size, body, ratio);
  return Math.abs(size - target) / target <= tolerance + 1e-9;
}

function nearestSteps(size, body, ratio) {
  const lowerStep = Math.max(1, Math.floor(Math.log(size / body) / Math.log(ratio)));
  return [lowerStep, lowerStep + 1].map((step) => Math.round(body * ratio ** step * 10) / 10);
}

function ratioProblems(text, sizeKey, scale) {
  const body = text.body[sizeKey];
  const larger = Object.keys(text).filter((style) => text[style][sizeKey] > body);
  const candidates = scale.ratios.map((ratio) => ({
    ratio,
    misfits: larger.filter((style) => !fitsScale(text[style][sizeKey], body, ratio, scale.tolerance)),
  }));
  if (candidates.some((candidate) => candidate.misfits.length === 0)) return [];
  const closest = candidates.reduce((best, candidate) => (candidate.misfits.length < best.misfits.length ? candidate : best));
  return closest.misfits.map((style) => {
    const [lower, upper] = nearestSteps(text[style][sizeKey], body, closest.ratio);
    return `${VIEWPORT_LABELS[sizeKey]}: text.${style}.${sizeKey} ${text[style][sizeKey]} is not on the ${closest.ratio} scale of body ${body} within ${scale.tolerance * 100}% (nearest steps ${lower} and ${upper})`;
  });
}

function titleToBodyProblems(text, sizeKey, scale) {
  const ratio = text.title[sizeKey] / text.body[sizeKey];
  const min = scale.title_to_body_min[sizeKey];
  return problemIf(
    ratio < min,
    `${VIEWPORT_LABELS[sizeKey]}: title ${text.title[sizeKey]} is ${formatRatio(ratio)} times body ${text.body[sizeKey]}, needs ${min}`,
  );
}

function scaleProblems(text, spec) {
  const shrinking = Object.keys(text)
    .filter((style) => text[style].size_desktop < text[style].size)
    .map((style) => `text.${style}.size_desktop ${text[style].size_desktop} is smaller than its size ${text[style].size}`);
  return [
    ...VIEWPORT_SIZE_KEYS.flatMap((sizeKey) => ratioProblems(text, sizeKey, spec.scale)),
    ...VIEWPORT_SIZE_KEYS.flatMap((sizeKey) => titleToBodyProblems(text, sizeKey, spec.scale)),
    ...shrinking,
  ];
}

function sizeOrderProblems(text, sizeKey) {
  const at = (style) => text[style][sizeKey];
  const notBelowTitle = Object.keys(text)
    .filter((style) => style !== 'title' && at(style) >= at('title'))
    .map((style) => `text.title.${sizeKey} ${at('title')} must be larger than text.${style}.${sizeKey} ${at(style)}`);
  return [
    ...notBelowTitle,
    ...problemIf(at('label') >= at('body'), `text.label.${sizeKey} ${at('label')} must be smaller than text.body.${sizeKey} ${at('body')}`),
    ...problemIf(at('small') >= at('body'), `text.small.${sizeKey} ${at('small')} must be smaller than text.body.${sizeKey} ${at('body')}`),
    ...problemIf(at('lead') < at('body'), `text.lead.${sizeKey} ${at('lead')} must be at least text.body.${sizeKey} ${at('body')}`),
  ];
}

function emphasisProblems(text, spec) {
  const heavierThanTitle = Object.keys(text)
    .filter((style) => text[style].font_weight > text.title.font_weight)
    .map((style) => `text.${style}.font_weight ${text[style].font_weight} is heavier than the title's ${text.title.font_weight}`);
  const offStep = spec.text_styles
    .filter((style) => text[style.name].font_weight % spec.fonts.weight_step !== 0)
    .map((style) => `text.${style.name}.font_weight ${text[style.name].font_weight} is not a multiple of ${spec.fonts.weight_step}`);
  return [
    ...VIEWPORT_SIZE_KEYS.flatMap((sizeKey) => sizeOrderProblems(text, sizeKey)),
    ...heavierThanTitle,
    ...styleRangeProblems(text, spec.text_styles, ['font_weight']),
    ...offStep,
  ];
}

function weightListProblems(weights, path, rules) {
  const invalid = weights
    .filter((weight) => weight % rules.weight_step !== 0 || weight < rules.weight_min || weight > rules.weight_max)
    .map((weight) => `${path} lists ${weight}, not a multiple of ${rules.weight_step} from ${rules.weight_min} to ${rules.weight_max}`);
  const isAscending = weights.every((weight, index) => index === 0 || weight > weights[index - 1]);
  return [...invalid, ...problemIf(!isAscending, `${path} must be in ascending order without repeats`)];
}

function fontProblems(tokens, spec) {
  const { fonts, text } = tokens;
  const rules = spec.fonts;
  const families = new Set(rules.roles.map((role) => fonts[role].family));
  const pairs = new Set(rules.roles.flatMap((role) => fonts[role].weights.map((weight) => `${fonts[role].family} ${weight}`)));
  const unlisted = spec.text_styles
    .filter((style) => !fonts[style.family].weights.includes(text[style.name].font_weight))
    .map((style) => `text.${style.name}.font_weight ${text[style.name].font_weight} is not listed in fonts.${style.family}.weights`);
  const unused = rules.roles.flatMap((role) =>
    fonts[role].weights
      .filter((weight) => !spec.text_styles.some((style) => style.family === role && text[style.name].font_weight === weight))
      .map((weight) => `fonts.${role}.weights lists ${weight}, which no ${role} text style uses`),
  );
  return [
    ...rules.roles.flatMap((role) => weightListProblems(fonts[role].weights, `fonts.${role}.weights`, rules)),
    ...problemIf(families.size > rules.families_max, `fonts use ${families.size} families, the limit is ${rules.families_max}`),
    ...problemIf(
      pairs.size > rules.family_weight_pairs_max,
      `fonts list ${pairs.size} (family, weight) pairs, the limit is ${rules.family_weight_pairs_max}`,
    ),
    ...unlisted,
    ...unused,
  ];
}

function colorProblems(tokens, spec) {
  const { color, scheme } = tokens;
  const lowContrast = spec.color_pairs.flatMap((pair) => {
    const foreground = color[tokenKey(pair.foreground)];
    const background = color[tokenKey(pair.background)];
    const ratio = contrastRatio(foreground, background);
    return problemIf(
      ratio < pair.min,
      `${pair.foreground} ${foreground} on ${pair.background} ${background} is ${formatRatio(ratio)}:1, needs ${pair.min}:1`,
    );
  });
  const canvas = relativeLuminance(parseHex(color.canvas));
  const ink = relativeLuminance(parseHex(color.ink));
  return [
    ...lowContrast,
    ...problemIf(color.ink.toUpperCase() === spec.color_rules.ink_forbidden.toUpperCase(), 'color.ink is pure black'),
    ...problemIf(scheme === 'light' && canvas <= ink, 'scheme is light but canvas is not lighter than ink'),
    ...problemIf(scheme === 'dark' && canvas >= ink, 'scheme is dark but canvas is not darker than ink'),
  ];
}

function decorationProblems(tokens, spec) {
  const { shape, color } = tokens;
  const shadow = spec.shape.shadow_card;
  const violet = spec.color_rules.violet;
  const accent = hslOf(color.accent);
  const isViolet = accent.hue >= violet.hue_min && accent.hue <= violet.hue_max && accent.saturation >= violet.saturation_min;
  return [
    ...problemIf(
      isViolet && tokens.palette_source !== 'builder',
      `color.accent ${color.accent} is violet (hue ${Math.round(accent.hue)}); allowed only with palette_source: builder`,
    ),
    ...Object.entries(spec.shape.ranges).flatMap(([key, range]) => rangeProblems(shape[key], range, `shape.${key}`)),
    ...Object.entries(shadow.ranges).flatMap(([key, range]) => rangeProblems(shape.shadow_card[key], range, `shape.shadow_card.${key}`)),
    ...problemIf(
      shape.shadow_card.blur > 0 && shape.shadow_card.opacity > shadow.opacity_max_when_blurred,
      `shape.shadow_card.opacity is ${shape.shadow_card.opacity}; with blur above 0 the limit is ${shadow.opacity_max_when_blurred}`,
    ),
  ];
}

function spacingProblems(spacing, spec) {
  const offGrid = spec.order
    .filter((key) => spacing[key] % spec.multiple_of !== 0)
    .map((key) => `spacing.${key} ${spacing[key]} is not a multiple of ${spec.multiple_of}`);
  const outOfOrder = spec.order
    .slice(1)
    .filter((key, index) => spacing[key] >= spacing[spec.order[index]])
    .map((key) => `spacing.${key} ${spacing[key]} must be smaller than spacing.${spec.order[spec.order.indexOf(key) - 1]}`);
  return [
    ...spec.order.flatMap((key) => rangeProblems(spacing[key], spec.ranges[key], `spacing.${key}`)),
    ...offGrid,
    ...outOfOrder,
  ];
}

function readingProblems(tokens, spec) {
  return [
    ...rangeProblems(tokens.measure.prose, spec.measure.ranges.prose, 'measure.prose'),
    ...rangeProblems(tokens.measure.page, spec.measure.ranges.page, 'measure.page'),
    ...styleRangeProblems(tokens.text, spec.text_styles, ['letter_spacing']),
  ];
}

function privacySizeProblems(text, spec) {
  const min = spec.text_styles.find((style) => style.name === 'small').ranges.size[0];
  return VIEWPORT_SIZE_KEYS.filter((sizeKey) => text.small[sizeKey] < min).map(
    (sizeKey) => `the privacy line is drawn in small: text.small.${sizeKey} ${text.small[sizeKey]} is under ${min}`,
  );
}

function checkTokenValues(tokens, spec, report) {
  record(report, 'R4', scaleProblems(tokens.text, spec), 'sizes follow one ratio per viewport and the title leads the body');
  record(report, 'R5', emphasisProblems(tokens.text, spec), 'the title is the largest and heaviest; labels and small text sit under the body');
  record(report, 'R8', styleRangeProblems(tokens.text, spec.text_styles, VIEWPORT_SIZE_KEYS), 'every size is inside its range');
  record(report, 'R9', styleRangeProblems(tokens.text, spec.text_styles, ['line_height']), 'every line height is inside its range');
  record(report, 'R10', readingProblems(tokens, spec), 'measures and tracking are inside their ranges');
  record(report, 'R11', fontProblems(tokens, spec), 'fonts stay within two families and four weights, all of them used');
  record(report, 'R12', colorProblems(tokens, spec), `${spec.color_pairs.length} color pairs meet their minimum; ink is not pure black`);
  record(report, 'R15', decorationProblems(tokens, spec), 'the accent is not violet and shape values are inside their ranges');
  record(report, 'R17', spacingProblems(tokens.spacing, spec.spacing), 'four spacing levels, multiples of 4, strictly decreasing');
  record(
    report,
    'R23',
    rangeProblems(tokens.measure.motion_duration, spec.measure.ranges.motion_duration, 'measure.motion_duration'),
    'motion duration is inside its range',
  );
  record(report, 'R26', privacySizeProblems(tokens.text, spec), 'the privacy line is drawn at a legible size');
}

function copyEntries(copy, keys) {
  return keys
    .filter((entry) => entry.equals !== 'locale')
    .flatMap((entry) => {
      const value = valueAt(copy, entry.key);
      if (entry.type !== 'list') return [{ key: entry.key, text: value }];
      return value.map((text, index) => ({ key: `${entry.key}[${index}]`, text }));
    });
}

function textLengthProblems(key, text, entry) {
  const length = codePointCount(text);
  return [
    ...problemIf(entry.max !== undefined && length > entry.max, `${key} has ${length} characters, the limit is ${entry.max}`),
    ...problemIf(entry.min !== undefined && length < entry.min, `${key} has ${length} characters, needs at least ${entry.min}`),
  ];
}

function lengthProblems(entry, value) {
  if (entry.type !== 'list') return textLengthProblems(entry.key, value, entry);
  const isCountAllowed = value.length >= entry.items_min && value.length <= entry.items_max;
  const allowed = entry.items_min === entry.items_max ? `exactly ${entry.items_min}` : `${entry.items_min} to ${entry.items_max}`;
  return [
    ...problemIf(!isCountAllowed, `${entry.key} has ${value.length} items, needs ${allowed}`),
    ...value.flatMap((item, index) => textLengthProblems(`${entry.key}[${index}]`, item, entry)),
  ];
}

function clicheProblems(entries, buttonKeys) {
  return entries.flatMap(({ key, text }) => [
    ...problemIf(EMOJI.test(text), `${key} contains an emoji`),
    ...phrasesIn(text, BANNED_PHRASES).map((phrase) => `${key} contains the banned phrase "${phrase}"`),
    ...problemIf(
      buttonKeys.has(key) && GENERIC_BUTTON_LABELS.includes(normalizeText(text).replace(/[.!…]+$/u, '')),
      `${key} is a generic button label: name what the click gets`,
    ),
  ]);
}

function priceProblems(entries) {
  return entries.flatMap(({ key, text }) => {
    const normalized = normalizeText(text);
    return [
      ...problemIf(CURRENCY_SYMBOL.test(text), `${key} contains a currency symbol`),
      ...problemIf(AMOUNT_PATTERNS.some((pattern) => pattern.test(normalized)), `${key} contains an amount of money`),
      ...phrasesIn(text, PRICE_WORDS).map((word) => `${key} contains the price word "${word}"`),
    ];
  });
}

function checkCopyValues(copy, contract, report) {
  const { keys } = contract.copy;
  const entries = copyEntries(copy, keys);
  const buttonKeys = new Set(contract.hooks.filter((hook) => hook.element === 'button').map((hook) => hook.text));
  Object.entries(LENGTH_ROWS).forEach(([id, passDetail]) => {
    const problems = keys
      .filter((entry) => (entry.requirement ?? 'R2') === id)
      .flatMap((entry) => lengthProblems(entry, valueAt(copy, entry.key)));
    record(report, id, problems, passDetail);
  });
  record(report, 'R15', clicheProblems(entries, buttonKeys), 'copy has no emoji, banned phrase or generic button label');
  record(report, 'R27', priceProblems(entries), 'copy has no currency symbol, amount or price word');
}

export function checkDesign({ tokens, copy, locale, contract, report }) {
  const tokenShape = tokenShapeProblems(tokens, contract.tokens);
  const copyShape = copyShapeProblems(copy, contract.copy, locale);
  record(report, 'R14', tokenShape, 'tokens.json has the closed key set, types and formats of the contract');
  record(report, 'R32', copyShape, `the language file has the ${contract.copy.keys.length} keys of the contract as plain text`);
  if (tokenShape.length) TOKEN_ROWS.forEach((id) => report.skip(id, 'tokens.json does not have the shape of the contract: see R14'));
  if (copyShape.length) COPY_ROWS.forEach((id) => report.skip(id, 'the language file does not have the shape of the contract: see R32'));
  if (tokenShape.length === 0) checkTokenValues(tokens, contract.tokens, report);
  if (copyShape.length === 0) checkCopyValues(copy, contract, report);
}

function main(args) {
  if (args.length !== 2) throw new UsageError('usage: verify-design.mjs <tokens.json> <copy.json>');
  const [tokensPath, copyPath] = args;
  const contract = loadContract();
  const report = createReport(contract, 'design');
  checkDesign({
    tokens: readJson(tokensPath, 'tokens'),
    copy: readJson(copyPath, 'copy'),
    locale: localeOfFile(copyPath, contract),
    contract,
    report,
  });
  return printReport(report);
}

if (isMainModule(import.meta.url)) runCli(main);
