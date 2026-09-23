#!/usr/bin/env node
/**
 * Builds the landing page: one HTML file per language into legal/site
 * (the Cloudflare Pages root), from site/src/copy.json and the templates
 * below. No framework, no runtime: the page is static HTML with inline CSS,
 * one small inline script for the theme switch, and the screenshots that
 * site/shots.sh produced into site/shots (tracked; legal/site is not — it
 * is rebuilt before every deploy, so everything the page needs is copied in
 * here: the screenshots and the _headers file). `--preview` also writes
 * site/preview-<lang>.html, the same page without the document skeleton,
 * for the Artifact viewer.
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'legal', 'site');
const COPY = JSON.parse(readFileSync(join(ROOT, 'site', 'src', 'copy.json'), 'utf8'));
const SITE = 'https://vidlun.app';
const APP_STORE = 'https://apps.apple.com/app/id6806530807';
const preview = process.argv.includes('--preview');

const escape = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A screenshot in both themes (the system theme picks, the switch overrides)
 * and two densities: 640 px for 1x screens, 960 px for anything denser.
 */
function shot(lang, name, alt, { eager = false } = {}) {
  const base = (theme) => `shots/${lang}-${name}-${theme}`;
  const avif = (theme) => `${base(theme)}-640.avif 1x, ${base(theme)}-960.avif 1.5x`;
  const loading = eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<picture class="shot">
  <source data-dark srcset="${avif('dark')}" type="image/avif" media="(prefers-color-scheme: dark)">
  <source data-dark srcset="${base('dark')}-640.jpg" media="(prefers-color-scheme: dark)">
  <source srcset="${avif('light')}" type="image/avif">
  <img src="${base('light')}-640.jpg" width="640" height="1391" alt="${escape(alt)}" ${loading}>
</picture>`;
}

/** The headline with its one lime mark, the identity's highlight behind a headline. */
function headline(title, mark) {
  const safe = escape(title);
  const marked = escape(mark);
  return safe.includes(marked) ? safe.replace(marked, `<mark class="hl">${marked}</mark>`) : safe;
}

/** The vocabulary in a row; `twin` is the second copy the loop needs. */
function words(list, twin = false) {
  return list
    .map(([word, tone]) => `<li${twin ? ' class="twin"' : ''} style="--tone:var(--${tone})">${escape(word)}</li>`)
    .join('');
}

/** The small drawing a feature card carries: a voice wave, a few chips, a week of bars. */
function art(kind, list) {
  if (kind === 'wave') {
    const heights = [18, 34, 52, 26, 60, 40, 22, 48, 30, 56, 36, 20, 44, 28];
    return `<div class="art wave" aria-hidden="true">${heights.map((h) => `<i style="--h:${h}px"></i>`).join('')}</div>`;
  }
  if (kind === 'chips') {
    return `<div class="art chips" aria-hidden="true">${list.slice(0, 6).map(([word, tone]) => `<i style="--tone:var(--${tone})">${escape(word)}</i>`).join('')}</div>`;
  }
  const week = [['warm', 40], ['calm', 60], ['low', 28], ['calm', 60], ['calm', 60], ['low', 28], ['calm', 60]];
  return `<div class="art bars" aria-hidden="true">${week.map(([tone, h]) => `<i style="--tone:var(--${tone});--h:${h}px"></i>`).join('')}</div>`;
}

const CSS = `
:root{--canvas:#FBF7F0;--paper:#FFFCF6;--ink:#16181D;--ink-soft:#6C6F78;--ink-faint:#8A8D95;--line:#E2DACB;--line-soft:#F7F1E6;--accent:#4433E0;--accent-ink:#3226BF;--accent-soft:#E8E5FD;--lime:#D7F26B;--lime-soft:#EEF6D2;--panel:#16181D;--on-panel:#FBF7F0;--on-panel-soft:rgba(251,247,240,.7);--on-panel-line:rgba(251,247,240,.16);--panel-glow:rgba(215,242,107,.3);--bezel:#16181D;--shadow:0 34px 70px -34px rgba(22,24,29,.45);--calm:#2E8B6A;--warm:#B8860B;--cool:#3A7CA5;--low:#B5602F;--violet:#8A4FD1;--glow1:rgba(215,242,107,.55);--glow2:rgba(232,229,253,.9);--numeral:#C9C2F5;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--canvas:#14161B;--paper:#1B1E25;--ink:#F2EEE6;--ink-soft:#A9AEB8;--ink-faint:#8B9099;--line:#2C313B;--line-soft:#232833;--accent:#8B7BFF;--accent-ink:#A79BFF;--accent-soft:#232149;--lime:#AFD64A;--lime-soft:#27311C;--panel:#22262F;--on-panel:#F2EEE6;--on-panel-soft:rgba(242,238,230,.7);--on-panel-line:rgba(242,238,230,.14);--panel-glow:rgba(175,214,74,.2);--bezel:#2A2F38;--shadow:0 34px 70px -34px rgba(0,0,0,.7);--calm:#6FCBA6;--warm:#E2B23B;--cool:#7FB6DE;--low:#E0875C;--violet:#B79BFF;--glow1:rgba(175,214,74,.16);--glow2:rgba(139,123,255,.16);--numeral:#5A4FA0;color-scheme:dark}}
:root[data-theme="dark"]{--canvas:#14161B;--paper:#1B1E25;--ink:#F2EEE6;--ink-soft:#A9AEB8;--ink-faint:#8B9099;--line:#2C313B;--line-soft:#232833;--accent:#8B7BFF;--accent-ink:#A79BFF;--accent-soft:#232149;--lime:#AFD64A;--lime-soft:#27311C;--panel:#22262F;--on-panel:#F2EEE6;--on-panel-soft:rgba(242,238,230,.7);--on-panel-line:rgba(242,238,230,.14);--panel-glow:rgba(175,214,74,.2);--bezel:#2A2F38;--shadow:0 34px 70px -34px rgba(0,0,0,.7);--calm:#6FCBA6;--warm:#E2B23B;--cool:#7FB6DE;--low:#E0875C;--violet:#B79BFF;--glow1:rgba(175,214,74,.16);--glow2:rgba(139,123,255,.16);--numeral:#5A4FA0;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--canvas);color:var(--ink);font:400 17px/1.55 "IBM Plex Sans",-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding-inline:clamp(16px,4vw,32px)}
img{max-width:100%;display:block}
a{color:var(--accent-ink)}
a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
h1,h2,h3{font-family:Unbounded,"IBM Plex Sans",-apple-system,sans-serif;font-weight:500;letter-spacing:-.02em;line-height:1.12;margin:0;text-wrap:balance}
h1{font-size:clamp(30px,4.6vw,52px)}
h2{font-size:clamp(24px,3.2vw,36px)}
h3{font-size:19px;letter-spacing:-.01em;line-height:1.3}
p{margin:0;max-width:62ch}
.wrap{max-width:1120px;margin-inline:auto}
.top{position:sticky;top:0;z-index:20;margin-inline:calc(-1 * clamp(16px,4vw,32px));padding-inline:clamp(16px,4vw,32px);border-bottom:1px solid var(--line);background:var(--canvas);background:color-mix(in srgb,var(--canvas) 82%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.top-in{display:flex;align-items:center;gap:14px 22px;flex-wrap:wrap;padding-block:12px}
@supports (animation-timeline: scroll()){.top{animation:stick both;animation-timeline:scroll(root);animation-range:0px 120px}@keyframes stick{from{background:transparent;border-color:transparent}to{background:color-mix(in srgb,var(--canvas) 82%,transparent);border-color:var(--line)}}}
section{scroll-margin-top:72px}
.brand{font-family:Unbounded,sans-serif;font-weight:500;font-size:22px;letter-spacing:-.03em;color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;gap:9px}
.brand svg{width:26px;height:16px}
.nav{display:flex;gap:4px 18px;flex-wrap:wrap;margin-inline:auto;font-size:15px}
.nav a{color:var(--ink-soft);text-decoration:none;padding:6px 2px}
.nav a:hover{color:var(--ink)}
.tools{display:flex;align-items:center;gap:12px;margin-left:auto}
.lang{font-size:15px;color:var(--ink-soft);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:7px 13px;background:var(--paper)}
.lang:hover{color:var(--ink)}
.theme{display:inline-flex;border:1px solid var(--line);border-radius:999px;background:var(--paper);padding:3px}
.theme button{font:inherit;color:var(--ink-soft);background:none;border:0;border-radius:999px;padding:6px 10px;cursor:pointer;display:inline-flex;align-items:center}
.theme button:hover{color:var(--ink)}
.theme svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.theme button span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:520px){.top-in{gap:10px}.brand{font-size:20px}.lang{font-size:14px;padding:6px 10px}.theme button{padding:6px 9px}}
.theme button[aria-pressed="true"]{background:var(--ink);color:var(--canvas)}
@media (max-width:900px){.nav{display:none}.tools{margin-left:auto}}
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:32px 48px;align-items:center;padding-block:clamp(36px,7vw,84px) clamp(28px,5vw,64px)}
body{position:relative;isolation:isolate}
body::before{content:"";position:absolute;left:0;right:0;top:0;height:min(120vh,1080px);z-index:-1;pointer-events:none;background:radial-gradient(40% 55% at 10% 22%,var(--glow1),transparent 70%),radial-gradient(36% 50% at 86% 52%,var(--glow2),transparent 70%)}
.hl{background:none;color:inherit;position:relative;white-space:nowrap}
.hl::before{content:"";position:absolute;left:-.08em;right:-.08em;top:.84em;height:.24em;background:var(--lime);border-radius:.12em;transform:rotate(-1deg);z-index:-1;transform-origin:left;animation:mark .7s .5s cubic-bezier(.2,.9,.3,1) both}
@keyframes mark{from{transform:scaleX(0) rotate(-1deg)}to{transform:scaleX(1) rotate(-1deg)}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.hero>div>*{animation:rise .6s cubic-bezier(.2,.9,.3,1) both}
.hero>div>:nth-child(2){animation-delay:.08s}.hero>div>:nth-child(3){animation-delay:.16s}
.hero .phone{animation:rise .8s .15s cubic-bezier(.2,.9,.3,1) both}
@media (prefers-reduced-motion: reduce){.hero>div>*,.hero .phone,.hl::before{animation:none}}
.eyebrow{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);margin-bottom:18px}
.cta{display:flex;flex-direction:column;align-items:flex-start;gap:14px;margin-top:34px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;font-weight:500;text-decoration:none;border-radius:999px;padding:16px 24px;background:var(--ink);color:var(--canvas);font-size:17px;white-space:nowrap}
@media (max-width:520px){.btn,.how{width:100%;font-size:16px;padding:15px 18px}.cta{gap:12px}}
.btn svg{width:18px;height:18px;fill:currentColor}
.btn:hover{opacity:.92}
.how{display:inline-flex;align-items:center;justify-content:center;gap:10px;font-weight:500;font-size:17px;color:var(--ink);text-decoration:none;border:1.5px solid var(--ink);border-radius:999px;padding:14px 22px;transition:background .2s,color .2s}
.how:hover{background:var(--ink);color:var(--canvas)}
.how svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;animation:bob 1.8s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(3px)}}
@media (prefers-reduced-motion: reduce){.how svg{animation:none}}
.note{font-size:14px;color:var(--ink-faint);margin-top:14px}
.phone{width:min(300px,78vw);margin-inline:auto;aspect-ratio:1206/2622;border-radius:13.5%/6.2%;padding:3.2%;background:var(--bezel);box-shadow:var(--shadow);transition:rotate .5s cubic-bezier(.2,.9,.3,1)}
.phone:hover{rotate:0deg}
.phone .shot,.phone img{width:100%;height:100%;border-radius:11%/5.1%;object-fit:cover;background:var(--paper)}
.hero .phone{width:min(320px,80vw);rotate:-2.5deg}
@media (max-width:860px){.hero{grid-template-columns:1fr;text-align:left}.hero .phone{margin-top:8px}}
.words{overflow:hidden;padding-block:8px 4px;mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.words ul{display:flex;gap:10px;list-style:none;margin:0;padding:0;width:max-content;animation:slide 48s linear infinite}
.words:hover ul{animation-play-state:paused}
.words li{border:1.5px solid var(--tone);color:var(--tone);border-radius:999px;padding:9px 16px;font-size:15px;white-space:nowrap;background:var(--paper)}
@keyframes slide{to{transform:translateX(-50%)}}
@media (prefers-reduced-motion: reduce){.words{mask-image:none;-webkit-mask-image:none}.words ul{animation:none;width:auto;flex-wrap:wrap}.words li.twin{display:none}}
section{padding-block:clamp(40px,7vw,88px)}
.sub{color:var(--ink-soft);margin-top:12px;font-size:clamp(16px,1.4vw,18px)}
.steps{list-style:none;margin:36px 0 0;padding:0;display:grid;gap:clamp(36px,6vw,72px)}
.step{display:grid;grid-template-columns:1fr 1fr;gap:28px 56px;align-items:center}
.step:nth-child(even) .phone{order:-1}
.step .n{font-family:Unbounded,sans-serif;font-size:clamp(44px,6vw,72px);line-height:1;color:var(--numeral);margin-bottom:8px;letter-spacing:-.04em}
.step:nth-child(odd) .phone{rotate:2deg}.step:nth-child(even) .phone{rotate:-2deg}
@supports (animation-timeline: view()){
.features li,.plan,.panel,#how>h2,#how>.sub{animation:reveal both;animation-timeline:view();animation-range:entry 0% entry 40%}
.step .n{animation:pop both;animation-timeline:view();animation-range:cover 0% cover 22%}
.step h3,.step p{animation:reveal both;animation-timeline:view();animation-range:cover 0% cover 24%}
.step .phone{animation:phone-in both;animation-timeline:view();animation-range:entry 0% entry 50%}
@keyframes reveal{from{opacity:.001;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:.001;transform:translateY(18px) scale(.72)}to{opacity:1;transform:none}}
@keyframes phone-in{from{opacity:.001;transform:translateY(64px) scale(.9)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.features li,.plan,.panel,#how>h2,#how>.sub,.step .n,.step h3,.step p,.step .phone{animation:none}}
}
.step h3{font-size:clamp(22px,2.4vw,28px)}
.step p{margin-top:12px;color:var(--ink-soft);font-size:18px}
@media (max-width:860px){.step{grid-template-columns:1fr;gap:20px}.step:nth-child(even) .phone{order:0}.step .phone{width:min(260px,72vw);margin-inline:0}}
.features{list-style:none;margin:32px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.features li{background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:22px 22px 24px;display:flex;flex-direction:column;gap:6px}
.art{height:64px;display:flex;align-items:flex-end;gap:5px;margin-bottom:14px}
.art.wave{align-items:center}.art.wave i{display:block;width:5px;border-radius:3px;background:var(--accent);height:var(--h)}
.art.wave i:nth-child(3n){background:var(--lime)}
.art.chips{flex-wrap:wrap;align-items:flex-start;align-content:flex-start;gap:6px;height:auto;min-height:64px}
.art.chips i{font-style:normal;font-size:12px;border:1.5px solid var(--tone);color:var(--tone);border-radius:999px;padding:4px 10px}
.art.bars i{display:block;flex:1;border-radius:6px 6px 3px 3px;height:var(--h);background:var(--tone)}
.features li:hover .art.wave i{animation:pulse 1.1s ease-in-out infinite alternate}
@keyframes pulse{to{transform:scaleY(.55)}}
@media (prefers-reduced-motion: reduce){.features li:hover .art.wave i{animation:none}}
.features p{margin-top:8px;color:var(--ink-soft);font-size:16px}
@media (max-width:900px){.features{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.features{grid-template-columns:1fr}}
.panel{position:relative;isolation:isolate;overflow:hidden;background:var(--panel);color:var(--on-panel);border-radius:26px;padding:clamp(28px,5vw,56px);margin-block:8px}
.panel::before{content:"";position:absolute;right:-12%;bottom:-45%;width:min(62%,560px);aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,var(--panel-glow),transparent);pointer-events:none;z-index:-1}
.panel h2{color:var(--on-panel);font-size:clamp(30px,4.6vw,52px)}
.panel .hl::before{top:auto;bottom:-.1em;height:.16em}
.facts{list-style:none;margin:clamp(28px,4vw,44px) 0 0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:28px clamp(20px,3vw,40px)}
.facts li{border-top:1px solid var(--on-panel-line);padding-top:22px;min-width:0}
.facts svg{width:30px;height:30px;fill:none;stroke:var(--lime);stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;margin-bottom:18px}
.facts p{font-family:Unbounded,"IBM Plex Sans",sans-serif;font-weight:500;font-size:clamp(17px,1.5vw,20px);line-height:1.4;letter-spacing:-.01em;color:var(--on-panel);max-width:none}
@media (max-width:720px){.facts{grid-template-columns:1fr;gap:20px}.facts svg{margin-bottom:12px}}
.plan{background:var(--paper);border:1px solid var(--line);border-radius:26px;padding:clamp(22px,3.6vw,36px);margin-top:32px}
.plan-cols{display:grid;grid-template-columns:1fr 1fr;gap:24px clamp(24px,4vw,48px)}
.plan-cols>div+div{border-left:1px solid var(--line);padding-left:clamp(24px,4vw,48px)}
.plan ul{margin:14px 0 0;padding-left:18px;color:var(--ink-soft)}
.plan li{margin-top:6px}
.plan .free li::marker{color:var(--calm)}
.plan .paid li::marker{color:var(--accent-ink)}
.plan .note{margin-top:16px;max-width:none;font-size:13px}
.tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:28px;padding-top:28px;border-top:1px solid var(--line)}
.tier{position:relative;background:var(--canvas);border:1px solid var(--line);border-radius:18px;padding:18px 18px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}
.tier.pick{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.tier-name{font-size:14px;color:var(--ink-soft)}
.tier-price{font-family:Unbounded,sans-serif;font-size:clamp(22px,2.4vw,28px);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.tier-period{font-size:13px;color:var(--ink-faint);line-height:1.35}
.tier-saving{font-size:13px;color:var(--accent-ink);margin-top:4px}
.badge{position:absolute;top:-11px;left:14px;background:var(--lime);color:#16181D;font-size:12px;font-weight:500;border-radius:999px;padding:4px 10px;white-space:nowrap}
@media (max-width:720px){.plan-cols{grid-template-columns:1fr}.plan-cols>div+div{border-left:0;padding-left:0;border-top:1px solid var(--line);padding-top:24px}}
@media (max-width:560px){.tiers{grid-template-columns:1fr}.tier{flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:16px 14px}.tier-name{flex:1 0 100%}.tier-period{flex:1 0 100%}.badge{top:-10px}}
.faq{margin-top:24px;border-top:1px solid var(--line)}
.faq details{border-bottom:1px solid var(--line)}
.faq summary{cursor:pointer;list-style:none;padding:18px 0;font-weight:500;display:flex;justify-content:space-between;gap:16px;align-items:center}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--ink-faint);font-size:22px;line-height:1;flex-shrink:0}
.faq details[open] summary::after{content:"–"}
.faq p{padding-bottom:18px;color:var(--ink-soft)}
.end{text-align:center;padding-block:clamp(24px,5vw,56px) clamp(48px,8vw,96px)}
.end .cta{align-items:center}
footer{border-top:1px solid var(--line);padding-block:26px 34px;display:flex;flex-wrap:wrap;gap:10px 22px;font-size:14px;color:var(--ink-faint)}
footer a{color:var(--ink-soft);text-decoration:none}
footer a:hover{color:var(--ink)}
footer .made{margin-left:auto}
.skip{position:absolute;left:-999px;top:8px;background:var(--paper);padding:8px 12px;border-radius:8px}
.skip:focus{left:16px}
`;

const THEME_SCRIPT = `
(function(){var d=document.documentElement,key='vidlun-theme',mq=window.matchMedia('(prefers-color-scheme: dark)');
function stored(){try{return localStorage.getItem(key)||'system'}catch(e){return 'system'}}
function apply(t){if(t==='system'){delete d.dataset.theme}else{d.dataset.theme=t}
var m=t==='dark'?'all':t==='light'?'not all':'(prefers-color-scheme: dark)';
document.querySelectorAll('source[data-dark]').forEach(function(s){s.setAttribute('media',m)});
document.querySelectorAll('.theme button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.set===t))});}
window.vidlunTheme=function(t){try{localStorage.setItem(key,t)}catch(e){}apply(t)};
apply(stored());
document.addEventListener('DOMContentLoaded',function(){apply(stored())});
})();`;

/** The three privacy facts' icons: no account, audio on the phone, text with a lock. */
const FACTS = [
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7M3 3l18 18"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.6"/><path d="M9 11.5v1M11 9v6M13 10.5v3M15 8v8"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h9M4 16h6"/><rect x="14" y="14" width="7" height="6" rx="1.4"/><path d="M15.8 14v-1.6a1.7 1.7 0 0 1 3.4 0V14"/></svg>',
];

/** The theme switch's icons: a half-filled circle for the system, a sun, a moon. */
const THEME_ICONS = {
  system: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>',
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>',
};

/** The down arrow on the hero's second button. */
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

const MARK = `<svg viewBox="0 0 52 32" aria-hidden="true" fill="none" stroke="var(--lime)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c4-12 7-12 10-1s6 10 9-2 6-10 9 1"/><circle cx="41" cy="20" r="2.4" fill="var(--lime)" stroke="none"/><circle cx="48" cy="20" r="1.6" fill="var(--lime)" stroke="none"/></svg>`;
const APPLE = `<svg viewBox="0 0 17 20" aria-hidden="true"><path d="M14.2 10.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.8zM11.8 3.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg>`;

function page(lang) {
  const c = COPY[lang];
  const legal = (name) => (lang === 'en' ? `/${name}-en` : `/${name}`);
  const themeControl = `<div class="theme" role="group" aria-label="${escape(c.theme.label)}">
      <button type="button" data-set="system" aria-pressed="true" onclick="vidlunTheme('system')" title="${escape(c.theme.system)}">${THEME_ICONS.system}<span>${escape(c.theme.system)}</span></button>
      <button type="button" data-set="light" aria-pressed="false" onclick="vidlunTheme('light')" title="${escape(c.theme.light)}">${THEME_ICONS.light}<span>${escape(c.theme.light)}</span></button>
      <button type="button" data-set="dark" aria-pressed="false" onclick="vidlunTheme('dark')" title="${escape(c.theme.dark)}">${THEME_ICONS.dark}<span>${escape(c.theme.dark)}</span></button>
    </div>`;
  const cta = `<a class="btn" href="${APP_STORE}">${APPLE}${escape(c.hero.cta)}</a>`;

  const body = `<a class="skip" href="#main">${lang === 'en' ? 'Skip to content' : 'До змісту'}</a>
<header class="top"><div class="wrap top-in">
  <a class="brand" href="${lang === 'en' ? '/en' : '/'}">${MARK}Vidlun</a>
  <nav class="nav" aria-label="${lang === 'en' ? 'Sections' : 'Розділи'}">
    <a href="#how">${escape(c.nav.how)}</a><a href="#features">${escape(c.nav.features)}</a><a href="#privacy">${escape(c.nav.privacy)}</a><a href="#price">${escape(c.nav.price)}</a><a href="#faq">${escape(c.nav.faq)}</a>
  </nav>
  <div class="tools">
    <a class="lang" href="${c.otherHref}" hreflang="${c.otherLang}" lang="${c.otherLang}">${escape(c.otherLabel)}</a>
    ${themeControl}
  </div>
</div></header>
<div class="wrap">
<main id="main">
  <section class="hero">
    <div>
      <h1>${headline(c.hero.title, c.hero.mark)}</h1>
      <div class="cta">${cta}<a class="how" href="#how">${escape(c.hero.secondary)}${ARROW}</a></div>
    </div>
    <div class="phone">${shot(lang, 'home', c.how.steps[0].alt.split(':')[0], { eager: true })}</div>
  </section>

  <div class="words" aria-hidden="true"><ul>${words(c.words)}${words(c.words, true)}</ul></div>

  <section id="how">
    <h2>${escape(c.how.title)}</h2>
    <p class="sub">${escape(c.how.lead)}</p>
    <ol class="steps">
      ${c.how.steps
        .map(
          (step) => `<li class="step">
        <div>
          <div class="n">${escape(step.n)} / 4</div>
          <h3>${escape(step.title)}</h3>
          <p>${escape(step.body)}</p>
        </div>
        <div class="phone">${shot(lang, step.shot, step.alt)}</div>
      </li>`,
        )
        .join('\n      ')}
    </ol>
  </section>

  <section id="features">
    <h2>${escape(c.features.title)}</h2>
    <ul class="features">
      ${c.features.items.map((item) => `<li>${art(item.art, c.words)}<h3>${escape(item.title)}</h3><p>${escape(item.body)}</p></li>`).join('\n      ')}
    </ul>
  </section>

  <section id="privacy" class="panel">
    <h2>${headline(c.privacy.title, c.privacy.title)}</h2>
    <ul class="facts">
      ${c.privacy.points.map((text, i) => `<li>${FACTS[i]}<p>${escape(text)}</p></li>`).join('\n      ')}
    </ul>
  </section>

  <section id="price">
    <h2>${escape(c.price.title)}</h2>
    <div class="plan">
      <div class="plan-cols">
        <div class="free"><h3>${escape(c.price.free.title)}</h3><ul>${c.price.free.items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul></div>
        <div class="paid"><h3>${escape(c.price.paid.title)}</h3><ul>${c.price.paid.items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul></div>
      </div>
      <div class="tiers">
        ${c.price.paid.plans
          .map(
            (plan) => `<div class="tier${plan.badge ? ' pick' : ''}">
          ${plan.badge ? `<span class="badge">${escape(plan.badge)}</span>` : ''}
          <span class="tier-name">${escape(plan.name)}</span>
          <span class="tier-price">${escape(plan.price)}</span>
          <span class="tier-period">${escape(plan.period)}</span>
          ${plan.saving ? `<span class="tier-saving">${escape(plan.saving)}</span>` : ''}
        </div>`,
          )
          .join('\n        ')}
      </div>
      <p class="note">${escape(c.price.paid.note)}</p>
    </div>
  </section>

  <section id="faq">
    <h2>${escape(c.faq.title)}</h2>
    <div class="faq">
      ${c.faq.items.map((item) => `<details><summary>${escape(item.q)}</summary><p>${escape(item.a)}</p></details>`).join('\n      ')}
    </div>
  </section>

  <section class="end">
    <h2>${escape(c.hero.title)}</h2>
    <div class="cta">${cta}</div>
  </section>
</main>
<footer>
  <a href="${legal('terms')}">${escape(c.footer.terms)}</a>
  <a href="${legal('privacy')}">${escape(c.footer.privacy)}</a>
  <a href="${legal('support')}">${escape(c.footer.support)}</a>
  <a href="mailto:support@vidlun.app">support@vidlun.app</a>
  <span class="made">${escape(c.footer.made)}</span>
</footer>
</div>
<script>${THEME_SCRIPT}</script>`;

  const canonical = lang === 'en' ? `${SITE}/en` : `${SITE}/`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Vidlun',
    operatingSystem: 'iOS',
    applicationCategory: 'LifestyleApplication',
    description: c.description,
    url: canonical,
    installUrl: APP_STORE,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    inLanguage: [lang === 'en' ? 'en' : 'uk'],
    image: `${SITE}/og/og-${lang}.jpg`,
    screenshot: ['home', 'recording', 'turn-picker', 'detail', 'week'].map((name) => `${SITE}/shots/${lang}-${name}-light-640.jpg`),
    author: { '@type': 'Organization', name: 'Vidlun', url: SITE },
  });
  const fonts = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500&family=IBM+Plex+Sans:wght@400;500&display=swap';
  const full = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escape(c.title)}</title>
<meta name="description" content="${escape(c.description)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="uk" href="${SITE}/">
<link rel="alternate" hreflang="en" href="${SITE}/en">
<link rel="alternate" hreflang="x-default" href="${SITE}/">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FBF7F0">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#14161B">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Vidlun">
<meta property="og:title" content="${escape(c.title)}">
<meta property="og:description" content="${escape(c.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og/og-${lang}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escape(c.ogAlt)}">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'uk_UA'}">
<meta property="og:locale:alternate" content="${lang === 'en' ? 'uk_UA' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(c.title)}">
<meta name="twitter:description" content="${escape(c.description)}">
<meta name="twitter:image" content="${SITE}/og/og-${lang}.jpg">
<meta name="keywords" content="${escape(c.keywords)}">
<meta name="author" content="Vidlun">
<meta name="robots" content="index, follow">
<meta name="apple-itunes-app" content="app-id=6806530807">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${CSS}</style>
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>
${body}
</body>
</html>
`;
  const previewFile = `<title>${escape(lang === 'en' ? 'Vidlun landing (EN)' : 'Лендінг Vidlun')}</title>
<link rel="stylesheet" href="${fonts}">
<style>${CSS}</style>
${body.replace(/href="\/(en|privacy|terms|support)(-en)?"/g, (m) => m.replace('href="/', `href="${SITE}/`)).replace('href="/"', `href="${SITE}/"`)}`;
  return { full, previewFile };
}

rmSync(join(OUT, 'shots'), { recursive: true, force: true });
mkdirSync(join(OUT, 'shots'), { recursive: true });
for (const file of readdirSync(join(ROOT, 'site', 'shots'))) {
  copyFileSync(join(ROOT, 'site', 'shots', file), join(OUT, 'shots', file));
}
copyFileSync(join(ROOT, 'site', '_headers'), join(OUT, '_headers'));
// Files that must sit at the root as they are: search-engine verification and the like.
for (const file of readdirSync(join(ROOT, 'site', 'static'))) {
  copyFileSync(join(ROOT, 'site', 'static', file), join(OUT, file));
}
for (const file of readdirSync(join(ROOT, 'site', 'icons'))) {
  copyFileSync(join(ROOT, 'site', 'icons', file), join(OUT, file));
}
mkdirSync(join(OUT, 'og'), { recursive: true });
for (const file of readdirSync(join(ROOT, 'site', 'og'))) {
  copyFileSync(join(ROOT, 'site', 'og', file), join(OUT, 'og', file));
}
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
const pages = [
  ['/', '/en', 'weekly', '1.0'],
  ['/privacy', '/privacy-en', 'monthly', '0.4'],
  ['/terms', '/terms-en', 'monthly', '0.4'],
  ['/support', '/support-en', 'monthly', '0.4'],
];
const today = new Date().toISOString().slice(0, 10);
const urls = pages.flatMap(([uk, en, freq, priority]) =>
  [uk, en].map(
    (path) => `  <url>
    <loc>${SITE}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="uk" href="${SITE}${uk}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${en}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${uk}"/>
  </url>`,
  ),
);
writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
);
for (const lang of ['uk', 'en']) {
  const { full, previewFile } = page(lang);
  const target = lang === 'en' ? 'en.html' : 'index.html';
  writeFileSync(join(OUT, target), full);
  process.stdout.write(`wrote legal/site/${target} (${(Buffer.byteLength(full) / 1024).toFixed(1)} KB)\n`);
  if (preview) {
    writeFileSync(join(ROOT, 'site', `preview-${lang}.html`), previewFile);
  }
}
