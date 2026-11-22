#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fillDirection } from '../../../scripts/fill-artboards.mjs';
import { parseHtml } from '../../../scripts/html.mjs';
import { boardSignature, pageSignature, readBoard, signatureDifference } from '../../../scripts/promise-board.mjs';
import { CHECKED_BY, checkDesign, createReport, EXIT_CODES, isMainModule, loadContract, readJson, runCli, UsageError } from '../../../scripts/verify-design.mjs';

const STATE = '.sbr';
const BRIEF = join(STATE, 'brief.md');
const CONNECTIONS = join(STATE, 'connections.json');
const DESIGN = join(STATE, 'design');
const CHOICE = join(DESIGN, 'choice.md');
const APPROVED_TOKENS = join(DESIGN, 'tokens.json');
const CONTRACT = loadContract();
const BOARD_FILES = CONTRACT.promise_board.files;
const APPROVED_BOARDS = Object.fromEntries(Object.entries(BOARD_FILES).map(([viewport, name]) => [viewport, join(DESIGN, name)]));
const PUBLISHED = join(STATE, 'landing.json');
const LANDING = 'landing';
const LANDING_TOKENS = join(LANDING, 'src', 'data', 'tokens.json');
const LANDING_CONFIG = join(LANDING, 'src', 'data', 'config.json');
const LANDING_LANGUAGE = join(LANDING, 'src', 'i18n');
const LANDING_PAGE = join(LANDING, CONTRACT.landing_files.built_page);
const STASHED_CONFIG = 'config.json';
const DEFAULT_LOCALE = 'es';
const MIN_NODE = [22, 23, 4];
const REGIONS = ['us', 'eu'];
const PUBLIC_KEY = /^phc_[A-Za-z0-9_-]+$/;
const PROJECT_ID = /^\d+$/;
const VERCEL_NAME = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const NO_TEAM = [null, 'none'];
const ARTBOARD = /\.dc\.html$/;
const GATE_FILES = { landing: 'landing.tsv', capture: 'capture.tsv', reviewer: 'reviewer.txt' };
const SKELETON_ROWS = ['R1', 'R16', 'R20', 'R21', 'R22', 'R24', 'R28', 'R29', 'R32'];
const CHECKLIST_ROWS = ['R3', 'R13', 'R18', 'R19', 'R21', 'R22', 'R25'];

const USAGE = `Usage:
  landing.mjs status
  landing.mjs canvas <folder>
  landing.mjs compare <expected folder> <live folder>
  landing.mjs place <work folder>
  landing.mjs match
  landing.mjs unstash <work folder>
  landing.mjs checklist [--confirmed <ids>] [--failed <ids>]
  landing.mjs gate <work folder>
  landing.mjs record --url <url> --gate <gate.json>`;

const print = (value) => console.log(JSON.stringify(value, null, 2));
const readText = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);
const nowStamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const listOf = (value) => (value ? value.split(',').map((id) => id.trim()).filter(Boolean) : []);

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
}

export function headerOf(text) {
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
const approvedCopyPath = (locale) => join(DESIGN, `copy.${locale}.json`);

export function fingerprintOf(paths) {
  const hash = createHash('sha256');
  paths.forEach((path) => hash.update(readFileSync(path)));
  return `sha256:${hash.digest('hex')}`;
}

const approvedPaths = (copyPath) => [APPROVED_TOKENS, copyPath, APPROVED_BOARDS.phone, APPROVED_BOARDS.desktop];

function choiceStatus(copyPath) {
  const text = readText(CHOICE);
  if (text === null) return null;
  const header = headerOf(text);
  const paths = approvedPaths(copyPath);
  const current = paths.every((path) => existsSync(path)) ? fingerprintOf(paths) : null;
  return {
    chosen: header.chosen ?? null,
    approved: header.approved ?? null,
    canvas: header.canvas ?? null,
    fingerprint: header.fingerprint ?? null,
    fingerprint_matches: current === null ? null : current === header.fingerprint,
  };
}

export function connectionProblems(connections, contract) {
  const problems = [];
  if (!contract.package_managers.includes(connections.package_manager)) problems.push(`package_manager must be one of ${contract.package_managers.join(', ')}`);
  if (!REGIONS.includes(connections.posthog_region)) problems.push(`posthog_region must be one of ${REGIONS.join(', ')}`);
  if (!PUBLIC_KEY.test(connections.posthog_public_key ?? '')) problems.push('posthog_public_key is not a public project key');
  if (!PROJECT_ID.test(connections.posthog_project_id ?? '')) problems.push('posthog_project_id is not a project id');
  if (!VERCEL_NAME.test(connections.vercel_project ?? '')) problems.push('vercel_project is not a Vercel project name');
  return problems;
}

function connectionsStatus(contract) {
  if (!existsSync(CONNECTIONS)) return null;
  const connections = readJson(CONNECTIONS, 'connections');
  const team = NO_TEAM.includes(connections.vercel_team ?? null) ? null : connections.vercel_team;
  return {
    package_manager: connections.package_manager ?? null,
    posthog_region: connections.posthog_region ?? null,
    posthog_project_id: connections.posthog_project_id ?? null,
    vercel_project: connections.vercel_project ?? null,
    vercel_team: team,
    problems: connectionProblems(connections, contract),
  };
}

export function nodeIsRecentEnough(version) {
  const parts = version.replace(/^v/, '').split('.').map(Number);
  const firstDifferent = MIN_NODE.findIndex((minimum, position) => parts[position] !== minimum);
  if (firstDifferent === -1) return true;
  return parts[firstDifferent] > MIN_NODE[firstDifferent];
}

function status(args) {
  if (args.length) throw new UsageError(USAGE);
  const contract = loadContract();
  const locale = localeOfBrief();
  const copyPath = approvedCopyPath(locale);
  print({
    locale,
    node: { version: process.version, recent_enough: nodeIsRecentEnough(process.version) },
    design_files: {
      tokens: existsSync(APPROVED_TOKENS),
      copy: existsSync(copyPath) ? copyPath : null,
      boards: Object.values(APPROVED_BOARDS).every((path) => existsSync(path)),
    },
    choice: choiceStatus(copyPath),
    connections: connectionsStatus(contract),
    landing: { exists: existsSync(join(LANDING, 'package.json')), config: existsSync(LANDING_CONFIG) },
    published: existsSync(PUBLISHED) ? readJson(PUBLISHED, 'landing.json') : null,
  });
  return EXIT_CODES.ok;
}

function approvedDesign() {
  const locale = localeOfBrief();
  const copyPath = approvedCopyPath(locale);
  const missing = [...approvedPaths(copyPath), CHOICE].filter((path) => !existsSync(path));
  if (missing.length) throw new UsageError(`Missing: ${missing.join(', ')}`);
  return {
    locale,
    copyPath,
    tokens: readJson(APPROVED_TOKENS, 'tokens'),
    copy: readJson(copyPath, 'copy'),
    boards: { phone: readText(APPROVED_BOARDS.phone), desktop: readText(APPROVED_BOARDS.desktop) },
    choice: headerOf(readText(CHOICE)),
  };
}

function canvas(args) {
  if (args.length !== 1) throw new UsageError(USAGE);
  const [folder] = args;
  const { tokens, copy, boards: promise } = approvedDesign();
  const project = join(folder, 'project');
  rmSync(project, { recursive: true, force: true });
  mkdirSync(project, { recursive: true });
  const boards = fillDirection(tokens, copy, promise);
  boards.forEach((board) => writeFileSync(join(project, board.file), board.html));
  print({ folder, files: boards.map((board) => `project/${board.file}`) });
  return EXIT_CODES.ok;
}

function artboardsIn(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { recursive: true })
    .map((path) => path.split('\\').join('/'))
    .filter((path) => ARTBOARD.test(path))
    .sort();
}

// Frame heights are measured in a browser when the canvas is drawn and estimated otherwise: they are not part of the design.
const normalizedLines = (path) =>
  readFileSync(path, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/min-height: \d+px/g, 'min-height: <frame>px')
    .replace(/"height":\d+/g, '"height":<frame>')
    .trimEnd();

export function compareArtboards(expectedFolder, liveFolder) {
  const expected = artboardsIn(expectedFolder);
  const live = artboardsIn(liveFolder);
  const missing = expected.filter((path) => !live.includes(path));
  const extra = live.filter((path) => !expected.includes(path));
  const changed = expected.filter((path) => live.includes(path) && normalizedLines(join(expectedFolder, path)) !== normalizedLines(join(liveFolder, path)));
  return { matches: missing.length + extra.length + changed.length === 0, changed, missing, extra };
}

function compare(args) {
  if (args.length !== 2) throw new UsageError(USAGE);
  const [expectedFolder, liveFolder] = args;
  if (!artboardsIn(expectedFolder).length) throw new UsageError(`${expectedFolder} holds no artboards: run the canvas command first`);
  const result = compareArtboards(expectedFolder, liveFolder);
  print(result);
  return result.matches ? EXIT_CODES.ok : EXIT_CODES.requirementFailed;
}

function requireMatchingFingerprint(choice, copyPath) {
  const current = fingerprintOf(approvedPaths(copyPath));
  if (current === choice.fingerprint) return current;
  throw new UsageError(`The files differ from the approved fingerprint (${current} instead of ${choice.fingerprint}): the design must be approved again`);
}

function place(args) {
  if (args.length !== 1) throw new UsageError(USAGE);
  const [work] = args;
  if (!existsSync(join(LANDING, 'package.json'))) throw new UsageError('landing/ is not installed: run copy-template.mjs first');
  const { locale, copyPath, choice } = approvedDesign();
  requireMatchingFingerprint(choice, copyPath);
  const languageFile = join(LANDING_LANGUAGE, `${locale}.json`);
  mkdirSync(dirname(LANDING_TOKENS), { recursive: true });
  mkdirSync(LANDING_LANGUAGE, { recursive: true });
  const removed = readdirSync(LANDING_LANGUAGE)
    .filter((name) => name !== `${locale}.json`)
    .map((name) => join(LANDING_LANGUAGE, name));
  removed.forEach((path) => rmSync(path, { recursive: true, force: true }));
  copyFileSync(APPROVED_TOKENS, LANDING_TOKENS);
  copyFileSync(copyPath, languageFile);
  const stashed = existsSync(LANDING_CONFIG);
  if (stashed) {
    mkdirSync(work, { recursive: true });
    renameSync(LANDING_CONFIG, join(work, STASHED_CONFIG));
  }
  print({ tokens: LANDING_TOKENS, copy: languageFile, removed, stashed_config: stashed });
  return EXIT_CODES.ok;
}

export function promiseMatch(boardHtml, pageHtml) {
  const expected = boardSignature(readBoard(boardHtml, CONTRACT));
  const actual = pageSignature(parseHtml(pageHtml), CONTRACT);
  const difference = signatureDifference(expected, actual);
  return { matches: difference === null, texts: expected.length, difference };
}

function landingMatch() {
  const { boards } = approvedDesign();
  if (!existsSync(LANDING_PAGE)) throw new UsageError(`${LANDING_PAGE} does not exist: build the landing first`);
  return promiseMatch(boards.phone, readFileSync(LANDING_PAGE, 'utf8'));
}

function match(args) {
  if (args.length) throw new UsageError(USAGE);
  const result = landingMatch();
  print(result);
  return result.matches ? EXIT_CODES.ok : EXIT_CODES.requirementFailed;
}

function unstash(args) {
  if (args.length !== 1) throw new UsageError(USAGE);
  const stashed = join(args[0], STASHED_CONFIG);
  if (!existsSync(stashed)) {
    print({ restored: false });
    return EXIT_CODES.ok;
  }
  mkdirSync(dirname(LANDING_CONFIG), { recursive: true });
  renameSync(stashed, LANDING_CONFIG);
  print({ restored: true, config: LANDING_CONFIG });
  return EXIT_CODES.ok;
}

export function checklistRows(contract, confirmed, failed) {
  const unknown = [...confirmed, ...failed].filter((id) => !CHECKLIST_ROWS.includes(id));
  if (unknown.length) throw new UsageError(`Not in the manual checklist: ${unknown.join(', ')}`);
  return contract.requirement_ids.map((id) => {
    if (failed.includes(id)) return [id, 'fail', 'the builder saw it fail on the preview'];
    if (confirmed.includes(id)) return [id, 'pass', 'confirmed by the builder on the preview, without Chrome'];
    if (CHECKLIST_ROWS.includes(id)) return [id, 'skip', 'the builder did not confirm it'];
    return [id, 'skip', 'not measured: no Chrome'];
  });
}

function checklist(args) {
  const { options, positional } = parseOptions(args, ['confirmed', 'failed']);
  if (positional.length) throw new UsageError(USAGE);
  const rows = checklistRows(loadContract(), listOf(options.confirmed), listOf(options.failed));
  console.log(rows.map((row) => row.join('\t')).join('\n'));
  return EXIT_CODES.ok;
}

export function rowsOf(text) {
  if (text === null) return null;
  const rows = text
    .split('\n')
    .map((line) => line.split('\t'))
    .filter(([id, status]) => /^R\d+$/.test(id ?? '') && ['pass', 'fail', 'skip'].includes(status));
  return Object.fromEntries(rows.map(([id, status, ...detail]) => [id, { status, detail: detail.join(' ').trim() }]));
}

export function reviewerExtras(text) {
  if (text === null) return { audience: null, promise: null, notes: [] };
  const lines = text.split('\n').map((line) => line.trim());
  const valueOf = (prefix) => lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? null;
  return { audience: valueOf('audience:'), promise: valueOf('promise:'), notes: lines.filter((line) => line.startsWith('note:')).map((line) => line.slice(5).trim()) };
}

function designRowsOfApproved(contract) {
  const { tokens, copy, locale, boards } = approvedDesign();
  const report = createReport(contract, 'design');
  const read = (html) => readBoard(html, contract);
  checkDesign({ tokens, copy, locale, contract, report, boards: { phone: read(boards.phone), desktop: read(boards.desktop) } });
  return Object.fromEntries(report.rows().map((row) => [row.id, { status: row.status, detail: row.detail }]));
}

function originOf(id, byTool) {
  if (byTool.design?.status === 'fail') return 'design';
  if (SKELETON_ROWS.includes(id)) return 'template';
  if (byTool.landing?.status === 'fail') return 'landing';
  return 'design';
}

function mergedStatus(byTool, tools) {
  const statuses = tools.map((tool) => byTool[tool]?.status ?? 'skip');
  if (statuses.includes('fail')) return 'fail';
  if (statuses.every((value) => value === 'pass')) return 'pass';
  return 'skip';
}

export function mergeGate(contract, toolRows) {
  const result = { passed: [], failed: [], skipped: [] };
  contract.requirement_ids.forEach((id) => {
    const tools = CHECKED_BY[id];
    const byTool = Object.fromEntries(tools.filter((tool) => toolRows[tool]?.[id]).map((tool) => [tool, toolRows[tool][id]]));
    const merged = mergedStatus(byTool, tools);
    if (merged === 'pass') return result.passed.push(id);
    if (merged === 'skip') return result.skipped.push(id);
    const details = Object.fromEntries(Object.entries(byTool).filter(([, row]) => row.status === 'fail').map(([tool, row]) => [tool, row.detail]));
    result.failed.push({ id, origin: originOf(id, byTool), details });
  });
  return result;
}

function gate(args) {
  if (args.length !== 1) throw new UsageError(USAGE);
  const [work] = args;
  const contract = loadContract();
  const landingRows = rowsOf(readText(join(work, GATE_FILES.landing)));
  if (!landingRows) throw new UsageError(`${join(work, GATE_FILES.landing)} is missing: run verify-landing.mjs first`);
  const reviewerText = readText(join(work, GATE_FILES.reviewer));
  const toolRows = {
    design: designRowsOfApproved(contract),
    landing: landingRows,
    capture: rowsOf(readText(join(work, GATE_FILES.capture))),
    reviewer: rowsOf(reviewerText),
  };
  const canvasMatch = landingMatch();
  const result = { ...mergeGate(contract, toolRows), canvas_match: canvasMatch, ran: Object.keys(toolRows).filter((tool) => toolRows[tool]), ...reviewerExtras(reviewerText) };
  writeFileSync(join(work, 'gate.json'), `${JSON.stringify(result, null, 2)}\n`);
  print(result);
  return result.failed.length || !canvasMatch.matches ? EXIT_CODES.requirementFailed : EXIT_CODES.ok;
}

function record(args) {
  const { options, positional } = parseOptions(args, ['url', 'gate']);
  if (positional.length || !options.url || !options.gate) throw new UsageError(USAGE);
  if (!URL.canParse(options.url) || new URL(options.url).protocol !== 'https:') throw new UsageError(`${options.url} is not an https URL`);
  const { copyPath, choice } = approvedDesign();
  const fingerprint = requireMatchingFingerprint(choice, copyPath);
  const gateResult = readJson(options.gate, 'gate');
  if (gateResult.failed.length) throw new UsageError(`The gate has failed requirements (${gateResult.failed.map((row) => row.id).join(', ')}): nothing is recorded`);
  if (!gateResult.canvas_match?.matches) throw new UsageError('The page does not match the approved boards of the free screen: nothing is recorded');
  const url = new URL(options.url);
  const published = {
    url: `${url.origin}${url.pathname.replace(/\/$/, '')}`,
    published_at: nowStamp(),
    fingerprint,
    verification: { passed: gateResult.passed, failed: [], skipped: gateResult.skipped },
  };
  writeFileSync(PUBLISHED, `${JSON.stringify(published, null, 2)}\n`);
  print({ file: relative('.', PUBLISHED), ...published });
  return EXIT_CODES.ok;
}

const COMMANDS = { status, canvas, compare, place, match, unstash, checklist, gate, record };

function main([command, ...args]) {
  const run = COMMANDS[command];
  if (!run) throw new UsageError(USAGE);
  return run(args);
}

if (isMainModule(import.meta.url)) runCli(main);
