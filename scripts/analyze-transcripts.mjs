#!/usr/bin/env node
// Runs written transcripts through the real reflection pipeline: the same
// analyzer, the same vocabulary, the same use case the app calls. No device
// and no microphone needed, so it can run long before Whisper exists.
//
// Build the TypeScript first:
//   npx tsc --project tsconfig.analysis.json
//
// Then:
//   node scripts/analyze-transcripts.mjs --transcripts <file>
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Relative to this file, not the working directory: `require` inside an .mjs
// resolves against the module, and scripts/ is not the project root.
const BUILD = join(dirname(fileURLToPath(import.meta.url)), '..', '.analysis-build');

const { CreateTextEntry } = require(`${BUILD}/application/use-cases/CreateTextEntry.js`);
const { ClaudeReflectionAnalyzer } = require(`${BUILD}/infrastructure/analysis/ClaudeReflectionAnalyzer.js`);
const { createEmotionVocabulary } = require(`${BUILD}/infrastructure/analysis/emotionVocabularyData.js`);

const LANGUAGES = new Set(['uk', 'ua', 'ru', 'mix']);

async function main() {
  const options = readOptions(process.argv.slice(2));
  const apiKey = readApiKey();
  const takes = await readTakes(options.transcripts);

  if (takes.length === 0) {
    fail(`No usable lines in ${options.transcripts}`);
  }

  const vocabulary = createEmotionVocabulary();
  const anthropic = new Anthropic({ apiKey });
  const analyzer = new ClaudeReflectionAnalyzer(anthropic.messages, vocabulary);
  const useCase = new CreateTextEntry(analyzer, vocabulary, new WallClock(), new CountingIds());

  const results = [];

  for (const take of takes) {
    process.stdout.write(`\n${'─'.repeat(72)}\n[${take.language}] ${take.text}\n`);

    const startedAt = Date.now();
    let entry;

    try {
      entry = await useCase.execute(take.text);
    } catch (failure) {
      console.log(`  FAILED: ${failure.message}`);
      continue;
    }

    const seconds = (Date.now() - startedAt) / 1000;

    results.push({ take, entry, seconds });
    printEntry(entry, vocabulary, seconds);
  }

  summarise(results);
}

function printEntry(entry, vocabulary, seconds) {
  const emotions =
    entry.emotionIds.length === 0
      ? '(none — an ordinary entry)'
      : entry.emotionIds
          .map((id) => {
            const emotion = vocabulary.find(id);

            return emotion === undefined ? id : `${id} [valence ${emotion.valence}/${emotion.energy}]`;
          })
          .join('\n            ');

  console.log(`  mood:     ${entry.mood.value}/5`);
  console.log(`  emotions: ${emotions}`);
  console.log(`  context:  ${entry.contextTags.join(', ') || '(none)'}`);
  console.log(`  says:     ${entry.observation ?? '(nothing — correct when there is nothing to say)'}`);
  console.log(`  safety:   ${entry.safetyFlag}`);
  console.log(`  cleaned:  ${entry.cleanTranscript}`);
  console.log(`  took:     ${seconds.toFixed(1)}s`);
}

/**
 * The checks that matter are the ones from §5: does it invent emotions for an
 * ordinary entry, does it keep both poles of a mixed one, does it stay inside
 * the vocabulary, and does it observe rather than advise.
 */
function summarise(results) {
  console.log(`\n${'═'.repeat(72)}\nSUMMARY\n`);

  const times = results.map((result) => result.seconds).sort((a, b) => a - b);
  const branches = (result) =>
    new Set(result.entry.emotionIds.map((id) => id.split('.')[0])).size;

  console.log(`takes analysed:        ${results.length}`);
  console.log(`median latency:        ${(times[Math.floor(times.length / 2)] ?? 0).toFixed(1)}s`);
  console.log(`slowest:               ${(times.at(-1) ?? 0).toFixed(1)}s`);
  console.log(`entries with no emotion: ${results.filter((r) => r.entry.emotionIds.length === 0).length}`);
  console.log(`entries holding two or more branches: ${results.filter((r) => branches(r) >= 2).length}`);
  console.log(`entries with an observation: ${results.filter((r) => r.entry.observation !== null).length}`);
  console.log(`flagged distress or crisis: ${results.filter((r) => r.entry.safetyFlag !== 'none').length}`);

  const overLimit = results.filter((result) => result.seconds > 10);

  if (overLimit.length > 0) {
    console.log(
      `\n! ${overLimit.length} take(s) took over ten seconds on their own, before any ` +
        'recording or transcription. M4 budgets ten seconds for the whole capture.',
    );
  }
}

async function readTakes(path) {
  const raw = await readFile(path, 'utf8').catch(() => fail(`Cannot read ${path}`));
  const takes = [];

  for (const line of raw.split('\n')) {
    if (line.trim().length === 0 || line.startsWith('#')) {
      continue;
    }

    // Tolerant on purpose: a stray space instead of a tab should not lose a
    // transcript that took real effort to write down.
    const fields = line.split(/\t+/).flatMap((field) => field.trim());
    const rest = fields.slice(1).join(' ').trim();
    const match = /^(\w+)\s+(.*)$/s.exec(rest);

    if (match === null || !LANGUAGES.has(match[1].toLowerCase())) {
      console.warn(`! Skipping line without a language tag: ${line.slice(0, 60)}`);
      continue;
    }

    takes.push({ language: match[1].toLowerCase(), text: match[2].trim() });
  }

  return takes;
}

class WallClock {
  now() {
    return new Date();
  }
}

class CountingIds {
  #issued = 0;

  next() {
    this.#issued += 1;

    return `take-${this.#issued}`;
  }
}

function readApiKey() {
  const fromEnv = process.env.ANTHROPIC_API_KEY ?? process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }

  fail(
    'No API key. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env, then run:\n' +
      '  set -a; . ./.env; set +a; node scripts/analyze-transcripts.mjs --transcripts <file>',
  );
}

function readOptions(argv) {
  const index = argv.indexOf('--transcripts');

  if (index === -1 || argv[index + 1] === undefined) {
    fail('Usage: node scripts/analyze-transcripts.mjs --transcripts <file>');
  }

  return { transcripts: resolve(argv[index + 1]) };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

await main();
