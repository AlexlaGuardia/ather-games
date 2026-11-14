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
import sys, os, json, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import road_network
from scipy import ndimage as nd
from scipy.spatial import cKDTree

H_SRC, NAME = sys.argv[1], sys.argv[2]
X0, Y0, X1, Y1 = map(int, sys.argv[3:7])
ATLAS = '/root/athernyx/assets/maps/atlas/atlas.json'
M_PX, UP = 10.0, 2                       # source metres per px; upsample factor → 5 m cells
CELL = M_PX / UP
WIDTH = road_network.WIDTH        # metres, the drivable surface (Alex 11-14: 7 m was too tight)
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
roads_out, routes = [], []
for r in atlas['roads']:
    w = WIDTH.get(r['kind'], 7.0)
    for k, arr in enumerate(dense_runs(r)):
        routes.append({'id': r['id'], 'kind': r['kind'], 'xz': arr})
        simp = arr[::4].tolist() + [arr[-1].tolist()]
        roads_out.append({'id': f"{r['id']}#{k}", 'kind': r['kind'], 'from': r['from'], 'to': r['to'], 'width': w, 'xz': simp})
# ── THE NETWORK (road_network.py): routes → one graph of edges + classified junctions. The bed is carved from the
# network, not the routes, so a shared trunk is one road and every junction is a flat pad of its own kind. ──
net_places = [{'id': p['id'], 'name': p['name'], 'kind': p['kind'], 'x': toW(p['x'], p['y'])[0], 'z': toW(p['x'], p['y'])[1]}
              for p in atlas['places']]
JF = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'junctions.json')
overrides = [{'kind': o['kind'], 'x': toW(*o['px'])[0], 'z': toW(*o['px'])[1]} for o in json.load(open(JF))['overrides']] if os.path.exists(JF) else []
# PASS ROADS over the bores (passes.json, propose_pass.py; canon Magii f34f33b): on their own grade, so the pass crosses
# the tunnel's roof in plan without a junction, and joins the network only at its two ends.
PF = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'passes.json')
over = [{'id': r['id'], 'kind': r['kind'], 'xz': arr} for r in (json.load(open(PF))['passes'] if os.path.exists(PF) else [])
        for arr in dense_runs(r)]
net = road_network.build(routes, (-sizeX / 2, -sizeZ / 2, sizeX / 2, sizeZ / 2), net_places, overrides, over) if routes else {'edges': [], 'junctions': []}
from collections import Counter
print('network:', len(net['edges']), 'edges,', dict(Counter(j['kind'] for j in net['junctions'])))
# ── BRIDGES: where a paved road or a road crosses water, the river stays a river and a deck carries the road over it
# (canon 11-14: bridges lawful and common in the heartland). A TRAIL keeps its ford (the frontier stays the frontier;
# a Shellback ferry is the canon crossing there, not built yet). The span runs bank to bank plus ABUT each side. ──
ABUT, CLEAR, DECK_G = 4, 4.0, 0.06          # pts (2.5 m) onto land each side · metres over the water · deck ramp grade
FERRY_M, FORD_M = 150.0, 40.0               # longer water than this is a ferry · a trail fords water shorter than this
# The Atlas marks SHELLBACK FERRY crossings (canon: Shellbacks pull ferries across rivers). A crossing with a marker,
# or too long for a stone deck, is a ferry: the road stops at a landing on each bank and the river is left alone.
ferry_marks = [toW(c['x'], c['y']) for c in atlas.get('crossings', []) if c.get('kind') == 'ferry']
spans = []                                  # (edge index, i0, i1, 'bridge' | 'ferry') into e['xz']
land0 = h.copy()
for ei, e in enumerate(net['edges']):
    hs = sample(e['xz'][:, 0], e['xz'][:, 1]); wet = hs < 0.5
    k = 0
    while k < len(wet):
        if not wet[k]: k += 1; continue
        k1 = k
        while k1 + 1 < len(wet) and wet[k1 + 1]: k1 += 1
        n = k1 - k + 1; L = n * 2.5
        # ≥ 7.5 m wet, of which some is OPEN water (below the water plane): low marsh alone is carved as road
        if n >= 3 and (hs[k:k1 + 1] < -0.15).sum() >= 3:
            W = e['xz'][k:k1 + 1]
            marked = any(np.hypot(W[:, 0] - fx, W[:, 1] - fz).min() < 80 for fx, fz in ferry_marks)
            # the markers come from the proposer's Year-600 rule ("bridge on paved, ferry otherwise"); the 1672
            # ruling (bridges lawful and common in the heartland) upgrades every road and paved crossing short enough
            # for a stone deck. Markers still decide for TRAILS (the frontier stays the frontier).
            if L > FERRY_M or (marked and e['kind'] not in ('paved', 'road')):
                if k > 0 and k1 < len(wet) - 1: spans.append((ei, k - 1, k1 + 1, 'ferry'))
            elif e['kind'] in ('paved', 'road'):
                spans.append((ei, max(0, k - ABUT), min(len(wet) - 1, k1 + ABUT), 'bridge'))
            elif L > FORD_M and k > 0 and k1 < len(wet) - 1:
                spans.append((ei, k - 1, k1 + 1, 'ferry'))
            # else: a trail fords it (the bed is carved through the shallows)
        k = k1 + 1
# ── TUNNELS: where the Atlas marks one (tunnels.json, Alex 11-14: "the passage is supposed to be a tunnel through the
# mountain"), the road goes THROUGH the ridge instead of cutting a canyon over it. The floor is a straight line between
# the low ground on each side of the crest; the portals are where the hill stands COVER metres over that line. Between
# the portals there is no bed: the mountain stays whole, and the game drives the floor (region.ts tunnelAt). Outside
# them the approach is cut down to the floor line, so the road meets the portal level. ──
COVER, T_REACH, T_GRADE = 9.0, 240, 0.08    # metres of hill over the floor at a portal · pts searched each side (600 m) · max floor grade
TF = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tunnels.json')
tunnel_marks = [(o.get('name'), toW(*o['px'])) for o in json.load(open(TF))['tunnels']] if os.path.exists(TF) else []
tunnels = []                                # (edge index, p0, p1, a, b, floor line over a..b)
for tname, (mx_, mz_) in tunnel_marks:
    cand = [(float(np.hypot(e['xz'][:, 0] - mx_, e['xz'][:, 1] - mz_).min()), ei) for ei, e in enumerate(net['edges']) if not e.get('over')]
    if not cand or min(cand)[0] > 150: continue
    ei = min(cand)[1]; e = net['edges'][ei]; P = e['xz']; n = len(P)
    hs = sample(P[:, 0], P[:, 1])
    m0 = int(np.argmin(np.hypot(P[:, 0] - mx_, P[:, 1] - mz_)))
    lo_, hi_ = max(0, m0 - 60), min(n, m0 + 61)
    m = lo_ + int(np.argmax(hs[lo_:hi_]))                      # the crest nearest the mark
    a = max(0, m - T_REACH) + int(np.argmin(hs[max(0, m - T_REACH): m + 1]))
    b = m + int(np.argmin(hs[m: min(n, m + T_REACH + 1)]))
    s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
    ya, yb = float(max(hs[a], 0.8)), float(max(hs[b], 0.8))
    L = s_[b] - s_[a]
    if L <= 0: continue
    if abs(yb - ya) / L > T_GRADE:                             # too steep end to end: raise the low end
        if ya < yb: ya = yb - T_GRADE * L
        else:       yb = ya - T_GRADE * L
    line = ya + (yb - ya) * (s_[a:b + 1] - s_[a]) / L
    cover = hs[a:b + 1] - line
    deep = np.where(cover >= COVER)[0]
    if len(deep) < 8: print(f'tunnel {tname}: hill never stands {COVER} m over the floor; left as a road'); continue
    p0, p1 = a + int(deep[0]), a + int(deep[-1])
    tunnels.append((ei, p0, p1, a, b, line))
    print(f"tunnel {tname} on {e['id']} ({e['kind']}): {s_[p1] - s_[p0]:.0f} m bore, floor {line[p0 - a]:.1f}->{line[p1 - a]:.1f} m, "
          f"crest {hs[m]:.0f} m ({hs[m] - line[m - a]:.0f} m of mountain over the road), approaches {s_[p0] - s_[a]:.0f} + {s_[b] - s_[p1]:.0f} m")
# the approaches are cut to the floor line before the field is built, so the grade envelope carries the road down to
# each portal (it never lifts a road above the land, so the line is a ceiling it settles under)
for ei, p0, p1, a, b, line in tunnels:
    e = net['edges'][ei]; hw = WIDTH[e['kind']] / 2 + 4.0 + 20.0   # the whole bed + the field's smoothing reach
    idx_ap = np.r_[a:p0 + 1, p1:b + 1]
    tr = cKDTree(e['xz'][idx_ap]); yl = line[idx_ap - a]
    dd, kk = tr.query(np.stack([gx.ravel(), gz.ravel()], 1), distance_upper_bound=hw)
    dd = dd.reshape(h.shape); kk = kk.reshape(h.shape)
    bore_pts = e['xz'][p0 + 1: p1]
    dB0, _ = cKDTree(bore_pts).query(np.stack([gx.ravel(), gz.ravel()], 1), distance_upper_bound=hw + 40)
    hit = np.isfinite(dd) & (dd < dB0.reshape(h.shape))          # never lower the hill over the bore itself
    h = np.where(hit, np.minimum(h, yl[np.minimum(kk, len(yl) - 1)]), h)
cen, cen_w, cen_g = [], [], []
for ei, e in enumerate(net['edges']):
    keep = np.ones(len(e['xz']), bool)
    for (ej, i0, i1, kind) in spans:
        if ej != ei: continue
        if kind == 'bridge': keep[i0 + ABUT: i1 - ABUT + 1] = False     # no bed (no causeway) under the water span
        else:                keep[i0 + 1: i1] = False                   # a ferry: the road ends at each bank
    for (ej, p0, p1, *_r) in tunnels:
        if ej == ei: keep[p0 + 1: p1] = False                          # a bore: no bed, the mountain stays
    cen += e['xz'][keep].tolist(); cen_w += [WIDTH[e['kind']]] * int(keep.sum())
    cen_g += [MAX_GRADE['pass'] if e['kind'] == 'pass' else 0.12] * int(keep.sum())   # the pass climbs; the rest hold 12%
if cen:
    tree = cKDTree(np.array(cen)); Wc = np.array(cen_w); Gc = np.array(cen_g)
    d, idx = tree.query(np.stack([gx.ravel(), gz.ravel()], 1), distance_upper_bound=14 / 2 + 4.0 + 220)   # wide: a deep cut's shoulder reaches far
    d = d.reshape(h.shape); idx = idx.reshape(h.shape)
    d_keep = d.copy()
    half = np.where(np.isfinite(d), Wc[np.minimum(idx, len(Wc) - 1)] / 2 + 4.0, 0)   # flat a little past the paint: a riverbank shoulder sagged into the drive line at +1
    # EXCESS = metres outside the road surface (≤ 0 on it). A junction pad is a disc of its own radius; the cell
    # takes whichever surface it is nearest to being on.
    ex = np.where(np.isfinite(d), d - half, np.inf)
    pad = np.zeros(h.shape, bool)
    # ferry landings are flat quays (a pad of their own, like a junction): you stop, wait, roll on
    quays = [(*net['edges'][ej]['xz'][i], 7.0) for ej, i0, i1, kd in spans if kd == 'ferry' for i in (i0, i1)]
    for j in list(net['junctions']) + [{'x': qx, 'z': qz, 'r': qr} for qx, qz, qr in quays]:
        if j['r'] <= 0: continue
        dj = np.hypot(gx - j['x'], gz - j['z']) - (j['r'] + 2.0)
        pad |= dj <= CELL
        ex = np.minimum(ex, dj)
    ok = np.isfinite(ex) & (ex < 230)
    d, half = ex, 0.0                                                  # the shoulder code below reads (d - half)
    bed = ok & (ex <= CELL)                                            # the road surface (+ one cell so it is never 1 px)
    # a bridge's water belongs to the river: a cell nearer the span's WET centre line than any kept road point, over
    # low ground, is never bed (else the abutments' bed discs fill a short river in from both banks)
    wet_pts = [net['edges'][ej]['xz'][i0 + ABUT: i1 - ABUT + 1] for ej, i0, i1, kd in spans if kd == 'bridge']
    wet_pts += [net['edges'][ej]['xz'][i0 + 1: i1] for ej, i0, i1, kd in spans if kd == 'ferry']
    wet_pts = [w for w in wet_pts if len(w)]
    if wet_pts:
        dw, _ = cKDTree(np.concatenate(wet_pts)).query(np.stack([gx.ravel(), gz.ravel()], 1), distance_upper_bound=40)
        # only OPEN water (below the water plane) is given back to the river: the bank beside a bridge's end stays
        # road, carved across the full width (11-14: the bank under the outer lanes was left 0.3-0.4 m low, a kerb
        # onto the deck and a drop off it, worst in the right-hand lane)
        bed &= ~((dw.reshape(h.shape) < d_keep) & (land0 < -0.15))
    # the field: land smoothed hard, causeway over water
    # the baseline is the land UNDER THE BED only (normalised convolution): smoothing the whole grid let a hill beside
    # a valley road pull the road up toward it
    bf = bed.astype(np.float64)
    road = np.maximum(nd.gaussian_filter(h * bf, 12 / CELL) / np.maximum(nd.gaussian_filter(bf, 12 / CELL), 1e-6), 0.8)
    # GRADE LIMIT, exactly: the highest and the lowest surfaces that obey the limit along the bed (min-plus / max-minus
    # propagation to a fixed point), averaged. Each envelope changes by at most g per metre between bed neighbours, so
    # any blend of them does too. (The first version clamped locally, one cell per pass, and stopped long before
    # Ashfeld's 70 m drop had propagated: 59% on a road meant to cap at 12%.)
    G = np.where(pad, 0.03, np.where(np.isfinite(d_keep), Gc[np.minimum(idx, len(Gc) - 1)], 0.12))   # a junction pad is near flat: you stop, turn and pull away on it
    nbrs = [(0, 1, CELL), (0, -1, CELL), (1, 0, CELL), (-1, 0, CELL),
            (1, 1, CELL * 1.4142), (1, -1, CELL * 1.4142), (-1, 1, CELL * 1.4142), (-1, -1, CELL * 1.4142)]
    BIG = 1e6
    U = np.where(bed, road, BIG)
    for it in range(3000):
        U0 = U
        for dz, dx, dist in nbrs:
            Ge = np.minimum(G, np.roll(np.roll(G, dz, 0), dx, 1))
            U = np.minimum(U, np.where(bed, np.roll(np.roll(U0, dz, 0), dx, 1) + Ge * dist, BIG))
        if np.abs(U - U0)[bed].max() < 1e-3: break
    # PURE CUT: U is the highest grade-legal surface that never rises above the land, so a road is never a dyke.
    # Any share of L lifts the road wherever a peak is within (peak height / G) of it: the 80/20 blend put 23% of the
    # corridor's road 8+ m above the land and a missed turn fell into a valley it could not climb out of (Alex 11-14).
    # 50/50 before that built a 44 m embankment. Cuts deep enough to matter (>20 m) are ~5% of the bed, and their
    # banks widen with the depth below, so a deep cut is a valley, not a slot.
    # ...then SMOOTH it along the bed (normalised convolution over bed cells only). The envelope is a min of cones, so
    # it is creased wherever a constraint binds; a creased road at 17 m/s is 40 little hops per km (the network export,
    # 11-14). An average of grade-legal surfaces stays (near) grade-legal, so this costs the limit nothing.
    bw = nd.gaussian_filter(bed.astype(np.float64), 1.6)
    Us = nd.gaussian_filter(np.where(bed, U, 0.0), 1.6) / np.maximum(bw, 1e-6)
    road = np.where(bed & ~pad, Us, np.where(bed, U, road))      # pads keep their exact 3% (smoothing tilted one to 6%)
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
    # under and beside a bridge the river keeps its bed: no shoulder may pull the water up to the bank
    if spans:
        wpts = np.concatenate([net['edges'][ej]['xz'][i0:i1 + 1] for ej, i0, i1, _ in spans])
        dW, _ = cKDTree(wpts).query(np.stack([gx.ravel(), gz.ravel()], 1), distance_upper_bound=60)
        blend = np.where((dW.reshape(h.shape) < 60) & (land0 < 0.5) & ~bed, 0, blend)   # never un-carve the road itself
    # over a bore the mountain keeps its shape: a cell nearer the bore than any kept road point is never pulled down
    # toward the road (else the portal's shoulder digs a crater into the hill above the tunnel mouth)
    if tunnels:
        bore = np.concatenate([net['edges'][ej]['xz'][p0 + 1: p1] for ej, p0, p1, *_r in tunnels])
        dB, _ = cKDTree(bore).query(np.stack([gx.ravel(), gz.ravel()], 1), distance_upper_bound=80)
        blend = np.where((dB.reshape(h.shape) < d_keep) & ~bed, 0, blend)
    h = h * (1 - blend) + road_out * blend
    # ROUNDABOUT ISLANDS: a kerb and a low planted mound, so the ring is driven around (or bounced over, at a cost)
    for j in net['junctions']:
        if 'island' not in j: continue
        rr = np.hypot(gx - j['x'], gz - j['z']) / j['island']
        h = np.where(rr < 1, h + 0.3 + 1.2 * (1 - rr * rr), h)

# ── the BORES' floors, read off the carved grid, then the MOUTHS cut down to them ──
TUNNEL_H, TUNNEL_WALK = 7.5, 1.2             # region.ts: floor to crown · walkway each side past the carriageway
tun_out, tun_floor = [], {}                  # edge index -> (p0, p1, floor y over p0..p1)
for ti, (ei, p0, p1, a, b, line) in enumerate(tunnels):
    e = net['edges'][ei]; P = e['xz'][p0:p1 + 1]
    # ONE GRADE, junction to junction: the floor is a straight line between the CARVED road at the approach ends
    # (a, b: the low ground each side, usually the junction pads), and the approaches and mouths are cut to the same
    # line. (v1 ran the floor between the portals and let the field make the approaches: the west approach settled
    # 3 m high, a crest at the mouth that threw the car on the way out. v0 eased a land-minima line onto the final
    # ground over 15 m: a 57% ramp at Rune Hold's mouth.)
    Q = e['xz'][a:b + 1]
    sq = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T))]); LQ = sq[-1]
    ga, gb = float(sample(*Q[0])[0]), float(sample(*Q[-1])[0])
    lq = ga + (gb - ga) * sq / max(LQ, 1e-6)
    hq = sample(Q[:, 0], Q[:, 1]) - lq
    ii = np.arange(a, b + 1)
    roofk = (ii > p0) & (ii < p1) & (hq >= TUNNEL_H + 1.0)        # where the hill is a roof: never carved
    cut = ~roofk
    hw = WIDTH[e['kind']] / 2 + TUNNEL_WALK + CELL
    pts2 = np.stack([gx.ravel(), gz.ravel()], 1)
    dC, kC = cKDTree(Q[cut]).query(pts2, distance_upper_bound=hw + SHOULDER)
    dC = dC.reshape(h.shape); kC = np.minimum(kC.reshape(h.shape), int(cut.sum()) - 1)
    dR = cKDTree(Q[roofk]).query(pts2, distance_upper_bound=hw + SHOULDER + 10)[0].reshape(h.shape) if roofk.any() else np.full(h.shape, np.inf)
    mine = np.isfinite(dC) & (dC < dR)
    # a pass road (an over-route) nearer than this line keeps its own graded bed: the shoulder never cuts across it
    ovp = [q['xz'] for q in net['edges'] if q.get('over')]
    if ovp: mine &= dC < cKDTree(np.concatenate(ovp)).query(pts2, distance_upper_bound=hw + SHOULDER)[0].reshape(h.shape)
    yC = lq[cut][kC]
    tt = np.clip((dC - hw) / SHOULDER, 0, 1); wC = np.where(mine, 1 - tt * tt * (3 - 2 * tt), 0)
    # the carriageway takes the line exactly; its shoulder only ever CUTS toward it (never fills a valley up)
    h = np.where(mine & (dC <= hw), yC, np.where(mine & (h > yC), h * (1 - wC) + yC * wC, h))
    y = lq[p0 - a: p1 - a + 1]
    s_ = sq[p0 - a: p1 - a + 1] - sq[p0 - a]; L = s_[-1]
    g0, g1 = float(y[0]), float(y[-1])
    hill = sample(P[:, 0], P[:, 1]) - y
    roof = np.where(hill >= TUNNEL_H)[0]
    tun_floor[ei] = (p0, p1, y)
    tun_out.append({'id': f't{ti}', 'name': tunnel_marks[ti][0] if ti < len(tunnel_marks) else None,
                    'edge': e['id'], 'kind': e['kind'], 'width': WIDTH[e['kind']],
                    'pts': [[round(float(x), 2), round(float(z), 2), round(float(yy), 2)] for (x, z), yy in zip(P, y)]})
    print(f"  bore {tunnel_marks[ti][0]}: floor {g0:.1f}->{g1:.1f} m ({abs(g1 - g0) / max(L, 1) * 100:.1f}%), "
          f"roofed {s_[roof[0]]:.0f}..{s_[roof[-1]]:.0f} of {L:.0f} m, mouth cuttings {s_[roof[0]]:.0f} + {L - s_[roof[-1]]:.0f} m")

# ⚠ heights are read from the FINAL grid: a later road re-cuts an earlier one's bed where they cross, so a height
# sampled right after a road's own cut goes stale (pass 1 reported a 168% "grade" that was exactly that)
for r in roads_out:
    xz = np.array(r.pop('xz'))
    r['pts'] = [[round(x, 1), round(z, 1), round(float(y), 2)] for (x, z), y in zip(xz, sample(xz[:, 0], xz[:, 1]))]

net_out = {'edges': [], 'junctions': [], 'bridges': [], 'ferries': []}
# the deck, read off the FINAL ground: it starts and ends on the carved road (no step at the abutment), arches to
# CLEAR over the water where its ramps allow, and never dips below the ground under it
for fi, (ei, i0, i1, _) in enumerate([sp for sp in spans if sp[3] == 'ferry']):
    e = net['edges'][ei]; A, B = e['xz'][i0], e['xz'][i1]
    L = float(np.hypot(*(B - A)))
    net_out['ferries'].append({'id': f'f{fi}', 'edge': e['id'], 'kind': e['kind'], 'length': round(L, 1),
                               'a': [round(float(A[0]), 1), round(float(A[1]), 1), round(float(sample(A[0], A[1])[0]), 2)],
                               'b': [round(float(B[0]), 1), round(float(B[1]), 1), round(float(sample(B[0], B[1])[0]), 2)]})
    print(f"ferry f{fi} on {e['id']} ({e['kind']}): {L:.0f} m of water")
for bi, (ei, i0, i1, _) in enumerate([sp for sp in spans if sp[3] == 'bridge']):
    e = net['edges'][ei]; P = e['xz'][i0:i1 + 1]
    s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))]); L = s_[-1]
    under = sample(P[:, 0], P[:, 1]); ya, yb = float(under[0]), float(under[-1])
    target = np.maximum(ya + (yb - ya) * s_ / max(L, 1e-6), CLEAR)
    y = np.minimum(target, np.minimum(ya + DECK_G * s_, yb + DECK_G * (L - s_)))
    # VERTICAL CURVES: a ramp meeting the crest is a kink, and a kink at 20 m/s throws the car (a road engineer's
    # crest curve). Smooth over ~30 m with the ends pinned, then never below the ground.
    w = 13
    if len(y) > w:
        ypad = np.concatenate([np.full(w // 2, y[0]), y, np.full(w // 2, y[-1])])
        ys = np.convolve(ypad, np.ones(w) / w, 'valid')
        tt = np.clip(np.minimum(np.arange(len(y)), np.arange(len(y))[::-1]) / (w / 2), 0, 1)
        y = y * (1 - tt) + ys * tt
    y = np.maximum(y, under + 0.05)
    net_out['bridges'].append({'id': f'b{bi}', 'edge': e['id'], 'kind': e['kind'], 'width': WIDTH[e['kind']],
                               'pts': [[round(float(x), 2), round(float(z), 2), round(float(yy), 2)] for (x, z), yy in zip(P, y)]})
    print(f"bridge b{bi} on {e['id']} ({e['kind']}): {L:.0f} m, deck {y.min():.1f}..{y.max():.1f} m, water clearance {float((y - np.minimum(under, 0)).max()):.1f} m")
net_out['tunnels'] = tun_out
for ei_, e in enumerate(net['edges']):
    P = e['xz'][::2] if len(e['xz']) > 3 else e['xz']
    if len(e['xz']) > 3 and not np.allclose(P[-1], e['xz'][-1]): P = np.vstack([P, e['xz'][-1:]])
    ys = sample(P[:, 0], P[:, 1])
    if ei_ in tun_floor:
        p0, p1, ty = tun_floor[ei_]
        ix = np.arange(0, len(e['xz']), 2)[:len(P)] if len(e['xz']) > 3 else np.arange(len(P))
        for k, i in enumerate(ix):
            if p0 <= i <= p1: ys[k] = ty[i - p0]
    net_out['edges'].append({'id': e['id'], 'kind': e['kind'], 'width': WIDTH[e['kind']], 'a': e['a'], 'b': e['b'],
                             'pts': [[round(float(x), 1), round(float(z), 1), round(float(y), 2)] for (x, z), y in zip(P, ys)],
                             **({'over': True} if e.get('over') else {})})
for j in net['junctions']:
    jo = {k: v for k, v in j.items() if k != 'arms'}
    jo['arms'] = [{'edge': f"e{a['edge']}", 'kind': a['kind'], 'ang': round(a['ang'], 3)} for a in j['arms']]
    jo['y'] = round(float(sample(j['x'], j['z'])[0]), 2)
    net_out['junctions'].append(jo)

places_out = []
for p in atlas['places']:
    x, z = toW(p['x'], p['y'])
    if inside(x, z):
        places_out.append({'id': p['id'], 'name': p['name'], 'kind': p['kind'], 'x': round(x, 1), 'z': round(z, 1), 'y': round(float(sample(x, z)[0]), 2)})

q = np.clip(np.round(h * 10), -32768, 32767).astype('<i2')
# a big region ships gzipped (Cloudflare does not compress octet-stream; the continent is 7.3 MB raw, 2.6 MB gz):
# the loader inflates it with DecompressionStream. Small regions stay raw.
import gzip
GZ = q.nbytes > 2_000_000
if GZ:
    open(f'public/open/{NAME}.bin.gz', 'wb').write(gzip.compress(q.tobytes(), 9, mtime=0))
    if os.path.exists(f'public/open/{NAME}.bin'): os.remove(f'public/open/{NAME}.bin')
else:
    open(f'public/open/{NAME}.bin', 'wb').write(q.tobytes())
meta = {'name': NAME, 'binGz': GZ, 'cell': CELL, 'nx': nx, 'nz': nz, 'sizeX': sizeX, 'sizeZ': sizeZ, 'scale': 0.1,
        'sourcePx': [X0, Y0, X1, Y1], 'mPerSourcePx': M_PX, 'atlasSavedAt': atlas.get('savedAt'),
        'roads': roads_out, 'network': net_out, 'places': places_out}
json.dump(meta, open(f'public/open/{NAME}.json', 'w'))
worst = (0, '')
isl = [(j['x'], j['z'], j['island'] + 1) for j in net['junctions'] if 'island' in j]
deckpts = np.array([q for b in net_out['bridges'] for q in b['pts']]) if net_out['bridges'] else np.zeros((0, 3))
def on_ferry(x, z):
    for f in net_out['ferries']:
        ax, az, bx, bz = f['a'][0], f['a'][1], f['b'][0], f['b'][1]
        L2 = (bx - ax) ** 2 + (bz - az) ** 2 or 1
        t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2
        L = math.sqrt(L2)
        if t * L > 1 and (1 - t) * L > 1 and math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z) < 10: return True
    return False
def drive_y(x, z, over=False):
    if on_ferry(x, z): return None         # the crossing between two landings is the ferry's, not a road's
    if any(math.hypot(x - f[k][0], z - f[k][1]) < 9 for f in net_out['ferries'] for k in ('a', 'b')): return None   # a quay
    """What the car rides at x, z: the deck if one is there, the ground otherwise; None over open water."""
    for t in ([] if over else net_out['tunnels']):          # a pass over the bore rides the hill, not the floor
        tp = np.array(t['pts'])
        k = int(np.argmin(np.hypot(tp[:, 0] - x, tp[:, 1] - z)))
        if math.hypot(tp[k, 0] - x, tp[k, 1] - z) < 1.5: return float(tp[k, 2])
    if len(deckpts):
        k = int(np.argmin(np.hypot(deckpts[:, 0] - x, deckpts[:, 1] - z)))
        if math.hypot(deckpts[k, 0] - x, deckpts[k, 1] - z) < 1.5: return float(deckpts[k, 2])
    y = float(sample(x, z)[0])
    return None if y < 0.5 else y          # wet (< 0.5) is a crossing's water: a ferry, or the river under a deck
for r in net_out['edges']:
    P = [q for q in r['pts'] if all(math.hypot(q[0] - jx, q[1] - jz) > ri for jx, jz, ri in isl)]   # nobody drives an island
    ys = [drive_y(q[0], q[1], r.get('over', False)) for q in P]
    g = np.array([abs(ys[k + 1] - ys[k]) / max(math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]), 1e-3)
                  for k in range(len(P) - 1) if ys[k] is not None and ys[k + 1] is not None])   # a ferry's water is not a grade
    if g.size and g.max() > worst[0]: worst = (float(g.max()), r['id'])
print(f'worst road grade {worst[0]*100:.1f}% on {worst[1]}')
print(f'{NAME}: {nx}x{nz} @ {CELL} m = {sizeX/1000:.1f} x {sizeZ/1000:.1f} km, h {h.min():.0f}..{h.max():.0f} m, '
      f'{len(roads_out)} road runs, places {[p["name"] or p["id"] for p in places_out]}, bin {q.nbytes//1024} KB')
