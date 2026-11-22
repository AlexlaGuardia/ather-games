#!/usr/bin/env python3
"""Mana Seed icons (ten species), the spirit planter and the grimoire pedestal for M76. Code-drawn filler, 32x32.
   Every seed is the SAME plump translucent-gold teardrop (a seed-grown spirit stays gold until it evolves: no element
   colours); each carries ONE small tell of its species.
   python3 tools/art/seed_icons.py  -> public/open/icons/seed-<species>.svg, spirit-planter.svg, grimoire-pedestal.svg"""
import os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'open', 'icons')
LINE, DK, GLOW = '#a8741c', '#d09a30', '#fff1b8'
BODY = 'M16 4.5 C17.6 9.5 25 12.5 25 19 C25 24 21 26.6 16 26.6 C11 26.6 7 24 7 19 C7 12.5 14.4 9.5 16 4.5 Z'
DEFS = ('<defs><radialGradient id="g" cx=".42" cy=".62" r=".62"><stop offset="0" stop-color="#fff6c8"/>'
        '<stop offset=".55" stop-color="#f6cf62"/><stop offset="1" stop-color="#e0a93a"/></radialGradient></defs>')
SW = '.8'
def pth(d, fill='none', stroke=LINE, w=SW, extra=''):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"{extra}/>'
def circ(x, y, rr, fill='none', stroke=LINE, w=SW, extra=''):
    return f'<circle cx="{x}" cy="{y}" r="{rr}" fill="{fill}" stroke="{stroke}" stroke-width="{w}"{extra}/>'

# (note, tells drawn BEHIND the body, tells drawn ON it)
TELLS = {
 'fox': ('two small pointed ear-nubs at the top',
    pth('M9.6 15.4 L9.6 6.8 L15.6 11.2 Z', '#f6cf62') + pth('M22.4 15.4 L22.4 6.8 L16.4 11.2 Z', '#f6cf62'), ''),
 'axolotl': ('three tiny frill-fronds each side near the top',
    ''.join(pth(f'M{x} {y} L{x-3.4} {y-1.4}', stroke=DK, w='1.3') + pth(f'M{32-x} {y} L{32-x+3.4} {y-1.4}', stroke=DK, w='1.3')
            for x, y in ((12.4, 11.6), (10.2, 14), (8.4, 16.6))), ''),
 'water-bear': ('a soft row of three rounded lobes along the bottom edge',
    ''.join(circ(x, 25.6, 2.5, '#f2c455', LINE) for x in (10.8, 16, 21.2)), ''),
 'turtle': ('a faint hex/plate pattern on the seed coat', '',
    pth('M16 14.4 L19 16.1 L19 19.6 L16 21.3 L13 19.6 L13 16.1 Z', stroke=DK, w='.7', extra=' opacity=".8"')
    + pth('M16 14.4 L16 11.6 M19 16.1 L21.6 14.9 M19 19.6 L22 21 M16 21.3 L16 24.4 M13 19.6 L10 21 M13 16.1 L10.4 14.9', stroke=DK, w='.7', extra=' opacity=".7"')),
 'owl': ('two faint eye-ring circles', '',
    circ(12.6, 17.6, 2.7, 'none', DK, '.8', ' opacity=".85"') + circ(19.4, 17.6, 2.7, 'none', DK, '.8', ' opacity=".85"')
    + circ(12.6, 17.6, .7, DK, DK, '0') + circ(19.4, 17.6, .7, DK, DK, '0')),
 'frog': ('two bumps on top, wide-set',
    circ(8.4, 11.8, 3.1, '#f6cf62', LINE) + circ(23.6, 11.8, 3.1, '#f6cf62', LINE), ''),
 'firefly': ('a glowing bright tip at the bottom', '',
    '<circle cx="16" cy="24.4" r="4.2" fill="#fffbe0" opacity=".45"/><circle cx="16" cy="24.4" r="2.4" fill="#ffffff" opacity=".9"/>'),
 'rabbit': ('two long thin ear-sprouts',
    pth('M15.2 7.4 Q12.6 3.4 13.4 .8', stroke=LINE, w='2.2') + pth('M16.8 7.4 Q19.4 3.4 18.6 .8', stroke=LINE, w='2.2')
    + pth('M15.2 7.4 Q12.6 3.4 13.4 .8', stroke='#f6cf62', w='1.1') + pth('M16.8 7.4 Q19.4 3.4 18.6 .8', stroke='#f6cf62', w='1.1'), ''),
 'hummingbird': ('one long thin needle tip',
    pth('M16 6.4 Q17.2 3 21.4 .8', stroke=LINE, w='1.9') + pth('M16 6.4 Q17.2 3 21.4 .8', stroke='#f6cf62', w='.8'), ''),
 'bat': ('a scalloped wing-edge seam across the middle', '',
    pth('M7.4 16.4 Q9.7 20.2 12 16.8 Q14 20.6 16 17.2 Q18 20.6 20 16.8 Q22.3 20.2 24.6 16.4', stroke=DK, w='.9', extra=' opacity=".9"')),
}

def seed(sp):
    note, behind, on = TELLS[sp]
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n'
            f'  <!-- Mana Seed ({sp}): plump translucent-gold teardrop; tell = {note}. Code-drawn filler (tools/art/seed_icons.py). -->\n'
            f'  {DEFS}\n'
            '  <ellipse cx="16" cy="28.4" rx="9" ry="1.8" fill="#000" opacity=".22"/>\n'
            '  <circle cx="16" cy="17" r="12" fill="#ffe9a0" opacity=".2"/>\n'
            f'  {behind}\n'
            f'  <path d="{BODY}" fill="url(#g)" fill-opacity=".92" stroke="{LINE}" stroke-width="{SW}" stroke-linejoin="round"/>\n'
            f'  <ellipse cx="16" cy="19.4" rx="4.6" ry="4.2" fill="{GLOW}" opacity=".5"/>\n'
            '  <path d="M10.6 16.6 Q11 13.6 13.4 11.6" fill="none" stroke="#fffbe6" stroke-width="1.2" stroke-linecap="round" opacity=".85"/>\n'
            f'  {on}\n</svg>\n')

def wrap(note, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n'
            f'  <!-- {note} Code-drawn filler (tools/art/seed_icons.py). -->\n'
            '  <ellipse cx="16" cy="28" rx="11" ry="2" fill="#000" opacity=".22"/>\n'
            f'  {body}\n</svg>\n')

# starwillow (furniture_icons.py): hi #e6ecf8, mid #c8d2e8, dk #6f7a96
SH, SM, SD = '#e6ecf8', '#c8d2e8', '#6f7a96'
def branch(d):
    return pth(d, stroke=SD, w='3.4') + pth(d, stroke=SM, w='2.2') + pth(d, stroke=SH, w='.7', extra=' opacity=".8"')
PLANTER = (
    '<defs><radialGradient id="m" cx=".5" cy=".8" r=".7"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#e0a93a"/></radialGradient></defs>'
    '<circle cx="16" cy="10" r="9" fill="#ffe9a0" opacity=".28"/>'
    + branch('M7 12.6 Q5.4 9 5.8 6') + branch('M25 12.6 Q26.6 9 26.2 6')
    + '<path d="M8.6 13 Q9 5.4 16 4.6 Q23 5.4 23.4 13 Z" fill="url(#m)" stroke="#c98f2a" stroke-width=".7"/>'
    '<ellipse cx="14" cy="8.6" rx="2" ry="1.2" fill="#fffbe6" opacity=".7"/>'
    '<path d="M5.6 12.6 L8.4 25.6 Q16 28 23.6 25.6 L26.4 12.6 Q16 16 5.6 12.6 Z" fill="' + SM + '" stroke="' + SD + '" stroke-width=".8"/>'
    + ''.join(branch(d) for d in ('M8.6 14 Q10 21 9.6 26', 'M13 15 Q13.8 21 13.2 27', 'M19 15 Q18.2 21 18.8 27', 'M23.4 14 Q22 21 22.4 26'))
    + branch('M7 18 Q16 21.4 25 18') + branch('M8.4 22.6 Q16 25.8 23.6 22.6')
    + branch('M5.6 12.8 Q16 16.2 26.4 12.8')
    + ''.join(f'<circle cx="{x}" cy="{y}" r="2.4" fill="#fff6c8" opacity=".3"/><circle cx="{x}" cy="{y}" r="1.1" fill="#fff6c8"/>'
              for x, y in ((5.8, 6), (26.2, 6), (9.6, 26), (22.4, 26))))
PEDESTAL = (
    '<rect x="8" y="24.6" width="16" height="3.2" rx=".8" fill="#bdb6a6" stroke="#7c7566" stroke-width=".8"/>'
    '<rect x="10" y="12.6" width="12" height="12.2" fill="#dcd6c8" stroke="#7c7566" stroke-width=".8"/>'
    '<path d="M10 17.2 L22 17.2 M10 21 L22 21" stroke="#7c7566" stroke-width=".5" opacity=".5"/>'
    '<path d="M8.4 12.8 L23.6 12.8 L23.6 10.8 L8.4 10.8 Z" fill="#bdb6a6" stroke="#7c7566" stroke-width=".8"/>'
    '<path d="M10.4 10.8 L12.6 2.6 L21.8 3.4 L21.6 10.8 Z" fill="#2c2a33" stroke="#14131a" stroke-width=".8" stroke-linejoin="round"/>'
    '<path d="M13.4 4.6 L20.4 5.2 L20.2 9.4 L12.4 9.4 Z" fill="#f2c455" opacity=".32"/>'
    '<ellipse cx="16.6" cy="7" rx="3.4" ry="2.4" fill="#ffe9a0" opacity=".75"/>'
    '<ellipse cx="16.6" cy="7" rx="1.6" ry="1.1" fill="#fffbe6"/>')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for sp in TELLS:
        with open(os.path.join(OUT, f'seed-{sp}.svg'), 'w') as f:
            f.write(seed(sp))
    with open(os.path.join(OUT, 'spirit-planter.svg'), 'w') as f:
        f.write(wrap('A spirit planter woven from pale starwillow, faintly lit tips, a glowing mound of soil.', PLANTER))
    with open(os.path.join(OUT, 'grimoire-pedestal.svg'), 'w') as f:
        f.write(wrap('A short stone pedestal, slanted top, a thin dark tablet with a soft gold glow.', PEDESTAL))
    print(f'wrote {len(TELLS) + 2} icons')
