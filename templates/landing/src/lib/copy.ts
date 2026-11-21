export interface Copy {
  lang: string;
  brand: string;
  hero: { title: string; subtitle: string };
  cta: string;
  pains: string[];
  steps: string[];
  closing: string;
  footer: { author: string; privacy: string };
  progress: string;
  status: { sending: string };
  email: {
    title: string;
    label: string;
    placeholder: string;
    submit: string;
    privacy: string;
    error: string;
  };
  questions: {
    title: string;
    saved: string;
    current_solution: string;
    last_time: string;
    wants_call: string;
    whatsapp: string;
    time_slot: string;
    submit: string;
    error: string;
  };
  done: { title: string; notice: string; next: string };
  meta: { title: string; description: string };
}

const languageFiles = import.meta.glob<Copy>('../i18n/*.json', { eager: true, import: 'default' });
const [onlyLanguage, ...otherLanguages] = Object.values(languageFiles);

if (!onlyLanguage || otherLanguages.length > 0) {
  throw new Error(
    `Expected exactly one language file in src/i18n/, found ${Object.keys(languageFiles).length}.`,
  );
}

export const copy = onlyLanguage;
