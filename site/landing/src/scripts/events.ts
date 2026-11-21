import sources from './sources.json';

interface CaptureConfig {
  posthog_key: string;
  capture_path: string;
}

type EventName = '$pageview' | 'sbr_cta_click' | 'sbr_signup' | 'sbr_answers' | 'sbr_done';
type EventProperties = Record<string, string | boolean>;

export type CtaPlace = 'hero' | 'closing';

export type Answers = {
  current_solution: string;
  last_time: string;
  wants_call: boolean;
  whatsapp: string;
  time_slot: string;
};

const DISTINCT_ID_STORAGE_KEY = 'sbr_distinct_id';
const SEND_TIMEOUT_MS = 10_000;

const configFiles = import.meta.glob<CaptureConfig>('../data/config.json', { eager: true, import: 'default' });
const captureConfig: CaptureConfig | undefined = Object.values(configFiles)[0];

const query = new URLSearchParams(location.search);
const source = sourceFrom(query.get('src'));
const debugList = revealDebugList();
let visitorId: string | undefined;

export const hasCaptureConfig = captureConfig !== undefined;

export const trackPageview = () => capture('$pageview');
export const trackCtaClick = (place: CtaPlace) => capture('sbr_cta_click', { place });
export const trackSignup = (email: string) => capture('sbr_signup', { email });
export const trackAnswers = (answers: Answers) => capture('sbr_answers', answers);
export const trackDone = () => capture('sbr_done');

function capture(event: EventName, eventProperties: EventProperties = {}): Promise<boolean> {
  const properties = { source, ...eventProperties, $current_url: location.href };
  listInDebugPanel(event, properties);
  if (!captureConfig) return Promise.resolve(true);
  return send(captureConfig, event, properties);
}

async function send(config: CaptureConfig, event: EventName, properties: EventProperties): Promise<boolean> {
  try {
    const response = await fetch(config.capture_path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: config.posthog_key, event, distinct_id: distinctId(), properties }),
      keepalive: true,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function sourceFrom(src: string | null): string {
  if (src && sources.values.includes(src)) return src;
  return sources.fallback;
}

function distinctId(): string {
  visitorId ??= attempt(() => localStorage.getItem(DISTINCT_ID_STORAGE_KEY)) || createVisitorId();
  return visitorId;
}

function createVisitorId(): string {
  const id = createUuid();
  attempt(() => localStorage.setItem(DISTINCT_ID_STORAGE_KEY, id));
  return id;
}

// crypto.randomUUID only exists on secure origins; a preview opened over plain http on the local network still needs an id.
function createUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function attempt<Result>(action: () => Result): Result | undefined {
  try {
    return action();
  } catch {
    return undefined;
  }
}

function revealDebugList(): HTMLElement | null {
  if (query.get('debug') !== '1') return null;
  const panel = document.querySelector<HTMLElement>('[data-sbr="debug-panel"]');
  if (!panel) return null;
  panel.hidden = false;
  return panel.querySelector('ol');
}

function listInDebugPanel(event: EventName, properties: EventProperties): void {
  if (!debugList) return;
  const item = document.createElement('li');
  item.dataset.event = event;
  item.textContent = `${event} ${JSON.stringify(properties)}`;
  debugList.append(item);
}
