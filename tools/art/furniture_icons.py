#!/usr/bin/env python3
"""Furniture + decor icons for the open world's bag (ather/furniture.ts). Code-drawn filler, 32x32, the wood's colour.
   python3 tools/art/furniture_icons.py  -> public/open/icons/<id with dashes>.svg"""
import os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'open', 'icons')
WOOD = {'goldwood': ('#f0c773', '#d9a957', '#8a5f24'), 'shimmeroak': ('#c99a6c', '#a77a52', '#5e3f24'),
        'starwillow': ('#e6ecf8', '#c8d2e8', '#6f7a96'), 'dawnwood': ('#e39a6a', '#c9774a', '#6e3a1e')}

def r(x, y, w, h, c, s, rx=0.6):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{c}" stroke="{s}" stroke-width=".8"/>'

def icon(body, wood, note):
    hi, mid, dk = WOOD[wood]
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n'
            f'  <!-- {note} Code-drawn filler (tools/art/furniture_icons.py). -->\n'
            '  <ellipse cx="16" cy="28" rx="11" ry="2" fill="#000" opacity=".22"/>\n'
            f'  {body(hi, mid, dk)}\n</svg>\n')

PIECES = {
    'goldwood_stool': ('goldwood', 'A three-legged stool.', lambda h, m, d:
        r(9, 12, 14, 3.4, h, d, 1.6) + r(10.5, 15.4, 2.4, 11, m, d) + r(19.1, 15.4, 2.4, 11, m, d) + r(14.8, 15.4, 2.4, 9, m, d)),
    'goldwood_bench': ('goldwood', 'A long bench.', lambda h, m, d:
        r(3, 14, 26, 3.6, h, d, 1.2) + r(5, 17.6, 2.6, 9, m, d) + r(24.4, 17.6, 2.6, 9, m, d) + r(6, 21, 20, 1.6, m, d)),
    'goldwood_table': ('goldwood', 'A table.', lambda h, m, d:
        '<path d="M4 11 L28 11 L25 15 L7 15 Z" fill="' + h + '" stroke="' + d + '" stroke-width=".8"/>' + r(7, 15, 2.6, 12, m, d) + r(22.4, 15, 2.6, 12, m, d)),
    'planter_box': ('goldwood', 'A planter box lined with bark.', lambda h, m, d:
        r(5, 15, 22, 11, m, d, 1) + r(4.4, 13.6, 23.2, 2.6, h, d, 0.8) + r(5, 19.4, 22, 2.2, '#8a6a3a', d, 0.4)
        + '<path d="M11 13.6 Q10 8 13 6 M16 13.6 Q16 7 18 5 M21 13.6 Q22 9 24 8" fill="none" stroke="#5f9a4a" stroke-width="1.4" stroke-linecap="round"/>'),
    'shimmeroak_shelf': ('shimmeroak', 'A tall shelf.', lambda h, m, d:
        r(7, 3, 18, 24, d, d, 0.6) + r(6, 3, 2.6, 24, m, d) + r(23.4, 3, 2.6, 24, m, d)
        + ''.join(r(8, y, 16, 1.8, h, d, 0.3) for y in (8.5, 14.5, 20.5))
        + r(10, 5, 3, 3.5, '#9ad8ff', '#3f7fa8', 0.4) + r(17, 16.5, 4, 4, '#e2b23e', '#9a6a1c', 0.6)),
    'starwillow_arch': ('starwillow', 'An arch of bent starwillow.', lambda h, m, d:
        '<path d="M7 27 L7 13 Q7 4 16 4 Q25 4 25 13 L25 27" fill="none" stroke="' + d + '" stroke-width="4.6" stroke-linecap="round"/>'
        '<path d="M7 27 L7 13 Q7 4 16 4 Q25 4 25 13 L25 27" fill="none" stroke="' + m + '" stroke-width="3" stroke-linecap="round"/>'
        + ''.join(f'<circle cx="{x}" cy="{y}" r="1.3" fill="#ffffff"/>' for x, y in ((9, 8), (16, 3.6), (23, 8)))),
    'dawnwood_chair': ('dawnwood', 'A dawnwood chair.', lambda h, m, d:
        r(10, 3, 13, 13, m, d, 1.4) + r(9, 15, 15, 3.4, h, d, 1.2) + r(10, 18.4, 2.6, 8.6, m, d) + r(20.4, 18.4, 2.6, 8.6, m, d)
        + r(12.5, 5.5, 8, 1.4, h, d, 0.4)),
}
for pid, (wood, note, body) in PIECES.items():
    with open(os.path.join(OUT, pid.replace('_', '-') + '.svg'), 'w') as f:
        f.write(icon(body, wood, note))
print(f'wrote {len(PIECES)} icons')
