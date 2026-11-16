#!/usr/bin/env python3
"""Nyx-side rinn bag icons: canon's mortal catch (continent/rinning-nyx.ts › NYX_RINN), public/open/icons/<id>.svg

Run: python3 tools/art/nyx_rinn_icons.py   (rewrites the 15 files; Clickclaw keeps the Ather's icon, one creature)

Canon: world/rinn.md gives each its analog and notes (Silvergill = herring, schools; Bluescale = trout; Duskfin =
mackerel; Mossback = flounder; Thornhead = scorpionfish; Reefrunner = snapper, bright scales; Moray Rinn; Lanternjaw =
anglerfish, lure glows faint green; Pearljaws = oyster; Stoneshell = lobster; Stormrunner = mahi-mahi, bright colours;
Razormouth = barracuda; Ironside = swordfish). These are the MORTAL rinn: the Ather's "asleep, never dead" law
(shimmer-resources.md) is for the dreaming cousins, so these have open eyes and no glow but Lanternjaw's lure. Still
whole and clean: a catch, not a butcher's slab. Same idiom as tools/art/rinn_icons.py (32x32, ground shadow, outline).
Code-drawn filler: Alex judges the look.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/open/icons'
SHADOW = '<ellipse cx="16" cy="27.5" rx="10" ry="2.2" fill="#000" opacity=".25"/>'


def svg(note, body, defs=''):
    d = f'<defs>{defs}</defs>' if defs else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  <!-- {note} Code-drawn filler. -->\n  {d}{SHADOW}\n  {body}\n</svg>\n'


def eye(x, y, r=1.1):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="#f6f2e6"/><circle cx="{x-r*0.2}" cy="{y}" r="{r*0.55}" fill="#1c1a18"/>'


def fish(cx, cy, s, body, dark, belly, fin, *, H=5.0, tail='fork', dorsal='fin', extra='', gid=None, eye_r=None):
    """a fish side-on, head left. H = body height (s=1 is ~20 px long); tail: fork | round | lunate; dorsal: fin | long | spines | none"""
    fill = f'url(#{gid})' if gid else body
    L, Hh = 10 * s, H * s
    tails = {
        'fork': f'M{cx+L*0.82} {cy} L{cx+L*1.36} {cy-Hh*0.95} Q{cx+L*1.16} {cy} {cx+L*1.36} {cy+Hh*0.95} Z',
        'round': f'M{cx+L*0.8} {cy} Q{cx+L*1.4} {cy-Hh*1.1} {cx+L*1.32} {cy} Q{cx+L*1.4} {cy+Hh*1.1} {cx+L*0.8} {cy} Z',
        'lunate': f'M{cx+L*0.8} {cy} Q{cx+L*1.1} {cy-Hh*0.4} {cx+L*1.42} {cy-Hh*1.3} Q{cx+L*1.2} {cy} {cx+L*1.42} {cy+Hh*1.3} Q{cx+L*1.1} {cy+Hh*0.4} {cx+L*0.8} {cy} Z',
    }
    t = f'<path d="{tails[tail]}" fill="{fin}" stroke="{dark}" stroke-width=".7" stroke-linejoin="round"/>'
    dors = {
        'fin': f'<path d="M{cx-L*0.15} {cy-Hh*0.85} Q{cx+L*0.15} {cy-Hh*1.6} {cx+L*0.5} {cy-Hh*0.7} Z" fill="{fin}" stroke="{dark}" stroke-width=".6"/>',
        'long': f'<path d="M{cx-L*0.62} {cy-Hh*0.9} Q{cx-L*0.2} {cy-Hh*1.75} {cx+L*0.78} {cy-Hh*0.5} L{cx+L*0.7} {cy-Hh*0.3} Z" fill="{fin}" stroke="{dark}" stroke-width=".6"/>',
        'spines': ''.join(f'<path d="M{cx-L*0.4+i*L*0.22} {cy-Hh*0.9} l{L*0.05} -{Hh*0.75} l{L*0.12} {Hh*0.72}" fill="{fin}" stroke="{dark}" stroke-width=".55"/>' for i in range(5)),
        'none': '',
    }[dorsal]
    bod = (f'<path d="M{cx-L} {cy} Q{cx-L*0.6} {cy-Hh*1.1} {cx+L*0.2} {cy-Hh} Q{cx+L*0.85} {cy-Hh*0.6} {cx+L*0.85} {cy} '
           f'Q{cx+L*0.85} {cy+Hh*0.6} {cx+L*0.2} {cy+Hh} Q{cx-L*0.6} {cy+Hh*1.1} {cx-L} {cy} Z" '
           f'fill="{fill}" stroke="{dark}" stroke-width=".8" stroke-linejoin="round"/>')
    bel = f'<path d="M{cx-L*0.7} {cy+Hh*0.38} Q{cx} {cy+Hh*0.95} {cx+L*0.6} {cy+Hh*0.38}" fill="none" stroke="{belly}" stroke-width="{1.2*s}" opacity=".85"/>'
    gill = f'<path d="M{cx-L*0.45} {cy-Hh*0.55} Q{cx-L*0.3} {cy} {cx-L*0.45} {cy+Hh*0.55}" fill="none" stroke="{dark}" stroke-width=".5" opacity=".7"/>'
    pec = f'<path d="M{cx-L*0.25} {cy+Hh*0.2} q{L*0.25} {Hh*0.2} {L*0.2} {Hh*0.75} q-{L*0.25} -{Hh*0.2} -{L*0.2} -{Hh*0.75} Z" fill="{fin}" opacity=".85"/>'
    return t + dors + bod + extra + bel + gill + pec + eye(cx - L * 0.7, cy - Hh * 0.22, eye_r or (0.75 * s + 0.35))


def grad(id_, a, b, c=None, vertical=True):
    x2, y2 = ('0', '1') if vertical else ('1', '0')
    stops = f'<stop offset="0" stop-color="{a}"/>' + (f'<stop offset=".55" stop-color="{c}"/>' if c else '') + f'<stop offset="1" stop-color="{b}"/>'
    return f'<linearGradient id="{id_}" x1="0" y1="0" x2="{x2}" y2="{y2}">{stops}</linearGradient>'


ICONS = {}

# ── tier 1 ────────────────────────────────────────────────────────────────────────────────────────────────────
SG = dict(body='#a8b8c8', dark='#3c4a5a', belly='#eef4fa', fin='#8a9cb0')
ICONS['silvergill'] = ('Silvergill: a small school of herring-silver rinn.',
    fish(11, 11, 0.55, **SG, H=4.2, gid='sg') + fish(20.4, 15.4, 0.6, **SG, H=4.2, gid='sg') + fish(10.4, 21, 0.62, **SG, H=4.2, gid='sg'),
    grad('sg', '#5a7890', '#e6eef6', '#b4c4d4'))

SHRIMP = lambda x, y, k, c: (f'<g transform="translate({x} {y}) scale({k})">'
    f'<path d="M-6 -2 Q-6 -7 0 -7 Q7 -7 7 0 Q7 5 2 6 L0 3 Q4 2 4 0 Q4 -4 0 -4 Q-3 -4 -3 -1 Z" fill="{c}" stroke="#7a3a2a" stroke-width=".7" stroke-linejoin="round"/>'
    f'<path d="M-1.5 -6.6 L-1 -3.8 M1.6 -6.8 L1.4 -4 M4.4 -5.8 L3.4 -3.4 M6.4 -3.4 L4 -1.6" stroke="#7a3a2a" stroke-width=".5"/>'
    f'<path d="M-6 -2 l-4 -3 M-6 -1.6 l-4.6 -.6 M2 6 l-1 3 l3 -1.4" stroke="#7a3a2a" stroke-width=".55" fill="none"/>'
    f'<circle cx="-4.6" cy="-3.6" r=".8" fill="#1c1a18"/></g>')
ICONS['razorback'] = ('Razorbacks: a handful of shrimp, curled.',
    SHRIMP(12, 14, 1.0, '#e8a088') + SHRIMP(20, 20, 0.95, '#e09478'), '')

BS_SPOTS = ''.join(f'<circle cx="{x}" cy="{y}" r=".7" fill="#2c4a6a"/>' for x, y in [(12, 13.8), (15, 13), (18, 13.6), (21, 14.4), (14, 16.6), (17.4, 16.2), (20, 17)])
ICONS['bluescale'] = ('Bluescale: a river-mouth trout, blue with dark spots and a rose band.',
    fish(14.6, 16, 1.0, '#6a9cc8', '#26405e', '#e8f0f4', '#5a86b0', H=4.6, tail='round', gid='bs',
         extra='<path d="M7 16.4 Q15 14.6 23 16" fill="none" stroke="#e09aa8" stroke-width="1.4" opacity=".75"/>' + BS_SPOTS),
    grad('bs', '#4a78a8', '#d8e6ee', '#7aa8d0'))

# ── tier 2 ────────────────────────────────────────────────────────────────────────────────────────────────────
ICONS['coppermouth'] = ('Coppermouth: a bass, olive-green, its big mouth copper.',
    fish(15, 16, 1.0, '#7a8a4a', '#36401e', '#e6e2c0', '#6a7a3c', H=5.6, tail='round', dorsal='spines', gid='cm',
         extra='<path d="M5.4 15 Q4.4 16.4 5.6 17.8 L8.2 17 Q7.4 16.2 8.2 15.4 Z" fill="#c87a3a" stroke="#6a3a1a" stroke-width=".6"/>'
               '<path d="M9 14 L22 15 M9.6 17.6 L22 17" stroke="#4a5a2a" stroke-width=".7" stroke-dasharray="1.6 1" opacity=".7"/>'),
    grad('cm', '#5a6a32', '#d6d6a8', '#8a9a56'))

STRIPES = ''.join(f'<path d="M{x} 11.6 q1.2 1.6 0 3.4" fill="none" stroke="#1e3a44" stroke-width=".9"/>' for x in (10, 12.6, 15.2, 17.8, 20.4))
ICONS['duskfin'] = ('Duskfin: a mackerel, blue-green back barred dark, silver belly.',
    fish(15, 16, 1.0, '#3a8a8a', '#1a3a44', '#eef4f2', '#3a7a80', H=4.2, tail='fork', gid='df', extra=STRIPES),
    grad('df', '#2a6a74', '#e6eeee', '#5aa0a0'))

MOTTLE = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#4a5a32" opacity=".7"/>' for x, y, r in [(10, 14, 1.2), (14, 12.6, 1), (18, 13.4, 1.3), (22, 15, 1), (13, 17, 1.1), (17.6, 17.6, 1), (21, 18.6, .8)])
ICONS['mossback'] = ('Mossback: a flounder, flat and mottled green-brown, both eyes on top.',
    '<ellipse cx="16" cy="16" rx="11" ry="7" fill="#8a8a5a" stroke="#3e3e22" stroke-width=".8"/>'
    '<path d="M5.4 16 Q5 12 8 10.4 M5.4 16 Q5 20 8 21.6 M26.6 16 Q27 12 24 10.4 M26.6 16 Q27 20 24 21.6" fill="none" stroke="#6a6a40" stroke-width="1.4"/>'
    + MOTTLE +
    '<path d="M26.6 16 L30.4 12.6 Q29.4 16 30.4 19.4 Z" fill="#7a7a4a" stroke="#3e3e22" stroke-width=".7"/>'
    + eye(8.4, 13.4, 1.0) + eye(10.6, 12.2, 1.0), '')

ICONS['thornhead'] = ('Thornhead: a scorpionfish, red-orange, a big head and a crest of spines.',
    fish(15.6, 17, 1.0, '#d0603a', '#5a2414', '#f4c8a8', '#c04a2a', H=5.8, tail='round', dorsal='spines', gid='th',
         extra=''.join(f'<circle cx="{x}" cy="{y}" r=".9" fill="#8a2a14" opacity=".6"/>' for x, y in [(11, 14), (15, 13), (19, 15), (13, 19), (18, 19.4)])
               + '<path d="M5.6 14 l-1.6 -1.4 M7 12.6 l-.8 -1.8 M5.4 18.6 l-1.6 1" stroke="#5a2414" stroke-width=".7"/>', eye_r=1.3),
    grad('th', '#b84a2a', '#f0b890', '#e0784a'))

# ── tier 3 ────────────────────────────────────────────────────────────────────────────────────────────────────
ICONS['reefrunner'] = ('Reefrunner: a snapper, bright rose-red scales.',
    fish(15, 16, 1.0, '#e8506a', '#6a1a28', '#ffe0e4', '#e0405a', H=5.4, tail='fork', dorsal='spines', gid='rr',
         extra='<path d="M9 13.4 Q15 12 22 13.6 M9.4 15.6 Q15 14.4 22.4 15.6" fill="none" stroke="#ffb0bc" stroke-width=".6" opacity=".7"/>'),
    grad('rr', '#c83050', '#ffd0d8', '#f0607a'))

MORAY = 'M6.4 11.4 Q3.6 16 7 20.6 Q11.6 25.6 19 23.8 Q26.4 22 25.6 15.8 Q24.8 10.6 18.6 11.4 Q13.6 12.2 14.4 16.4 Q15 19.2 18.4 18.6'
ICONS['moray-rinn'] = ('Moray Rinn: a coiled reef eel, mottled green-yellow, jaw open.',
    f'<path d="{MORAY}" fill="none" stroke="#2a3a1a" stroke-width="4.8" stroke-linecap="round"/>'
    f'<path d="{MORAY}" fill="none" stroke="#8aa04a" stroke-width="3.4" stroke-linecap="round"/>'
    f'<path d="{MORAY}" fill="none" stroke="#d8d070" stroke-width="1.2" stroke-dasharray=".8 1.8" stroke-linecap="round"/>'
    '<path d="M6.4 11.4 L2.4 9 L4.4 12.4 L2.2 13.4 L6 13.6 Z" fill="#8aa04a" stroke="#2a3a1a" stroke-width=".7" stroke-linejoin="round"/>'
    '<path d="M3 10 l.6 1 M3.2 12.8 l.6 -.8" stroke="#f6f2e6" stroke-width=".5"/>' + eye(6.6, 10.6, 0.8), '')

ICONS['lanternjaw'] = ('Lanternjaw: a small anglerfish, dark and dense, its lure glowing faint green.',
    '<circle cx="8.4" cy="7" r="3.4" fill="#9af0a8" opacity=".25"/>'
    + fish(16.6, 18, 1.0, '#5a4636', '#22180e', '#8a7460', '#4a3a2a', H=6.6, tail='round', dorsal='none', gid='lj',
           extra='<path d="M6.6 17 L11 18.4 L6.6 20.4" fill="#22180e"/><path d="M7 17.6 l.6 .8 l.6 -.8 l.6 .8 l.6 -.8 M7 19.8 l.6 -.8 l.6 .8 l.6 -.8" stroke="#f6f2e6" stroke-width=".5" fill="none"/>'
                 '<path d="M12 12.4 Q10 6 8.4 7" fill="none" stroke="#4a3a2a" stroke-width=".8"/>', eye_r=1.0)
    + '<circle cx="8.4" cy="7" r="1.3" fill="#c8ffc8"/><circle cx="8.4" cy="7" r="2.1" fill="#9af0a8" opacity=".45"/>',
    grad('lj', '#3a2a1e', '#8a7460', '#5a4636'))

ICONS['pearljaw'] = ('Pearljaws: a rough sea oyster, prised open, a pearl inside.',
    '<path d="M4.6 18 Q5 25 16 25.4 Q27 25 27.4 18 Z" fill="#7a6e5a" stroke="#3a3226" stroke-width=".9" stroke-linejoin="round"/>'
    '<path d="M6.4 18.2 Q8 23 16 23.4 Q24 23 25.6 18.2 Z" fill="#e8e2d4"/>'
    '<path d="M5 17.4 Q4 9 10 8 Q16 6 22 8.4 Q28 9.4 27 17.4 Q16 14.8 5 17.4 Z" fill="#8a7e68" stroke="#3a3226" stroke-width=".9" stroke-linejoin="round"/>'
    '<path d="M7 15 Q9 11 13 10.6 M11 16 Q13 12.6 17 12.4 M17.4 15.6 Q20 12.6 24 12.8" fill="none" stroke="#5a5040" stroke-width=".6"/>'
    '<path d="M8 10.2 l1.4 -1 M14 8 l1.2 -1.2 M20 8.6 l1.4 -.8" stroke="#a89a80" stroke-width=".8"/>'
    '<circle cx="16" cy="19.8" r="2.4" fill="#f6f2ee" stroke="#a8a090" stroke-width=".5"/><circle cx="15.2" cy="19" r=".6" fill="#fff"/>', '')

ICONS['stoneshell'] = ('Stoneshell: a lobster, dark red-brown shell, claws forward.',
    '<g stroke="#3a1a12" stroke-width=".8" stroke-linejoin="round">'
    '<path d="M9 16 Q16 12.6 23 15 L26.6 13.4 L28.6 16.4 L26.6 19 L23 17.6 Q16 20 9 16 Z" fill="#9a3a26"/>'
    '<path d="M15 13.6 L15.4 18.6 M18.6 13.8 L18.8 18.8 M21.6 14.4 L21.8 18" stroke="#6a2416" fill="none"/>'
    '<path d="M9 16 Q6.6 13 8 11.2 Q4.6 10 3.4 6.6 Q7.4 7 9.4 9.6 Q9.6 7 12 6.4 Q11.6 9.6 10.6 11.6 Z" fill="#a8442c"/>'
    '<path d="M9 16 Q6.6 19 8 20.8 Q4.6 22 3.4 25.4 Q7.4 25 9.4 22.4 Q9.6 25 12 25.6 Q11.6 22.4 10.6 20.4 Z" fill="#a8442c"/></g>'
    '<path d="M9 15.2 Q4 12 1.4 14 M9 16.8 Q4 20 1.4 18" fill="none" stroke="#6a2416" stroke-width=".6"/>'
    '<g stroke="#6a2416" stroke-width=".6"><path d="M13 18.6 l-1 2.6 M16 19 l-.6 2.8 M19 19 l0 2.8 M13 13.4 l-1 -2.6 M16 13 l-.6 -2.8 M19 13 l0 -2.8"/></g>'
    + eye(10.2, 14.6, 0.6) + eye(10.2, 17.4, 0.6), '')

# ── tier 4 ────────────────────────────────────────────────────────────────────────────────────────────────────
ICONS['stormrunner'] = ('Stormrunner: a mahi-mahi, green-gold and bright, blunt brow, a dorsal the length of it.',
    fish(15.4, 16.4, 1.05, '#3aa86a', '#1a4a2a', '#f4e070', '#2a8a9a', H=5.4, tail='fork', dorsal='long', gid='sr',
         extra=''.join(f'<circle cx="{x}" cy="{y}" r=".7" fill="#2a6a9a" opacity=".8"/>' for x, y in [(9, 15), (12, 14), (15, 15.4), (18, 14.6), (21, 15.8)])
               + '<path d="M5 16.4 Q4.6 12.6 7.4 11.4" fill="none" stroke="#1a4a2a" stroke-width=".7"/>'),
    grad('sr', '#2a8a5a', '#f0d850', '#7ac85a'))

BARS = ''.join(f'<path d="M{x} 13.6 l-.8 3.2" stroke="#2a3440" stroke-width="1" opacity=".7"/>' for x in (11, 14, 17, 20, 23))
ICONS['razormouth'] = ('Razormouth: a barracuda, long and silver, dark bars, a jaw full of teeth.',
    fish(16.4, 16, 1.25, '#b8c4cc', '#2e3a44', '#f0f4f6', '#8a98a4', H=2.4, tail='fork', dorsal='fin', gid='rm',
         extra=BARS + '<path d="M4 16 L8.6 15.4 M4.6 16.6 L8.6 16.8" stroke="#2e3a44" stroke-width=".6"/>'
               '<path d="M5.4 15.6 l.4 .5 l.4 -.5 l.4 .5 l.4 -.5 l.4 .5" stroke="#fff" stroke-width=".4" fill="none"/>', eye_r=0.9),
    grad('rm', '#7a8894', '#f4f6f8', '#c4ccd4'))

ICONS['ironside'] = ('Ironside: a swordfish, dark steel-blue, its long bill out ahead.',
    '<path d="M1.2 14.6 L9.6 15.4 L9.6 16.4 Z" fill="#3a4a5a" stroke="#1a2430" stroke-width=".6" stroke-linejoin="round"/>'
    + fish(17.6, 16, 0.95, '#4a6a8a', '#1a2a3a', '#d8e0e8', '#3a5070', H=4.4, tail='lunate', dorsal='fin', gid='is',
           extra='<path d="M14 11.6 L16.4 6.4 L19 11.4 Z" fill="#3a5070" stroke="#1a2a3a" stroke-width=".6"/>'),
    grad('is', '#2a4460', '#d0dae4', '#5a7a9a'))

# ── the mortal cousins of two Ather names (rinn.md › Shared names across the gate): the TUNA and the plain sea eel ──
FINLETS = ''.join(f'<path d="M{x} 12.4 l.8 -1.2 l.6 1.2 M{x} 19.6 l.8 1.2 l.6 -1.2" fill="#f0c830" stroke="#8a6a10" stroke-width=".3"/>' for x in (19.4, 21, 22.6))
ICONS['sea-shimmerscale'] = ('Shimmerscale (the ocean one): a tuna, dark blue back, silver flank, yellow finlets.',
    fish(15, 16, 1.1, '#2a4a8a', '#0e1e40', '#e6eef6', '#2a3a70', H=4.6, tail='lunate', dorsal='fin', gid='tu', extra=FINLETS),
    grad('tu', '#1a3070', '#e8eef4', '#7a98c0'))
SEEL = 'M7 11 Q3.4 16 7 20.6 Q11.6 25.6 19 23.8 Q26.4 22 25.6 15.8 Q24.8 10.6 18.6 11.4 Q13.6 12.2 14.4 16.4 Q15 19.2 18.4 18.6'
ICONS['sea-ribboneel'] = ('Ribboneel (the sea one): a plain slate-olive eel, a loose coil, no shimmer.',
    f'<path d="{SEEL}" fill="none" stroke="#1e2a20" stroke-width="4.6" stroke-linecap="round"/>'
    f'<path d="{SEEL}" fill="none" stroke="#5a6a4a" stroke-width="3.2" stroke-linecap="round"/>'
    f'<path d="{SEEL}" fill="none" stroke="#c8ccb0" stroke-width=".7" opacity=".45" transform="translate(.4 .9)"/>'
    '<ellipse cx="7.6" cy="10.4" rx="2.6" ry="1.9" fill="#5a6a4a" stroke="#1e2a20" stroke-width=".8" transform="rotate(-30 7.6 10.4)"/>' + eye(7, 10, 0.7), '')

# ── rivers and lakes (rinn.md › Rivers & Lakes, RULED 11-16) ──────────────────────────────────────────────────
PB = dict(body='#a8a888', dark='#40442a', belly='#eeeede', fin='#8a8a6a')
ICONS['pebblefin'] = ('Pebblefin: a handful of little stream minnows over gravel.',
    fish(11.4, 11.6, 0.5, **PB, H=4) + fish(20.2, 15, 0.55, **PB, H=4) + fish(11, 20.4, 0.55, **PB, H=4)
    + '<g fill="#8a8274" opacity=".6"><circle cx="8" cy="25" r=".9"/><circle cx="14" cy="25.6" r=".7"/><circle cx="22" cy="25" r="1"/></g>', '')
PSTRIPE = ''.join(f'<path d="M{x} 11.6 L{x-0.8} 20" stroke="#2a3a1a" stroke-width="1.1" opacity=".75"/>' for x in (10.6, 13.6, 16.6, 19.6))
ICONS['reedperch'] = ('Reedperch: a bold striped perch, red-tipped fins.',
    fish(15, 16, 1.0, '#a8b04a', '#3a4018', '#f4ecc0', '#d0603a', H=5.6, tail='fork', dorsal='spines', gid='rp', extra=PSTRIPE),
    grad('rp', '#7a8a2a', '#f0e8b0', '#b8c058'))
ICONS['mudwhisker'] = ('Mudwhisker: a whiskered brown catfish, broad flat head.',
    fish(16, 17, 1.05, '#7a6448', '#2e2416', '#c8b490', '#5e4a32', H=4.6, tail='round', dorsal='fin', gid='mw',
         extra='<path d="M5.4 16 Q1.6 14.4 1 11 M5.4 17 Q1.6 18.4 1.2 22 M6 15.4 Q3.6 12.4 4 9.6 M6 17.6 Q3.6 20.6 4.2 23.4" fill="none" stroke="#2e2416" stroke-width=".7" stroke-linecap="round"/>', eye_r=0.7),
    grad('mw', '#5a4630', '#c8b490', '#7a6448'))
PSPOTS = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="1" ry=".6" fill="#e8e0a0" opacity=".85"/>' for x, y in [(10, 15), (13, 14), (16, 15.4), (19, 14.4), (22, 15.6), (12, 17.6), (17.6, 17.6)])
ICONS['longjaw'] = ('Longjaw: a long green pike, pale spots, a duckbill jaw full of teeth.',
    '<path d="M1.6 15.4 L6.6 15 L6.6 17 L1.8 16.6 Z" fill="#4a6a2a" stroke="#1a2a10" stroke-width=".6"/>'
    + fish(16.6, 16, 1.2, '#5a7a32', '#1a2a10', '#e8ecc8', '#4a6a2a', H=2.8, tail='fork', dorsal='none', gid='lp',
           extra=PSPOTS + '<path d="M22.4 13.8 Q24.4 12 25.4 13.6 L24 15 Z" fill="#4a6a2a" stroke="#1a2a10" stroke-width=".5"/>'
                 '<path d="M2.4 16 l.4 .5 l.4 -.5 l.4 .5 l.4 -.5 l.4 .5 l.4 -.5" stroke="#fff" stroke-width=".35" fill="none"/>', eye_r=0.85),
    grad('lp', '#3a5a1e', '#e0e6b8', '#7a9a48'))
ICONS['fallsleaper'] = ('Fallsleaper: a salmon at the end of its run, red flank, hooked jaw, mid-leap.',
    '<g transform="rotate(-18 16 16)">'
    + fish(15.6, 16, 1.05, '#c84a3a', '#4a1a14', '#f0d8c8', '#8a5a4a', H=4.8, tail='fork', dorsal='fin', gid='sl',
           extra='<path d="M5.2 15.6 Q4.4 13.4 6.4 12.6" fill="none" stroke="#4a1a14" stroke-width=".9"/>'
                 + ''.join(f'<circle cx="{x}" cy="{y}" r=".55" fill="#3a1a14"/>' for x, y in [(12, 13), (15, 12.6), (18, 13.4), (21, 14)]))
    + '</g><g fill="#bfe6ff" opacity=".8"><circle cx="24" cy="23" r=".9"/><circle cx="26.6" cy="21" r=".6"/><circle cx="21.4" cy="24.6" r=".6"/></g>',
    grad('sl', '#7a8a96', '#f0d8c8', '#c84a3a'))
PLATES = ''.join(f'<path d="M{x} 12.6 l1.1 -1.4 l1.1 1.4 Z" fill="#d8d4c4" stroke="#3a3830" stroke-width=".45"/>' for x in (8.4, 11, 13.6, 16.2, 18.8, 21.4)) + \
         ''.join(f'<path d="M{x} 16.4 l.9 -.9 l.9 .9 l-.9 .9 Z" fill="#c8c4b4" stroke="#3a3830" stroke-width=".4"/>' for x in (10, 13, 16, 19, 22))
ICONS['oldplate'] = ('Oldplate: a sturgeon, old and armoured, rows of bony plates, a long snout.',
    '<path d="M1.2 15.6 L6 15 L6 17.2 Z" fill="#6a6a62" stroke="#2a2a24" stroke-width=".6"/>'
    + fish(16.4, 16.2, 1.18, '#6a6a62', '#2a2a24', '#c8c4b4', '#5a5a52', H=3.6, tail='lunate', dorsal='none', gid='op',
           extra=PLATES + '<path d="M5.6 18.2 l-.6 1.6 M6.6 18.4 l-.2 1.7" stroke="#2a2a24" stroke-width=".5"/>', eye_r=0.65),
    grad('op', '#4a4a44', '#c8c4b4', '#7a7a70'))

if __name__ == '__main__':
    for name, (note, body, defs) in ICONS.items():
        (OUT / f'{name}.svg').write_text(svg(note, body, defs))
    print(len(ICONS), 'icons')
