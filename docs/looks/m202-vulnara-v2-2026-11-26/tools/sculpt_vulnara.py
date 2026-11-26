"""M202 v2: VULNARA (Vulnyx's Mana second form) as HER OWN CREATURE, not the Vulnyx body recoloured (Alex 11-26: "this first
evolution is its own new creature and should introduce the element"). Built from the LOCKED art
/root/athernyx/assets/stage2/001-vulnara.png (grimoire-ledger #1: "Mana-INFUSED = violet/amethyst crystalline + GOLD RUNE-MARKS +
third-eye") and the page (Otto #3: "violet and quick, gold rune-marks scrolled down its flanks and a bright gem set at its brow,
ears pricked and a long tail streaming"; Bonn #5: "She grew, a little"). Mana is in the anatomy, not painted on.
    python sculpt_vulnara.py <out.glb> [tris]      (numpy, scipy, trimesh, fast_simplification)
What the picture shows -> what this body carries as SHAPE:
  - tall pricked ears, white feathered fur inside             -> ears ~20% longer and wider, tufts of fur standing in each
  - a pink diamond gem in gold on the brow (the third eye)    -> a raised faceted crystal on the brow, not a flat patch
  - gold rune circles on shoulder, flank and haunch            -> raised rune rings (relief) with spokes and a centre boss
  - a big plume tail, white above, violet below, its violet   -> a fuller, longer brush carried high, with faceted amethyst
    edge breaking into jagged spikes                              crystal shards breaking out along its under edge
  - slim legs, neat round paws, a deep white chest            -> a lean leggy body: higher trunk, deep chest, tucked waist
  - violet coat, white muzzle / bib / tail top, pink ears      -> the colours
  - the Vulnyx head and face                                  -> kept (her line)
Where the art is silent (each makes her MORE her own creature; listed in the README): the trunk carried higher on longer legs
(the page: "quick"), the tail carried high and streaming back (the page: "a long tail streaming"), crystal shards set as
four-sided facets (the ledger's "crystalline"), the rune layout down the flanks (the art shows one side)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools')); sys.path.insert(0, os.path.join(HERE, '../../m202-vulnyx-2026-11-26/tools'))
import sculpt_v2 as S
import sculpt_forms as SF
V3, su, ss, ell, cone, rx, zig = S.V3, S.su, S.ss, S.ell, S.cone, S.rx, S.zig
C = SF.C

# ── her ears: taller and wider than the Vulnyx's (S.ear / S.classes read these module globals) ──
S.EAR_A = V3(.128, .655, .222); S.EAR_T = V3(.232, 1.040, .142)

# ── landmarks (rig_vulnara.py reads these) ──
L = dict(head=(0, .565, .255), chest=(0, .42, .13), pelvis=(0, .42, -.17),
         f=[(.080, .40, .150), (.082, .215, .128), (.084, .048, .150)],                        # shoulder, elbow, paw
         h=[(.080, .385, -.175), (.096, .245, -.105), (.090, .128, -.228), (.090, .042, -.198)],  # hip, knee, hock, paw
         tail=[(0, .45, -.25), (0, .46, -.35), (0, .49, -.47), (0, .57, -.60), (0, .69, -.70), (0, .81, -.79), (0, .90, -.87), (0, .945, -.95), (0, .95, -1.02)],
         tailr=[.052, .080, .135, .180, .195, .180, .132, .066, .004])
S.TC = S.catmull([(*a, r) for a, r in zip(L['tail'], L['tailr'])], 5); TC = S.TC

def shard(P, a, b, ra):
    """a four-sided crystal spike from a to b, base half-width ra: an L1 (diamond) cross-section, so its faces are flat"""
    a, b = V3(*a), V3(*b); ab = b - a; ln = np.linalg.norm(ab); u = ab / ln
    e1 = np.cross(u, V3(0, 1, 0) if abs(u[1]) < .9 else V3(1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(u, e1)
    q = P - a; t = q @ u; r = (np.abs(q @ e1) + np.abs(q @ e2)) * .7071
    return np.maximum(r - np.maximum(ra * np.clip(1 - t / ln, 0, 1), .0055), np.maximum(-t, t - ln))

# the shards along the brush's under edge: (position along the chain 0..1, angle round it from straight down, length, width)
SH = [(.28, 0, .110, .036), (.36, .70, .150, .046), (.36, -.70, .150, .046), (.42, 0, .190, .052), (.48, 1.25, .150, .044), (.48, -1.25, .150, .044),
      (.54, .55, .210, .056), (.54, -.55, .210, .056), (.62, 0, .200, .052), (.64, 1.15, .150, .042), (.64, -1.15, .150, .042), (.72, .50, .140, .040), (.72, -.50, .140, .040)]
def _shards():
    out = []
    for s, ang, ln, w in SH:
        i = int(s * (len(TC) - 1)); c, r = TC[i, :3], TC[i, 3]; t = TC[min(i + 2, len(TC) - 1), :3] - TC[max(i - 2, 0), :3]; t /= np.linalg.norm(t)
        dn = np.cross(V3(1, 0, 0), t); dn = -dn if dn[1] > 0 else dn                                      # 'down' off the chain
        n = dn * np.cos(ang) + V3(1, 0, 0) * np.sin(ang); n /= np.linalg.norm(n); n = n * .80 + t * .45; n /= np.linalg.norm(n)   # swept toward the tip: a streaming flame
        out.append((c + n * r * .35, c + n * (r + ln), w))
    return out
SHARDS = _shards()
def shards(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b, w in SHARDS: d = np.minimum(d, shard(P, a, b, w * 1.4))
    return d

def tail(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b in zip(TC[:-1], TC[1:]): d = np.minimum(d, cone(P, a[:3], b[:3], a[3], b[3]))
    for u, s, ln in ((.42, -1, .15), (.55, -1, .17), (.68, -1, .14), (.62, 1, .14), (.78, -1, .10)):       # soft fur points on the white top
        i = int(u * (len(TC) - 1)); c, r = TC[i, :3], TC[i, 3]; t = TC[min(i + 2, len(TC) - 1), :3] - TC[i - 2, :3]; t /= np.linalg.norm(t)
        for sx, w in ((0, 1.), (.8, .9), (-.8, .9)):
            up = np.cross(t, V3(1, 0, 0)) * s * -1; n = up * (1 - .45 * abs(sx)) + V3(sx, 0, 0); n /= np.linalg.norm(n)
            d = su(d, cone(P, c + n * r * .50, c + n * (r + .022 * w) + t * ln * w, r * .46, .004), .045)
    return d

def ear_tufts(P):
    """white feathered fur standing inside each ear (the art's): thin points rising from the scoop's floor toward the tip"""
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); ax = S.EAR_T - S.EAR_A; ln = np.linalg.norm(ax); u = ax / ln
    w = V3(1, 0, 0) - u[0] * u; w /= np.linalg.norm(w); dv = np.cross(w, u); d = np.full(P.shape[:-1], 9.)
    for t0, sx, l in ((.12, 0, .42), (.14, .30, .34), (.14, -.30, .34), (.22, .12, .28)):
        half = .118 * 1.15 * (1 - t0); a = S.EAR_A + u * ln * t0 + w * sx * half * .5 + dv * .012
        b = a + u * ln * l + w * sx * .025 + dv * .022
        d = np.minimum(d, cone(M, a, b, .017, .006))
    return d

def brow_gem(P):
    """the third eye: a faceted diamond crystal standing proud of the brow (eyes() lays the pink and the gold setting over it)"""
    q = np.stack([P[..., 0] / .026, (P[..., 1] - .675) / .038, (P[..., 2] - GEM_Z) / .018], -1)
    return (np.abs(q).sum(-1) - 1) * .012

def _surf(field, p, dirn, n=60):
    p = V3(*p).astype(float); dirn = V3(*dirn) / np.linalg.norm(dirn)
    for _ in range(n): p = p - dirn * np.clip(field(p[None])[0], -.02, .02) * .8
    return p
def grad(field, p, e=1e-3): g = np.array([field((p + np.eye(3)[i] * e)[None])[0] - field((p - np.eye(3)[i] * e)[None])[0] for i in range(3)]); return g / np.linalg.norm(g)

def legs(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); f, h = L['f'], L['h']
    d = cone(M, f[0], f[1], .066, .040); d = su(d, cone(M, f[1], f[2], .040, .034), .03)          # slim forelegs
    d = su(d, ell(M, (.084, .030, .170), (.044, .030, .056)), .03)                                # neat round paw
    for x in (-.022, 0, .022): d = su(d, ell(M, (.084 + x, .022, .212), (.0145, .022, .020)), .010)
    t = ell(M, (.082, .335, -.172), (.064, .115, .104), rx(-.25))                                 # a lean haunch
    t = su(t, cone(M, h[0], h[1], .080, .052), .05)
    t = su(t, cone(M, h[1], h[2], .050, .036), .04); t = su(t, cone(M, h[2], h[3], .036, .034), .03)
    t = su(t, ell(M, (.090, .030, -.172), (.044, .030, .058)), .03)
    for x in (-.022, 0, .022): t = su(t, ell(M, (.090 + x, .022, -.130), (.0145, .022, .020)), .010)
    return d, t

def body(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    b = cone(P, (0, .425, .115), (0, .425, -.170), .104, .084)                                  # a higher, leaner trunk
    b = su(b, ell(P, (0, .400, .140), (.102, .140, .108)), .05)                                 # deep chest
    b = ss(b, ell(P, (0, .245, -.065), (.3, .090, .14)), .07)                                    # a strong waist tuck
    b = su(b, cone(P, (0, .46, .17), (0, .535, .225), .090, .090), .06)                         # neck
    for x, y, z, tx, ty, tz, r in ((0, .43, .215, 0, .285, .272, .060), (.050, .44, .20, .064, .305, .255, .052), (0, .37, .21, 0, .245, .236, .052),
                                    (.090, .45, .160, .118, .345, .215, .044), (.030, .40, .220, .038, .262, .266, .050), (.074, .39, .190, .090, .270, .238, .044)):
        b = su(b, cone(M, (x, y, z), (tx, ty, tz), r, .004), .025)                               # a long white chest ruff
    f, h = legs(P); b = su(b, f, .045); b = su(b, h, .05)
    return su(su(b, tail(P), .035), S.head(P), .03)

GEM_Z = None
def _gem_z():
    return _surf(lambda Q: su(body(Q), np.full(Q.shape[:-1], 9.), .01), (0, .675, .50), (0, 0, 1))[2]
GEM_Z = _gem_z() - .004

# rune rings: (target on the coat, radius). The art's: a small ring on the shoulder, one mid-flank, a big one on the haunch, one low on the thigh
RUNES_AT = [((.11, .37, .115), .030), ((.10, .43, -.045), .036), ((.12, .37, -.175), .050), ((.11, .215, -.150), .026)]
def _runes():
    out = []
    for sx in (1, -1):
        for t, r in RUNES_AT:
            p = _surf(body, (sx * .30, t[1], t[2]), (sx, 0, 0)); n = grad(body, p); out.append((p, n, r))
    return out
RUNES = _runes()
def _frame(n):
    e1 = np.cross(n, V3(0, 1, 0)); e1 /= np.linalg.norm(e1); return e1, np.cross(n, e1)
def runes(P):
    """raised rings, proud of the coat by about 5 mm"""
    d = np.full(P.shape[:-1], 9.)
    for p, n, r in RUNES:
        q = P - p; h = q @ n; pl = np.linalg.norm(q - h[..., None] * n, axis=-1)
        d = np.minimum(d, np.sqrt((pl - r) ** 2 + (h + .001) ** 2) - .0085)
        d = np.minimum(d, np.sqrt(pl ** 2 + (h + .002) ** 2) - r * .30)                          # the centre boss
    return d
def rune_lines(V):
    """gold (positive inside) for the ring band, boss and six spokes, as the art's wheel-like runes"""
    out = np.full(len(V), -1.)
    for p, n, r in RUNES:
        q = V - p; h = q @ n; pq = q - h[:, None] * n; pl = np.linalg.norm(pq, axis=1); e1, e2 = _frame(n)
        ring = .0095 - np.abs(pl - r); boss = r * .34 - pl
        a = np.arctan2(pq @ e2, pq @ e1); spoke = np.minimum(.0045 - pl * np.abs(np.sin(3 * a)) * .5, r - pl)
        out = np.maximum.reduce([out, np.where(np.abs(h) < .03, np.maximum.reduce([ring, boss, spoke]), -1.)])
    return out

def field(P):
    b = body(P); b = su(b, runes(P), .006); b = su(b, ear_tufts(P), .014)
    b = su(b, shards(P), .018); return su(b, brow_gem(P), .004)

PAL = dict(lo='#4b3a92', hi='#8a74cf', mid='#e6def3', cream='#f8f5fd', tip='#f8f5fd', ear='#e9a3b4', dark='#2a1a2e')
def classes(V):
    out = S.classes(V); x, y, z = V.T; A = np.abs(x)
    d = ((V[:, None] - TC[None, :, :3]) ** 2).sum(-1); i = d.argmin(1); s = i / (len(TC) - 1.); ang = np.arctan2(x, (y - TC[i, 1]) + (z - TC[i, 2]) * .4)
    out.append(np.where(z < -.36, np.minimum((s - .46) - .08 * zig(ang / (2 * np.pi) + .5, 7), y - TC[i, 1] + TC[i, 3] * .25), -1.) * .5)   # 7 tail: white upper half
    out.append(.005 - shards(V))                                                                                     # 8 amethyst shards
    out.append(.0035 - ear_tufts(V))                                                                                 # 9 white ear tufts
    out.append(rune_lines(V))                                                                                         # 10 gold runes
    sp = np.full(len(V), -1.)                                                                                         # 11 the art's small sprig runes on the upper shoulder
    for sx in (1, -1):
        for a, b in (((.096, .455, .125), (.074, .505, .090)),):
            a, b = V3(sx * a[0], *a[1:]), V3(sx * b[0], *b[1:]); ab = b - a; t = np.clip(((V - a) @ ab) / (ab @ ab), 0, 1); dd = np.linalg.norm(V - a - t[:, None] * ab, axis=1)
            sp = np.maximum(sp, .0055 - dd)
            for tt, side in ((.35, 1), (.6, -1), (.8, 1)):
                c = a + ab * tt; e = c + V3(sx * .018 * side, .012, .010); ce = e - c; u = np.clip(((V - c) @ ce) / (ce @ ce), 0, 1); sp = np.maximum(sp, .0045 - np.linalg.norm(V - c - u[:, None] * ce, axis=1))
    out.append(sp)
    return out
def palette():
    gold = C('#e3b23c')
    return [C(PAL['mid']), C(PAL['cream']), C(PAL['cream']), C(PAL['tip']), C(PAL['ear']), C(PAL['cream']), C(PAL['dark']),
            C('#f3eefb'), C('#9a7ce6'), C('#fbf8ff'), gold, gold]

def finish(V, Fa, path, eye):
    """SF.finish, but the brush's wide-slope normals stop short of the shards, so their faces stay flat and catch the light"""
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0)
    pal = palette(); lab = np.full(len(Fa), -1)
    for k in range(len(pal)):
        V, Fa, lab, side = S.cut(V, Fa, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = np.where((V[:, 2] < -.30) & (shards(V) > .012), .030, .0035)[:, None]
    N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(PAL['lo']) * (1 - sh[g]) + C(PAL['hi']) * sh[g]
    cr = (key[:, 1:] == C('#9a7ce6')).all(1); CC[cr, :3] = C('#7a5cd0') * (1 - sh[cr]) + C('#c8b4ff') * sh[cr]       # the shards: deep amethyst under, pale on top
    eV, eF, eC = eye
    nv, nf, nr, ns = [], [], 6, 18
    for a in range(nr + 1):
        for b in range(ns):
            t, u = np.pi * a / nr, 2 * np.pi * b / ns; nv.append((np.sin(t) * np.cos(u) * .0300 * (1 + .16 * np.sin(t) * np.sin(u)), .5335 + np.sin(t) * np.sin(u) * .0228, .503 + np.cos(t) * .0235))
    for a in range(nr):
        for b in range(ns): p, q = a * ns + b, a * ns + (b + 1) % ns; nf += ([] if a == 0 else [(p, p + ns, q)]) + ([] if a == nr - 1 else [(p + ns, q + ns, q)])
    eF = np.vstack([eF, np.array(nf) + len(eV)]); eV = np.vstack([eV, nv]); eC = np.vstack([eC, np.tile((2, 1, 1, 255), (len(nv), 1))])
    S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=(eV, eF, eC, S.normals(eV, eF)))); print('vulnara body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else 6800
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
    S.field = field; SF.F = dict(SF.FORMS['mana'], form='mana', **{k: PAL[k] for k in ('lo', 'hi')})
    lo, hi, h = V3(-.47, -.033, -1.30), V3(.47, 1.12, .56), .0068
    Vr, Fr = surface(field, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
    k = max(m.split(only_watertight=False), key=lambda c: len(c.faces)); t = S.decimate(k.vertices, k.faces, TRIS)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT, SF.eyes())
