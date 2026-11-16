#!/usr/bin/env python3
"""The 20 LETTER icons: a rune's glyph inked in gem on Blankstone, public/open/icons/letter-<rune>.svg

Run: npx tsx <dump of play3d/birth/runes.data.ts> > tools/art/runes.json (done once; the colours are canon's), then
     python3 tools/art/letter_glyphs.py   (rewrites the 20 files)

Canon: design-briefs/letter-glyphs.md (RULED 11-16, athernyx dad8eb4). A glyph is BUILT, never invented one by one:
  ELEMENT mark = the frame:  Mana a closed ring · Storm a broken zigzag arc · Earth a square block · Water a single wave
                             line under the glyph
  STATE mark = the inner trace: Solid a centre node · Compact a doubled inner outline · Expanding traces running out to
                             the frame · Ignite a single upward point · Flow one curved trace through the centre ·
                             Scatter a dotted broken trace · Bind two traces crossing, joined at a node
The hand is CIRCUITRY: even stroke, straight and 45° traces, rounded joins, a small node where traces meet. Gem ink on the
grey Blankstone face, lit in the rune's canon colour (runes.data.ts › glow, core). Shapes are Jin's; the reads are
canon's; Alex judges the look.
"""
import json
from math import cos, sin, pi
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/open/icons'
RUNES = json.loads((Path(__file__).parent / 'runes.json').read_text())
SHADOW = '<ellipse cx="16" cy="28.4" rx="10.4" ry="1.8" fill="#000" opacity=".28"/>'
C = (16, 14.6)        # the glyph's centre on the tablet face
W = 1.25              # the even stroke


def tablet():
    """Blankstone, dressed: a squared slab, its face and its lower edge (dull, dead stone)"""
    return ('<path d="M5 4.6 Q5 3 6.6 3 L25.4 3 Q27 3 27 4.6 L27 25.4 L5 25.4 Z" fill="#8f8a82" stroke="#3e3a34" stroke-width=".9" stroke-linejoin="round"/>'
            '<path d="M5 25.4 L27 25.4 L26.4 27.6 L5.6 27.6 Z" fill="#6c6860" stroke="#3e3a34" stroke-width=".8" stroke-linejoin="round"/>'
            '<path d="M6.4 4.6 L25.6 4.6" stroke="#aaa59c" stroke-width=".6" opacity=".8"/>')


def node(x, y, r=1.15):
    return f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}"/>'


# ── element frames ────────────────────────────────────────────────────────────────────────────────────────────
def frame(el):
    cx, cy = C
    if el == 'mana':      # a closed ring
        return f'<circle cx="{cx}" cy="{cy}" r="8.4" fill="none"/>', 8.4
    if el == 'earth':     # a square block
        return f'<rect x="{cx-8}" y="{cy-8}" width="16" height="16" rx="1.2" fill="none"/>', 8
    if el == 'storm':     # a broken zigzag arc: 45° teeth round the top, open at the foot
        pts = []
        for k in range(15):
            a = pi * (0.80 + 1.40 * k / 14)            # from lower-left round the top to lower-right
            r = 8.6 if k % 2 == 0 else 6.9
            pts.append((cx + r * cos(a), cy + r * sin(a)))
        d = 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in pts)
        ends = node(*pts[0], 0.9) + node(*pts[-1], 0.9)
        return f'<path d="{d}" fill="none"/><g stroke="none">{ends}</g>', 7.8
    # water: a single wave line under the glyph, drawn in the circuit hand (45° runs, rounded joins)
    y = cy + 8.2
    d = f'M{cx-9} {y} L{cx-6.6} {y-2.4} L{cx-4.2} {y} L{cx-1.8} {y-2.4} L{cx+0.6} {y} L{cx+3} {y-2.4} L{cx+5.4} {y} L{cx+7.8} {y-2.4} L{cx+9} {y-1.2}'
    return f'<path d="{d}" fill="none"/>', 6.8


# ── state marks ───────────────────────────────────────────────────────────────────────────────────────────────
def state(st, el, R):
    cx, cy = C
    cy2 = cy - (1.6 if el == 'water' else 0)        # the wave sits under the glyph: lift the mark off it
    if st == 'Solid':
        return f'<g stroke="none">{node(cx, cy2, 2.1)}</g>'
    if st == 'Compact':   # a doubled inner outline, in the frame's own shape
        if el == 'earth':
            return f'<rect x="{cx-4.4}" y="{cy2-4.4}" width="8.8" height="8.8" rx=".8" fill="none"/><rect x="{cx-2.2}" y="{cy2-2.2}" width="4.4" height="4.4" rx=".6" fill="none"/>'
        return f'<circle cx="{cx}" cy="{cy2}" r="4.6" fill="none"/><circle cx="{cx}" cy="{cy2}" r="2.3" fill="none"/>'
    if st == 'Expanding':  # traces running out from a centre node to the frame
        r0, r1 = 1.8, R - 0.4
        lines = ''.join(f'<path d="M{cx + r0 * cos(a):.2f} {cy2 + r0 * sin(a):.2f} L{cx + r1 * cos(a):.2f} {cy2 + r1 * sin(a):.2f}"/>' for a in (pi * k / 4 for k in range(8)))
        return lines + f'<g stroke="none">{node(cx, cy2, 1.1)}</g>'
    if st == 'Ignite':     # a single upward point, from a foot node
        return (f'<path d="M{cx} {cy2 + 4.6} L{cx} {cy2 - 3.4}"/><path d="M{cx - 3} {cy2 - 0.6} L{cx} {cy2 - 4.4} L{cx + 3} {cy2 - 0.6}" fill="none"/>'
                f'<g stroke="none">{node(cx, cy2 + 4.6, 1.05)}</g>')
    if st == 'Flow':       # one curved trace through the centre, nodes at its ends
        x0, x1 = cx - R + 1.6, cx + R - 1.6
        return (f'<path d="M{x0} {cy2 + 2.6} C{cx - 2.4} {cy2 + 6.4} {cx + 2.4} {cy2 - 6.4} {x1} {cy2 - 2.6}" fill="none"/>'
                f'<g stroke="none">{node(x0, cy2 + 2.6, 0.95)}{node(x1, cy2 - 2.6, 0.95)}</g>')
    if st == 'Scatter':    # a dotted, broken trace (the lost state)
        dots = ''.join(node(cx - 5 + i * 2.5, cy2 + 3.6 - i * 1.8, 0.8 if i % 2 else 0.6) for i in range(5))
        return f'<path d="M{cx - 5} {cy2 + 3.6} L{cx + 5} {cy2 - 3.6}" stroke-dasharray="1.2 1.6"/><g stroke="none">{dots}</g>'
    # Bind: two traces crossing at 45°, joined at a node
    s = min(5.2, R - 2)
    return (f'<path d="M{cx - s} {cy2 - s} L{cx + s} {cy2 + s}"/><path d="M{cx + s} {cy2 - s} L{cx - s} {cy2 + s}"/>'
            f'<g stroke="none">{node(cx, cy2, 1.6)}{node(cx - s, cy2 - s, 0.8)}{node(cx + s, cy2 + s, 0.8)}{node(cx + s, cy2 - s, 0.8)}{node(cx - s, cy2 + s, 0.8)}</g>')


def letter(r):
    f, R = frame(r['element'])
    mark = f + state(r['state'], r['element'], R)
    glow, core = r['glow'], r['core']
    defs = f'<filter id="g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1"/></filter>'
    lit = (f'<g stroke="{glow}" fill="{glow}" stroke-width="{W * 2.6}" stroke-linecap="round" stroke-linejoin="round" opacity=".55" filter="url(#g)">{mark}</g>'
           f'<g stroke="#2a2622" fill="#2a2622" stroke-width="{W + 0.9}" stroke-linecap="round" stroke-linejoin="round" opacity=".55">{mark}</g>'   # the cut in the stone
           f'<g stroke="{glow}" fill="{glow}" stroke-width="{W}" stroke-linecap="round" stroke-linejoin="round">{mark}</g>'
           f'<g stroke="{core}" fill="{core}" stroke-width="{W * 0.4}" stroke-linecap="round" stroke-linejoin="round" opacity=".9">{mark}</g>')
    note = f"{r['name']} letter: {r['element']} frame + {r['state']} mark, gem ink on Blankstone, lit {glow}."
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  <!-- {note} Code-drawn filler. -->\n  <defs>{defs}</defs>{SHADOW}\n  {tablet()}\n  {lit}\n</svg>\n'


if __name__ == '__main__':
    for r in RUNES:
        (OUT / f"letter-{r['id']}.svg").write_text(letter(r))
    print(len(RUNES), 'letters')
