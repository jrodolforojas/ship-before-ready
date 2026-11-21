#!/usr/bin/env node
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameSize } from '../templates/canvas/frames.mjs';

const USAGE = 'Usage: fill-artboards.mjs <tokens.json> <copy.json> <output>';
const PLUGIN_ROOT = new URL('../', import.meta.url);
const TEMPLATES = new URL('templates/canvas/', PLUGIN_ROOT);
const CONTRACT = JSON.parse(readFileSync(new URL('templates/contract.json', PLUGIN_ROOT), 'utf8'));

const SCREEN_GAP = 80;
const GROUP_GAP = 240;
const TITLE_NOTE_RISE = 300;
const PROGRESS_TOTAL = 2;

export class UsageError extends Error {}

const readTemplate = (name) => readFileSync(new URL(name, TEMPLATES), 'utf8');

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new UsageError(`Cannot read ${path}: ${error.message}`);
  }
};

const valueAt = (source, path) => path.split('.').reduce((node, key) => node?.[key], source);

const tokenPaths = () => {
  const { colors, fonts, text_styles: styles, text_style_keys: styleKeys, spacing, shape, measure } = CONTRACT.tokens;
  return [
    'name',
    ...colors.map(({ token }) => `color.${token.replaceAll('-', '_')}`),
    ...fonts.roles.flatMap((role) => fonts.keys.map((key) => `fonts.${role}.${key}`)),
    ...styles.flatMap(({ name }) => styleKeys.map((key) => `text.${name}.${key}`)),
    ...spacing.order.map((name) => `spacing.${name}`),
    ...Object.keys(shape.ranges).map((name) => `shape.${name}`),
    ...shape.shadow_card.keys.map((key) => `shape.shadow_card.${key}`),
    ...Object.keys(measure.ranges).map((name) => `measure.${name}`),
  ];
};

const validateTokens = (tokens) => {
  const missing = tokenPaths().filter((path) => valueAt(tokens, path) === undefined);
  if (missing.length) throw new UsageError(`tokens.json lacks: ${missing.join(', ')}`);
  for (const key of ['scheme', 'composition', 'decor']) {
    const allowed = CONTRACT.tokens.enums[key];
    if (!allowed.includes(tokens[key])) throw new UsageError(`tokens.json: ${key} must be one of ${allowed.join(', ')}`);
  }
};

const validateCopy = (copy) => {
  for (const { key, type, items_min: min, items_max: max } of CONTRACT.copy.keys) {
    const value = valueAt(copy, key);
    if (type === 'string' && typeof value !== 'string') throw new UsageError(`copy.json lacks the text "${key}"`);
    if (type !== 'list') continue;
    const valid = Array.isArray(value) && value.length >= min && value.length <= max && value.every((item) => typeof item === 'string');
    if (!valid) throw new UsageError(`copy.json: "${key}" must be a list of ${min} to ${max} texts`);
  }
};

const plain = (value) => String(Number(value.toFixed(4)));
const rem = (px) => `${plain(px / 16)}rem`;
const mapValues = (source, convert) => Object.fromEntries(Object.entries(source).map(([key, value]) => [key, convert(value)]));

const fontsHref = (fonts) => {
  const weightsByFamily = new Map();
  for (const { family, weights } of Object.values(fonts)) {
    weightsByFamily.set(family, [...new Set([...(weightsByFamily.get(family) ?? []), ...weights])].sort((a, b) => a - b));
  }
  const families = [...weightsByFamily].map(([family, weights]) => `family=${family.replaceAll(' ', '+')}:wght@${weights.join(';')}`);
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
};

const cssTokens = (tokens, viewport) => {
  const sizeKey = viewport === 'desktop' ? 'size_desktop' : 'size';
  const shadow = tokens.shape.shadow_card;
  return {
    color: tokens.color,
    fonts: { ...mapValues(tokens.fonts, ({ family, fallback }) => `"${family}", ${fallback}`), href: fontsHref(tokens.fonts) },
    text: mapValues(tokens.text, (style) => ({
      size: rem(style[sizeKey]),
      line_height: plain(style.line_height),
      font_weight: style.font_weight,
      letter_spacing: `${plain(style.letter_spacing)}em`,
    })),
    spacing: mapValues(tokens.spacing, rem),
    shape: {
      radius_control: rem(tokens.shape.radius_control),
      radius_card: rem(tokens.shape.radius_card),
      shadow_card: `${shadow.x}px ${shadow.y}px ${shadow.blur}px rgb(0 0 0 / ${plain(shadow.opacity)})`,
      line_width: `${tokens.shape.line_width}px`,
    },
    measure: {
      prose: `${tokens.measure.prose}ch`,
      page: rem(tokens.measure.page),
      motion_duration: `${tokens.measure.motion_duration}ms`,
    },
  };
};

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value) => value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);

const escapeTexts = (value) => {
  if (typeof value === 'string') return escapeHtml(value);
  if (Array.isArray(value)) return value.map(escapeTexts);
  return mapValues(value, escapeTexts);
};

const progressText = (copy, current) => escapeHtml(copy.progress.replace('{current}', current).replace('{total}', PROGRESS_TOTAL));

const scopeFor = (tokens, copy, viewport, frame) => ({
  ...cssTokens(tokens, viewport),
  lang: copy.lang,
  name: escapeHtml(tokens.name),
  scheme: tokens.scheme,
  composition: tokens.composition,
  decor: tokens.decor,
  figure: { none: tokens.decor === 'none', shapes: tokens.decor === 'shapes', grid: tokens.decor === 'grid' },
  frame,
  copy: escapeTexts(copy),
  pains: { count: copy.pains.length },
  progress: { email: progressText(copy, 1), questions: progressText(copy, 2) },
});

// Template language: [[path]] prints a value; [[#each list]], [[#if flag]] and [[#unless flag]]
// open a block closed by [[/each]], [[/if]] or [[/unless]]; [[> file rest]] inlines a partial and
// hands it "rest" as [[slot]]. A block or partial tag alone on its line leaves no blank line.
const expandPartials = (source) =>
  source.replace(/^\[\[> (\S+)(?: (.*))?\]\]\n/gm, (_, name, slot = '') => readTemplate(`partials/${name}`).replaceAll('[[slot]]', slot));

const dropTagOnlyLines = (source) => source.replace(/^(\[\[[#/][^\]]*\]\])\n/gm, '$1');

const parse = (source) => {
  const root = { children: [] };
  const open = [root];
  let cursor = 0;
  for (const match of source.matchAll(/\[\[(.+?)\]\]/g)) {
    const parent = open.at(-1);
    const tag = match[1];
    parent.children.push({ text: source.slice(cursor, match.index) });
    cursor = match.index + match[0].length;
    if (tag.startsWith('#')) {
      const [kind, path] = tag.slice(1).split(' ');
      const block = { kind, path, children: [] };
      parent.children.push(block);
      open.push(block);
      continue;
    }
    if (tag.startsWith('/')) {
      if (open.length === 1 || parent.kind !== tag.slice(1)) throw new Error(`Template closes [[${tag}]] without opening it`);
      open.pop();
      continue;
    }
    parent.children.push({ path: tag });
  }
  if (open.length > 1) throw new Error(`Template leaves [[#${open.at(-1).kind}]] open`);
  root.children.push({ text: source.slice(cursor) });
  return root.children;
};

const lookup = (scope, path) => {
  const value = valueAt(scope, path);
  if (value === undefined) throw new Error(`Template asks for [[${path}]], which has no value`);
  return value;
};

const itemScope = (scope, item, position) => ({ ...scope, this: item, index: position + 1, index2: String(position + 1).padStart(2, '0'), first: position === 0 });

const BLOCKS = {
  if: (node, scope) => (lookup(scope, node.path) ? render(node.children, scope) : ''),
  unless: (node, scope) => (lookup(scope, node.path) ? '' : render(node.children, scope)),
  each: (node, scope) => lookup(scope, node.path).map((item, position) => render(node.children, itemScope(scope, item, position))).join(''),
};

const renderNode = (node, scope) => {
  if (node.text !== undefined) return node.text;
  if (node.kind) return BLOCKS[node.kind](node, scope);
  return String(lookup(scope, node.path));
};

function render(nodes, scope) {
  return nodes.map((node) => renderNode(node, scope)).join('');
}

const fillTemplate = (template, scope) => render(parse(dropTagOnlyLines(expandPartials(readTemplate(`${template}.dc.html`)))), scope);

const boardPlan = (tokens, copy) => [
  { group: 'promise', template: `${tokens.composition}-phone`, file: 'Main.dc.html', label: tokens.name },
  { group: 'promise', template: `${tokens.composition}-desktop`, file: 'Promise-desktop.dc.html', label: tokens.name },
  { group: 'flow', template: 'email-phone', file: 'Email-phone.dc.html', label: `2 · ${copy.email.title}` },
  { group: 'flow', template: 'questions-phone', file: 'Questions-phone.dc.html', label: `3 · ${copy.questions.title}` },
  { group: 'flow', template: 'done-phone', file: 'Done-phone.dc.html', label: `4 · ${copy.done.title}` },
];

export const fillDirection = (tokens, copy) => {
  validateTokens(tokens);
  validateCopy(copy);
  return boardPlan(tokens, copy).map(({ group, template, file, label }) => {
    const frame = frameSize(template, tokens, copy);
    const viewport = template.endsWith('-desktop') ? 'desktop' : 'phone';
    const title = group === 'promise' ? `${label} · ${frame.width}` : label;
    return { group, file, title, ...frame, html: fillTemplate(template, scopeFor(tokens, copy, viewport, frame)) };
  });
};

export const placeInRow = (boards, origin = { x: 0, y: 0 }) => {
  let x = origin.x;
  return boards.map((board, position) => {
    const placed = { ...board, x, y: origin.y };
    const next = boards[position + 1];
    x += board.width + (next?.group === board.group ? SCREEN_GAP : GROUP_GAP);
    return placed;
  });
};

export const titleNote = (text, boards) => {
  const first = boards[0];
  const last = boards.at(-1);
  return { x: first.x, y: first.y - TITLE_NOTE_RISE, text, kind: 'title1', maxW: last.x + last.width - first.x };
};

export const canvasIndex = ({ title, boards, notes }) => ({
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString() },
  title,
  launch: { view: 'canvas' },
  pages: [],
  boards: Object.fromEntries(boards.map((board) => [board.file, { x: board.x, y: board.y, w: board.width, h: board.height, title: board.title }])),
  order: boards.map((board) => board.file),
  notes,
  designSystems: [],
});

export const writeCanvas = (output, index, boards) => {
  const project = join(output, 'project');
  mkdirSync(project, { recursive: true });
  for (const board of boards) writeFileSync(join(project, board.file), board.html);
  writeFileSync(join(project, 'canvas.json'), `${JSON.stringify(index, null, 2)}\n`);
  return ['project/canvas.json', ...boards.map((board) => `project/${board.file}`)];
};

const main = ([tokensPath, copyPath, output, ...extra]) => {
  if (!tokensPath || !copyPath || !output || extra.length) throw new UsageError(USAGE);
  const tokens = readJson(tokensPath);
  const copy = readJson(copyPath);
  const boards = placeInRow(fillDirection(tokens, copy));
  const promise = boards.filter((board) => board.group === 'promise');
  const index = canvasIndex({ title: `${copy.brand} · ${tokens.name}`, boards, notes: { 'title-promise': titleNote(tokens.name, promise) } });
  console.log(writeCanvas(output, index, boards).join('\n'));
};

const runAsScript = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (runAsScript) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof UsageError ? error.message : error.stack);
    process.exit(CONTRACT.exit_codes.usage_or_environment);
  }
}
