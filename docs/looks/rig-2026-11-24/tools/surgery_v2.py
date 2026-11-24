"""M132 s1b, the Manalotl's tail (a COPY; the live glb is only read): cut the fused tail off her left flank, close the flank
with a patch that keeps the skin's own curvature (biharmonic), grow the tail again from the middle of the rump, straight back,
with the sculpted tail's own section radii and colour, and sew it to the skin. The frill island on her back becomes skin.
Returns parts like rigcore.Glb.meshes() plus info. Runs in Blender's python (bmesh does the triangulating)."""
import numpy as np, bmesh
from mathutils import Vector
CL = np.array([(.385, .075, -.34), (.41, .08, -.24), (.45, .085, -.12), (.485, .085, 0), (.515, .085, .1), (.535, .08, .2), (.53, .07, .3), (.52, .055, .42), (.49, .06, .52), (.45, .06, .66)])
CR = np.array([.07, .085, .098, .10, .10, .10, .10, .10, .10, .10])
def seg(V, P, R):
    """distance to a polyline, minus its radius"""
    best = np.full(len(V), 9.)
    for a, b, ra, rb in zip(P, P[1:], R, R[1:]):
        t = np.clip(((V - a) @ (b - a)) / ((b - a) @ (b - a)), 0, 1); best = np.minimum(best, np.linalg.norm(V - a - t[:, None] * (b - a), axis=1) - ra - t * (rb - ra))
    return best
def is_tail(V):
    leg = (V[:, 2] > -.09) & (V[:, 2] < .2) & (V[:, 0] < np.where(V[:, 1] < .118, .383, .445))
    return (seg(V, CL, CR) < 0) & ~leg
# the new tail: ring centres along z (glb units), straight back, dipping a little; sculpted radii (half widths read off the sculpt)
ROOT, LEN = np.array([.10, .19, -.60]), .88
S = np.array([0, .12, .24, .36, .48, .60, .70, .80, .88, .95, 1.])
RX = np.array([.125, .100, .085, .076, .070, .066, .061, .053, .042, .026, .004]); RY = RX * np.array([.95, .97, 1, 1, 1, 1, 1, .98, .95, .95, 1])
def axis(s): return ROOT + np.array([0, -.035 * s, -LEN * s])

def solve(free, fixed, val, E, order, w=None):
    """harmonic (1) / biharmonic (2) values on `free` verts with the rest held"""
    ids = {v: i for i, v in enumerate(free + fixed)}; n = len(ids); Lp = np.zeros((n, n))
    for a, b in E:
        if a in ids and b in ids: i, j = ids[a], ids[b]; Lp[i, j] -= 1; Lp[j, i] -= 1; Lp[i, i] += 1; Lp[j, j] += 1
    Lp /= np.maximum(np.diag(Lp), 1)[:, None]
    M = Lp.T @ Lp if order == 2 else Lp; k = len(free)
    return np.linalg.solve(M[:k, :k], -M[:k, k:] @ val[fixed])
def ring_out(bm, seed, n):
    out = set(seed); cur = set(seed)
    for _ in range(n): cur = {e.other_vert(v) for v in cur for e in v.link_edges} - out; out |= cur
    return out
def relax(bm, free, rings=2, it=3):
    """biharmonic positions for `free`, so the patch leaves the rim in the skin's own direction"""
    bm.verts.index_update(); bm.verts.ensure_lookup_table()
    fi = sorted(v.index for v in free); fx = sorted(v.index for v in ring_out(bm, free, rings) if v not in free); s = set(fi) | set(fx)
    E = [(e.verts[0].index, e.verts[1].index) for e in bm.edges if e.verts[0].index in s and e.verts[1].index in s]
    val = np.array([v.co for v in bm.verts]); X = solve(fi, fx, val, E, 2)
    for i, x in zip(fi, X): bm.verts[i].co = Vector(x)
def loops(bm):
    be = [e for e in bm.edges if e.is_boundary]; seen, out = set(), []
    for e in be:
        if e in seen: continue
        st, comp = [e], []
        while st:
            x = st.pop()
            if x in seen: continue
            seen.add(x); comp.append(x); st += [f for v in x.verts for f in v.link_edges if f.is_boundary and f not in seen]
        out.append(comp)
    return out
def operate(live, log=print):
    B, FR = live['body'], live['frills']; V, F = B['POSITION'].astype(float), B['F']
    cut = is_tail(V); rump = (np.hypot((V[:, 0] - ROOT[0]) / 1.25, V[:, 1] - ROOT[1] + .005) < .150) & (V[:, 2] < -.42)
    tail_col = B['COLOR_0'][cut & (V[:, 2] > .12)]; tz = V[cut & (V[:, 2] > .12), 2]
    # the frill mesh's island on her back (no frill is behind z = 0)
    fv = FR['POSITION']; isl = fv[:, 2] < 0
    bm = bmesh.new(); lay = bm.verts.layers.int.new('src'); vs = []
    for i, p in enumerate(V): v = bm.verts.new(p); v[lay] = i; vs.append(v)
    for t in F:
        try: bm.faces.new([vs[i] for i in t])
        except ValueError: log('dup face', t)
    old_loops = {frozenset(v[lay] for e in l for v in e.verts) for l in loops(bm)}
    iv = {}
    for i in np.where(isl)[0]:
        d = ((V - fv[i]) ** 2).sum(1); k = d.argmin()
        iv[i] = vs[k] if d[k] < 1e-8 else bm.verts.new(fv[i])
        if d[k] >= 1e-8: iv[i][lay] = -2
    for t in FR['F']:
        if isl[t].all(): bm.faces.new([iv[i] for i in t])
    log('island verts', int(isl.sum()), 'welded', sum(d[lay] >= 0 for d in iv.values()))
    island = {v for v in iv.values()}
    bmesh.ops.delete(bm, geom=[vs[i] for i in np.where(cut)[0]], context='VERTS')
    bmesh.ops.delete(bm, geom=[v for v in vs if v.is_valid and rump[v[lay]]] , context='VERTS')
    # crumbs the cut leaves hanging: keep the largest piece; drop verts on a rim held by one face only
    def tidy():
        for _ in range(6):
            bad = [v for v in bm.verts if v.is_boundary and len(v.link_faces) == 1 and v.co.y < .3 and (v.co.x > .3 or v.co.z < -.4)] + [v for v in bm.verts if not v.link_faces]
            if not bad: return
            bmesh.ops.delete(bm, geom=bad, context='VERTS')
    tidy()
    left, best = set(bm.verts), set()
    while left:
        c = ring_out(bm, [next(iter(left))], 400); left -= c; best = max(best, c, key=len)
    drop = [v for v in bm.verts if v not in best]; log('crumbs dropped', len(drop)); bmesh.ops.delete(bm, geom=drop, context='VERTS'); tidy()
    news = [l for l in loops(bm) if frozenset(v[lay] for e in l for v in e.verts) not in old_loops]
    for l in news: c = np.mean([v.co for e in l for v in e.verts], 0); log('new loop', len(l), c.round(2))
    return bm, lay, news, island, (tail_col, tz)
def ordered(l):
    """a boundary component as simple cycles (a pinched rim is several)"""
    nb, out = {}, []
    for e in l:
        a, b = e.verts; nb.setdefault(a, []).append(b); nb.setdefault(b, []).append(a)
    while any(nb.values()):
        s = next(v for v in nb if len(nb[v]) == 2) if any(len(x) == 2 for x in nb.values()) else next(v for v in nb if nb[v]); st = [s]
        while True:
            c = st[-1]; n = nb[c].pop(); nb[n].remove(c)
            if n in st:
                k = st.index(n); out.append(st[k:]); st = st[:k + 1]
                if not nb[n]: break
                if k == 0 and not nb[n]: break
            else: st.append(n)
    return sorted(out, key=len, reverse=True)
def fill_min(bm, lp):
    """smallest-area triangulation of a loop"""
    P = np.array([v.co for v in lp]); n = len(P); W = np.zeros((n, n)); K = np.zeros((n, n), int)
    for g in range(2, n):
        for i in range(n - g):
            j = i + g; k = np.arange(i + 1, j); c = W[i, k] + W[k, j] + np.linalg.norm(np.cross(P[k] - P[i], P[j] - P[i]), axis=1); b = c.argmin(); W[i, j], K[i, j] = c[b], k[b]
    st, fs = [(0, n - 1)], []
    while st:
        i, j = st.pop()
        if j - i < 2: continue
        k = K[i, j]; fs.append(bm.faces.new((lp[i], lp[k], lp[j]))); st += [(i, k), (k, j)]
    return fs
def refine(bm, faces, size, rim):
    """split the patch's long inner edges and flip for good triangles (plain index lists; bmesh's own beautify drops verts);
    returns (faces, the new inner verts)"""
    pt = list({v for f in faces for v in f.verts}); ix = {v: i for i, v in enumerate(pt)}; X = [np.array(v.co) for v in pt]; T = {tuple(ix[v] for v in f.verts) for f in faces}; nr = len(pt)
    out = {frozenset((ix[a], ix[b])) for a in pt for b in (e.other_vert(a) for e in a.link_edges) if b in ix}
    bmesh.ops.delete(bm, geom=list(faces), context='FACES_ONLY')
    for e in {e for v in pt for e in v.link_edges if not e.link_faces}: bm.edges.remove(e)
    live = {frozenset((ix[e.verts[0]], ix[e.verts[1]])) for v in pt for e in v.link_edges if e.verts[0] in ix and e.verts[1] in ix}
    def em():
        m = {}
        for t in T:
            for k in range(3): m.setdefault(frozenset((t[k], t[(k + 1) % 3])), []).append(t)
        return m
    def ang(a, b, c): u, v = X[a] - X[b], X[c] - X[b]; return np.arccos(np.clip(u @ v / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-12), -1, 1))
    def opp(t, e): return next(x for x in t if x not in e)
    def sub(t, o, n): return tuple(n if x == o else x for x in t)
    for rnd in range(7):
        m = em(); L = sorted(((np.linalg.norm(X[min(e)] - X[max(e)]), tuple(sorted(e))) for e, t in m.items() if len(t) == 2), reverse=True); hit = set(); did = False
        for l, (a, b) in L:
            if l < size * 1.4: break
            ts = m[frozenset((a, b))]
            if any(t in hit for t in ts): continue
            hit |= set(ts); n = len(X); X.append((X[a] + X[b]) / 2); did = True
            for t in ts: T.discard(t); T |= {sub(t, a, n), sub(t, b, n)}
        for _ in range(30):
            fl = False; m = em(); hit = set()
            for e, ts in m.items():
                if len(ts) != 2 or ts[0] in hit or ts[1] in hit: continue
                a, b = sorted(e); c, d = opp(ts[0], e), opp(ts[1], e)
                if c == d or frozenset((c, d)) in m or frozenset((c, d)) in live: continue
                if ang(a, c, b) + ang(a, d, b) > np.pi + .02:
                    # keep the winding of ts[0]
                    k = ts[0].index(a); fw = ts[0][(k + 1) % 3] == b
                    T -= set(ts); T |= {(a, d, c), (d, b, c)} if fw else {(d, a, c), (b, d, c)}; hit |= set(ts); fl = True
            if not fl: break
        nb = {}
        for e in em(): a, b = e; nb.setdefault(a, []).append(b); nb.setdefault(b, []).append(a)
        for _ in range(12):
            for i in range(nr, len(X)): X[i] = X[i] * .4 + .6 * np.mean([X[j] for j in nb[i]], 0)
        if not did: break
    vs = pt + [bm.verts.new(x) for x in X[nr:]]
    fs = [bm.faces.new([vs[i] for i in t]) for t in T]
    return fs, set(vs[nr:])
def run(live, log=print):
    bm, lay, news, island, (tc, tz) = operate(live, log); B = live['body']
    news.sort(key=lambda l: np.mean([v.co.z for e in l for v in e.verts])); rl, fl = news[0], [e for l in news[1:] for e in l]
    # ── flank ──
    inner, lp = set(), []
    for c in ordered(fl):
        log('flank cycle', len(c), np.mean([v.co for v in c], 0).round(2)); lp += c
        if len(c) > 2: inner |= refine(bm, fill_min(bm, c), .055, c)[1]
    relax(bm, inner | {v for v in lp if v.co.x > .34 and v.co.z < -.05}, 2); flank = set(inner) | set(lp)
    # ── tail ──
    N = 16; rings = []
    for s in np.linspace(0, 1, 19)[:-1]:
        c = axis(s); rx_, ry_ = np.interp(s, S, RX), np.interp(s, S, RY)
        rings.append([bm.verts.new(c + np.array([rx_ * np.cos(t), ry_ * np.sin(t), 0])) for t in np.linspace(0, 2 * np.pi, N, endpoint=False)])
    for v in rings[0]: v.co.z = v.co.z - .045
    tip = bm.verts.new(axis(1.0)); tf = []
    for a, b in zip(rings, rings[1:]):
        for i in range(N): j = (i + 1) % N; tf.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    for i in range(N): tf.append(bm.faces.new((rings[-1][i], rings[-1][(i + 1) % N], tip)))
    r0 = [e for e in bm.edges if e.is_boundary and e.verts[0] in rings[0] and e.verts[1] in rings[0]]
    rim = ordered(rl)[0]; before = set(bm.faces)
    bmesh.ops.bridge_loops(bm, edges=rl + r0); bf = [f for f in bm.faces if f not in before]
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3]); bf = [f for f in bm.faces if all(v in rim or v in rings[0] for v in f.verts) and any(v in rings[0] for v in f.verts) and any(v in rim for v in f.verts)]
    _, binn = refine(bm, bf, .06, set(rim) | set(rings[0]))
    relax(bm, binn | set(rim) | set(rings[0]) | set(rings[1]), 2)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.normal_update(); bm.verts.index_update(); bm.verts.ensure_lookup_table(); tailv = [v for r in rings for v in r] + [tip]
    fresh = {v for v in bm.verts if v in binn or v in flank or v in tailv or v in set(rim) or v in island}; touched = ring_out(bm, fresh, 2)
    # colour: old verts keep theirs; the tail takes the sculpted tail's by distance to the tip; patches are harmonic between
    n = len(bm.verts); C = np.zeros((n, 4)); idx = {}; known = set()
    tset = set(tailv); old = {v for v in bm.verts if v not in binn and v not in inner and v not in tset and v not in island}
    soft = {v for v in island} | ring_out(bm, island, 1)
    for v in old: C[v.index] = B['COLOR_0'][v[lay]]
    for k, r in enumerate(rings):
        s = k / 18; z = np.interp(s, [0, .3, 1], [.14, .18, tz.max()]); w = np.exp(-((tz - z) / .05) ** 2) + 1e-9; c = (tc * w[:, None]).sum(0) / w.sum()
        for v in r: C[v.index] = c
    C[tip.index] = tc[tz.argmax()]
    free = [v.index for v in bm.verts if v in binn or v in inner or v in soft or v in rings[0] or v in rings[1] or v in rings[2]]; s = set(free); fx = [i for i in range(n) if i not in s]
    E = [(e.verts[0].index, e.verts[1].index) for e in bm.edges]; s2 = set(free) | {a if b in s else b for a, b in E if a in s or b in s}
    C[free] = solve(free, sorted(s2 - s), C, [(a, b) for a, b in E if a in s2 and b in s2], 1)
    P = np.array([v.co for v in bm.verts], np.float32); Nn = np.array([v.normal for v in bm.verts], np.float32)
    for v in old - touched: Nn[v.index] = B['NORMAL'][v[lay]]
    faces = np.array([[v.index for v in f.verts] for f in bm.faces])
    # recalc may flip the open shell; the live winding wins
    o = next(f for f in bm.faces if all(v in old - touched for v in f.verts)); t = [v[lay] for v in o.verts]; cyc = {tuple(np.roll(x, k)) for x in B['F'] for k in range(3)}
    if tuple(t) not in cyc: faces = faces[:, ::-1]; log('winding flipped'); 
    src = np.array([v[lay] if v in old else -1 for v in bm.verts])
    body = dict(POSITION=P, NORMAL=Nn, COLOR_0=np.clip(np.round(C), 0, 255).astype(np.uint8), F=faces)
    fv = live['frills']['POSITION']; keep = fv[:, 2] >= 0; mp = np.cumsum(keep) - 1; fr = {k: v[keep] for k, v in live['frills'].items() if k != 'F'}; fr['F'] = mp[live['frills']['F'][keep[live['frills']['F']].all(1)]]
    tagv = np.zeros(n, int); log('flank', len(flank), len(inner), len(lp), 'binn', len(binn))
    for v in binn | set(rim): tagv[v.index] = 2
    for v in tailv: tagv[v.index] = 3
    for v in flank: tagv[v.index] = 1
    return dict(body=body, frills=fr, eyes=live['eyes']), dict(src=src, tag=tagv)
