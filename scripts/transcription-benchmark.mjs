#!/usr/bin/env node
// The run §1d asked for: Whisper as the fixed point and Parakeet as a number
// for the first time on this set — same takes, same references, same metric.
//
// Both go through the homebrew CLIs over the same whisper.cpp the phone runs,
// so word error rate carries over to the device even though wall time does not.
//
// A cloud row lived here too until Gemini was removed; see BACKLOG §1g for the
// numbers it produced and why they did not survive contact with the product.
//
//   node scripts/transcription-benchmark.mjs \
//     --recordings ~/vidlun-whisper/recordings-real/audio \
//     --models ~/vidlun-whisper/models
//
// The recordings directory holds one audio file per take plus a
// transcripts.tsv: filename <TAB> uk|ru|mix <TAB> what was actually said.
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { wordErrorRate } from './whisper-experiment.mjs';

const run = promisify(execFile);
const AUDIO_EXTENSIONS = new Set(['.m4a', '.mp3', '.wav', '.aac', '.caf', '.ogg']);

const WHISPER_MODEL = 'ggml-large-v3-turbo-q5_0.bin';
const PARAKEET_MODEL = 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin';

async function main() {
  const options = readOptions(process.argv.slice(2));
  const references = await readReferences(join(options.recordings, 'transcripts.tsv'));
  const engines = await buildEngines(options);
  const workDir = join(options.recordings, '.wav');

  await mkdir(workDir, { recursive: true });

  const files = (await readdir(options.recordings))
    .filter((name) => AUDIO_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort();

  if (files.length === 0) {
    fail(`No audio files in ${options.recordings}`);
  }

  const rows = options.merge === null ? [] : await readRows(options.merge, engines);

  for (const file of files) {
    const reference = references.get(file);

    if (reference === undefined) {
      console.warn(`! ${file} has no line in transcripts.tsv — skipped`);
      continue;
    }

    const wav = join(workDir, `${basename(file, extname(file))}.wav`);

    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', join(options.recordings, file),
      '-ar', '16000', '-ac', '1', wav,
    ]);

    const audioSeconds = await durationOf(wav);

    for (const engine of engines) {
      let attempt;

      try {
        attempt = await engine.transcribe(wav);
      } catch (failure) {
        console.log(`${file}  ${engine.id.padEnd(16)} FAILED: ${failure.message}`);
        continue;
      }

      const { text: hypothesis, ms } = attempt;
      const seconds = ms / 1000;
      const wer = wordErrorRate(reference.text, hypothesis);

      rows.push({
        file,
        language: reference.language,
        engine: engine.id,
        seconds,
        audioSeconds,
        wer,
        hypothesis,
        reference: reference.text,
      });

      console.log(
        `${file}  ${engine.id.padEnd(16)} wer=${wer.toFixed(3)}  ${seconds.toFixed(1)}s`,
      );
    }
  }

  report(rows, orderedEngines(rows, engines));

  if (options.out !== null) {
    await writeFile(options.out, JSON.stringify(rows, null, 2), 'utf8');
    console.log(`\nRows written to ${options.out}`);
  }
}

async function buildEngines(options) {
  const engines = [];

  if (options.engines.has('whisper')) {
    const model = await requireModel(options.models, WHISPER_MODEL);

    engines.push({
      id: 'whisper-q5_0',
      // Auto, because the app cannot know which language a sentence will be in.
      transcribe: (wav) =>
        timed(async () => {
          const { stdout } = await run('whisper-cli', [
            '-m', model, '-f', wav, '-l', 'auto', '--no-timestamps', '--output-txt', 'false',
          ]);

          return stdout.trim();
        }),
    });
  }

  if (options.engines.has('whisper-beam')) {
    const model = await requireModel(options.models, WHISPER_MODEL);

    engines.push({
      id: 'whisper-beam5',
      // Beam search over greedy, and the language pinned the way the app
      // could pin it: both changes cost nothing at runtime.
      transcribe: (wav) =>
        timed(async () => {
          const { stdout } = await run('whisper-cli', [
            '-m', model, '-f', wav, '-l', 'uk', '-bs', '5',
            '--no-timestamps', '--output-txt', 'false',
          ]);

          return stdout.trim();
        }),
    });
  }

  if (options.engines.has('whisper-prompt')) {
    const model = await requireModel(options.models, WHISPER_MODEL);
    const prompt = await vocabularyPrompt();

    engines.push({
      id: 'whisper-prompt',
      // The person's own emotion vocabulary as the prompt — words the app
      // legitimately knows before the take, aimed at exactly the rare-word
      // confusions the takes showed. Whisper reads only the last 224 tokens,
      // so the list stays short.
      transcribe: (wav) =>
        timed(async () => {
          const { stdout } = await run('whisper-cli', [
            '-m', model, '-f', wav, '-l', 'uk', '-bs', '5', '--prompt', prompt,
            '--no-timestamps', '--output-txt', 'false',
          ]);

          return stdout.trim();
        }),
    });
  }

  if (options.engines.has('parakeet')) {
    const model = await requireModel(options.models, PARAKEET_MODEL);

    engines.push({
      id: 'parakeet-q8_0',
      // It takes no language hint: the model is multilingual without one.
      transcribe: (wav) =>
        timed(async () => {
          const { stdout } = await run('parakeet-cli', ['-m', model, '-f', wav]);

          return stdout.trim();
        }),
    });
  }

  if (engines.length === 0) {
    fail('No engines selected. Use --engines whisper,parakeet');
  }

  return engines;
}

/**
 * Every engine times its own work. The first run timed the loop instead, which
 * charged the cloud for the quota pause in front of it and reported 15 seconds
 * for a call that took three.
 */
/**
 * The emotion labels the app ships, trimmed to fit the 224-token window.
 * Read from the locale file so the words live where words live.
 */
async function vocabularyPrompt() {
  const labels = JSON.parse(
    await readFile(new URL('../src/i18n/locales/emotions.uk.json', import.meta.url), 'utf8'),
  );

  return Object.values(labels).slice(0, 40).join(', ');
}

async function timed(work) {
  const startedAt = Date.now();

  return { text: await work(), ms: Date.now() - startedAt };
}

async function durationOf(wav) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    wav,
  ]);

  return Number.parseFloat(stdout.trim());
}

function report(rows, engines) {
  const ids = engines.map((engine) => engine.id);

  console.log('\n=== word error rate, all takes ===');
  console.log('engine            takes   mean WER   median WER   sec/take   x realtime');

  for (const id of ids) {
    const matching = rows.filter((row) => row.engine === id);

    if (matching.length === 0) {
      continue;
    }

    const rates = matching.map((row) => row.wer).sort((a, b) => a - b);
    const audio = matching.reduce((sum, row) => sum + row.audioSeconds, 0);
    const wall = matching.reduce((sum, row) => sum + row.seconds, 0);

    console.log(
      `${id.padEnd(17)} ${String(matching.length).padEnd(7)} ` +
        `${mean(rates).toFixed(3).padEnd(10)} ${median(rates).toFixed(3).padEnd(12)} ` +
        `${(wall / matching.length).toFixed(2).padEnd(10)} ${(audio / wall).toFixed(1)}`,
    );
  }

  console.log('\n=== by language ===');
  console.log('language  engine            takes   mean WER');

  for (const language of ['uk', 'ru', 'mix']) {
    for (const id of ids) {
      const matching = rows.filter((row) => row.language === language && row.engine === id);

      if (matching.length === 0) {
        continue;
      }

      console.log(
        `${language.padEnd(9)} ${id.padEnd(17)} ${String(matching.length).padEnd(7)} ` +
          `${mean(matching.map((row) => row.wer)).toFixed(3)}`,
      );
    }
  }

  console.log('\n=== where they disagree, worst first ===');
  console.log('WER weighs every word the same and this product does not: a real');
  console.log('word in the wrong tense costs nothing, an invented one costs the');
  console.log('entry. Read these, do not just rank them.\n');

  const byFile = new Map();

  for (const row of rows) {
    byFile.set(row.file, [...(byFile.get(row.file) ?? []), row]);
  }

  const spread = [...byFile.entries()]
    .map(([file, takes]) => ({
      file,
      takes,
      gap: Math.max(...takes.map((t) => t.wer)) - Math.min(...takes.map((t) => t.wer)),
    }))
    .sort((a, b) => b.gap - a.gap);

  for (const { file, takes } of spread.slice(0, 6)) {
    console.log(`${file} [${takes[0].language}]`);
    console.log(`  said:            ${takes[0].reference}`);

    for (const take of takes) {
      console.log(`  ${take.engine.padEnd(16)} ${take.wer.toFixed(3)}  ${take.hypothesis}`);
    }

    console.log('');
  }

  console.log('Wall time is this desktop and says nothing about a phone, except');
  console.log('for the cloud rows: those are a network round trip either way.');
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Earlier rows, minus any engine this run is measuring again. */
async function readRows(path, engines) {
  const measuring = new Set(engines.map((engine) => engine.id));
  const previous = JSON.parse(await readFile(path, 'utf8'));

  return previous.filter((row) => !measuring.has(row.engine));
}

/** Merged rows carry engines this run knows nothing about; the report needs them all. */
function orderedEngines(rows, engines) {
  const ids = [...new Set(rows.map((row) => row.engine))];

  return ids.map((id) => engines.find((engine) => engine.id === id) ?? { id });
}

async function requireModel(directory, file) {
  const path = join(directory, file);
  const info = await stat(path).catch(() => null);

  if (info === null) {
    fail(`Missing model: ${path}`);
  }

  return path;
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

function readOptions(argv) {
  const options = {
    recordings: null,
    models: null,
    engines: new Set(['whisper', 'parakeet']),
    out: null,
    merge: null,
  };

  for (let index = 0; index < argv.length; index += 2) {
    const value = argv[index + 1] ?? '';

    if (argv[index] === '--recordings') {
      options.recordings = resolve(expandHome(value));
    }

    if (argv[index] === '--models') {
      options.models = resolve(expandHome(value));
    }

    if (argv[index] === '--engines') {
      options.engines = new Set(value.split(',').map((name) => name.trim()));
    }

    if (argv[index] === '--out') {
      options.out = resolve(expandHome(value));
    }

    // Rows from an earlier run, reported alongside this one. The local engines
    // are deterministic and cost nothing but time; the cloud is the half worth
    // running again on its own.
    if (argv[index] === '--merge') {
      options.merge = resolve(expandHome(value));
    }
  }

  if (options.recordings === null || options.models === null) {
    fail(
      'Usage: node scripts/transcription-benchmark.mjs --recordings <dir> --models <dir> ' +
        '[--engines whisper,parakeet] [--out rows.json]',
    );
  }

  return options;
}

/** Node does not expand ~, and every path in these notes is written with one. */
function expandHome(path) {
  return path.startsWith('~/') ? join(process.env.HOME ?? '', path.slice(2)) : path;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

await main();
