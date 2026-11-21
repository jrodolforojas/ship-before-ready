#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { canvasIndex, fillDirection, placeInRow, titleNote, UsageError as FillUsageError, writeCanvas } from '../../../scripts/fill-artboards.mjs';
import { checkDesign, createReport, EXIT_CODES, hslOf, isMainModule, loadContract, readJson, runCli, UsageError } from '../../../scripts/verify-design.mjs';

const EXIT_OK = 0;
const EXIT_CHECK_FAILED = 1;

const STATE = '.sbr';
const BRIEF = join(STATE, 'brief.md');
const DESIGN = join(STATE, 'design');
const SKETCHES = join(STATE, 'sketches');
const CHOICE = join(DESIGN, 'choice.md');
const APPROVED_TOKENS = join(DESIGN, 'tokens.json');
const SYSTEM = join(DESIGN, 'system.md');
const LETTERS = ['a', 'b', 'c'];
const DEFAULT_LOCALE = 'es';
const MIN_HUE_DISTANCE = 40;
const ENTRY_BOARD = 'Main.dc.html';
const PLUGIN_ROOT = new URL('../../../', import.meta.url);

const USAGE = `Usage:
  design.mjs status
  design.mjs distinct <tokens a> <tokens b> <tokens c> [--market-color <hex> --market-scheme <light|dark> --follows <letter> --departs <letter>]
  design.mjs canvas <work folder> <copy.json> <tokens.json> [<tokens.json> <tokens.json>] [--title <text>]
  design.mjs approve --chosen <a|b|c> --canvas <url|none> --reason <text>
  design.mjs reopen`;

const print = (value) => console.log(JSON.stringify(value, null, 2));
const readText = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
}

function headerOf(text) {
  if (!text?.startsWith('---\n')) return {};
  const closing = text.indexOf('\n---', 4);
  if (closing === -1) return {};
  const pairs = text
    .slice(4, closing)
    .split('\n')
    .map((line) => line.match(/^([a-z_]+):(.*)$/))
    .filter((match) => match && match[2].trim() !== '');
  return Object.fromEntries(pairs.map(([, key, value]) => [key, unquote(value)]));
}

function parseOptions(args, names) {
  const options = {};
  const positional = [];
  const pending = [...args];
  while (pending.length) {
    const argument = pending.shift();
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    const name = argument.slice(2);
    if (!names.includes(name)) throw new UsageError(`Unknown option --${name}\n${USAGE}`);
    if (!pending.length) throw new UsageError(`--${name} needs a value`);
    options[name] = pending.shift();
  }
  return { options, positional };
}

const localeOfBrief = () => headerOf(readText(BRIEF)).locale || DEFAULT_LOCALE;
const copyPathFor = (locale) => join(DESIGN, `copy.${locale}.json`);

export function fingerprintOf(tokensPath, copyPath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(tokensPath));
  hash.update(readFileSync(copyPath));
  return `sha256:${hash.digest('hex')}`;
}

function sketchStatus(letter) {
  const folder = join(SKETCHES, letter);
  return { tokens: existsSync(join(folder, 'tokens.json')), concept: existsSync(join(folder, 'concept.md')) };
}

function choiceStatus(copyPath) {
  const header = headerOf(readText(CHOICE));
  if (!header.chosen) return null;
  const canCompare = existsSync(APPROVED_TOKENS) && existsSync(copyPath);
  const current = canCompare ? fingerprintOf(APPROVED_TOKENS, copyPath) : null;
  return {
    chosen: header.chosen,
    approved: header.approved ?? null,
    canvas: header.canvas ?? null,
    fingerprint: header.fingerprint ?? null,
    fingerprint_matches: current === null ? null : current === header.fingerprint,
  };
}

function status(args) {
  if (args.length) throw new UsageError(USAGE);
  const briefHeader = headerOf(readText(BRIEF));
  const locale = briefHeader.locale || DEFAULT_LOCALE;
  const copyPath = copyPathFor(locale);
  print({
    brief: { exists: existsSync(BRIEF), approved: briefHeader.reviewer === 'approved', locale },
    connections: existsSync(join(STATE, 'connections.json')),
    answers: existsSync(join(DESIGN, 'answers.md')),
    market: existsSync(join(DESIGN, 'market.md')),
    copy: existsSync(copyPath) ? copyPath : null,
    concepts: existsSync(join(DESIGN, 'concepts.md')),
    sketches: Object.fromEntries(LETTERS.map((letter) => [letter, sketchStatus(letter)])),
    system: existsSync(SYSTEM),
    choice: choiceStatus(copyPath),
    landing: existsSync('landing'),
  });
  return EXIT_OK;
}

export const hueDistance = (first, second) => {
  const gap = Math.abs(first - second);
  return Math.min(gap, 360 - gap);
};

const familyPair = (tokens) => `${tokens.fonts.display.family} + ${tokens.fonts.body.family}`;

function pairwise(directions, check) {
  const problems = [];
  directions.forEach((first, position) => {
    directions.slice(position + 1).forEach((second) => {
      const problem = check(first, second);
      if (problem) problems.push(problem);
    });
  });
  return problems;
}

function accentProblem(first, second) {
  if (first.tokens.scheme !== second.tokens.scheme) return null;
  const distance = hueDistance(hslOf(first.tokens.color.accent).hue, hslOf(second.tokens.color.accent).hue);
  if (distance >= MIN_HUE_DISTANCE) return null;
  return `${first.letter} and ${second.letter}: same scheme and accents ${Math.round(distance)}° apart (at least ${MIN_HUE_DISTANCE}°)`;
}

function marketProblems(directions, options) {
  if (!options['market-color']) return [];
  const marketHue = hslOf(options['market-color']).hue;
  const byLetter = Object.fromEntries(directions.map((direction) => [direction.letter, direction.tokens]));
  const departs = (tokens) =>
    tokens.scheme !== options['market-scheme'] || hueDistance(hslOf(tokens.color.accent).hue, marketHue) >= MIN_HUE_DISTANCE;
  const problems = [];
  const follower = byLetter[options.follows];
  const departer = byLetter[options.departs];
  if (!follower) problems.push('--follows must name one of the three letters');
  if (!departer) problems.push('--departs must name one of the three letters');
  if (follower && departs(follower)) problems.push(`${options.follows} should follow the category code: same scheme as the market and an accent within ${MIN_HUE_DISTANCE}° of it`);
  if (departer && !departs(departer)) problems.push(`${options.departs} should depart from the category code: the other scheme, or an accent at least ${MIN_HUE_DISTANCE}° from it`);
  return problems;
}

function distinct(args) {
  const { options, positional } = parseOptions(args, ['market-color', 'market-scheme', 'follows', 'departs']);
  if (positional.length !== 3) throw new UsageError(USAGE);
  const directions = positional.map((path, position) => ({ letter: LETTERS[position], tokens: readJson(path, LETTERS[position]) }));
  const builderPalette = directions.every(({ tokens }) => tokens.palette_source === 'builder');
  const compositions = new Set(directions.map(({ tokens }) => tokens.composition));
  const checks = {
    compositions: compositions.size === 3 ? [] : ['the three compositions must be different'],
    type_pairs: pairwise(directions, (first, second) =>
      familyPair(first.tokens) === familyPair(second.tokens) ? `${first.letter} and ${second.letter} repeat the pair ${familyPair(first.tokens)}` : null,
    ),
    accents: builderPalette ? [] : pairwise(directions, accentProblem),
    market: builderPalette ? [] : marketProblems(directions, options),
  };
  const problems = Object.values(checks).flat();
  print({ passed: problems.length === 0, builder_palette: builderPalette, problems });
  return problems.length ? EXIT_CHECK_FAILED : EXIT_OK;
}

const boardFileName = (letter, board) => {
  if (letter === 'a' && board.width < 1000) return ENTRY_BOARD;
  return `${letter.toUpperCase()}-${board.width < 1000 ? 'phone' : 'desktop'}.dc.html`;
};

function comparisonBoards(directions, copy) {
  return placeInRow(
    directions.flatMap(({ letter, tokens }) =>
      fillDirection(tokens, copy)
        .filter((board) => board.group === 'promise')
        .map((board) => ({ ...board, group: letter, file: boardFileName(letter, board), title: `${letter.toUpperCase()} · ${board.title}` })),
    ),
  );
}

function comparisonNotes(directions, boards) {
  return Object.fromEntries(
    directions.map(({ letter, tokens }) => [
      `direction-${letter}`,
      titleNote(`${letter.toUpperCase()} · ${tokens.name}`, boards.filter((board) => board.group === letter)),
    ]),
  );
}

function previousIndex(work) {
  const text = readText(join(work, 'project', 'canvas.json'));
  return text ? JSON.parse(text) : null;
}

function canvas(args) {
  const { options, positional } = parseOptions(args, ['title']);
  const [work, copyPath, ...tokenPaths] = positional;
  if (!work || !copyPath || ![1, 3].includes(tokenPaths.length)) throw new UsageError(USAGE);
  const copy = readJson(copyPath, 'copy');
  const directions = tokenPaths.map((path, position) => ({ letter: LETTERS[position], tokens: readJson(path, path) }));
  const single = directions.length === 1;
  const boards = single ? placeInRow(fillDirection(directions[0].tokens, copy)) : comparisonBoards(directions, copy);
  const notes = single
    ? { 'title-promise': titleNote(directions[0].tokens.name, boards.filter((board) => board.group === 'promise')) }
    : comparisonNotes(directions, boards);
  const title = options.title ?? `${copy.brand} · ${single ? directions[0].tokens.name : directions.map(({ tokens }) => tokens.name).join(' / ')}`;
  const previous = previousIndex(work);
  const index = canvasIndex({ title, boards, notes });
  if (previous?.createdOnFiles) index.createdOnFiles = previous.createdOnFiles;
  const written = new Set(boards.map((board) => board.file));
  const removed = Object.keys(previous?.boards ?? {}).filter((file) => !written.has(file));
  removed.forEach((file) => rmSync(join(work, 'project', file), { force: true }));
  const files = writeCanvas(work, index, boards);
  print({
    root: work,
    index: 'project/canvas.json',
    entry: `project/${ENTRY_BOARD}`,
    rest: files.filter((file) => file !== 'project/canvas.json' && file !== `project/${ENTRY_BOARD}`),
    removed: removed.map((file) => `project/${file}`),
    boards: boards.map(({ file, title: boardTitle }) => ({ file: `project/${file}`, title: boardTitle })),
  });
  return EXIT_OK;
}

function verifyRows(tokensPath, copyPath, locale) {
  const contract = loadContract();
  const report = createReport(contract, 'design');
  checkDesign({ tokens: readJson(tokensPath, 'tokens'), copy: readJson(copyPath, 'copy'), locale, contract, report });
  return report.rows();
}

const headerValue = (value) => (/[:#"]/.test(value) ? JSON.stringify(value) : value);
const nowStamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

function phrasesFor(locale) {
  const path = new URL(`locales/${locale}/design.json`, PLUGIN_ROOT);
  const fallback = new URL(`locales/${DEFAULT_LOCALE}/design.json`, PLUGIN_ROOT);
  return JSON.parse(readFileSync(existsSync(path) ? path : fallback, 'utf8'));
}

function approve(args) {
  const { options, positional } = parseOptions(args, ['chosen', 'canvas', 'reason']);
  if (positional.length || !LETTERS.includes(options.chosen) || !options.canvas || !options.reason?.trim()) throw new UsageError(USAGE);
  const locale = localeOfBrief();
  const sketch = join(SKETCHES, options.chosen, 'tokens.json');
  const copyPath = copyPathFor(locale);
  const missing = [sketch, copyPath, SYSTEM].filter((path) => !existsSync(path));
  if (missing.length) throw new UsageError(`Missing: ${missing.join(', ')}`);
  const failed = verifyRows(sketch, copyPath, locale).filter((row) => row.status === 'fail');
  if (failed.length) {
    print({ approved: false, failed });
    return EXIT_CHECK_FAILED;
  }
  copyFileSync(sketch, APPROVED_TOKENS);
  const fingerprint = fingerprintOf(APPROVED_TOKENS, copyPath);
  const approved = nowStamp();
  const tokens = readJson(APPROVED_TOKENS, 'tokens');
  const body = phrasesFor(locale).choice_file;
  const lines = [
    '---',
    `chosen: ${options.chosen}`,
    `approved: ${approved}`,
    `canvas: ${headerValue(options.canvas)}`,
    `fingerprint: ${headerValue(fingerprint)}`,
    `reason: ${JSON.stringify(options.reason.trim().replace(/\s+/g, ' ').replaceAll('"', "'"))}`,
    '---',
    '',
    `# ${body.title.replace('{name}', tokens.name)}`,
    '',
    body.detail,
    '',
  ];
  writeFileSync(CHOICE, lines.join('\n'));
  print({ approved: true, chosen: options.chosen, approved_at: approved, fingerprint, files: [APPROVED_TOKENS, copyPath, SYSTEM, CHOICE] });
  return EXIT_OK;
}

function reopen(args) {
  if (args.length) throw new UsageError(USAGE);
  const text = readText(CHOICE);
  if (!text) throw new UsageError(`${CHOICE} does not exist`);
  writeFileSync(CHOICE, text.replace(/^approved:.*\n/m, ''));
  print({ reopened: true });
  return EXIT_OK;
}

const COMMANDS = { status, distinct, canvas, approve, reopen };

function main([command, ...args]) {
  const run = COMMANDS[command];
  if (!run) throw new UsageError(USAGE);
  return run(args);
}

const exitCodeOfFillError = (error) => (error instanceof FillUsageError ? EXIT_CODES.usage : null);

if (isMainModule(import.meta.url)) runCli(main, exitCodeOfFillError);
