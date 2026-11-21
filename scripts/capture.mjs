#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import {
  EXIT_CODES,
  UsageError,
  contrastOfLuminances,
  createReport,
  formatRatio,
  isMainModule,
  loadContract,
  printReport,
  record,
  relativeLuminance,
  runCli,
} from './verify-design.mjs';

const CHROME_PATHS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};
const CHROME_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
const CHROME_FLAGS = ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio'];
const START_TIMEOUT_MS = 20000;
const COMMAND_TIMEOUT_MS = 30000;
const SETTLE_MS = 450;
const FLOW_TIMEOUT_MS = 4000;
const TAB_KEY = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
const MIN_TARGET_PX = 44;
const MIN_TARGET_GAP_PX = 8;
const MIN_FOCUS_RING_PX = 2;
const LARGE_TEXT_PX = 24;
const CONTRAST_LARGE = 3;
const CONTRAST_TEXT = 4.5;
const FORM_WIDTH_PX = [300, 500];
const PIXEL_TOLERANCE = 0.5;
const FALLBACK_BODY_PX = 16;
const OVERFLOW_HEIGHTS = { 375: 667, 768: 1024, 1024: 768, 1440: 900 };
const MEASURED_HOOKS = ['title', 'subtitle', 'cta', 'notice', 'email-form', 'questions-form'];
const TEST_SOURCE = 'test';
const SAMPLE_EMAIL = 'prueba@example.com';
const SAMPLE_ANSWER = 'Respuesta de prueba.';

export class NoChromeError extends Error {}

const problemIf = (condition, message) => (condition ? [message] : []);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const inPage = (pageFunction, ...args) => `(${pageFunction.toString()})(${args.map((arg) => JSON.stringify(arg)).join(',')})`;
const round = (value) => Math.round(value * 10) / 10;

export function findChrome(env = process.env, platform = process.platform) {
  if (env.CHROME_PATH) return existsSync(env.CHROME_PATH) ? env.CHROME_PATH : null;
  const onPath = (env.PATH ?? '').split(delimiter).flatMap((folder) => CHROME_COMMANDS.map((command) => join(folder, command)));
  return [...(CHROME_PATHS[platform] ?? []), ...onPath].find((path) => existsSync(path)) ?? null;
}

function parseArgs(args) {
  const flags = args.filter((arg) => arg.startsWith('--'));
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const isKnown = flags.every((flag) => flag === '--measure' || flag === '--gray');
  if (positional.length !== 2 || !isKnown) throw new UsageError('usage: capture.mjs <url> <output> [--measure] [--gray]');
  const [url, output] = positional;
  if (!URL.canParse(url) || !['http:', 'https:', 'file:'].includes(new URL(url).protocol)) {
    throw new UsageError(`${url} is not an http, https or file URL`);
  }
  return { url, output, measure: flags.includes('--measure'), gray: flags.includes('--gray') };
}

function removeProfile(profileDir) {
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // Chrome's helper processes can outlive it for a moment; a leftover temp profile must not fail a finished capture.
  }
}

function launchChrome(chromePath) {
  const profileDir = mkdtempSync(join(tmpdir(), 'sbr-chrome-'));
  const child = spawn(chromePath, [...CHROME_FLAGS, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  const close = async () => {
    child.kill('SIGKILL');
    await exited;
    removeProfile(profileDir);
  };
  return new Promise((resolve, reject) => {
    let output = '';
    const giveUp = (message) => {
      clearTimeout(timer);
      child.kill('SIGKILL');
      removeProfile(profileDir);
      reject(new UsageError(message));
    };
    const timer = setTimeout(() => giveUp('Chrome did not start in time'), START_TIMEOUT_MS);
    const onEarlyExit = (code) => giveUp(`Chrome exited before it was ready (code ${code})`);
    child.on('error', (error) => giveUp(`Chrome could not start: ${error.message}`));
    child.on('exit', onEarlyExit);
    child.stderr.on('data', (chunk) => {
      output += chunk;
      const listening = /DevTools listening on ws:\/\/[^:]+:(\d+)\//.exec(output);
      if (!listening) return;
      clearTimeout(timer);
      child.off('exit', onEarlyExit);
      resolve({ port: Number(listening[1]), close });
    });
  });
}

function connect(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const waiters = [];
  let lastId = 0;
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      lastId += 1;
      const id = lastId;
      const timer = setTimeout(() => reject(new UsageError(`Chrome did not answer ${method} in time`)), COMMAND_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer, method });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const waitFor = (eventName, timeoutMs = COMMAND_TIMEOUT_MS) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new UsageError(`the page did not reach ${eventName} in time`)), timeoutMs);
      waiters.push({ eventName, resolve, timer });
    });
  const settle = (message) => {
    const call = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(call.timer);
    if (message.error) return call.reject(new UsageError(`Chrome refused ${call.method}: ${message.error.message}`));
    call.resolve(message.result);
  };
  const notify = (message) => {
    const index = waiters.findIndex((waiter) => waiter.eventName === message.method);
    if (index === -1) return;
    const [waiter] = waiters.splice(index, 1);
    clearTimeout(waiter.timer);
    waiter.resolve(message.params);
  };
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id === undefined) return notify(message);
    settle(message);
  });
  const close = () => {
    [...pending.values(), ...waiters].forEach((entry) => clearTimeout(entry.timer));
    socket.close();
  };
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({ send, waitFor, close }));
    socket.addEventListener('error', () => reject(new UsageError('cannot talk to Chrome over its debugging port')));
  });
}

async function connectToPage(port) {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new UsageError('Chrome opened without a page');
  return connect(page.webSocketDebuggerUrl);
}

async function evaluate(client, expression) {
  const { result, exceptionDetails } = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new UsageError(`the page threw while it was read: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
  return result.value;
}

function waitForPaint() {
  return document.fonts.ready.then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
}

function readScreen() {
  return document.querySelector('[data-sbr="page"]')?.dataset.screen ?? null;
}

function forceScreen(number, screenHooks) {
  screenHooks.forEach((hook, index) => {
    const screen = document.querySelector(`[data-sbr="${hook}"]`);
    if (screen) screen.hidden = index !== number - 1;
  });
  document.body.dataset.screen = String(number);
  window.scrollTo(0, 0);
  return true;
}

function measureState(hooks) {
  const isShown = (element) => {
    const rect = element.getBoundingClientRect();
    return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && rect.width > 0 && rect.height > 0;
  };
  const nameOf = (element) => element.closest('[data-sbr]')?.dataset.sbr ?? element.tagName.toLowerCase();
  const boxOf = (rects) => ({
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  });
  const parseColor = (css) => {
    const numbers = (css.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number);
    const scale = css.startsWith('color(') ? 255 : 1;
    return { rgb: numbers.slice(0, 3).map((channel) => channel * scale), alpha: numbers.length > 3 ? numbers[3] : 1 };
  };
  const blend = (top, alpha, bottom) => top.map((channel, index) => channel * alpha + bottom[index] * (1 - alpha));
  const ancestorsOf = (element) => (element ? [...ancestorsOf(element.parentElement), element] : []);
  const backgroundOf = (element) =>
    ancestorsOf(element).reduce((color, node) => {
      const background = parseColor(getComputedStyle(node).backgroundColor);
      return blend(background.rgb, background.alpha, color);
    }, [255, 255, 255]);
  const drawnColor = (css, background) => {
    const color = parseColor(css);
    return blend(color.rgb, color.alpha, background);
  };
  const hasOwnText = (element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
  const textElements = [...document.body.querySelectorAll('*')].filter(
    (element) => !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName) && hasOwnText(element) && isShown(element),
  );
  const texts = textElements.map((element) => {
    const style = getComputedStyle(element);
    const background = backgroundOf(element);
    return {
      text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 40),
      name: nameOf(element),
      fontSize: parseFloat(style.fontSize),
      color: drawnColor(style.color, background),
      background,
    };
  });
  const fieldTexts = [...document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea')].filter(isShown).flatMap((field) => {
    const style = getComputedStyle(field);
    const background = backgroundOf(field);
    const typed = { text: 'typed text', name: nameOf(field), fontSize: parseFloat(style.fontSize), color: drawnColor(style.color, background), background };
    if (!field.placeholder) return [typed];
    return [typed, { ...typed, text: 'placeholder', color: drawnColor(getComputedStyle(field, '::placeholder').color, background) }];
  });
  const targets = [...document.querySelectorAll('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')].filter(isShown).map((element) => {
    const labels = element.matches('input[type="checkbox"], input[type="radio"]') ? [...element.labels] : [];
    return { name: nameOf(element), ...boxOf([element, ...labels.filter(isShown)].map((part) => part.getBoundingClientRect())) };
  });
  const clipped = textElements
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const isCutAcross = element.scrollWidth > element.clientWidth + 1 && style.overflowX !== 'visible';
      const isCutDown = element.scrollHeight > element.clientHeight + 1 && style.overflowY !== 'visible';
      return isCutAcross || isCutDown || rect.right > window.innerWidth + 1 || rect.left < -1;
    })
    .map(nameOf);
  const rects = Object.fromEntries(
    hooks
      .map((hook) => [hook, document.querySelector(`[data-sbr="${hook}"]`)])
      .filter(([, element]) => element && isShown(element))
      .map(([hook, element]) => [hook, boxOf([element.getBoundingClientRect()])]),
  );
  const rootStyle = getComputedStyle(document.documentElement);
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    bodyFontSize: parseFloat(rootStyle.getPropertyValue('--text-body')) * parseFloat(rootStyle.fontSize),
    texts: [...texts, ...fieldTexts],
    targets,
    clipped,
    rects,
  };
}

function focusInfo() {
  const element = document.activeElement ?? document.body;
  const style = getComputedStyle(element);
  return {
    name: element.dataset?.sbr ?? element.tagName.toLowerCase(),
    outlineWidth: parseFloat(style.outlineWidth),
    outlineStyle: style.outlineStyle,
    screen: document.body.dataset.screen,
  };
}

function clickHook(hook) {
  document.querySelector(`[data-sbr="${hook}"]`).click();
  return true;
}

function focusHook(hook) {
  document.querySelector(`[data-sbr="${hook}"]`).focus();
  return true;
}

function errorInfo(fieldHook, errorHook) {
  const field = document.querySelector(`[data-sbr="${fieldHook}"]`);
  const error = document.querySelector(`[data-sbr="${errorHook}"]`);
  return {
    isErrorShown: error.checkVisibility() && error.textContent.trim() !== '',
    invalid: field.getAttribute('aria-invalid'),
    isDescribed: (field.getAttribute('aria-describedby') ?? '').split(/\s+/).includes(error.id),
    isFocused: document.activeElement === field,
    screen: document.body.dataset.screen,
  };
}

function waitForScreenOrError(screen, errorHook, timeoutMs) {
  const error = document.querySelector(`[data-sbr="${errorHook}"]`);
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (document.body.dataset.screen === String(screen)) return resolve('advanced');
      if (error.checkVisibility()) return resolve('error');
      if (Date.now() - started > timeoutMs) return resolve('stuck');
      setTimeout(check, 50);
    };
    check();
  });
}

function hoverPoint(hook) {
  const element = document.querySelector(`[data-sbr="${hook}"]`);
  element.scrollIntoView({ block: 'center' });
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function styleSnapshot(hook) {
  const style = getComputedStyle(document.querySelector(`[data-sbr="${hook}"]`));
  const watched = ['opacity', 'backgroundColor', 'color', 'boxShadow', 'transform', 'translate', 'scale', 'outlineWidth', 'borderColor', 'filter', 'textDecorationLine'];
  return watched.map((property) => style[property]).join('|');
}

function urlForScreen(url, number, isMeasuring) {
  const target = new URL(url);
  target.searchParams.set('screen', String(number));
  if (isMeasuring) target.searchParams.set('src', TEST_SOURCE);
  return target.href;
}

async function openScreen(session, number, viewport) {
  const { client, options, contract } = session;
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < contract.desktop_breakpoint_px,
  });
  const loaded = client.waitFor('Page.loadEventFired');
  const { errorText } = await client.send('Page.navigate', { url: urlForScreen(options.url, number, options.measure) });
  if (errorText) throw new UsageError(`cannot open ${options.url}: ${errorText}`);
  await loaded;
  await evaluate(client, inPage(waitForPaint));
  const shown = await evaluate(client, inPage(readScreen));
  if (shown === null || shown === String(number)) return shown !== null;
  session.forcedScreens.add(number);
  await evaluate(client, inPage(forceScreen, number, contract.screens.map((screen) => screen.hook)));
  await evaluate(client, inPage(waitForPaint));
  return true;
}

async function screenshot(session, number, viewport) {
  const { client, options } = session;
  const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
  const file = join(options.output, `screen-${number}-${viewport.width}x${viewport.height}${options.gray ? '-gray' : ''}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  session.files.push(file);
}

const isInsideViewport = (rect, state) =>
  rect.left >= -PIXEL_TOLERANCE &&
  rect.top >= -PIXEL_TOLERANCE &&
  rect.right <= state.innerWidth + PIXEL_TOLERANCE &&
  rect.bottom <= state.innerHeight + PIXEL_TOLERANCE;

function firstViewProblems(state) {
  return ['title', 'subtitle', 'cta'].flatMap((hook) => {
    const rect = state.rects[hook];
    if (!rect) return [`${hook} is not drawn`];
    return problemIf(!isInsideViewport(rect, state), `${hook} does not fit in the first view (it ends at ${Math.round(rect.bottom)} px of ${state.innerHeight})`);
  });
}

function contrastOf(entry) {
  return contrastOfLuminances(relativeLuminance(entry.color), relativeLuminance(entry.background));
}

function contrastProblems(state) {
  return state.texts.flatMap((entry) => {
    const needed = entry.fontSize >= LARGE_TEXT_PX ? CONTRAST_LARGE : CONTRAST_TEXT;
    const ratio = contrastOf(entry);
    return problemIf(ratio < needed, `"${entry.text}" in ${entry.name} is ${formatRatio(ratio)}:1, needs ${needed}:1`);
  });
}

function gapBetween(first, second) {
  const across = Math.max(0, first.left - second.right, second.left - first.right);
  const down = Math.max(0, first.top - second.bottom, second.top - first.bottom);
  return Math.hypot(across, down);
}

function targetProblems(state) {
  const small = state.targets
    .filter((target) => target.right - target.left < MIN_TARGET_PX - PIXEL_TOLERANCE || target.bottom - target.top < MIN_TARGET_PX - PIXEL_TOLERANCE)
    .map((target) => `${target.name} is ${round(target.right - target.left)}×${round(target.bottom - target.top)} px, needs ${MIN_TARGET_PX}×${MIN_TARGET_PX}`);
  const crowded = state.targets.flatMap((first, index) =>
    state.targets
      .slice(index + 1)
      .filter((second) => gapBetween(first, second) < MIN_TARGET_GAP_PX - PIXEL_TOLERANCE)
      .map((second) => `${first.name} and ${second.name} are ${round(gapBetween(first, second))} px apart, need ${MIN_TARGET_GAP_PX}`),
  );
  return [...small, ...crowded];
}

function overflowProblems(state) {
  return [
    ...problemIf(state.scrollWidth > state.innerWidth, `the page scrolls sideways (${state.scrollWidth} px in a ${state.innerWidth} px window)`),
    ...[...new Set(state.clipped)].map((name) => `text is cut in ${name}`),
  ];
}

function formWidthProblems(state, hook, isDesktop) {
  const rect = state.rects[hook];
  if (!rect) return [`${hook} is not drawn`];
  const width = rect.right - rect.left;
  const [min, max] = FORM_WIDTH_PX;
  return problemIf(width > max + PIXEL_TOLERANCE || (isDesktop && width < min - PIXEL_TOLERANCE), `${hook} is ${round(width)} px wide, needs ${min} to ${max}`);
}

function noticeProblems(state) {
  const rect = state.rects.notice;
  if (!rect) return ['notice is not drawn'];
  const text = state.texts.find((entry) => entry.name === 'notice');
  const bodySize = Number.isFinite(state.bodyFontSize) ? state.bodyFontSize : FALLBACK_BODY_PX;
  return [
    ...problemIf(!isInsideViewport(rect, state), 'the notice does not fit in the first view of the final screen'),
    ...problemIf(text.fontSize < bodySize - PIXEL_TOLERANCE, `the notice is ${text.fontSize} px, smaller than the body (${bodySize} px)`),
    ...problemIf(contrastOf(text) < CONTRAST_TEXT, `the notice is ${formatRatio(contrastOf(text))}:1, needs ${CONTRAST_TEXT}:1`),
  ];
}

function addProblems(session, id, view, messages) {
  session.problems[id].push(...messages.map((message) => ({ view, message })));
}

function recordDrawnState(session, state, number, viewport) {
  const view = `${viewport.width}×${viewport.height} screen ${number}`;
  const isDesktop = viewport.width >= session.contract.desktop_breakpoint_px;
  addProblems(session, 'R13', view, contrastProblems(state));
  addProblems(session, 'R18', view, targetProblems(state));
  addProblems(session, 'R19', view, overflowProblems(state));
  if (number === 1) addProblems(session, 'R3', view, firstViewProblems(state));
  if (number === 2) addProblems(session, 'R20', view, formWidthProblems(state, 'email-form', isDesktop));
  if (number === 3) addProblems(session, 'R20', view, formWidthProblems(state, 'questions-form', isDesktop));
  if (number === 4 && !isDesktop) addProblems(session, 'R25', view, noticeProblems(state));
}

async function captureFirstViews(session) {
  const { client, options, contract } = session;
  for (const viewport of contract.viewports.first_view) {
    for (const screen of contract.screens) {
      const isLanding = await openScreen(session, screen.number, viewport);
      await screenshot(session, screen.number, viewport);
      if (!isLanding) break;
      session.isLanding = true;
      if (options.measure) recordDrawnState(session, await evaluate(client, inPage(measureState, MEASURED_HOOKS)), screen.number, viewport);
    }
  }
}

async function measureOtherWidths(session) {
  const { client, contract } = session;
  const firstViewWidths = contract.viewports.first_view.map((viewport) => viewport.width);
  const widths = contract.viewports.overflow_widths.filter((width) => !firstViewWidths.includes(width));
  for (const width of widths) {
    for (const screen of contract.screens) {
      await openScreen(session, screen.number, { width, height: OVERFLOW_HEIGHTS[width] ?? 900 });
      const state = await evaluate(client, inPage(measureState, MEASURED_HOOKS));
      addProblems(session, 'R19', `${width} px screen ${screen.number}`, overflowProblems(state));
    }
  }
}

async function pressTab(client) {
  await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...TAB_KEY });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...TAB_KEY });
}

async function keyboardProblems(session, number) {
  const { client } = session;
  const state = await evaluate(client, inPage(measureState, MEASURED_HOOKS));
  const expected = [...new Set(state.targets.map((target) => target.name))];
  const stops = [];
  for (let press = 0; press < expected.length; press += 1) {
    await pressTab(client);
    stops.push(await evaluate(client, inPage(focusInfo)));
  }
  const reached = stops.map((stop) => stop.name);
  const weakRings = stops
    .filter((stop) => expected.includes(stop.name) && (stop.outlineStyle === 'none' || stop.outlineWidth < MIN_FOCUS_RING_PX))
    .map((stop) => `screen ${number}: the focus ring of ${stop.name} is ${stop.outlineWidth} px, needs ${MIN_FOCUS_RING_PX}`);
  return [
    ...expected.filter((name) => !reached.includes(name)).map((name) => `screen ${number}: Tab does not reach ${name}`),
    ...new Set(weakRings),
  ];
}

async function hoverProblems(session, hook) {
  const { client } = session;
  const point = await evaluate(client, inPage(hoverPoint, hook));
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
  await delay(SETTLE_MS);
  const atRest = await evaluate(client, inPage(styleSnapshot, hook));
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await delay(SETTLE_MS);
  const hovered = await evaluate(client, inPage(styleSnapshot, hook));
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
  return problemIf(atRest === hovered, `${hook} looks the same at rest and under the pointer`);
}

async function titleFocusProblems(session, screen, titleHook) {
  const focus = await evaluate(session.client, inPage(focusInfo));
  return problemIf(focus.name !== titleHook, `on entering screen ${screen} the focus is on ${focus.name}, not on ${titleHook}`);
}

async function emptySubmitProblems(session, { submit, field, error, screen }) {
  const { client } = session;
  await evaluate(client, inPage(clickHook, submit));
  await delay(SETTLE_MS);
  const info = await evaluate(client, inPage(errorInfo, field, error));
  return [
    ...problemIf(info.screen !== String(screen), `submitting screen ${screen} empty leaves the screen`),
    ...problemIf(!info.isErrorShown, `submitting screen ${screen} empty does not show ${error}`),
    ...problemIf(info.invalid !== 'true', `${field} is not marked aria-invalid after an empty submit`),
    ...problemIf(!info.isDescribed, `${field} does not point at ${error} with aria-describedby`),
    ...problemIf(!info.isFocused, `the focus does not move to ${field} after an empty submit`),
  ];
}

async function typeInto(client, hook, text) {
  await evaluate(client, inPage(focusHook, hook));
  await client.send('Input.insertText', { text });
}

async function filledSubmit(session, { submit, error, nextScreen }) {
  const { client } = session;
  await evaluate(client, inPage(clickHook, submit));
  return evaluate(client, inPage(waitForScreenOrError, nextScreen, error, FLOW_TIMEOUT_MS));
}

async function measureFlow(session) {
  const { client, contract } = session;
  const desktop = contract.viewports.first_view.at(-1);
  const add = (id, messages) => addProblems(session, id, '', messages);
  await openScreen(session, 1, desktop);
  add('R22', await keyboardProblems(session, 1));
  add('R22', await hoverProblems(session, 'cta'));
  await evaluate(client, inPage(clickHook, 'cta'));
  await delay(SETTLE_MS);
  const didCtaAdvance = (await evaluate(client, inPage(readScreen))) === '2';
  add('R22', problemIf(!didCtaAdvance, 'the button of the first screen does not open the email screen'));
  if (!didCtaAdvance) await openScreen(session, 2, desktop);
  if (didCtaAdvance) add('R22', await titleFocusProblems(session, 2, 'email-title'));
  add('R22', await keyboardProblems(session, 2));
  add('R21', await emptySubmitProblems(session, { submit: 'email-submit', field: 'email-field', error: 'email-error', screen: 2 }));
  await typeInto(client, 'email-field', SAMPLE_EMAIL);
  const emailOutcome = await filledSubmit(session, { submit: 'email-submit', error: 'email-error', nextScreen: 3 });
  add('R24', problemIf(emailOutcome === 'stuck', 'a valid email neither advances to the questions nor shows an error'));
  if (emailOutcome !== 'advanced') await openScreen(session, 3, desktop);
  if (emailOutcome === 'advanced') add('R22', await titleFocusProblems(session, 3, 'questions-title'));
  add('R22', await keyboardProblems(session, 3));
  add('R21', await emptySubmitProblems(session, { submit: 'questions-submit', field: 'field-current-solution', error: 'questions-error', screen: 3 }));
  await typeInto(client, 'field-current-solution', SAMPLE_ANSWER);
  await typeInto(client, 'field-last-time', SAMPLE_ANSWER);
  const answersOutcome = await filledSubmit(session, { submit: 'questions-submit', error: 'questions-error', nextScreen: 4 });
  add('R24', problemIf(answersOutcome === 'stuck', 'valid answers neither advance to the final screen nor show an error'));
  if (answersOutcome === 'advanced') add('R22', await titleFocusProblems(session, 4, 'done-title'));
}

const PASS_DETAILS = {
  R3: 'title, subtitle and button fit in the first view at both sizes',
  R13: 'every drawn text meets its contrast on its real background',
  R18: 'touch targets are at least 44×44 px and 8 px apart',
  R19: 'no sideways scroll and no cut text at any width',
  R20: 'forms are between 300 and 500 px wide',
  R21: 'an empty submit shows the error, marks the field and moves the focus to it',
  R22: 'Tab reaches every control with a 2 px ring, focus follows the screen title and the button reacts to the pointer',
  R24: 'a valid submit advances or shows an error',
  R25: 'the notice fits in the first view of the final screen at body size and 4.5:1',
};

function problemsByMessage(problems) {
  const views = new Map();
  problems.forEach(({ view, message }) => views.set(message, [...(views.get(message) ?? []), view]));
  return [...views].map(([message, seenIn]) => {
    const where = [...new Set(seenIn.filter(Boolean))];
    if (where.length === 0) return message;
    return `${where[0]}: ${message}${where.length > 1 ? ` (and ${where.length - 1} more)` : ''}`;
  });
}

function reportOf(session) {
  const report = createReport(session.contract, 'capture');
  Object.entries(PASS_DETAILS).forEach(([id, passDetail]) => record(report, id, problemsByMessage(session.problems[id]), passDetail));
  return report;
}

async function run(client, options, contract) {
  const problems = Object.fromEntries(Object.keys(PASS_DETAILS).map((id) => [id, []]));
  const session = { client, options, contract, problems, files: [], forcedScreens: new Set(), isLanding: false };
  await client.send('Page.enable');
  await client.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  if (options.gray) await client.send('Emulation.setEmulatedVisionDeficiency', { type: 'achromatopsia' });
  await captureFirstViews(session);
  if (session.forcedScreens.size) console.error(`the page did not react to ?screen= (it has a config.json, or its script did not run): screens ${[...session.forcedScreens].join(', ')} were shown by hand`);
  if (!session.isLanding) console.error(`${options.url} is not a landing built by the plugin: only its first view was captured`);
  if (!options.measure) {
    console.log(session.files.join('\n'));
    return EXIT_CODES.ok;
  }
  if (!session.isLanding) throw new UsageError(`${options.url} has no data-sbr="page": there is nothing to measure`);
  await measureOtherWidths(session);
  await measureFlow(session);
  return printReport(reportOf(session));
}

async function runWithPage(port, options, contract) {
  const client = await connectToPage(port);
  try {
    return await run(client, options, contract);
  } finally {
    client.close();
  }
}

async function main(args) {
  const options = parseArgs(args);
  const contract = loadContract();
  const chromePath = findChrome();
  if (!chromePath) throw new NoChromeError('Chrome is not available: install Google Chrome or set CHROME_PATH to a Chromium browser');
  mkdirSync(options.output, { recursive: true });
  const chrome = await launchChrome(chromePath);
  try {
    return await runWithPage(chrome.port, options, contract);
  } finally {
    await chrome.close();
  }
}

if (isMainModule(import.meta.url)) runCli(main, (error) => (error instanceof NoChromeError ? EXIT_CODES.noChrome : null));
