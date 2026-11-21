#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXIT_USAGE_OR_ENVIRONMENT = 2;
const USAGE = 'Usage: copy-template.mjs <destination> [--pm <manager>] [--example]';

const pluginRoot = fileURLToPath(new URL('..', import.meta.url));
const templateFolder = join(pluginRoot, 'templates', 'landing');
const neutralTokens = join(pluginRoot, 'templates', 'neutral-design', 'tokens.json');
const exampleCopy = join(pluginRoot, 'templates', 'example', 'es.json');
const contract = JSON.parse(readFileSync(join(pluginRoot, 'templates', 'contract.json'), 'utf8'));

const NEVER_COPIED = new Set(['node_modules', 'dist', '.astro', '.vercel', '.DS_Store']);
const BUILDER_FOLDERS = [join('src', 'data'), join('src', 'i18n')];
const LOCKFILE_MANAGER = { 'bun.lock': 'bun' };

class UsageError extends Error {}

function parseArguments(argv) {
  const options = { destination: undefined, manager: contract.default_package_manager, example: false };
  const pending = [...argv];
  while (pending.length > 0) {
    const argument = pending.shift();
    if (argument === '--example') {
      options.example = true;
      continue;
    }
    if (argument === '--pm') {
      options.manager = pending.shift();
      continue;
    }
    if (argument.startsWith('--pm=')) {
      options.manager = argument.slice('--pm='.length);
      continue;
    }
    if (argument.startsWith('-')) throw new UsageError(`Unknown option: ${argument}`);
    if (options.destination) throw new UsageError('Only one destination is accepted.');
    options.destination = argument;
  }
  return options;
}

function isInside(folder, path) {
  const fromFolder = relative(folder, path);
  if (isAbsolute(fromFolder)) return false;
  return fromFolder.split(sep)[0] !== '..';
}

function validate({ destination, manager }) {
  if (!destination) throw new UsageError('Missing <destination>.');
  if (!contract.package_managers.includes(manager)) {
    throw new UsageError(`--pm must be one of: ${contract.package_managers.join(', ')}.`);
  }
  if (!existsSync(join(templateFolder, 'package.json'))) {
    throw new UsageError(`Template not found at ${templateFolder}.`);
  }
  const target = resolve(destination);
  if (isInside(templateFolder, target)) throw new UsageError('The destination cannot be inside the template.');
  if (existsSync(target) && !statSync(target).isDirectory()) {
    throw new UsageError(`The destination exists and is not a folder: ${target}`);
  }
  return target;
}

function belongsToSkeleton(source, manager) {
  const path = relative(templateFolder, source);
  if (path === '') return true;
  if (path.split(sep).some((segment) => NEVER_COPIED.has(segment))) return false;
  if (BUILDER_FOLDERS.some((folder) => path === folder || path.startsWith(folder + sep))) return false;
  const lockfileManager = LOCKFILE_MANAGER[path];
  if (lockfileManager) return lockfileManager === manager;
  return true;
}

function addWhenMissing(source, target, alreadyThere) {
  if (alreadyThere) return 'kept';
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target);
  return 'added';
}

function languageFiles(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter((name) => name.endsWith('.json'));
}

function addExample(target) {
  const tokens = join(target, 'src', 'data', 'tokens.json');
  const languageFolder = join(target, 'src', 'i18n');
  return [
    `src/data/tokens.json: ${addWhenMissing(neutralTokens, tokens, existsSync(tokens))}`,
    `src/i18n/es.json: ${addWhenMissing(exampleCopy, join(languageFolder, 'es.json'), languageFiles(languageFolder).length > 0)}`,
  ];
}

function lockfileReport(manager) {
  const lockfile = Object.keys(LOCKFILE_MANAGER).find((name) => LOCKFILE_MANAGER[name] === manager);
  if (lockfile) return `lockfile: ${lockfile}`;
  return `lockfile: none copied, ${manager} writes its own on the first install`;
}

function run(argv) {
  const options = parseArguments(argv);
  const target = validate(options);
  cpSync(templateFolder, target, {
    recursive: true,
    force: true,
    filter: (source) => belongsToSkeleton(source, options.manager),
  });
  const exampleReport = options.example ? addExample(target) : [];
  const report = [
    `Copied the landing template to ${target}`,
    lockfileReport(options.manager),
    ...exampleReport,
    `Next: cd ${options.destination} && ${options.manager} install && ${options.manager} run build`,
  ];
  console.log(report.join('\n'));
}

try {
  run(process.argv.slice(2));
} catch (error) {
  const detail = error instanceof UsageError ? `${error.message}\n${USAGE}` : error.message;
  console.error(detail);
  process.exit(EXIT_USAGE_OR_ENVIRONMENT);
}
