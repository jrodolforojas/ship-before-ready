#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { measureBoards, NoChromeError } from '../../../scripts/capture.mjs';
import { canvasIndex, fillDirection, fillPromise, placeInRow, PROMISE_FILES, titleNote, UsageError as FillUsageError, writeCanvas } from '../../../scripts/fill-artboards.mjs';
import { boardStructure, readBoard } from '../../../scripts/promise-board.mjs';
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
const CONTRACT = loadContract();
const BOARD_FILES = CONTRACT.promise_board.files;
const VIEWPORTS = Object.keys(BOARD_FILES);
const FIRST_VIEW_HEIGHT = { phone: CONTRACT.viewports.first_view[0].height, desktop: CONTRACT.viewports.first_view[1].height };
const FIRST_VIEW_HOOKS = ['title', 'subtitle', 'cta'];
const LETTERS = ['a', 'b', 'c'];
const DEFAULT_LOCALE = 'es';
const MIN_HUE_DISTANCE = 40;
const ENTRY_BOARD = PROMISE_FILES.phone;
const PLUGIN_ROOT = new URL('../../../', import.meta.url);

const USAGE = `Usage:
  design.mjs status
  design.mjs distinct [--market-color <hex> --market-scheme <light|dark> --follows <letter> --departs <letter>]
  design.mjs canvas <work folder> <letter> [<letter> <letter>] [--title <text>] [--estimate]
  design.mjs preview <work folder> <letter> [<letter> <letter>]
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

export function fingerprintOf(paths) {
  const hash = createHash('sha256');
  paths.forEach((path) => hash.update(readFileSync(path)));
  return `sha256:${hash.digest('hex')}`;
}

const boardPathsIn = (folder) => VIEWPORTS.map((viewport) => join(folder, BOARD_FILES[viewport]));
const approvedPaths = (copyPath) => [APPROVED_TOKENS, copyPath, ...boardPathsIn(DESIGN)];
const sketchFolder = (letter) => join(SKETCHES, letter);

function sketchStatus(letter) {
  const folder = sketchFolder(letter);
  return {
    tokens: existsSync(join(folder, 'tokens.json')),
    concept: existsSync(join(folder, 'concept.md')),
    boards: boardPathsIn(folder).every((path) => existsSync(path)),
  };
}

function choiceStatus(copyPath) {
  const header = headerOf(readText(CHOICE));
  if (!header.chosen) return null;
  const paths = approvedPaths(copyPath);
  const current = paths.every((path) => existsSync(path)) ? fingerprintOf(paths) : null;
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
    promise_answers: existsSync(join(DESIGN, 'promise.md')),
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

function readSketch(letter) {
  const folder = sketchFolder(letter);
  const tokensPath = join(folder, 'tokens.json');
  if (!existsSync(tokensPath)) throw new UsageError(`${tokensPath} does not exist`);
  const boards = Object.fromEntries(VIEWPORTS.map((viewport) => [viewport, readText(join(folder, BOARD_FILES[viewport]))]));
  return { letter, folder, tokens: readJson(tokensPath, tokensPath), boards };
}

const structureOf = (sketch) => VIEWPORTS.map((viewport) => boardStructure(readBoard(sketch.boards[viewport], CONTRACT), CONTRACT)).join('|');

function compositionProblems(directions) {
  const missing = directions.filter(({ boards }) => VIEWPORTS.some((viewport) => boards[viewport] === null)).map(({ letter }) => `${letter} has no boards of the free screen yet`);
  if (missing.length) return missing;
  return pairwise(directions, (first, second) =>
    structureOf(first) === structureOf(second) ? `${first.letter} and ${second.letter} share their composition: the same blocks, layout, styles and fills in the same order` : null,
  );
}

function distinct(args) {
  const { options, positional } = parseOptions(args, ['market-color', 'market-scheme', 'follows', 'departs']);
  if (positional.length) throw new UsageError(USAGE);
  const directions = LETTERS.map(readSketch);
  const builderPalette = directions.every(({ tokens }) => tokens.palette_source === 'builder');
  const checks = {
    compositions: compositionProblems(directions),
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
  if (letter === 'a' && board.viewport === 'phone') return ENTRY_BOARD;
  return `${letter.toUpperCase()}-${board.viewport}.dc.html`;
};

function comparisonBoards(directions, copy, measured) {
  return placeInRow(
    directions.flatMap(({ letter, tokens, boards }) =>
      fillPromise(tokens, copy, boards, measured[letter]).map((board) => ({ ...board, group: letter, file: boardFileName(letter, board), title: `${letter.toUpperCase()} · ${board.title}` })),
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

function requireBoards(sketch) {
  const missing = VIEWPORTS.filter((viewport) => sketch.boards[viewport] === null).map((viewport) => join(sketch.folder, BOARD_FILES[viewport]));
  if (missing.length) throw new UsageError(`Missing: ${missing.join(', ')}`);
  return sketch;
}

function firstViewProblems(letter, viewport, box) {
  if (!box) return [`${letter} ${viewport}: the board has no section to measure`];
  return FIRST_VIEW_HOOKS.filter((hook) => !(box.bottoms[hook] <= FIRST_VIEW_HEIGHT[viewport]))
    .map((hook) => `${letter} ${viewport}: ${hook} ends at ${Math.round(box.bottoms[hook] ?? 0)} px, below the first view of ${FIRST_VIEW_HEIGHT[viewport]} px`);
}

async function measureDirections(directions, copy, work) {
  const folder = join(work, 'measure');
  mkdirSync(folder, { recursive: true });
  const pages = directions.flatMap(({ letter, tokens, boards }) =>
    fillPromise(tokens, copy, boards).map((board) => {
      const path = join(folder, `${letter}-${board.viewport}.html`);
      writeFileSync(path, board.html);
      return { letter, viewport: board.viewport, path, width: board.width };
    }),
  );
  try {
    const boxes = await measureBoards(pages);
    const measured = {};
    const problems = pages.flatMap((page, index) => {
      measured[page.letter] = { ...measured[page.letter], [page.viewport]: boxes[index]?.height };
      return firstViewProblems(page.letter, page.viewport, boxes[index]);
    });
    return { measured, first_view: problems };
  } catch (error) {
    if (!(error instanceof NoChromeError)) throw error;
    return { measured: {}, first_view: null };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function canvas(args) {
  const flags = args.filter((argument) => argument === '--estimate');
  const { options, positional } = parseOptions(args.filter((argument) => argument !== '--estimate'), ['title']);
  const [work, ...letters] = positional;
  if (!work || ![1, 3].includes(letters.length) || !letters.every((letter) => LETTERS.includes(letter))) throw new UsageError(USAGE);
  const copy = readJson(copyPathFor(localeOfBrief()), 'copy');
  const directions = letters.map(readSketch).map(requireBoards);
  const single = directions.length === 1;
  const { measured, first_view: firstView } = flags.length ? { measured: {}, first_view: null } : await measureDirections(directions, copy, work);
  const boards = single ? placeInRow(fillDirection(directions[0].tokens, copy, directions[0].boards, measured[directions[0].letter])) : comparisonBoards(directions, copy, measured);
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
    boards: boards.map(({ file, title: boardTitle, height }) => ({ file: `project/${file}`, title: boardTitle, height })),
    measured: firstView !== null,
    first_view: firstView ?? [],
  });
  return EXIT_OK;
}

const PREVIEW_ERROR_STATE = /<sc-if value="\{\{ error \}\}"[\s\S]*?<\/sc-if>\n?/g;
const previewHtml = (html) => html.replace(PREVIEW_ERROR_STATE, '').replace(/<\/?sc-if[^>]*>\n?/g, '').replace('<script src="./support.js"></script>\n', '');

function preview(args) {
  const [work, ...letters] = args;
  if (!work || ![1, 3].includes(letters.length) || !letters.every((letter) => LETTERS.includes(letter))) throw new UsageError(USAGE);
  const copy = readJson(copyPathFor(localeOfBrief()), 'copy');
  const folder = join(work, 'preview');
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  const directions = letters.map(readSketch).map(requireBoards);
  const pages = directions.flatMap(({ letter, tokens, boards }) => {
    const filled = letters.length === 1 ? fillDirection(tokens, copy, boards) : fillPromise(tokens, copy, boards);
    return filled.map((board) => {
      const path = join(folder, `${letter}-${board.file.replace('.dc.html', '.html')}`);
      writeFileSync(path, previewHtml(board.html));
      return { letter, title: board.title, path };
    });
  });
  print({ folder, pages });
  return EXIT_OK;
}

function verifyRows(folder, copyPath, locale) {
  const report = createReport(CONTRACT, 'design');
  const boards = Object.fromEntries(VIEWPORTS.map((viewport) => [viewport, readBoard(readFileSync(join(folder, BOARD_FILES[viewport]), 'utf8'), CONTRACT)]));
  checkDesign({ tokens: readJson(join(folder, 'tokens.json'), 'tokens'), copy: readJson(copyPath, 'copy'), locale, contract: CONTRACT, report, boards });
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
  const folder = sketchFolder(options.chosen);
  const sketch = join(folder, 'tokens.json');
  const copyPath = copyPathFor(locale);
  const missing = [sketch, ...boardPathsIn(folder), copyPath, SYSTEM].filter((path) => !existsSync(path));
  if (missing.length) throw new UsageError(`Missing: ${missing.join(', ')}`);
  const failed = verifyRows(folder, copyPath, locale).filter((row) => row.status === 'fail');
  if (failed.length) {
    print({ approved: false, failed });
    return EXIT_CHECK_FAILED;
  }
  copyFileSync(sketch, APPROVED_TOKENS);
  VIEWPORTS.forEach((viewport) => copyFileSync(join(folder, BOARD_FILES[viewport]), join(DESIGN, BOARD_FILES[viewport])));
  const fingerprint = fingerprintOf(approvedPaths(copyPath));
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
  print({ approved: true, chosen: options.chosen, approved_at: approved, fingerprint, files: [...approvedPaths(copyPath), SYSTEM, CHOICE] });
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

const COMMANDS = { status, distinct, canvas, preview, approve, reopen };

function main([command, ...args]) {
  const run = COMMANDS[command];
  if (!run) throw new UsageError(USAGE);
  return run(args);
}

const exitCodeOfFillError = (error) => (error instanceof FillUsageError ? EXIT_CODES.usage : null);

if (isMainModule(import.meta.url)) runCli(main, exitCodeOfFillError);
