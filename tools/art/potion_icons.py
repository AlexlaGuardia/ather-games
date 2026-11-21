#!/usr/bin/env python3
"""Potion bag icons: code-drawn SVGs (32x32) in public/open/icons/, in the waymark.svg idiom.

Run: python3 tools/art/potion_icons.py   (rewrites the 3 files)

The open world's brews (src/app/shimmer/open/ather/alchemy.ts): a stoppered clay-and-glass bottle, cord at the neck (no metal),
the brew lit from within (the LIGHT LAW: fluid mana glows). Colours follow each brew's buff in engine/potion-effects.ts
(Starlight #c8b8ff, Ather Flow #4aa3e6) and the raw shard's blue for the tonic.
Code-drawn filler: Alex judges the look (feedback: game art must not block on Alex).
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/open/icons'
SHADOW = '<ellipse cx="16" cy="27.5" rx="9" ry="2" fill="#000" opacity=".25"/>'


def bottle(liquid: str, glow: str, shape: str) -> str:
    if shape == 'round':
        body = '<path d="M13 9 L19 9 L19 12 Q25 14 25 20 Q25 26.5 16 26.5 Q7 26.5 7 20 Q7 14 13 12 Z"'
        fill = '<path d="M8.4 19 Q16 17 23.6 19 Q24 25.4 16 25.4 Q8 25.4 8.4 19 Z"'
    elif shape == 'tall':
        body = '<path d="M13.5 6 L18.5 6 L18.5 10 Q22 11 22 14 L22 24 Q22 26.5 16 26.5 Q10 26.5 10 24 L10 14 Q10 11 13.5 10 Z"'
        fill = '<path d="M11 15 L21 15 L21 24 Q21 25.4 16 25.4 Q11 25.4 11 24 Z"'
    else:  # flask
        body = '<path d="M13.5 7 L18.5 7 L18.5 13 L25 24 Q26 26.5 22 26.5 L10 26.5 Q6 26.5 7 24 L13.5 13 Z"'
        fill = '<path d="M10.6 19 L21.4 19 L24 23.8 Q24.6 25.4 22 25.4 L10 25.4 Q7.4 25.4 8 23.8 Z"'
    return (f'  <circle cx="16" cy="20" r="9" fill="{glow}" opacity=".18"/>\n'
            f'  {body} fill="#e8f3ff" fill-opacity=".35" stroke="#5a6a7a" stroke-width=".9" stroke-linejoin="round"/>\n'
            f'  {fill} fill="{liquid}"/>\n'
            f'  <path d="M12 21 q2 -1.4 4 0" fill="none" stroke="#fff" stroke-width=".8" opacity=".6"/>\n'
            '  <rect x="13.4" y="3.6" width="5.2" height="3.6" rx="1" fill="#a8763e" stroke="#6a4a2a" stroke-width=".7"/>\n'
            '  <path d="M13 9.6 L19 9.6" stroke="#7a6446" stroke-width="1.2"/>\n')


ICONS = {
    'shard-tonic': ('Shard Tonic: mana shards boiled with goldwood bark.', bottle('#5ab8f0', '#8fe3ff', 'round')),
    'starlight-tincture': ('Starlight Tincture: gathering XP lifted.', bottle('#b8a4ff', '#c8b8ff', 'tall')),
    'ather-infusion': ('Ather Infusion: an Ather crystal steeped in old sap; mana flows back faster.', bottle('#3a8fdc', '#4aa3e6', 'flask')),
    # M57 THE ALCHEMY SET's bottles (ather/alchemy-set.ts ALC_POTIONS; inventory.ts alcDef -> /open/icons/potion-<id>.svg), one per
    # potion, every grade sharing it (the grade is in the name). Tinted per effect: health warm red-gold, mana blue, starlight violet.
    'potion-health': ('Health Draught: golden dew and rinnscale dust; it heals.', bottle('#e0574a', '#ffb070', 'round')),
    'potion-mana': ('Mana Draught: shard dust steeped with dewdrop gel; mana back.', bottle('#4a7fe0', '#8fb8ff', 'flask')),
    'potion-wisdom': ('Starlight Tincture: gathering XP lifted.', bottle('#b8a4ff', '#c8b8ff', 'tall')),
}

if __name__ == '__main__':
    for name, (note, body) in ICONS.items():
        (OUT / f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  <!-- {note} Code-drawn filler. -->\n  {SHADOW}\n{body}</svg>\n')
    print(f'wrote {len(ICONS)} icons to {OUT}')
