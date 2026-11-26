"""M202 v3 (Alex 11-26 on v2: "lets go a bit shorter on the tail like its turning into bubbles and maybe flop the ears"):
the wave tail is SHORTER and its end BREAKS UP INTO BUBBLES (foam spheres bulging out of the tip, then a trail of loose
bubbles getting smaller and sparser along where the curl was); the ears FLOP (arch out and over from a fifth of their height
and hang down beside her head, a lop). Everything else is v2.
M202 v2: VULNIX (Vulnyx's Water second form) as HER OWN CREATURE, not the Vulnyx body recoloured (Alex 11-26: "this first
evolution is its own new creature and should introduce the element"). Built from the LOCKED art
/root/athernyx/assets/stage2/013-vulnix.png (grimoire-ledger #13, LOCKED v2) and canon (spirits-species.md, Second Form:
Water = "Flowing patterns, aquatic adaptation", "Calmer, more fluid"; shimmer-master.md: her move is Current).
Water is in the anatomy, not painted on.
    python sculpt_vulnix.py <out.glb> [tris]      (numpy, scipy, trimesh, fast_simplification)
What the picture shows -> what this body carries as SHAPE:
  - a long low aqua body stretched in a run, smooth top line  -> a LONG, slim, level trunk (pelvis set back), a long neck
  - a big tail of water licking up into flame tongues          -> a wave tail: it flows out level behind her, then rises and
                                                                  BREAKS forward into a curl, flame tongues off its outer edge
  - flowing swirl lines all over the coat                      -> current ridges: raised, pale, wavy lines running her length
  - bubble rings on the flanks and haunch                      -> bubbles as geometry: small domes standing proud of the coat
  - a small curl of fur rising off the withers                 -> a curled water fin on the withers
  - cheek fur sweeping back                                    -> cheek fur swept back in two long points (not out, as Vulnarc's)
  - big ears, peach inside                                     -> ears big, a touch taller, swept back a little
  - long slim legs, neat paws                                  -> slim legs, long paws
  - a cyan teardrop on the brow                                -> the drop gem, proud of the brow (sculpt_forms eyes)
  - the Vulnyx head and face                                   -> kept (her line)
Where the art is silent (each makes her MORE her own creature; listed in the README): webbed toes (aquatic adaptation); the
current lines also run down the brush; the paler bubble domes keep off her face; the body is carried level (calm), not sloped
(Vulnarc) or tall (Vulnara) or wide (Vulnore). The air bubbles and droplets round her are an effect (M204 s2 glow)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools')); sys.path.insert(0, os.path.join(HERE, '../../m202-vulnyx-2026-11-26/tools'))
import sculpt_v2 as S
import sculpt_forms as SF
V3, su, ss, ell, cone, rx, zig = S.V3, S.su, S.ss, S.ell, S.cone, S.rx, S.zig
C = SF.C

# ── her ears: big, a touch taller, swept back a little ──
S.EAR_A = V3(.132, .655, .222); S.EAR_T = V3(.236, 1.010, .120)
# v3: FLOPPY. Above a hinge a fifth of the way up, the ear arches out and over through EAR_BEND rad on a circle and hangs
# down beside her head. Done as a warp: unbend(P) maps the bent ear back
# onto the straight one, so the v2 ear's shape (and its pink inside) is kept, only folded.
EAR_HINGE, EAR_BEND, EAR_R = .20, 2.35, .080   # the fold: from a fifth of the way up, EAR_BEND rad round a circle of EAR_R m, then the rest hangs straight
# the floppy ear's own frame: it rises up and OUT from the root with its pink inside facing out, then arches outward over and
# hangs down beside the head (a lop): the pink inside ends up facing her cheek, the coat side shows from outside
EU = V3(.42, 1, -.06); EU = EU / np.linalg.norm(EU); EW = V3(0, 0, -1) - EU[2] * EU; EW = EW / np.linalg.norm(EW); ED = np.cross(EW, EU)
def _eframe():
    ax = S.EAR_T - S.EAR_A; ln = np.linalg.norm(ax); u = ax / ln; w = V3(1, 0, 0) - u[0] * u; w /= np.linalg.norm(w); return ln, u, w, np.cross(w, u)
def unbend(P):
    """P (any shape, x already mirrored or not): the point on the STRAIGHT ear that the floppy ear puts here"""
    ln, u, w, d = _eframe(); A = np.abs(P[..., 0]); M = np.stack([A, P[..., 1], P[..., 2]], -1); q = M - S.EAR_A
    s, x, z = q @ EU, q @ EW, q @ ED; s0 = EAR_HINGE * ln; R, th = EAR_R, EAR_BEND
    al = np.arctan2(s - s0, R - z); rho = np.hypot(s - s0, R - z); on = s > s0
    s2 = np.where(on, s0 + R * al, s); z2 = np.where(on, R - rho, z)
    es, ez, ts, tz = s0 + R * np.sin(th), R * (1 - np.cos(th)), np.cos(th), np.sin(th)        # the fold's end and the way the rest hangs
    along = (s - es) * ts + (z - ez) * tz; perp = -(s - es) * tz + (z - ez) * ts; past = on & (along > 0)
    s2 = np.where(past, s0 + R * th + along, s2); z2 = np.where(past, perp, z2)
    out = S.EAR_A + s2[..., None] * u + x[..., None] * w + z2[..., None] * d
    out[..., 0] = np.where(P[..., 0] < 0, -out[..., 0], out[..., 0]); return out
_EAR0 = S.ear
def _ear(P): return _EAR0(unbend(P))
S.ear = _ear
def ear_sdf(P): return _ear(np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1))[0]

# ── landmarks (rig_vulnix.py reads these): long and level, pelvis set back ──
L = dict(head=(0, .565, .255), chest=(0, .380, .14), pelvis=(0, .385, -.215),
         f=[(.084, .370, .150), (.086, .200, .152), (.086, .050, .172)],                        # shoulder, elbow, paw
         h=[(.080, .375, -.225), (.096, .235, -.150), (.092, .125, -.275), (.092, .042, -.250)],  # hip, knee, hock, paw
         # the wave: out level, up, then breaking forward
         # v3: the wave stops at its crest (shorter); where it would break forward it turns into bubbles (FOAM + TRAIL)
         tail=[(0, .42, -.29), (0, .42, -.42), (0, .47, -.56), (0, .57, -.68), (0, .69, -.755), (0, .79, -.755)],
         tailr=[.052, .086, .126, .142, .122, .078])
S.TC = S.catmull([(*a, r) for a, r in zip(L['tail'], L['tailr'])], 5); TC = S.TC
CURL = V3(0, .62, -.60)                                                                          # the wave's eye

def hook(P, pts, rs, k=.006):
    d = np.full(P.shape[:-1], 9.)
    for i in range(len(pts) - 1): d = su(d, cone(P, pts[i], pts[i + 1], rs[i], rs[i + 1]), k)
    return d

def _tongues():
    out = []
    for u, sx, ln in ((.40, 0, .07), (.55, 0, .11), (.70, 0, .12), (.62, .75, .09), (.62, -.75, .09), (.80, .7, .07), (.80, -.7, .07), (.28, 0, .05)):
        i = int(u * (len(TC) - 1)); c, r = TC[i, :3], TC[i, 3]; t = TC[min(i + 2, len(TC) - 1), :3] - TC[max(i - 2, 0), :3]; t /= np.linalg.norm(t)
        n = c - CURL; n[0] = 0; n -= (n @ t) * t; n /= np.linalg.norm(n); n = n * (1 - .4 * abs(sx)) + V3(sx, 0, 0); n /= np.linalg.norm(n)
        p0 = c + n * r * .55; p1 = p0 + n * ln * .55 - t * ln * .15; p2 = p1 + n * ln * .25 + t * ln * .45; p3 = p2 + t * ln * .35 - n * ln * .05   # licks out, then curls with the flow
        out.append(([p0, p1, p2, p3], [r * .42, r * .30, r * .16, .003]))
    return out
TONGUES = _tongues()
# the tail's end breaking up: FOAM bulges out of the tip (part of the body), then the TRAIL of loose bubbles follows the
# curve the v2 curl took (up, over, forward and down), each smaller and further from the last
FOAM = [((0, .835, -.735), .050), ((.040, .815, -.700), .034), ((-.038, .825, -.705), .032), ((.012, .855, -.685), .030), ((0, .770, -.700), .030)]
TRAIL = [((.006, .932, -.668), .027), ((-.026, .945, -.598), .022), ((.020, .910, -.540), .018), ((-.010, .870, -.485), .014),
         ((.050, .960, -.640), .013), ((.026, .820, -.440), .011), ((-.048, .955, -.540), .010), ((-.022, .770, -.400), .008)]
def spheres(P, S_):
    d = np.full(P.shape[:-1], 9.)
    for c, r in S_: d = np.minimum(d, np.linalg.norm(P - V3(*c), axis=-1) - r)
    return d
def trail(P): return spheres(P, TRAIL)
def tail(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b in zip(TC[:-1], TC[1:]): d = np.minimum(d, cone(P, a[:3], b[:3], a[3], b[3]))
    for pts, rs in TONGUES: d = su(d, hook(P, pts, rs), .014)
    return su(d, spheres(P, FOAM), .010)

def _surf(field, p, dirn, n=60):
    p = V3(*p).astype(float); dirn = V3(*dirn) / np.linalg.norm(dirn)
    for _ in range(n): p = p - dirn * np.clip(field(p[None])[0], -.02, .02) * .8
    return p

def legs(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); f, h = L['f'], L['h']
    d = cone(M, f[0], f[1], .070, .042); d = su(d, cone(M, f[1], f[2], .042, .037), .03)            # slim forelegs
    d = su(d, ell(M, (.086, .032, .190), (.046, .032, .066)), .03)                                # long paws
    for x in (-.030, 0, .030): d = su(d, ell(M, (.086 + x, .022, .242), (.016, .022, .026)), .010)  # toes, spread
    d = su(d, ell(M, (.086, .011, .232), (.044, .009, .026)), .008)                               # the web between them
    t = ell(M, (.084, .330, -.225), (.064, .118, .104), rx(-.20))                                 # a long haunch
    t = su(t, cone(M, h[0], h[1], .080, .052), .05)
    t = su(t, cone(M, h[1], h[2], .050, .036), .04); t = su(t, cone(M, h[2], h[3], .036, .036), .03)
    t = su(t, ell(M, (.092, .032, -.226), (.046, .032, .066)), .03)
    for x in (-.028, 0, .028): t = su(t, ell(M, (.092 + x, .022, -.176), (.016, .022, .024)), .010)
    t = su(t, ell(M, (.092, .011, -.184), (.042, .009, .024)), .008)
    return d, t

RUFF = [(0, .40, .205, 0, .290, .262, .054), (.050, .41, .19, .060, .318, .242, .046), (0, .35, .20, 0, .255, .220, .046),
        (.030, .375, .215, .036, .275, .255, .044), (.070, .37, .185, .082, .292, .216, .038)]
def ruff(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); d = np.full(P.shape[:-1], 9.)
    for x, y, z, tx, ty, tz, r in RUFF: d = su(d, cone(M, (x, y, z), (tx, ty, tz), r, .004), .025)        # a soft bib, wispy
    return d

def cheeks(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = hook(M, [(.13, .565, .235), (.235, .585, .160), (.290, .615, .095)], [.050, .026, .003], .02)     # swept BACK, flowing
    return su(d, hook(M, [(.12, .505, .245), (.215, .480, .170), (.262, .490, .105)], [.044, .022, .003], .02), .02)

def body(P):
    b = cone(P, (0, .380, .120), (0, .385, -.215), .100, .090)                                  # a long, slim, level trunk
    b = su(b, ell(P, (0, .372, .140), (.102, .120, .100)), .05)                                 # the chest, slimmer than the Vulnyx's
    b = ss(b, ell(P, (0, .225, -.050), (.3, .085, .17)), .07)                                   # the belly tucked up
    b = su(b, cone(P, (0, .43, .17), (0, .535, .228), .090, .086), .06)                         # a long neck
    f, h = legs(P); b = su(b, f, .045); b = su(b, h, .05); b = su(b, ruff(P), .022)
    return su(su(b, tail(P), .030), su(S.head(P), cheeks(P), .025), .03)

# the curl of water off her withers
_w = _surf(body, (0, 1.0, .02), (0, 1, 0))
FIN = ([_w - V3(0, .012, 0), _w + V3(0, .040, -.028), _w + V3(0, .060, -.070), _w + V3(0, .048, -.100), _w + V3(0, .030, -.096)], [.030, .020, .012, .006, .003])
def fin(P): return hook(P, *FIN)

# bubbles: small domes standing proud of the coat (flanks, haunch, shoulder, neck); the centre sits just outside the skin
def _bubbles():
    rng = np.random.default_rng(13); out = []
    while len(out) < 20:
        y, z = rng.uniform(.30, .50), rng.uniform(-.36, .16); sx = 1 if len(out) % 2 else -1
        if z > .12 and y > .44: continue
        p = _surf(body, (sx * .5, y, z), (sx, 0, 0))
        if abs(p[0]) < .05 or any(np.linalg.norm(p - q) < .068 for q, _ in out): continue
        n = np.array([_g(p, i) for i in range(3)]); n /= np.linalg.norm(n); r = (.013, .018, .024)[len(out) % 3]
        out.append((p + n * r * .15, r))
    return out
def _g(p, i, e=.002): return (body((p + np.eye(3)[i] * e)[None])[0] - body((p - np.eye(3)[i] * e)[None])[0])
BUB = _bubbles()
def bubbles(P):
    d = np.full(P.shape[:-1], 9.)
    for c, r in BUB: d = np.minimum(d, np.linalg.norm(P - c, axis=-1) - r)
    return d

def bubble_in(P):
    """how far outside the dome's top (its cap facing out): negative over the middle of each dome"""
    d = np.full(P.shape[:-1], 9.)
    for c, r in BUB: d = np.minimum(d, np.linalg.norm(P - c, axis=-1) - r * 1.0 + .0)
    return np.where(d < .003, -_cap(P), 9.)
def _cap(P):
    out = np.zeros(P.shape[:-1])
    for c, r in BUB:
        q = P - c; dn = np.linalg.norm(q, axis=-1); nb = dn < r + .004
        n = c / 1; ax = np.array([np.sign(c[0]), 0, 0])
        out = np.where(nb, np.maximum(out, (q @ ax) / r - .55), out)
    return out * .02

def field(P): return su(su(body(P), fin(P), .012), bubbles(P), .004)
def fieldn(P): return np.minimum(field(P), trail(P))          # the loose bubbles too (their normals)
def foamtrail(P): return np.minimum(trail(P), spheres(P, FOAM))

# ── the current: wavy lines running her length (rising with the brush), relief + pale ──
SP = .046
def current(V):
    x, y, z = V.T
    d = ((V[:, None] - TC[None, :, :3]) ** 2).sum(-1); i = d.argmin(1); onT = (z < -.30) & (np.sqrt(d[np.arange(len(V)), i]) < TC[i, 3] + .03)
    u_b = (y - .022 * np.sin(z * 17 + 1.3) - .010 * np.sin(z * 37 + x * 11)) / SP                 # body: along her length
    a = np.arctan2(x, (y - TC[i, 1]) * .7 + (z - TC[i, 2]) * .7)                                    # brush: round its section
    u_t = (a / np.pi * 2.2 + .25 * np.sin(i / len(TC) * 14))
    u = np.where(onT, u_t, u_b); return np.abs((u % 1) - .5)                                         # 0 on a line

PAL = dict(lo='#0c566c', hi='#2b9fae', line='#86dfe0', mid='#8fd8d8', cream='#b8ece8', tip='#9fe2e0', ear='#e6ada6', dark='#0e2028', bub='#c6f4f2', bin='#58c2c8')
LW = .12
def classes(V):
    base = S.classes(V); x, y, z = V.T
    d = ((V[:, None] - TC[None, :, :3]) ** 2).sum(-1); i = d.argmin(1); s = i / (len(TC) - 1.); ang = np.arctan2(x, (y - TC[i, 1]) + (z - TC[i, 2]) * .4)
    base[3] = np.where(z < -.5, (s - .80) - .07 * zig(ang / (2 * np.pi) + .5, 7), -1.) * .5                             # the tongues' ends paler
    ln = (LW - current(V)) * SP                                                                                         # current lines (under the whites)
    ln = np.where((z > .12) & (y > .44), -1., ln)                                                                       # not on her face
    bb = .0035 - bubbles(V); bi = np.minimum(bb, -.010 - bubble_in(V))                                                  # a bubble: pale rim, clear middle
    bu = S.classes(unbend(V)); near = .010 - np.abs(ear_sdf(V)); base[4] = np.minimum(bu[4], near); base[5] = np.minimum(bu[5], near)   # the pink inside rides the fold
    ft = .003 - foamtrail(V); hi = np.minimum(ft, _lit(V) - .45)                                                       # foam + loose bubbles: clear teal, a pale glint up top
    return [ln] + base + [bb, bi, ft, hi]
def _lit(V):
    out = np.full(len(V), -9.); L_ = np.array([.25, .85, .45]); L_ /= np.linalg.norm(L_)
    for c, r in FOAM + TRAIL: q = V - V3(*c); dn = np.linalg.norm(q, axis=-1); out = np.where(dn < r + .006, np.maximum(out, (q @ L_) / r), out)
    return out
def palette():
    return [C(PAL['line']), C(PAL['mid']), C(PAL['cream']), C(PAL['cream']), C(PAL['tip']), C(PAL['ear']), C(PAL['cream']), C(PAL['dark']), C(PAL['bub']), C(PAL['bin']), C(PAL['bin']), C(PAL['bub'])]
WHITE = (1, 2, 3, 5, 6, 8, 9, 10, 11)

def finish(V, Fa, path, eye):
    """SF.finish, plus the current relief: each line stands ~2.5 mm proud of the coat (its edge already cut into the mesh)"""
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0)
    pal = palette(); lab = np.full(len(Fa), -1)
    for k in range(len(pal)):
        V, Fa, lab, side = S.cut(V, Fa, lab, classes(V)[k]); lab = np.where(side, k, lab)
    N = np.stack([fieldn(V + np.eye(3)[i] * .0035) - fieldn(V - np.eye(3)[i] * .0035) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    white = np.zeros(len(V), bool); np.logical_or.at(white, Fa[np.isin(lab, WHITE)].ravel(), True)
    face = (V[:, 2] > .12) & (V[:, 1] > .44)
    c = current(V); h = .0026 * np.clip(1 - c / (LW * 1.6), 0, 1) ** 1.5
    h = np.where(white | face | (bubbles(V) < .003) | (foamtrail(V) < .004), 0, h) * np.clip((V[:, 1] - .012) / .03, 0, 1)
    V = V + N * h[:, None]
    Nm = S.normals(V, Fa); N = np.where((h > 1e-5)[:, None], Nm * .6 + N * .4, N); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(PAL['lo']) * (1 - sh[g]) + C(PAL['hi']) * sh[g]
    S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=eye)); print('vulnix body tris', len(FF), 'verts', len(VV), 'bubbles', len(BUB))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else 7000
    import trimesh
    from marching import surface
    def decimate(V, F, n):
        """S.decimate, but a pinch is allowed; an open edge is not"""
        import fast_simplification as fs
        best = None
        for agg in (3, 4, 5, 6):
            for k in (1, .95, 1.05, .9, 1.1):
                v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=int(n * k), agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices()
                c = np.unique(t.edges_sorted, axis=0, return_counts=True)[1]
                if t.body_count == 1 and (c % 2).sum() == 0 and len(t.faces) < n * 1.4:
                    p = int((c > 2).sum()); best = (p, t) if best is None or p < best[0] else best
                    if p == 0: return t
        if best is None: raise SystemExit('no closed decimation')
        print('pinched edges', best[0]); return best[1]
    S.decimate = decimate
    S.field = field; SF.F = dict(SF.FORMS['water'], form='water', **{k: PAL[k] for k in ('lo', 'hi')})
    lo, hi, h = V3(-.47, -.033, -1.0), V3(.47, 1.12, .40 + .16), .0066
    Vr, Fr = surface(field, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
    k = max(m.split(only_watertight=False), key=lambda c: len(c.faces)); t = S.decimate(k.vertices, k.faces, TRIS)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    V, F = np.array(t.vertices), np.array(t.faces)
    for c, r in TRAIL:                                                                       # the loose bubbles: their own little spheres
        b = trimesh.creation.icosphere(subdivisions=2 if r > .017 else 1, radius=r); F = np.vstack([F, b.faces + len(V)]); V = np.vstack([V, b.vertices + V3(*c)])
    for i, (c, r) in enumerate(TRAIL):
        g = min([field(V3(*c)[None])[0]] + [np.linalg.norm(V3(*c) - V3(*e)) - q for j, (e, q) in enumerate(TRAIL) if j != i]) - r
        assert g > .008, ('bubble %d touches' % i, g)
    print('trail bubbles', len(TRAIL), 'tris', len(F))
    eV, eF, eC = SF.eyes(); finish(V, F, OUT, (eV, eF, eC, S.normals(eV, eF)))
