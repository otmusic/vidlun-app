#!/usr/bin/env node
// The §10 experiment: how well does whisper read Ukrainian, Russian and the
// mix of the two people actually speak?
//
// whisper.rn wraps whisper.cpp, so the model and the implementation here are
// the same ones that will run on the phone. Word error rate therefore carries
// over; wall time does not, and is reported only to compare the two models
// against each other.
//
// Usage:
//   node scripts/whisper-experiment.mjs --recordings <dir> --models <dir>
//
// The recordings directory needs one audio file per take plus a transcripts.tsv:
//   filename <TAB> language <TAB> what was actually said
// Language is uk, ru or mix.
import { execFile } from 'node:child_process';
import { readdir, readFile, mkdir, stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const MODELS = [
  { id: 'large-v3-turbo', file: 'ggml-large-v3-turbo.bin' },
  { id: 'small', file: 'ggml-small.bin' },
];

const AUDIO_EXTENSIONS = new Set(['.m4a', '.mp3', '.wav', '.aac', '.caf', '.ogg']);

async function main() {
  const options = readOptions(process.argv.slice(2));

  await checkModels(options.models);

  const references = await readReferences(join(options.recordings, 'transcripts.tsv'));
  const workDir = join(options.recordings, '.wav');

  await mkdir(workDir, { recursive: true });

  const files = (await readdir(options.recordings))
    .filter((name) => AUDIO_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort();

  if (files.length === 0) {
    fail(`No audio files in ${options.recordings}`);
  }

  const rows = [];

  for (const file of files) {
    const reference = references.get(file);

    if (reference === undefined) {
      console.warn(`! ${file} has no line in transcripts.tsv — skipped`);
      continue;
    }

    const wav = join(workDir, `${basename(file, extname(file))}.wav`);

    await run('ffmpeg', ['-y', '-i', join(options.recordings, file), '-ar', '16000', '-ac', '1', wav]);

    for (const model of MODELS) {
      const startedAt = Date.now();
      let hypothesis;

      try {
        hypothesis = await transcribe(wav, join(options.models, model.file));
      } catch (failure) {
        fail(`whisper-cli failed on ${file} with ${model.id}:\n${failure.stderr ?? failure.message}`);
      }

      const seconds = (Date.now() - startedAt) / 1000;

      rows.push({
        file,
        language: reference.language,
        model: model.id,
        seconds,
        wer: wordErrorRate(reference.text, hypothesis),
        hypothesis,
        reference: reference.text,
      });

      console.log(`${file}  ${model.id.padEnd(15)} wer=${rows.at(-1).wer.toFixed(3)}  ${seconds.toFixed(1)}s`);
    }
  }

  report(rows);
}

async function transcribe(wavPath, modelPath) {
  // Language is auto-detected on purpose: the app cannot know in advance which
  // of the two languages a sentence will be in, or whether it mixes both.
  const { stdout } = await run('whisper-cli', [
    '-m', modelPath,
    '-f', wavPath,
    '-l', 'auto',
    '--no-timestamps',
    '--output-txt', 'false',
  ]);

  return stdout.trim();
}

/**
 * Levenshtein distance over words, divided by the length of the reference.
 * 0 is perfect; 1 means every word had to be changed.
 */
export function wordErrorRate(reference, hypothesis) {
  const referenceWords = normalise(reference);
  const hypothesisWords = normalise(hypothesis);

  if (referenceWords.length === 0) {
    return hypothesisWords.length === 0 ? 0 : 1;
  }

  let previous = Array.from({ length: hypothesisWords.length + 1 }, (_unused, index) => index);

  for (let i = 1; i <= referenceWords.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= hypothesisWords.length; j += 1) {
      const substitution = previous[j - 1] + (referenceWords[i - 1] === hypothesisWords[j - 1] ? 0 : 1);

      current[j] = Math.min(substitution, previous[j] + 1, current[j - 1] + 1);
    }

    previous = current;
  }

  return previous[hypothesisWords.length] / referenceWords.length;
}

/**
 * Casing and punctuation are not what this experiment is measuring — the app
 * rewrites the sentence anyway. Only the words themselves count.
 *
 * Russian ё is folded into е because writing it is optional in Russian and
 * whisper omits it; counting that as a misheard word inflates the error rate
 * with something no reader would notice. Ukrainian і, и and ї are left alone:
 * there they are separate letters and confusing them is a real mistake.
 */
export function normalise(text) {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s'’-]/gu, ' ')
    .replace(/[’']/g, "'")
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * A half-downloaded model fails deep inside whisper.cpp with a tensor count
 * mismatch, which reads like a corrupt build rather than an incomplete file.
 */
async function checkModels(directory) {
  const MINIMUM_BYTES = 100 * 1024 * 1024;

  for (const model of MODELS) {
    const path = join(directory, model.file);
    const info = await stat(path).catch(() => null);

    if (info === null) {
      fail(`Missing model: ${path}`);
    }

    if (info.size < MINIMUM_BYTES) {
      fail(
        `${path} is only ${(info.size / 1024 / 1024).toFixed(0)}MB — the download is ` +
          'incomplete. Re-download it before running the experiment.',
      );
    }
  }
}

async function readReferences(path) {
  const raw = await readFile(path, 'utf8').catch(() => {
    fail(`Missing ${path}. One line per take: filename <TAB> uk|ru|mix <TAB> what was said`);
  });

  const references = new Map();

  for (const line of raw.split('\n')) {
    if (line.trim().length === 0 || line.startsWith('#')) {
      continue;
    }

    const [file, language, ...rest] = line.split('\t');

    if (file === undefined || language === undefined || rest.length === 0) {
      console.warn(`! Skipping malformed line: ${line}`);
      continue;
    }

    references.set(file.trim(), { language: language.trim(), text: rest.join('\t').trim() });
  }

  return references;
}

function report(rows) {
  console.log('\n=== word error rate by language and model ===');
  console.log('language  model            takes   mean WER   median WER');

  for (const language of ['uk', 'ru', 'mix']) {
    for (const model of MODELS) {
      const matching = rows.filter((row) => row.language === language && row.model === model.id);

      if (matching.length === 0) {
        continue;
      }

      const rates = matching.map((row) => row.wer).sort((a, b) => a - b);
      const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;

      console.log(
        `${language.padEnd(9)} ${model.id.padEnd(16)} ${String(matching.length).padEnd(7)} ` +
          `${mean.toFixed(3).padEnd(10)} ${rates[Math.floor(rates.length / 2)].toFixed(3)}`,
      );
    }
  }

  console.log('\n=== worst takes, where the transcript would mislead the analyzer ===');
  for (const row of [...rows].sort((a, b) => b.wer - a.wer).slice(0, 8)) {
    console.log(`\n${row.file} [${row.language}] ${row.model} wer=${row.wer.toFixed(3)}`);
    console.log(`  said:  ${row.reference}`);
    console.log(`  heard: ${row.hypothesis}`);
  }

  console.log('\nWall time is desktop Intel and says nothing about a phone.');
  console.log('It is here only to compare the two models against each other.');
}

function readOptions(argv) {
  const options = { recordings: null, models: null };

  for (let index = 0; index < argv.length; index += 2) {
    if (argv[index] === '--recordings') {
      options.recordings = resolve(argv[index + 1] ?? '');
    }

    if (argv[index] === '--models') {
      options.models = resolve(argv[index + 1] ?? '');
    }
  }

  if (options.recordings === null || options.models === null) {
    fail('Usage: node scripts/whisper-experiment.mjs --recordings <dir> --models <dir>');
  }

  return options;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (process.argv[1]?.endsWith('whisper-experiment.mjs')) {
  await main();
}
