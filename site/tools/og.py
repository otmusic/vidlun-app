#!/usr/bin/env python3
"""Composes the share images (site/og/og-<lang>.jpg, 1200 x 630) from the
app's fonts and the home screenshot, and renders them through WebKit with
site/tools/render.swift. Run from the repository root:
    python3 site/tools/og.py
"""
import base64, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[2]
font = base64.b64encode((ROOT / 'assets/fonts/Unbounded-Medium.ttf').read_bytes()).decode()
plex = base64.b64encode((ROOT / 'assets/fonts/IBMPlexSans-Regular.ttf').read_bytes()).decode()
OUT = ROOT / 'site/og'; OUT.mkdir(exist_ok=True)
TMP = pathlib.Path('/tmp/vidlun-og'); TMP.mkdir(exist_ok=True)
for lang, lines, sub, mark_w in (
    ('uk', ['Скажи, як минув день.', 'Vidlun назве,', 'що ти відчуваєш.'], 'Голосовий щоденник емоцій для iPhone', 520),
    ('en', ['Say how the day went.', 'Vidlun names', 'what you feel.'], 'A voice emotion journal for iPhone', 500),
):
    shot = base64.b64encode((ROOT / f'site/shots/{lang}-home-light.jpg').read_bytes()).decode()
    text = ''.join(f'<text x="72" y="{236 + i * 62}" font-family="Unbounded" font-size="48" fill="#16181D" letter-spacing="-1.8">{l}</text>' for i, l in enumerate(lines))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<style>@font-face{{font-family:"Unbounded";src:url(data:font/ttf;base64,{font}) format("truetype")}}@font-face{{font-family:"Plex";src:url(data:font/ttf;base64,{plex}) format("truetype")}}</style>
<clipPath id="screen"><rect x="836" y="80" width="300" height="652" rx="42"/></clipPath>
<radialGradient id="g1" cx="0.12" cy="0.3" r="0.5"><stop offset="0" stop-color="#D7F26B" stop-opacity="0.55"/><stop offset="1" stop-color="#D7F26B" stop-opacity="0"/></radialGradient>
<radialGradient id="g2" cx="0.85" cy="0.7" r="0.5"><stop offset="0" stop-color="#E8E5FD" stop-opacity="0.9"/><stop offset="1" stop-color="#E8E5FD" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="630" fill="#FBF7F0"/><rect width="1200" height="630" fill="url(#g1)"/><rect width="1200" height="630" fill="url(#g2)"/>
<g transform="translate(72,70)"><path d="M3 21c4-12 7-12 10-1s6 10 9-2 6-10 9 1" fill="none" stroke="#D7F26B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="scale(1.5)"/><circle cx="61" cy="30" r="3.6" fill="#D7F26B"/><circle cx="72" cy="30" r="2.4" fill="#D7F26B"/></g>
<text x="160" y="102" font-family="Unbounded" font-size="40" fill="#16181D" letter-spacing="-1.5">Vidlun</text>
<rect x="70" y="240" width="{mark_w}" height="16" rx="8" fill="#D7F26B" transform="rotate(-1 70 240)"/>
{text}
<text x="72" y="452" font-family="Plex" font-size="27" fill="#6C6F78">{sub}</text>
<text x="72" y="556" font-family="Plex" font-size="24" fill="#8A8D95">vidlun.app</text>
<g transform="rotate(-3 986 406)"><rect x="820" y="64" width="332" height="684" rx="56" fill="#16181D"/><image x="836" y="80" width="300" height="652" clip-path="url(#screen)" preserveAspectRatio="xMidYMin slice" xlink:href="data:image/jpeg;base64,{shot}"/></g>
</svg>'''
    svg_path = TMP / f'og-{lang}.svg'; svg_path.write_text(svg)
    png_path = TMP / f'og-{lang}.png'
    subprocess.run(['swift', str(ROOT / 'site/tools/render.swift'), str(svg_path), str(png_path), '1200', '630'], check=True)
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '84', '-Z', '1200', str(png_path), '--out', str(OUT / f'og-{lang}.jpg')], check=True, capture_output=True)
    print('wrote', OUT / f'og-{lang}.jpg')
