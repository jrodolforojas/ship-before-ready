#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findChrome } from '../../../scripts/capture.mjs';
import { EXIT_CODES, isMainModule, runCli, UsageError } from '../../../scripts/verify-design.mjs';

const CHROME_FLAGS = ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio'];
const START_TIMEOUT_MS = 20000;
const COMMAND_TIMEOUT_MS = 30000;
const STEP_TIMEOUT_MS = 20000;
const LAST_EVENT_GRACE_MS = 3000;
const TEST_SOURCE = 'test';
const SAMPLE_EMAIL = 'prueba@example.com';
const SAMPLE_ANSWER = 'Visita de prueba del plugin.';
const USAGE = 'usage: visit.mjs <landing url>';

class NoChromeError extends Error {}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const inPage = (pageFunction, ...args) => `(${pageFunction.toString()})(${args.map((arg) => JSON.stringify(arg)).join(',')})`;

export function visitUrl(url) {
  if (!URL.canParse(url) || !['http:', 'https:'].includes(new URL(url).protocol)) throw new UsageError(`${url} is not an http or https URL`);
  const target = new URL(url);
  target.searchParams.set('src', TEST_SOURCE);
  target.searchParams.set('debug', '1');
  target.searchParams.delete('screen');
  return target.href;
}

function launchChrome(chromePath) {
  const profileDir = mkdtempSync(join(tmpdir(), 'sbr-visit-'));
  const child = spawn(chromePath, [...CHROME_FLAGS, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  const close = async () => {
    child.kill('SIGKILL');
    await exited;
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  };
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new UsageError('Chrome did not start in time'));
    }, START_TIMEOUT_MS);
    child.on('error', (error) => reject(new UsageError(`Chrome could not start: ${error.message}`)));
    child.stderr.on('data', (chunk) => {
      output += chunk;
      const listening = /DevTools listening on ws:\/\/[^:]+:(\d+)\//.exec(output);
      if (!listening) return;
      clearTimeout(timer);
      resolve({ port: Number(listening[1]), close });
    });
  });
}

async function connectToPage(port) {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new UsageError('Chrome opened without a page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const loads = [];
  let lastId = 0;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.loadEventFired') return loads.splice(0).forEach((resolve) => resolve());
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timer);
    if (message.error) return call.reject(new UsageError(`Chrome refused ${call.method}: ${message.error.message}`));
    call.resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      lastId += 1;
      const timer = setTimeout(() => reject(new UsageError(`Chrome did not answer ${method} in time`)), COMMAND_TIMEOUT_MS);
      pending.set(lastId, { resolve, reject, timer, method });
      socket.send(JSON.stringify({ id: lastId, method, params }));
    });
  const loaded = () => new Promise((resolve) => loads.push(resolve));
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', () => reject(new UsageError('cannot talk to Chrome over its debugging port')));
  });
  return { send, loaded, close: () => socket.close() };
}

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new UsageError(`the page threw: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
  return result.value;
}

async function walkThroughFlow({ email, answer, timeoutMs }) {
  const hook = (name) => document.querySelector(`[data-sbr="${name}"]`);
  const screen = () => document.body.dataset.screen;
  const visibleError = () => ['email-error', 'questions-error'].map(hook).find((element) => element && !element.hidden)?.textContent.trim() ?? null;
  const waitForScreen = (number) =>
    new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        if (screen() === number) return resolve(true);
        if (visibleError() || Date.now() - started > timeoutMs) return resolve(false);
        setTimeout(check, 100);
      };
      check();
    });
  const fill = (name, value) => {
    const field = hook(name);
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const stopped = (step) => ({ reached: screen(), stopped_at: step, error: visibleError() });
  if (!hook('page')) return { reached: null, stopped_at: 'load', error: 'the page has no data-sbr="page"' };
  hook('cta').click();
  if (!(await waitForScreen('2'))) return stopped('cta');
  fill('email-field', email);
  hook('email-submit').click();
  if (!(await waitForScreen('3'))) return stopped('email');
  fill('field-current-solution', answer);
  fill('field-last-time', answer);
  hook('questions-submit').click();
  if (!(await waitForScreen('4'))) return stopped('questions');
  return { reached: '4', stopped_at: null, error: null };
}

function readVisit() {
  const items = [...document.querySelectorAll('[data-sbr="debug-panel"] [data-event]')];
  return { distinct_id: localStorage.getItem('sbr_distinct_id'), emitted: items.map((item) => item.dataset.event) };
}

export async function visit(url) {
  const chromePath = findChrome();
  if (!chromePath) throw new NoChromeError('Chrome is not available: set CHROME_PATH or install Google Chrome');
  const chrome = await launchChrome(chromePath);
  try {
    const page = await connectToPage(chrome.port);
    await page.send('Page.enable');
    const loaded = page.loaded();
    await page.send('Page.navigate', { url });
    await loaded;
    const flow = await evaluate(page, inPage(walkThroughFlow, { email: SAMPLE_EMAIL, answer: SAMPLE_ANSWER, timeoutMs: STEP_TIMEOUT_MS }));
    await delay(LAST_EVENT_GRACE_MS);
    const read = await evaluate(page, inPage(readVisit));
    page.close();
    return { url, ...flow, ...read };
  } finally {
    await chrome.close();
  }
}

async function main(args) {
  if (args.length !== 1) throw new UsageError(USAGE);
  const result = await visit(visitUrl(args[0]));
  console.log(JSON.stringify(result, null, 2));
  return result.reached === '4' ? EXIT_CODES.ok : EXIT_CODES.requirementFailed;
}

if (isMainModule(import.meta.url)) runCli(main, (error) => (error instanceof NoChromeError ? EXIT_CODES.noChrome : null));
