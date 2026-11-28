"""M202 the Luminara line (Luminel / Luminarc / Luminore / Luminix): SHARED TOOLS ONLY (the Shellmere / Croakling-line route).
Every form starts from the BASE Luminara's own sculpt module (docs/looks/m174-luminara-2026-11-27/tools/sculpt_luminara.py, loaded fresh per
form, never edited) and overrides it BY NAME in her own sculpt_<form>.py: landmarks (head HC/HR, abdomen AC/AR/AX, thorax, arms, legs, wing
roots, antenna curve), field terms, colours, colour classes, wings (WINGS / wing_outline / MEMB / VEIN / RIM) and her own extra parts (deco():
crystals, infusion markings, lightning, moss, bubbles). Deco parts ride the unlit `eyes` part (living light: the glow is part of the body) and
rig_lum.py skins each one to the nearest body vertex. The rig (rig_lum.py) runs the base rig on her.
  S = base()   the base module, fresh;   build(S, out) runs the base pipeline with her overrides."""
import sys, os, importlib.util, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
BASE = os.path.join(HERE, '../../m174-luminara-2026-11-27/tools')
for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), BASE): sys.path.insert(0, p)
from sculpt_v2 import cone, ell, su, ss, cut, glb, normals, V3
from marching import surface
HC0, AC0 = V3(0, .66, .20), V3(0, .31, -.19)
EYE_LIT = {'rim': (58, 30, 12), 'iris': (214, 138, 40), 'pupil': (34, 16, 8), 'blush': (244, 150, 128)}

def base():
    spec = importlib.util.spec_from_file_location('sculpt_luminara', os.path.join(BASE, 'sculpt_luminara.py')); S = importlib.util.module_from_spec(spec)
    sys.modules['sculpt_luminara'] = S; spec.loader.exec_module(S)
    S.BOUNDS = (V3(-.30, .02, -.52), V3(.30, .90, .44)); S.ANT = True; S.KNOBS = True; S.REMAP = {}; S.DECO = []; S.deco = lambda: []
    S.LAMP_R = .165; S.LAMP_U = V3(0, -.20, 1.); S.LAMP_COLS = ((255, 214, 120), (255, 236, 176), (255, 250, 232)); S.paint = None
    return S

def axis(S, ax):
    """re-aim her abdomen: AX (to the waist), ADN (its dorsal normal), RA (its local frame)"""
    ax = np.asarray(ax, float); ax = ax / np.linalg.norm(ax); S.AX = ax; S.ADN = V3(0, ax[2], -ax[1]); S.RA = np.stack([V3(1, 0, 0), S.ADN, S.AX], 1)

def regions(S, V):
    M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; return M, S.abdomen(M), S.head(M), S.thorax(M), S.arms(M), S.legs(M)

def face(S, M, hd, ab, cx=.165, cy=.615, ry=.125, z=.26):
    fq = (M[:, 0] / cx) ** 2 + ((M[:, 1] - cy) / ry) ** 2; return np.where((hd < ab) & (M[:, 2] > z) & (M[:, 1] > cy - ry * .85), np.clip(.03 * (1 - fq), -.05, .05), -.05)

# ── part builders (closed or two-faced, wound outward) ──
def _orient(P, F, out):
    f0 = F[len(F) // 2]; return F if np.cross(P[f0[1]] - P[f0[0]], P[f0[2]] - P[f0[0]]) @ out(P[f0].mean(0)) > 0 else F[:, ::-1]
def crystal(b, ax, r, h, col, k=6, hb=None, tw=0.):
    """a bipyramid crystal: base b, pointing along ax, radius r, point height h (hb: the buried lower point)"""
    ax = np.asarray(ax, float); ax /= np.linalg.norm(ax); t1 = np.cross(ax, V3(0, 0, 1) if abs(ax[2]) < .9 else V3(1, 0, 0)); t1 /= np.linalg.norm(t1); t2 = np.cross(ax, t1)
    a = np.arange(k) / k * 2 * np.pi + tw; mid = b + ax * h * .25; ring = mid + r * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2)
    P = np.vstack([ring, [b + ax * h], [b - ax * (hb if hb is not None else h * .3)]]); F = np.array([f for i in range(k) for f in ((i, (i + 1) % k, k), ((i + 1) % k, i, k + 1))])
    c = P.mean(0); return P, _orient(P, F, lambda q: q - c), col
def blob(S, c, r, col, nu=6, nv=10, seed=0):
    rng = np.random.default_rng(seed); P, F, _ = S.ball(c, V3(r, r, r), col, nu, nv); P = c + (P - c) * (1 + .18 * rng.standard_normal((len(P), 1))); return P, F, col
def tube(C, r0, r1, col, k=7):
    C = np.asarray(C, float); D = np.gradient(C, axis=0); P = []
    for i, (c, d) in enumerate(zip(C, D)):
        d = d / np.linalg.norm(d); t1 = np.cross(d, V3(1, 0, 0) if abs(d[0]) < .9 else V3(0, 1, 0)); t1 /= np.linalg.norm(t1); t2 = np.cross(d, t1); r = r0 + (r1 - r0) * i / (len(C) - 1); a = np.arange(k) / k * 2 * np.pi
        P += list(c + r * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2))
    P = np.array(P + [C[0], C[-1]]); n = len(C); F = []
    for i in range(n - 1):
        for j in range(k): p0, p1, q0, q1 = i * k + j, i * k + (j + 1) % k, (i + 1) * k + j, (i + 1) * k + (j + 1) % k; F += [(p0, p1, q1), (p0, q1, q0)]
    F += [(n * k, (j + 1) % k, j) for j in range(k)] + [(n * k + 1, (n - 1) * k + j, (n - 1) * k + (j + 1) % k) for j in range(k)]; F = np.array(F)
    mid = C[n // 2]; f0 = F[k * (n // 2) * 2]; d0 = np.cross(P[f0[1]] - P[f0[0]], P[f0[2]] - P[f0[0]]) @ (P[f0[0]] - C[n // 2])
    return P, (F if d0 > 0 else F[:, ::-1]), col
def onsurf(S, c, Q, lift=0.):
    """points Q cast onto her surface from the centre c (each along its own direction)"""
    U = np.asarray(Q, float) - c; U /= np.linalg.norm(U, axis=1, keepdims=True); return S.ray(c, U, 1.2)
def jag(S, c, a, b, n, amp, seed):
    """a jagged bolt from a to b (both near her surface), kinked, cast onto it"""
    rng = np.random.default_rng(seed); t = np.linspace(0, 1, n * 3 + 1); Q = np.outer(1 - t, a) + np.outer(t, b)
    d = np.asarray(b, float) - a; side = np.cross(d, np.asarray(a, float) - c); side /= np.linalg.norm(side) + 1e-9
    off = np.zeros(len(t)); off[3:-1:3] = amp * rng.choice([-1, 1], len(off[3:-1:3])) * (.6 + .4 * rng.random(len(off[3:-1:3]))); off = np.interp(t, t[::3], off[::3])
    return onsurf(S, c, Q + off[:, None] * side)

# ── the pipeline ──
def eyes(S):
    parts = []
    for P, F, col in S.eyes():
        col = tuple(int(x) for x in col)
        if col in (tuple(S.STALK), tuple(S.KNOBC), tuple(S.KNOBHI)) and not S.ANT: continue
        if col in (tuple(S.KNOBC), tuple(S.KNOBHI)) and not S.KNOBS: continue
        parts.append((P, F, S.REMAP.get(col, col)))
    return parts + list(S.deco())
def lamp(S):
    """the base lamp, her radius / facing / colours"""
    u = S.LAMP_U / np.linalg.norm(S.LAMP_U); p = S.ray(S.AC, u[None], .7)[0]; n, t1, t2 = S.frame(p); print('lamp at', p.round(3), 'n', n.round(2))
    nu, nv, R = 9, 28, S.LAMP_R; P, Fl, C = [], [], []; c0, c1, c2 = S.LAMP_COLS
    for i in range(nu + 1):
        r = R * (1 - (i / nu) ** 1.6) if i else R; h = .006 + .030 * np.sqrt(max(0, 1 - (r / R) ** 2)) if i else -.030
        for j in range(nv): a = 2 * np.pi * j / nv; q_ = p + r * (np.cos(a) * t1 + np.sin(a) * t2 * .95); u_ = q_ - S.AC; q_ = S.ray(S.AC, (u_ / np.linalg.norm(u_))[None], .8)[0]; P.append(q_ + S.grad(q_[None], 3e-3)[0] * h); C.append(c0 if i < 2 else c1 if i < 4 else c2)
    P.append(p + n * .036); C.append(c2); P = np.array(P); top = len(P) - 1
    for i in range(nu):
        for j in range(nv): a, b, c_, d = i * nv + j, i * nv + (j + 1) % nv, (i + 1) * nv + j, (i + 1) * nv + (j + 1) % nv; Fl += [(a, b, d), (a, d, c_)]
    Fl += [(nu * nv + j, nu * nv + (j + 1) % nv, top) for j in range(nv)]
    bot = len(P); P = np.vstack([P, [p - n * .030]]); C.append(c0); Fl += [((j + 1) % nv, j, bot) for j in range(nv)]
    Fl = np.array(Fl); f0 = Fl[nv * 3]
    if np.cross(P[f0[1]] - P[f0[0]], P[f0[2]] - P[f0[0]]) @ n < 0: Fl = Fl[:, ::-1]
    S.LAMP_AT = p - n * .05; return P, Fl, np.array(C)
def finish(S, V, F, path, eye):
    V, F = S.refine(V, F, lambda V: (V[:, 2] > .26) & (V[:, 1] > .52), .024)
    lab = np.full(len(F), -1)
    for k in range(len(S.PAL)): V, F, lab, side = cut(V, F, lab, S.classes(V)[k]); lab = np.where(side, k, lab)
    N = S.grad(V, .006); cols = np.array([S.PAL[k] if k >= 0 else S.GOLD for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN = V[key[:, 0]], N[key[:, 0]]; CC = np.c_[key[:, 1:], np.full(len(key), 255)].astype(float); FF = inv.reshape(-1, 3)
    sh = np.clip(.5 + .5 * NN[:, 1], 0, 1); CC[:, :3] = CC[:, :3] * (.86 + .14 * sh[:, None])
    lP, lF, lC = lamp(S)
    gl = np.exp(-np.linalg.norm(VV - S.LAMP_AT, axis=1) ** 2 / .03); CC[:, :3] = np.minimum(255, CC[:, :3] * (1 + .22 * gl[:, None]) + 30 * gl[:, None])
    if S.paint: S.paint(VV, CC)
    eV, eF, eC = S.join(eye)
    glb(path, dict(body=(VV, FF, np.round(CC), NN), eyes=(eV, eF, eC, normals(eV, eF)), lamp=(lP, lF, np.c_[lC, np.full(len(lC), 255)], normals(lP, lF))))
    print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF), 'lamp tris', len(lF))
def build(S, out, tris=None):
    import trimesh
    lo, hi = S.BOUNDS; V, F = surface(S.field, lo, hi, .0072); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False)
    print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number, 'bounds', k.bounds.round(3).tolist())
    assert k.bounds[0][1] > lo[1] + .01 and k.bounds[1][1] < hi[1] - .01 and np.all(k.bounds[0] > lo + .005) and np.all(k.bounds[1] < hi - .005), 'surface touches BOUNDS'
    t = S.decimate(k.vertices, k.faces, tris or S.TRIS); X = np.array(t.vertices)
    for _ in range(3): X = X - S.grad(X, 3e-3) * np.clip(S.field(X), -.004, .004)[:, None] * .6
    t = trimesh.Trimesh(X, np.array(t.faces), process=False); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(S, np.array(t.vertices), np.array(t.faces), out, eyes(S))
