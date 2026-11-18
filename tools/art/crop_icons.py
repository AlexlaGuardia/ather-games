#!/usr/bin/env python3
"""Per-crop bag icons for the Farm: a harvested crop + its seed packet for each of canon's 10 crops (20 SVGs, 32x32).

Run: python3 tools/art/crop_icons.py   -> public/open/icons/crop-<id>.svg + seed-<id>.svg (ids with dashes)

Each look follows canon's own one-line description (CANON/game/shimmer-skilling.md > Farming > Resources), nothing more:
  Goldleaf      hardy golden herb               Ather Wheat   staple grain, warm golden husk
  Dewdrop Vine  vine that condenses droplets    Violetbloom   deep purple petals
  Stormgrass    blue-tipped blades that crackle Rootvine      dense brown vine
  Tidepetal     teal flower beaded with moisture Starbloom    luminescent flower, glows faintly
  Heartleaf     mana-dense herb that pulses     Ather Lily    radiates golden light
The seed packet is the old generic packet with the crop drawn small on its face. Grade is in the name, not the icon.
Code-drawn filler: Alex judges the look (feedback: game art must not block on Alex). The generic crop.svg / seed.svg stay as the
fallback for an id this file does not know.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/open/icons'
SHADOW = '<ellipse cx="16" cy="27.5" rx="9" ry="2" fill="#000" opacity=".25"/>'
TIE = '<path d="M12.5 25.5 L19.5 25.5" stroke="#8a6a45" stroke-width="2" stroke-linecap="round"/>'


def leaf(d, fill, line='#3a6a2a', w=.9):
    return f'<path d="{d}" fill="{fill}" stroke="{line}" stroke-width="{w}"/>'


def petals(cx, cy, r, n, fill, line, pr=None):
    import math
    pr = pr or r * .55
    out = []
    for k in range(n):
        a = k * 2 * math.pi / n - math.pi / 2
        x, y = cx + math.cos(a) * r * .6, cy + math.sin(a) * r * .6
        out.append(f'<ellipse cx="{x:.2f}" cy="{y:.2f}" rx="{pr:.2f}" ry="{pr * .7:.2f}" transform="rotate({math.degrees(a):.1f} {x:.2f} {y:.2f})" fill="{fill}" stroke="{line}" stroke-width=".7"/>')
    return ''.join(out)


def stem(x1, y1, x2, y2, c='#3a6a2a', w=1.1):
    return f'<path d="M{x1} {y1} Q{(x1 + x2) / 2 - 1} {(y1 + y2) / 2} {x2} {y2}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round"/>'


def glow(cx, cy, r, c, o=.35):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{c}" opacity="{o}"/>'


CROPS = {
    'goldleaf': ('Hardy golden herb.', lambda:
        leaf('M16 26 Q8 22 7 12 Q14 12 16 20 Z', '#e8c24a', '#8a6a1e') + leaf('M16 26 Q24 22 25 12 Q18 12 16 20 Z', '#f2d465', '#8a6a1e')
        + leaf('M16 26 Q12 18 16 6 Q20 18 16 26 Z', '#f7e08a', '#8a6a1e')
        + '<path d="M16 25 L16 9 M15 21 L10 15 M17 21 L22 15" fill="none" stroke="#8a6a1e" stroke-width=".7" stroke-linecap="round"/>' + TIE),
    'ather_wheat': ('Staple grain with a warm golden husk.', lambda:
        ''.join(stem(16, 26, x, 9, '#b98d3a', 1) for x in (11, 16, 21))
        + ''.join(f'<ellipse cx="{x + dx}" cy="{y}" rx="1.5" ry="2.4" transform="rotate({r} {x + dx} {y})" fill="#e9b85a" stroke="#8a5f24" stroke-width=".6"/>'
                  for x, top in ((11, 9), (16, 7), (21, 9)) for (dx, y, r) in ((-1.3, top + 2, -25), (1.3, top + 2, 25), (-1.3, top + 5.5, -25), (1.3, top + 5.5, 25), (0, top, 0)))
        + TIE),
    'dewdrop_vine': ('Vine that condenses Ather moisture into sweet droplets.', lambda:
        '<path d="M9 26 Q7 18 13 15 Q19 12 16 7 M13 15 Q20 17 22 23" fill="none" stroke="#4f8f3a" stroke-width="1.6" stroke-linecap="round"/>'
        + leaf('M13 15 Q9 11 11 8 Q15 10 13 15 Z', '#7bbf5a') + leaf('M19 18 Q24 15 25 18 Q22 21 19 18 Z', '#8bd06a')
        + ''.join(f'<path d="M{x} {y - 2.2} Q{x + 1.7} {y + .2} {x} {y + 1.4} Q{x - 1.7} {y + .2} {x} {y - 2.2} Z" fill="#9fdcff" stroke="#2f7fa0" stroke-width=".6"/>' for x, y in ((16.5, 10), (22, 25), (9.5, 21)))),
    'violetbloom': ('Deep purple petals that hum when touched.', lambda:
        stem(16, 26, 16, 14) + leaf('M16 22 Q10 21 9 17 Q14 17 16 22 Z', '#6fbf55') + petals(16, 11, 9, 5, '#7a3fb0', '#3f1f66', 3.4)
        + '<circle cx="16" cy="11" r="1.8" fill="#e4c6ff" stroke="#3f1f66" stroke-width=".5"/>'),
    'stormgrass': ('Blue-tipped blades that crackle faintly in still air.', lambda:
        ''.join(f'<path d="M{16 + b} 26 Q{16 + b * .6} 16 {16 + t} {y}" fill="none" stroke="#5f9a4a" stroke-width="1.8" stroke-linecap="round"/>'
                f'<path d="M{16 + b * .7 + (t - b) * .78} {y + 4.5} L{16 + t} {y}" stroke="#4aa3e6" stroke-width="2" stroke-linecap="round"/>' for b, t, y in ((-3, -8, 9), (-1, -3, 5), (1, 3, 6), (3, 8, 10)))
        + '<path d="M22.5 4 L21 7 L23 7 L21.4 10" fill="none" stroke="#bfe3ff" stroke-width=".9" stroke-linejoin="round"/>'),
    'rootvine': ('Dense brown vine that anchors deep.', lambda:
        '<path d="M8 22 Q12 14 16 18 Q20 22 24 12 M10 26 Q14 18 18 22 Q22 26 25 18 M7 16 Q12 10 17 13" fill="none" stroke="#6e4a2a" stroke-width="2.4" stroke-linecap="round"/>'
        + '<path d="M8 22 Q12 14 16 18 Q20 22 24 12" fill="none" stroke="#a77a52" stroke-width="1" stroke-linecap="round"/>'
        + leaf('M24 12 Q27 8 26 6 Q22 8 24 12 Z', '#6fbf55')),
    'tidepetal': ('Teal flower always beaded with moisture.', lambda:
        stem(16, 26, 16, 15) + leaf('M16 23 Q22 22 23 18 Q18 18 16 23 Z', '#6fbf55') + petals(16, 11, 9.5, 6, '#3fbfb0', '#1f6b66', 3.1)
        + '<circle cx="16" cy="11" r="2" fill="#d9fff8" stroke="#1f6b66" stroke-width=".5"/>'
        + ''.join(f'<circle cx="{x}" cy="{y}" r=".9" fill="#eafcff" stroke="#2f7fa0" stroke-width=".4"/>' for x, y in ((11.5, 8), (20.5, 13.5), (13, 15))) ),
    'starbloom': ('Luminescent flower that glows faintly.', lambda:
        glow(16, 11, 9, '#fff3b0', .4) + stem(16, 26, 16, 15) + leaf('M16 22 Q10 21 9 17 Q14 17 16 22 Z', '#6fbf55')
        + '<path d="M16 3.5 L18.2 8.8 L23.8 9.2 L19.5 12.8 L20.9 18.3 L16 15.3 L11.1 18.3 L12.5 12.8 L8.2 9.2 L13.8 8.8 Z" fill="#fff7c8" stroke="#b89a2a" stroke-width=".8"/>'
        + '<circle cx="16" cy="11.2" r="1.7" fill="#ffd84a"/>'),
    'heartleaf': ('Mana-dense herb, pulses like a tiny heartbeat when ripe.', lambda:
        stem(16, 26, 16, 18) + glow(16, 13, 8.5, '#ff9ab8', .25)
        + leaf('M16 21 Q6 14 9 8.5 Q12.5 5.5 16 10 Q19.5 5.5 23 8.5 Q26 14 16 21 Z', '#5fae4a')
        + '<path d="M16 20 L16 10.5 M16 16 L12 12 M16 16 L20 12" fill="none" stroke="#c94a6e" stroke-width=".9" stroke-linecap="round"/>'),
    'ather_lily': ('Radiates golden light.', lambda:
        glow(16, 11, 10, '#ffd36a', .4) + stem(16, 26, 16, 16) + leaf('M16 23 Q9 22 8 17 Q13 17 16 23 Z', '#6fbf55')
        + leaf('M16 16 Q9 13 8.5 6 Q13 8 16 16 Z', '#fff1c4', '#b8862a') + leaf('M16 16 Q23 13 23.5 6 Q19 8 16 16 Z', '#fff1c4', '#b8862a')
        + leaf('M16 16 Q12.5 9 16 3.5 Q19.5 9 16 16 Z', '#fffae6', '#b8862a')
        + '<path d="M16 15 L14.5 10 M16 15 L17.5 10" stroke="#e8a92a" stroke-width=".8" stroke-linecap="round"/>'),
}


def svg(note, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n'
            f'  <!-- {note} Code-drawn filler (tools/art/crop_icons.py). -->\n  {SHADOW}\n  {body}\n</svg>\n')


def packet(cid, body):
    # the generic packet, the crop drawn small on its face
    return ('<path d="M8 8 L24 8 L25 26 L7 26 Z" fill="#d9b779" stroke="#6b4a2a" stroke-width="1"/>'
            '<path d="M8 8 L24 8 L23.4 11 L8.6 11 Z" fill="#b98d5a" stroke="#6b4a2a" stroke-width=".8"/>'
            f'<g transform="translate(9.6 11.2) scale(.4)">{body}</g>')


n = 0
for cid, (note, draw) in CROPS.items():
    body = draw()
    name = cid.replace('_', '-')
    (OUT / f'crop-{name}.svg').write_text(svg(f'{note} (canon, shimmer-skilling.md)', body))
    (OUT / f'seed-{name}.svg').write_text(svg(f'A seed packet with the crop on its face: {note}', packet(cid, body)))
    n += 2
print(f'wrote {n} icons')
