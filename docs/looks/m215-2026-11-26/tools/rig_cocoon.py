"""M215 (Alex 11-26, watching the Dewbear line walk in the gallery): the two LEGLESS cocoon gaits.
  voltbear: "remove the legs and just have it hovering like a thundercloud cocoon". She hangs off the ground in every clip: idle =
            a slow drift and bob with a storm shiver now and then; walk / run = she glides, leaning into the way she goes, arms
            trailing, bobbing once a stride; sit = she settles low; lie = she sinks to a hand's breadth off the ground and dozes.
  tidebear: "like a slug sliding along". Her sole stays on the ground (it is skinned to the root, so no clip lifts it); walk /
            run = a body wave running up her column, a surge forward and back; sit = a slump; lie = she curls over herself.
The skeleton is rig_bear.py's 24 bones (the game, the gallery and spirit-forms.test read the same names), but the eight leg
bones carry nothing: no vertex is weighted to them. Their clips hold them still.
    blender -b -P rig_cocoon.py -- <voltbear|tidebear> <in.glb> <out-rigged.glb> <metrics.json>"""
import sys, os, json, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.dont_write_bytecode = True
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '../../m202-dewbear-line-2026-11-26/tools'))
import numpy as np, rigcore as K
from rigcore import Pose
ARGS = sys.argv[sys.argv.index('--') + 1:]; FORM = ARGS[0]; IN, OUT, MET = [os.path.abspath(x) for x in ARGS[1:4]]
SM = importlib.import_module({'voltbear': 'sculpt_voltbear_hover', 'tidebear': 'sculpt_tidebear_slug'}[FORM]); R = SM.RIG
H = .70; TAU = 2 * np.pi; sm = K.smooth
live = K.Glb(IN).meshes(); m = live['body']; V0 = m['POSITION'].astype(float); EP0 = live['eyes']['POSITION'].astype(float)
# Voltbear: her body set down so its lowest point is y 0 in the bind pose (the glb's height = her body's height, as the prod check
# measures it); every clip then lifts her by HOVER. Tidebear stands on her sole already.
Y0 = float(V0[:, 1].min()) if FORM == 'voltbear' else 0.
V0 = V0 - (0, Y0, 0); EP = EP0 - (0, Y0, 0); m = dict(m, POSITION=V0.astype(np.float32)); eyes = dict(live['eyes'], POSITION=EP.astype(np.float32))
sh = lambda p: (p[0], p[1] - Y0, p[2])
SP = {k: sh(v) for k, v in R['spine'].items()}
SK = {'root': (None, (0, 0, 0)), 'pelvis': ('root', SP['pelvis']), 'spine': ('pelvis', SP['spine']), 'chest': ('spine', SP['chest']), 'neck': ('chest', SP['neck']), 'head': ('neck', SP['head'])}
f, hh, a = [sh(p) for p in SM.L['f']], [sh(p) for p in SM.L['h']], [sh(p) for p in SM.L['arm']]
for s, x in (('l', 1), ('r', -1)):
    X = lambda p, x=x: (x * p[0], max(p[1], .01), p[2])
    SK |= {'ear_' + s: ('chest', X(a[0])), 'f%s_up' % s: ('chest', X(f[0])), 'f%s_lo' % s: ('f%s_up' % s, X(f[1])), 'f%s_paw' % s: ('f%s_lo' % s, X(f[2])),
           'h%s_up' % s: ('pelvis', X(hh[0])), 'h%s_lo' % s: ('h%s_up' % s, X(hh[1])), 'h%s_paw' % s: ('h%s_lo' % s, X(hh[2]))}
t0, t2 = np.array(sh(SM.L['tail'][0])), np.array(sh(SM.L['tail'][2])); TP = [tuple(t0 + (t2 - t0) * k / 3 - (0, 0, .01)) for k in range(5)]
for i in range(4): SK['tail%d' % (i + 1)] = ('tail%d' % i if i else 'pelvis', TP[i])
nb = list(SK)
# masks in the SCULPT's frame (her RIG table), so read them on the unshifted vertices
U = lambda M: (lambda V: M(V + (0, Y0, 0)))
TB_ = R['tailbox']; tail = U(lambda V: (V[:, 2] < TB_[0]) & (np.abs(V[:, 0]) < TB_[1]) & (V[:, 1] < TB_[3]) & (V[:, 1] > TB_[2]))
arm = U(R['arm']); cy = R['crown'] - Y0
SOLE = .085   # Tidebear: her sole (everything under this) rides the root, so it never leaves the ground
sole = (lambda V: V[:, 1] < SOLE) if FORM == 'tidebear' else (lambda V: V[:, 1] < -9)
crown = lambda V: (V[:, 1] > cy) & ~arm(V)
body = lambda V: ~tail(V) & ~arm(V) & ~sole(V)
B = [('pelvis', np.add(SP['pelvis'], (0, -.10, -.06)), np.add(SP['pelvis'], (0, 0, .09)), .34, lambda V: body(V) & (V[:, 1] < cy - .08)),
     ('spine', np.add(SP['spine'], (0, -.04, 0)), np.add(SP['spine'], (0, .01, .08)), .30, lambda V: body(V) & (V[:, 1] < cy - .08)),
     ('chest', np.add(SP['chest'], (0, -.03, .04)), np.add(SP['chest'], (0, .04, .12)), .30, lambda V: body(V) & (V[:, 1] < cy - .06)),
     ('neck', np.add(SP['neck'], (0, -.04, -.03)), np.add(SP['neck'], (0, 0, .06)), .30, lambda V: body(V) & (V[:, 1] > cy - .16) & (V[:, 1] < cy + .02)),
     ('head', np.add(SP['head'], (0, -.06, -.05)), np.add(SP['head'], (0, .02, .05)), .40, crown)]
for s, x in (('l', 1), ('r', -1)):
    B.append(('ear_' + s, (x * a[0][0], a[0][1], a[0][2]), (x * a[2][0], a[2][1] - .06, a[2][2]), .12, lambda V, x=x: arm(V) & (V[:, 0] * x > 0)))
B += [('tail%d' % (i + 1), TP[i], TP[i + 1], .10, tail) for i in range(4)]
if FORM == 'tidebear': B.append(('root', (0, .02, -.40), (0, .02, .30), .40, sole))
nm = [b[0] for b in B]
w = K.skin_weights(V0, m['F'], B, 7, ()); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, nb.index(n)] += w[:, i]
W = K.four(W); parts = {'body': dict(m, W=W)}
nn = np.concatenate([np.argmin(((EP[i:i + 512, None] - V0[None]) ** 2).sum(-1), 1) for i in range(0, len(EP), 512)]); parts['eyes'] = dict(eyes, W=W[nn])
LEGB = [b for b in nb if b[0] in 'fh' and b[1] in 'lr' and '_' in b]
assert W[:, [nb.index(b) for b in LEGB]].sum() == 0, 'a leg bone carries her'
def low(p): return K.skin(V0, W, SK, p)[:, 1].min()
def tailr(p, sw, ph, lift=0):
    for i in range(4): p.rot('tail%d' % (i + 1), K.rx(lift if i == 0 else 0), K.ry(sw * np.sin(TAU * ph - i * .9) * (.5 + i * .35)))

if FORM == 'voltbear':
    HOV = .13   # glb units (9 cm) off the ground standing; bob on top
    def hover(y, rz=0., rx=0.):
        p = Pose(SK); p.T['root'] = np.array([0, y, 0]); p.R['pelvis'] = K.rz(rz) @ K.rx(rx); return p
    def idle(n):
        out = []
        for i in range(n + 1):
            u = (i % n) / n; bob = np.sin(TAU * u * 2); dr = np.sin(TAU * u)
            p = hover(HOV + .022 * bob, .035 * dr, .02 * np.sin(TAU * u * 2 + 1)); p.T['root'][0] = .018 * dr
            # the storm shiver: twice a loop a quick small shake runs through her crown and arms (a flicker of the charge in her)
            k = sm(.30, .32, u) - sm(.38, .40, u) + sm(.78, .80, u) - sm(.84, .86, u); jit = k * np.sin(TAU * u * 60) * .05
            p.rot('chest', K.rz(jit * .5)); p.rot('head', K.rz(jit), K.ry(.12 * (sm(.10, .16, u) - sm(.50, .56, u)) - .1 * (sm(.62, .68, u) - sm(.92, .98, u))))
            p.rot('ear_l', K.rx(-.15 + .10 * bob), K.rz(-.10 - jit * 2)); p.rot('ear_r', K.rx(-.15 + .10 * bob), K.rz(.10 + jit * 2))
            tailr(p, .15, u); out.append(p)
        return out
    def glide(n, tilt, bob, arms, sway):
        out = []
        for i in range(n + 1):
            ph = (i % n) / n; c = np.cos(TAU * ph); s = np.sin(TAU * ph)
            p = hover(HOV + .015 + bob * c, sway * s, tilt + .03 * c); p.rot('pelvis', K.ry(sway * .6 * s))
            p.rot('head', K.rx(-tilt * .45)); p.rot('ear_l', K.rx(-arms - .08 * c), K.rz(-.18)); p.rot('ear_r', K.rx(-arms + .08 * c), K.rz(.18))
            tailr(p, .25, ph, .25); out.append(p)
        return out
    def rest(n, y, nod, arms):
        out = []
        for i in range(n + 1):
            u = (i % n) / n; br = np.sin(TAU * u * 2); p = hover(y + .006 * br, 0, -.03)
            p.rot('head', K.rx(nod + .02 * br)); p.rot('ear_l', K.rx(arms), K.rz(.25)); p.rot('ear_r', K.rx(arms), K.rz(-.25)); tailr(p, .05, u, -.2); out.append(p)
        return out
    STRIDE = dict(walk=.30, run=.55)   # metres of air one glide cycle covers
    clips = {'idle': idle(48), 'walk': glide(24, .20, .012, .35, .05), 'run': glide(20, .34, .018, .70, .07), 'sit': rest(48, .045, .10, -.30), 'lie': rest(48, .018, .22, -.45)}
else:
    def pose(): return Pose(SK)
    def wave(n, amp, surge, sway):
        """a body wave up her column: each joint up the spine bends a beat after the one under it; her middle surges forward and
        back; the sole (root) never moves"""
        out = []
        for i in range(n + 1):
            ph = (i % n) / n; p = pose(); th = TAU * ph
            p.T['pelvis'] = np.array([0, -.012 * (1 - np.cos(th)) * .5, surge * np.sin(th)])
            for k, b in enumerate(('pelvis', 'spine', 'chest', 'neck')): p.rot(b, K.rx(amp * np.sin(th - k * 1.1) * (1 if k < 3 else -.6)), K.rz(sway * np.sin(th - k * 1.1)))
            p.rot('head', K.rx(-amp * .5 * np.sin(th - 4.4))); p.rot('ear_l', K.rx(.08 * np.sin(th - 2))); p.rot('ear_r', K.rx(.08 * np.sin(th - 2)))
            tailr(p, .12, ph); out.append(p)
        return out
    def idle(n):
        out = []
        for i in range(n + 1):
            u = (i % n) / n; br = np.sin(TAU * u * 2); p = pose(); p.T['pelvis'] = np.array([0, .004 * br, 0])
            look = .5 * (sm(.12, .17, u) - sm(.38, .43, u)) - .45 * (sm(.55, .60, u) - sm(.82, .87, u))
            p.rot('spine', K.rz(.025 * np.sin(TAU * u))); p.rot('chest', K.rx(.012 * br)); p.rot('neck', K.ry(look * .10)); p.rot('head', K.ry(look * .22), K.rz(-.05 * look))
            tailr(p, .08, u); out.append(p)
        return out
    def rest(n, sink, bend, side, head):
        out = []
        for i in range(n + 1):
            u = (i % n) / n; br = np.sin(TAU * u * 2); p = pose(); p.T['pelvis'] = np.array([0, -sink + .003 * br, -.02])
            p.rot('pelvis', K.rx(bend * .25)); p.rot('spine', K.rx(bend * .35), K.rz(side * .5)); p.rot('chest', K.rx(bend * .4 + .01 * br), K.rz(side))
            p.rot('neck', K.rx(head * .5)); p.rot('head', K.rx(head * .5)); p.rot('ear_l', K.rz(.15)); p.rot('ear_r', K.rz(-.15)); tailr(p, 0, 0, -.1); out.append(p)
        return out
    STRIDE = dict(walk=.20, run=.36)   # metres of ground one wave covers
    clips = {'idle': idle(48), 'walk': wave(24, .07, .018, .03), 'run': wave(20, .11, .028, .045), 'sit': rest(48, .02, .55, .05, .30), 'lie': rest(48, .03, .95, .30, .45)}
V = dict(walk=.42, run=1.15)   # the RigLook's clipV (CRAGBEAR's), m/s at 1:1
T = {'idle': 4.8, 'sit': 5., 'lie': 5.6, 'walk': STRIDE['walk'] / V['walk'], 'run': STRIDE['run'] / V['run']}
K.write(OUT, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(OUT); M = dict(form=FORM, bones=len(nb), glb_bytes=os.path.getsize(OUT), shifted_y=Y0, bind_top=round(float(V0[:, 1].max()), 4), bind_len=round(float(V0[:, 2].max() - V0[:, 2].min()), 4))
E = K.edges(m['F']); l0 = np.linalg.norm(V0[E[:, 0]] - V0[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 60; fr = [P.verts('body', P.globals(c, T[c] * k / N)) for k in range(N)]; lo = [x[:, 1].min() for x in fr]
    q = np.array([np.percentile(np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok], [99, 100]) for x in fr])
    M[c] = dict(dur_s=round(T[c], 3), lowest_m=round(min(lo) * H, 4), highest_low_m=round(max(lo) * H, 4), top_m=round(float(np.mean([x[:, 1].max() for x in fr])) * H, 3),
                body_h_m=round(float(np.mean([x[:, 1].max() - x[:, 1].min() for x in fr])) * H, 3), edge_stretch_p99=round(float(q[:, 0].max()), 2), edge_stretch_max=round(float(q[:, 1].max()), 2))
json.dump(M, open(MET, 'w'), indent=1); print(json.dumps(M))
