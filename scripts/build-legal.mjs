/**
 * The documents in `legal/` are the source. This turns them into the JSON the
 * app reads, so the pages on the website and the screens in the app are the
 * same text rather than two texts that agree for a month.
 *
 * Run it after editing anything in `legal/`:
 *
 *     node scripts/build-legal.mjs
 *
 * Absolute rule 1 is why the output is JSON and not a module: Ukrainian is
 * data, and data lives outside the source files.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'i18n', 'legal');

const DOCUMENTS = [
  ['TERMS.uk.md', 'terms.uk.json'],
  ['TERMS.en.md', 'terms.en.json'],
  ['PRIVACY.uk.md', 'privacy.uk.json'],
  ['PRIVACY.en.md', 'privacy.en.json'],
];

/**
 * Emphasis survives as single asterisks, which the screen splits on. Links and
 * the bracketed slots keep their text: a URL nobody can tap still tells you
 * where to look, and a slot left visible is the point of a slot.
 */
function inline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$2');
}

function convert(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];
  let title = '';
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith('# ')) {
      title = line.slice(2);
      index += 1;
    } else if (line.startsWith('## ')) {
      blocks.push({ heading: inline(line.slice(3)) });
      index += 1;
    } else if (line.startsWith('### ')) {
      blocks.push({ sub: inline(line.slice(4)) });
      index += 1;
    } else if (line.startsWith('|')) {
      const rows = [];

      while (index < lines.length && lines[index].startsWith('|')) {
        const cells = lines[index].slice(1, -1).split('|').map((cell) => cell.trim());

        // The header and the dashes under it carry nothing a phone can show:
        // a three-column table becomes a term and the things said about it.
        if (!cells.every((cell) => /^-+$/.test(cell))) {
          rows.push(cells.map(inline));
        }

        index += 1;
      }

      blocks.push({ rows: rows.slice(1) });
    } else if (line.startsWith('- ')) {
      const items = [];

      while (index < lines.length && (lines[index].startsWith('- ') || (lines[index].startsWith('  ') && lines[index].trim() && items.length > 0))) {
        if (lines[index].startsWith('- ')) {
          items.push(lines[index].slice(2));
        } else {
          items[items.length - 1] += ` ${lines[index].trim()}`;
        }

        index += 1;
      }

      blocks.push({ bullets: items.map(inline) });
    } else if (line.trim() === '') {
      index += 1;
    } else {
      const paragraph = [];

      while (index < lines.length && lines[index].trim() && !/^(#|\||- )/.test(lines[index])) {
        paragraph.push(lines[index].trim());
        index += 1;
      }

      blocks.push({ text: inline(paragraph.join(' ')) });
    }
  }

  return { title, blocks };
}

/*
 * `--check` runs in the lint pass. A privacy policy on the website that has
 * stopped matching the one in the app is the one kind of drift here that is
 * nobody's opinion — it is two different promises to the same person.
 */
const checking = process.argv.includes('--check');
const stale = [];

mkdirSync(OUT, { recursive: true });

for (const [source, target] of DOCUMENTS) {
  const document = convert(readFileSync(join(ROOT, 'legal', source), 'utf8'));
  const built = `${JSON.stringify(document, null, 2)}\n`;
  const path = join(OUT, target);

  if (checking) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== built) {
      stale.push(target);
    }

    continue;
  }

  writeFileSync(path, built, 'utf8');
  console.log(`${target}  ${document.blocks.length} blocks`);
}

if (checking) {
  if (stale.length > 0) {
    console.error(`legal/ has moved on and these have not: ${stale.join(', ')}`);
    console.error('Run: node scripts/build-legal.mjs');
    process.exit(1);
  }

  console.log(`Legal documents are in step (${DOCUMENTS.length} files).`);
}
