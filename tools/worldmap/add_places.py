"""Add the canon places the painted Atlas has no icon for, to the GAME's region files only (Jin play lane, 2026-11-16).

Each place here is placed by a canon LOCATION LINE, not painted. The canon Atlas (athernyx assets) is left alone: it is
the painted map's record. Ids never change once added (saves, doors, journal waymarks key on them). Re-running is a
no-op; moving a place = edit its row here and re-run.
Usage: python3 tools/worldmap/add_places.py
"""
import json

REGIONS = ['public/open/continent.json']
PLACES = [
    # world/schools.md › Star Temple: "Highest peak of the Spine — remote, mystical, closest to the sky." The seat of the
    # Star runesmith (schools.md › THE EIGHT RUNESMITH SEATS, ruled 11-16). The continent's highest ground, measured on
    # the height grid 11-16: 361.9 m at (80, -2450), a 2 m-flat summit, ~370 m above Ashfeld's road.
    {'id': 'star-temple', 'name': 'Star Temple', 'kind': 'spot', 'x': 80.0, 'z': -2450.0, 'y': 361.9},
]

for path in REGIONS:
    d = json.load(open(path))
    have = {p['id']: p for p in d['places']}
    n = 0
    for p in PLACES:
        if have.get(p['id']) != p:
            d['places'] = [q for q in d['places'] if q['id'] != p['id']] + [p]; n += 1
    if n:
        with open(path, 'w') as f: json.dump(d, f)
    print(f'{path}: {n} place(s) added/updated')
