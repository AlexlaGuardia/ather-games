"""M202 the Lepara line (Lepaura / Leparc / Lepore / Lepnix): SHARED TOOLS ONLY.
Every form starts from the BASE Lepara's own sculpt module (docs/looks/m174-lepara-snout-2026-11-27/tools/sculpt_lepara.py, loaded fresh
per form, never edited) and overrides it by NAME in her own sculpt_<form>.py: part functions (body / head / ears / bill / feet / arms /
tail, which the base rig reads for its masks), colours, eye palette, extra colour classes. A change to the base flows into every form on a
rebuild. Lepnix (the canon unicorn divergence) keeps the base's head + face by name on her own four-legged body (see sculpt_lepnix.py).
  S = base()   the base module, fresh;   eye_palette(S, ...) patches its eyes();   build(S, out) runs the base pipeline."""
import sys, os, importlib.util, inspect, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
BASE = os.path.join(HERE, '../../m174-lepara-snout-2026-11-27/tools')
for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), BASE): sys.path.insert(0, p)
from sculpt_v2 import cone, ell, su, ss, cut, glb, normals, V3

def base():
    spec = importlib.util.spec_from_file_location('sculpt_lepara', os.path.join(BASE, 'sculpt_lepara.py')); S = importlib.util.module_from_spec(spec)
    sys.modules['sculpt_lepara'] = S; spec.loader.exec_module(S)
    S.BOUNDS = (V3(-.36, -.033, -.52), V3(.36, 1.07, .40)); S.EXTRA = lambda: []
    src = inspect.getsource(S.eyes); i = src.rindex('    return parts'); src = src[:i] + '    return parts + EXTRA()\n'; S._eyes_src = src
    exec(compile(src, 'lep_eyes', 'exec'), S.__dict__)
    # a form whose ruff / plates touch may carry a tiny tunnel: accept euler <= 2 (closed, one piece), logged as S.EULER
    d = inspect.getsource(S.decimate); a_ = 't.euler_number == 2'; assert a_ in d; exec(compile(d.replace(a_, 't.euler_number <= 2'), 'lep_dec', 'exec'), S.__dict__); S.EULER = 2
    return S

EYE = {'rim': '(92, 66, 58)', 'iris': '(150, 104, 80)', 'pupil': '(38, 24, 22)', 'hi': '(255, 253, 248)', 'nose': '(214, 130, 136)', 'mouth': '(120, 84, 92)', 'lash': '(70, 56, 66)'}
def eye_palette(S, **cols):
    """her own eye colours (rim, iris, pupil, hi), nose and mouth colour. The base rig finds the nose by its colour: Leps keep the base nose colour"""
    src = S._eyes_src
    for k, v in cols.items(): assert EYE[k] in src, k; src = src.replace(EYE[k], str(tuple(v)))
    S._eyes_src = src; exec(compile(src, 'lep_eyes', 'exec'), S.__dict__)

def build(S, out, tris=None, h=.0072):
    import trimesh
    from marching import surface
    lo, hi = S.BOUNDS
    V, F = surface(S.field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number, 'bounds', k.bounds.round(3).tolist()); S.EULER = k.euler_number
    t = S.decimate(k.vertices, k.faces, tris or S.TRIS); X = np.array(t.vertices)
    for _ in range(3): X = X - S.grad(X, 3e-3) * np.clip(S.field(X), -.004, .004)[:, None] * .6
    t = trimesh.Trimesh(X, np.array(t.faces), process=False); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    S.finish(np.array(t.vertices), np.array(t.faces), out, S.eyes())

def marks(fld, w):
    """a colour class from a scalar field: inside where |fld| < w (thin flowing lines), as cut() wants (positive inside, clipped)"""
    return np.clip(w - np.abs(fld), -.05, .05)

def gem(P, c, up, fwd, a, b):
    """a raised four-sided crystal (an octahedron, flat faces): centre c, half-height a along `up`, half-width b; fwd = the face normal"""
    c, up, fwd = V3(*c), V3(*up), V3(*fwd); up /= np.linalg.norm(up); fwd = fwd - (fwd @ up) * up; fwd /= np.linalg.norm(fwd); sd = np.cross(up, fwd)
    q = P - c; return (np.abs(q @ up) / a + np.abs(q @ sd) / b + np.abs(q @ fwd) / (b * .9) - 1) * min(a, b) * .55
