"""Add (or re-kind) the canon places the painted Atlas does not carry as canon has them, to the GAME's region files only
(Jin play lane, 2026-11-16).

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
    # Magii 11-16 (dbr 15:18, schools.md + CANON_GAPS): the southern-coast 'Starforge' dot is NOT a collision. It sits where
    # canon puts the Architects' Starforge (underwater, southern coast, geography.md). Keep the name; its kind is a
    # LANDMARK (the forge's shore marker), not a school. Landmark = radius 0: no town grows on it. What shows there: Jin's.
    {'id': 'starforge', 'name': 'Starforge', 'kind': 'landmark', 'x': -4563.0, 'z': 1877.0, 'y': 15.27},
]

for path in REGIONS:
    d = json.load(open(path))
    have = {p['id']: p for p in d['places']}
    n = 0
    for p in PLACES:
        if have.get(p['id']) != p:
            # ★ IN PLACE, never remove-and-append: a town's plan seeds its hashes on the place's INDEX (plan.ts `pi`), so
            # moving one row to the end regrows every town after it (caught 11-16: Citadel 170 -> 143 buildings)
            i = next((k for k, q in enumerate(d['places']) if q['id'] == p['id']), None)
            if i is None: d['places'].append(p)
            else: d['places'][i] = p
            n += 1
    if n:
        with open(path, 'w') as f: json.dump(d, f)
    print(f'{path}: {n} place(s) added/updated')
