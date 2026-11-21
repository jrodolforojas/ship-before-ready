import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CHECKED_BY } from '../verify-design.mjs';
import {
  classListsInSource,
  classTokenProblem,
  classVocabulary,
  cssDeclarations,
  decodeEntities,
  parseCss,
  parseHtml,
  textOf,
  verifyLanding,
} from '../verify-landing.mjs';
import { SCRIPTS, contract, exampleCopy, idsWithStatus, neutralTokens, rowOf, runScript, tempDir, withChange, writeFiles } from './helpers.mjs';
import {
  PAGE_CSS,
  PAGE_SCRIPT,
  SKELETON_FILES,
  builtFiles,
  landingVerifierWithFixtureTemplate,
  renderPage,
  writeLanding,
  writeTemplate,
} from './landing-fixture.mjs';

const LANDING_ROWS = contract.requirement_ids.filter((id) => CHECKED_BY[id].includes('landing'));
const templateDir = writeTemplate();
const vocabulary = classVocabulary(contract);

const verify = (options) => verifyLanding({ projectDir: writeLanding(options), templateDir }).rows();
const failuresOf = (options) => idsWithStatus(verify(options), 'fail');
const page = (edit) => edit(renderPage());
const replaceOnce = (text, from, to) => {
  assert.ok(text.includes(from), `fixture no longer contains ${from}`);
  return text.replace(from, to);
};
const edited = (from, to) => ({ html: page((html) => replaceOnce(html, from, to)) });
const withCss = (extra) => ({ css: `${PAGE_CSS}${extra}` });

const PAGE_DEFECTS = [
  { name: 'a second h1', ids: ['R1'], ...edited('</main>', '<h1 class="font-display text-title text-balance text-ink"></h1></main>') },
  { name: 'a link out of the page', ids: ['R1'], ...edited('</main>', '<a href="https://example.com"></a></main>') },
  { name: 'a button that is not filled', ids: ['R1'], ...edited('data-sbr="cta" type="button" class="inline-flex touch-target items-center justify-center rounded-control bg-accent', 'data-sbr="cta" type="button" class="inline-flex touch-target items-center justify-center rounded-control bg-surface') },
  { name: 'a field typed in small text', ids: ['R8'], ...edited('data-sbr="email-field" id="email-field" name="email" type="email" required autocomplete="email" inputmode="email" maxlength="254" placeholder="tu@correo.com" spellcheck="false" autocapitalize="none" autocorrect="off" class="touch-target w-full rounded-control border border-line bg-surface px-group py-item font-body text-body', 'data-sbr="email-field" id="email-field" name="email" type="email" required autocomplete="email" inputmode="email" maxlength="254" placeholder="tu@correo.com" spellcheck="false" autocapitalize="none" autocorrect="off" class="touch-target w-full rounded-control border border-line bg-surface px-group py-item font-body text-small') },
  { name: 'a justified paragraph class', ids: ['R10'], ...edited('data-sbr="subtitle" class="max-w-prose', 'data-sbr="subtitle" class="text-justify max-w-prose') },
  { name: 'justified text in the styles', ids: ['R10'], ...withCss('.prose{text-align:justify}') },
  { name: 'a heading that is not balanced', ids: ['R10'], ...edited('id="email-title" tabindex="-1" class="font-display text-heading text-balance', 'id="email-title" tabindex="-1" class="font-display text-heading') },
  { name: 'a font from another domain', ids: ['R11', 'R29'], ...edited('url("./_astro/fonts/public-sans-700.woff2")', 'url("https://fonts.gstatic.com/s/publicsans/v1/a.woff2")') },
  { name: 'an arbitrary value', ids: ['R14'], ...edited('data-sbr="subtitle" class="max-w-prose', 'data-sbr="subtitle" class="text-[13px] max-w-prose') },
  { name: 'a default palette color', ids: ['R14'], ...edited('data-sbr="subtitle" class="max-w-prose', 'data-sbr="subtitle" class="bg-red-500 max-w-prose') },
  { name: 'a numeric border width', ids: ['R14'], ...edited('data-sbr="subtitle" class="max-w-prose', 'data-sbr="subtitle" class="border-2 max-w-prose') },
  { name: 'a spacing value outside the four tokens', ids: ['R14'], ...edited('data-sbr="subtitle" class="max-w-prose', 'data-sbr="subtitle" class="p-4 max-w-prose') },
  { name: 'accent as a text color', ids: ['R14'], ...edited('data-sbr="subtitle" class="max-w-prose', 'data-sbr="subtitle" class="text-accent max-w-prose') },
  { name: 'an opacity modifier outside decor', ids: ['R14'], ...edited('data-sbr="subtitle" class="max-w-prose', 'data-sbr="subtitle" class="bg-accent/50 max-w-prose') },
  { name: 'a gradient', ids: ['R15'], ...withCss('.hero{background-image:linear-gradient(#fff,#000)}') },
  { name: 'an error without its text', ids: ['R16', 'R32'], ...edited('No pudimos guardar tu correo. Revisa que esté bien escrito e inténtalo de nuevo.</p>', '</p>') },
  { name: 'a blocked zoom', ids: ['R17'], ...edited('width=device-width, initial-scale=1', 'width=device-width, initial-scale=1, user-scalable=no') },
  { name: 'an email field of type text', ids: ['R20'], ...edited('name="email" type="email"', 'name="email" type="text"') },
  { name: 'a field without its label', ids: ['R20'], ...edited('<label for="email-field"', '<label for="another-field"') },
  { name: 'a page without lang', ids: ['R20'], ...edited('<html lang="es">', '<html>') },
  { name: 'an error that is not announced', ids: ['R21'], ...edited('data-sbr="email-error" id="email-error" role="alert"', 'data-sbr="email-error" id="email-error"') },
  { name: 'a form with browser validation', ids: ['R21'], ...edited('data-sbr="email-form" novalidate', 'data-sbr="email-form"') },
  { name: 'a transition on everything', ids: ['R23'], ...withCss('.card{transition:all .2s ease}') },
  { name: 'a slow endless animation', ids: ['R23'], ...withCss('.dot{animation:pulse 2s infinite}') },
  { name: 'a transition utility on everything', ids: ['R23'], ...edited('data-sbr="subtitle" class="max-w-prose', 'data-sbr="subtitle" class="transition-all max-w-prose') },
  { name: 'no reduced-motion rule', ids: ['R23'], css: PAGE_CSS.replace(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\}\}/, '') },
  { name: 'a submit button disabled from the start', ids: ['R24'], ...edited('data-sbr="email-submit" type="submit"', 'data-sbr="email-submit" disabled type="submit"') },
  { name: 'a notice in small text', ids: ['R25'], ...edited('data-sbr="notice" class="font-body text-body text-ink"', 'data-sbr="notice" class="font-body text-small text-ink"') },
  { name: 'a script from another domain', ids: ['R29'], ...edited('<script defer src="./_astro/flow.js">', '<script src="https://cdn.example.com/widget.js"></script><script defer src="./_astro/flow.js">') },
  { name: 'a request to another domain from the script', ids: ['R29'], script: `${PAGE_SCRIPT}fetch('https://us.i.posthog.com/i/v0/e/');` },
  { name: 'more than 100 KB of own code', ids: ['R29'], script: `${PAGE_SCRIPT}// ${'x'.repeat(101 * 1024)}` },
  { name: 'a theme-color that is not the canvas', ids: ['R30'], ...edited('name="theme-color" content="#FAFAFA"', 'name="theme-color" content="#FFFFFF"') },
  { name: 'no og:title', ids: ['R30'], ...edited('<meta property="og:title"', '<meta property="og:name"') },
  { name: 'a phrase written in a component', ids: ['R32'], ...edited('<p data-sbr="next-steps"', '<p class="font-body text-small text-ink-muted">Hecho con cariño</p><p data-sbr="next-steps"') },
  { name: 'a placeholder written in a component', ids: ['R20', 'R32'], ...edited('placeholder="tu@correo.com"', 'placeholder="Escribe aquí"') },
];

test('the fixture landing passes every requirement the landing verifier checks', () => {
  const rows = verify();
  assert.deepEqual(rows.map((row) => row.id), contract.requirement_ids);
  assert.deepEqual(idsWithStatus(rows, 'fail'), []);
  assert.deepEqual(idsWithStatus(rows, 'pass'), LANDING_ROWS);
});

for (const defect of PAGE_DEFECTS) {
  test(`page defect: ${defect.name} fails ${defect.ids.join(' and ')}`, () => {
    assert.deepEqual(failuresOf(defect), defect.ids);
  });
}

test('a design defect is caught on the project files too', () => {
  assert.deepEqual(failuresOf({ tokens: withChange(neutralTokens(), 'color.ink_muted', '#9A9A9A') }), ['R12']);
  assert.deepEqual(failuresOf({ copy: withChange(exampleCopy(), 'hero.title', 'x'.repeat(90)) }), ['R2']);
});

test('a page built from other copy fails R32', () => {
  const html = renderPage({ copy: withChange(exampleCopy(), 'hero.title', 'Otro titular.') });
  assert.deepEqual(failuresOf({ html }), ['R32']);
});

test('a broken anatomy fails R28 and leaves the page rows unchecked', () => {
  const cases = [
    edited('<p data-sbr="next-steps" class="font-body text-body text-ink">', '<p class="font-body text-body text-ink">'),
    edited('data-sbr="screen-email" aria-labelledby="email-title" hidden', 'data-sbr="screen-email" aria-labelledby="email-title"'),
    edited('<p data-sbr="notice"', '<p data-sbr="banner"'),
    edited('data-screen="1"', 'data-screen="2"'),
    edited('</main>', '<video></video></main>'),
  ];
  for (const options of cases) {
    const rows = verify(options);
    assert.deepEqual(idsWithStatus(rows, 'fail'), ['R28']);
    assert.equal(rowOf(rows, 'R1').status, 'skip');
  }
});

test('decor adds the figure and its two motifs', () => {
  const tokens = withChange(neutralTokens(), 'decor', 'shapes');
  assert.deepEqual(failuresOf({ tokens }), []);
  assert.deepEqual(failuresOf({ tokens, html: renderPage() }), ['R28']);
});

test('an opacity modifier is allowed on decor only', () => {
  const tokens = withChange(neutralTokens(), 'decor', 'shapes');
  const html = renderPage({ tokens }).replace('<div data-sbr="decor-1">', '<div data-sbr="decor-1" class="bg-accent/50">');
  assert.deepEqual(failuresOf({ tokens, html }), []);
});

test('the skeleton must be identical to the template', () => {
  const changed = { 'src/components/Hero.astro': '<h1 data-sbr="title" class="font-display text-title text-ink">{copy.hero.title}</h1>\n' };
  const rowsWithChange = verify({ files: changed });
  assert.deepEqual(idsWithStatus(rowsWithChange, 'fail'), ['R28']);
  assert.match(rowOf(rowsWithChange, 'R28').detail, /src\/components\/Hero\.astro differs from the template/);
  const rowsWithExtra = verify({ files: { 'src/styles/custom.css': '.mine{color:red}' } });
  assert.match(rowOf(rowsWithExtra, 'R28').detail, /src\/styles\/custom\.css is not part of the template/);
});

test('files that change per builder are not compared with the template', () => {
  const files = {
    'vercel.json': { rewrites: [] },
    'src/data/config.json': { posthog_key: 'phc_test', capture_path: '/relay/e' },
    'package-lock.json': '{}',
    'node_modules/astro/package.json': '{}',
    '.vercel/project.json': '{}',
  };
  assert.deepEqual(failuresOf({ files }), []);
});

test('without the template in the plugin R28 is skipped, not passed', () => {
  const rows = verifyLanding({ projectDir: writeLanding(), templateDir: `${tempDir()}/missing` }).rows();
  assert.equal(rowOf(rows, 'R28').status, 'skip');
  assert.deepEqual(idsWithStatus(rows, 'fail'), []);
});

test('classes are checked in the sources as well as in the built page', () => {
  const source = { 'src/components/Hero.astro': '<h1 data-sbr="title" class="font-display text-title text-balance text-ink leading-tight">{copy.hero.title}</h1>\n' };
  const rows = verifyLanding({ projectDir: writeLanding({ files: source }), templateDir: writeTemplate(undefined, source) }).rows();
  assert.deepEqual(idsWithStatus(rows, 'fail'), ['R14']);
  assert.match(rowOf(rows, 'R14').detail, /class leading-tight in src\/components\/Hero\.astro/);
});

test('two language files fail R32', () => {
  const rows = verify({ files: { 'src/i18n/pt-BR.json': exampleCopy() } });
  assert.deepEqual(idsWithStatus(rows, 'fail'), ['R32']);
});

test('token utilities pass and values outside the system fail', () => {
  const allowed = [
    'bg-canvas', 'text-ink-muted', 'placeholder:text-ink-muted', 'text-title', 'text-balance', 'font-display', 'border', 'border-t', 'border-line',
    'aria-invalid:border-danger', 'border-t-line', 'rounded-control', 'rounded-t-card', 'shadow-card', 'py-section', 'md:py-section', '-mt-item',
    'gap-x-group', 'size-block', 'max-w-prose', 'max-w-page', 'w-full', 'w-1/2', 'min-h-dvh', 'mx-auto', 'focus-visible:outline-2',
    'focus-visible:outline-offset-2', 'outline-focus', 'transition-opacity', 'transition-transform', 'accent-accent', 'fill-accent', 'stroke-line',
    'flex', 'grid-cols-2', 'opacity-0', 'hover:opacity-90', 'sr-only', 'touch-target', 'form-column', 'dock-bottom', 'z-10', 'items-start',
  ];
  const forbidden = [
    'text-[13px]', 'bg-[#fff]', '[mask-type:luminance]', 'data-[state=open]:flex', 'text-accent', 'text-canvas', 'text-xl', 'text-gray-500', 'bg-white',
    'bg-red-500', 'bg-gradient-to-r', 'border-2', 'border-t-4', 'border-gray-200', 'outline-none', 'outline-4', 'duration-200', 'delay-150', 'ease-in',
    'leading-tight', 'tracking-wide', 'font-bold', 'font-sans', 'rounded-lg', 'rounded-full', 'shadow-md', 'p-4', 'mt-8', 'gap-6', 'max-w-md', 'inset-0',
    'ring-2', 'bg-accent/50', 'text-ink/70', 'transition', 'transition-all', 'animate-spin', 'text-justify',
  ];
  assert.deepEqual(allowed.filter((token) => classTokenProblem(token, vocabulary)), []);
  assert.deepEqual(forbidden.filter((token) => !classTokenProblem(token, vocabulary)), []);
});

test('class lists are read from attributes, constants, classList calls and @apply', () => {
  const source = `<p class="a b" class:list={['c', cond && "d"]}></p>
const controlClasses = 'e f';
button.classList.toggle('g');
.card { @apply h i; }
const selector = '[data-sbr="title"]';`;
  const tokens = new Set(classListsInSource(source).flatMap((list) => list.split(/\s+/)));
  assert.deepEqual([...tokens].sort(), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
});

test('the HTML reader handles attributes, entities, void and raw-text elements', () => {
  const { root, elements } = parseHtml('<!doctype html><p class="a b" hidden data-x=1>Uno &amp; dos<br>tres</p><script>if (a < b) {}</script><textarea>&lt;x&gt;</textarea><!-- <i> -->');
  const [paragraph, lineBreak, script, textarea] = elements;
  assert.deepEqual(paragraph.attrs, { class: 'a b', hidden: '', 'data-x': '1' });
  assert.equal(textOf(paragraph), 'Uno & dostres');
  assert.equal(lineBreak.parent, paragraph);
  assert.equal(script.raw, 'if (a < b) {}');
  assert.equal(textOf(textarea), '<x>');
  assert.equal(elements.length, 4);
  assert.equal(textOf(root), 'Uno & dostres<x>');
  assert.equal(decodeEntities('&#191;Qu&#xE9;?&nbsp;&copy;'), '¿Qué? &copy;');
});

test('the CSS reader keeps the context of nested rules and survives data URLs', () => {
  const css = '@import url("a.css");@media (min-width:48rem){.a{&:hover{color:red}}}.b{background:url(data:image/svg+xml;base64,AA==);margin:0}/* x */';
  const declarations = cssDeclarations(parseCss(css));
  assert.deepEqual(declarations, [
    { statement: '@import url("a.css")', context: [] },
    { property: 'color', value: 'red', context: ['@media (min-width:48rem)', '.a', '&:hover'] },
    { property: 'background', value: 'url(data:image/svg+xml;base64,AA==)', context: ['.b'] },
    { property: 'margin', value: '0', context: ['.b'] },
  ]);
});

test('the command exits 0 on the fixture, 1 on a failure and 2 on a folder it cannot check', () => {
  const command = landingVerifierWithFixtureTemplate();
  const passing = runScript(command, [writeLanding()]);
  assert.equal(passing.code, 0, passing.stdout);
  assert.equal(passing.rows.length, 32);
  assert.equal(rowOf(passing.rows, 'R28').status, 'pass');
  const failing = runScript(command, [writeLanding(edited('name="theme-color" content="#FAFAFA"', 'name="theme-color" content="#000000"'))]);
  assert.equal(failing.code, 1);
  assert.deepEqual(idsWithStatus(failing.rows, 'fail'), ['R30']);
  assert.equal(runScript(command, []).code, 2);
  assert.equal(runScript(command, [`${tempDir()}/missing`]).code, 2);
  const notBuilt = runScript(command, [writeTemplate(undefined, { 'src/data/tokens.json': neutralTokens(), 'src/i18n/es.json': exampleCopy() })]);
  assert.equal(notBuilt.code, 2);
  assert.match(notBuilt.stderr, /build the landing first/);
});

test('a copy made by copy-template.mjs --example, with the fixture page as its build, passes R28 against the real template until a component changes', () => {
  const projectDir = join(tempDir(), 'landing');
  const copied = runScript(SCRIPTS.copyTemplate, [projectDir, '--example']);
  assert.equal(copied.code, 0, copied.stderr);
  writeFiles(projectDir, builtFiles());
  const verified = runScript(SCRIPTS.landing, [projectDir]);
  assert.equal(verified.code, 0, verified.stdout);
  assert.equal(rowOf(verified.rows, 'R28').status, 'pass');

  appendFileSync(join(projectDir, 'src/components/Hero.astro'), '\n');
  const changed = runScript(SCRIPTS.landing, [projectDir]);
  assert.deepEqual(idsWithStatus(changed.rows, 'fail'), ['R28']);
  assert.match(rowOf(changed.rows, 'R28').detail, /src\/components\/Hero\.astro differs from the template/);
});

test('the fixture skeleton stays free of per-builder files', () => {
  assert.ok(Object.keys(SKELETON_FILES).every((path) => !path.startsWith('src/data/') && !path.startsWith('src/i18n/')));
});
