"""Read the PLACES off the painted Athernyx map: every gold icon painted on map-draft-03, its kind and position.

The legend is canon's own (akatskii /canon World caption): stars = major cities, diamonds = settlements,
dots = villages, rings = schools. Red dots are named spots (Eyuun's Shack, Helga's Hut). Names come from the
painted labels (matched by hand in NAMES below, by position); an icon with no label stays UNNAMED. Naming one
is Magii's, never this script's.

Run: python3 tools/worldmap/extract_places.py [--debug out.png]
Prints JSON places (x, y in source pixels; 1 px = 10 m in the game's scale).
"""
import sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SRC = '/root/athernyx/assets/maps/drafts/map-draft-03.png'
img = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32) / 255
r, g, b = img[..., 0], img[..., 1], img[..., 2]
gold = (r > 0.8) & (g > 0.6) & (b < 0.35) & (r - b > 0.5)
black = img.max(-1) < 0.2
redm = (r > 0.7) & (g < 0.3) & (b < 0.3)

out = []
lab, n = nd.label(nd.binary_closing(gold, iterations=1))
for k, sl in enumerate(nd.find_objects(lab), 1):
    comp = lab[sl] == k
    area = comp.sum()
    if area < 25: continue
    h, w = comp.shape
    filled = nd.binary_fill_holes(comp)
    hole = filled & ~comp
    cy, cx = nd.center_of_mass(filled)
    y, x = sl[0].start + cy, sl[1].start + cx
    inner = img[sl][hole] if hole.sum() else None
    blk = black[sl][filled].mean()
    if hole.sum() > 4 and blk > 0.15:
        kind = 'settlement' if h > w * 1.12 else 'city'      # a diamond stands taller than wide; a star does not
    elif hole.sum() > 4:
        kind = 'school'
    else:
        kind = 'village' if area < 260 else 'site'
    out.append({'x': round(float(x), 1), 'y': round(float(y), 1), 'kind': kind, 'w': w, 'h': h, 'area': int(area),
                'inner': [round(float(v), 2) for v in inner.mean(0)] if inner is not None else None})
# red named spots (not ringed in gold)
lab2, n2 = nd.label(redm)
for k, sl in enumerate(nd.find_objects(lab2), 1):
    comp = lab2[sl] == k
    hh, ww = comp.shape
    # a DOT is round and solid (~7x7, 40+ px); the painted label letters are thin strokes and stay out
    if comp.sum() < 35 or abs(hh - ww) > 1: continue
    cy, cx = nd.center_of_mass(comp)
    y, x = sl[0].start + cy, sl[1].start + cx
    if any(abs(p['x'] - x) < 14 and abs(p['y'] - y) < 14 for p in out): continue      # a ring's red centre
    out.append({'x': round(float(x), 1), 'y': round(float(y), 1), 'kind': 'spot', 'w': int(sl[1].stop - sl[1].start), 'h': int(sl[0].stop - sl[0].start), 'area': int(comp.sum()), 'inner': None})
out.sort(key=lambda p: (p['y'], p['x']))

# ── names, read off the painted labels by hand (position → label beside it). Unlabelled icons stay None. ──
NAMES = [
    ('Gale Haven', 318, 107), ('Veradyn', 943, 101), ('Citadel', 788, 659), ('Ashfeld', 608, 181),
    ('Shoalhaven', 774, 275), ('Rune Hold', 609, 397), ('Passage', 579, 398), ('Driftmoore', 704, 194),
    ('Millbrook', 682, 257), ('Michivile', 332, 368), ('Thornwick', 733, 472), ('The Moldy Boulder', 509, 248),
    ('Rincrest', 965, 344), ('Verdant Ruins', 941, 393), ('Starforge', 127, 579),
    ("Eyuun's Shack", 706, 300), ("Helga's Hut", 799, 278),
]
for p in out:
    hit = [n for n, x, y in NAMES if abs(p['x'] - x) < 6 and abs(p['y'] - y) < 6]
    p['name'] = hit[0] if hit else None
missing = [n for n, *_ in NAMES if n not in {p['name'] for p in out}]
assert not missing, f'labels with no icon found under them: {missing}'

if '--json' in sys.argv:
    places = []
    for i, p in enumerate(out):
        slug = (p['name'] or f"unnamed-{p['kind']}-{i}").lower().replace("'", '').replace(' ', '-')
        places.append({'id': slug, 'name': p['name'], 'kind': p['kind'], 'x': p['x'], 'y': p['y'],
                       'ring': p['inner'] if p['kind'] == 'school' else None})
    print(json.dumps(places, indent=1))
else:
    for p in out: print(json.dumps(p))
if '--debug' in sys.argv:
    im = Image.open(SRC).convert('RGB'); d = ImageDraw.Draw(im)
    for i, p in enumerate(out):
        d.rectangle([p['x'] - 12, p['y'] - 12, p['x'] + 12, p['y'] + 12], outline=(255, 0, 255))
        d.text((p['x'] + 14, p['y'] - 6), f"{i}:{p['kind']}", fill=(255, 0, 255))
    im.save(sys.argv[sys.argv.index('--debug') + 1])
