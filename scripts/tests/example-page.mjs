#!/usr/bin/env node
import { cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { distPage, writeLanding } from './landing-fixture.mjs';

const [destination] = process.argv.slice(2);
if (!destination) {
  console.error('usage: example-page.mjs <folder>');
  process.exit(2);
}

const folder = resolve(destination);
const built = writeLanding();
cpSync(built, folder, { recursive: true });
rmSync(built, { recursive: true, force: true });
console.log(`folder: ${folder}`);
console.log(`url: ${pathToFileURL(distPage(folder)).href}`);
