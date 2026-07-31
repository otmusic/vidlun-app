#!/usr/bin/env node
// Absolute rule 1: no Cyrillic in source files. Non-English text is data and
// belongs in src/i18n/locales/*.json, which this check deliberately skips.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCANNED_EXTENSIONS = ['.ts', '.tsx'];
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.idea',
  '.expo',
  'dist',
  'coverage',
  'assets',
]);
const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/u;

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...(await collectSourceFiles(path)));
      }
    } else if (SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(path);
    }
  }

  return files;
}

async function findViolations(path) {
  const lines = (await readFile(path, 'utf8')).split('\n');

  return lines
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => CYRILLIC.test(text))
    .map(({ text, line }) => `${relative(PROJECT_ROOT, path)}:${line}  ${text.trim()}`);
}

const files = await collectSourceFiles(PROJECT_ROOT);
const violations = (await Promise.all(files.map(findViolations))).flat();

if (violations.length > 0) {
  console.error('Cyrillic characters found in source files:\n');
  console.error(violations.join('\n'));
  console.error('\nMove user-facing text into src/i18n/locales/*.json as a key.');
  process.exit(1);
}

console.log(`English-only check passed (${files.length} files).`);
