/**
 * The public pages for the two legal documents, built out of `legal/*.md` —
 * the same source the in-app screens read, so the website and the app cannot
 * drift apart. App Store Connect requires a privacy policy URL that works
 * before the app is ever installed; this is that page.
 *
 *     node scripts/build-legal-site.mjs   # writes legal/site/
 *     npx wrangler pages deploy legal/site --project-name=vidlun-legal
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'legal', 'site');

const PAGES = [
  { source: 'PRIVACY.uk.md', path: 'privacy.html', lang: 'uk', other: 'privacy-en.html', kind: 'privacy' },
  { source: 'PRIVACY.en.md', path: 'privacy-en.html', lang: 'en', other: 'privacy.html', kind: 'privacy' },
  { source: 'TERMS.uk.md', path: 'terms.html', lang: 'uk', other: 'terms-en.html', kind: 'terms' },
  { source: 'TERMS.en.md', path: 'terms-en.html', lang: 'en', other: 'terms.html', kind: 'terms' },
];

const LABELS = {
  uk: { other: 'English', privacy: 'Приватність', terms: 'Умови', toPrivacy: 'privacy.html', toTerms: 'terms.html' },
  en: { other: 'Українська', privacy: 'Privacy', terms: 'Terms', toPrivacy: 'privacy-en.html', toTerms: 'terms-en.html' },
};

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`(\[[^`]+\])`/g, '<code class="slot">$1</code>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/&lt;(https?:\/\/[^&]+?)&gt;/g, '<a href="$1">$1</a>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function convert(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let title = '';
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith('# ')) {
      title = line.slice(2);
      out.push(`<h1>${inline(title)}</h1>`);
      index += 1;
    } else if (line.startsWith('## ')) {
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      index += 1;
    } else if (line.startsWith('### ')) {
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      index += 1;
    } else if (line.startsWith('|')) {
      const rows = [];

      while (index < lines.length && lines[index].startsWith('|')) {
        const cells = lines[index].slice(1, -1).split('|').map((cell) => cell.trim());

        if (!cells.every((cell) => /^-+$/.test(cell))) {
          rows.push(cells.map(inline));
        }

        index += 1;
      }

      const [head, ...body] = rows;
      out.push(
        '<div class="scroller"><table><thead><tr>' +
          head.map((cell) => `<th>${cell}</th>`).join('') +
          '</tr></thead><tbody>' +
          body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('') +
          '</tbody></table></div>',
      );
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

      out.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    } else if (line.trim() === '') {
      index += 1;
    } else {
      const paragraph = [];

      while (index < lines.length && lines[index].trim() && !/^(#|\||- )/.test(lines[index])) {
        paragraph.push(lines[index].trim());
        index += 1;
      }

      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }
  }

  return { title, body: out.join('\n') };
}

function page({ title, body, lang, other, kind }) {
  const labels = LABELS[lang];
  const nav = [
    `<a href="./${labels.toPrivacy}"${kind === 'privacy' ? ' aria-current="page"' : ''}>${labels.privacy}</a>`,
    `<a href="./${labels.toTerms}"${kind === 'terms' ? ' aria-current="page"' : ''}>${labels.terms}</a>`,
    `<a href="./${other}" class="lang">${labels.other}</a>`,
  ].join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
:root {
  --canvas: #FBF7F0; --paper: #FFFCF6; --ink: #16181D; --ink-soft: #6C6F78;
  --line: #E2DACB; --line-soft: #F7F1E6; --accent-ink: #3226BF;
  --slot-bg: #F7EEDC; --slot-ink: #8A5D12; --slot-line: #E4D2AE;
}
@media (prefers-color-scheme: dark) {
  :root {
    --canvas: #14161B; --paper: #1B1E25; --ink: #F2EEE6; --ink-soft: #A9AEB8;
    --line: #2C313B; --line-soft: #232833; --accent-ink: #A79BFF;
    --slot-bg: #2E2519; --slot-ink: #F5C766; --slot-line: #4A3B22;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--canvas); color: var(--ink);
  font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
header {
  border-bottom: 1px solid var(--line); background: var(--paper);
  padding: 14px 20px; display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap;
}
header .brand { font-weight: 700; letter-spacing: -0.02em; margin-right: auto; }
header a { color: var(--ink-soft); text-decoration: none; font-size: 14.5px; }
header a[aria-current="page"] { color: var(--ink); border-bottom: 2px solid var(--accent-ink); padding-bottom: 2px; }
header a.lang { color: var(--accent-ink); }
main { max-width: 68ch; margin: 0 auto; padding: 40px 20px 90px; }
h1 { font-size: clamp(26px, 4vw, 34px); line-height: 1.2; letter-spacing: -0.02em; margin: 0 0 24px; text-wrap: balance; }
h2 { font-size: 19px; margin: 40px 0 12px; padding-top: 20px; border-top: 1px solid var(--line); text-wrap: balance; }
h3 { font-size: 16px; margin: 26px 0 8px; }
p { margin: 0 0 15px; }
ul { margin: 0 0 17px; padding-left: 20px; }
li { margin-bottom: 6px; }
a { color: var(--accent-ink); text-underline-offset: 3px; }
.scroller { overflow-x: auto; margin: 0 0 22px; border: 1px solid var(--line); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 14px; background: var(--paper); }
th, td { text-align: left; padding: 10px 13px; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-soft); background: var(--line-soft); }
tr:last-child td { border-bottom: 0; }
code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: .88em; }
code.slot { background: var(--slot-bg); color: var(--slot-ink); border: 1px solid var(--slot-line); border-radius: 5px; padding: 1px 6px; white-space: nowrap; }
</style>
</head>
<body>
<header><span class="brand">Vidlun</span>${nav}</header>
<main>
${body}
</main>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });

for (const entry of PAGES) {
  const { title, body } = convert(readFileSync(join(ROOT, 'legal', entry.source), 'utf8'));

  writeFileSync(join(OUT, entry.path), page({ title, body, ...entry }), 'utf8');
  console.log(entry.path);
}

// The root goes to the Ukrainian privacy policy: it is the page the store
// links to, and Ukrainian is the app's first language.
writeFileSync(
  join(OUT, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./privacy.html"><a href="./privacy.html">Privacy</a>\n',
  'utf8',
);
writeFileSync(join(OUT, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n', 'utf8');
console.log('index.html');
