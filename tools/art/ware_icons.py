#!/usr/bin/env python3
"""Ware icons for the tycoon ledger (open/economy/tycoon.ts › wares): public/open/icons/ware-{ore,fittings,produce,meals}.svg

Run: python3 tools/art/ware_icons.py

Wares are the goods moving through a business's gate (Alex 11-15: Moglins drop off / collect through it), internal to
the business network and not bag items. Mortal-side goods (the waking continent), so the gardener's no-metal rule for
the BAG does not bind them: fittings are smithed metal. Same idiom as the forestry set (tools/art/forestry_icons.py):
32x32, a ground shadow, dark outline, a gathered quantity. Code-drawn filler; Alex judges the look.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/open/icons'
SHADOW = '<ellipse cx="16" cy="27.5" rx="10" ry="2.2" fill="#000" opacity=".25"/>'


def svg(note: str, body: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  <!-- {note} Code-drawn filler. -->\n  {SHADOW}\n  {body}\n</svg>\n'


ORE = (
    # three rough chunks of dug rock, dull (dead stone: no light), flecked with the metal in them
    '<path d="M4.6 24 L6 17.4 L10.6 15 L15.4 17 L16 24.6 Z" fill="#7a6f64" stroke="#3e3730" stroke-width=".9" stroke-linejoin="round"/>'
    '<path d="M6 17.4 L10.6 15 L15.4 17 L10.4 19 Z" fill="#958a7e"/>'
    '<path d="M14.6 25 L15.6 16.6 L21.6 13.6 L27.4 16.8 L27 24.6 Z" fill="#6c6259" stroke="#3e3730" stroke-width=".9" stroke-linejoin="round"/>'
    '<path d="M15.6 16.6 L21.6 13.6 L27.4 16.8 L21 18.8 Z" fill="#8a7f73"/>'
    '<path d="M9.4 15.6 L11.6 8.4 L17.4 7.2 L20.6 12.4 L16.8 16.6 Z" fill="#82776b" stroke="#3e3730" stroke-width=".9" stroke-linejoin="round"/>'
    '<path d="M11.6 8.4 L17.4 7.2 L20.6 12.4 L15 11.6 Z" fill="#a0958a"/>'
    '<g fill="#d8a85c"><circle cx="9" cy="21" r=".9"/><circle cx="12.4" cy="22.4" r=".6"/><circle cx="20.4" cy="21.2" r="1"/><circle cx="23.6" cy="19.6" r=".6"/><circle cx="14.6" cy="13" r=".8"/><circle cx="17.4" cy="10.2" r=".5"/></g>'
)

FITTINGS = (
    # smithed pieces for a gunsmith's bench: a barrel band, two brackets, a hinge, bound with cord
    '<ellipse cx="11" cy="18.4" rx="6" ry="6" fill="none" stroke="#3b3631" stroke-width="3.6"/>'
    '<ellipse cx="11" cy="18.4" rx="6" ry="6" fill="none" stroke="#8d8a84" stroke-width="2.2"/>'
    '<path d="M7.4 14.6 A5 5 0 0 1 14 13.6" fill="none" stroke="#c9c6be" stroke-width=".8"/>'
    '<path d="M17 25 L17 15 L25.6 15" fill="none" stroke="#3b3631" stroke-width="3.6" stroke-linejoin="round"/>'
    '<path d="M17 25 L17 15 L25.6 15" fill="none" stroke="#9a968e" stroke-width="2.2" stroke-linejoin="round"/>'
    '<circle cx="17" cy="21" r=".7" fill="#3b3631"/><circle cx="22" cy="15" r=".7" fill="#3b3631"/>'
    '<path d="M19.6 7.4 L27 7.4 L27 11 L19.6 11 Z" fill="#7e7a73" stroke="#3b3631" stroke-width=".9"/>'
    '<path d="M23.3 7 L23.3 11.4" stroke="#3b3631" stroke-width="1.2"/><circle cx="21.4" cy="9.2" r=".6" fill="#3b3631"/><circle cx="25.2" cy="9.2" r=".6" fill="#3b3631"/>'
    '<path d="M12 23.6 Q18 27 24 22.6" fill="none" stroke="#7a6446" stroke-width="1.1"/>'
)

PRODUCE = (
    # a slatted crate of the farm's take: roots, a cabbage head, greens over the rim
    '<path d="M5 15 L27 15 L25.6 26 L6.4 26 Z" fill="#a07c4c" stroke="#5a3d26" stroke-width=".9" stroke-linejoin="round"/>'
    '<path d="M5.6 19 L26.4 19 M6 22.6 L26 22.6" stroke="#5a3d26" stroke-width=".8"/>'
    '<circle cx="11.6" cy="13.6" r="4.4" fill="#8fb35a" stroke="#4f6e2c" stroke-width=".9"/>'
    '<path d="M9 12.4 q2.6 -2 5.2 0 M9.6 15 q2 1.2 4 0" fill="none" stroke="#c3dc8c" stroke-width=".7"/>'
    '<path d="M16.4 15.4 L19 8 L21.4 15.4 Z" fill="#d9813a" stroke="#8a4a1c" stroke-width=".8" stroke-linejoin="round"/>'
    '<path d="M19 8 l-1.4 -3 M19 8 l.4 -3.4 M19 8 l1.8 -2.6" stroke="#6f9b4f" stroke-width="1" stroke-linecap="round"/>'
    '<ellipse cx="23.6" cy="13.8" rx="3" ry="2.4" fill="#c8a85a" stroke="#7a5f2a" stroke-width=".8"/>'
    '<path d="M23.6 11.4 l.6 -2" stroke="#6f9b4f" stroke-width="1" stroke-linecap="round"/>'
)

MEALS = (
    # a covered stew pot, still hot: the kitchen's take, bound for a café counter
    '<path d="M6.6 16 Q6.6 25.6 16 25.6 Q25.4 25.6 25.4 16 Z" fill="#5c4a3c" stroke="#2e241c" stroke-width=".9"/>'
    '<path d="M8 19.6 Q16 21.8 24 19.6" fill="none" stroke="#7a6452" stroke-width=".8"/>'
    '<path d="M4.6 16 L27.4 16" stroke="#2e241c" stroke-width="1.8" stroke-linecap="round"/>'
    '<path d="M7.4 15.4 Q16 9.4 24.6 15.4 Z" fill="#7a6452" stroke="#2e241c" stroke-width=".9"/>'
    '<circle cx="16" cy="11.4" r="1.2" fill="#a88a6c" stroke="#2e241c" stroke-width=".7"/>'
    '<path d="M3.6 17.6 q-1.4 1.6 .6 2.6 M28.4 17.6 q1.4 1.6 -.6 2.6" fill="none" stroke="#2e241c" stroke-width="1"/>'
    '<g fill="none" stroke="#e8e2d6" stroke-width="1" stroke-linecap="round" opacity=".75">'
    '<path d="M12 8.6 q-1.4 -1.8 0 -3.6 q1.4 -1.6 0 -3"/><path d="M16 7.6 q1.4 -1.8 0 -3.6"/><path d="M20 8.6 q-1.4 -1.8 0 -3.6 q1.4 -1.6 0 -3"/></g>'
)


def main():
    icons = {
        'ware-ore': svg('Ore: three chunks of dug rock flecked with metal (dead stone: no light).', ORE),
        'ware-fittings': svg('Fittings: smithed pieces (a barrel band, a bracket, a hinge), cord-bound.', FITTINGS),
        'ware-produce': svg("Produce: a slatted crate of the farm's take.", PRODUCE),
        'ware-meals': svg('Meals: a covered stew pot, still hot.', MEALS),
    }
    for k, s in icons.items():
        (OUT / f'{k}.svg').write_text(s)
    print(f'wrote {len(icons)} ware icons to {OUT}')


if __name__ == '__main__':
    main()
