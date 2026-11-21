import { readdirSync } from 'node:fs';

const testFiles = readdirSync(new URL('.', import.meta.url))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort();

for (const file of testFiles) await import(new URL(file, import.meta.url));
