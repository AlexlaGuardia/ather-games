"""Luminara rig + clips on rigcore (M132 s1), the Hovari HOVER contract (M173 s2): python rig_luminara.py -> ../luminara-rigged.glb + ../luminara-metrics.json
She never lands: the bind pose itself hangs at HV over the ground (`b_hover`, which no clip keys, so the game may move it), and every clip stays up there,
exactly as the Hovari does (0.90 m, Alex 11-24 "near eye level"); the game's `hover` rig field beats her wings by TIME on drift / dart.
19 bones: root, hover, hips, abd (the abdomen + its lamp), chest, neck, head, a lid bone an eye (sliding along its facing), and a side: ant + ant2 (the
antenna, the knob on ant2), fore + hind wing, arm. Manner = spirits-species.md "Tiny, bioluminescent, magical. Living light ... The embodiment of wonder"
+ base-forms.md section 6 (the abdomen brightest, pulsing like a tiny sun: the game pulses the `lamp` glow part). Clips under the game's names: idle (hover:
bobs, the abdomen swings like a lantern, antennae sway, looks round, blinks), walk (drift), run (dart: pitched into it, antennae swept back, abdomen trailing),
sit (settled low in the air, arms folded, slow wings), lie (SLEEP in the air: curled, head down, antennae drooped, lids shut, wings barely sculling)."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; [sys.path.insert(0, p) for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), HERE)]
import numpy as np, rigcore as K, sculpt_luminara as S
from rigcore import Pose, rx, ry, rz
GROWN_LEN = .30; HOVER = .90; TAU = 2 * np.pi; sm = K.smooth; mir = np.diag([-1., 1, 1])
live = K.Glb(os.path.join(HERE, '../luminara.glb')).meshes(); m = live['body']; V = m['POSITION'].astype(float); A = np.c_[np.abs(V[:, 0]), V[:, 1:]]
eP = live['eyes']['POSITION'].astype(float); lP = live['lamp']['POSITION'].astype(float)
ALLZ = np.concatenate([V[:, 2], eP[:, 2], lP[:, 2]]); LONG = float(np.ptp(np.concatenate([V[:, 2], lP[:, 2]])))      # nose to tail: the body's length (wings + antennae not counted)
H = GROWN_LEN / LONG; HV = HOVER / H; UP = np.array([0, HV, 0]); print('long', round(LONG, 3), 'H', round(H, 4), 'HV', round(HV, 3))
EL, ENL = S.eye_normal()
SK = {'root': (None, (0, 0, 0)), 'hover': ('root', (0, 0, 0)), 'hips': ('hover', (0, .42, -.02)), 'abd': ('hips', (0, .40, -.06)), 'chest': ('hips', (0, .47, .03)),
      'neck': ('chest', (0, .55, .09)), 'head': ('neck', (0, .62, .17)), 'lids': ('head', tuple(EL)), 'lids_r': ('head', tuple(EL * (-1, 1, 1)))}
AM = S.abz(np.array([.5]))[0]
for s, x in (('l', 1), ('r', -1)):
    X = np.array([x, 1, 1]); SK['ant_' + s] = ('head', tuple(S.A0 * X)); SK['ant2_' + s] = ('ant_' + s, tuple(AM * X))
    SK['fw_' + s] = ('chest', tuple(S.WROOT['f'] * X)); SK['hw_' + s] = ('chest', tuple(S.WROOT['h'] * X)); SK['arm_' + s] = ('chest', tuple(np.array(S.ARM[0]) * X))
SK = {b: (p, tuple(np.array(j) + (UP if p else 0))) for b, (p, j) in SK.items()}
nb = list(SK); ix = nb.index; J = lambda b: np.array(SK[b][1])
AB, HD, TX, AR, LG = S.abdomen(A), S.head(A), S.thorax(A), S.arms(A), S.legs(A); mn = np.min([AB, HD, TX, AR, LG], 0); isp = lambda d: d <= mn + 1e-9
arm = isp(AR); hed = isp(HD) & (V[:, 1] > .50); abd = isp(AB) & ~arm; thx = ~(arm | hed | abd)
g_ = lambda k: (lambda v: k); U = lambda *v: np.array(v, float) + UP; V0 = V + UP
B = [('abd', U(*(S.AC + S.AX * .22)), U(*(S.AC - S.AX * .26)), .26, g_(abd)), ('hips', U(0, .40, -.04), U(0, .44, 0), .12, g_(abd | thx)), ('chest', U(0, .44, .02), U(0, .52, .06), .15, g_(thx)),
     ('neck', U(0, .54, .09), U(0, .57, .12), .10, g_(thx | hed)), ('head', U(0, .64, .18), U(0, .72, .22), .22, g_(hed))]
for s, x in (('l', 1), ('r', -1)):
    sd = V[:, 0] * x > 0; B.append(('arm_' + s, U(*(np.array(S.ARM[0]) * (x, 1, 1))), U(*(S.HAND * (x, 1, 1))), .045, g_(arm & sd)))
w = K.skin_weights(V0, m['F'], B, 6); W = np.zeros((len(V0), len(nb)))
for i, b in enumerate(B): W[:, ix(b[0])] += w[:, i]
W = K.four(W); parts = {'body': dict(m, POSITION=V0.astype(np.float32), W=W)}
eC = live['eyes']['COLOR_0'][:, :3].astype(int); isc = lambda *cs: np.min([np.abs(eC - np.round(255 * (np.array(c) / 255.) ** 2.2)).max(1) for c in cs], 0) <= 1
# the lid caps (head colour + their lash line) sit on the eyes, tucked back by LID: pick them by colour AND by sitting behind the eye surface
lid = isc(tuple(S.HEADC), S.SEAMLIN) & (eP[:, 1] > .62) & (eP[:, 2] > .28)
ant = isc(S.STALK, S.KNOBC, S.KNOBHI); wng = isc(S.MEMB, S.VEIN, S.RIM)
e = np.zeros((len(eP), len(nb))); e[:, ix('head')] = 1
for s, sg in (('lids', 1), ('lids_r', -1)): k = lid & (eP[:, 0] * sg > 0); e[k] = 0; e[k, ix(s)] = 1
TS = np.linspace(0, 1, 201); BZ = S.abz(TS)
for s, x in (('l', 1), ('r', -1)):
    k = ant & (eP[:, 0] * x > 0); P_ = eP[k] * (x, 1, 1); tt = TS[np.argmin(np.linalg.norm(P_[:, None] - BZ[None], axis=2), 1)]; tt = np.where(np.linalg.norm(P_ - S.KNOB, axis=1) < .06, 1, tt)
    k2 = sm(.30, .70, tt); e[k] = 0; e[k, ix('ant_' + s)] = 1 - k2; e[k, ix('ant2_' + s)] = k2
    for wn, b in (('f', 'fw_'), ('h', 'hw_')):
        R0, d, c_, n_, L, Wd = S.WINGS[wn]; q = eP * (x, 1, 1) - R0; on = wng & (eP[:, 0] * x > 0) & (np.abs(q @ n_) < .02) & (q @ d > -.02) & (q @ d < L + .02) & (np.abs(q @ c_) < Wd * 1.3)
        e[on] = 0; e[on, ix(b + s)] = 1
lef = wng & (e[:, ix('head')] > .5); print('lid verts', lid.sum(), 'antenna verts', ant.sum(), 'wing verts', wng.sum(), 'wing verts left on head', lef.sum())
parts['eyes'] = dict(live['eyes'], POSITION=(eP + UP).astype(np.float32), W=K.four(e))
la = np.zeros((len(lP), len(nb))); la[:, ix('abd')] = 1; parts['lamp'] = dict(live['lamp'], POSITION=(lP + UP).astype(np.float32), W=la)
# ── motion ──
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
blink = lambda u, *cs: max(pulse(u, c, c + .024, c + .026, c + .050) for c in cs)
def lids(p, k): p.T['lids'] = ENL * S.LID * k; p.T['lids_r'] = ENL * (-1, 1, 1) * S.LID * k
def wings(p, a, amp=.55, base=0., back=0., amp_h=None, lag=.5):
    """a = the stroke's phase: each wing turns about the body's long axis (up / down) with a little twist; the hind pair runs a touch late"""
    ah = amp if amp_h is None else amp_h
    for s in 'lr':
        Rf = ry(-back) @ rz(base + amp * np.sin(a)) @ rx(.20 * np.cos(a)); Rh = ry(-back * 1.2) @ rz(base * .8 + ah * np.sin(a - lag)) @ rx(.18 * np.cos(a - lag))
        p.R['fw_' + s], p.R['hw_' + s] = (Rf, Rh) if s == 'l' else (mir @ Rf @ mir, mir @ Rh @ mir)
def ants(p, a, b=0., c=0.):
    """a = forward (+) / back (-), b = out, c = the tips' own sway"""
    for s, x in (('l', 1), ('r', -1)): p.rot('ant_' + s, rx(.5 * a), rz(-x * b)); p.rot('ant2_' + s, rx(.6 * a + c), rz(-x * .5 * b))
def arms(p, k, sw=0.):
    for s, x in (('l', 1), ('r', -1)): p.rot('arm_' + s, rx(-.6 * k + sw * x), rz(x * .35 * k))
IDLE = dict(T=2.4, beats=20); D = dict(v=.8, T=.72, beats=6); RUN = dict(v=4., T=.48, beats=5)
def idle(u):
    p = Pose(SK); t = TAU * u; wings(p, TAU * IDLE['beats'] * u); p.T['hips'] = np.array([.010 * np.sin(t), .040 * np.sin(2 * t), .008 * np.cos(t)]); p.R['hips'] = rx(.03 * np.sin(2 * t + .6)) @ rz(.03 * np.sin(t))
    p.rot('abd', rx(.10 * np.sin(2 * t - .9)), ry(.06 * np.sin(t - .5)))
    lk = pulse(u, .10, .16, .30, .36) - pulse(u, .55, .61, .76, .82); p.rot('neck', ry(.14 * lk)); p.rot('head', ry(.24 * lk), rz(.10 * pulse(u, .84, .88, .93, .97)), rx(.03 * np.sin(2 * t)))
    ants(p, .10 * np.sin(2 * t + .4), .06 * np.sin(t), .18 * np.sin(4 * t - .7)); arms(p, .15 + .10 * np.sin(2 * t - .3), .08 * np.sin(2 * t)); lids(p, blink(u, .07, .47, .90)); return p
def drift(u):
    p = Pose(SK); t = TAU * u; wings(p, TAU * D['beats'] * u, back=.08); p.T['hips'] = np.array([.010 * np.sin(t), .025 * np.sin(2 * t), 0]); p.R['hips'] = rx(.22 + .03 * np.sin(2 * t)) @ rz(-.05 * np.sin(t))
    p.rot('abd', rx(-.10 + .06 * np.sin(2 * t - 1.0))); p.rot('neck', rx(-.10)); p.rot('head', rx(-.12)); ants(p, -.20 + .06 * np.sin(2 * t), .05, .12 * np.sin(2 * t - .8)); arms(p, .45); return p
def dart(u):
    p = Pose(SK); t = TAU * u; wings(p, TAU * RUN['beats'] * u, amp=.50, back=.30); p.T['hips'] = np.array([0, .012 * np.sin(2 * t), 0]); p.R['hips'] = rx(.70 + .03 * np.sin(2 * t)) @ rz(.03 * np.sin(t))
    p.rot('abd', rx(-.30 + .04 * np.sin(2 * t - 1.0))); p.rot('neck', rx(-.30)); p.rot('head', rx(-.36)); ants(p, -.75, .10, .05 * np.sin(2 * t)); arms(p, .90); return p
def sit(u):
    p = Pose(SK); t = TAU * u; wings(p, TAU * 9 * u, amp=.40, base=.05); p.T['hips'] = np.array([0, -.30 + .025 * np.sin(2 * t), 0]); p.R['hips'] = rx(-.10 + .02 * np.sin(2 * t))
    p.rot('abd', rx(.20 + .04 * np.sin(2 * t - .8))); lk = pulse(u, .55, .62, .78, .85); p.rot('head', rx(.04 + .02 * np.sin(2 * t)), ry(.18 * lk), rz(.12 * pulse(u, .20, .25, .40, .45)))
    ants(p, .15 + .05 * np.sin(2 * t), .12, .15 * np.sin(4 * t)); arms(p, .95); lids(p, blink(u, .35, .92)); return p
def sleep(u):
    p = Pose(SK); t = TAU * u; wings(p, TAU * 4 * u, amp=.14, base=-.30, back=.55, amp_h=.10); p.T['hips'] = np.array([0, -.42 + .030 * np.sin(t), 0]); p.R['hips'] = rx(.10 + .02 * np.sin(t)) @ rz(.04 * np.sin(t + 1))
    p.rot('abd', rx(.45 + .03 * np.sin(t))); p.rot('neck', rx(.14)); p.rot('head', rx(.18 + .02 * np.sin(t)), rz(.10)); ants(p, .60, -.05, .05 * np.sin(t)); arms(p, 1.1); lids(p, 1); return p
clips, T = {}, {}
for c, fn, k, t in (('idle', idle, 120, IDLE['T']), ('walk', drift, 36, D['T']), ('run', dart, 30, RUN['T']), ('sit', sit, 60, 3.0), ('lie', sleep, 36, 4.4)): clips[c] = wrap(fn, k); T[c] = t
path = os.path.join(HERE, '../luminara-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']
M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), tris=dict(body=len(F), eyes=len(P.m['eyes']['F']), lamp=len(P.m['lamp']['F'])), unit_m=round(H, 4), glb_long=round(LONG, 4), hover_m=HOVER)
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 140; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g) for g in gl]; al = [np.vstack([x, P.verts('eyes', g), P.verts('lamp', g)]) for x, g in zip(fr, gl)]
    d = dict(dur_s=round(T[c], 3), lowest_m=round(min(x[:, 1].min() for x in al) * H, 3), top_m=round(max(x[:, 1].max() for x in al) * H, 3), mean_low=round(float(np.mean([x[:, 1].min() for x in al])), 3), mean_top=round(float(np.mean([x[:, 1].max() for x in al])), 3))
    s = [np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    d['span_m'], d['length_m'] = [round(float(max(np.ptp(x[:, a]) for x in al)) * H, 3) for a in (0, 2)]
    if c in ('walk', 'run'): g = dict(walk=D, run=RUN)[c]; d['stride_m'] = round(g['v'] * g['T'], 3); d['plays_1to1_at_mps'] = g['v']; d['wing_hz_at_1to1'] = round(g['beats'] / g['T'], 1)
    M[c] = d
M['all_lowest_glb'] = round(min(M[c]['lowest_m'] for c in clips) / H, 3); M['all_top_glb'] = round(max(M[c]['top_m'] for c in clips) / H, 3)
json.dump(M, open(os.path.join(HERE, '../luminara-metrics.json'), 'w'), indent=1); [print(k, v) for k, v in M.items()]
