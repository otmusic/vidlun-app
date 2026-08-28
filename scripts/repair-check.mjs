#!/usr/bin/env node
// Does the repair prompt leave alone what it is told to leave alone?
//
// §1 says a Russian word inside a Ukrainian sentence is how this person talks
// and must survive untouched, and the prompt said so three times while
// converting one anyway. The licence to repair mishearings was withdrawn on
// 2026-08-28 as a result, so the bar is now flat: nothing may change except a
// hesitation sound coming out.
//
// It runs the real analyzer against the real model, and prints every word
// added, dropped or changed. Read the runs rather than counting them.
//
// Build the TypeScript first:
//   npx tsc --project tsconfig.analysis.json
//
// Then:
//   set -a; . ./.env; set +a
//   node scripts/repair-check.mjs --cases ~/vidlun-whisper/repair-cases.tsv
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const BUILD = join(dirname(fileURLToPath(import.meta.url)), '..', '.analysis-build');

const { ClaudeReflectionAnalyzer } = require(
  `${BUILD}/infrastructure/analysis/ClaudeReflectionAnalyzer.js`,
);
const { createEmotionVocabulary } = require(
  `${BUILD}/infrastructure/analysis/emotionVocabularyData.js`,
);

async function main() {
  const options = readOptions(process.argv.slice(2));
  const cases = await readCases(options.cases);
  const analyzer = new ClaudeReflectionAnalyzer(
    new Anthropic({ apiKey: readApiKey() }).messages,
    createEmotionVocabulary(),
    options.model,
  );

  let touched = 0;

  for (const item of cases) {
    let proposal;

    try {
      proposal = await analyzer.analyze(item.text);
    } catch (failure) {
      console.log(`\n[${item.language}] FAILED: ${failure.message}`);
      continue;
    }

    const changes = diff(item.text, proposal.cleanTranscript);

    console.log(`\n${'─'.repeat(72)}`);
    console.log(`heard:    ${item.text}`);
    console.log(`repaired: ${proposal.cleanTranscript}`);

    if (changes.length === 0) {
      console.log('unchanged');
      continue;
    }

    touched += 1;

    for (const change of changes) {
      console.log(`  ${change}`);
    }
  }

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${touched} of ${cases.length} transcripts were changed.`);
  console.log('Read every one. Since the repair licence was withdrawn the only');
  console.log('permitted change is a hesitation sound removed; anything else that');
  console.log('moved is the prompt rewriting words the person actually said.');
}

/**
 * Word level, and deliberately crude: this exists to make a change visible,
 * not to score it. Punctuation and case are ignored because the prompt is
 * allowed to repunctuate, and neither carries a word the person said.
 */
function diff(before, after) {
  const source = words(before);
  const target = words(after);
  const kept = new Set(target);
  const had = new Set(source);

  return [
    ...source.filter((word) => !kept.has(word)).map((word) => `- ${word}`),
    ...target.filter((word) => !had.has(word)).map((word) => `+ ${word}`),
  ];
}

function words(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'’-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

async function readCases(path) {
  const raw = await readFile(path, 'utf8').catch(() => fail(`Cannot read ${path}`));
  const cases = [];

  for (const line of raw.split('\n')) {
    if (line.trim().length === 0 || line.startsWith('#')) {
      continue;
    }

    const [language, ...rest] = line.split('\t');

    if (rest.length === 0) {
      console.warn(`! Skipping line without a tab: ${line.slice(0, 60)}`);
      continue;
    }

    cases.push({ language: language.trim(), text: rest.join('\t').trim() });
  }

  return cases;
}

function readApiKey() {
  const key = process.env.ANTHROPIC_API_KEY ?? process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

  if (key !== undefined && key.length > 0) {
    return key;
  }

  fail('No API key. set -a; . ./.env; set +a, then run this again.');
}

function readOptions(argv) {
  const options = { cases: null, model: undefined };

  for (let index = 0; index < argv.length; index += 2) {
    const value = argv[index + 1] ?? '';

    if (argv[index] === '--cases') {
      options.cases = resolve(expandHome(value));
    }

    if (argv[index] === '--model') {
      options.model = value;
    }
  }

  if (options.cases === null) {
    fail('Usage: node scripts/repair-check.mjs --cases <file.tsv> [--model <id>]');
  }

  return options;
}

function expandHome(path) {
  return path.startsWith('~/') ? join(process.env.HOME ?? '', path.slice(2)) : path;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

await main();
