"""M202 Hovari line: SHARED TOOLS ONLY. Each form's body (trunk, head, wing feathers, tail, beak, crest, gem, colour, eyes) is defined
in her own sculpt_<form>.py from her locked art; this module only lends the base Hovari's machinery: the marching-cubes surface, the
Blender collapse, the feather-sheet builders (wing / tail read the FORM's FE / TF / SH / WR / ZW), the eye builder (her own palette),
the blur petals (her own colours), refine / cut / paint export.   bind(globals()) at the end of a form module, then build(out).
Every body name below MUST come from the form (an unbound name raises), so nothing of the base Hovari's body can leak in."""
import sys, os, inspect, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
for p in ('../../vulnyx-2026-11-24/tools', '../../hovari-2026-11-24/tools'): sys.path.insert(0, os.path.join(HERE, p))
import sculpt as B
from sculpt_v2 import cone, ell, su, cut, glb, normals, V3
from sculpt import C8, zig, cone2, feather, fan, ss_, mixc
ss = lambda a, b, x: ss_(a, b, x)
BODY = ['SH', 'WR', 'ZW', 'TH', 'FE', 'TO', 'TD', 'TF', 'BK', 'HC', 'beak', 'core', 'head', 'trunk', 'thigh', 'field', 'paint', 'YAW', 'EY', 'ER', 'RB', 'LID', 'PAL']
# the base eye builder, with her own palette: each literal colour of the base is replaced by a name (and each replacement must apply)
EYE_COLS = {'rim': '(14, 34, 40)', 'white': '(206, 250, 224)', 'iris': '(34, 138, 142)', 'glow': '(110, 240, 214)', 'pupil': '(10, 14, 20)', 'hi2': '(190, 255, 236)',
            'hi3': '(150, 240, 220)', 'lash': '(16, 62, 72)', 'blush': '(214, 70, 92)', 'lid': '(54, 158, 136)', 'lidline': '(12, 48, 56)'}
_src = inspect.getsource(B.eyes)
for k, v in EYE_COLS.items(): assert v in _src, k; _src = _src.replace(v, f"PAL['{k}']")
for k, v in (('toes', '(34, 36, 34)'), ('beak_a', '(52, 50, 62)'), ('beak_b', '(104, 106, 124)'), ('beak_c', '(34, 26, 34)')): assert v in _src, k; _src = _src.replace(v, f"PAL['{k}']")
exec(compile(_src, 'hov_eyes', 'exec'), B.__dict__)
LIDC = lambda P: [P['lid'], P['lidline']]
def bind(g):
    miss = [n for n in BODY if n not in g]; assert not miss, f'form must define {miss}'
    for n in BODY: setattr(B, n, g[n])
    g.setdefault('wing', B.wing); g.setdefault('tail', B.tail); B.TN = V3(0, B.TD[2], -B.TD[1]); B.PAL = g['PAL']; B.extra = g.get('extra', lambda: [])
    # base helpers that cached base geometry at import: drop them so a stale one can never be read
    for n in ('TU', 'tufts', 'coat', 'egg', 'ball', 'CR'):
        if n not in g and hasattr(B, n): delattr(B, n)
    return B
_eyes = B.eyes
def eyes_all():
    V, F, C = _eyes(); parts = B.extra()
    for P, f, c in parts: F = np.vstack([F, f + len(V)]); V = np.vstack([V, P]); C = np.vstack([C, np.tile((*np.round(255 * (np.array(c) / 255.) ** 2.2), 255), (len(P), 1))])
    return V, F, C
B.eyes = eyes_all
def tube(pts, rs, n=6):
    """a tapered closed tube through pts (radii rs per point, the last one a tip): V, F"""
    pts = [V3(*p) for p in pts]; P = []; th = np.arange(n) / n * 2 * np.pi
    for i, (c, r) in enumerate(zip(pts[:-1], rs)):
        d = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]; d /= np.linalg.norm(d); e1 = np.cross(d, V3(1, 0, 0) if abs(d[0]) < .9 else V3(0, 1, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(d, e1); P += [c + r * (np.cos(t) * e1 + np.sin(t) * e2) for t in th]
    P.append(pts[-1]); k = len(pts) - 1
    F = [f for j in range(k - 1) for i in range(n) for f in ((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n), (j * n + i, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))] + [((k - 1) * n + i, (k - 1) * n + (i + 1) % n, k * n) for i in range(n)]
    F += [(0, (i + 1) % n, i) for i in range(1, n - 1)]
    P, F = np.array(P), np.array(F); F = F[:, ::-1] if (np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]) * (P[F].mean(1) - P.mean(0))).sum() < 0 else F
    return P, F
def gem(c, r, h, n=6):
    """a faceted crystal (a bipyramid): V, F"""
    c = V3(*c); a = np.arange(n) / n * 2 * np.pi; ring = np.c_[r * np.cos(a), np.zeros(n), r * np.sin(a)] + c; P = np.vstack([ring, c + (0, h, 0), c - (0, h * .55, 0)])
    F = [(i, n, (i + 1) % n) for i in range(n)] + [(i, (i + 1) % n, n + 1) for i in range(n)]; P, F = np.array(P), np.array(F)
    return P, (F if (np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]) * (P[F].mean(1) - c)).sum() > 0 else F[:, ::-1])
def build(out, tris=2500):
    import trimesh, subprocess, tempfile
    lo, hi, h = V3(-.8012, -.20, -.62), V3(.8012, 1.20, .50), .0058
    V, F = B.surface(lambda P: (lambda d: np.where(np.abs(d) < .0007, .0007, d))(B.field(P)), lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number); T_ = tempfile.mkdtemp(); np.savez(T_ + '/i.npz', v=B.warp(k.vertices), f=k.faces)
    subprocess.run([os.environ.get('BLENDER', '/opt/blender/blender'), '-b', '-P', os.path.join(HERE, 'dec.py'), '--', T_ + '/i.npz', T_ + '/o.npz', str(tris)], stdout=subprocess.DEVNULL, check=True); d = np.load(T_ + '/o.npz'); t = trimesh.Trimesh(B.warp(d['v'], True), d['f'], process=False)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, 'euler', t.euler_number, t.bounds.round(3).tolist()); assert t.is_watertight and t.body_count == 1 and t.euler_number == 2, 'not one closed sphere (a handle?)'
    B.finish(np.array(t.vertices), np.array(t.faces), out)
def hexes(*s): return np.array([C8(x) for x in s]) / 255.
def ramp(t, stops, cols): return np.stack([np.interp(t, stops, cols[:, i]) for i in range(3)], 1)
def coat_paint(V, N, C, coat, cstops, belly, bellyc, wing, wstops, covc, tail, pattern=None, tipc=None):
    """a generic soft coat: `coat` ramps back (0) to front (1); a belly light; each wing feather ramps root to tip; the tail ramps
    root to tip. pattern(V, c, body, w, t) lays her own marks. All colours are HER art's (passed in), nothing here is a colour."""
    x, y, z = V.T; A = np.abs(x); a = np.arctan2(x, z); f = .5 + .5 * np.cos(a) * np.clip(np.hypot(x, z) / .17, 0, 1)
    c = ramp(f, cstops, coat); bx, by, br = belly
    c = mixc(c, np.tile(bellyc, (len(V), 1)), .85 * ss(1.15, .15, np.sqrt((A / br) ** 2 + ((y - by) / br) ** 2)) * (z > .02))
    if tipc is not None: tip = ss(.006, .030, B.core(np.c_[A, y, z])); c = mixc(c, np.tile(tipc, (len(V), 1)), .5 * tip * (y < .99))     # her lifted feather tips lit
    w, t = B.onw(C), B.ont(C); k, odd, cov, q = B.wp(C); qv = np.c_[A, y]; fr, ft = np.array([f_[0] for f_ in B.FE]), np.array([f_[1] for f_ in B.FE])
    al = np.linalg.norm(qv - fr[k], axis=1) / np.linalg.norm(ft - fr, axis=1)[k]; wc = ramp(al, wstops, wing) * np.where(k % 2, 1.0, .90)[:, None]
    cc = mixc(np.tile(covc[0], (len(V), 1)), covc[1], ss(.0, .05, -B.covert(qv))); uv, _, _ = B.tp(V); tc = ramp(ss(.0, .5, uv[:, 1]), [0, .5, 1], tail)
    out = np.where(w[:, None], np.where((cov < 0)[:, None], cc, wc), np.where(t[:, None], tc, c))
    if pattern is not None: out = pattern(V, out, ~w & ~t, w, t)
    return np.clip(out, 0, 1) * 255
def lay_tufts(core, sp):
    """the base's feather-tip layering as a tool: each (angle from the face, y, length, lift, root radius) becomes a tapered feather
    tip rooted inside HER core at that height and laid down over it (tip `length` lower, lifted `lift` off her). Returns cones."""
    out = []; t = np.linspace(.02, .40, 380)
    for a, y, l, lift, rr in sp:
        d = V3(np.sin(a), 0, np.cos(a)); dd = V3(abs(d[0]), 0, d[2])
        k = np.where(core(dd * t[:, None] + V3(0, y, 0)) < 0)[0]; R0 = t[k[-1]] if len(k) else .1
        k2 = np.where(core(dd * t[:, None] + V3(0, y - l, 0)) < 0)[0]; R1 = t[k2[-1]] if len(k2) else R0
        A_, B_ = dd * (R0 - rr * .62) + V3(0, y, 0), dd * (R1 + lift) + V3(0, y - l, 0); out.append((A_, B_, rr))
    return out
def coat_on(M, d, TU, lo=-9, hi=9, k=.014):
    for a, b, rr in TU:
        if lo < a[1] <= hi: d = su(d, cone(M, a, b, rr, .005), k)
    return d
def rows(spec):
    """rows of tips: [(y, length, lift, root r, [angles in degrees])] -> the lay_tufts list"""
    return [(np.radians(a), y, l, lift, rr) for y, l, lift, rr, ang in spec for a in ang]
