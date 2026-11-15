"""Apply canon place names to the Atlas and the exported regions, keyed by build id (Jin play lane, 2026-11-15).

Source of truth: CANON/world/locations.md (the 1672 villages and schools table, ruled by Magii + Alex 11-15), each
row carrying `build id `<id>``. Names only: ids never change (saves, pitstops and contracts key on them), and no
geometry is re-exported. Re-running is a no-op once applied; a name canon has not given stays null.
Usage: python3 tools/worldmap/apply_names.py"""
import json, re

LOC = '/root/athernyx/CANON/world/locations.md'
ATLAS = '/root/athernyx/assets/maps/atlas/atlas.json'
REGIONS = ['public/open/continent.json', 'public/open/corridor.json']

names = {}
for line in open(LOC):
    m = re.match(r'\|\s*\*\*(.+?)\*\*\s*\|.*build id `([a-z0-9-]+)`', line)
    if m: names[m.group(2)] = m.group(1)
print(f'{len(names)} canon names:', ', '.join(f'{k}={v}' for k, v in names.items()))

def apply(path, compact):
    d = json.load(open(path))
    n = 0
    for p in d['places']:
        if p['id'] in names and p.get('name') != names[p['id']]:
            p['name'] = names[p['id']]; n += 1
    if n:
        with open(path, 'w') as f:
            json.dump(d, f) if compact else f.write(json.dumps(d, indent=1, ensure_ascii=False) + '\n')
    print(f'{path}: {n} named')

apply(ATLAS, compact=False)
for r in REGIONS: apply(r, compact=True)
