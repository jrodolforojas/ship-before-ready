#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UsageError,
  checkDesign,
  copyShapeProblems,
  createReport,
  isMainModule,
  loadContract,
  printReport,
  readJson,
  record,
  runCli,
  tokenShapeProblems,
} from './verify-design.mjs';

export const TEMPLATE_DIR = fileURLToPath(new URL('../templates/landing/', import.meta.url));

const MAX_OWN_BYTES = 100 * 1024;
const TOTAL_STEPS = 2;
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const START_TAG = /<([a-zA-Z][^\s/>]*)/y;
const ATTRIBUTE = /\s*([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/y;

const NAVIGATION_ELEMENTS = ['a', 'nav', 'area'];
const NEVER_PRESENT_ELEMENTS = ['video', 'audio', 'iframe', 'dialog', 'embed', 'object', 'marquee'];
const BUTTON_LIKE_INPUT_TYPES = ['submit', 'button', 'image', 'reset'];
const TEXT_ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'alt'];
const REQUEST_ATTRIBUTES = { script: ['src'], img: ['src', 'srcset'], source: ['src', 'srcset'], iframe: ['src'], video: ['src', 'poster'], audio: ['src'], embed: ['src'], object: ['data'], form: ['action'], input: ['src'], track: ['src'] };
const LINK_RELS_WITHOUT_REQUEST = ['canonical', 'alternate'];
const EXTERNAL_URL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const URLS_IN_SCRIPT = /https?:\/\/[^\s"'`<>\\)]+/g;
const NAMESPACE_URL = /^https?:\/\/www\.w3\.org\//;
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

const SKELETON_IGNORED_NAMES = new Set(['node_modules', 'dist', '.astro', '.vercel', '.git', '.DS_Store']);
const LOCKFILES = new Set(['bun.lock', 'bun.lockb', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock']);
const SOURCE_EXTENSIONS = new Set(['.astro', '.ts', '.js', '.mjs', '.css', '.html']);

const TEXT_KEYWORDS = new Set(['left', 'center', 'right', 'start', 'end', 'balance', 'pretty', 'wrap', 'nowrap', 'ellipsis', 'clip']);
const BORDER_KEYWORDS = new Set(['solid', 'dashed', 'dotted', 'double', 'hidden', 'none', 'collapse', 'separate']);
const BORDER_SIDES = new Set(['t', 'r', 'b', 'l', 'x', 'y', 's', 'e']);
const OUTLINE_UTILITIES = new Set(['outline', 'outline-2', 'outline-offset-2', 'outline-focus']);
const SIZE_KEYWORDS = new Set(['full', 'screen', 'auto', 'px', 'fit', 'min', 'max', 'none', 'dvh', 'dvw', 'svh', 'svw', 'lvh', 'lvw']);
const TRANSITION_UTILITIES = new Set(['transition-opacity', 'transition-transform', 'transition-none']);
const TRANSITION_PROPERTIES = new Set(['opacity', 'transform', 'translate', 'scale', 'rotate', 'none']);
const TIMING_KEYWORDS = new Set(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end', 'allow-discrete', 'normal']);
const UNTOKENED_PREFIXES = ['leading', 'tracking', 'duration', 'delay', 'ease', 'ring', 'divide', 'from', 'via', 'to', 'decoration', 'caret'];
const SPACING_PREFIXES = [
  'scroll-mx', 'scroll-my', 'scroll-ms', 'scroll-me', 'scroll-mt', 'scroll-mr', 'scroll-mb', 'scroll-ml', 'scroll-m',
  'scroll-px', 'scroll-py', 'scroll-ps', 'scroll-pe', 'scroll-pt', 'scroll-pr', 'scroll-pb', 'scroll-pl', 'scroll-p',
  'border-spacing-x', 'border-spacing-y', 'border-spacing', 'translate-x', 'translate-y', 'space-x', 'space-y',
  'gap-x', 'gap-y', 'gap', 'inset-x', 'inset-y', 'inset', 'min-w', 'max-w', 'min-h', 'max-h',
  'px', 'py', 'ps', 'pe', 'pt', 'pr', 'pb', 'pl', 'p', 'mx', 'my', 'ms', 'me', 'mt', 'mr', 'mb', 'ml', 'm',
  'top', 'right', 'bottom', 'left', 'start', 'end', 'size', 'basis', 'indent', 'w', 'h',
];
const CONTAINER_PREFIXES = new Set(['max-w', 'min-w', 'w', 'basis']);
const ROUNDED_SIDES = new Set(['t', 'r', 'b', 'l', 's', 'e', 'tl', 'tr', 'bl', 'br', 'ss', 'se', 'es', 'ee']);
const ARBITRARY_VALUE = /(?:^|:)-?[a-z][a-z0-9-]*-\[[^\]]+\]/;
const ARBITRARY_PROPERTY = /(?:^|:)\[[a-z-]+:[^\]=]+\]$/;
const ARBITRARY_VARIANT = /\[[^\]]*\]:/;
const CLASS_ATTRIBUTE = /\bclass(?::list)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
const CLASS_CONSTANT = /\b\w*[cC]lass(?:es|Name|List)?\w*\s*[:=]\s*(['"`])([^'"`]*)\1/g;
const CLASS_LIST_CALL = /classList\.(?:add|remove|toggle|replace)\(([^)]*)\)/g;
const APPLY_RULE = /@apply\s+([^;}]+)/g;
const STRING_LITERAL = /(['"`])([^'"`]*)\1/g;

const problemIf = (condition, message) => (condition ? [message] : []);
const collapseSpaces = (text) => text.replace(/\s+/g, ' ').trim();
const classesOf = (element) => (element.attrs.class ?? '').split(/\s+/).filter(Boolean);
const valueAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const hasLetters = (text) => /\p{L}/u.test(text);
const toPosixPath = (path) => path.split(sep).join('/');

export function decodeEntities(text) {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, body) => {
    if (/^#[xX]/.test(body)) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return ENTITIES[body] ?? match;
  });
}

function endAfter(html, marker, from) {
  const found = html.indexOf(marker, from);
  return found === -1 ? html.length : found + marker.length;
}

function readAttributes(html, start) {
  const attrs = {};
  let position = start;
  for (;;) {
    ATTRIBUTE.lastIndex = position;
    const match = ATTRIBUTE.exec(html);
    if (!match) break;
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
    position = ATTRIBUTE.lastIndex;
  }
  return { attrs, end: endAfter(html, '>', position) };
}

function closeElement(open, tag) {
  for (let node = open; node.parent; node = node.parent) {
    if (node.tag === tag) return node.parent;
  }
  return open;
}

function appendText(parent, raw) {
  if (raw === '') return;
  parent.children.push({ text: decodeEntities(raw), parent });
}

function readRawText(html, element, start) {
  const closeStart = html.toLowerCase().indexOf(`</${element.tag}`, start);
  const contentEnd = closeStart === -1 ? html.length : closeStart;
  const content = html.slice(start, contentEnd);
  element.raw = content;
  if (element.tag === 'textarea' || element.tag === 'title') appendText(element, content);
  return endAfter(html, '>', contentEnd);
}

export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  const elements = [];
  let open = root;
  let position = 0;
  while (position < html.length) {
    const tagStart = html.indexOf('<', position);
    appendText(open, html.slice(position, tagStart === -1 ? html.length : tagStart));
    if (tagStart === -1) break;
    if (html.startsWith('<!--', tagStart)) {
      position = endAfter(html, '-->', tagStart);
      continue;
    }
    if (html[tagStart + 1] === '!' || html[tagStart + 1] === '?') {
      position = endAfter(html, '>', tagStart);
      continue;
    }
    if (html[tagStart + 1] === '/') {
      position = endAfter(html, '>', tagStart);
      open = closeElement(open, html.slice(tagStart + 2, position - 1).trim().toLowerCase());
      continue;
    }
    START_TAG.lastIndex = tagStart;
    const startTag = START_TAG.exec(html);
    if (!startTag) {
      appendText(open, '<');
      position = tagStart + 1;
      continue;
    }
    const { attrs, end } = readAttributes(html, START_TAG.lastIndex);
    const element = { tag: startTag[1].toLowerCase(), attrs, children: [], parent: open, index: elements.length };
    elements.push(element);
    open.children.push(element);
    position = end;
    if (VOID_ELEMENTS.has(element.tag) || html[end - 2] === '/') continue;
    if (RAW_TEXT_ELEMENTS.has(element.tag)) {
      position = readRawText(html, element, end);
      continue;
    }
    open = element;
  }
  return { root, elements };
}

export function textOf(node) {
  if (node.text !== undefined) return node.text;
  return node.children.map(textOf).join('');
}

function textNodesOf(node) {
  if (node.text !== undefined) return [collapseSpaces(node.text)].filter(Boolean);
  return node.children.flatMap(textNodesOf);
}

function isInside(element, ancestor) {
  for (let node = element.parent; node; node = node.parent) {
    if (node === ancestor) return true;
  }
  return false;
}

function describe(element) {
  const hook = element.attrs['data-sbr'];
  if (hook) return `<${element.tag} data-sbr="${hook}">`;
  return `<${element.tag}${element.attrs.class ? ` class="${element.attrs.class.slice(0, 40)}"` : ''}>`;
}

function pushCssStatement(nodes, buffer) {
  const statement = buffer.trim();
  if (statement === '') return;
  if (statement.startsWith('@')) return nodes.push({ statement });
  const colon = statement.indexOf(':');
  if (colon === -1) return;
  nodes.push({ property: statement.slice(0, colon).trim().toLowerCase(), value: statement.slice(colon + 1).trim() });
}

function parseCssBlock(text, start) {
  const nodes = [];
  let buffer = '';
  let parenDepth = 0;
  let quote = null;
  let position = start;
  while (position < text.length) {
    const char = text[position];
    position += 1;
    if (quote) {
      buffer += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth -= 1;
    const isStructural = parenDepth === 0 && quote === null && (char === '{' || char === '}' || char === ';');
    if (!isStructural) {
      buffer += char;
      continue;
    }
    if (char === '{') {
      const block = parseCssBlock(text, position);
      nodes.push({ prelude: buffer.trim(), children: block.nodes });
      position = block.end;
      buffer = '';
      continue;
    }
    pushCssStatement(nodes, buffer);
    buffer = '';
    if (char === '}') return { nodes, end: position };
  }
  pushCssStatement(nodes, buffer);
  return { nodes, end: position };
}

export function parseCss(css) {
  return parseCssBlock(css.replace(/\/\*[\s\S]*?\*\//g, ''), 0).nodes;
}

export function cssDeclarations(nodes, context = []) {
  return nodes.flatMap((node) => {
    if (node.children) return cssDeclarations(node.children, [...context, node.prelude]);
    return [{ ...node, context }];
  });
}

function utilityWithoutVariants(token) {
  let depth = 0;
  let utility = '';
  for (const char of token) {
    if (char === '[' || char === '(') depth += 1;
    if (char === ']' || char === ')') depth -= 1;
    utility = char === ':' && depth === 0 ? '' : utility + char;
  }
  return utility.replace(/^!|!$/g, '').replace(/^-/, '');
}

function spacingValueProblem(utility, spacingNames) {
  const prefix = SPACING_PREFIXES.find((candidate) => utility.startsWith(`${candidate}-`));
  if (!prefix) return null;
  const value = utility.slice(prefix.length + 1);
  if (spacingNames.includes(value) || SIZE_KEYWORDS.has(value) || /^\d+\/\d+$/.test(value)) return null;
  if (CONTAINER_PREFIXES.has(prefix) && (value === 'prose' || value === 'page')) return null;
  if (prefix.startsWith('space-') && value === 'reverse') return null;
  return 'is not one of the four spacing tokens';
}

function textUtilityProblem(value, vocabulary) {
  if (vocabulary.textStyles.has(value) || vocabulary.colorUtilities.has(`text-${value}`) || TEXT_KEYWORDS.has(value)) return null;
  if (value === 'justify') return { id: 'R10', reason: 'justifies text' };
  return { id: 'R14', reason: 'is not a text token' };
}

function borderUtilityProblem(value, vocabulary) {
  if (BORDER_SIDES.has(value) || BORDER_KEYWORDS.has(value)) return null;
  const color = BORDER_SIDES.has(value.split('-')[0]) ? value.split('-').slice(1).join('-') : value;
  if (vocabulary.colorUtilities.has(`border-${color}`)) return null;
  if (/^\d/.test(color)) return 'sets a border width outside --line-width';
  return 'is not a border token';
}

function roundedUtilityProblem(utility) {
  const parts = utility.split('-').slice(1);
  const name = ROUNDED_SIDES.has(parts[0]) ? parts.slice(1).join('-') : parts.join('-');
  return name === 'control' || name === 'card' ? null : 'is not a radius token';
}

function utilityProblem(utility, vocabulary) {
  const r14 = (reason) => (reason ? { id: 'R14', reason } : null);
  const [prefix, ...rest] = utility.split('-');
  const value = rest.join('-');
  if (prefix === 'text' && value) return textUtilityProblem(value, vocabulary);
  if (prefix === 'bg') return r14(vocabulary.colorUtilities.has(utility) ? null : 'is not one of bg-canvas, bg-surface and bg-accent');
  if (prefix === 'border' && value && !value.startsWith('spacing')) return r14(borderUtilityProblem(value, vocabulary));
  if (prefix === 'outline') return r14(OUTLINE_UTILITIES.has(utility) ? null : 'is outside the fixed focus ring');
  if (prefix === 'fill' && value) return r14(value === 'none' || vocabulary.colorUtilities.has(utility) ? null : 'is not a fill token');
  if (prefix === 'stroke' && value) return r14(value === 'none' || /^\d+$/.test(value) || vocabulary.colorUtilities.has(utility) ? null : 'is not a stroke token');
  if (prefix === 'accent' && value) return r14(vocabulary.colorUtilities.has(utility) ? null : 'is not accent-accent');
  if (prefix === 'font' && value) return r14(value === 'display' || value === 'body' ? null : 'is not font-display or font-body');
  if (prefix === 'shadow') return r14(utility === 'shadow-card' ? null : 'is not shadow-card');
  if (prefix === 'rounded') return r14(roundedUtilityProblem(utility));
  if (UNTOKENED_PREFIXES.includes(prefix) && (value || prefix === 'ring')) return r14('is not a token utility');
  if (prefix === 'transition') return TRANSITION_UTILITIES.has(utility) ? null : { id: 'R23', reason: 'animates more than opacity and transform' };
  if (prefix === 'animate') return utility === 'animate-none' ? null : { id: 'R23', reason: 'adds an animation' };
  return r14(spacingValueProblem(utility, vocabulary.spacingNames));
}

export function classTokenProblem(token, vocabulary, { onDecor = false, checkModifiers = true } = {}) {
  if (ARBITRARY_VALUE.test(token) || ARBITRARY_PROPERTY.test(token) || ARBITRARY_VARIANT.test(token)) {
    return { id: 'R14', reason: 'uses an arbitrary value in square brackets' };
  }
  const utility = utilityWithoutVariants(token);
  const slash = utility.lastIndexOf('/');
  const base = slash === -1 ? utility : utility.slice(0, slash);
  if (slash === -1 || !vocabulary.colorUtilities.has(base)) return utilityProblem(utility, vocabulary);
  if (checkModifiers && !onDecor) return { id: 'R14', reason: 'puts an opacity modifier on a color outside decor-1 and decor-2' };
  return null;
}

export function classVocabulary(contract) {
  const withoutVariant = (utility) => utility.split(':').at(-1);
  return {
    colorUtilities: new Set(contract.tokens.colors.flatMap((color) => color.utilities.map(withoutVariant))),
    textStyles: new Set(contract.tokens.text_styles.map((style) => style.name)),
    spacingNames: contract.tokens.spacing.order,
  };
}

function classProblemsOfPage(page, vocabulary) {
  return page.elements.flatMap((element) => {
    const onDecor = ['decor-1', 'decor-2'].includes(element.attrs['data-sbr']);
    return classesOf(element)
      .map((token) => ({ token, problem: classTokenProblem(token, vocabulary, { onDecor }) }))
      .filter(({ problem }) => problem)
      .map(({ token, problem }) => ({ id: problem.id, message: `class ${token} on ${describe(element)} ${problem.reason}` }));
  });
}

function stringLiteralsIn(expression) {
  return [...expression.matchAll(STRING_LITERAL)].map((match) => match[2]);
}

export function classListsInSource(source) {
  const fromAttributes = [...source.matchAll(CLASS_ATTRIBUTE)].flatMap((match) =>
    match[3] === undefined ? [match[1] ?? match[2]] : stringLiteralsIn(match[3]),
  );
  const fromConstants = [...source.matchAll(CLASS_CONSTANT)].map((match) => match[2]);
  const fromClassList = [...source.matchAll(CLASS_LIST_CALL)].flatMap((match) => stringLiteralsIn(match[1]));
  const fromApply = [...source.matchAll(APPLY_RULE)].map((match) => match[1]);
  return [...fromAttributes, ...fromConstants, ...fromClassList, ...fromApply];
}

function listFiles(folder, isIgnored, base = folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    const relativePath = toPosixPath(relative(base, path));
    if (isIgnored(relativePath, entry.name)) return [];
    if (entry.isDirectory()) return listFiles(path, isIgnored, base);
    return [relativePath];
  });
}

function classProblemsOfSource(projectDir, vocabulary) {
  const sourceDir = join(projectDir, 'src');
  const files = listFiles(sourceDir, (path, name) => name === 'data' || name === 'i18n' || SKELETON_IGNORED_NAMES.has(name));
  return files
    .filter((file) => SOURCE_EXTENSIONS.has(extname(file)))
    .flatMap((file) => {
      const tokens = classListsInSource(readFileSync(join(sourceDir, file), 'utf8')).flatMap((list) => list.split(/\s+/).filter(Boolean));
      return [...new Set(tokens)]
        .map((token) => ({ token, problem: classTokenProblem(token, vocabulary, { checkModifiers: false }) }))
        .filter(({ problem }) => problem)
        .map(({ token, problem }) => ({ id: problem.id, message: `class ${token} in src/${file} ${problem.reason}` }));
    });
}

function readLocalAsset(distDir, reference) {
  if (!reference || EXTERNAL_URL.test(reference) || reference.startsWith('data:')) return null;
  const path = join(distDir, reference.split(/[?#]/)[0].replace(/^\//, ''));
  return existsSync(path) && statSync(path).isFile() ? readFileSync(path, 'utf8') : null;
}

function readPage(distDir, contract) {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const { root, elements } = parseHtml(html);
  const withTag = (tag) => elements.filter((element) => element.tag === tag);
  const byHook = (name) => elements.filter((element) => element.attrs[contract.hook_attribute] === name);
  const linkedStyles = withTag('link')
    .filter((link) => (link.attrs.rel ?? '').split(/\s+/).includes('stylesheet'))
    .map((link) => readLocalAsset(distDir, link.attrs.href));
  const styles = [...withTag('style').map((style) => style.raw), ...linkedStyles].filter(Boolean);
  const inlineScripts = withTag('script').filter((script) => !script.attrs.src).map((script) => script.raw);
  const scriptFiles = listFiles(distDir, () => false).filter((file) => ['.js', '.mjs'].includes(extname(file)));
  return {
    distDir,
    html,
    root,
    elements,
    withTag,
    byHook,
    one: (name) => byHook(name)[0],
    body: withTag('body')[0],
    declarations: styles.flatMap((css) => cssDeclarations(parseCss(css))),
    scripts: [...inlineScripts, ...scriptFiles.map((file) => readFileSync(join(distDir, file), 'utf8'))].filter(Boolean),
  };
}

function expectedHookCount(hook, tokens) {
  if (hook.present_when) return tokens.decor === 'none' ? 0 : 1;
  return Math.max(1, hook.screens.length);
}

function hookPlacementProblems(hook, page, screenElements) {
  const found = page.byHook(hook.name);
  if (found.length === 0) return [];
  const isScreen = screenElements.some((screen) => found.includes(screen.element));
  const outsideScreen = hook.screens
    .filter((number) => !isScreen && found.filter((element) => isInside(element, screenElements[number - 1].element)).length !== 1)
    .map((number) => `${hook.name} must occur once inside screen ${number}`);
  const outsideParent = found
    .filter((element) => hook.inside && !page.byHook(hook.inside).some((parent) => isInside(element, parent)))
    .map(() => `${hook.name} must be inside ${hook.inside}`);
  return [
    ...found.filter((element) => element.tag !== hook.element).map((element) => `${hook.name} is a <${element.tag}>, must be a <${hook.element}>`),
    ...outsideScreen,
    ...outsideParent,
    ...problemIf(hook.hidden_until && found.some((element) => !('hidden' in element.attrs)), `${hook.name} must carry hidden in the built page`),
  ];
}

function anatomyProblems(page, tokens, contract) {
  const screens = contract.screens.map((screen) => ({ ...screen, element: page.one(screen.hook) }));
  const missingScreens = screens.filter((screen) => !screen.element).map((screen) => `${screen.hook} is missing`);
  if (!page.body || missingScreens.length) return [...problemIf(!page.body, 'the page has no <body>'), ...missingScreens];
  const knownHooks = new Set(contract.hooks.map((hook) => hook.name));
  const hookProblems = contract.hooks.flatMap((hook) => {
    const found = page.byHook(hook.name).length;
    const expected = expectedHookCount(hook, tokens);
    if (found !== expected) return [`${hook.name} occurs ${found} times, expected ${expected}`];
    return hookPlacementProblems(hook, page, screens);
  });
  const expectedAttributes = { 'data-composition': tokens.composition, 'data-scheme': tokens.scheme, 'data-decor': tokens.decor, 'data-screen': '1' };
  const debugPanel = page.one('debug-panel');
  return [
    ...hookProblems,
    ...page.elements
      .filter((element) => contract.hook_attribute in element.attrs && !knownHooks.has(element.attrs[contract.hook_attribute]))
      .map((element) => `${element.attrs[contract.hook_attribute]} is not a hook of the contract`),
    ...Object.entries(expectedAttributes)
      .filter(([name, value]) => page.body.attrs[name] !== value)
      .map(([name, value]) => `<body> ${name} is "${page.body.attrs[name] ?? ''}", expected "${value}"`),
    ...screens
      .filter((screen) => 'hidden' in screen.element.attrs !== (screen.number !== 1))
      .map((screen) => `${screen.hook} must ${screen.number === 1 ? 'be visible' : 'carry hidden'} in the built page`),
    ...problemIf(debugPanel && screens.some((screen) => isInside(debugPanel, screen.element)), 'debug-panel must be outside the screens'),
    ...contract.hooks
      .filter((hook) => hook.element === 'h2')
      .flatMap((hook) => page.byHook(hook.name))
      .filter((element) => element.attrs.tabindex !== '-1')
      .map((element) => `${describe(element)} must carry tabindex="-1"`),
    ...page.byHook('figure').filter((element) => element.attrs['aria-hidden'] !== 'true').map(() => 'figure must carry aria-hidden="true"'),
    ...NEVER_PRESENT_ELEMENTS.filter((tag) => page.withTag(tag).length).map((tag) => `<${tag}> never belongs in a landing`),
  ];
}

function singleActionProblems(page, contract) {
  const filledHooks = contract.hooks.filter((hook) => hook.filled);
  const filledNames = filledHooks.map((hook) => hook.name);
  const headings = page.withTag('h1');
  const strayInputs = page.withTag('input').filter((input) => BUTTON_LIKE_INPUT_TYPES.includes(input.attrs.type));
  return [
    ...problemIf(headings.length !== 1, `the page has ${headings.length} <h1>, expected one`),
    ...problemIf(headings.length === 1 && headings[0].attrs['data-sbr'] !== 'title', 'the <h1> is not the title hook'),
    ...[...page.withTag('button'), ...strayInputs]
      .filter((button) => !filledNames.includes(button.attrs['data-sbr']))
      .map((button) => `${describe(button)} is a button outside the contract`),
    ...filledHooks.flatMap((hook) =>
      page.byHook(hook.name).flatMap((button) => {
        const type = hook.text_while_sending ? 'submit' : 'button';
        const classes = classesOf(button);
        return [
          ...problemIf(!classes.includes('bg-accent') || !classes.includes('text-on-accent'), `${hook.name} is not filled with bg-accent and text-on-accent`),
          ...problemIf(button.attrs.type !== type, `${hook.name} must be type="${type}"`),
        ];
      }),
    ),
    ...NAVIGATION_ELEMENTS.filter((tag) => page.withTag(tag).length).map((tag) => `the page has <${tag}>: no menu and no links`),
  ];
}

function labelOf(page, field) {
  return page.withTag('label').find((label) => field.attrs.id && label.attrs.for === field.attrs.id);
}

function fieldProblems(field, element, page, copy) {
  const label = labelOf(page, element);
  const expected = {
    name: field.name,
    type: field.element === 'input' ? field.type : undefined,
    autocomplete: field.autocomplete,
    inputmode: field.inputmode,
    maxlength: field.maxlength === undefined ? undefined : String(field.maxlength),
    placeholder: field.placeholder ? valueAt(copy, field.placeholder) : undefined,
    ...field.attributes,
  };
  const wrongAttributes = Object.entries(expected)
    .filter(([name, value]) => value !== undefined && element.attrs[name] !== value)
    .map(([name, value]) => `${field.hook} ${name} is "${element.attrs[name] ?? ''}", expected "${value}"`);
  return [
    ...problemIf(element.tag !== field.element, `${field.hook} must be a <${field.element}>`),
    ...wrongAttributes,
    ...problemIf(field.required === true && !('required' in element.attrs), `${field.hook} must be required`),
    ...problemIf(field.required === false && 'required' in element.attrs, `${field.hook} must not be required`),
    ...problemIf(!label, `${field.hook} has no <label for>`),
    ...problemIf(label && collapseSpaces(textOf(label)) !== valueAt(copy, field.label), `the label of ${field.hook} does not show ${field.label}`),
    ...problemIf(label && ('hidden' in label.attrs || classesOf(label).includes('sr-only')), `the label of ${field.hook} is not visible`),
    ...problemIf(label && !classesOf(label).includes('text-label'), `the label of ${field.hook} is not in the label style`),
  ];
}

function formProblems(page, copy, contract) {
  const html = page.withTag('html')[0];
  return [
    ...problemIf(html?.attrs.lang !== copy.lang, `<html lang> is "${html?.attrs.lang ?? ''}", expected "${copy.lang}"`),
    ...contract.fields.flatMap((field) => {
      const element = page.one(field.hook);
      return element ? fieldProblems(field, element, page, copy) : [`${field.hook} is missing`];
    }),
  ];
}

function fieldTextProblems(page, contract) {
  return contract.fields
    .filter((field) => field.type !== 'checkbox')
    .map((field) => page.one(field.hook))
    .filter((element) => element && !classesOf(element).includes('text-body'))
    .map((element) => `${describe(element)} is not typed in the body style`);
}

function isSendingLabelPresent(page, copy, contract) {
  const keys = [...new Set(contract.hooks.map((hook) => hook.text_while_sending).filter(Boolean))];
  const haystack = [...page.elements.flatMap((element) => Object.values(element.attrs)), ...page.scripts];
  return keys.every((key) => haystack.some((text) => text.includes(valueAt(copy, key))));
}

function errorHooks(contract) {
  return contract.hooks.filter((hook) => hook.hidden_until === 'error');
}

function stateTextProblems(page, copy, contract) {
  const errors = errorHooks(contract).flatMap((hook) => {
    const element = page.one(hook.name);
    if (!element) return [`${hook.name} is missing`];
    return problemIf(collapseSpaces(textOf(element)) !== valueAt(copy, hook.text), `${hook.name} does not carry the text of ${hook.text}`);
  });
  return [...errors, ...problemIf(!isSendingLabelPresent(page, copy, contract), 'the sending state has no text from status.sending')];
}

function errorPlacementProblems(page, contract) {
  const orderOf = (name) => page.one(name)?.index;
  const submitOf = (form) => contract.hooks.find((hook) => hook.group === form.group && hook.text_while_sending);
  return errorHooks(contract).flatMap((hook) => {
    const element = page.one(hook.name);
    const form = contract.hooks.find((candidate) => candidate.group === hook.group && candidate.element === 'form');
    const formElement = page.one(form.name);
    if (!element || !formElement) return [`${hook.name} or ${form.name} is missing`];
    const fields = contract.fields.filter((field) => contract.hooks.find((candidate) => candidate.name === field.hook).group === hook.group);
    const lastField = Math.max(...fields.map((field) => orderOf(field.hook)));
    const submit = orderOf(submitOf(form).name);
    return [
      ...problemIf(element.attrs.role !== 'alert', `${hook.name} must carry role="alert"`),
      ...problemIf(!element.attrs.id, `${hook.name} needs an id for aria-describedby`),
      ...problemIf(!isInside(element, formElement), `${hook.name} must be inside ${form.name}`),
      ...problemIf(!(lastField < element.index && element.index < submit), `${hook.name} must sit after its fields and before the submit button`),
      ...problemIf(!('novalidate' in formElement.attrs), `${form.name} must carry novalidate`),
    ];
  });
}

function honestSubmitProblems(page, copy, contract) {
  const submits = contract.hooks.filter((hook) => hook.text_while_sending).flatMap((hook) => page.byHook(hook.name));
  return [
    ...submits.filter((button) => 'disabled' in button.attrs).map((button) => `${describe(button)} is disabled before any request starts`),
    ...problemIf(!isSendingLabelPresent(page, copy, contract), 'the submit buttons have no sending text from status.sending'),
  ];
}

function noticeProblems(page, copy) {
  const notice = page.one('notice');
  if (!notice) return ['notice is missing'];
  const classes = classesOf(notice);
  return [
    ...problemIf(collapseSpaces(textOf(notice)) !== copy.done.notice, 'notice does not show done.notice'),
    ...problemIf(!classes.includes('text-body'), 'notice is not in the body style'),
    ...problemIf(!classes.includes('text-ink'), 'notice is not drawn in ink'),
  ];
}

function privacyProblems(page, copy) {
  const privacy = page.one('privacy');
  const form = page.one('email-form');
  if (!privacy || !form) return ['privacy or email-form is missing'];
  return [
    ...problemIf(!isInside(privacy, form), 'privacy must be inside email-form, next to the email'),
    ...problemIf(collapseSpaces(textOf(privacy)) !== copy.email.privacy, 'privacy does not show email.privacy'),
    ...problemIf(!classesOf(privacy).includes('text-small'), 'privacy is not in the small style'),
  ];
}

function headProblems(page, copy, tokens) {
  const metaContent = (attribute, name) => page.withTag('meta').find((meta) => meta.attrs[attribute] === name)?.attrs.content;
  const title = page.withTag('title')[0];
  const expected = [
    ['<title>', title ? collapseSpaces(textOf(title)) : undefined, copy.meta.title],
    ['meta description', metaContent('name', 'description'), copy.meta.description],
    ['og:title', metaContent('property', 'og:title'), copy.meta.title],
    ['og:description', metaContent('property', 'og:description'), copy.meta.description],
    ['theme-color', metaContent('name', 'theme-color')?.toUpperCase(), tokens.color.canvas.toUpperCase()],
  ];
  return expected.filter(([, actual, wanted]) => actual !== wanted).map(([name, actual]) => `${name} is ${actual === undefined ? 'missing' : 'not the approved value'}`);
}

function zoomProblems(page) {
  const viewport = page.withTag('meta').find((meta) => meta.attrs.name === 'viewport')?.attrs.content;
  if (!viewport) return ['the page has no viewport meta'];
  const maximumScale = /maximum-scale\s*=\s*([\d.]+)/.exec(viewport);
  return [
    ...problemIf(!/width\s*=\s*device-width/.test(viewport), 'the viewport meta does not use width=device-width'),
    ...problemIf(/user-scalable\s*=\s*(no|0)/.test(viewport), 'the viewport meta blocks zoom with user-scalable'),
    ...problemIf(maximumScale !== null && Number(maximumScale[1]) < 2, 'the viewport meta blocks zoom with maximum-scale'),
  ];
}

function readingProblemsOfPage(page) {
  const balancedByRule = (tag) =>
    page.declarations.some(
      (declaration) =>
        declaration.property === 'text-wrap' &&
        declaration.value.includes('balance') &&
        declaration.context.some((prelude) => new RegExp(`(^|[\\s,>+~(])${tag}($|[\\s,.:#\\[>+~)])`).test(prelude)),
    );
  const isBalanced = (heading) =>
    classesOf(heading).includes('text-balance') || /text-wrap\s*:\s*balance/.test(heading.attrs.style ?? '') || balancedByRule(heading.tag);
  return [
    ...problemIf(
      page.declarations.some((declaration) => declaration.property === 'text-align' && declaration.value.includes('justify')),
      'the styles justify text',
    ),
    ...[...page.withTag('h1'), ...page.withTag('h2')].filter((heading) => !isBalanced(heading)).map((heading) => `${describe(heading)} is not balanced`),
  ];
}

function fontFileUrls(page) {
  const urls = page.declarations
    .filter((declaration) => declaration.property === 'src' && declaration.context.at(-1) === '@font-face')
    .flatMap((declaration) => [...declaration.value.matchAll(CSS_URL)].map((match) => match[2]));
  return [...new Set(urls)];
}

function fontServingProblems(page, contract) {
  const urls = fontFileUrls(page);
  const max = contract.tokens.fonts.family_weight_pairs_max;
  return [
    ...problemIf(urls.length === 0, 'the built page declares no @font-face: the families are not served'),
    ...urls.filter((url) => EXTERNAL_URL.test(url)).map((url) => `font ${url} is not served from the landing's own domain`),
    ...problemIf(urls.length > max, `the page loads ${urls.length} font files, the limit is ${max}`),
  ];
}

function transitionSegmentProblem(segment) {
  if (segment.includes('var(')) return null;
  const property = segment.split(/\s+/).find((part) => /^[a-z-]+$/i.test(part) && !TIMING_KEYWORDS.has(part));
  if (property === undefined) return 'a transition without a property animates everything';
  return TRANSITION_PROPERTIES.has(property) ? null : `a transition animates ${property}`;
}

function longestTimeMs(value) {
  const times = [...value.matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map((match) => Number(match[1]) * (match[2] === 's' ? 1000 : 1));
  return Math.max(0, ...times);
}

function motionProblems(page, maxDuration) {
  const { declarations } = page;
  const timed = ['transition', 'transition-duration', 'animation', 'animation-duration'];
  const properties = declarations
    .filter((declaration) => declaration.property === 'transition-property')
    .flatMap((declaration) => declaration.value.split(',').map((name) => name.trim()))
    .filter((name) => !name.includes('var(') && !TRANSITION_PROPERTIES.has(name))
    .map((name) => `a transition animates ${name}`);
  const shorthands = declarations
    .filter((declaration) => declaration.property === 'transition')
    .flatMap((declaration) => declaration.value.split(',').map((segment) => transitionSegmentProblem(segment.trim())))
    .filter(Boolean);
  const slow = declarations
    .filter((declaration) => timed.includes(declaration.property) && longestTimeMs(declaration.value) > maxDuration)
    .map((declaration) => `${declaration.property}: ${declaration.value} lasts more than ${maxDuration} ms`);
  const endless = declarations
    .filter((declaration) => ['animation', 'animation-iteration-count'].includes(declaration.property) && declaration.value.includes('infinite'))
    .map(() => 'an animation never ends');
  return [
    ...problemIf(!declarations.some((declaration) => declaration.context.some((prelude) => prelude.includes('prefers-reduced-motion'))), 'the styles have no prefers-reduced-motion rule'),
    ...new Set([...properties, ...shorthands, ...slow, ...endless]),
  ];
}

function gradientProblems(page) {
  return problemIf(
    page.declarations.some((declaration) => /gradient\(/i.test(declaration.value ?? '')),
    'the built styles use a gradient',
  );
}

function externalRequestProblems(page) {
  const attributeUrls = page.elements.flatMap((element) => {
    const isSilentLink = element.tag === 'link' && (element.attrs.rel ?? '').split(/\s+/).some((rel) => LINK_RELS_WITHOUT_REQUEST.includes(rel));
    const names = element.tag === 'link' && !isSilentLink ? ['href'] : (REQUEST_ATTRIBUTES[element.tag] ?? []);
    return names.flatMap((name) => (element.attrs[name] ?? '').split(',').map((part) => part.trim().split(/\s+/)[0]));
  });
  const styleUrls = page.declarations.flatMap((declaration) => {
    const text = declaration.statement ?? declaration.value;
    const quoted = declaration.statement?.startsWith('@import') ? stringLiteralsIn(text) : [];
    return [...[...text.matchAll(CSS_URL)].map((match) => match[2]), ...quoted];
  });
  const scriptUrls = page.scripts.flatMap((script) => script.match(URLS_IN_SCRIPT) ?? []).filter((url) => !NAMESPACE_URL.test(url));
  const external = [...attributeUrls, ...styleUrls].filter((url) => EXTERNAL_URL.test(url));
  return [...new Set([...external, ...scriptUrls])].map((url) => `the built page points at another domain: ${url}`);
}

function weightProblems(page) {
  const ownFiles = listFiles(page.distDir, () => false).filter((file) => ['.html', '.css', '.js', '.mjs'].includes(extname(file)));
  const bytes = ownFiles.reduce((total, file) => total + statSync(join(page.distDir, file)).size, 0);
  return problemIf(bytes > MAX_OWN_BYTES, `HTML, CSS and JavaScript weigh ${Math.ceil(bytes / 1024)} KB, the limit is ${MAX_OWN_BYTES / 1024} KB`);
}

function progressText(copy, current) {
  return copy.progress.replace('{current}', String(current)).replace('{total}', String(TOTAL_STEPS));
}

function containedStrings(hook, element, copy, page, contract) {
  const screen = contract.screens.find((candidate) => isInside(element, page.one(candidate.hook)));
  return hook.contains.flatMap((key) => {
    if (key === 'progress') return [progressText(copy, screen.number - 1)];
    if (key === 'questions.saved' && screen.name !== 'questions') return [];
    return [valueAt(copy, key)].flat();
  });
}

function hookTextProblems(page, copy, contract) {
  const direct = contract.hooks
    .filter((hook) => hook.text)
    .flatMap((hook) => page.byHook(hook.name).filter((element) => collapseSpaces(textOf(element)) !== valueAt(copy, hook.text)).map(() => `${hook.name} does not show exactly ${hook.text}`));
  const contained = contract.hooks
    .filter((hook) => hook.contains)
    .flatMap((hook) =>
      page.byHook(hook.name).flatMap((element) => {
        const shown = textNodesOf(element);
        return containedStrings(hook, element, copy, page, contract)
          .filter((text) => !shown.includes(text))
          .map((text) => `${hook.name} does not show "${text.slice(0, 40)}"`);
      }),
    );
  const lists = contract.copy.keys
    .filter((entry) => entry.type === 'list')
    .flatMap((entry) => {
      const list = page.one(entry.key);
      if (!list) return [];
      const items = list.children.filter((child) => child.tag === 'li').map((item) => collapseSpaces(textOf(item)));
      return problemIf(JSON.stringify(items) !== JSON.stringify(valueAt(copy, entry.key)), `${entry.key} does not list the items of the language file in order`);
    });
  return [...direct, ...contained, ...lists];
}

function strayTextProblems(page, copy, contract) {
  const fromCopy = contract.copy.keys.flatMap((entry) => [valueAt(copy, entry.key)].flat());
  const allowed = new Set([...fromCopy, progressText(copy, 1), progressText(copy, 2)]);
  const strayNodes = textNodesOf(page.body).filter((text) => hasLetters(text) && !allowed.has(text));
  const strayAttributes = page.elements.flatMap((element) =>
    TEXT_ATTRIBUTES.filter((name) => element.attrs[name] && !allowed.has(element.attrs[name])).map((name) => `${name}="${element.attrs[name]}"`),
  );
  return [...new Set([...strayNodes.map((text) => `"${text.slice(0, 40)}"`), ...strayAttributes])].map(
    (text) => `visible text ${text} does not come from the language file`,
  );
}

function isOutsideSkeleton(path, name, notCompared) {
  if (SKELETON_IGNORED_NAMES.has(name) || LOCKFILES.has(name) || /^\.env(\..+)?$/.test(name)) return true;
  return notCompared.some((prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix));
}

function skeletonProblems(projectDir, templateDir, contract) {
  const notCompared = contract.landing_files.not_compared_with_template.filter((entry) => entry !== 'lockfile');
  const isIgnored = (path, name) => isOutsideSkeleton(path, name, notCompared);
  const templateFiles = listFiles(templateDir, isIgnored);
  const projectFiles = new Set(listFiles(projectDir, isIgnored));
  const changed = templateFiles
    .filter((file) => projectFiles.has(file) && !readFileSync(join(projectDir, file)).equals(readFileSync(join(templateDir, file))))
    .map((file) => `${file} differs from the template`);
  return [
    ...templateFiles.filter((file) => !projectFiles.has(file)).map((file) => `${file} is missing`),
    ...changed,
    ...[...projectFiles].filter((file) => !templateFiles.includes(file)).map((file) => `${file} is not part of the template`),
  ];
}

function recordByRequirement(report, problems, passDetails) {
  Object.entries(passDetails).forEach(([id, passDetail]) => {
    const messages = problems.filter((problem) => problem.id === id).map((problem) => problem.message);
    record(report, id, [...new Set(messages)], passDetail);
  });
}

function checkPage({ page, project, templateDir, contract, report }) {
  const { tokens, copy, projectDir } = project;
  const vocabulary = classVocabulary(contract);
  const classProblems = [...classProblemsOfPage(page, vocabulary), ...classProblemsOfSource(projectDir, vocabulary)];
  const maxDuration = contract.tokens.measure.ranges.motion_duration[1];
  const anatomy = anatomyProblems(page, tokens, contract);
  record(report, 'R28', anatomy, 'the built page has the hooks and screens of the contract');
  if (anatomy.length) return PAGE_ROWS.forEach((id) => report.skip(id, 'the built page does not have the anatomy of the contract: see R28'));
  record(report, 'R1', singleActionProblems(page, contract), 'one h1, one filled button per screen, no menu and no links');
  record(report, 'R8', fieldTextProblems(page, contract), 'fields are typed in the body style');
  record(report, 'R16', stateTextProblems(page, copy, contract), 'errors and the sending state carry text');
  record(report, 'R17', zoomProblems(page), 'zoom is not blocked');
  record(report, 'R20', formProblems(page, copy, contract), 'fields have their label, type, autocomplete and inputmode; lang is set');
  record(report, 'R21', errorPlacementProblems(page, contract), 'errors are announced and sit next to their fields');
  record(report, 'R24', honestSubmitProblems(page, copy, contract), 'submit buttons start enabled and have a sending text');
  record(report, 'R25', noticeProblems(page, copy), 'the notice is on the final screen in the body style');
  record(report, 'R26', privacyProblems(page, copy), 'the privacy line sits next to the email');
  record(report, 'R29', [...externalRequestProblems(page), ...weightProblems(page)], 'nothing is requested from another domain and the page is under 100 KB');
  record(report, 'R30', headProblems(page, copy, tokens), 'title, description, og: tags and theme-color match the approved values');
  record(report, 'R32', [...hookTextProblems(page, copy, contract), ...strayTextProblems(page, copy, contract)], 'every visible text comes from the language file');
  record(report, 'R11', fontServingProblems(page, contract), 'fonts are served from the landing itself');
  record(report, 'R15', gradientProblems(page), 'the built styles have no gradient');
  recordByRequirement(report, [...classProblems, ...readingProblemsOfPage(page).map((message) => ({ id: 'R10', message })), ...motionProblems(page, maxDuration).map((message) => ({ id: 'R23', message }))], {
    R10: 'text is never justified and headings are balanced',
    R14: 'classes use only token utilities',
    R23: 'motion is reduced on request, limited to opacity and transform, and short',
  });
  if (!existsSync(templateDir)) return report.skip('R28', 'templates/landing/ is not in this copy of the plugin: the project was not compared with the template');
  record(report, 'R28', skeletonProblems(projectDir, templateDir, contract), 'the project is identical to the template outside src/data, src/i18n, vercel.json and the lockfile');
}

const PAGE_ROWS = ['R1', 'R8', 'R10', 'R11', 'R14', 'R15', 'R16', 'R17', 'R20', 'R21', 'R23', 'R24', 'R25', 'R26', 'R29', 'R30', 'R32'];

function readProject(projectDir, contract) {
  const isFolder = existsSync(projectDir) && statSync(projectDir).isDirectory();
  if (!isFolder) throw new UsageError(`${projectDir} is not a folder`);
  const languageDir = join(projectDir, 'src/i18n');
  const languageFiles = existsSync(languageDir) ? readdirSync(languageDir).filter((name) => name.endsWith('.json')).sort() : [];
  if (languageFiles.length === 0) throw new UsageError(`${projectDir} has no language file in src/i18n/`);
  const builtPage = join(projectDir, contract.landing_files.built_page);
  if (!existsSync(builtPage)) throw new UsageError(`${builtPage} does not exist: build the landing first`);
  return {
    projectDir,
    distDir: join(projectDir, contract.landing_files.build_output),
    tokens: readJson(join(projectDir, 'src/data/tokens.json'), 'tokens'),
    copy: readJson(join(languageDir, languageFiles[0]), 'copy'),
    locale: basename(languageFiles[0], '.json'),
    languageFiles,
  };
}

export function verifyLanding({ projectDir, templateDir = TEMPLATE_DIR, contract = loadContract() }) {
  const project = readProject(projectDir, contract);
  const report = createReport(contract, 'landing');
  checkDesign({ tokens: project.tokens, copy: project.copy, locale: project.locale, contract, report });
  if (project.languageFiles.length > 1) report.fail('R32', `src/i18n/ holds ${project.languageFiles.length} files, expected exactly one`);
  const hasDesignShape =
    tokenShapeProblems(project.tokens, contract.tokens).length === 0 &&
    copyShapeProblems(project.copy, contract.copy, project.locale).length === 0;
  if (!hasDesignShape) {
    [...PAGE_ROWS, 'R28'].forEach((id) => report.skip(id, 'the built page is not checked until tokens.json and the language file have the shape of the contract'));
    return report;
  }
  checkPage({ page: readPage(project.distDir, contract), project, templateDir, contract, report });
  return report;
}

function main(args) {
  if (args.length !== 1) throw new UsageError('usage: verify-landing.mjs <folder>');
  return printReport(verifyLanding({ projectDir: args[0] }));
}

if (isMainModule(import.meta.url)) runCli(main);
