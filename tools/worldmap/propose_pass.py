"""Propose the PASS ROAD over a bore (canon 11-14, Magii f34f33b: "a pass road over the top, wild and unpaved; bore =
safe, pass = fast-and-pretty"). geography.md frames it as "risk the pass or take the long way", so the pass is the SHORT
way: it climbs straight over the spine and crosses the bore's roof where the rock is thick, on its own grade (an
over-route in road_network.py: no junction where it passes over the tunnel in plan).

How: cheapest path on the 10 m source grid between the bore road's two end junctions. A move steeper than GMAX is
expensive (it will be a cutting: the exporter carves every bed to grade) and past GHARD forbidden, so the climb
switchbacks instead of going straight up, and a hairpin on a steep flank is a cut platform, as real ones are. Banned: water, other roads
(except at the two ends) and the bore's line wherever the roof is thinner than MIN_COVER (the mouths and their
cuttings). Then simplified and Chaikin-rounded so the bends drive, and written to passes.json as source px.

Run (after an export, it reads the exported network): python3 tools/worldmap/propose_pass.py <height.npy> <region.json>
"""
import sys, os, json, math, heapq, numpy as np
from scipy import ndimage as nd
from scipy.spatial import cKDTree

GMAX, GHARD, MIN_COVER, BAN_PX, END_PX = 0.16, 0.45, 40.0, 3.5, 2.5
H_SRC, REGION = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'passes.json')
h = nd.gaussian_filter(np.load(H_SRC).astype(float), 1.0)
m = json.load(open(REGION)); net = m['network']
x0px, y0px = m['sourcePx'][0], m['sourcePx'][1]
toPx = lambda x, z: ((x + m['sizeX'] / 2) / 10 + x0px, (z + m['sizeZ'] / 2) / 10 + y0px)
J = {j['id']: j for j in net['junctions']}

def rdp(P, eps):
    if len(P) < 3: return P
    a, b = P[0], P[-1]; ab = b - a; L = np.hypot(*ab) or 1
    d = np.abs((P[:, 0] - a[0]) * ab[1] - (P[:, 1] - a[1]) * ab[0]) / L
    i = int(np.argmax(d))
    return np.vstack([rdp(P[:i + 1], eps)[:-1], rdp(P[i:], eps)]) if d[i] > eps else np.array([a, b])

def chaikin(P, n=3):
    for _ in range(n):
        Q = [P[0]]
        for a, b in zip(P, P[1:]): Q += [a * 0.75 + b * 0.25, a * 0.25 + b * 0.75]
        P = np.array(Q + [P[-1]])
    return P

out = []
for T in net.get('tunnels', []):
    E = next(e for e in net['edges'] if e['id'] == T['edge'])
    A, B = np.array(toPx(J[E['a']]['x'], J[E['a']]['z'])), np.array(toPx(J[E['b']]['x'], J[E['b']]['z']))
    R = 100; cx, cy = (A + B) / 2; x0, y0 = int(cx - R), int(cy - R); N = 2 * R
    W = h[y0:y0 + N, x0:x0 + N]
    yy, xx = np.mgrid[0:N, 0:N]; cells = np.c_[xx.ravel() + x0, yy.ravel() + y0]
    # the bore road: banned where its roof is thin (approach, mouth, cutting); the pass may cross it over thick rock
    ep = np.array([toPx(*q[:2]) for q in E['pts']]); bp = np.array([toPx(*q[:2]) for q in T['pts']])
    kb = cKDTree(bp); db, ib = kb.query(cells)
    cover = W.ravel() - np.array(T['pts'])[ib, 2]
    de, _ = cKDTree(ep).query(cells)
    thin = (de < BAN_PX) & ~((db < BAN_PX) & (cover > MIN_COVER))
    others = np.vstack([np.array([toPx(*q[:2]) for q in e['pts']]) for e in net['edges'] if e['id'] != E['id']])
    do, _ = cKDTree(others).query(cells)
    ban = (thin | (do < BAN_PX)).reshape(N, N) | (W < 0.5)
    for P in (A, B): ban &= ~(np.hypot(xx + x0 - P[0], yy + y0 - P[1]) < END_PX)
    # HEADING-AWARE search: state = (cell, heading of 16); a step may turn at most one heading (22.5 deg) and is at
    # least 10 m long, so no bend is tighter than ~25 m and a hairpin is a real switchback, not grid jitter.
    D16 = sorted({(dx, dy) for dx in range(-2, 3) for dy in range(-2, 3) if (dx, dy) != (0, 0) and math.gcd(abs(dx), abs(dy)) == 1},
                 key=lambda v: math.atan2(v[1], v[0]))
    st, g = (int(round(A[0])) - x0, int(round(A[1])) - y0), (int(round(B[0])) - x0, int(round(B[1])) - y0)
    dist, prev, pq = {}, {}, []
    for k in range(16): dist[(st, k)] = 0.0; heapq.heappush(pq, (0.0, st, k))
    goal = None
    while pq:
        c, u, k = heapq.heappop(pq)
        if u == g: goal = (u, k); break
        if c > dist[(u, k)]: continue
        for dk in (-1, 0, 1):
            k2 = (k + dk) % 16; dx, dy = D16[k2]; v = (u[0] + dx, u[1] + dy)
            if not (0 <= v[0] < N and 0 <= v[1] < N) or ban[v[1], v[0]]: continue
            L = math.hypot(dx, dy) * 10; gr = abs(W[v[1], v[0]] - W[u[1], u[0]]) / L
            if gr > GHARD: continue
            nc = c + L * (1 + gr * 3 + max(0.0, gr - GMAX) * 60) + (2.0 if dk else 0.0)   # over GMAX = a cut
            if nc < dist.get((v, k2), 1e18): dist[(v, k2)] = nc; prev[(v, k2)] = (u, k); heapq.heappush(pq, (nc, v, k2))
    if goal is None: print(f"{T['name']}: no pass under {GMAX:.0%}"); continue
    path, cur = [], goal
    while cur in prev: path.append(cur[0]); cur = prev[cur]
    path.append(cur[0])
    P = np.array([(p[0] + x0, p[1] + y0) for p in path[::-1]], float)
    P[0], P[-1] = A, B
    P = chaikin(P, 3)
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))] * 10
    z = nd.map_coordinates(h, [P[:, 1], P[:, 0]], order=1)
    print(f"{T['name']} pass: {d[-1]:.0f} m, top {z.max():.0f} m, {len(P)} pts")
    out.append({'id': f"pass-{T['id']}", 'name': f"{T['name']} pass", 'over': T['name'], 'kind': 'pass',
                'points': [[round(float(x), 2), round(float(y), 2)] for x, y in P]})

json.dump({'note': 'Pass roads over the bores, at source px (1 px = 10 m). Generated by propose_pass.py; the line is the engineer\'s call, that a pass EXISTS is canon (Magii f34f33b).',
           'passes': out}, open(OUT, 'w'), indent=1)
print('wrote', OUT)
