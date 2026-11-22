const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const START_TAG = /<([a-zA-Z][^\s/>]*)/y;
const ATTRIBUTE = /\s*([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/y;

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

const isAriaHidden = (node) => node.attrs?.['aria-hidden'] === 'true';

export function visibleTextOf(node) {
  if (node.text !== undefined) return node.text;
  if (isAriaHidden(node)) return '';
  return node.children.map(visibleTextOf).join('');
}

export function isInside(element, ancestor) {
  for (let node = element.parent; node; node = node.parent) {
    if (node === ancestor) return true;
  }
  return false;
}
