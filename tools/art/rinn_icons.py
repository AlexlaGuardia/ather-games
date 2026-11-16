#!/usr/bin/env python3
"""Rinning bag icons: bait + the seven Ather rinn (shared/inventory.ts › the catchOf block), public/open/icons/<id>.svg

Run: python3 tools/art/rinn_icons.py   (rewrites the 8 files)

Canon: design-briefs/shimmer-resources.md › "Rinning — dreaming, not dead": a caught rinn is NEVER a dead fish on a slab.
It reads ASLEEP: whole, unmarked, softly lit, eyes closed (every eye here is a closed lid arc). Looks per the brief's
table: Shimmerscale = a small school catching light; Clickclaw = pale shell, blunt claws; Glowfin = gentle blue-green
light; Ribboneel = a loose coil, oil-slick shimmer; Moonkoi = silver-gold, the most ornamental; Pearlshell = nacre
inside, a pearl; Crystal Rinn = translucent, partly crystallized mana, lit from within (the light law: crystal is lit
from within, a living thing has soft light). Bait has no canon look: canon says only that it is an OFFERING, craftable
food the rinn wants (game/shimmer-skilling.md › Skill 4), so it is drawn as food in a leaf wrap tied with cord (no metal
in a gardener's bag). Same idiom as tools/art/forestry_icons.py: 32x32, ground shadow, dark outline.
Code-drawn filler: Alex judges the look (feedback: game art must not block on Alex).
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/open/icons'
CORD = '#7a6446'
SHADOW = '<ellipse cx="16" cy="27.5" rx="10" ry="2.2" fill="#000" opacity=".25"/>'


def svg(note: str, body: str, defs: str = '') -> str:
    d = f'<defs>{defs}</defs>' if defs else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  <!-- {note} Code-drawn filler. -->\n  {d}{SHADOW}\n  {body}\n</svg>\n'


def lid(x, y, r=1.1, c='#2c2620'):
    """a closed eye: the rinn is asleep, never dead"""
    return f'<path d="M{x-r} {y} q{r} {r*0.9} {r*2} 0" fill="none" stroke="{c}" stroke-width=".7" stroke-linecap="round"/>'


def fish(cx, cy, s, body, dark, belly, fin, gid=None):
    """one sleeping rinn, side-on, head to the left; s = scale (1 = a 20 px fish)"""
    fill = f'url(#{gid})' if gid else body
    L, H = 10 * s, 5 * s
    tail = (f'<path d="M{cx+L*0.8} {cy} L{cx+L*1.35} {cy-H*0.9} Q{cx+L*1.2} {cy} {cx+L*1.35} {cy+H*0.9} Z" '
            f'fill="{fin}" stroke="{dark}" stroke-width=".7" stroke-linejoin="round"/>')
    top_fin = (f'<path d="M{cx-L*0.15} {cy-H*0.85} Q{cx+L*0.15} {cy-H*1.6} {cx+L*0.5} {cy-H*0.7}" '
               f'fill="{fin}" stroke="{dark}" stroke-width=".6"/>')
    bod = (f'<path d="M{cx-L} {cy} Q{cx-L*0.6} {cy-H*1.1} {cx+L*0.2} {cy-H} Q{cx+L*0.85} {cy-H*0.6} {cx+L*0.85} {cy} '
           f'Q{cx+L*0.85} {cy+H*0.6} {cx+L*0.2} {cy+H} Q{cx-L*0.6} {cy+H*1.1} {cx-L} {cy} Z" '
           f'fill="{fill}" stroke="{dark}" stroke-width=".8" stroke-linejoin="round"/>')
    bel = f'<path d="M{cx-L*0.7} {cy+H*0.35} Q{cx} {cy+H*0.95} {cx+L*0.6} {cy+H*0.35}" fill="none" stroke="{belly}" stroke-width="{1.1*s}" opacity=".8"/>'
    gill = f'<path d="M{cx-L*0.45} {cy-H*0.55} Q{cx-L*0.3} {cy} {cx-L*0.45} {cy+H*0.55}" fill="none" stroke="{dark}" stroke-width=".5" opacity=".7"/>'
    side_fin = f'<path d="M{cx-L*0.25} {cy+H*0.2} q{L*0.25} {H*0.2} {L*0.2} {H*0.75} q-{L*0.25} -{H*0.2} -{L*0.2} -{H*0.75} Z" fill="{fin}" opacity=".85"/>'
    return tail + top_fin + bod + bel + gill + side_fin + lid(cx - L * 0.68, cy - H * 0.2, 0.9 * s + 0.2)


def halo(cx, cy, rx, ry, c, op):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{c}" opacity="{op}"/>'


# ── Bait: an offering, food in a leaf wrap tied with cord, a few morsels spilling ───────────────────────────────
BAIT = (
    '<path d="M6 20 Q7 12 16 11 Q25 12 26 20 Q22 25.4 16 25.4 Q10 25.4 6 20 Z" fill="#6f9b4f" stroke="#3f5a2a" stroke-width=".9" stroke-linejoin="round"/>'
    '<path d="M16 11.4 L16 24.8 M16 15 L11 13.4 M16 15 L21 13.4 M16 19 L9.6 17.8 M16 19 L22.4 17.8" stroke="#557d3b" stroke-width=".6" fill="none"/>'
    '<path d="M9 13 Q12 9.6 16 10.4 Q20 9.6 23 13 Q19.4 15.4 16 14.6 Q12.6 15.4 9 13 Z" fill="#c9a46a" stroke="#7d6a48" stroke-width=".7"/>'
    '<g fill="#e2c48a" stroke="#8a6a45" stroke-width=".5"><circle cx="13" cy="12.2" r="1.3"/><circle cx="16.4" cy="11.4" r="1.4"/><circle cx="19.4" cy="12.4" r="1.2"/></g>'
    f'<path d="M6.6 19.4 Q16 23 25.4 19.4" fill="none" stroke="{CORD}" stroke-width="1.1"/>'
    f'<path d="M16 21.2 q-2.6 2.4 -3.6 .2 q1.6 -1 3.6 -.2 q2.6 2.4 3.6 .2 q-1.6 -1 -3.6 -.2" fill="none" stroke="{CORD}" stroke-width=".9"/>'
    '<g fill="#e2c48a" stroke="#8a6a45" stroke-width=".5"><circle cx="25.6" cy="24.6" r="1.1"/><circle cx="27.8" cy="23" r=".8"/></g>'
)

# ── Shimmerscale: a small school of tiny warm-gold rinn, catching the light ─────────────────────────────────────
SCALE = dict(body='#f0c25a', dark='#8a5a1c', belly='#fff0b8', fin='#e09a3a')
SHIMMERSCALE = (
    halo(16, 17, 12, 8, '#f6d27a', '.12')
    + fish(11, 11.6, 0.55, **SCALE) + fish(20, 15.6, 0.6, **SCALE) + fish(10.4, 21, 0.62, **SCALE)
    + '<g fill="#fff8d6"><circle cx="15" cy="9" r=".7"/><circle cx="24.6" cy="12.6" r=".6"/><circle cx="16" cy="20.6" r=".6"/></g>'
)

# ── Clickclaw: a small crab, pale shell, blunt claws tucked, eye stalks lowered and shut ──────────────────────
CLICKCLAW = (
    halo(16, 18, 11, 6.4, '#f4e2d0', '.18')
    + '<g stroke="#8c6450" stroke-width="1" stroke-linecap="round" fill="none">'
    '<path d="M10 20 l-3.6 2.2 l-1 2.6 M10.6 21.6 l-2.6 2.6 l-.4 2 M22 20 l3.6 2.2 l1 2.6 M21.4 21.6 l2.6 2.6 l.4 2"/></g>'
    '<path d="M7 18.6 Q7 12 16 12 Q25 12 25 18.6 Q25 22.6 16 22.6 Q7 22.6 7 18.6 Z" fill="#ead2bc" stroke="#8c6450" stroke-width=".9"/>'
    '<path d="M9.6 15.4 Q16 13.2 22.4 15.4" fill="none" stroke="#fff4e6" stroke-width="1.1" opacity=".8"/>'
    '<path d="M10.4 18 q1.4 -.8 2.8 0 M18.8 18 q1.4 -.8 2.8 0" fill="none" stroke="#c9a088" stroke-width=".6"/>'
    # blunt claws folded in front
    '<path d="M3.4 15.6 Q3 11 7 10.6 Q9.6 11 9 14 Q8 16.8 5.4 17 Q3.6 17 3.4 15.6 Z" fill="#e0bfa4" stroke="#8c6450" stroke-width=".8"/>'
    '<path d="M28.6 15.6 Q29 11 25 10.6 Q22.4 11 23 14 Q24 16.8 26.6 17 Q28.4 17 28.6 15.6 Z" fill="#e0bfa4" stroke="#8c6450" stroke-width=".8"/>'
    '<path d="M4.6 12.6 l2.6 1 M27.4 12.6 l-2.6 1" stroke="#8c6450" stroke-width=".6"/>'
    # eye stalks lowered, lids shut
    '<path d="M13.6 12.4 l-.6 -2 M18.4 12.4 l.6 -2" stroke="#8c6450" stroke-width=".9"/>'
    '<circle cx="12.9" cy="10" r="1.2" fill="#ead2bc" stroke="#8c6450" stroke-width=".6"/><circle cx="19.1" cy="10" r="1.2" fill="#ead2bc" stroke="#8c6450" stroke-width=".6"/>'
    + lid(12.9, 10, 0.7) + lid(19.1, 10, 0.7)
)

# ── Glowfin: a medium rinn, soft bioluminescent scales, gentle blue-green light ───────────────────────────────
GLOW_DEFS = ('<radialGradient id="gf" cx=".4" cy=".45" r=".7"><stop offset="0" stop-color="#d8fff2"/>'
             '<stop offset=".5" stop-color="#6fe0c4"/><stop offset="1" stop-color="#2f9a8a"/></radialGradient>')
GLOWFIN = (
    halo(16, 17, 13.4, 8.6, '#6fe0c4', '.3') + halo(16, 17, 9, 5.6, '#a8f4e0', '.25')
    + fish(15, 17, 1.0, '#6fe0c4', '#1f6a62', '#e6fff8', '#8af0d8', gid='gf')
    + '<g fill="#e6fff8" opacity=".9"><circle cx="13" cy="15" r=".7"/><circle cx="16.4" cy="14.4" r=".6"/><circle cx="19.4" cy="15.6" r=".7"/><circle cx="15" cy="18.6" r=".5"/></g>'
)

# ── Ribboneel: long, slippery, a loose coil, oil-slick shimmer ────────────────────────────────────────────────
EEL_DEFS = ('<linearGradient id="ge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a5ac8"/>'
            '<stop offset=".35" stop-color="#3fb0c8"/><stop offset=".65" stop-color="#7ad08a"/><stop offset="1" stop-color="#c88ad0"/></linearGradient>')
EEL_PATH = 'M8 10.6 Q4 14 7 19 Q11 25 19 23.6 Q26 22 25.4 16 Q24.6 11 18.6 11.6 Q13.4 12.4 14 16.6 Q14.6 19.6 18.4 19 Q20.8 18.4 20.4 16.2'
RIBBONEEL = (
    halo(16, 17, 12, 8, '#9ad0d8', '.2')
    + f'<path d="{EEL_PATH}" fill="none" stroke="#2e2a4a" stroke-width="4.6" stroke-linecap="round"/>'
    + f'<path d="{EEL_PATH}" fill="none" stroke="url(#ge)" stroke-width="3.2" stroke-linecap="round"/>'
    + f'<path d="{EEL_PATH}" fill="none" stroke="#fff" stroke-width=".6" opacity=".5" transform="translate(-.5 -.7)"/>'
    # ribbon fin trailing off the tail, the head at the coil's outer start
    + '<path d="M20.4 16.2 q2 -1.8 .4 -3.4" fill="none" stroke="#c88ad0" stroke-width="1" stroke-linecap="round"/>'
    + '<ellipse cx="8.6" cy="10" rx="2.6" ry="2" fill="#6a5ab8" stroke="#2e2a4a" stroke-width=".8" transform="rotate(-30 8.6 10)"/>'
    + lid(8.4, 9.6, 0.7, '#f0eaff')
)

# ── Moonkoi: large, silver-gold, the most ornamental: long trailing fins, a gold saddle on silver ──────────────
KOI_DEFS = ('<linearGradient id="gk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#eef0f6"/>'
            '<stop offset=".45" stop-color="#d8dce6"/><stop offset=".55" stop-color="#e8c66a"/><stop offset="1" stop-color="#f0d890"/></linearGradient>')
MOONKOI = (
    halo(16, 16, 13, 8.4, '#f4eccc', '.1')
    # long veil fins first, under the body
    + '<path d="M22 16 Q28 9 30.6 12 Q28 15 30.8 20 Q27.6 22.6 22 17" fill="#f2e2a6" stroke="#9a8650" stroke-width=".6" opacity=".9"/>'
    + '<path d="M12 20 Q11 26 15 26.4 Q15.6 23 16 20.4" fill="#f2e2a6" stroke="#9a8650" stroke-width=".6" opacity=".85"/>'
    + fish(14, 16, 1.0, '#e0e2ea', '#6c6a74', '#ffffff', '#f2e2a6', gid='gk')
    + '<path d="M14 11.6 Q17 13 16.6 16 Q15.6 18 13 17.6 Q11.6 15 14 11.6 Z" fill="#e8b84a" opacity=".75"/>'
    # barbels, the koi tell
    + '<path d="M4.4 16.4 q-1 1.6 -2.4 1.8 M4.6 17 q-.4 2 -1.6 2.8" fill="none" stroke="#9a8650" stroke-width=".5" stroke-linecap="round"/>'
    + '<g fill="#fffbe8"><circle cx="10" cy="14" r=".6"/><circle cx="19.4" cy="14.6" r=".5"/></g>'
)

# ── Pearlshell: an Ather oyster, lid lifted, nacre inside and a small pearl ───────────────────────────────────
NACRE_DEFS = ('<linearGradient id="gn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6eaf6"/>'
              '<stop offset=".5" stop-color="#d6ecf4"/><stop offset="1" stop-color="#f4e6d6"/></linearGradient>'
              '<radialGradient id="gp" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/>'
              '<stop offset=".6" stop-color="#f0e6f2"/><stop offset="1" stop-color="#c8b8cc"/></radialGradient>')
PEARLSHELL = (
    # lower valve, rough grey-violet outside, nacre bowl inside
    '<path d="M4.6 18 Q5 25 16 25.4 Q27 25 27.4 18 Z" fill="#8a7f8e" stroke="#4a4250" stroke-width=".9" stroke-linejoin="round"/>'
    + '<path d="M6.4 18.2 Q8 23 16 23.4 Q24 23 25.6 18.2 Z" fill="url(#gn)"/>'
    + '<path d="M7 22 q3 1 5 .2 M20 22.4 q3 -.2 5 -1.6" stroke="#6a6070" stroke-width=".5" fill="none"/>'
    # upper valve lifted open behind
    + '<path d="M5 17.4 Q4.6 8 16 7 Q27.4 8 27 17.4 Q16 14.8 5 17.4 Z" fill="#9a8f9e" stroke="#4a4250" stroke-width=".9" stroke-linejoin="round"/>'
    + '<path d="M7.6 15 Q9 10 16 9.4 M10.4 15.8 Q12 11.6 16 11.4 M24.4 15 Q23 10 16 9.4 M21.6 15.8 Q20 11.6 16 11.4" fill="none" stroke="#6a6070" stroke-width=".55"/>'
    + '<path d="M6.6 16.8 Q16 14.6 25.4 16.8" fill="none" stroke="#e6dcef" stroke-width=".9" opacity=".8"/>'
    + halo(16, 19.6, 4.6, 3, '#fff6fc', '.5')
    + '<circle cx="16" cy="19.6" r="2.6" fill="url(#gp)" stroke="#9a8aa0" stroke-width=".5"/><circle cx="15.1" cy="18.7" r=".7" fill="#fff"/>'
)

# ── Crystal Rinn: a translucent dream-fish, partly crystallized mana, lit from within ─────────────────────────
CRYS_DEFS = ('<radialGradient id="gc" cx=".45" cy=".45" r=".65"><stop offset="0" stop-color="#ffffff"/>'
             '<stop offset=".45" stop-color="#cfe8ff" stop-opacity=".85"/><stop offset="1" stop-color="#8ab8f0" stop-opacity=".55"/></radialGradient>')
CRYSTAL_RINN = (
    halo(16, 16.6, 13.6, 9.4, '#bfe0ff', '.3') + halo(15, 16.6, 8, 5, '#f4f0c8', '.35')
    + fish(15, 16.6, 1.0, '#cfe8ff', '#4a6a9a', '#ffffff', '#d8eeff', gid='gc')
    # the crystallized half: facets through the back of the body, and the mana crystal held inside, bright
    + '<path d="M15 11.6 L19.4 12.6 L22.6 16.6 L19.4 20.6 L15 21.6 L17 16.6 Z" fill="#e8f4ff" opacity=".55" stroke="#7aa0d8" stroke-width=".5" stroke-linejoin="round"/>'
    + '<path d="M15 11.6 L17 16.6 L22.6 16.6 M17 16.6 L15 21.6" fill="none" stroke="#7aa0d8" stroke-width=".45"/>'
    + '<path d="M12.6 14.6 L14.2 16.6 L12.6 18.6 L11 16.6 Z" fill="#fff4b0" stroke="#d8b84a" stroke-width=".5"/>'
    + '<circle cx="12.6" cy="16.6" r="2.6" fill="#fff4b0" opacity=".35"/>'
    + '<g fill="#ffffff"><circle cx="20.6" cy="10" r=".6"/><circle cx="25.4" cy="13" r=".5"/><circle cx="8" cy="12.6" r=".5"/></g>'
)

ICONS = {
    'bait': ('Bait: an offering, food in a leaf wrap tied with cord.', BAIT, ''),
    'shimmerscale': ('Shimmerscale: a small school of tiny warm-gold rinn, asleep, catching the light.', SHIMMERSCALE, ''),
    'clickclaw': ('Clickclaw: a small pale-shelled crab, blunt claws tucked, eyes shut.', CLICKCLAW, ''),
    'glowfin': ('Glowfin: a sleeping rinn, soft blue-green bioluminescence.', GLOWFIN, GLOW_DEFS),
    'ribboneel': ('Ribboneel: a loose sleeping coil, oil-slick shimmer.', RIBBONEEL, EEL_DEFS),
    'moonkoi': ('Moonkoi: silver-gold, long veil fins, the most ornamental, asleep.', MOONKOI, KOI_DEFS),
    'pearlshell': ('Pearlshell: an Ather oyster, lid lifted, nacre and a small pearl.', PEARLSHELL, NACRE_DEFS),
    'crystal-rinn': ('Crystal Rinn: a translucent dream-fish, half crystallized mana, lit from within.', CRYSTAL_RINN, CRYS_DEFS),
}

if __name__ == '__main__':
    for name, (note, body, defs) in ICONS.items():
        (OUT / f'{name}.svg').write_text(svg(note, body, defs))
        print('wrote', OUT / f'{name}.svg')
