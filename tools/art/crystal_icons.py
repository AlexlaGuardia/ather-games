#!/usr/bin/env python3
"""Prospecting bag icons: the crystal ladder + Blankstone (ather/prospecting.ts), public/open/icons/<id>.svg

Run: python3 tools/art/crystal_icons.py   (rewrites the 8 files)

Canon looks (game/shimmer-skilling.md › Prospecting; design-briefs/shimmer-resources.md): Raw Mana Shard = cloudy white,
chipped · Violet = deep purple, inner glow · Storm = pale blue, crackling sparks · Earth = brown-amber, dense and heavy ·
Water = teal, cool, fluid shimmer inside, always slightly damp · Pure Mana Core = clear, bright, perfectly formed, rings
like a bell · Ather Crystal = golden, translucent, pulsing. The LIGHT LAW: crystal is lit from within. A gathered
QUANTITY reads as two or three together (the raw shards); the rarer ones as one stone.
Blankstone (the base a letter is cut from, RULED 11-16; name Jin's) is dead stone: DULL, no light, a plain dressed blank.
Code-drawn filler: Alex judges the look.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/open/icons'
SHADOW = '<ellipse cx="16" cy="27.5" rx="10" ry="2.2" fill="#000" opacity=".25"/>'


def svg(note, body, defs=''):
    d = f'<defs>{defs}</defs>' if defs else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  <!-- {note} Code-drawn filler. -->\n  {d}{SHADOW}\n  {body}\n</svg>\n'


def shard(cx, base, w, h, lean, light, mid, dark, edge, gid=None):
    """one hexagonal crystal standing on `base`: a lit face, a shaded face, a point; lean tilts it (px at the tip)"""
    tx = cx + lean
    L = f'M{cx-w} {base} L{cx-w+lean*0.7} {base-h} L{tx} {base-h-w*1.1} L{tx} {base-h*0.15}Z'.replace('Z', f' L{cx} {base+0.6} Z')
    R = f'M{cx} {base+0.6} L{tx} {base-h*0.15} L{tx} {base-h-w*1.1} L{cx+w+lean*0.7} {base-h} L{cx+w} {base} Z'
    fillL = f'url(#{gid})' if gid else light
    return (f'<path d="{L}" fill="{fillL}" stroke="{edge}" stroke-width=".7" stroke-linejoin="round"/>'
            f'<path d="{R}" fill="{mid}" stroke="{edge}" stroke-width=".7" stroke-linejoin="round"/>'
            f'<path d="M{tx} {base-h-w*1.1} L{tx} {base-h*0.15}" stroke="{dark}" stroke-width=".5" opacity=".6"/>')


def halo(cx, cy, r, c, op):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{c}" opacity="{op}"/>'


def lin(gid, a, b):
    return f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'


def rock_foot(cx=16, y=25):
    return f'<path d="M{cx-9} {y} Q{cx-8} {y-3} {cx-4} {y-3.2} Q{cx} {y-4.2} {cx+4} {y-3.2} Q{cx+8.6} {y-3} {cx+9} {y} Z" fill="#7a7068" stroke="#3e3832" stroke-width=".8"/>'


ICONS = {}

ICONS['blankstone'] = ('Blankstone: a plain dressed blank, dull grey, no light (dead stone).',
    '<path d="M7 22 L9 9.6 L22.4 8 L25.4 20.6 Z" fill="#9a958c" stroke="#4a4640" stroke-width=".9" stroke-linejoin="round"/>'
    '<path d="M7 22 L25.4 20.6 L25.6 23.4 L7.2 25 Z" fill="#7a766e" stroke="#4a4640" stroke-width=".9" stroke-linejoin="round"/>'
    '<path d="M25.4 20.6 L22.4 8 L23.4 10.4 L25.6 23.4 Z" fill="#86817a" stroke="#4a4640" stroke-width=".7" stroke-linejoin="round"/>'
    '<path d="M10.4 12 L21.4 10.8 M10 15.6 L22.2 14.6 M9.6 19 L23 18" stroke="#aaa59c" stroke-width=".5" opacity=".7"/>'
    '<path d="M12 21 l1.2 -1 M19 10.4 l1 1.4" stroke="#6a665e" stroke-width=".5"/>', '')

ICONS['raw-mana-shard'] = ('Raw Mana Shard: three cloudy white shards, chipped, a faint light inside.',
    halo(16, 16, 10, '#f4f4ff', '.18')
    + shard(11, 24, 2.6, 8, -1.5, '#eef0f6', '#c8ccd8', '#8a90a4', '#6a7084')
    + shard(20.6, 24.6, 2.4, 7, 1.6, '#e6e8f0', '#bcc0cc', '#8a90a4', '#6a7084')
    + shard(15.6, 25, 3, 12, 0.4, '#f6f6fa', '#d0d4de', '#8a90a4', '#6a7084')
    + '<path d="M14 10 l1.4 1 M13.6 15 l1.6 .4 M19.6 17 l1.2 .8" stroke="#a8aec0" stroke-width=".6"/>', '')

ICONS['violet-crystal'] = ('Violet Crystal: deep purple, an inner glow.',
    halo(16, 15, 11, '#b06aff', '.25') + halo(16, 15, 6, '#e0c0ff', '.3') + rock_foot()
    + shard(16, 22.6, 4, 12, 0.6, 'url(#vg)', '#4a1a7a', '#2a0a4a', '#2a0a4a')
    + shard(10.6, 23, 2.2, 6, -1.4, '#8a4ad0', '#5a2a90', '#2a0a4a', '#2a0a4a')
    + '<circle cx="15" cy="13" r="1.6" fill="#f0e0ff" opacity=".85"/>',
    lin('vg', '#c890ff', '#6a2aa8'))

ICONS['storm-crystal'] = ('Storm Crystal: pale blue, sparks crackling off it.',
    halo(16, 15, 11, '#9ad8ff', '.22') + rock_foot()
    + shard(15.6, 22.6, 3.8, 11.6, -0.6, 'url(#sg)', '#5a9ad0', '#2a5a8a', '#2a4a6a')
    + shard(21.6, 23.2, 2.2, 6.4, 1.4, '#b8e4ff', '#7ab4e0', '#2a5a8a', '#2a4a6a')
    + '<g stroke="#f4fbff" stroke-width=".8" fill="none" stroke-linecap="round">'
      '<path d="M8.6 9 l2 1.4 l-1 1.2 l2.2 1"/><path d="M24 7.6 l-1.6 1.8 l1.2 .8 l-1.8 1.6"/><path d="M26 15 l-1.8 .4 l.8 1.2"/></g>'
    + '<circle cx="15" cy="12.4" r="1.3" fill="#ffffff" opacity=".9"/>',
    lin('sg', '#e4f6ff', '#7ab8e8'))

ICONS['earth-crystal'] = ('Earth Crystal: brown-amber, dense, a heavy squat stone, warm inside.',
    halo(16, 17, 10, '#e0a050', '.2') + rock_foot()
    + '<path d="M8 22.6 L9.6 13 L16 9.4 L22.6 12.6 L24.4 22.4 L16 24.6 Z" fill="url(#eg)" stroke="#4a2a10" stroke-width=".9" stroke-linejoin="round"/>'
    + '<path d="M16 9.4 L16 24.6 M9.6 13 L16 16 L22.6 12.6" fill="none" stroke="#5a3418" stroke-width=".7"/>'
    + '<path d="M16 16 L22.6 12.6 L24.4 22.4 L16 24.6 Z" fill="#7a4a1e" opacity=".55"/>'
    + '<circle cx="12.6" cy="15" r="1.4" fill="#ffd89a" opacity=".75"/>',
    lin('eg', '#d89a4e', '#8a5420'))

ICONS['water-crystal'] = ('Water Crystal: teal, a fluid shimmer moving inside, beaded damp.',
    halo(16, 15, 11, '#4ad8c8', '.22') + rock_foot()
    + shard(16, 22.6, 4, 12, 0.4, 'url(#wg)', '#1a7a7a', '#0a4a4a', '#0a4a4a')
    + '<path d="M13.6 19 Q15.4 16 14 13 Q13.2 11 14.6 9.6 M16.6 20 Q18 17 17 14" fill="none" stroke="#c8fff4" stroke-width=".8" opacity=".8"/>'
    + '<g fill="#e6fffa"><ellipse cx="11.4" cy="17" rx=".7" ry="1"/><ellipse cx="20.4" cy="12" rx=".6" ry=".9"/><ellipse cx="18.6" cy="21" rx=".5" ry=".8"/></g>',
    lin('wg', '#9af4e4', '#2aa8a0'))

ICONS['pure-mana-core'] = ('Pure Mana Core: clear, bright, perfectly formed; it rings like a bell.',
    halo(16, 15, 11, '#ffffff', '.22')
    + '<path d="M16 3.6 L23 11 L16 26 L9 11 Z" fill="url(#pg)" stroke="#8aa0c0" stroke-width=".8" stroke-linejoin="round"/>'
    + '<path d="M9 11 L23 11 M16 3.6 L13 11 L16 26 M16 3.6 L19 11 L16 26" fill="none" stroke="#a8bcd8" stroke-width=".6"/>'
    + '<path d="M5 9 q-1.6 3 0 6 M27 9 q1.6 3 0 6 M3 7.6 q-2.4 4.4 0 8.8 M29 7.6 q2.4 4.4 0 8.8" fill="none" stroke="#ffffff" stroke-width=".7" opacity=".7"/>'
    + '<circle cx="14.4" cy="9.4" r="1.2" fill="#ffffff"/>',
    lin('pg', '#ffffff', '#d4e4f6'))

ICONS['ather-crystal'] = ('Ather Crystal: golden, translucent, pulsing with the Ather inside.',
    halo(16, 15, 12.6, '#ffd860', '.22') + halo(16, 15, 8.4, '#fff0a8', '.3')
    + '<path d="M16 3 L22.4 9 L21 21 L16 26 L11 21 L9.6 9 Z" fill="url(#ag)" stroke="#a87a1a" stroke-width=".8" stroke-linejoin="round" opacity=".92"/>'
    + '<path d="M16 3 L16 26 M9.6 9 L16 12 L22.4 9 M11 21 L16 18 L21 21" fill="none" stroke="#c8962a" stroke-width=".55" opacity=".8"/>'
    + '<circle cx="16" cy="15" r="2.4" fill="#fffbe0"/><circle cx="16" cy="15" r="4" fill="#fff0a0" opacity=".45"/>',
    lin('ag', '#fff4b0', '#e0a830'))

if __name__ == '__main__':
    for name, (note, body, defs) in ICONS.items():
        (OUT / f'{name}.svg').write_text(svg(note, body, defs))
    print(len(ICONS), 'icons')
