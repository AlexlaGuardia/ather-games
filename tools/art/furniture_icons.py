#!/usr/bin/env python3
"""Furniture + decor icons for the open world's bag (ather/furniture.ts). Code-drawn filler, 32x32, the wood's colour.
   python3 tools/art/furniture_icons.py  -> public/open/icons/<id with dashes>.svg"""
import os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'open', 'icons')
WOOD = {'goldwood': ('#f0c773', '#d9a957', '#8a5f24'), 'shimmeroak': ('#c99a6c', '#a77a52', '#5e3f24'),
        'starwillow': ('#e6ecf8', '#c8d2e8', '#6f7a96'), 'dawnwood': ('#e39a6a', '#c9774a', '#6e3a1e'),
        'iron': ('#77716b', '#4e4a47', '#26231f'), 'stone': ('#dcd6c8', '#bdb6a6', '#7c7566')}

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
    # M242 s1: Planter Box styles
    'planter_box_banded': ('shimmeroak', 'A planter box held by dark bands.', lambda h, m, d:
        r(5, 15, 22, 11, m, d, 1) + r(4.4, 13.6, 23.2, 2.6, h, d, 0.8) + r(4.6, 17, 22.8, 1.8, '#3b3633', '#26231f', 0.3) + r(4.6, 22.6, 22.8, 1.8, '#3b3633', '#26231f', 0.3)
        + '<path d="M11 13.6 Q10 8 13 6 M16 13.6 Q16 7 18 5 M21 13.6 Q22 9 24 8" fill="none" stroke="#5f9a4a" stroke-width="1.4" stroke-linecap="round"/>'),
    'planter_box_carved': ('dawnwood', 'A carved planter box with capped posts.', lambda h, m, d:
        r(6, 15, 20, 11, m, d, 0.6) + r(4.4, 13, 3, 13.4, d, d, 0.4) + r(24.6, 13, 3, 13.4, d, d, 0.4) + r(4, 12.2, 3.8, 1.4, h, d, 0.4) + r(24.2, 12.2, 3.8, 1.4, h, d, 0.4) + r(10, 17.6, 12, 5, '#a85e36', d, 0.8)
        + '<path d="M11 13.6 Q10 8 13 6 M16 13.6 Q16 7 18 5 M21 13.6 Q22 9 24 8" fill="none" stroke="#5f9a4a" stroke-width="1.4" stroke-linecap="round"/>'),
    'planter_tub_round': ('stone', 'A round stone planter tub.', lambda h, m, d:
        '<path d="M7 15 L25 15 L23 26 Q16 28 9 26 Z" fill="' + m + '" stroke="' + d + '" stroke-width=".8"/>' + '<ellipse cx="16" cy="15" rx="9.5" ry="2.4" fill="#5a3d25" stroke="' + d + '" stroke-width=".8"/>'
        + '<path d="M12 14.6 Q11 9 14 7 M16 14.6 Q16 8 18 6 M20 14.6 Q21 10 23 9" fill="none" stroke="#5f9a4a" stroke-width="1.4" stroke-linecap="round"/>'),
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
    # Nyx-side unique pieces (sold at the Smithy / the Grand Exchange)
    'iron_lantern': ('iron', 'An iron lantern on a post.', lambda h, m, d:
        r(15, 9, 2, 17, m, d, 0.4) + r(10, 26, 12, 2, m, d, 0.6) + r(11.5, 4, 9, 1.6, h, d, 0.4)
        + '<rect x="12.5" y="5.6" width="7" height="6.4" fill="#ffcf7a" stroke="#26231f" stroke-width=".8"/>' + r(11.5, 11.6, 9, 1.4, h, d, 0.4)),
    'iron_brazier': ('iron', 'A hammered-iron brazier.', lambda h, m, d:
        '<path d="M10 27 L13 18 M22 27 L19 18 M16 27 L16 18" stroke="' + d + '" stroke-width="2"/>'
        '<path d="M6 13 L26 13 L22 19 L10 19 Z" fill="' + m + '" stroke="' + d + '" stroke-width=".8"/>'
        '<path d="M10 13 Q12 5 16 3 Q15 8 19 7 Q22 10 22 13 Z" fill="#ff9a4a" stroke="#c4561f" stroke-width=".7"/>'),
    'weathervane': ('iron', 'A weathervane.', lambda h, m, d:
        r(15.2, 8, 1.6, 19, m, d, 0.3) + '<path d="M5 7 L25 7 L25 5 L29 7.6 L25 10 L25 8.4 L5 8.4 Z" fill="' + h + '" stroke="' + d + '" stroke-width=".7"/>'
        + '<path d="M5 4.4 L9 7.6 L5 11 Z" fill="' + m + '" stroke="' + d + '" stroke-width=".6"/>' + r(11, 26, 10, 2, m, d, 0.6)),
    'spinestone_birdbath': ('stone', 'A Spinestone birdbath.', lambda h, m, d:
        r(10, 25, 12, 2.6, m, d, 0.6) + r(13.6, 15, 4.8, 10.4, h, d, 0.8)
        + '<path d="M4 11 L28 11 L23 16 L9 16 Z" fill="' + h + '" stroke="' + d + '" stroke-width=".8"/>'
        + '<ellipse cx="16" cy="11.2" rx="11" ry="1.6" fill="#9fd0e8" stroke="' + d + '" stroke-width=".6"/>'),
    'ruin_column': ('stone', 'A salvaged ruin column.', lambda h, m, d:
        r(8, 24.5, 16, 3, m, d, 0.4) + r(10.5, 7, 11, 17.6, h, d, 0.4)
        + ''.join(f'<path d="M{x} 7.4 L{x} 24.4" stroke="{d}" stroke-width=".6" opacity=".6"/>' for x in (13.2, 16, 18.8))
        + '<path d="M8 3.6 L24 3.6 L24 7 L8 7 Z M18 3.6 L21 1.8 L24 3.6" fill="' + m + '" stroke="' + d + '" stroke-width=".8"/>'),
    'mana_cell_lamp': ('iron', 'A mana-cell lamp in a brass cage.', lambda h, m, d:
        r(10, 26, 12, 2, '#a4793e', '#5e4219', 0.6) + r(15.2, 14, 1.6, 12, '#a4793e', '#5e4219', 0.3)
        + '<rect x="12" y="4" width="8" height="10" rx="1.6" fill="#8fe3ff" stroke="#2f7fa0" stroke-width=".8"/>'
        + ''.join(f'<path d="M{x} 3.4 L{x} 14.6" stroke="#a4793e" stroke-width="1"/>' for x in (12.6, 16, 19.4))
        + r(11, 2.4, 10, 1.6, '#c99a52', '#5e4219', 0.4)),
    'water_tap': ('iron', 'A water tap: an iron housing with lit sigils and a spout.', lambda h, m, d:
        r(9, 8, 14, 18, m, d, 1.6) + r(8, 25, 16, 2.4, h, d, 0.6) + r(8.4, 6, 15.2, 2.6, h, d, 0.8)
        + ''.join(f'<circle cx="{x}" cy="13" r="1.6" fill="#8fe3ff" stroke="#2f7fa0" stroke-width=".5"/>' for x in (12.5, 16, 19.5))
        + r(22, 17, 5, 2.4, h, d, 0.6) + r(25, 17, 2.2, 4.6, h, d, 0.5)
        + '<path d="M26.1 22.4 Q25.6 24 26.1 25 Q26.6 24 26.1 22.4 Z" fill="#7fc4ea"/>'),
    'water_tank': ('iron', 'A riveted iron water tank.', lambda h, m, d:
        r(6, 7, 20, 19, m, d, 2.4) + r(5.4, 6, 21.2, 3, h, d, 1) + r(5.4, 16, 21.2, 1.8, h, d, 0.4)
        + r(13, 9.6, 6, 5.4, '#7fc4ea', '#2f7fa0', 0.8)
        + ''.join(f'<circle cx="{x}" cy="{y}" r=".7" fill="{h}"/>' for x in (8, 24) for y in (10.5, 20.5, 24))),
    # M57 the alchemy set (ruled 11-21: Crusher Table / Still / Cauldron Nook / Alchemy Desk); item ids are the pre-ruling ones
    'alc_mortar': ('goldwood', 'The Crusher Table: a stone bowl on a table, a lit crusher over it.', lambda h, m, d:
        r(4, 14, 24, 3, h, d, 1) + r(5.5, 17, 2.4, 10, m, d) + r(24.1, 17, 2.4, 10, m, d)
        + '<path d="M10 14 Q10 8 16 8 Q22 8 22 14 Z" fill="#bdb6a6" stroke="#7c7566" stroke-width=".8"/>'
        + '<path d="M17 9 L21 3" stroke="#77716b" stroke-width="2.4" stroke-linecap="round"/>'
        + '<circle cx="20.4" cy="4" r="1.5" fill="#8fe3ff" stroke="#2f7fa0" stroke-width=".5"/>'),
    'alc_still': ('iron', 'The Still: a glass flask over a lit burner, a copper coil beside it.', lambda h, m, d:
        r(7, 18, 18, 9, m, d, 1.2) + r(10, 22, 7, 1.8, '#8fe3ff', '#2f7fa0', 0.5)
        + '<circle cx="13" cy="12" r="5" fill="#cfe8f5" fill-opacity=".75" stroke="#6f8fa0" stroke-width=".8"/>'
        + r(12, 4, 2, 4, '#cfe8f5', '#6f8fa0', 0.4)
        + ''.join(f'<ellipse cx="21" cy="{y}" rx="3.4" ry="1.4" fill="none" stroke="#c08a4a" stroke-width="1.2"/>' for y in (8, 11, 14))
        + '<path d="M14 5 L21 6.6" stroke="#c08a4a" stroke-width="1.2"/>'),
    'alc_mixer': ('goldwood', 'The Cauldron Nook: a cauldron set into a long table, its brew glowing.', lambda h, m, d:
        r(3, 15, 26, 3, h, d, 1) + r(4.5, 18, 2.4, 9, m, d) + r(25.1, 18, 2.4, 9, m, d)
        + '<path d="M13 15 L13 21 Q13 25 19 25 Q25 25 25 21 L25 15 Z" fill="#4e4a47" stroke="#26231f" stroke-width=".8"/>'
        + '<ellipse cx="19" cy="14.6" rx="6.4" ry="2" fill="#ff9a4a" stroke="#26231f" stroke-width=".6"/>'
        + r(5, 12, 2.4, 3, '#6f9a4a', '#3f5f2a', 0.4) + r(8.5, 12, 2.4, 3, '#6f9a4a', '#3f5f2a', 0.4)),
    'alc_desk': ('shimmeroak', 'The Alchemy Desk: a desk with a rack of lit vials and a reading lens.', lambda h, m, d:
        r(3, 16, 26, 2.8, h, d, 0.8) + r(4.5, 18.8, 2.4, 8.2, m, d) + r(25.1, 18.8, 2.4, 8.2, m, d)
        + r(4, 6, 24, 1.8, m, d, 0.4)
        + ''.join(f'<rect x="{x}" y="7.8" width="2.4" height="5" rx="1" fill="{c}" stroke="#3a2a40" stroke-width=".5"/>' for x, c in ((6, '#c9a8ff'), (10, '#8fe3ff'), (14, '#ff9a4a'), (18, '#9ae06a')))
        + '<circle cx="23" cy="12" r="2.6" fill="#c9a8ff" fill-opacity=".45" stroke="#a4793e" stroke-width=".9"/>'
        + '<path d="M23 14.6 L23 16" stroke="#a4793e" stroke-width=".9"/>'),
    # M98b (BETA, world aa0cbd5d 11-23): free-build floor slabs, set like furniture (snap / turn / anchor)
    'goldwood_slab': ('goldwood', 'A goldwood floor slab.', lambda h, m, d:
        '<path d="M8 14 L24 14 L28 20 L4 20 Z" fill="' + h + '" stroke="' + d + '" stroke-width=".8"/>' + r(4, 20, 24, 3, m, d, 0.4)
        + '<path d="M13 14 L11 20 M19 14 L21 20" stroke="' + d + '" stroke-width=".6"/>'),
    'goldwood_slab_wide': ('goldwood', 'A wide goldwood floor slab.', lambda h, m, d:
        '<path d="M7 10 L25 10 L30 20 L2 20 Z" fill="' + h + '" stroke="' + d + '" stroke-width=".8"/>' + r(2, 20, 28, 3, m, d, 0.4)
        + '<path d="M11.5 10 L8.5 20 M16 10 L16 20 M20.5 10 L23.5 20 M4.5 15 L27.5 15" stroke="' + d + '" stroke-width=".6"/>'),
    'stone_slab': ('stone', 'A stone floor slab.', lambda h, m, d:
        '<path d="M8 14 L24 14 L28 20 L4 20 Z" fill="' + h + '" stroke="' + d + '" stroke-width=".8"/>' + r(4, 20, 24, 3, m, d, 0.4)
        + '<path d="M16 14 L16 20 M6 17 L26 17" stroke="' + d + '" stroke-width=".6"/>'),
    'stone_slab_wide': ('stone', 'A wide stone floor slab.', lambda h, m, d:
        '<path d="M7 10 L25 10 L30 20 L2 20 Z" fill="' + h + '" stroke="' + d + '" stroke-width=".8"/>' + r(2, 20, 28, 3, m, d, 0.4)
        + '<path d="M11.5 10 L8.5 20 M16 10 L16 20 M20.5 10 L23.5 20 M4.5 15 L27.5 15" stroke="' + d + '" stroke-width=".6"/>'),
    # M98b b2: free-build wall panels
    'goldwood_panel': ('goldwood', 'A goldwood wall panel.', lambda h, m, d:
        r(10, 4, 12, 22, m, d, 0.4) + r(9.4, 24, 13.2, 2.4, d, d, 0.3) + r(9.4, 3.4, 13.2, 1.6, d, d, 0.3)
        + '<path d="M14 5 L14 24 M18 5 L18 24" stroke="' + d + '" stroke-width=".6"/>'),
    'goldwood_panel_wide': ('goldwood', 'A wide goldwood wall panel.', lambda h, m, d:
        r(4, 6, 24, 20, m, d, 0.4) + r(3.4, 24, 25.2, 2.4, d, d, 0.3) + r(3.4, 5.4, 25.2, 1.6, d, d, 0.3)
        + '<path d="M8 7 L8 24 M12 7 L12 24 M16 7 L16 24 M20 7 L20 24 M24 7 L24 24" stroke="' + d + '" stroke-width=".6"/>'),
    'brick_panel': ('stone', 'A brick wall panel.', lambda h, m, d:
        r(10, 4, 12, 22, '#a4573f', '#5e2f22', 0.4) + r(9.4, 24, 13.2, 2.4, '#7a3f2e', '#5e2f22', 0.3)
        + ''.join(f'<path d="M10 {y} L22 {y}" stroke="#5e2f22" stroke-width=".5"/>' for y in (8, 12, 16, 20))),
    'brick_panel_wide': ('stone', 'A wide brick wall panel.', lambda h, m, d:
        r(4, 6, 24, 20, '#a4573f', '#5e2f22', 0.4) + r(3.4, 24, 25.2, 2.4, '#7a3f2e', '#5e2f22', 0.3)
        + ''.join(f'<path d="M4 {y} L28 {y}" stroke="#5e2f22" stroke-width=".5"/>' for y in (10, 14, 18, 22))),
}
# M209 (11-26): the M169 Build pieces shipped as bag items naming icons that were never drawn (the bag drew a
# broken image). Code-drawn filler by shape family, same 32x32 frame; the wood is the piece's main material.
def P(d, fill, stroke, w=.8):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{w}"/>'
def L(d, stroke, w=.6):
    return f'<path d="{d}" stroke="{stroke}" stroke-width="{w}" fill="none"/>'
CLAY, CLAY_D, TURF, TURF_D = '#b8603f', '#6e3322', '#7fae5a', '#3f6428'
def floor_up(h, m, d, wide=False):
    x0, x1 = (2, 30) if wide else (5, 27)
    return (r(x0 + 3, 6, x1 - x0 - 6, 3, m, d, 0.3) + r(x0, 9, x1 - x0, 3, h, d, 0.3)
            + r(x0 + 1, 12, 2.4, 14, m, d) + r(x1 - 3.4, 12, 2.4, 14, m, d))
def stair(h, m, d, left=False, right=False):
    s = ''.join(r(6 + 4 * i, 22 - 4 * i, 20 - 4 * i, 4, h if i % 2 else m, d, 0.3) for i in range(4))
    if left: s += L('M6 16 L22 4', d, 1.2) + L('M7 22 L7 16 M15 18 L15 10', d, .8)
    if right: s += L('M10 18 L26 6', d, 1.2) + L('M25 7 L25 22', d, .8)
    return s
def railing(h, m, d, wide=False):
    x0, x1 = (2, 30) if wide else (7, 25)
    posts = range(x0, x1 + 1, 7 if wide else 6)
    return r(x0 - 1, 10, x1 - x0 + 2, 2.4, h, d, 0.4) + ''.join(r(x - 1, 12, 2, 14, m, d, 0.3) for x in posts)
def roof_body(shape, kind):
    c, k = (CLAY, CLAY_D) if kind == 'tile' else (TURF, TURF_D)
    def body(h, m, d):
        if shape == 'gable': s = P('M2 22 L16 6 L30 22 Z', c, k) + r(6, 22, 20, 4, m, d, 0.3)
        elif shape == 'slope': s = P('M3 12 L29 20 L29 24 L3 16 Z', c, k) + r(5, 16, 2.4, 10, m, d) + r(25, 22, 2.4, 4, m, d)
        else: s = P('M4 12 L28 12 L30 16 L2 16 Z', c, k) + r(3, 16, 26, 2.6, m, d, 0.3) + r(5, 18.6, 2.4, 7.4, m, d) + r(24.6, 18.6, 2.4, 7.4, m, d)
        lines = ''.join(L(f'M{x} {9 if shape == "gable" else 12} L{x} 22', k, .5) for x in (10, 16, 22)) if kind == 'tile' else ''
        return s + lines
    return body
BUILD = {
    'upper_floor': ('goldwood', 'An upper floor on posts.', lambda h, m, d: floor_up(h, m, d)),
    'upper_floor_wide': ('goldwood', 'A wide upper floor on posts.', lambda h, m, d: floor_up(h, m, d, True)),
    'door': ('goldwood', 'A plank door.', lambda h, m, d: r(9, 3, 14, 23, m, d, 0.8) + L('M13 4 L13 25 M17 4 L17 25', d) + '<circle cx="20" cy="15" r="1.1" fill="#4e4a47"/>'),
    'window': ('goldwood', 'A square window.', lambda h, m, d: r(7, 6, 18, 18, m, d, 0.5) + r(9.5, 8.5, 13, 13, '#bfe2f2', d, 0.3) + L('M16 8.5 L16 21.5 M9.5 15 L22.5 15', d, .9)),
    'round_window': ('goldwood', 'A round window.', lambda h, m, d: '<circle cx="16" cy="15" r="10" fill="' + m + '" stroke="' + d + '" stroke-width=".8"/><circle cx="16" cy="15" r="7" fill="#bfe2f2" stroke="' + d + '" stroke-width=".6"/>' + L('M16 8 L16 22 M9 15 L23 15', d, .9)),
    'shutters': ('goldwood', 'A pair of shutters.', lambda h, m, d: r(5, 5, 10, 20, h, d, 0.4) + r(17, 5, 10, 20, h, d, 0.4) + L('M6 10 L14 10 M6 15 L14 15 M6 20 L14 20 M18 10 L26 10 M18 15 L26 15 M18 20 L26 20', d)),
    'arch': ('stone', 'A stone arch.', lambda h, m, d: P('M4 26 L4 12 A12 10 0 0 1 28 12 L28 26 L22 26 L22 14 A6 5 0 0 0 10 14 L10 26 Z', h, d)),
    'doorway': ('goldwood', 'A doorway in a wall.', lambda h, m, d: P('M4 4 L28 4 L28 26 L21 26 L21 10 L11 10 L11 26 L4 26 Z', m, d) + L('M8 6 L8 25 M24 6 L24 25', d)),
    'half_wall': ('goldwood', 'A half-height wall.', lambda h, m, d: r(4, 14, 24, 12, m, d, 0.4) + r(3.4, 12.6, 25.2, 2, d, d, 0.3) + L('M10 15 L10 25 M16 15 L16 25 M22 15 L22 25', d)),
    'wall_end': ('goldwood', 'A wall end post.', lambda h, m, d: r(6, 6, 14, 20, m, d, 0.4) + r(20, 4, 5, 22, h, d, 0.4)),
    'wall_corner': ('goldwood', 'A wall corner.', lambda h, m, d: P('M4 8 L16 12 L16 26 L4 22 Z', m, d) + P('M16 12 L28 8 L28 22 L16 26 Z', h, d)),
    'column': ('goldwood', 'A wooden column.', lambda h, m, d: r(11, 3, 10, 2.6, d, d, 0.3) + r(12.5, 5.6, 7, 18, h, d, 0.4) + r(11, 23.6, 10, 2.6, d, d, 0.3)),
    'stone_column': ('stone', 'A stone column.', lambda h, m, d: r(10, 3, 12, 3, m, d, 0.3) + r(12, 6, 8, 17, h, d, 0.4) + L('M14.5 7 L14.5 22 M17.5 7 L17.5 22', d, .5) + r(10, 23, 12, 3, m, d, 0.3)),
    'stair': ('goldwood', 'A flight of stairs.', lambda h, m, d: stair(h, m, d)),
    'stair_rail_left': ('goldwood', 'Stairs, railed on the left.', lambda h, m, d: stair(h, m, d, left=True)),
    'stair_rail_right': ('goldwood', 'Stairs, railed on the right.', lambda h, m, d: stair(h, m, d, right=True)),
    'stair_railed': ('goldwood', 'Stairs, railed on both sides.', lambda h, m, d: stair(h, m, d, True, True)),
    'railing': ('goldwood', 'A railing.', lambda h, m, d: railing(h, m, d)),
    'railing_wide': ('goldwood', 'A wide railing.', lambda h, m, d: railing(h, m, d, True)),
    'fence': ('goldwood', 'A fence.', lambda h, m, d: r(3, 11, 26, 2, m, d, 0.3) + r(3, 18, 26, 2, m, d, 0.3) + ''.join(P(f'M{x} 26 L{x} 9 L{x + 1.5} 7 L{x + 3} 9 L{x + 3} 26 Z', h, d) for x in (5, 14.5, 24))),
    'fence_gate': ('goldwood', 'A fence gate.', lambda h, m, d: r(4, 6, 3, 20, m, d, 0.4) + r(25, 6, 3, 20, m, d, 0.4) + r(8, 9, 16, 15, h, d, 0.4) + L('M8 9 L24 24 M12 9 L12 24 M16 9 L16 24 M20 9 L20 24', d)),
    'ramp': ('goldwood', 'A ramp.', lambda h, m, d: P('M3 26 L29 10 L29 26 Z', h, d) + L('M9 22.3 L9 26 M15 18.6 L15 26 M21 14.9 L21 26', d)),
    'ladder': ('goldwood', 'A ladder.', lambda h, m, d: r(9, 3, 2.4, 23, m, d) + r(20.6, 3, 2.4, 23, m, d) + ''.join(r(11, y, 9.6, 1.8, h, d, 0.3) for y in (6, 11, 16, 21))),
    'ceiling': ('goldwood', 'A ceiling.', lambda h, m, d: P('M6 6 L26 6 L30 12 L2 12 Z', h, d) + r(2, 12, 28, 2.4, m, d, 0.3) + L('M11 6 L9 12 M16 6 L16 12 M21 6 L23 12', d)),
    'beam': ('goldwood', 'A beam.', lambda h, m, d: r(2, 12, 28, 5, h, d, 0.4) + L('M3 14.5 L29 14.5', m, .7)),
    'roof_gable_tile': ('goldwood', 'A clay-tile gable roof.', roof_body('gable', 'tile')),
    'roof_gable_turf': ('goldwood', 'A turf gable roof.', roof_body('gable', 'turf')),
    'roof_slope_tile': ('goldwood', 'A sloped clay-tile roof.', roof_body('slope', 'tile')),
    'roof_slope_turf': ('goldwood', 'A sloped turf roof.', roof_body('slope', 'turf')),
    'roof_flat_tile': ('goldwood', 'A flat clay-tile roof.', roof_body('flat', 'tile')),
    'roof_flat_turf': ('goldwood', 'A flat turf roof.', roof_body('flat', 'turf')),
    'gable_end': ('goldwood', 'A gable end.', lambda h, m, d: P('M3 25 L16 7 L29 25 Z', m, d) + L('M10 15.5 L10 25 M16 7 L16 25 M22 15.5 L22 25', d)),
    'foundation_low': ('stone', 'A low stone foundation.', lambda h, m, d: P('M8 16 L24 16 L28 20 L4 20 Z', h, d) + r(4, 20, 24, 5, m, d, 0.3) + L('M10 20 L10 25 M18 20 L18 25 M24 20 L24 25', d, .5)),
    'foundation_high': ('stone', 'A high stone foundation.', lambda h, m, d: P('M8 9 L24 9 L28 13 L4 13 Z', h, d) + r(4, 13, 24, 12, m, d, 0.3) + L('M4 19 L28 19 M10 13 L10 19 M20 13 L20 19 M14 19 L14 25 M24 19 L24 25', d, .5)),
    'found_step': ('stone', 'A stone step.', lambda h, m, d: P('M9 17 L23 17 L26 20 L6 20 Z', h, d) + r(6, 20, 20, 5, m, d, 0.3)),
    'found_steps': ('stone', 'Stone steps.', lambda h, m, d: r(5, 20, 22, 5, m, d, 0.3) + r(9, 15, 18, 5, h, d, 0.3) + r(13, 10, 14, 5, m, d, 0.3)),
    'deck': ('goldwood', 'A deck.', lambda h, m, d: P('M7 12 L25 12 L30 18 L2 18 Z', h, d) + r(2, 18, 28, 2.6, m, d, 0.3) + r(4, 20.6, 2.4, 5.4, m, d) + r(25.6, 20.6, 2.4, 5.4, m, d) + L('M11 12 L8 18 M16 12 L16 18 M21 12 L24 18', d)),
    'porch': ('goldwood', 'A porch.', lambda h, m, d: P('M4 6 L28 6 L30 9 L2 9 Z', m, d) + r(4, 9, 2.4, 13, m, d) + r(25.6, 9, 2.4, 13, m, d) + r(2, 22, 28, 4, h, d, 0.3)),
    'balcony': ('goldwood', 'A balcony.', lambda h, m, d: r(3, 17, 26, 3, h, d, 0.3) + r(3, 8, 26, 2, m, d, 0.3) + ''.join(r(x, 10, 1.6, 7, m, d, 0.2) for x in (5, 10, 15, 20, 25)) + P('M6 20 L10 26 L12 26 L9 20 Z', m, d) + P('M26 20 L22 26 L20 26 L23 20 Z', m, d)),
    'chimney': ('stone', 'A brick chimney.', lambda h, m, d: r(10, 7, 12, 19, '#a4573f', '#5e2f22', 0.4) + r(9, 5, 14, 3, '#7a3f2e', '#5e2f22', 0.3) + ''.join(L(f'M10 {y} L22 {y}', '#5e2f22', .5) for y in (11, 15, 19, 23))),
}
PIECES.update(BUILD)
for pid, (wood, note, body) in PIECES.items():
    with open(os.path.join(OUT, pid.replace('_', '-') + '.svg'), 'w') as f:
        f.write(icon(body, wood, note))
print(f'wrote {len(PIECES)} icons')
