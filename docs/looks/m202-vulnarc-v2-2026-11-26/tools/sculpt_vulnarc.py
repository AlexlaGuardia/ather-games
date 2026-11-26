"""M202 v2: VULNARC (Vulnyx's Storm second form) as HER OWN CREATURE, not the Vulnyx body recoloured (Alex 11-26: "this first
evolution is its own new creature and should introduce the element"). Built from the LOCKED art
/root/athernyx/assets/stage2/011-vulnarc.png (grimoire-ledger #11, LOCKED v2) and canon (spirits-species.md, Second Form:
Storm = "Crackling energy, electrical traces", "Fiercer, more dynamic"; shimmer-master.md: her move is Bolt, a speed strike).
Storm is in the anatomy, not painted on.
    python sculpt_vulnarc.py <out.glb> [tris]      (numpy, scipy, trimesh, fast_simplification)
What the picture shows -> what this body carries as SHAPE:
  - a blue coat crazed all over with pale crackle lines       -> a coat of crackled PLATES: each plate swells, every seam is a
                                                                  groove cut into the mesh and lit pale (the storm IS her coat)
  - jagged spikes of fur standing on the crown                -> a jagged crest of fur spikes on the crown
  - sharp cheek fur sweeping back, two and three points        -> extra cheek spikes: a wider, sharper face fringe
  - a big white ruff falling in jagged points                  -> a deep spiked ruff, points hanging down the chest
  - a tail with a sawtooth edge, carried up behind her        -> a brush with sawtooth points on both edges
  - big ears, pink inside, white fur at the root               -> ears a touch taller and splayed wider
  - strong legs and BIG paws, weight forward, mid-step         -> heavier forelegs, big paws, the chest carried low and forward
  - a violet bolt on the brow                                  -> the bolt plate, proud of the brow (sculpt_forms eyes)
  - the Vulnyx head and face                                   -> kept (her line)
Where the art is silent (each makes her MORE her own creature; listed in the README): the crest runs on from the crown down the
neck and along the spine as a zigzag (a lightning line down her back); the brush is kinked like a bolt (straight runs, hard corners)
rather than a soft curve; the trunk slopes forward (rump high, chest low: a sprinter set to strike, canon's Bolt); the plates keep
off her white parts."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools')); sys.path.insert(0, os.path.join(HERE, '../../m202-vulnyx-2026-11-26/tools'))
import sculpt_v2 as S
import sculpt_forms as SF
V3, su, ss, ell, cone, rx, zig = S.V3, S.su, S.ss, S.ell, S.cone, S.rx, S.zig
C = SF.C

# ── her ears: a touch taller, splayed wider (S.ear / S.classes read these module globals) ──
S.EAR_A = V3(.134, .655, .224); S.EAR_T = V3(.250, 1.010, .150)

# ── landmarks (rig_vulnarc.py reads these): rump high, chest low and forward ──
L = dict(head=(0, .565, .255), chest=(0, .375, .13), pelvis=(0, .415, -.17),
         f=[(.086, .365, .150), (.090, .200, .142), (.092, .050, .168)],                       # shoulder, elbow, paw
         h=[(.082, .400, -.180), (.100, .255, -.100), (.096, .130, -.235), (.096, .042, -.205)],  # hip, knee, hock, paw
         # the bolt: straight runs, hard corners
         tail=[(0, .43, -.24), (0, .50, -.33), (0, .68, -.42), (0, .56, -.60), (0, .84, -.71), (0, .89, -.92)],
         tailr=[.050, .080, .094, .088, .070, .006])
def polyline(pts, rs, n=6):
    out = []
    for i in range(len(pts) - 1):
        for t in np.arange(n) / n: out.append((*(np.array(pts[i]) * (1 - t) + np.array(pts[i + 1]) * t), rs[i] * (1 - t) + rs[i + 1] * t))
    return np.array(out + [(*pts[-1], rs[-1])])
S.TC = polyline(L['tail'], L['tailr']); TC = S.TC

def tail(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b in zip(TC[:-1], TC[1:]): d = np.minimum(d, cone(P, a[:3], b[:3], a[3], b[3]))
    # sawtooth: sharp points swept back off both edges and the flanks of the brush
    for u in np.linspace(.18, .86, 10):
        i = int(u * (len(TC) - 1)); c, r = TC[i, :3], TC[i, 3]; t = TC[min(i + 2, len(TC) - 1), :3] - TC[max(i - 2, 0), :3]; t /= np.linalg.norm(t)
        up = np.cross(t, V3(1, 0, 0)); up = -up if up[1] < 0 else up
        for n, w in ((up, 1.), (-up, .85), (up * .4 + V3(.92, 0, 0), .7), (up * .4 - V3(.92, 0, 0), .7)):
            n = n / np.linalg.norm(n); ln = (.055 + .05 * np.sin(np.pi * u)) * w
            d = su(d, cone(P, c + n * r * .55, c + n * (r + ln * .55) + t * ln, r * .40, .003), .012)
    return d

def _surf(field, p, dirn, n=60):
    p = V3(*p).astype(float); dirn = V3(*dirn) / np.linalg.norm(dirn)
    for _ in range(n): p = p - dirn * np.clip(field(p[None])[0], -.02, .02) * .8
    return p

def legs(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); f, h = L['f'], L['h']
    d = cone(M, f[0], f[1], .078, .050); d = su(d, cone(M, f[1], f[2], .050, .045), .03)           # strong forelegs
    d = su(d, ell(M, (.092, .036, .186), (.058, .036, .070)), .03)                                # BIG paws (the art's)
    for x in (-.030, 0, .030): d = su(d, ell(M, (.092 + x, .026, .240), (.019, .026, .024)), .012)
    t = ell(M, (.086, .350, -.180), (.072, .122, .112), rx(-.30))                                 # a sprinter's haunch
    t = su(t, cone(M, h[0], h[1], .086, .056), .05)
    t = su(t, cone(M, h[1], h[2], .054, .040), .04); t = su(t, cone(M, h[2], h[3], .040, .040), .03)
    t = su(t, ell(M, (.096, .034, -.180), (.054, .034, .066)), .03)
    for x in (-.028, 0, .028): t = su(t, ell(M, (.096 + x, .025, -.128), (.018, .025, .022)), .012)
    return d, t

RUFF = [(0, .40, .205, 0, .215, .262, .062), (.052, .41, .19, .074, .245, .248, .054), (.026, .36, .215, .030, .190, .245, .050),
        (.094, .42, .150, .140, .300, .198, .046), (.030, .40, .22, .046, .232, .276, .050), (.078, .38, .185, .108, .228, .224, .046),
        (.112, .44, .110, .168, .350, .140, .040), (0, .44, .215, 0, .290, .300, .048)]
def ruff(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); d = np.full(P.shape[:-1], 9.)
    for x, y, z, tx, ty, tz, r in RUFF: d = su(d, cone(M, (x, y, z), (tx, ty, tz), r, .003), .018)        # jagged points, sharper than the Vulnyx's
    return d

def cheeks(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = cone(M, (.13, .585, .235), (.300, .605, .150), .052, .003)                                # a third, upper point
    return su(d, cone(M, (.12, .50, .245), (.262, .432, .175), .048, .003), .02)                  # and a low one

def body(P):
    b = cone(P, (0, .385, .115), (0, .415, -.170), .110, .092)                                  # trunk sloping down to the chest
    b = su(b, ell(P, (0, .370, .140), (.110, .135, .108)), .05)                                 # deep chest, carried low
    b = ss(b, ell(P, (0, .240, -.060), (.3, .090, .14)), .07)                                   # the belly tucked up
    b = su(b, cone(P, (0, .43, .17), (0, .535, .228), .094, .090), .06)                         # neck, reaching forward
    f, h = legs(P); b = su(b, f, .045); b = su(b, h, .05); b = su(b, ruff(P), .022)
    return su(su(b, tail(P), .030), su(S.head(P), cheeks(P), .025), .03)

# the crest: fur spikes on the crown, then a zigzag line of them down the neck and spine
CREST_Z = [(.262, .130, 0), (.205, .150, .3), (.150, .140, -.3), (.095, .125, .3), (.040, .110, -.3), (-.015, .095, .3), (-.070, .080, -.3), (-.125, .060, .3)]
def _crest():
    out = []
    for z, ln, sx in CREST_Z:
        p = _surf(body, (0, 1.2, z), (0, 1, 0)); dr = V3(sx * .35, 1, -.55); dr /= np.linalg.norm(dr); out.append((p - dr * .015, p + dr * ln, .026 if z > .1 else .030))
    return out
CREST = _crest()
def crest(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b, r in CREST: d = su(d, cone(P, a, b, r, .003), .006)
    return d

def field(P): return su(body(P), crest(P), .010)

# ── the crackle: a Voronoi of plates over the coat (seeded off the mesh itself, so the cells sit on the skin) ──
def plates(V, spacing=.058, seed=11):
    rng = np.random.default_rng(seed); order = rng.permutation(len(V)); seeds = []
    for i in order:
        p = V[i]
        if not seeds or np.min(np.linalg.norm(np.array(seeds) - p, axis=1)) > spacing: seeds.append(p)
    return np.array(seeds)
SEEDS = None
def gap(V):
    """F2 - F1: 0 on a seam, growing toward a plate's middle"""
    d = np.sqrt(((V[:, None] - SEEDS[None]) ** 2).sum(-1)); d.sort(1); return d[:, 1] - d[:, 0]

PAL = dict(lo='#3c6aa6', hi='#8ebae4', mid='#e6f0fa', cream='#f6fafd', tip='#f4f8fc', ear='#e6a8a4', dark='#1c2030')
SEAM_W = .0085
def classes(V):
    base = S.classes(V); x, y, z = V.T
    d = ((V[:, None] - TC[None, :, :3]) ** 2).sum(-1); i = d.argmin(1); s = i / (len(TC) - 1.); ang = np.arctan2(x, (y - TC[i, 1]) + (z - TC[i, 2]) * .4)
    base[3] = np.where(z < -.5, (s - .74) - .07 * zig(ang / (2 * np.pi) + .5, 9), -1.) * .5                              # a white tip, ragged
    seam = SEAM_W - gap(V)                                                                                               # 0 pale seams (under the whites)
    rf = .004 - ruff(V)                                                                                                   # white ruff points
    return [seam] + base + [rf]
def palette():
    return [C('#dff7ff'), C(PAL['mid']), C(PAL['cream']), C(PAL['cream']), C(PAL['tip']), C(PAL['ear']), C(PAL['cream']), C(PAL['dark']), C(PAL['cream'])]
WHITE = (1, 2, 3, 4, 5, 6, 8)

def finish(V, Fa, path, eye):
    """SF.finish, plus the plate relief: each plate swells, each seam sinks (a real groove, its edge already cut into the mesh)"""
    global SEEDS
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0)
    SEEDS = plates(V)
    pal = palette(); lab = np.full(len(Fa), -1); cls = None
    for k in range(len(pal)):
        V, Fa, lab, side = S.cut(V, Fa, lab, classes(V)[k]); lab = np.where(side, k, lab)
    N = np.stack([field(V + np.eye(3)[i] * .0035) - field(V - np.eye(3)[i] * .0035) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    white = np.zeros(len(V), bool); np.logical_or.at(white, Fa[np.isin(lab, WHITE)].ravel(), True)
    face = (V[:, 2] > .12) & (V[:, 1] > .44)                                                                             # the eye / brow patches sit on the head: keep it smooth
    g = gap(V); h = np.where(g < SEAM_W * .5, -.0030, .0040 * np.clip((g - SEAM_W * .5) / .030, 0, 1) ** .7)
    h = np.where(white | face, 0, h) * np.clip((V[:, 1] - .012) / .03, 0, 1)                                            # and soles stay flat
    V = V + N * h[:, None]
    Nm = S.normals(V, Fa); N = np.where((h != 0)[:, None], Nm * .65 + N * .35, N); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(PAL['lo']) * (1 - sh[g]) + C(PAL['hi']) * sh[g]
    S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=eye)); print('vulnarc body tris', len(FF), 'verts', len(VV), 'seeds', len(SEEDS))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else 7600
    import trimesh
    from marching import surface
    def decimate(V, F, n):
        """S.decimate, but a pinch (an edge four faces share, where two thin crystal faces kiss) is allowed; an open edge is not"""
        import fast_simplification as fs
        best = None
        for agg in (3, 4, 5, 6):
            for k in (1, .95, 1.05, .9, 1.1):
                v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=int(n * k), agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices()
                c = np.unique(t.edges_sorted, axis=0, return_counts=True)[1]
                if t.body_count == 1 and (c % 2).sum() == 0 and len(t.faces) < n * 1.4:
                    p = int((c > 2).sum()); best = min(best or (9e9, None), (p, id(t), t), key=lambda x: x[0]) if best else (p, id(t), t)
                    if p == 0: return t
        if best is None: raise SystemExit('no closed decimation')
        print('pinched edges', best[0]); return best[2]
    S.decimate = decimate
    S.field = field; SF.F = dict(SF.FORMS['storm'], form='storm', **{k: PAL[k] for k in ('lo', 'hi')})
    lo, hi, h = V3(-.47, -.033, -1.10), V3(.47, 1.12, .40 + .16), .0068
    Vr, Fr = surface(field, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
    k = max(m.split(only_watertight=False), key=lambda c: len(c.faces)); t = S.decimate(k.vertices, k.faces, TRIS)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    eV, eF, eC = SF.eyes(); finish(np.array(t.vertices), np.array(t.faces), OUT, (eV, eF, eC, S.normals(eV, eF)))
