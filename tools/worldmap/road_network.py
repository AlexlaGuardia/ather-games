"""The ROAD NETWORK: the Atlas's routes (place-to-place, overlapping wherever a later road rode an earlier one) turned
into ONE graph of edges and junctions, and every junction given a kind the way Earth's roads choose one: by WHAT
MEETS. Nobody places a roundabout by hand; two paved roads meeting get one.

Why a raster: the proposer lays shared trunks as near-parallel copies 2.5 m apart, and the routes cross, merge and
split at shallow angles. Stamping every route as a fat stroke and thinning the union to a 1-pixel skeleton makes all
of that one shape before any geometry is asked of it. Copies collapse to one centre line by construction.

Pipeline: stamp (r = MERGE_R) → fill the small loops two copies leave between them → Zhang-Suen thin → skeleton
graph (node = ≥3 neighbours or an end) → prune spurs → join pass-through nodes → smooth each edge → classify.

Junction kinds (rank paved 4 > road 3 > pass 2 > trail 1):
  square      roads meeting inside a town: a flat paved square on the place (every town a hub)
  roundabout  ≥5 arms, or three PAVED arms (paved roads meeting, not one paved road passing a lane)
  cross       four arms with a clear major pair (the major road runs through; the minor pair stops)
  stop4       four arms of like rank (an all-way stop)
  merge       three arms with two of them < 40° apart (a Y: the minor road joins at a slant)
  tee         three arms, otherwise (the most-opposite pair runs through; the third gives way)
  end         one arm: a dead end or the edge of the region
OVERRIDES: tools/worldmap/junctions.json pins a kind at a source-px point (nearest junction within 60 m). Earth's
engineers choose too: the rule is the default, not the law.
⚠ What sits AT a junction in 1672 (signs, paint, who has right of way) is canon, asked of Magii 11-14. Only the
geometry is decided here.
"""
import math, numpy as np
from scipy import ndimage as nd

RANK = {'paved': 4, 'road': 3, 'pass': 2, 'trail': 1}
KIND = {v: k for k, v in RANK.items()}
PX = 2.5                    # raster metres per pixel
MERGE_R = 6.0               # routes closer than ~2·this become one road
SPUR_M = 45.0               # a dead-end stub shorter than this, hanging off a junction, is a thinning artefact
SMOOTH_M = 22.0             # moving-average window along an edge
ROUNDABOUT_R, ISLAND_R = 18.0, 8.5      # outer radius / central island (a rural single-lane roundabout, ~36 m across)
SQUARE_R = {'city': 30.0, 'village': 20.0, 'settlement': 22.0}
WIDTH = {'paved': 14.0, 'road': 12.0, 'trail': 9.0, 'pass': 10.0}  # metres, the drivable surface (Alex 11-14: 7 m was too tight)


def thin(img):
    """Zhang-Suen thinning, vectorised. img: bool array; returns a 1-px-wide 8-connected skeleton."""
    img = np.pad(img.astype(np.uint8), 1)
    while True:
        changed = False
        for step in (0, 1):
            P = img
            p2, p3, p4 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:]
            p5, p6, p7 = P[2:, 2:], P[2:, 1:-1], P[2:, :-2]
            p8, p9 = P[1:-1, :-2], P[:-2, :-2]
            c = P[1:-1, 1:-1]
            nb = [p2, p3, p4, p5, p6, p7, p8, p9]
            B = sum(n.astype(np.int16) for n in nb)
            A = sum(((nb[k] == 0) & (nb[(k + 1) % 8] == 1)).astype(np.int16) for k in range(8))
            if step == 0: m = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:         m = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            kill = (c == 1) & (B >= 2) & (B <= 6) & (A == 1) & m
            if kill.any():
                img[1:-1, 1:-1][kill] = 0
                changed = True
        if not changed: return img[1:-1, 1:-1].astype(bool)


N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def build(routes, bounds, places=(), overrides=(), over=()):
    """routes: [{'id','kind','xz': (n,2) array of world metres, densely sampled}]; bounds: (xmin, zmin, xmax, zmax);
    places: [{'id','name','kind','x','z'}]; over: routes at their OWN GRADE (a pass climbing over a bore): never stamped,
    so they cross other roads without a junction, and joined to the graph only at the nodes nearest their two ends.
    Returns {'edges': [...], 'junctions': [...]} in world metres (no heights)."""
    xmin, zmin, xmax, zmax = bounds
    W, H = int(math.ceil((xmax - xmin) / PX)) + 1, int(math.ceil((zmax - zmin) / PX)) + 1
    toPx = lambda x, z: ((z - zmin) / PX, (x - xmin) / PX)
    toW = lambda r, c: (xmin + c * PX, zmin + r * PX)

    # ── stamp: one centre-line raster per rank-or-better, so an edge's rank is the best road that runs under it ──
    line = np.zeros((H, W), np.int8)
    for r in routes:
        rk = RANK.get(r['kind'], 3)
        xz = np.asarray(r['xz'], float)
        # sample at ≤ half a pixel so the stroke is unbroken
        seg = np.hypot(*np.diff(xz, axis=0).T)
        pts = [xz[0]]
        for (a, b), L in zip(zip(xz, xz[1:]), seg):
            n = max(1, int(L / (PX / 2)))
            pts += [a + (b - a) * (k + 1) / n for k in range(n)]
        P = np.array(pts)
        rr, cc = np.round(toPx(P[:, 0], P[:, 1])).astype(int)
        ok = (rr >= 0) & (rr < H) & (cc >= 0) & (cc < W)
        np.maximum.at(line, (rr[ok], cc[ok]), rk)
    dist, (ir, ic) = nd.distance_transform_edt(line == 0, return_indices=True)
    mask = dist * PX <= MERGE_R
    rankAt = {k: nd.distance_transform_edt(line < k) * PX <= MERGE_R + PX for k in (2, 3, 4)}
    # loops between two copies (or a tight triangle of trunks) become solid, so the skeleton has no ghost rings
    holes = nd.binary_fill_holes(mask) & ~mask
    lab, n = nd.label(holes)
    if n:
        area = nd.sum(holes, lab, range(1, n + 1)) * PX * PX
        small = np.isin(lab, 1 + np.nonzero(area < 2500)[0])     # < 50×50 m: an artefact, not a block of land
        mask |= small
    sk = thin(mask)

    # ── skeleton → graph ──
    def nbrs(r, c):
        for dr, dc in N8:
            rr, cc = r + dr, c + dc
            if 0 <= rr < H and 0 <= cc < W and sk[rr, cc]: yield rr, cc
    deg = nd.convolve(sk.astype(np.int8), np.ones((3, 3), np.int8), mode='constant') - 1
    deg = np.where(sk, deg, 0)
    isNode = sk & ((deg >= 3) | (deg == 1))
    # a junction is a little clump of ≥3-neighbour pixels: grow and label so one crossing is one node
    clump = nd.binary_dilation(isNode & (deg >= 3), iterations=2) & sk
    nlab, nn = nd.label(clump | (isNode & (deg == 1)), structure=np.ones((3, 3)))
    nodes = []
    for k in range(1, nn + 1):
        rs, cs = np.nonzero(nlab == k)
        x, z = toW(rs.mean(), cs.mean())
        nodes.append({'x': x, 'z': z, 'px': list(zip(rs.tolist(), cs.tolist()))})
    # edges: the skeleton minus the node clumps; each piece runs between the clumps it touches
    rest = sk & (nlab == 0)
    elab, ne = nd.label(rest, structure=np.ones((3, 3)))
    edges = []
    for k in range(1, ne + 1):
        rs, cs = np.nonzero(elab == k)
        cells = set(zip(rs.tolist(), cs.tolist()))
        # an end of the piece: a cell with ≤1 neighbour inside the piece
        def inside_n(p): return [q for q in nbrs(*p) if q in cells]
        ends = [p for p in cells if len(inside_n(p)) <= 1]
        start = ends[0] if ends else next(iter(cells))
        path, seen, cur = [start], {start}, start
        while True:
            nxt = [q for q in inside_n(cur) if q not in seen]
            if not nxt: break
            cur = nxt[0]; path.append(cur); seen.add(cur)
        def touch(p):
            for q in nbrs(*p):
                if nlab[q] > 0: return int(nlab[q]) - 1
            return None
        a, b = touch(path[0]), touch(path[-1])
        if len(path) == 1 and a is not None:
            others = {int(nlab[q]) - 1 for q in nbrs(*path[0]) if nlab[q] > 0}
            b = max(others) if len(others) > 1 else a
        rk = max([1] + [kk for kk in (2, 3, 4) if np.mean([rankAt[kk][p] for p in path]) > 0.5])
        edges.append({'a': a, 'b': b, 'px': path, 'rank': rk})
    # pieces that touch nothing on one side are open ends at the region border: give them an 'end' node
    for e in edges:
        for side in ('a', 'b'):
            if e[side] is None:
                p = e['px'][0] if side == 'a' else e['px'][-1]
                x, z = toW(*p)
                nodes.append({'x': x, 'z': z, 'px': [p]}); e[side] = len(nodes) - 1
    # two clumps joined only by adjacency (no edge pixels between) → link them directly
    for i, nd_ in enumerate(nodes):
        for p in nd_['px']:
            for q in nbrs(*p):
                j = int(nlab[q]) - 1
                if j > i and not any({e['a'], e['b']} == {i, j} for e in edges):
                    edges.append({'a': i, 'b': j, 'px': [p, q], 'rank': max([1] + [kk for kk in (2, 3, 4) if rankAt[kk][p]])})

    def to_xz(e):
        pts = [(nodes[e['a']]['x'], nodes[e['a']]['z'])] + [toW(*p) for p in e['px']] + [(nodes[e['b']]['x'], nodes[e['b']]['z'])]
        return np.array(pts)
    for e in edges: e['xz'] = to_xz(e)
    length = lambda e: float(np.hypot(*np.diff(e['xz'], axis=0).T).sum())
    near_place = lambda x, z, r: any(math.hypot(p['x'] - x, p['z'] - z) < r for p in places)
    near_border = lambda x, z: min(x - xmin, xmax - x, z - zmin, zmax - z) < 15

    for _pass in range(3):   # pruning a whisker makes a pass-through node; joining can expose the next whisker
        # tiny self-loops are thinning rings (a clump the skeleton left and re-entered): drop them
        edges = [e for e in edges if not (e['a'] == e['b'] and length(e) < 80)]
        # WELD: a loose end within 25 m of another junction is the same road broken by a clump; snap it on
        degc = np.zeros(len(nodes), int)
        for e in edges: degc[e['a']] += 1; degc[e['b']] += 1
        for i in [i for i in range(len(nodes)) if degc[i] == 1]:
            ni = nodes[i]
            if near_border(ni['x'], ni['z']): continue
            mine = next(e for e in edges if i in (e['a'], e['b']))
            far = mine['b'] if mine['a'] == i else mine['a']
            cand = [(math.hypot(nodes[j]['x'] - ni['x'], nodes[j]['z'] - ni['z']), j) for j in range(len(nodes))
                    if j != i and j != far and degc[j] > 0]
            if not cand: continue
            dj, j = min(cand)
            if dj > 25: continue
            pj = np.array([[nodes[j]['x'], nodes[j]['z']]])
            if mine['a'] == i: mine['a'] = j; mine['xz'] = np.vstack([pj, mine['xz']])
            else:              mine['b'] = j; mine['xz'] = np.vstack([mine['xz'], pj])
            degc[i] -= 1; degc[j] += 1
        # ── prune spurs: short dead ends hanging off a junction (thinning whiskers), unless they reach a place ──
        for _ in range(6):
            degc = np.zeros(len(nodes), int)
            for e in edges: degc[e['a']] += 1; degc[e['b']] += 1
            drop = set()
            for k, e in enumerate(edges):
                for end, other in ((e['a'], e['b']), (e['b'], e['a'])):
                    n_ = nodes[end]
                    if degc[end] == 1 and degc[other] >= 3 and length(e) < SPUR_M \
                            and not near_place(n_['x'], n_['z'], 40) and not near_border(n_['x'], n_['z']):
                        drop.add(k)
            if not drop: break
            edges = [e for k, e in enumerate(edges) if k not in drop]

        # ── join pass-through nodes (degree 2) so an edge runs junction to junction ──
        while True:
            degc = np.zeros(len(nodes), int)
            for e in edges: degc[e['a']] += 1; degc[e['b']] += 1
            two = [i for i in range(len(nodes)) if degc[i] == 2]
            done = False
            for i in two:
                es = [k for k, e in enumerate(edges) if i in (e['a'], e['b'])]
                if len(es) != 2 or es[0] == es[1]: continue
                e1, e2 = edges[es[0]], edges[es[1]]
                if e1['a'] == e1['b'] or e2['a'] == e2['b']: continue
                p1 = e1['xz'] if e1['b'] == i else e1['xz'][::-1]
                p2 = e2['xz'] if e2['a'] == i else e2['xz'][::-1]
                a = e1['a'] if e1['b'] == i else e1['b']
                b = e2['b'] if e2['a'] == i else e2['a']
                L1, L2 = length(e1), length(e2)
                merged = {'a': a, 'b': b, 'xz': np.vstack([p1, p2[1:]]),
                          'rank': e1['rank'] if L1 >= L2 else e2['rank'], 'px': []}
                edges = [e for k, e in enumerate(edges) if k not in es] + [merged]
                done = True
                break
            if not done: break

    # ── smooth: resample at 2.5 m, moving average, ends pinned to their nodes ──
    def resample(P, step=2.5):
        d = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
        if d[-1] < step: return P
        s = np.linspace(0, d[-1], max(2, int(d[-1] / step) + 1))
        return np.stack([np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])], 1)
    for e in edges:
        P = resample(e['xz'])
        w = int(SMOOTH_M / 2.5) | 1
        if len(P) > w + 2:
            pad = np.vstack([np.repeat(P[:1], w // 2, 0), P, np.repeat(P[-1:], w // 2, 0)])
            k = np.ones(w) / w
            S = np.stack([np.convolve(pad[:, 0], k, 'valid'), np.convolve(pad[:, 1], k, 'valid')], 1)
            # fade the smoothing to zero at the ends so the edge still lands on its node
            t = np.minimum(np.arange(len(P)), np.arange(len(P))[::-1]) / (w / 2)
            t = np.clip(t, 0, 1)[:, None]
            P = P * (1 - t) + S * t
        e['xz'] = P
    edges = [e for e in edges if len(e['xz']) >= 2 and length(e) > 0.5]

    # ── every town on a road gets a SQUARE, on the road at the point nearest the place (split the edge there).
    # Roads usually pass a town as a plain bend, so without this a town is just a label beside the tarmac. ──
    squares = {}
    for p in places:
        if p['kind'] not in SQUARE_R: continue
        R = SQUARE_R[p['kind']]
        best = (1e9, None, None)
        for k, e in enumerate(edges):
            dd = np.hypot(e['xz'][:, 0] - p['x'], e['xz'][:, 1] - p['z']); i = int(dd.argmin())
            if dd[i] < best[0]: best = (float(dd[i]), k, i)
        if best[1] is None: continue
        _, k, i = best; e = edges[k]; P = e['xz']
        at_end = i in (0, len(P) - 1)
        if best[0] > R + (90 if at_end else 40): continue      # a road that stops short of its town still reaches it
        dmin, nid = min((math.hypot(nodes[e[s_]]['x'] - P[i][0], nodes[e[s_]]['z'] - P[i][1]), e[s_]) for s_ in ('a', 'b'))
        if dmin < R * 0.6 or i == 0 or i == len(P) - 1:
            squares[nid] = p; continue
        nodes.append({'x': float(P[i][0]), 'z': float(P[i][1]), 'px': []}); nid = len(nodes) - 1
        edges = edges[:k] + edges[k + 1:] + [{'a': e['a'], 'b': nid, 'xz': P[:i + 1], 'rank': e['rank']},
                                             {'a': nid, 'b': e['b'], 'xz': P[i:], 'rank': e['rank']}]
        squares[nid] = p

    # ── OVER-ROUTES (the pass over the Passage, 11-14): a road on its own grade, so where it crosses another road in plan
    # (over a bore's roof) nothing joins. It meets the graph only at its two ends, at the nearest live node. ──
    live = {e['a'] for e in edges} | {e['b'] for e in edges}
    for r in over:
        P = np.asarray(r['xz'], float)
        ends = []
        for q in (P[0], P[-1]):
            d, nid = min((math.hypot(nodes[k]['x'] - q[0], nodes[k]['z'] - q[1]), k) for k in live)
            ends.append(nid if d < 40 else None)
        if None in ends or ends[0] == ends[1]:
            print(f"over-route {r['id']}: an end is not within 40 m of a junction, skipped"); continue
        P = np.vstack([[[nodes[ends[0]]['x'], nodes[ends[0]]['z']]], P[1:-1], [[nodes[ends[1]]['x'], nodes[ends[1]]['z']]]])
        edges.append({'a': ends[0], 'b': ends[1], 'xz': resample(P), 'rank': RANK.get(r['kind'], 2), 'over': True})

    # ── classify junctions ──
    degc = np.zeros(len(nodes), int)
    for e in edges: degc[e['a']] += 1; degc[e['b']] += 1
    used = sorted({e['a'] for e in edges} | {e['b'] for e in edges})
    remap = {old: k for k, old in enumerate(used)}
    junctions = []
    for old in used:
        n_ = nodes[old]
        arms = []
        for k, e in enumerate(edges):
            for end, P in ((e['a'], e['xz']), (e['b'], e['xz'][::-1])):
                if end != old: continue
                d = np.cumsum(np.concatenate([[0], np.hypot(*np.diff(P, axis=0).T)]))
                q = P[min(len(P) - 1, int(np.searchsorted(d, 15.0)))]
                arms.append({'edge': k, 'kind': KIND[e['rank']], 'ang': math.atan2(q[1] - P[0][1], q[0] - P[0][0])})
        ranks = sorted((RANK[a['kind']] for a in arms), reverse=True)
        hw = max(WIDTH[a['kind']] for a in arms) / 2 if arms else 6.0
        inside = [(math.hypot(nodes[q]['x'] - n_['x'], nodes[q]['z'] - n_['z']), q) for q in squares if q != old]
        inside = [t for t in inside if t[0] < SQUARE_R[squares[t[1]]['kind']] + 6]
        kind, r = 'end', 0.0
        if old in squares:
            kind, r = 'square', SQUARE_R[squares[old]['kind']]
        elif inside:
            kind, r = 'in-square', 0.0          # under a square's paving: the square is the junction
        elif len(arms) == 1: kind, r = 'end', 0.0
        elif len(arms) == 2: kind, r = 'bend', 0.0
        elif len(arms) >= 5 or ranks[:3] == [4, 4, 4]: kind, r = 'roundabout', ROUNDABOUT_R
        elif len(arms) == 4: kind, r = ('cross' if ranks[1] > ranks[2] else 'stop4'), hw + 7
        else:
            angs = sorted(a['ang'] for a in arms)
            gaps = [(angs[(k + 1) % 3] - angs[k]) % (2 * math.pi) for k in range(3)]
            kind = 'merge' if min(gaps) < math.radians(40) else 'tee'
            r = hw + (3 if kind == 'merge' else 5)
        j = {'id': f'j{remap[old]}', 'kind': kind, 'x': round(n_['x'], 1), 'z': round(n_['z'], 1), 'r': r, 'arms': arms}
        for o in overrides:
            if kind not in ('end', 'bend', 'in-square', 'square') and math.hypot(o['x'] - n_['x'], o['z'] - n_['z']) < 60:
                kind = o['kind']; r = ROUNDABOUT_R if kind == 'roundabout' else hw + (7 if kind in ('stop4', 'cross') else 5)
                j['kind'], j['r'], j['override'] = kind, r, True
        if kind == 'roundabout': j['island'] = ISLAND_R
        if kind == 'square': j['place'] = squares[old]['id']
        junctions.append(j)
    out_edges = []
    for k, e in enumerate(edges):
        out_edges.append({'id': f'e{k}', 'kind': KIND[e['rank']], 'a': f'j{remap[e["a"]]}', 'b': f'j{remap[e["b"]]}', 'xz': e['xz'],
                          **({'over': True} if e.get('over') else {})})
    return {'edges': out_edges, 'junctions': junctions}
