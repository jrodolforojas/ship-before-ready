// A Claude Design frame clips at its height and nothing can be measured before publishing.
// Heights are therefore estimated: line counts come from Helvetica advance widths with
// pessimistic factors, because a frame that is too tall only adds canvas-colored space under
// the last block, while one that is too short cuts it. Each function in HEIGHTS mirrors the
// spacing of the template with the same name; change them together.

const HELVETICA_WIDTHS = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333,
  '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278, ':': 278, ';': 278, '<': 584, '=': 584,
  '>': 584, '?': 556, '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667,
  W: 944, X: 667, Y: 667, Z: 611, '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333, a: 556,
  b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556,
  o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584, '¿': 611, '¡': 333, '…': 1000, '–': 556, '—': 1000, '«': 556, '»': 556,
};
const DIGIT_WIDTH = 556;
const UNKNOWN_WIDTH = 600;
const MONOSPACE_WIDTH = 620;
const FAMILY_FACTOR = { 'sans-serif': 1.08, serif: 1 };
const BOLD_FACTOR = 1.06;
const BOLD_FROM = 600;
const CH_IN_EM = { 'sans-serif': 0.5, serif: 0.5, monospace: 0.6 };

const STYLE_ROLE = { title: 'display', heading: 'display', lead: 'body', body: 'body', small: 'body', button: 'body', label: 'body' };
const VIEWPORT_WIDTH = { phone: 390, desktop: 1440 };
const PHONE_SCREEN_HEIGHT = 844;
const FIGURE_RATIO = 9 / 16;
const TEXTAREA_ROWS = 3;
const FLOW_SCREENS = new Set(['email-phone', 'questions-phone', 'done-phone']);

const sum = (values) => values.reduce((total, value) => total + value, 0);
const stack = (heights, gap) => sum(heights) + gap * Math.max(heights.length - 1, 0);
const tallest = (heights) => Math.max(...heights);

const glyphWidth = (char) => {
  if (/[0-9]/.test(char)) return DIGIT_WIDTH;
  return HELVETICA_WIDTHS[char] ?? HELVETICA_WIDTHS[char.normalize('NFD')[0]] ?? UNKNOWN_WIDTH;
};

const createKit = (tokens, copy, viewport) => {
  const sizeKey = viewport === 'desktop' ? 'size_desktop' : 'size';
  const { section, block, group, item } = tokens.spacing;
  const line = tokens.shape.line_width;
  const pagePadding = viewport === 'desktop' ? block : group;
  const pageWidth = viewport === 'desktop' ? Math.min(tokens.measure.page, VIEWPORT_WIDTH.desktop) : VIEWPORT_WIDTH.phone;
  const width = pageWidth - 2 * pagePadding;

  const styleOf = (name) => {
    const style = tokens.text[name];
    return { size: style[sizeKey], lineHeight: style.line_height, weight: style.font_weight, tracking: style.letter_spacing, fallback: tokens.fonts[STYLE_ROLE[name]].fallback };
  };
  const emWidth = (char, style) => {
    if (style.fallback === 'monospace') return MONOSPACE_WIDTH / 1000;
    const bold = style.weight >= BOLD_FROM ? BOLD_FACTOR : 1;
    return (glyphWidth(char) / 1000) * FAMILY_FACTOR[style.fallback] * bold;
  };
  const inlineWidth = (value, name) => {
    const style = styleOf(name);
    return sum([...value].map((char) => (emWidth(char, style) + style.tracking) * style.size));
  };
  const lineCount = (value, name, available) => {
    const space = inlineWidth(' ', name);
    let lines = 1;
    let used = 0;
    for (const word of value.split(' ')) {
      const wordWidth = inlineWidth(word, name);
      if (used > 0 && used + space + wordWidth > available) {
        lines += 1;
        used = wordWidth;
        continue;
      }
      used += (used > 0 ? space : 0) + wordWidth;
    }
    return lines;
  };
  const lineBox = (name) => styleOf(name).size * styleOf(name).lineHeight;
  const text = (value, name, available) => lineCount(value, name, available) * lineBox(name);
  const prose = (name) => tokens.measure.prose * CH_IN_EM[styleOf(name).fallback] * styleOf(name).size;
  const figure = (figureWidth) => (tokens.decor === 'none' ? 0 : figureWidth * FIGURE_RATIO);

  return {
    copy, section, block, group, item, line, width, text, lineBox, prose, figure,
    figureWith: (gap, figureWidth) => (tokens.decor === 'none' ? 0 : gap + figure(figureWidth)),
    button: (label, available) => Math.max(block, text(label, 'button', available - 2 * group) + 2 * item),
    field: Math.max(block, lineBox('body') + 2 * item + 2 * line),
    textarea: TEXTAREA_ROWS * lineBox('body') + 2 * item + 2 * line,
    labeled: (label, control) => text(label, 'label', width) + item + control,
    card: (value, available) => 2 * line + 2 * group + text(value, 'body', available - 2 * group - 2 * line),
    rows: (values, available) => 2 * line + sum(values.map((value) => 2 * group + text(value, 'body', available - 2 * group - 2 * line))) + (values.length - 1) * line,
    brandRow: (step) => Math.max(text(copy.brand, 'button', width - group - inlineWidth(step, 'small')), lineBox('small')),
  };
};

const heroText = (kit, available, subtitleWidth) => kit.text(kit.copy.hero.title, 'title', available) + kit.item + kit.text(kit.copy.hero.subtitle, 'lead', subtitleWidth) + kit.group + kit.button(kit.copy.cta, available);
const proseOr = (kit, available, style) => Math.min(available, kit.prose(style));
const stackedFooter = (kit, available) => kit.line + kit.group + kit.text(kit.copy.footer.author, 'small', available) + kit.item + kit.text(kit.copy.footer.privacy, 'small', available) + kit.block;
const stepLabel = (kit) => kit.copy.progress.replace('{current}', '2').replace('{total}', '2');

const HEIGHTS = {
  'centered-phone': (kit) => {
    const { copy, block, group, line, width } = kit;
    const panel = width - 2 * group - 2 * line;
    return sum([
      group + kit.lineBox('button'),
      block + heroText(kit, width, proseOr(kit, width, 'lead')) + block,
      kit.figureWith(block, width),
      stack(copy.pains.map((pain) => kit.card(pain, width)), group) + block,
      stack(copy.steps.map((step) => Math.max(block, kit.text(step, 'body', width - block - group))), group) + block,
      2 * line + 2 * block + kit.text(copy.closing, 'heading', panel) + group + kit.button(copy.cta, panel) + block,
      stackedFooter(kit, width),
    ]);
  },
  'centered-desktop': (kit) => {
    const { copy, section, block, group, line, width } = kit;
    const painWidth = (width - (copy.pains.length - 1) * group) / copy.pains.length;
    const stepWidth = (width - 2 * group) / 3;
    const panel = width - 2 * section - 2 * line;
    return sum([
      group + kit.lineBox('button'),
      section + heroText(kit, width, proseOr(kit, width, 'lead')) + section,
      kit.figureWith(section, width / 2),
      tallest(copy.pains.map((pain) => kit.card(pain, painWidth))) + section,
      tallest(copy.steps.map((step) => block + group + kit.text(step, 'body', stepWidth))) + section,
      2 * line + 2 * section + kit.text(copy.closing, 'heading', panel) + group + kit.button(copy.cta, panel) + section,
      stackedFooter(kit, width),
    ]);
  },
  'split-phone': (kit) => {
    const { copy, block, group, item, line, width } = kit;
    return sum([
      group + kit.lineBox('button'),
      block + heroText(kit, width, proseOr(kit, width, 'lead')) + kit.figureWith(block, width) + block,
      kit.rows(copy.pains, width) + block,
      stack(copy.steps.map((step) => line + group + kit.lineBox('label') + item + kit.text(step, 'body', width)), group) + block,
      kit.text(copy.closing, 'heading', width) + group + kit.button(copy.cta, width) + block,
      stackedFooter(kit, width),
    ]);
  },
  'split-desktop': (kit) => {
    const { copy, section, block, group, item, line, width } = kit;
    const left = ((width - block) * 7) / 12;
    const right = ((width - block) * 5) / 12;
    const stepWidth = (width - 2 * block) / 3;
    return sum([
      group + kit.lineBox('button'),
      section + Math.max(heroText(kit, left, proseOr(kit, left, 'lead')), kit.figureWith(group, right) + kit.rows(copy.pains, right)) + section,
      tallest(copy.steps.map((step) => line + group + kit.lineBox('label') + item + kit.text(step, 'body', stepWidth))) + section,
      Math.max(kit.text(copy.closing, 'heading', left), kit.button(copy.cta, right)) + section,
      line + group + Math.max(kit.text(copy.footer.author, 'small', left), kit.text(copy.footer.privacy, 'small', right)) + block,
    ]);
  },
  'editorial-phone': (kit) => {
    const { copy, block, group, line, width } = kit;
    return sum([
      2 * group + kit.lineBox('button') + line,
      block + heroText(kit, width, width) + kit.figureWith(block, width) + block,
      line + block + stack(copy.pains.map((pain) => kit.text(pain, 'body', width)), group) + block,
      line + block + stack(copy.steps.map((step) => Math.max(kit.lineBox('heading'), kit.text(step, 'body', width - block - group))), group) + block,
      line + block + kit.text(copy.closing, 'heading', width) + group + kit.button(copy.cta, width) + block,
      stackedFooter(kit, width),
    ]);
  },
  'editorial-desktop': (kit) => {
    const { copy, section, block, group, line, width } = kit;
    const column = proseOr(kit, width, 'body');
    return sum([
      2 * group + kit.lineBox('button') + line,
      section + Math.max(heroText(kit, column, column), kit.figure(width / 4)) + section,
      line + section + stack(copy.pains.map((pain) => kit.text(pain, 'body', column)), group) + section,
      line + section + stack(copy.steps.map((step) => Math.max(kit.lineBox('heading'), kit.text(step, 'body', column - block - group))), group) + section,
      line + section + kit.text(copy.closing, 'heading', column) + group + kit.button(copy.cta, column) + section,
      stackedFooter(kit, column),
    ]);
  },
  'email-phone': (kit) => {
    const { copy, block, group, item, width } = kit;
    return sum([
      group + kit.brandRow(stepLabel(kit)),
      block + kit.text(copy.email.title, 'heading', width) + group,
      kit.labeled(copy.email.label, kit.field) + item + kit.text(copy.email.error, 'small', width) + item + kit.text(copy.email.privacy, 'small', width),
      group + kit.button(copy.email.submit, width) + block,
    ]);
  },
  'questions-phone': (kit) => {
    const { copy, block, group, item, width } = kit;
    const questions = copy.questions;
    return sum([
      group + kit.brandRow(stepLabel(kit)) + item + kit.text(questions.saved, 'small', width),
      block + kit.text(questions.title, 'heading', width) + group,
      kit.labeled(questions.current_solution, kit.textarea) + group,
      kit.labeled(questions.last_time, kit.textarea) + group,
      Math.max(block, kit.text(questions.wants_call, 'label', width - group - item)) + group,
      kit.labeled(questions.whatsapp, kit.field) + group,
      kit.labeled(questions.time_slot, kit.field) + group,
      kit.text(questions.error, 'small', width) + item + kit.button(questions.submit, width) + block,
    ]);
  },
  'done-phone': (kit) => {
    const { copy, section, block, group, width } = kit;
    return sum([
      section + kit.text(copy.done.title, 'heading', width) + group,
      kit.card(copy.done.notice, width) + group,
      kit.text(copy.done.next, 'body', width) + block,
    ]);
  },
};

export const frameSize = (template, tokens, copy) => {
  const viewport = template.endsWith('-desktop') ? 'desktop' : 'phone';
  const content = Math.ceil(HEIGHTS[template](createKit(tokens, copy, viewport)));
  const height = FLOW_SCREENS.has(template) ? Math.max(PHONE_SCREEN_HEIGHT, content) : content;
  return { width: VIEWPORT_WIDTH[viewport], height };
};
