#!/usr/bin/env python3
"""Forestry bag icons: 16 code-drawn SVGs (32x32) in public/open/icons/, in the waymark.svg idiom.

Run: python3 tools/art/forestry_icons.py   (rewrites the 16 files)

Canon: design-briefs/shimmer-resources.md (ruled 07-23) — a harvested PORTION, a gathered QUANTITY (a tied bundle,
two or three together), cord-tied, never metal; and the LIGHT LAW: worked goods (planks, bark) are dull, raw-but-cut
(logs, a fresh branch) is faint at the edges only, fluid saps glow, crystal is lit from within, a living thing (the
sapling) has soft light. Look per item follows the brief's Presentation column and its concept renders
(refs/res-*.png); logs and saplings postdate the brief and follow the same law. Colours match the Wilds trees
(ather/wilds-scene.tsx TREE) and the log drops (ather/forestry-fx.tsx).
Code-drawn filler: Alex judges the look (feedback: game art must not block on Alex).
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/open/icons'
CORD = '#7a6446'
SHADOW = '<ellipse cx="16" cy="27.5" rx="10" ry="2.2" fill="#000" opacity=".25"/>'

# per wood: worked face, its dark edge, grain line, cut end (rings), crown, living glow
W = {
    'goldwood':   dict(face='#e2b665', dark='#9a6a2c', grain='#c8964a', end='#f0cf8a', ring='#b8853e', bark='#8a6a45', crown='#c9c25e', crown2='#a9a347'),
    'shimmeroak': dict(face='#8f5d38', dark='#4e301b', grain='#b8865a', end='#b88a5e', ring='#6a4426', bark='#5f4430', crown='#6f9b4f', crown2='#557d3b'),
    'starwillow': dict(face='#d9c48c', dark='#7c6a4e', grain='#bfa66c', end='#f4ecc4', ring='#a8a07a', bark='#a8a08a', crown='#e7d78e', crown2='#cbb86c'),
    'dawnwood':   dict(face='#c98a3a', dark='#6e4320', grain='#a86c2a', end='#e0a95c', ring='#8a5524', bark='#6e4a2c', crown='#d79b45', crown2='#b47a30'),
}


def svg(note: str, body: str, defs: str = '') -> str:
    d = f'<defs>{defs}</defs>' if defs else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  <!-- {note} Code-drawn filler. -->\n  {d}{SHADOW}\n{body}</svg>\n'


def board(x, y, w, h, c, ripple=False, rings=False):
    """one board in a 2:1 oblique: top face, front edge; ripple = shimmeroak moire, rings = dawnwood growth rings"""
    top = f'<path d="M{x} {y+3} L{x+4} {y} L{x+w+4} {y} L{x+w} {y+3} Z" fill="{c["face"]}" stroke="{c["dark"]}" stroke-width=".8" stroke-linejoin="round"/>'
    front = f'<path d="M{x} {y+3} L{x+w} {y+3} L{x+w} {y+3+h} L{x} {y+3+h} Z" fill="{c["grain"]}" stroke="{c["dark"]}" stroke-width=".8" stroke-linejoin="round"/>'
    side = f'<path d="M{x+w} {y+3} L{x+w+4} {y} L{x+w+4} {y+h} L{x+w} {y+3+h} Z" fill="{c["dark"]}" opacity=".85"/>'
    lines = ''
    if ripple:
        lines = ''.join(f'<path d="M{x+2+i*4} {y+2.6} q1 -1 2 0 t2 0" fill="none" stroke="{c["grain"]}" stroke-width=".6"/>' for i in range(w // 4 - 1))
    elif rings:
        lines = f'<path d="M{x+w+1.2} {y+1.4} l1.6 -1 M{x+w+1.2} {y+3} l2 -1.2" stroke="{c["ring"]}" stroke-width=".5"/>'
    else:
        lines = f'<path d="M{x+3} {y+1.6} L{x+w} {y+1.6}" stroke="{c["grain"]}" stroke-width=".5" opacity=".7"/>'
    return top + front + side + lines


def plank_bundle(c, n=2, ripple=False, rings=False, thick=2.2):
    parts = []
    y0 = 15
    for i in range(n):
        y = y0 - i * (thick + 0.6) + (n - 2) * 2
        parts.append(board(3.5 - i * 0.6, y, 21, thick, c, ripple, rings))
    # the cord: round the bundle twice with a bow on top
    top_y = y0 - (n - 1) * (thick + 0.6) + (n - 2) * 2
    cord = (f'<path d="M11.5 {top_y+3} L11.5 {y0+3+thick} M18.5 {top_y+3} L18.5 {y0+3+thick}" stroke="{CORD}" stroke-width="1.1"/>'
            f'<path d="M14.6 {top_y+1.4} q-2.4 -2.6 -3.4 -.4 q1.4 1.4 3.4 .4 q2.4 -2.6 3.4 -.4 q-1.4 1.4 -3.4 .4" fill="none" stroke="{CORD}" stroke-width=".9"/>')
    return '  ' + ''.join(parts) + cord + '\n'


def logs(c, glow):
    """three short logs, cut ends to the viewer, cord round them; raw but cut: a faint light round the cut faces"""
    out = []
    for (x, y) in [(10, 19), (20, 19), (15, 11.5)]:
        out.append(f'<path d="M{x-11} {y-3.6} L{x} {y-4.2} L{x} {y+4.2} L{x-11} {y+3.6} Z" fill="{c["bark"]}" stroke="{c["dark"]}" stroke-width=".8"/>' if x == 10 else '')
    body = (f'<rect x="3" y="12" width="13" height="12" rx="2" fill="{c["bark"]}" stroke="{c["dark"]}" stroke-width=".8"/>'
            f'<rect x="9" y="5" width="13" height="11" rx="2" fill="{c["bark"]}" stroke="{c["dark"]}" stroke-width=".8"/>'
            f'<rect x="14" y="12" width="13" height="12" rx="2" fill="{c["bark"]}" stroke="{c["dark"]}" stroke-width=".8"/>')
    ends = ''
    for (x, y, r) in [(16, 10.5, 4.6), (10, 18, 5.2), (22, 18, 5.2)]:
        ends += (f'<circle cx="{x}" cy="{y}" r="{r+0.9}" fill="{glow}" opacity=".22"/>'
                 f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c["end"]}" stroke="{c["dark"]}" stroke-width=".8"/>'
                 f'<circle cx="{x}" cy="{y}" r="{r*0.62}" fill="none" stroke="{c["ring"]}" stroke-width=".55"/>'
                 f'<circle cx="{x}" cy="{y}" r="{r*0.3}" fill="none" stroke="{c["ring"]}" stroke-width=".55"/>')
    cord = f'<path d="M3.5 21.5 Q16 25 28.5 21.5" fill="none" stroke="{CORD}" stroke-width="1.1"/>'
    return '  ' + body + ends + cord + '\n'


def sapling(c, kind):
    """one young tree, its root ball wrapped in cloth and tied; still alive: a soft light round the crown"""
    ball = (f'<path d="M10.5 20 Q16 17.6 21.5 20 L20.6 25.4 Q16 27.2 11.4 25.4 Z" fill="#c9b48a" stroke="#7d6a48" stroke-width=".8"/>'
            f'<path d="M11 21.6 Q16 23.4 21 21.6" fill="none" stroke="{CORD}" stroke-width="1"/>'
            f'<path d="M14 20.2 l-.6 -1.4 M18 20.2 l.6 -1.4" stroke="#7d6a48" stroke-width=".6"/>')
    trunk_w = {'goldwood': 1.4, 'shimmeroak': 1.8, 'starwillow': 1.1, 'dawnwood': 2.2}[kind]
    trunk = f'<path d="M16 19.4 L16 10" stroke="{c["bark"]}" stroke-width="{trunk_w}" stroke-linecap="round"/>'
    glow = f'<circle cx="16" cy="9" r="8.6" fill="{c["crown"]}" opacity=".18"/>'
    if kind == 'goldwood':
        crown = (f'<circle cx="16" cy="9" r="6" fill="{c["crown"]}" stroke="{c["crown2"]}" stroke-width=".9"/>'
                 f'<circle cx="13.8" cy="7.4" r="2" fill="#e3dc84" opacity=".7"/>')
    elif kind == 'shimmeroak':
        crown = (f'<path d="M8.6 12 Q8.6 3.4 16 3.2 Q23.4 3.4 23.4 12 Z" fill="{c["crown"]}" stroke="{c["crown2"]}" stroke-width=".9"/>'
                 f'<path d="M11 9 q2 -1.4 4 0 q2 -1.4 4 0" fill="none" stroke="#9cc277" stroke-width=".7"/>')
    elif kind == 'starwillow':
        fronds = ''.join(f'<path d="M16 6.4 Q{16+dx*0.6} 5 {16+dx} {14+abs(dx)*0.1}" fill="none" stroke="{c["crown"]}" stroke-width="1"/>'
                         f'<circle cx="{16+dx}" cy="{14+abs(dx)*0.1}" r=".9" fill="#fff6c2"/>' for dx in (-6, -3.6, -1.4, 1.4, 3.6, 6))
        crown = f'<ellipse cx="16" cy="6.6" rx="4" ry="2.4" fill="{c["crown2"]}"/>' + fronds
    else:  # dawnwood
        crown = (f'<path d="M9 11.4 Q8 4.6 13 4 Q16 1.8 19 4 Q24 4.6 23 11.4 Z" fill="{c["crown"]}" stroke="{c["crown2"]}" stroke-width=".9"/>'
                 f'<path d="M12 8 q1.4 -1 2.8 0 M17 7 q1.4 -1 2.8 0" fill="none" stroke="#efc074" stroke-width=".7"/>')
    return '  ' + glow + trunk + crown + ball + '\n'


def sap_pool(core, edge, hi, bright=False):
    """a slow glossy pool of sap, luminous (fluid, still faintly alive)"""
    g = f'<radialGradient id="g" cx=".45" cy=".42" r=".6"><stop offset="0" stop-color="{hi}"/><stop offset=".55" stop-color="{core}"/><stop offset="1" stop-color="{edge}"/></radialGradient>'
    halo = f'<ellipse cx="16" cy="18" rx="12.4" ry="8.6" fill="{core}" opacity="{".38" if bright else ".26"}"/>'
    pool = (f'<path d="M6 19 Q5.4 13 12 12 Q16 9.6 21 11.4 Q27.4 12.6 26.4 18.6 Q26 23.6 18 24 Q14 25.4 10 23.4 Q6.4 22 6 19 Z" fill="url(#g)" stroke="{edge}" stroke-width=".8"/>'
            f'<path d="M24.6 21 q2 1.6 1 3.6 q-1.6 .4 -1.6 -1.2" fill="{core}" stroke="{edge}" stroke-width=".6"/>'
            f'<ellipse cx="13" cy="15" rx="3.4" ry="1.6" fill="#fff" opacity=".55"/><circle cx="18.6" cy="14" r=".9" fill="#fff" opacity=".6"/>')
    return g, '  ' + halo + pool + '\n'


def branch_bundle(c):
    """slender springy branches, curved, tied at the butt; tips softly lit (raw but cut: faint at the edges)"""
    out = ''
    for dx, bend in [(-7, -3), (-4.4, -2), (-1.8, -0.8), (1, 0.6), (3.6, 1.8), (6.4, 3)]:
        tx, ty = 16 + dx, 4.6 + abs(dx) * 0.35
        out += f'<path d="M16 25 Q{16+bend} 15 {tx} {ty}" fill="none" stroke="{c["bark"]}" stroke-width="1.05" stroke-linecap="round"/>'
        out += f'<circle cx="{tx}" cy="{ty}" r="2.1" fill="#fff2a8" opacity=".35"/><circle cx="{tx}" cy="{ty}" r=".95" fill="#fff8d0"/>'
        mx, my = 16 + (bend + dx) * 0.55, 13
        out += f'<circle cx="{mx}" cy="{my}" r=".6" fill="#f6e7a6" opacity=".8"/>'
    cord = f'<path d="M13.6 21.4 L18.4 21.4 M13.8 23 L18.2 23" stroke="{CORD}" stroke-width="1.1" stroke-linecap="round"/>'
    return '  ' + out + cord + '\n'


def bark_rolls(c):
    """a loose bundle of thin papery bark curls, gold, dry (worked: no light)"""
    out = ''
    for (x, rot) in [(11, -18), (14, -6), (17.5, 6), (20.5, 18)]:
        out += (f'<g transform="rotate({rot} {x} 22)"><rect x="{x-1.9}" y="6" width="3.8" height="16" rx="1.9" fill="#d9a441" stroke="#8a6224" stroke-width=".8"/>'
                f'<ellipse cx="{x}" cy="6.6" rx="1.9" ry="1" fill="#f0c86a" stroke="#8a6224" stroke-width=".6"/>'
                f'<path d="M{x-0.6} 9 L{x-0.6} 20" stroke="#b9862f" stroke-width=".5"/></g>')
    cord = f'<path d="M11.4 20.2 Q16 22.2 20.6 20.2 M11.6 22 Q16 24 20.4 22" fill="none" stroke="{CORD}" stroke-width="1"/>'
    return '  ' + out + cord + '\n'


def crystal_sap():
    """an amber nugget mid-transition: resin outside, crystal core lit within"""
    g = '<radialGradient id="g" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#fff1b0"/><stop offset=".35" stop-color="#ffb43c"/><stop offset="1" stop-color="#b8561c"/></radialGradient>'
    body = ('<ellipse cx="16" cy="17" rx="11" ry="9" fill="#ffb43c" opacity=".22"/>'
            '<path d="M7.4 18 L10 10.6 L16.4 7.6 L23 10 L25.2 17 L21.6 23.4 L13 24.6 Z" fill="url(#g)" stroke="#7a3a12" stroke-width=".9" stroke-linejoin="round"/>'
            '<path d="M10 10.6 L15 15 L16.4 7.6 M15 15 L23 10 M15 15 L25.2 17 M15 15 L21.6 23.4 M15 15 L13 24.6 M15 15 L7.4 18" fill="none" stroke="#ffd98a" stroke-width=".5" opacity=".7"/>'
            '<path d="M7.4 18 Q6.8 22.6 13 24.6" fill="#c8732a" opacity=".8"/>'
            '<path d="M11.4 11.6 L14.6 9.8" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".7"/>')
    return g, '  ' + body + '\n'


def main():
    icons: dict[str, str] = {}
    gw, so, sw, dw = W['goldwood'], W['shimmeroak'], W['starwillow'], W['dawnwood']
    icons['goldwood_plank'] = svg('Goldwood Plank: two or three sawn planks, cord-tied, warm honey, plain (worked: no light).', plank_bundle(gw, 3, thick=2))
    icons['goldwood_bark'] = svg('Goldwood Bark: a loose roll of thin papery bark curls, gold, dry.', bark_rolls(gw))
    icons['shimmeroak_plank'] = svg('Shimmeroak Plank: heavier boards, the ripple reading as moire across the face.', plank_bundle(so, 2, ripple=True, thick=3))
    g, b = sap_pool('#f2a530', '#a8601a', '#fff0b8')
    icons['amber_sap'] = svg('Amber Sap: a slow honey-gold pool, glossy, luminous.', b, g)
    icons['starwillow_branch'] = svg('Starwillow Branch: a slender springy bundle, curved, tips softly lit.', branch_bundle(sw))
    g, b = sap_pool('#efe08a', '#a99a4e', '#fffbe0', bright=True)
    icons['starwillow_sap'] = svg('Starwillow Sap: pale glowing sap, brighter than amber, cooler.', b, g)
    icons['dawnwood_plank'] = svg('Dawnwood Plank: thick old boards, deep amber-gold, dense growth rings.', plank_bundle(dw, 2, rings=True, thick=3.2))
    g, b = crystal_sap()
    icons['crystallized_sap'] = svg('Crystallized Sap: an amber nugget mid-transition, resin outside, crystal core lit within.', b, g)
    for k, c in W.items():
        glow = {'starwillow': '#fff2a8', 'dawnwood': '#ffcf7a'}.get(k, c['end'])
        icons[f'{k}_log'] = svg(f'{k.title()} Log: three short logs, cut ends out, cord round them (raw but cut: faint at the cut faces).', logs(c, glow))
        icons[f'{k}_sapling'] = svg(f'{k.title()} Sapling: a young {k}, root ball in cloth and tied (alive: soft light at the crown).', sapling(c, k))
    OUT.mkdir(parents=True, exist_ok=True)
    for k, s in icons.items():
        (OUT / f'{k.replace("_", "-")}.svg').write_text(s)
    print(f'wrote {len(icons)} icons to {OUT}')


if __name__ == '__main__':
    main()
