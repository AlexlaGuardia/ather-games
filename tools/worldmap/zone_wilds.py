"""THE WILDS' ZONES (Alex 11-15: the old place names as the Wilds' tree zones; CANON_GAPS [OPEN] "The Wilds' zones").

Stamps a `zone` on every node in public/open/wilds/tiles.json. A node is one 200 m subsection of a tile (5×5 a tile),
and its zone is read off the land it stands on: the tile's own biome grid (water / shore / meadow / woods / rock at
4 m) and the painted continent it was cut from (map-draft-03.png, 10 m a pixel). First match wins:

  arid     — the northern badlands (canon 11-14, off the painting): the painting's tan          → no trees
  caverns  — rock-dominated ground (the Spine and its spurs); cave mouths come later           → no trees
  springs  — INLAND water: lakes, rivers, marsh (water the sea cannot reach + its shores)        → Starwillow
  thicket  — woods-dominated ground (the Deep Woods round the start)                            → Shimmeroak + Goldwood
  trails   — the Spine's foothills: ground beside the mountains, a walk up from anywhere        → Dawnwood
⚠ First cut lessons (11-15): wet share counted the OCEAN (every coast came out springs) → the sea is flood-filled in
from the map's edge and only water it cannot reach counts; the generator makes almost no dense woods outside the Deep
Woods, so "far woods" was 2 regions → the trails are the foothills (canon: Dawnwood at "the edges", higher levels).
  meadows  — everything else                                                                     → Goldwood

Ids are BUILD words; the names Alex used (Spirit Meadows, Twilight Thicket, Mana Springs, Wooded Trails, Arid Fields,
caverns with one Voranyx Caverns) stay off screen until Magii rules. Thresholds are Jin's; tune by the map this writes.

Run: python3 tools/worldmap/zone_wilds.py   (re-run after export_wilds_all.py + index_wilds.ts)
Also writes tools/worldmap/out/zones-map.png: the zones over the painting, for a look.
"""
import json, os, math, numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
WILDS = os.path.join(HERE, '../../public/open/wilds')
PAINTING = '/root/athernyx/assets/maps/drafts/map-draft-03.png'
WATER, SHORE, MEADOW, WOODS, ROCK = 0, 1, 2, 3, 4
SUB = 5                     # subsections a tile side (200 m)
SPRING_WET, WOODS_MIN, ROCK_MIN, ARID_MAX_PY = 0.06, 0.45, 0.5, 300
ZONES = ['meadows', 'thicket', 'springs', 'trails', 'arid', 'caverns']
COLOR = {'meadows': (176, 214, 110), 'thicket': (40, 110, 60), 'springs': (90, 190, 230), 'trails': (150, 90, 40), 'arid': (240, 210, 150), 'caverns': (120, 110, 130)}

idx = json.load(open(f'{WILDS}/tiles.json'))
AX, AY, TILE_PX = idx['anchor']['x0'], idx['anchor']['y0'], 100
paint = np.asarray(Image.open(PAINTING).convert('RGB')).astype(np.int32)
PH, PW = paint.shape[:2]

def tan_share(px: float, py: float, r: int = 6) -> float:
    """Share of the painting's pixels round (px, py) that are the badlands' tan (bright, warm, not label-yellow)."""
    x0, x1, y0, y1 = max(0, int(px) - r), min(PW, int(px) + r + 1), max(0, int(py) - r), min(PH, int(py) + r + 1)
    if x0 >= x1 or y0 >= y1: return 0.0
    w = paint[y0:y1, x0:x1]
    R, G, B = w[..., 0], w[..., 1], w[..., 2]
    tan = (R > 190) & (G > 160) & (B > 115) & (R - B > 40) & (R - B < 115)
    return float(tan.mean())

start_px = (AX + 50, AY + 50)
from scipy import ndimage as nd
# one continent-wide biome grid (missing tiles are sea), so the sea can be told from inland water
txs, tys = [t['tx'] for t in idx['tiles']], [t['ty'] for t in idx['tiles']]
TX0, TY0, NT = min(txs), min(tys), 250
G = np.full(((max(tys) - TY0 + 1) * NT, (max(txs) - TX0 + 1) * NT), WATER, dtype=np.uint8)
bios = {}
for t in idx['tiles']:
    bio = np.frombuffer(open(f"{WILDS}/{t['name']}.biome", 'rb').read(), dtype=np.uint8).reshape(NT, NT)
    bios[t['name']] = bio
    G[(t['ty'] - TY0) * NT:(t['ty'] - TY0 + 1) * NT, (t['tx'] - TX0) * NT:(t['tx'] - TX0 + 1) * NT] = bio
lab, _ = nd.label(G == WATER)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
sea = np.isin(lab, list(edge))
inland = (G == WATER) & ~sea
# an inland lake's or river's banks count too (shore cells touching it), the sea's beaches never do
inland_wet = inland | ((G == SHORE) & nd.binary_dilation(inland, iterations=2))

cs = NT // SUB
def zone_of(t, n):
    i, j = n['i'], n['j']
    cell = bios[t['name']][j * cs:(j + 1) * cs, i * cs:(i + 1) * cs]
    gy, gx = (t['ty'] - TY0) * NT + j * cs, (t['tx'] - TX0) * NT + i * cs
    wet = float(inland_wet[gy:gy + cs, gx:gx + cs].mean())
    woods, rock = float((cell == WOODS).mean()), float((cell == ROCK).mean())
    px, py = AX + t['tx'] * TILE_PX + (n['x'] + 500) / 10, AY + t['ty'] * TILE_PX + (n['z'] + 500) / 10
    if py < ARID_MAX_PY and tan_share(px, py) > 0.35: return 'arid'
    if rock >= ROCK_MIN or n.get('biome') == ROCK: return 'caverns'
    if wet >= SPRING_WET: return 'springs'
    if woods >= WOODS_MIN or n.get('biome') == WOODS: return 'thicket'
    return 'meadows'

first = {}
for t in idx['tiles']:
    for n in t['nodes']: first[n['id']] = zone_of(t, n)
# the foothills: a meadow that touches the mountains (a caverns node within one subsection, across tile seams too)
pos = {}
for t in idx['tiles']:
    for n in t['nodes']: pos[(t['tx'] * SUB + n['i'], t['ty'] * SUB + n['j'])] = n['id']
counts = {z: 0 for z in ZONES}
for t in idx['tiles']:
    for n in t['nodes']:
        z = first[n['id']]
        if z == 'meadows':
            ci, cj = t['tx'] * SUB + n['i'], t['ty'] * SUB + n['j']
            if any(first.get(pos.get((ci + a, cj + b)), '') == 'caverns' for a in (-1, 0, 1) for b in (-1, 0, 1)): z = 'trails'
        n['zone'] = z; counts[z] += 1

json.dump(idx, open(f'{WILDS}/tiles.json', 'w'), separators=(',', ':'))
print('zones:', counts)

# the look: zones as dots over the painting
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
img = Image.open(PAINTING).convert('RGB'); d = ImageDraw.Draw(img)
for t in idx['tiles']:
    for n in t['nodes']:
        px, py = AX + t['tx'] * TILE_PX + (n['x'] + 500) / 10, AY + t['ty'] * TILE_PX + (n['z'] + 500) / 10
        d.rectangle([px - 9, py - 9, px + 9, py + 9], outline=(20, 20, 20), fill=COLOR[n['zone']])
d.ellipse([start_px[0] - 12, start_px[1] - 12, start_px[0] + 12, start_px[1] + 12], outline=(255, 255, 255), width=4)
img.save(os.path.join(HERE, 'out/zones-map.png'))
print('map: tools/worldmap/out/zones-map.png')
