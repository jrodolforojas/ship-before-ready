import { isInside, parseHtml, visibleTextOf } from './html.mjs';

const LENGTH_WITH_UNIT = /(?<![\w.-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|ex|ch|lh|rlh|vh|vw|vmin|vmax|dvh|dvw|svh|svw|lvh|lvw|pt|pc|cm|mm|q|in)\b/i;
const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
const PERCENT = /(-?\d*\.?\d+)%/g;
const VARIABLE = /var\(\s*(--[a-z0-9-]+)\s*\)/gi;
const MAX_DENOMINATOR = 12;
const FRACTION_TOLERANCE = 0.05;

const COLOR_PROPERTIES = new Set([
  'color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-color', 'fill', 'stroke', 'accent-color', 'text-decoration-color', 'caret-color',
]);
const COLOR_KEYWORDS = new Set(['transparent', 'currentcolor', 'none', 'inherit']);
const BORDER_SHORTHANDS = new Set(['border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-block', 'border-inline']);
const BORDER_KEYWORDS = new Set(['solid', 'dashed', 'dotted', 'none', '0']);
const TEXT_COMPANIONS = ['line-height', 'font-weight', 'letter-spacing'];
const EFFECT_PROPERTIES = new Set(['text-shadow', 'filter', 'backdrop-filter', 'mix-blend-mode', 'background-blend-mode', 'mask', 'mask-image']);
const MOTION_PROPERTY = /^(animation|transition)/;
const GRID_TEMPLATE = /^(none|repeat\(\s*\d+\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\))$/;
const GRID_PLACEMENT = /^(auto|\d+|span \d+ \/ span \d+|-?\d+ \/ -?\d+)$/;
const NAVIGATION_TAGS = new Set(['a', 'nav', 'area']);
const TEXT_ATTRIBUTES = ['aria-label', 'title', 'alt', 'placeholder'];
const FILLED_PADDING = 'var(--spacing-item) var(--spacing-group)';

const problem = (id, message) => ({ id, message });
const collapseSpaces = (text) => text.replace(/\s+/g, ' ').trim();
const hasLetters = (text) => /\p{L}/u.test(text);
const valueAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);

function splitDeclarations(style) {
  const declarations = [];
  let depth = 0;
  let buffer = '';
  for (const char of `${style};`) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char !== ';' || depth > 0) {
      buffer += char;
      continue;
    }
    const colon = buffer.indexOf(':');
    if (colon > 0) declarations.push([buffer.slice(0, colon).trim().toLowerCase(), buffer.slice(colon + 1).trim()]);
    buffer = '';
  }
  return declarations;
}

export function stylesOf(element) {
  return Object.fromEntries(splitDeclarations(element.attrs?.style ?? ''));
}

function tokenNames(contract) {
  const styles = contract.tokens.text_styles.map((style) => style.name);
  return {
    colors: contract.tokens.colors.map((color) => color.token),
    styles,
    familyOf: Object.fromEntries(contract.tokens.text_styles.map((style) => [style.name, style.family])),
    variables: new Set([
      ...contract.tokens.colors.map((color) => `--color-${color.token}`),
      ...contract.tokens.fonts.roles.map((role) => `--font-${role}`),
      ...styles.flatMap((style) => [`--text-${style}`, ...TEXT_COMPANIONS.map((companion) => `--text-${style}--${companion}`)]),
      ...contract.tokens.spacing.order.map((name) => `--spacing-${name}`),
      '--radius-control', '--radius-card', '--shadow-card', '--line-width', '--container-prose', '--container-page', '--motion-duration',
    ]),
  };
}

const variablesIn = (value) => [...value.matchAll(VARIABLE)].map((match) => match[1].toLowerCase());
const withoutVariables = (value) => value.replace(VARIABLE, ' ').trim();
const singleVariable = (value) => /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(value.trim())?.[1].toLowerCase() ?? null;

function isFraction(percent) {
  const share = percent / 100;
  for (let denominator = 1; denominator <= MAX_DENOMINATOR; denominator += 1) {
    const numerator = Math.round(share * denominator);
    if (Math.abs(numerator / denominator - share) * 100 <= FRACTION_TOLERANCE) return true;
  }
  return false;
}

function colorValueProblem(property, value) {
  const rest = withoutVariables(value).toLowerCase();
  if (rest === '' || COLOR_KEYWORDS.has(rest)) return null;
  return `${property}: ${value} is not a color token`;
}

function borderValueProblem(property, value) {
  const rest = withoutVariables(value).toLowerCase().split(/\s+/).filter(Boolean);
  if (rest.every((part) => BORDER_KEYWORDS.has(part))) return null;
  return `${property}: ${value} uses a width or color outside --line-width and the color tokens`;
}

function textStyleProblems(styles, names) {
  const size = styles['font-size'];
  const style = size ? singleVariable(size)?.replace(/^--text-/, '') : null;
  if (size && !names.styles.includes(style)) return [`font-size: ${size} is not one of the seven text styles`];
  return TEXT_COMPANIONS.filter((companion) => styles[companion] !== undefined || style)
    .filter((companion) => !style || singleVariable(styles[companion] ?? '') !== `--text-${style}--${companion}`)
    .map((companion) => (style ? `the ${style} style needs ${companion}: var(--text-${style}--${companion})` : `${companion} is set without a text style`));
}

function declarationProblems(property, value, names, onDrawing) {
  const unknown = variablesIn(value).filter((name) => !names.variables.has(name));
  if (unknown.length) return [problem('R14', `${property}: ${value} uses ${unknown.join(', ')}, which is not a token`)];
  if (/gradient\(/i.test(value)) return [problem('R15', `${property}: ${value} is a gradient`)];
  if (EFFECT_PROPERTIES.has(property) && !['none', 'normal'].includes(value)) return [problem('R15', `${property}: ${value} is an effect the system does not allow`)];
  if (MOTION_PROPERTY.test(property)) return [problem('R23', `${property} animates a board, which is a still image`)];
  if (property === 'text-align' && value.includes('justify')) return [problem('R10', 'text-align: justify')];
  if (property === 'font-family') return singleVariable(value)?.startsWith('--font-') ? [] : [problem('R11', `font-family: ${value} is not --font-display or --font-body`)];
  if (property === 'font-style' && value !== 'normal') return [problem('R11', `font-style: ${value}: only upright styles are served`)];
  if (property === 'stroke-width') return value === 'var(--line-width)' ? [] : [problem('R14', `stroke-width: ${value} is not --line-width`)];
  if (property === 'box-shadow') return ['none', 'var(--shadow-card)'].includes(value) ? [] : [problem('R14', `box-shadow: ${value} is not --shadow-card`)];
  if (property === 'opacity' && !onDrawing) return [problem('R14', 'opacity outside a figure')];
  if (/url\(/i.test(value)) return [problem('R14', `${property}: ${value} loads a file`)];
  if (COLOR_PROPERTIES.has(property)) return [colorValueProblem(property, value)].filter(Boolean).map((message) => problem('R14', message));
  if (BORDER_SHORTHANDS.has(property)) return [borderValueProblem(property, value)].filter(Boolean).map((message) => problem('R14', message));
  if (property === 'background') return [colorValueProblem(property, value)].filter(Boolean).map((message) => problem('R14', message));
  if (property.startsWith('grid-template') && !GRID_TEMPLATE.test(value)) return [problem('R14', `${property}: ${value}: use repeat(<n>, minmax(0, 1fr)) and spans`)];
  if (/^grid-(column|row)$/.test(property) && !GRID_PLACEMENT.test(value)) return [problem('R14', `${property}: ${value} is not a span or a line number`)];
  const rest = withoutVariables(value);
  if (LITERAL_COLOR.test(rest)) return [problem('R14', `${property}: ${value} writes a color by hand`)];
  if (LENGTH_WITH_UNIT.test(rest)) return [problem('R14', `${property}: ${value} writes a length by hand instead of a token`)];
  const looseFractions = [...rest.matchAll(PERCENT)].map((match) => Number(match[1])).filter((percent) => !isFraction(percent));
  if (looseFractions.length) return [problem('R14', `${property}: ${value} is not a fraction such as 1/2, 1/3 or 5/12`)];
  if (/^(font-weight|line-height|letter-spacing|font-size)$/.test(property) && !singleVariable(value)) return [problem('R14', `${property}: ${value} is not a text token`)];
  return [];
}

function styleProblems(element, names, onDrawing) {
  const styles = stylesOf(element);
  return [
    ...Object.entries(styles).flatMap(([property, value]) => declarationProblems(property, value, names, onDrawing)),
    ...textStyleProblems(styles, names).map((message) => problem('R14', message)),
  ];
}

function nearest(element, read, fallback) {
  for (let node = element; node && node.tag !== '#root'; node = node.parent) {
    const found = read(node);
    if (found) return found;
  }
  return fallback;
}

const tokenOfVariable = (value, prefix) => {
  const name = singleVariable(value ?? '');
  return name?.startsWith(prefix) ? name.slice(prefix.length) : null;
};

const BOARD_RESOLVER = {
  style: (node) => tokenOfVariable(stylesOf(node)['font-size'], '--text-'),
  color: (node) => tokenOfVariable(stylesOf(node).color, '--color-'),
  background: (node) => {
    const styles = stylesOf(node);
    return tokenOfVariable(styles['background-color'] ?? styles.background, '--color-');
  },
  family: (node) => tokenOfVariable(stylesOf(node)['font-family'], '--font-'),
};

const baseClasses = (node) => (node.attrs?.class ?? '').split(/\s+/).filter((token) => token && !token.includes(':'));

function pageResolver(contract) {
  const { styles, colors } = tokenNames(contract);
  const firstWithPrefix = (prefix, allowed) => (node) => {
    const found = baseClasses(node).find((token) => token.startsWith(prefix) && allowed.includes(token.slice(prefix.length)));
    return found ? found.slice(prefix.length) : null;
  };
  return {
    style: firstWithPrefix('text-', styles),
    color: firstWithPrefix('text-', colors),
    background: firstWithPrefix('bg-', colors),
    family: firstWithPrefix('font-', contract.tokens.fonts.roles),
  };
}

function textNodesIn(root) {
  const nodes = [];
  const walk = (node) => {
    if (node.text !== undefined) {
      const text = collapseSpaces(node.text);
      if (text) nodes.push({ text, element: node.parent });
      return;
    }
    if (node.attrs?.['aria-hidden'] === 'true' && !hasLetters(visibleTextOf({ ...node, attrs: {} }))) return;
    node.children.forEach(walk);
  };
  walk(root);
  return nodes;
}

function signatureOf(root, resolver) {
  return textNodesIn(root).map(({ text, element }) => ({
    text,
    style: nearest(element, resolver.style, 'body'),
    color: nearest(element, resolver.color, 'ink'),
    background: nearest(element, resolver.background, 'canvas'),
    family: nearest(element, resolver.family, 'body'),
  }));
}

export function readBoard(html, contract) {
  const { root, elements } = parseHtml(html);
  const screen = elements.find((element) => element.attrs[contract.hook_attribute] === contract.promise_board.root);
  return { root, elements, screen };
}

export const boardSignature = (board) => (board.screen ? signatureOf(board.screen, BOARD_RESOLVER) : []);

export function pageSignature(page, contract) {
  const screen = page.elements.find((element) => element.attrs[contract.hook_attribute] === contract.promise_board.root);
  return screen ? signatureOf(screen, pageResolver(contract)) : [];
}

const hooksOn = (elements, contract) => (name) => elements.filter((element) => element.attrs[contract.hook_attribute] === name);

function rootProblems(board, contract) {
  const topLevel = board.root.children.filter((child) => child.tag || collapseSpaces(child.text ?? ''));
  const single = topLevel.length === 1 && topLevel[0] === board.screen;
  return single ? [] : [problem('R28', `the board must be one <section data-sbr="${contract.promise_board.root}"> and nothing else`)];
}

function elementProblems(board, contract, figures) {
  const allowed = new Set(contract.promise_board.elements);
  const drawing = new Set(contract.promise_board.drawing_elements);
  return board.elements.flatMap((element) => {
    const onFigure = figures.some((figure) => figure === element || isInside(element, figure));
    if (NAVIGATION_TAGS.has(element.tag)) return [problem('R1', `<${element.tag}>: no menu and no links`)];
    if (!allowed.has(element.tag)) return [problem('R28', `<${element.tag}> does not belong on the free screen`)];
    if (drawing.has(element.tag) && !onFigure) return [problem('R28', `<${element.tag}> is drawn outside a figure`)];
    const handlers = Object.keys(element.attrs).filter((name) => name.startsWith('on'));
    return handlers.map((name) => problem('R28', `${name} on <${element.tag}>: boards carry no script`));
  });
}

function hookProblems(board, copy, contract) {
  const hooksOf = hooksOn(board.elements, contract);
  const screenHooks = contract.hooks.filter((hook) => hook.screens.includes(1));
  const known = new Set(screenHooks.map((hook) => hook.name));
  const counted = screenHooks.filter((hook) => !hook.repeatable).flatMap((hook) => {
    const found = hooksOf(hook.name);
    if (found.length !== 1) return [problem('R28', `${hook.name} occurs ${found.length} times, expected 1`)];
    const [element] = found;
    const wrongTag = element.tag === hook.element ? [] : [problem('R28', `${hook.name} is a <${element.tag}>, must be a <${hook.element}>`)];
    const text = hook.text && collapseSpaces(visibleTextOf(element)) !== valueAt(copy, hook.text) ? [problem('R32', `${hook.name} does not show exactly ${hook.text}`)] : [];
    return [...wrongTag, ...text];
  });
  const lists = ['pains', 'steps'].flatMap((key) => {
    const list = hooksOf(key)[0];
    if (!list) return [];
    const items = list.children.filter((child) => child.tag).map((item) => (item.tag === 'li' ? collapseSpaces(visibleTextOf(item)) : `<${item.tag}>`));
    return JSON.stringify(items) === JSON.stringify(copy[key]) ? [] : [problem('R32', `${key} does not list the items of the copy in order, one <li> each`)];
  });
  const footer = hooksOf('footer')[0];
  const footerTexts = footer ? textNodesIn(footer).map(({ text }) => text) : [];
  const footerProblems = footer && !['footer.author', 'footer.privacy'].every((key) => footerTexts.includes(valueAt(copy, key))) ? [problem('R32', 'footer does not show footer.author and footer.privacy')] : [];
  const figures = hooksOf('figure');
  const figureProblems = figures.flatMap((figure) => [
    ...(figure.tag === 'div' ? [] : [problem('R28', `figure is a <${figure.tag}>, must be a <div>`)]),
    ...(figure.attrs['aria-hidden'] === 'true' ? [] : [problem('R28', 'figure must carry aria-hidden="true"')]),
    ...(/[\p{L}\p{N}]/u.test(collapseSpaces(visibleTextOf({ ...figure, attrs: {} }))) ? [problem('R28', 'a figure holds text: text is never drawn on a figure')] : []),
  ]);
  const strangers = board.elements
    .filter((element) => contract.hook_attribute in element.attrs && !known.has(element.attrs[contract.hook_attribute]))
    .map((element) => problem('R28', `${element.attrs[contract.hook_attribute]} is not a hook of the promise screen`));
  return [...counted, ...lists, ...footerProblems, ...figureProblems, ...strangers];
}

function actionProblems(board, contract) {
  const filled = ['cta', 'cta-closing'];
  const buttons = board.elements.filter((element) => element.tag === 'button');
  const hookOf = (element) => element.attrs[contract.hook_attribute];
  const isFilled = (element) => {
    const styles = stylesOf(element);
    return tokenOfVariable(styles['background-color'] ?? styles.background, '--color-') === 'accent' && tokenOfVariable(styles.color, '--color-') === 'on-accent';
  };
  const accentPanels = board.elements.filter((element) => !filled.includes(hookOf(element)) && BOARD_RESOLVER.background(element) === 'accent' && hasLetters(visibleTextOf(element)));
  return [
    ...board.elements.filter((element) => element.tag === 'h1' && hookOf(element) !== 'title').map(() => problem('R1', 'an <h1> that is not the title: the page has one h1')),
    ...board.elements.filter((element) => element.tag === 'h2' && hookOf(element) !== 'closing').map(() => problem('R1', 'an <h2> that is not closing: the free screen has no other titles')),
    ...buttons.filter((button) => !filled.includes(hookOf(button))).map(() => problem('R1', 'a button other than cta and cta-closing')),
    ...buttons.filter((button) => filled.includes(hookOf(button)) && !isFilled(button)).map((button) => problem('R1', `${hookOf(button)} is not filled with accent and on-accent`)),
    ...buttons.filter((button) => filled.includes(hookOf(button)) && button.attrs.type !== 'button').map((button) => problem('R1', `${hookOf(button)} must be type="button"`)),
    ...buttons
      .filter((button) => filled.includes(hookOf(button)) && ![undefined, FILLED_PADDING].includes(stylesOf(button).padding))
      .map((button) => problem('R14', `${hookOf(button)} has padding: ${stylesOf(button).padding}; the filled button keeps ${FILLED_PADDING}`)),
    ...accentPanels.map(() => problem('R1', 'text on an accent fill reads as a second filled button')),
  ];
}

function hierarchyProblems(board, signature, contract, names) {
  const hooksOf = hooksOn(board.elements, contract);
  const allowedFor = contract.promise_board.hook_styles;
  const owner = (element) => Object.keys(allowedFor).find((hook) => hooksOf(hook).some((found) => found === element || isInside(element, found)));
  const texts = textNodesIn(board.screen ?? board.root);
  const misplaced = texts.flatMap(({ text, element }, index) => {
    const { style, color, family } = signature[index];
    const hook = owner(element);
    const problems = [];
    if (style === 'title' && hook !== 'title') problems.push(problem('R5', `"${text.slice(0, 30)}" uses the title style, which only the title uses`));
    if (hook && hasLetters(text) && !allowedFor[hook].includes(style)) problems.push(problem('R5', `${hook} is drawn in ${style}; it may use ${allowedFor[hook].join(', ')}`));
    if (hook === 'title' && color !== 'ink') problems.push(problem('R5', `the title is drawn in ${color}: it carries the strongest color, ink`));
    if (family !== names.familyOf[style]) problems.push(problem('R11', `"${text.slice(0, 30)}" uses the ${family} family; the ${style} style is set in ${names.familyOf[style]}`));
    return problems;
  });
  const headings = board.elements.filter((element) => ['h1', 'h2'].includes(element.tag) && stylesOf(element)['text-wrap'] !== 'balance');
  return [...misplaced, ...headings.map((heading) => problem('R10', `<${heading.tag}> needs text-wrap: balance`))];
}

function pairProblems(signature, contract) {
  const pairs = new Set(contract.promise_board.text_pairs.map(([foreground, background]) => `${foreground}/${background}`));
  return [...new Set(signature.filter(({ color, background }) => !pairs.has(`${color}/${background}`)).map(({ color, background }) => `${color} text on ${background}`))].map((pair) =>
    problem('R12', `${pair} is not an allowed pair: ink and ink-muted go on canvas or surface, on-accent on accent`),
  );
}

function strayTextProblems(board, signature, copy, contract) {
  const allowed = new Set(contract.promise_board.copy_keys.flatMap((key) => [valueAt(copy, key)].flat()));
  const stray = signature.filter(({ text }) => hasLetters(text) && !allowed.has(text)).map(({ text }) => problem('R32', `"${text.slice(0, 40)}" does not come from the copy`));
  const attributes = board.elements.flatMap((element) =>
    TEXT_ATTRIBUTES.filter((name) => element.attrs[name] && !allowed.has(element.attrs[name])).map((name) => problem('R32', `${name}="${element.attrs[name].slice(0, 40)}" does not come from the copy`)),
  );
  return [...stray, ...attributes];
}

export function boardProblems(board, { copy, contract }) {
  const names = tokenNames(contract);
  if (!board.screen) return [problem('R28', `no <section data-sbr="${contract.promise_board.root}">`)];
  const figures = hooksOn(board.elements, contract)('figure');
  const signature = boardSignature(board);
  return [
    ...rootProblems(board, contract),
    ...elementProblems(board, contract, figures),
    ...hookProblems(board, copy, contract),
    ...actionProblems(board, contract),
    ...board.elements.flatMap((element) => styleProblems(element, names, figures.some((figure) => figure === element || isInside(element, figure)))),
    ...hierarchyProblems(board, signature, contract, names),
    ...pairProblems(signature, contract),
    ...strayTextProblems(board, signature, copy, contract),
  ];
}

const describeEntry = (entry) => (entry ? `"${entry.text.slice(0, 30)}" in ${entry.style}, ${entry.color} on ${entry.background}` : 'nothing');

export function signatureDifference(expected, actual) {
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    const [first, second] = [expected[index], actual[index]];
    if (JSON.stringify(first) !== JSON.stringify(second)) return { position: index + 1, expected: describeEntry(first), actual: describeEntry(second) };
  }
  return null;
}

export function boardsProblems({ phone, desktop }, { copy, contract }) {
  const own = [
    ...boardProblems(phone, { copy, contract }).map((found) => ({ ...found, message: `phone board: ${found.message}` })),
    ...boardProblems(desktop, { copy, contract }).map((found) => ({ ...found, message: `desktop board: ${found.message}` })),
  ];
  const difference = signatureDifference(boardSignature(phone), boardSignature(desktop));
  if (!difference) return own;
  return [...own, problem('R28', `the phone and desktop boards differ at text ${difference.position}: ${difference.expected} on the phone, ${difference.actual} on desktop`)];
}

function layoutOf(element) {
  const styles = stylesOf(element);
  return [styles.display ?? 'block', styles['flex-direction'] ?? '', styles['grid-template-columns'] ?? ''].join(' ').trim();
}

export function boardStructure(board, contract) {
  if (!board.screen) return '';
  const hooksInside = (element) =>
    board.elements
      .filter((candidate) => (candidate === element || isInside(candidate, element)) && contract.hook_attribute in candidate.attrs)
      .map((candidate) => candidate.attrs[contract.hook_attribute])
      .filter((hook) => hook !== 'figure');
  const title = board.elements.find((element) => element.attrs[contract.hook_attribute] === 'title');
  const align = title ? nearest(title, (node) => stylesOf(node)['text-align'], 'start') : '';
  const blocks = board.screen.children.filter((child) => child.tag).map((child) => `${layoutOf(child)}[${hooksInside(child).sort().join(',')}]`);
  const backgrounds = boardSignature(board).map(({ style, background }) => `${style}/${background}`);
  return JSON.stringify({ align, blocks, backgrounds });
}
