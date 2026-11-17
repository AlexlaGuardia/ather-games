#!/usr/bin/env python3
"""The found Keepstones' icons: the basic keepstone.svg with its light recoloured by the crystal set in it (canon 5a20b8f:
   uniques are look only). python3 tools/art/keepstone_icons.py -> public/open/icons/keepstone-<kind>.svg"""
import os
D = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'open', 'icons')
base = open(os.path.join(D, 'keepstone.svg')).read()
# (light, bowl, edge, highlight) per crystal; matches workshop.tsx CRYSTAL_LIGHT
KINDS = {'violet': ('#b48cff', '#e2d4ff', '#6a3fb0', '#f3ecff'), 'storm': ('#ffe27a', '#fff3c0', '#a8871c', '#fffbe6'),
         'earth': ('#f0b070', '#fbe0c2', '#9a5a22', '#fff3e4'), 'water': ('#6fe0ff', '#c8f4ff', '#2a8aa8', '#ecfcff'),
         'pure': ('#f2f7ff', '#ffffff', '#8a9ab8', '#ffffff'), 'ather': ('#ffc8ee', '#ffe8f7', '#b0508e', '#fff4fb')}
for k, (light, bowl, edge, hi) in KINDS.items():
    s = base.replace('#9ad8ff', light).replace('#bfe8ff', bowl).replace('#3f7fa8', edge).replace('#e8f7ff', hi)
    s = s.replace('a mana shard', f'a {k} crystal')
    open(os.path.join(D, f'keepstone-{k}.svg'), 'w').write(s)
print(f'wrote {len(KINDS)} icons')
