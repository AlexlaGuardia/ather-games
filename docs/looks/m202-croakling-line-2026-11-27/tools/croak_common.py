"""M202 the Croakling line (Croakrill / Croakara / Croakore / Croakarc): SHARED TOOLS ONLY.
Every form starts from the BASE Croakling's own sculpt module (docs/looks/m174-croakling-2026-11-27/tools/sculpt_croakling.py, loaded fresh
per form, never edited) and overrides it by NAME in her own sculpt_<form>.py: landmarks (torso / head / limbs), colours, eye palette, extra
field terms (fronds, warts, crest, tail), colour classes (spots, markings, moss, veins). So a change to the base (Alex has not OK'd it yet)
flows into every form on a rebuild, and each form file lists exactly what she does NOT take from the base.
  S = base()            the base module, fresh;   eye_palette(S, ...) / no_lure(S) patch its eyes();   build(S, out) runs the base pipeline."""
import sys, os, importlib.util, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
BASE = os.path.join(HERE, '../../m174-croakling-2026-11-27/tools')
for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), BASE): sys.path.insert(0, p)
from sculpt_v2 import cone, ell, su, ss, V3

def base():
    spec = importlib.util.spec_from_file_location('sculpt_croakling', os.path.join(BASE, 'sculpt_croakling.py')); S = importlib.util.module_from_spec(spec)
    sys.modules['sculpt_croakling'] = S; spec.loader.exec_module(S)
    S.BOUNDS = (V3(-.60, -.033, -.40), V3(.60, .86, .52)); S.SMILE_Y = .445; S.LURE = True; S.EXTRA = lambda: []
    # the eyes() source, patched so a form can name its smile height, drop the lure and add her own unlit bits (each replacement must apply)
    import inspect; src = inspect.getsource(S.eyes)
    for a, b in (("o_ = V3(0, .445 + .020 * x * x, .05)", "o_ = V3(0, SMILE_Y + .020 * x * x, .05)"),
                 ("    T = np.linspace(0, 1, 19); C = bez(T)", "    if not LURE: return parts + EXTRA()\n    T = np.linspace(0, 1, 19); C = bez(T)")):
        assert a in src, a; src = src.replace(a, b)
    i = src.rindex('    return parts'); src = src[:i] + '    return parts + EXTRA()\n'
    S._eyes_src = src; exec(compile(src, 'croak_eyes', 'exec'), S.__dict__)
    # decimation: one closed, consistently wound surface; a form whose toes / fronds / arms touch may carry a tiny tunnel (euler < 2, logged as S.EULER)
    d = inspect.getsource(S.decimate); a_ = 't.euler_number == 2'; assert a_ in d; exec(compile(d.replace(a_, 't.euler_number <= 2'), 'croak_dec', 'exec'), S.__dict__); S.EULER = 2
    return S

EYE = {'rim': '(70, 150, 96)', 'iris': '(208, 236, 104)', 'pupil': '(10, 14, 16)', 'hi': '(255, 253, 244)', 'hi2': '(226, 246, 214)'}
def eye_palette(S, pupil_ry=1.0, **cols):
    """her own eye colours (rim, iris, pupil, hi, hi2) and pupil shape (ry < 1 = a horizontal toad slit)"""
    src = S._eyes_src
    for k, v in cols.items(): assert EYE[k] in src, k; src = src.replace(EYE[k], str(tuple(v)))
    a = "cap(s, 0, .002 * k, .0360 * k, " + (str(tuple(cols['pupil'])) if 'pupil' in cols else EYE['pupil']) + ", .0036 * k, 2, 20)"
    assert a in src, a; src = src.replace(a, a[:-1] + f", ry={pupil_ry})"); S._eyes_src = src
    exec(compile(src, 'croak_eyes', 'exec'), S.__dict__)

def retip(S):
    """the finger / toe tips follow a moved hand / foot"""
    S.FT_TIPS, S.TOE_TIPS = S.tips(S.HAND, S.FINGERS, .028), S.tips(S.FOOT, S.TOES, .029)

def surf_pts(S, n, seed, keep):
    """n points on the base-ish surface where keep(P) holds (for warts / spots): fibonacci directions from the torso + head centres, ray-cast"""
    rng = np.random.default_rng(seed); out = []
    for c in (S.TC, S.HC):
        k = np.arange(n) + .5; ph = np.arccos(1 - 2 * k / n); th = np.pi * (1 + 5 ** .5) * k
        U = np.c_[np.cos(th) * np.sin(ph), np.cos(ph), np.sin(th) * np.sin(ph)] + rng.normal(0, .05, (n, 3)); U /= np.linalg.norm(U, axis=1, keepdims=True)
        P = S.ray(np.tile(c, (n, 1)), U, .8); out.append(P[keep(P)])
    return np.vstack(out)

def build(S, out, tris=None):
    import trimesh
    from marching import surface
    lo, hi = S.BOUNDS; h = .0075
    V, F = surface(S.field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number, 'bounds', k.bounds.round(3).tolist()); S.EULER = k.euler_number
    t = S.decimate(k.vertices, k.faces, tris or S.TRIS); X = np.array(t.vertices)
    for _ in range(3): X = X - S.grad(X, 3e-3) * np.clip(S.field(X), -.004, .004)[:, None] * .6
    t = trimesh.Trimesh(X, np.array(t.faces), process=False); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    S.finish(np.array(t.vertices), np.array(t.faces), out, S.eyes())

def marks(V, fld, w):
    """a colour class from a scalar field: inside where |fld| < w (thin flowing lines), as cut() wants (positive inside, clipped)"""
    return np.clip(w - np.abs(fld), -.05, .05)
