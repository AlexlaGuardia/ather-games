"""Propose the ROAD NETWORK between the places, over the derived terrain. A proposal, not canon: the atlas
editor (akatskii /canon World) is where Alex moves a place or bends a road; this only gives a sane start.

How a road is found: cheapest path on a 20 m grid. Flat land is cheap, slope is expensive (and steeply so past
a cart's grade), sea is impassable, a river may be crossed only where it is narrow (a bridge or a Shellback
ferry). Roads are laid one at a time, shortest first, and a later road rides an earlier one at a discount, so
trunks form instead of parallel lanes. Which pairs get roads: a minimum spanning tree over each landmass, plus
the k-nearest links that would save a long detour (a network, not a single thread).

Tiers come from canon (world/transportation.md › Roads & Routes): PAVED in Citadel territory (stone, mana-lamps,
recharge stations), PASS where a road climbs the Spine (the Valkara: narrow, dangerous), TRAIL in the eastern
frontier (packed dirt), ROAD elsewhere. Crossings: BRIDGE on a paved road, FERRY (Shellbacks) otherwise.

Run: python3 tools/worldmap/propose_roads.py <height.npy> <places.json> <atlas_out.json> [--preview out.png]
"""
import sys, json, heapq, math, numpy as np
from scipy import ndimage as nd

height = np.load(sys.argv[1])
places = json.load(open(sys.argv[2]))
OUT = sys.argv[3]
S = 2                                     # grid step in source px (20 m)
h = height[::S, ::S]
H, W = h.shape
land = h > 0.5
water = ~land
# a river is crossable where it is narrow: water within 3 cells (≈60 m) of land on both sides
coastDist = nd.distance_transform_edt(water)
crossable = water & (coastDist <= 2)
# the open sea never is: water connected to the map edge and wide
gy, gx = np.gradient(h, 20.0)
grade = np.hypot(gx, gy)
cost = 1 + grade * 30 + np.where(grade > 0.12, (grade - 0.12) * 400, 0)
cost = np.where(land, cost, np.where(crossable, 40.0, np.inf))

def snap(x, y):
    """Nearest land cell to a place (icons sit on coasts and rivers)."""
    cx, cy = int(round(x / S)), int(round(y / S))
    best = None
    for r in range(0, 12):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                X, Y = cx + dx, cy + dy
                if 0 <= X < W and 0 <= Y < H and land[Y, X]:
                    d = dx * dx + dy * dy
                    if best is None or d < best[0]: best = (d, X, Y)
        if best: return best[1], best[2]
    return None

NB = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, math.sqrt(2)), (1, -1, math.sqrt(2)), (-1, 1, math.sqrt(2)), (1, 1, math.sqrt(2))]
def path(a, b, c):
    (ax, ay), (bx, by) = a, b
    dist = {(ax, ay): 0.0}; prev = {}
    pq = [(math.hypot(bx - ax, by - ay), 0.0, ax, ay)]
    while pq:
        f, g, x, y = heapq.heappop(pq)
        if (x, y) == (bx, by): break
        if g > dist.get((x, y), math.inf): continue
        for dx, dy, l in NB:
            X, Y = x + dx, y + dy
            if not (0 <= X < W and 0 <= Y < H): continue
            cc = c[Y, X]
            if not np.isfinite(cc): continue
            ng = g + l * (cc + c[y, x]) / 2
            if ng < dist.get((X, Y), math.inf):
                dist[(X, Y)] = ng; prev[(X, Y)] = (x, y)
                heapq.heappush(pq, (ng + math.hypot(bx - X, by - Y) * 0.6, ng, X, Y))
    if (bx, by) not in dist: return None, math.inf
    pts = [(bx, by)]
    while pts[-1] != (ax, ay): pts.append(prev[pts[-1]])
    return pts[::-1], dist[(bx, by)]

nodes = {}
for p in places:
    s = snap(p['x'], p['y'])
    if s: nodes[p['id']] = s
# landmasses by flood fill over land + crossable water
lab, _ = nd.label(land | crossable)
mass = {k: lab[v[1], v[0]] for k, v in nodes.items()}

# candidate links: each place to its 4 nearest on the same landmass
ids = list(nodes)
cand = set()
for a in ids:
    near = sorted((math.dist(nodes[a], nodes[b]), b) for b in ids if b != a and mass[b] == mass[a])[:4]
    for _, b in near: cand.add(tuple(sorted((a, b))))
cand = sorted(cand, key=lambda e: math.dist(nodes[e[0]], nodes[e[1]]))

# MST (Kruskal on straight-line length) + extras that save a long detour
parent = {k: k for k in ids}
def find(k):
    while parent[k] != k: parent[k] = parent[parent[k]]; k = parent[k]
    return k
mst, extra = [], []
for a, b in cand:
    if find(a) != find(b): parent[find(a)] = find(b); mst.append((a, b))
    else: extra.append((a, b))

c = cost.copy()
roads, onRoad = [], np.zeros_like(land)
def lay(a, b):
    pts, total = path(nodes[a], nodes[b], c)
    if pts is None: return None
    for x, y in pts: onRoad[y, x] = True
    c[onRoad & land] = np.minimum(c[onRoad & land], 0.45)        # ride the existing road
    return pts, total
graphLen = {}
for a, b in mst:
    r = lay(a, b)
    if r: roads.append((a, b, r[0])); graphLen[(a, b)] = r[1]
# an extra link is worth building if the network route between its ends is much longer than a direct road
import itertools
def netDist(a, b):
    # Dijkstra over laid roads only (road cells)
    pts, total = path(nodes[a], nodes[b], np.where(onRoad, 1.0, np.inf))
    return total if pts else math.inf
for a, b in extra:
    direct = math.dist(nodes[a], nodes[b])
    if netDist(a, b) > direct * 2.2:
        r = lay(a, b)
        if r: roads.append((a, b, r[0]))

# ── tiers + crossings ──
by = {p['id']: p for p in places}
cit = by.get('citadel')
spineAvoid = None
def tier(pts):
    xs = np.array([p[0] for p in pts]) * S; ys = np.array([p[1] for p in pts]) * S
    hmax = max(h[y, x] for x, y in pts)
    if hmax > 200: return 'pass'                                     # pass 1's 150 m caught the whole NW highland
    if np.mean(ys) > 540 or (cit and np.mean(np.hypot(xs - cit['x'], ys - cit['y'])) < 300): return 'paved'   # the South = Citadel territory
    if np.mean(xs) > 650 and 250 < np.mean(ys) < 640: return 'trail'
    return 'road'
def simplify(pts, eps=1.2):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0], float), np.array(pts[-1], float)
    ab = b - a; L = np.hypot(*ab) or 1
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / L for p in pts[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > eps: return simplify(pts[:i + 1], eps)[:-1] + simplify(pts[i:], eps)
    return [pts[0], pts[-1]]
out_roads, crossings = [], []
for a, b, pts in roads:
    t = tier(pts)
    wet = [p for p in pts if water[p[1], p[0]]]
    # one crossing per contiguous wet run
    run = []
    for p in pts + [None]:
        if p is not None and water[p[1], p[0]]: run.append(p)
        elif run:
            mx, my = run[len(run) // 2]
            # a one-cell clip of shoreline is not a crossing; a trunk shared by two roads is ONE crossing
            if len(run) >= 2 and not any(math.hypot(c0['x'] - mx * S, c0['y'] - my * S) < 8 for c0 in crossings):
                crossings.append({'x': mx * S, 'y': my * S, 'kind': 'bridge' if t == 'paved' else 'ferry', 'road': f'{a}--{b}'})
            run = []
    sp = simplify(pts)
    out_roads.append({'id': f'{a}--{b}', 'from': a, 'to': b, 'kind': t,
                      'points': [[round(x * S, 1), round(y * S, 1)] for x, y in sp],
                      'lengthKm': round(sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)) * S * 10 / 1000, 2)})

# ── sea routes: the islands are reached by ship (canon: Gale Haven is the maritime hub; Citadel → Veradyn by ship) ──
SEA = [('gale-haven', 'veradyn'), ('citadel', 'veradyn'), ('millbrook', 'driftmoore')]
# routed through open water (pass 1 drew straight lines that cut across the whole north coast)
seaCost = np.where(water, 1.0 + np.clip(3 - coastDist, 0, 3), np.inf)      # keep a little off the shore
def toWater(x, y):
    cx, cy = int(round(x / S)), int(round(y / S))
    for r in range(0, 40):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                X, Y = cx + dx, cy + dy
                if 0 <= X < W and 0 <= Y < H and water[Y, X] and coastDist[Y, X] >= 2: return X, Y
    return None
sea_routes = []
for a, b in SEA:
    if a in by and b in by:
        wa, wb = toWater(by[a]['x'], by[a]['y']), toWater(by[b]['x'], by[b]['y'])
        pts, _ = path(wa, wb, seaCost) if wa and wb else (None, 0)
        if not pts: print('no sea route', a, b); continue
        sp = simplify(pts, 2.0)
        sea_routes.append({'id': f'{a}~~{b}', 'from': a, 'to': b, 'kind': 'sea',
                           'points': [[by[a]['x'], by[a]['y']]] + [[round(x * S, 1), round(y * S, 1)] for x, y in sp] + [[by[b]['x'], by[b]['y']]]})

atlas = {
    'version': 1,
    'source': 'maps/drafts/map-draft-03.png',
    'mPerPx': 10,
    'note': 'places = read off the painted map (names from its labels; null = unlabelled, Magii names it). roads/crossings = a PROPOSAL from tools/worldmap/propose_roads.py, edited in the akatskii atlas.',
    'places': places,
    'roads': out_roads,
    'crossings': crossings,
    'sea': sea_routes,
}
json.dump(atlas, open(OUT, 'w'), indent=1)
total = sum(r['lengthKm'] for r in out_roads)
from collections import Counter
print(f'{len(sea_routes)} sea routes, {len(out_roads)} roads, {total:.1f} km, tiers {dict(Counter(r["kind"] for r in out_roads))}, crossings {dict(Counter(c["kind"] for c in crossings))}, unreached {[k for k in ids if not any(k in (r["from"], r["to"]) for r in out_roads)]}')

if '--preview' in sys.argv:
    from PIL import Image, ImageDraw
    import os
    rel = Image.open(os.path.join(os.path.dirname(sys.argv[1]), 'relief.png')).convert('RGB')
    rel = rel.resize((rel.width * 2, rel.height * 2), Image.BICUBIC)
    d = ImageDraw.Draw(rel)
    col = {'paved': (245, 230, 190), 'road': (200, 170, 120), 'trail': (150, 115, 80), 'pass': (230, 80, 60)}
    wid = {'paved': 5, 'road': 4, 'trail': 3, 'pass': 3}
    for r in out_roads:
        d.line([(x * 2, y * 2) for x, y in r['points']], fill=col[r['kind']], width=wid[r['kind']], joint='curve')
    for r in sea_routes:
        for (x0, y0), (x1, y1) in zip(r['points'], r['points'][1:]):
            n = max(1, int(math.dist((x0, y0), (x1, y1)) / 6))
            for i in range(0, n, 2):
                d.line([(2 * (x0 + (x1 - x0) * i / n), 2 * (y0 + (y1 - y0) * i / n)), (2 * (x0 + (x1 - x0) * (i + 1) / n), 2 * (y0 + (y1 - y0) * (i + 1) / n))], fill=(220, 240, 255), width=2)
    for c2 in crossings:
        x, y = c2['x'] * 2, c2['y'] * 2
        d.rectangle([x - 5, y - 5, x + 5, y + 5], outline=(255, 255, 255) if c2['kind'] == 'bridge' else (90, 200, 255), width=2)
    kcol = {'city': (212, 168, 67), 'settlement': (230, 200, 120), 'village': (255, 255, 255), 'school': (160, 120, 255), 'site': (255, 255, 255), 'spot': (230, 60, 60)}
    for p in places:
        x, y = p['x'] * 2, p['y'] * 2
        rr = {'city': 10, 'settlement': 8}.get(p['kind'], 5)
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=kcol[p['kind']], outline=(20, 20, 20), width=2)
        if p['name']: d.text((x + rr + 4, y - 6), p['name'], fill=(15, 15, 15))
    rel.save(sys.argv[sys.argv.index('--preview') + 1])
