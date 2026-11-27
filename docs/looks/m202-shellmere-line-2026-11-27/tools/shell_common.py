"""M202 the Shellmere line (Mesamere / Aurmere / Voltmere / Tidemere): SHARED TOOLS ONLY (the Croakling-line route, tools/croak_common.py).
Every form starts from the BASE Shellmere's own sculpt module (docs/looks/m174-shellmere-2026-11-27/tools/sculpt_shellmere.py, loaded fresh
per form, never edited; Alex OK'd it and it is public since M226) and overrides it by NAME in her own sculpt_<form>.py: landmarks (shell
dome SC/SR, head HC, legs LEGS, antennae AB/AT), colours, field terms (dome / rim / plastron / legs / claws / tail ...), colour classes and
the shell marks (runes(), which the base eyes() calls by name). A change to the base flows into all four on a rebuild.
  S = base()   the base module, fresh;   scutes(S, ...) re-seats the scute centres on her dome;   build(S, out) runs the base pipeline."""
import sys, os, importlib.util, inspect, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
BASE = os.path.join(HERE, '../../m174-shellmere-2026-11-27/tools')
for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), BASE): sys.path.insert(0, p)
from sculpt_v2 import cone, ell, su, ss, V3
HC0 = V3(0, .455, .50)

def base():
    spec = importlib.util.spec_from_file_location('sculpt_shellmere', os.path.join(BASE, 'sculpt_shellmere.py')); S = importlib.util.module_from_spec(spec)
    sys.modules['sculpt_shellmere'] = S; spec.loader.exec_module(S)
    S.BOUNDS = (V3(-.52, -.033, -.66), V3(.52, .76, .72)); S.ANT = True
    # eyes(): the eye ray starts from HER head centre (base literal = HC0 + (.090, .035, .020)); ANT = False drops the antennae (each replacement must apply)
    src = inspect.getsource(S.eyes)
    for a, b in (("o = V3(.090, .490, .520)", "o = HC + V3(.090, .035, .020)"), ("    parts += runes()\n", "    parts += runes()\n    if not ANT: return parts\n")):
        assert a in src, a; src = src.replace(a, b)
    S._eyes_src = src; exec(compile(src, 'mere_eyes', 'exec'), S.__dict__)
    d = inspect.getsource(S.decimate); a_ = 't.euler_number == 2'; assert a_ in d; exec(compile(d.replace(a_, 't.euler_number <= 2'), 'mere_dec', 'exec'), S.__dict__); S.EULER = 2
    return S

EYE = {'rim': '(24, 52, 60)', 'iris': '(46, 132, 150)', 'pupil': '(14, 20, 26)', 'hi2': '(200, 236, 236)'}
def eye_palette(S, **cols):
    """her own eye colours (rim, iris, pupil, hi2), patched into the base eyes() source by value"""
    src = S._eyes_src
    for k, v in cols.items(): assert EYE[k] in src, k; src = src.replace(EYE[k], str(tuple(v)))
    S._eyes_src = src; exec(compile(src, 'mere_eyes', 'exec'), S.__dict__)

def scutes(S, vz=(-.24, .02, .27), cx=.25, cz=(-.25, .02, .27), mk=8, my=None):
    """the scute centres on HER dome (vertebrals on the ridge, costals a side, a ring of marginals at the lip): the grooves + rune seats follow"""
    cz_ = lambda x, z: (x, S._dome_y(x, z - S.SC[2]), z)
    S.SCUTES = [cz_(0, S.SC[2] + z) for z in vz] + [cz_(cx, S.SC[2] + z) for z in cz]
    S.MARG = [(.98 * S.SR[0] * np.sin(t), my if my is not None else S.SC[1] - .01, S.SC[2] + .98 * S.SR[2] * np.cos(t)) for t in np.linspace(0, np.pi, mk)]
    S.CEN = np.array(S.SCUTES + S.MARG)

def shell_pt(S, c):
    """the dome surface point toward c from the dome centre"""
    c = np.asarray(c, float); return S.ray(S.SC, (c - S.SC) / np.linalg.norm(c - S.SC), 1.5)[0]

def jag(S, a, b, n, amp, seed):
    """a jagged lightning path on the shell surface from a toward b (directions from the dome centre), n kinks"""
    rng = np.random.default_rng(seed); a, b = np.asarray(a, float), np.asarray(b, float); T = np.linspace(0, 1, n * 3 + 1); P = np.outer(1 - T, a) + np.outer(T, b)
    off = np.zeros_like(P); k = rng.normal(0, amp, (n + 1, 3)); idx = np.arange(0, len(T), 3)
    for d in range(3): off[:, d] = np.interp(np.arange(len(T)), idx, k[:, d])
    off[0] = off[-1] = 0; P = P + off; U = P - S.SC; U /= np.linalg.norm(U, axis=1, keepdims=True); return S.ray(np.tile(S.SC, (len(P), 1)), U, 1.5)

def hull_part(P, col):
    """a closed convex blob (crystal, gem) from points, as an unlit part"""
    import trimesh; t = trimesh.convex.convex_hull(np.asarray(P)); return np.array(t.vertices), np.array(t.faces), col

def build(S, out, tris=None):
    import trimesh
    from marching import surface
    lo, hi = S.BOUNDS; h = .0078
    V, F = surface(S.field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number, 'bounds', k.bounds.round(3).tolist()); S.EULER = k.euler_number
    t = S.decimate(k.vertices, k.faces, tris or S.TRIS); X = np.array(t.vertices)
    for _ in range(3): X = X - S.grad(X, 3e-3) * np.clip(S.field(X), -.004, .004)[:, None] * .6
    t = trimesh.Trimesh(X, np.array(t.faces), process=False); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    S.finish(np.array(t.vertices), np.array(t.faces), out, S.eyes())
