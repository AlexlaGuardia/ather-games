"""Export one REGION of the continent for the game: terrain at 5 m with the Atlas roads cut into it.

Reads the LIVE atlas (athernyx/assets/maps/atlas/atlas.json, edited in akatskii /canon World), so a road Alex
bends there is the road the game drives after a re-export. Heights come from derive_height.py's height.npy.

What it does: crops the region (source px; 1 px = 10 m) → upsamples 2x to a 5 m grid (cubic) → adds a little
seeded detail so the land is not glassy → FLATTENS a bed under every road: the road's own height profile is the
terrain smoothed along its length (no washboard), and the ground blends to it across a shoulder. A road over
water is held above it (a causeway until bridges exist).

Run: python3 tools/worldmap/export_region.py <height.npy> <name> x0 y0 x1 y1
Writes: public/open/<name>.bin (int16 decimetres, row-major, z rows) + public/open/<name>.json (meta, roads, places).
"""
import sys, json, math, numpy as np
from scipy import ndimage as nd
from scipy.spatial import cKDTree

H_SRC, NAME = sys.argv[1], sys.argv[2]
X0, Y0, X1, Y1 = map(int, sys.argv[3:7])
ATLAS = '/root/athernyx/assets/maps/atlas/atlas.json'
M_PX, UP = 10.0, 2                       # source metres per px; upsample factor → 5 m cells
CELL = M_PX / UP
WIDTH = {'paved': 14.0, 'road': 12.0, 'trail': 9.0, 'pass': 10.0}  # metres, the drivable surface (Alex 11-14: 7 m was too tight)
SHOULDER = 18.0
MAX_GRADE = {'paved': 0.10, 'road': 0.12, 'trail': 0.18, 'pass': 0.18}   # rise/run; where land is steeper the road cuts/fills

src = np.load(H_SRC)
crop = nd.gaussian_filter(src[Y0:Y1 + 1, X0:X1 + 1].astype(np.float64), 0.8)   # soften the 10 m mask's stair-step shores
h = nd.zoom(crop, UP, order=3)[: (Y1 - Y0) * UP + 1, : (X1 - X0) * UP + 1]
nz, nx = h.shape
sizeX, sizeZ = (nx - 1) * CELL, (nz - 1) * CELL
# world: x east, z south, origin at the region's centre (small floats in the engine)
toW = lambda px, py: ((px - X0) * M_PX - sizeX / 2, (py - Y0) * M_PX - sizeZ / 2)

# seeded detail: ±~1.2 m rolling texture on land only
rng = np.random.default_rng(7)
det = nd.gaussian_filter(rng.standard_normal(h.shape), 3) * 9 + nd.gaussian_filter(rng.standard_normal(h.shape), 1.2) * 1.5
h = np.where(h > 0.5, h + det * np.clip(h / 6, 0, 1), h)

atlas = json.load(open(ATLAS))
gx = (np.arange(nx) * CELL - sizeX / 2)[None, :].repeat(nz, 0)
gz = (np.arange(nz) * CELL - sizeZ / 2)[:, None].repeat(nx, 1)
def sample(x, z):
    """Bilinear sample of the CURRENT grid at world x, z."""
    fx, fz = (x + sizeX / 2) / CELL, (z + sizeZ / 2) / CELL
    return nd.map_coordinates(h, [np.atleast_1d(fz), np.atleast_1d(fx)], order=1, mode='nearest')

inside = lambda x, z: -sizeX / 2 - 40 <= x <= sizeX / 2 + 40 and -sizeZ / 2 - 40 <= z <= sizeZ / 2 + 40
# ── THE ROAD SURFACE IS ONE FIELD. Three failed models first, each a lesson: (1) roads cut one after another left
# steps where a later cut crossed an earlier bed; (2) relaxing those passes changed nothing; (3) one "network" with
# fixed junction heights still stepped, because the proposer's shared trunks arrive as near-parallel copies 2.5 m
# apart, each with its own profile. So: no per-road heights at all. Mark every ground sample under ANY road, give
# the whole marked area ONE height field (the land smoothed hard), then relax that field until no two neighbouring
# road samples differ by more than the grade limit. Shared trunks, crossings and parallel copies are one surface
# by construction; a hill steeper than the limit becomes a cut or an embankment.
inGrid = lambda x, z: -sizeX / 2 <= x <= sizeX / 2 and -sizeZ / 2 <= z <= sizeZ / 2
def dense_runs(r):
    pts = [toW(*p) for p in r['points']]
    dense = []
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(bx - ax, bz - az) / 2.5))
        dense += [(ax + (bx - ax) * i / n, az + (bz - az) * i / n) for i in range(n)]
    dense.append(pts[-1])
    runs, cur = [], []
    for p in dense:
        if inGrid(*p): cur.append(p)
        elif cur: runs.append(cur); cur = []
    if cur: runs.append(cur)
    return [np.array(run) for run in runs if len(run) >= 8]
roads_out, cen, cen_w = [], [], []
for r in atlas['roads']:
    w = WIDTH.get(r['kind'], 7.0)
    for k, arr in enumerate(dense_runs(r)):
        cen += arr.tolist(); cen_w += [w] * len(arr)
        simp = arr[::4].tolist() + [arr[-1].tolist()]
        roads_out.append({'id': f"{r['id']}#{k}", 'kind': r['kind'], 'from': r['from'], 'to': r['to'], 'width': w, 'xz': simp})
if cen:
    tree = cKDTree(np.array(cen)); Wc = np.array(cen_w)
    d, idx = tree.query(np.stack([gx.ravel(), gz.ravel()], 1), distance_upper_bound=14 / 2 + 4.0 + 220)   # wide: a deep cut's shoulder reaches far
    d = d.reshape(h.shape); idx = idx.reshape(h.shape)
    ok = np.isfinite(d)
    half = np.where(ok, Wc[np.minimum(idx, len(Wc) - 1)] / 2 + 4.0, 0)   # flat a little past the paint: a riverbank shoulder sagged into the drive line at +1
    bed = ok & (d <= half + CELL)                                     # the road surface (+ one cell so it is never 1 px)
    # the field: land smoothed hard, causeway over water
    # the baseline is the land UNDER THE BED only (normalised convolution): smoothing the whole grid let a hill beside
    # a valley road pull the road up toward it
    bf = bed.astype(np.float64)
    road = np.maximum(nd.gaussian_filter(h * bf, 12 / CELL) / np.maximum(nd.gaussian_filter(bf, 12 / CELL), 1e-6), 0.8)
    # GRADE LIMIT, exactly: the highest and the lowest surfaces that obey the limit along the bed (min-plus / max-minus
    # propagation to a fixed point), averaged. Each envelope changes by at most g per metre between bed neighbours, so
    # any blend of them does too. (The first version clamped locally, one cell per pass, and stopped long before
    # Ashfeld's 70 m drop had propagated: 59% on a road meant to cap at 12%.)
    G = 0.12
    nbrs = [(0, 1, CELL), (0, -1, CELL), (1, 0, CELL), (-1, 0, CELL),
            (1, 1, CELL * 1.4142), (1, -1, CELL * 1.4142), (-1, 1, CELL * 1.4142), (-1, -1, CELL * 1.4142)]
    BIG = 1e6
    U = np.where(bed, road, BIG); L = np.where(bed, road, -BIG)
    for it in range(3000):
        U0, L0 = U, L
        for dz, dx, dist in nbrs:
            U = np.minimum(U, np.where(bed, np.roll(np.roll(U0, dz, 0), dx, 1) + G * dist, BIG))
            L = np.maximum(L, np.where(bed, np.roll(np.roll(L0, dz, 0), dx, 1) - G * dist, -BIG))
        if max(np.abs(U - U0)[bed].max(), np.abs(L - L0)[bed].max()) < 1e-3: break
    # PURE CUT: U is the highest grade-legal surface that never rises above the land, so a road is never a dyke.
    # Any share of L lifts the road wherever a peak is within (peak height / G) of it: the 80/20 blend put 23% of the
    # corridor's road 8+ m above the land and a missed turn fell into a valley it could not climb out of (Alex 11-14).
    # 50/50 before that built a 44 m embankment. Cuts deep enough to matter (>20 m) are ~5% of the bed, and their
    # banks widen with the depth below, so a deep cut is a valley, not a slot.
    road = np.where(bed, U, road)
    print(f'grade envelope converged in {it} iterations')
    # the shoulder WIDENS with the cut or fill it has to make up (~1:3; at 1:1.6 13% of the bank was past the courser's climb limit), so a deep cut is a valley with sloping
    # sides, not a slot canyon (the road out of Ashfeld ran between 40 m vertical walls at a fixed 12 m shoulder)
    near0 = nd.distance_transform_edt(~bed, return_distances=False, return_indices=True)
    depth = np.abs(h - road[near0[0], near0[1]])
    t = np.clip((d - half) / np.maximum(SHOULDER, depth * 3.0), 0, 1)
    blend = np.where(ok, 1 - t * t * (3 - 2 * t), 0)
    # the shoulder blends to the NEAREST bed height (spread outward), so a cut has walls, not a cliff into the road
    near = nd.distance_transform_edt(~bed, return_distances=False, return_indices=True)
    road_out = road[near[0], near[1]]
    h = h * (1 - blend) + road_out * blend

# ⚠ heights are read from the FINAL grid: a later road re-cuts an earlier one's bed where they cross, so a height
# sampled right after a road's own cut goes stale (pass 1 reported a 168% "grade" that was exactly that)
for r in roads_out:
    xz = np.array(r.pop('xz'))
    r['pts'] = [[round(x, 1), round(z, 1), round(float(y), 2)] for (x, z), y in zip(xz, sample(xz[:, 0], xz[:, 1]))]

places_out = []
for p in atlas['places']:
    x, z = toW(p['x'], p['y'])
    if inside(x, z):
        places_out.append({'id': p['id'], 'name': p['name'], 'kind': p['kind'], 'x': round(x, 1), 'z': round(z, 1), 'y': round(float(sample(x, z)[0]), 2)})

q = np.clip(np.round(h * 10), -32768, 32767).astype('<i2')
open(f'public/open/{NAME}.bin', 'wb').write(q.tobytes())
meta = {'name': NAME, 'cell': CELL, 'nx': nx, 'nz': nz, 'sizeX': sizeX, 'sizeZ': sizeZ, 'scale': 0.1,
        'sourcePx': [X0, Y0, X1, Y1], 'mPerSourcePx': M_PX, 'atlasSavedAt': atlas.get('savedAt'),
        'roads': roads_out, 'places': places_out}
json.dump(meta, open(f'public/open/{NAME}.json', 'w'))
worst = (0, '')
for r in roads_out:
    P = np.array(r['pts']); dl = np.hypot(*np.diff(P[:, :2], axis=0).T); g = np.abs(np.diff(P[:, 2])) / np.maximum(dl, 1e-3)
    if g.size and g.max() > worst[0]: worst = (float(g.max()), r['id'])
print(f'worst road grade {worst[0]*100:.1f}% on {worst[1]}')
print(f'{NAME}: {nx}x{nz} @ {CELL} m = {sizeX/1000:.1f} x {sizeZ/1000:.1f} km, h {h.min():.0f}..{h.max():.0f} m, '
      f'{len(roads_out)} road runs, places {[p["name"] or p["id"] for p in places_out]}, bin {q.nbytes//1024} KB')
