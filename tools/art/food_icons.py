#!/usr/bin/env python3
"""Food bag icons: 7 code-drawn SVGs (32x32) in public/open/icons/, in the waymark.svg idiom.

Run: python3 tools/art/food_icons.py   (rewrites the 7 files)

Canon: world/cuisine.md › THE SMOKEHOUSE (farmed meat by the bundle: Drifthorn, Tuskroot, Hearthwing eggs) and
› THE ATHER HEARTH (the hearth ROASTS: open coals, no vessel). Raw goods are wrapped and cord-tied like the forestry
bundles; roasts are browned, with a char line, on a spit stick where it is a whole rinn.
Code-drawn filler: Alex judges the look (feedback: game art must not block on Alex).
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/open/icons'
CORD = '#7a6446'
SHADOW = '<ellipse cx="16" cy="27.5" rx="10" ry="2.2" fill="#000" opacity=".25"/>'


def svg(note: str, body: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  <!-- {note} Code-drawn filler. -->\n  {SHADOW}\n{body}</svg>\n'


def wrapped_cut(meat: str, fat: str) -> str:
    """a cut in waxed paper, folded back at one end to show the meat, tied with cord"""
    return ('  <path d="M5 18 Q5 11 13 10 L24 10 Q28 11 27 17 Q27 24 19 25 L10 25 Q5 24 5 18 Z" fill="#efe2c2" stroke="#a8946a" stroke-width=".9"/>\n'
            f'  <path d="M17 11 L24 10.4 Q27.5 11.5 26.6 17 Q26.4 22 21 23.6 Q19 18 17 11 Z" fill="{meat}" stroke="#7a3a2a" stroke-width=".7"/>\n'
            f'  <path d="M19.5 13 Q23 14 24.5 18" fill="none" stroke="{fat}" stroke-width="1.3" stroke-linecap="round"/>\n'
            f'  <path d="M11 10.4 L11.6 25 M14.6 10.2 L15 25" stroke="{CORD}" stroke-width="1.1"/>\n'
            f'  <path d="M12.8 10.2 q-2.2 -2.4 -3 -.4 q1.2 1.2 3 .4 q2.2 -2.4 3 -.4 q-1.2 1.2 -3 .4" fill="none" stroke="{CORD}" stroke-width=".9"/>\n')


def eggs(shell: str, spot: str, roast=False) -> str:
    """three eggs in a woven nest; roasted = browned with a char line"""
    nest = ('  <path d="M4 19 Q16 29 28 19 Q27 24 16 25.5 Q5 24 4 19 Z" fill="#d8b866" stroke="#9a7a3a" stroke-width=".8"/>\n'
            '  <path d="M6 20.5 l3 1.5 M11 22.5 l3 .6 M18 23 l3 -.6 M23 21.6 l3 -1.4" stroke="#b8963e" stroke-width=".7"/>\n')
    out = ''
    for cx, cy, r in ((11, 16, 4.6), (21, 16, 4.6), (16, 13, 5.2)):
        out += f'  <ellipse cx="{cx}" cy="{cy}" rx="{r*0.82:.1f}" ry="{r}" fill="{shell}" stroke="#6a4a2a" stroke-width=".8"/>\n'
        out += f'  <circle cx="{cx-1.2}" cy="{cy-1}" r=".7" fill="{spot}"/><circle cx="{cx+1}" cy="{cy+1.4}" r=".55" fill="{spot}"/>\n'
        if roast:
            out += f'  <path d="M{cx-r*0.6:.1f} {cy+r*0.5:.1f} q{r*0.6:.1f} 1 {r*1.2:.1f} 0" fill="none" stroke="#3a2416" stroke-width=".7" opacity=".7"/>\n'
    return nest + out


def roast_joint(meat: str, crust: str) -> str:
    """a browned joint with a bone end, char lines, steam"""
    return (f'  <path d="M6 19 Q6 11 15 10.5 Q23 10 24 16 Q25 23 15 24 Q6 24.5 6 19 Z" fill="{crust}" stroke="#4a2a16" stroke-width=".9"/>\n'
            f'  <path d="M9 18 Q10 13 15 13 Q20 13 21 17" fill="none" stroke="{meat}" stroke-width="2" stroke-linecap="round" opacity=".9"/>\n'
            '  <path d="M10 21 l3 -1.2 M15 21.6 l3 -1.4" stroke="#2e1a0e" stroke-width=".8" opacity=".7"/>\n'
            '  <path d="M23 15 L27.5 12.5" stroke="#efe6d2" stroke-width="2.4" stroke-linecap="round"/>\n'
            '  <circle cx="28" cy="11.8" r="1.6" fill="#efe6d2" stroke="#b8ab8e" stroke-width=".5"/><circle cx="27" cy="10.6" r="1.3" fill="#efe6d2" stroke="#b8ab8e" stroke-width=".5"/>\n'
            '  <path d="M12 8 q-1 -2 0 -4 M16 7.6 q1 -2 0 -4" fill="none" stroke="#fff" stroke-width=".8" opacity=".55" stroke-linecap="round"/>\n')


def roast_rinn() -> str:
    """a Shimmerscale roasted on a spit stick: warm scales gone golden-brown, a faint shimmer kept at the fin"""
    return ('  <path d="M3 22 L29 10" stroke="#8a6a45" stroke-width="1.4" stroke-linecap="round"/>\n'
            '  <path d="M8 19.6 Q12 12.5 19 12.6 Q23.5 13 24.6 14.8 Q22.4 19.4 15 20.6 Q10.4 21.2 8 19.6 Z" fill="#c98a3e" stroke="#5a3418" stroke-width=".9"/>\n'
            '  <path d="M8 19.6 L4.4 17.2 L5 22.6 Z" fill="#b8763a" stroke="#5a3418" stroke-width=".7"/>\n'
            '  <path d="M12 18.4 l2 -3 M15 18.6 l2 -3.4 M18 18 l1.8 -3.2" stroke="#6a3c1c" stroke-width=".7" opacity=".8"/>\n'
            '  <circle cx="21.6" cy="15" r=".9" fill="#2a1a10"/>\n'
            '  <path d="M14 12.8 Q16 10.2 18.4 12.6" fill="#f0c66a" stroke="#a87a34" stroke-width=".6"/>\n'
            '  <path d="M13 8.6 q-1 -2 0 -4 M17 8.2 q1 -2 0 -4" fill="none" stroke="#fff" stroke-width=".8" opacity=".55" stroke-linecap="round"/>\n')


ICONS = {
    'drifthorn-cut': ('Drifthorn Cut: lean farmed meat in waxed paper, cord-tied.', wrapped_cut('#c8645a', '#f2d6c8')),
    'tuskroot-cut': ('Tuskroot Cut: a rich cut with a thick fat edge, in waxed paper.', wrapped_cut('#b04a42', '#fff1de')),
    'hearthwing-eggs': ('Hearthwing Eggs: speckled eggs, packed snug.', eggs('#f3e2c4', '#b07a4a')),
    'roast-eggs': ('Roast Eggs: Hearthwing eggs browned in the coals.', eggs('#d9a86a', '#7a4a26', roast=True)),
    'roast-drifthorn': ('Roast Drifthorn: a joint roasted on the hearth.', roast_joint('#e0a07a', '#a8602e')),
    'roast-tuskroot': ('Roast Tuskroot: roasted in its own fat, a dark crust.', roast_joint('#f0c39a', '#8a4a22')),
    'roast-rinn': ('Roast Rinn: a Shimmerscale on a spit stick, done over the coals.', roast_rinn()),
}

if __name__ == '__main__':
    for name, (note, body) in ICONS.items():
        (OUT / f'{name}.svg').write_text(svg(note, body))
    print(f'wrote {len(ICONS)} icons to {OUT}')
