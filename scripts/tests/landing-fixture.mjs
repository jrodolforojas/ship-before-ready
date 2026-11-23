import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, contract, exampleCopy, neutralTokens, tempDir, writeFiles } from './helpers.mjs';

const ROOT_FONT_SIZE_PX = 16;
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const FILLED_BUTTON = `inline-flex touch-target items-center justify-center rounded-control bg-accent px-group py-item font-body text-button text-on-accent transition-opacity hover:opacity-90 ${FOCUS_RING}`;
const CONTROL = `touch-target w-full rounded-control border border-line bg-surface px-group py-item font-body text-body text-ink placeholder:text-ink-muted ${FOCUS_RING} aria-invalid:border-danger`;
const SCREEN = 'mx-auto flex form-column flex-col gap-block px-group py-block';

const valueAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const SOURCE_VALUES = contract.url_params.find((param) => param.name === 'src').values;
const rem = (px) => `${Number((px / ROOT_FONT_SIZE_PX).toFixed(4))}rem`;

export function escapeHtml(text) {
  return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

const FORMATTERS = {
  hex: (value) => value,
  font_stack: ({ family, fallback }) => `"${family}", ${fallback}`,
  rem,
  number: (value) => String(value),
  em: (value) => `${value}em`,
  px: (value) => `${value}px`,
  ch: (value) => `${value}ch`,
  ms: (value) => `${value}ms`,
  shadow: ({ x, y, blur, opacity }) => `${x}px ${y}px ${blur}px rgb(0 0 0 / ${opacity})`,
};

export function tokenStyles(tokens) {
  const { variables } = contract.tokens;
  const declare = (pathKey) => (entry) => `${entry.variable}:${FORMATTERS[entry.format](valueAt(tokens, entry[pathKey]))}`;
  const fontFaces = Object.values(tokens.fonts)
    .flatMap(({ family, weights }) => weights.map((weight) => ({ family, weight })))
    .map(({ family, weight }) => {
      const file = `./_astro/fonts/${family.toLowerCase().replaceAll(' ', '-')}-${weight}.woff2`;
      return `@font-face{font-family:"${family}";src:url("${file}") format("woff2");font-weight:${weight};font-style:normal;font-display:swap}`;
    });
  return [
    ...new Set(fontFaces),
    `:root{${variables.map(declare('path')).join(';')}}`,
    `@media (min-width:48rem){:root{${variables.filter((entry) => entry.path_desktop).map(declare('path_desktop')).join(';')}}}`,
  ].join('');
}

const TEXT_STYLE_RULES = contract.tokens.text_styles
  .map(({ name }) => `.text-${name}{font-size:var(--text-${name});line-height:var(--text-${name}--line-height);font-weight:var(--text-${name}--font-weight);letter-spacing:var(--text-${name}--letter-spacing)}`)
  .join('');

const SPACING_RULES = contract.tokens.spacing.order
  .map((name) => `.gap-${name}{gap:var(--spacing-${name})}.p-${name}{padding:var(--spacing-${name})}.px-${name}{padding-inline:var(--spacing-${name})}.py-${name}{padding-block:var(--spacing-${name})}.pt-${name}{padding-top:var(--spacing-${name})}.size-${name}{width:var(--spacing-${name});height:var(--spacing-${name})}`)
  .join('');

export const PAGE_CSS = `*,::before,::after{box-sizing:border-box;margin:0;padding:0;border:0 solid}
html{-webkit-text-size-adjust:100%}
ul,ol{list-style:none}
button,input,textarea{font:inherit;color:inherit;background-color:transparent}
button{cursor:pointer}
[hidden]{display:none!important}
.flex{display:flex}.inline-flex{display:inline-flex}.flex-col{flex-direction:column}.grow{flex-grow:1}.shrink-0{flex-shrink:0}
.items-center{align-items:center}.justify-center{justify-content:center}.text-center{text-align:center}.text-balance{text-wrap:balance}
.mx-auto{margin-inline:auto}.w-full{width:100%}.min-h-dvh{min-height:100dvh}
.max-w-prose{max-width:var(--container-prose)}.max-w-page{max-width:var(--container-page)}
.bg-canvas{background-color:var(--color-canvas)}.bg-surface{background-color:var(--color-surface)}.bg-accent{background-color:var(--color-accent)}
.text-ink{color:var(--color-ink)}.text-ink-muted{color:var(--color-ink-muted)}.text-on-accent{color:var(--color-on-accent)}.text-danger{color:var(--color-danger)}
.placeholder\\:text-ink-muted::placeholder{color:var(--color-ink-muted)}
.font-display{font-family:var(--font-display)}.font-body{font-family:var(--font-body)}
${TEXT_STYLE_RULES}
${SPACING_RULES}
.rounded-control{border-radius:var(--radius-control)}.rounded-card{border-radius:var(--radius-card)}
.border{border-width:var(--line-width)}.border-t{border-top-width:var(--line-width)}.border-line{border-color:var(--color-line)}
.aria-invalid\\:border-danger[aria-invalid="true"]{border-color:var(--color-danger)}
.shadow-card{box-shadow:var(--shadow-card)}
.accent-accent{accent-color:var(--color-accent)}
.touch-target{min-block-size:2.75rem;min-inline-size:2.75rem}
.form-column{inline-size:100%;max-inline-size:28rem}
.transition-opacity{transition-property:opacity;transition-duration:var(--motion-duration)}
.hover\\:opacity-90:hover{opacity:.9}
.focus-visible\\:outline-2:focus-visible{outline-style:solid;outline-width:2px}
.focus-visible\\:outline-offset-2:focus-visible{outline-offset:2px}
.focus-visible\\:outline-focus:focus-visible{outline-color:var(--color-focus)}
@media (prefers-reduced-motion:reduce){*,::before,::after{transition-duration:0s!important;animation-duration:0s!important}}
@media (min-width:48rem){.md\\:gap-section{gap:var(--spacing-section)}}
`;

export const PAGE_SCRIPT = `const one = (hook, root = document) => root.querySelector('[data-sbr="' + hook + '"]');
const screens = ['screen-promise', 'screen-email', 'screen-questions', 'screen-done'].map((hook) => one(hook));
const titles = ['title', 'email-title', 'questions-title', 'done-title'].map((hook) => one(hook));
const params = new URLSearchParams(location.search);

function show(number) {
  screens.forEach((screen, index) => { screen.hidden = index !== number - 1; });
  document.body.dataset.screen = String(number);
  titles[number - 1].focus();
  window.scrollTo(0, 0);
}

function submit(formHook, errorHook, next) {
  const form = one(formHook);
  const error = one(errorHook);
  const button = form.querySelector('button');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = [...form.querySelectorAll('input, textarea')];
    fields.forEach((field) => { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); });
    const invalid = fields.filter((field) => !field.checkValidity());
    error.hidden = invalid.length === 0;
    if (invalid.length) {
      invalid.forEach((field) => { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', error.id); });
      invalid[0].focus();
      return;
    }
    const label = button.textContent;
    button.textContent = button.dataset.sendingLabel;
    button.disabled = true;
    queueMicrotask(() => { button.textContent = label; button.disabled = false; show(next); });
  });
}

one('cta').addEventListener('click', () => show(2));
one('cta-closing').addEventListener('click', () => show(2));
submit('email-form', 'email-error', 3);
submit('questions-form', 'questions-error', 4);
one('field-wants-call').addEventListener('change', (event) => {
  one('call-group').hidden = !event.target.checked;
  one('field-whatsapp').required = event.target.checked;
});
if (params.get('debug') === '1') one('debug-panel').hidden = false;
if (['2', '3', '4'].includes(params.get('screen'))) show(Number(params.get('screen')));
`;

function filledButton(hook, label, type = 'button', sendingLabel) {
  const sending = sendingLabel ? ` data-sending-label="${escapeHtml(sendingLabel)}"` : '';
  return `<button data-sbr="${hook}" type="${type}"${sending} class="${FILLED_BUTTON}">${escapeHtml(label)}</button>`;
}

function fieldAttributes(field, copy) {
  const attributes = {
    name: field.name,
    type: field.element === 'input' ? field.type : undefined,
    required: field.required === true ? '' : undefined,
    autocomplete: field.autocomplete,
    inputmode: field.inputmode,
    maxlength: field.maxlength,
    placeholder: field.placeholder ? valueAt(copy, field.placeholder) : undefined,
    ...field.attributes,
  };
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => (value === '' ? name : `${name}="${escapeHtml(value)}"`))
    .join(' ');
}

function textField(hook, copy, after = '') {
  const field = contract.fields.find((candidate) => candidate.hook === hook);
  const close = field.element === 'textarea' ? '></textarea>' : '>';
  return `<div class="flex flex-col gap-item"><label for="${hook}" class="font-body text-label text-ink-muted">${escapeHtml(valueAt(copy, field.label))}</label><${field.element} data-sbr="${hook}" id="${hook}" ${fieldAttributes(field, copy)} class="${CONTROL}"${close}${after}</div>`;
}

function progress(copy, current, savedNote) {
  const step = copy.progress.replace('{current}', String(current)).replace('{total}', '2');
  const saved = savedNote ? `<p class="font-body text-small text-ink-muted">${escapeHtml(savedNote)}</p>` : '';
  return `<div data-sbr="progress" class="flex flex-col gap-item"><p data-sbr="brand" class="font-body text-button text-ink">${escapeHtml(copy.brand)}</p><p class="font-body text-small text-ink-muted">${escapeHtml(step)}</p>${saved}</div>`;
}

function screenTitle(hook, text) {
  return `<h2 data-sbr="${hook}" id="${hook}" tabindex="-1" class="font-display text-heading text-balance text-ink ${FOCUS_RING}">${escapeHtml(text)}</h2>`;
}

function errorLine(hook, text) {
  return `<p data-sbr="${hook}" id="${hook}" role="alert" hidden class="font-body text-small text-danger">${escapeHtml(text)}</p>`;
}

function promiseScreen(copy) {
  const item = (text) => `<li class="rounded-card border border-line bg-surface p-group font-body text-body text-ink shadow-card">${escapeHtml(text)}</li>`;
  return `<section data-sbr="screen-promise" aria-labelledby="title" class="mx-auto flex w-full max-w-page flex-col gap-block px-group md:gap-section">
<header class="flex justify-center pt-group"><p data-sbr="brand" class="font-body text-button text-ink">${escapeHtml(copy.brand)}</p></header>
<div class="flex flex-col items-center gap-group text-center"><div class="flex flex-col items-center gap-item"><h1 data-sbr="title" id="title" tabindex="-1" class="font-display text-title text-balance text-ink">${escapeHtml(copy.hero.title)}</h1><p data-sbr="subtitle" class="max-w-prose font-body text-lead text-ink-muted">${escapeHtml(copy.hero.subtitle)}</p></div>${filledButton('cta', copy.cta)}</div>
<ul data-sbr="pains" class="mx-auto flex w-full max-w-prose flex-col gap-group">${copy.pains.map(item).join('')}</ul>
<ol data-sbr="steps" class="mx-auto flex w-full max-w-prose flex-col gap-group">${copy.steps.map(item).join('')}</ol>
<div class="flex flex-col items-center gap-group text-center"><h2 data-sbr="closing" tabindex="-1" class="font-display text-heading text-balance text-ink">${escapeHtml(copy.closing)}</h2>${filledButton('cta-closing', copy.cta)}</div>
<footer data-sbr="footer" class="flex flex-col items-center gap-item border-t border-line py-block text-center font-body text-small text-ink-muted"><p>${escapeHtml(copy.footer.author)}</p><p>${escapeHtml(copy.footer.privacy)}</p></footer>
</section>`;
}

function emailScreen(copy) {
  return `<section data-sbr="screen-email" aria-labelledby="email-title" hidden class="${SCREEN}">
${progress(copy, 1)}
${screenTitle('email-title', copy.email.title)}
<form data-sbr="email-form" novalidate class="flex flex-col gap-group">
${textField('email-field', copy, errorLine('email-error', copy.email.error))}
<p data-sbr="privacy" class="font-body text-small text-ink-muted">${escapeHtml(copy.email.privacy)}</p>
${filledButton('email-submit', copy.email.submit, 'submit', copy.status.sending)}
</form>
</section>`;
}

function questionsScreen(copy) {
  return `<section data-sbr="screen-questions" aria-labelledby="questions-title" hidden class="${SCREEN}">
${progress(copy, 2, copy.questions.saved)}
${screenTitle('questions-title', copy.questions.title)}
<form data-sbr="questions-form" novalidate class="flex flex-col gap-group">
${textField('field-current-solution', copy)}
${textField('field-last-time', copy)}
<div class="flex items-center gap-item"><input data-sbr="field-wants-call" id="field-wants-call" name="wants_call" type="checkbox" class="size-group shrink-0 accent-accent ${FOCUS_RING}"><label for="field-wants-call" class="flex touch-target grow items-center font-body text-label text-ink-muted">${escapeHtml(copy.questions.wants_call)}</label></div>
<div data-sbr="call-group" hidden class="flex flex-col gap-group">
${textField('field-whatsapp', copy)}
${textField('field-time-slot', copy)}
</div>
${errorLine('questions-error', copy.questions.error)}
${filledButton('questions-submit', copy.questions.submit, 'submit', copy.status.sending)}
</form>
</section>`;
}

function doneScreen(copy) {
  return `<section data-sbr="screen-done" aria-labelledby="done-title" hidden class="${SCREEN}">
${screenTitle('done-title', copy.done.title)}
<p data-sbr="notice" class="font-body text-body text-ink">${escapeHtml(copy.done.notice)}</p>
<p data-sbr="next-steps" class="font-body text-body text-ink">${escapeHtml(copy.done.next)}</p>
</section>`;
}

export function renderPage({ tokens = neutralTokens(), copy = exampleCopy() } = {}) {
  return `<!doctype html>
<html lang="${escapeHtml(copy.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(copy.meta.title)}</title>
<meta name="description" content="${escapeHtml(copy.meta.description)}">
<meta property="og:title" content="${escapeHtml(copy.meta.title)}">
<meta property="og:description" content="${escapeHtml(copy.meta.description)}">
<meta name="theme-color" content="${tokens.color.canvas}">
<link rel="icon" href="data:,">
<style>${tokenStyles(tokens)}</style>
<link rel="stylesheet" href="./_astro/index.css">
</head>
<body data-sbr="page" data-scheme="${tokens.scheme}" data-screen="1" class="flex min-h-dvh flex-col bg-canvas font-body text-body text-ink">
<main class="grow">
${promiseScreen(copy)}
${emailScreen(copy)}
${questionsScreen(copy)}
${doneScreen(copy)}
</main>
<aside data-sbr="debug-panel" hidden class="border-t border-line bg-surface p-group font-body text-small text-ink-muted"><ol class="flex flex-col gap-item"></ol></aside>
<script defer src="./_astro/flow.js"></script>
</body>
</html>
`;
}

export const SKELETON_FILES = {
  'package.json': { name: 'landing', private: true, type: 'module', scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' } },
  'astro.config.mjs': "export default { output: 'static' };\n",
  'src/styles/global.css': '@import "tailwindcss";\n@theme { --*: initial; }\n',
  'src/layouts/Base.astro': '<html><body data-sbr="page" class="bg-canvas font-body text-body text-ink"><slot /></body></html>\n',
  'src/pages/index.astro': '<main class="grow"><slot /></main>\n',
  'src/components/Brand.astro': `<p data-sbr="brand" class="font-body text-button text-ink">{copy.brand}</p>\n`,
  'src/components/Field.astro': `---\nconst controlClasses = '${CONTROL}';\n---\n<input class={controlClasses} />\n`,
  'src/scripts/flow.ts': "export const show = (button: HTMLElement) => button.classList.toggle('opacity-60');\n",
  'src/scripts/events.ts': `export const SOURCES = ${JSON.stringify(SOURCE_VALUES)};\n`,
};

export function writeTemplate(root = tempDir('sbr-template-'), files = {}) {
  return writeFiles(root, { ...SKELETON_FILES, 'bun.lock': 'template lock\n', ...files });
}

const PLUGIN_FILES_OF_THE_LANDING_VERIFIER = ['scripts/html.mjs', 'scripts/outline.mjs', 'scripts/promise-board.mjs', 'scripts/verify-design.mjs', 'scripts/verify-landing.mjs', 'templates/contract.json'];

export function landingVerifierWithFixtureTemplate() {
  const pluginRoot = tempDir('sbr-plugin-');
  writeTemplate(join(pluginRoot, 'templates/landing'));
  writeFiles(pluginRoot, Object.fromEntries(PLUGIN_FILES_OF_THE_LANDING_VERIFIER.map((path) => [path, readFileSync(join(REPO_ROOT, path))])));
  return join(pluginRoot, 'scripts/verify-landing.mjs');
}

export function builtFiles({ tokens = neutralTokens(), copy = exampleCopy(), html, css = PAGE_CSS, script = PAGE_SCRIPT } = {}) {
  return {
    'dist/index.html': html ?? renderPage({ tokens, copy }),
    'dist/_astro/index.css': css,
    'dist/_astro/flow.js': script,
  };
}

export const PROMISE_SOURCE = `<section data-sbr="screen-promise" class="flex flex-col gap-block px-group md:gap-section">
  <h1 data-sbr="title" id="title" class="font-display text-title text-balance text-ink">{copy.hero.title}</h1>
</section>
`;

export function writeLanding({ tokens = neutralTokens(), copy = exampleCopy(), html, css, script, files = {} } = {}) {
  return writeFiles(tempDir('sbr-landing-'), {
    ...SKELETON_FILES,
    'bun.lock': 'builder lock\n',
    'src/data/tokens.json': tokens,
    [`src/i18n/${copy.lang}.json`]: copy,
    'src/promise/Promise.astro': PROMISE_SOURCE,
    ...builtFiles({ tokens, copy, html, css, script }),
    ...files,
  });
}

export const distPage = (projectDir) => join(projectDir, 'dist/index.html');
