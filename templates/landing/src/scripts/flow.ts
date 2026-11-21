import type { Answers } from './events';
import { hasCaptureConfig, trackAnswers, trackCtaClick, trackDone, trackPageview, trackSignup } from './events';

type Field = HTMLInputElement | HTMLTextAreaElement;

interface FormHooks {
  form: HTMLFormElement;
  submit: HTMLButtonElement;
  error: HTMLElement;
}

const SCREEN_HOOKS = ['screen-promise', 'screen-email', 'screen-questions', 'screen-done'];
const TITLE_HOOKS = ['title', 'email-title', 'questions-title', 'done-title'];
const EMAIL_SCREEN = 2;
const QUESTIONS_SCREEN = 3;
const DONE_SCREEN = 4;

const page = document.body;
const screens = SCREEN_HOOKS.map((name) => hook(name));
const titles = TITLE_HOOKS.map((name) => hook(name));

const emailField = hook<HTMLInputElement>('email-field');
const currentSolution = hook<HTMLTextAreaElement>('field-current-solution');
const lastTime = hook<HTMLTextAreaElement>('field-last-time');
const wantsCall = hook<HTMLInputElement>('field-wants-call');
const callGroup = hook('call-group');
const whatsapp = hook<HTMLInputElement>('field-whatsapp');
const timeSlot = hook<HTMLInputElement>('field-time-slot');

function hook<Hooked extends HTMLElement = HTMLElement>(name: string): Hooked {
  const element = document.querySelector<Hooked>(`[data-sbr="${name}"]`);
  if (!element) throw new Error(`Missing data-sbr hook "${name}".`);
  return element;
}

function showScreen(number: number): void {
  screens.forEach((screen, index) => {
    screen.hidden = index + 1 !== number;
  });
  page.dataset.screen = String(number);
}

function goToScreen(number: number): void {
  showScreen(number);
  window.scrollTo(0, 0);
  titles[number - 1]?.focus({ preventScroll: true });
}

function previewScreen(): number | undefined {
  if (hasCaptureConfig) return undefined;
  const requested = new URLSearchParams(location.search).get('screen') ?? '';
  if (!/^[1-4]$/.test(requested)) return undefined;
  return Number(requested);
}

function formHooks(name: 'email' | 'questions'): FormHooks {
  return {
    form: hook<HTMLFormElement>(`${name}-form`),
    submit: hook<HTMLButtonElement>(`${name}-submit`),
    error: hook(`${name}-error`),
  };
}

function fieldsOf(form: HTMLFormElement): Field[] {
  return Array.from(form.querySelectorAll<Field>('input, textarea'));
}

function trimTextFields(form: HTMLFormElement): void {
  for (const field of fieldsOf(form)) {
    if (field.type === 'checkbox') continue;
    field.value = field.value.trim();
  }
}

function clearError({ form, submit, error }: FormHooks): void {
  error.hidden = true;
  for (const element of [...fieldsOf(form), submit]) {
    element.removeAttribute('aria-invalid');
    element.removeAttribute('aria-describedby');
  }
}

function showError({ error }: FormHooks, culprits: HTMLElement[]): void {
  for (const culprit of culprits) culprit.setAttribute('aria-describedby', error.id);
  error.hidden = false;
  culprits[0]?.focus();
}

function showSending(submit: HTMLButtonElement): () => void {
  const idleLabel = submit.textContent;
  submit.disabled = true;
  submit.textContent = submit.dataset.sendingLabel ?? idleLabel;
  return () => {
    submit.disabled = false;
    submit.textContent = idleLabel;
  };
}

function onSubmit(hooks: FormHooks, deliver: () => Promise<boolean>, advance: () => void): void {
  const { form, submit } = hooks;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError(hooks);
    trimTextFields(form);
    const invalidFields = fieldsOf(form).filter((field) => !field.checkValidity());
    if (invalidFields.length > 0) {
      for (const field of invalidFields) field.setAttribute('aria-invalid', 'true');
      showError(hooks, invalidFields);
      return;
    }
    const restoreSubmit = showSending(submit);
    const delivered = await deliver();
    restoreSubmit();
    if (!delivered) {
      showError(hooks, [submit]);
      return;
    }
    advance();
  });
}

function syncCallGroup(): void {
  callGroup.hidden = !wantsCall.checked;
  whatsapp.required = wantsCall.checked;
}

function answers(): Answers {
  const callFieldValue = (field: HTMLInputElement) => (wantsCall.checked ? field.value : '');
  return {
    current_solution: currentSolution.value,
    last_time: lastTime.value,
    wants_call: wantsCall.checked,
    whatsapp: callFieldValue(whatsapp),
    time_slot: callFieldValue(timeSlot),
  };
}

function onCtaClick(name: string, place: 'hero' | 'closing'): void {
  hook(name).addEventListener('click', () => {
    trackCtaClick(place);
    goToScreen(EMAIL_SCREEN);
  });
}

const preview = previewScreen();
if (preview) showScreen(preview);

trackPageview();

onCtaClick('cta', 'hero');
onCtaClick('cta-closing', 'closing');

onSubmit(
  formHooks('email'),
  () => trackSignup(emailField.value),
  () => goToScreen(QUESTIONS_SCREEN),
);

wantsCall.addEventListener('change', syncCallGroup);
syncCallGroup();

onSubmit(
  formHooks('questions'),
  () => trackAnswers(answers()),
  () => {
    goToScreen(DONE_SCREEN);
    trackDone();
  },
);
