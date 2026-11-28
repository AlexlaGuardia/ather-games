"""M202 v2: the GROUND rig for the two EGG forms (Luminore, Luminix): python rig_lum_ground.py <luminore|luminix>
  -> ../<form>-rigged.glb + ../<form>-metrics.json
Alex 11-28: they lose their flight ("like it turned into an egg form before awakening"). So NO hover (the Hovari contract is OFF for these two:
no b_hover, no wing bones, nothing hangs in the air): the bind pose stands her feet on the ground (y = 0) and every clip keeps her there.
13 bones: root, hips (low in the egg: she rocks round her bottom), abd (the belly + its lamp), chest, neck, head, a lid bone an eye (sliding
along its facing, the base's lid), and a leg a side (her stubby feet, children of the ROOT so a planted foot stays planted while the egg rocks).
In the BASE Luminara's unit (0.3438 m per glb unit) like the rest of the line, so the game sizes her as the base x her dial (1.5).
Clips under the game's names: idle (stands, breathes, rocks a little, looks round, blinks), walk (a WADDLE: the egg rocks side to side onto
each foot in turn, the other foot patters forward), run (a quick SCOOT: leaned in, small fast steps, the rock smaller), sit (settles her
bottom down onto the ground, feet out in front), lie (asleep: tipped onto her side on the ground, eyes shut, feet tucked).
GROUND CLEARANCE, every frame of every clip: her lowest point (body / unlit parts / lamp) is solved onto the ground (root lifted by any
dip below 0), and the body (not the feet) is held at least BODY_CLR over it (hips lifted), so nothing sinks and nothing floats.
Deco parts (S.DECO colours on the unlit part: crystals, moss, swirls, bubbles, the hatch line) skin to the nearest body vertex (rig_lum.py's rule)."""
import sys, os, importlib, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, HERE)
FORM = sys.argv[1]; S = importlib.import_module('sculpt_' + FORM).S
import lum_common as C, rigcore as K
from rigcore import Pose, rx, ry, rz
from scipy.spatial import cKDTree
UNIT = .30 / .8725; TAU = 2 * np.pi; sm = K.smooth; BODY_CLR = .012
D = os.path.join(HERE, '..'); GLB_IN, GLB_OUT, MET_OUT = (os.path.join(D, f'{FORM}{x}') for x in ('.glb', '-rigged.glb', '-metrics.json'))
live = K.Glb(GLB_IN).meshes(); m = live['body']; V = m['POSITION'].astype(float); A = np.c_[np.abs(V[:, 0]), V[:, 1:]]
eP = live['eyes']['POSITION'].astype(float); lP = live['lamp']['POSITION'].astype(float)
LONG = float(np.ptp(np.concatenate([V[:, 2], lP[:, 2]]))); Y0 = float(V[:, 1].min()); UP = np.array([0, -Y0, 0])   # her feet on the ground
EL, ENL = S.eye_normal(); DH = S.HC - C.HC0; HC = np.array(S.HC)
SK = {'root': (None, (0, 0, 0)), 'hips': ('root', (0, Y0 + .10, .02)), 'abd': ('hips', tuple(S.AC)), 'chest': ('hips', (0, .47, .05)),
      'neck': ('chest', tuple(DH * .5 + (0, .55, .09))), 'head': ('neck', tuple(HC - (0, .02, .02))), 'lids': ('head', tuple(EL)), 'lids_r': ('head', tuple(EL * (-1, 1, 1)))}
for s, x in (('l', 1), ('r', -1)): SK['leg_' + s] = ('root', tuple(np.array(S.LEG[0]) * (x, 1, 1)))
SK = {b: (p, tuple(np.array(j) + UP)) for b, (p, j) in SK.items()}
nb = list(SK); ix = nb.index; V0 = V + UP; U = lambda *v: np.array(v, float) + UP
AB, HD, TX, LG = S.abdomen(A), S.head(A), S.thorax(A), S.legs(A); mn = np.min([AB, HD, TX, LG], 0); isp = lambda d: d <= mn + 1e-9
leg = isp(LG) & (V[:, 1] < S.LEG[0][1] + .02); hed = isp(HD) & (V[:, 1] > HC[1] - .12); abd = isp(AB) & ~leg & ~hed; thx = ~(leg | hed | abd)
g_ = lambda k: (lambda v: k)
B = [('abd', U(*(S.AC + S.AX * .20)), U(*(S.AC - S.AX * .22)), .30, g_(abd)), ('hips', U(0, Y0 + .06, 0), U(0, Y0 + .14, 0), .20, g_(abd | leg)),
     ('chest', U(0, .44, .03), U(0, .52, .07), .20, g_(thx)), ('neck', U(*(DH * .5 + (0, .54, .09))), U(*(DH * .5 + (0, .57, .12))), .14, g_(thx | hed)),
     ('head', U(*(HC - (0, .02, .02))), U(*(HC + (0, .08, .02))), .25, g_(hed))]
for s, x in (('l', 1), ('r', -1)): B.append(('leg_' + s, U(*(np.array(S.LEG[0]) * (x, 1, 1))), U(*(S.FOOTL * (x, 1, 1))), .07, g_(leg & (V[:, 0] * x > 0))))
w = K.skin_weights(V0, m['F'], B, 6); W = np.zeros((len(V0), len(nb)))
for i, b in enumerate(B): W[:, ix(b[0])] += w[:, i]
W = K.four(W)
eC = live['eyes']['COLOR_0'][:, :3].astype(int); isc = lambda *cs: np.min([np.abs(eC - np.round(255 * (np.array(c) / 255.) ** 2.2)).max(1) for c in cs], 0) <= 1
lid = isc(tuple(S.HEADC), S.SEAMLIN) & (eP[:, 1] > EL[1] - .04) & (eP[:, 2] > EL[2] - .05)
e = np.zeros((len(eP), len(nb))); e[:, ix('head')] = 1
for s, sg in (('lids', 1), ('lids_r', -1)): k = lid & (eP[:, 0] * sg > 0); e[k] = 0; e[k, ix(s)] = 1
dk = isc(*S.DECO); e[dk] = W[cKDTree(V).query(eP[dk])[1]]; print('lid verts', int(lid.sum()), 'deco verts', int(dk.sum()))
la = np.zeros((len(lP), len(nb))); la[:, ix('abd')] = 1
parts = {'body': dict(m, POSITION=V0.astype(np.float32), W=W), 'eyes': dict(live['eyes'], POSITION=(eP + UP).astype(np.float32), W=K.four(e)),
         'lamp': dict(live['lamp'], POSITION=(lP + UP).astype(np.float32), W=la)}
PV = {p: (parts[p]['POSITION'].astype(float), parts[p]['W']) for p in parts}
notleg = W[:, ix('leg_l')] + W[:, ix('leg_r')] < .5
# ── motion ──
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
blink = lambda u, *cs: max(pulse(u, c, c + .024, c + .026, c + .050) for c in cs)
def lids(p, k): p.T['lids'] = ENL * S.LID * k; p.T['lids_r'] = ENL * (-1, 1, 1) * S.LID * k
def feet(p, l, r):
    """l / r = (lift, forward, out-turn) a foot: lift + forward in glb units, the foot pitched a touch with its lift"""
    for s, (h, f, o) in (('l', l), ('r', r)): p.T['leg_' + s] = np.array([0, h, f]); p.R['leg_' + s] = rx(-2.5 * h) @ ry((1 if s == 'l' else -1) * o)
def ground(p):
    """the clearance solve: her lowest point onto the ground (root up by any dip), then the body held BODY_CLR over it (hips up)"""
    for _ in range(3):
        X = {q: K.skin(PV[q][0], PV[q][1], SK, p) for q in PV}
        lo = min(X[q][:, 1].min() for q in X)
        if lo < 0: p.T['root'] = p.T['root'] + (0, -lo, 0); continue
        bl = min(X['body'][notleg, 1].min(), X['lamp'][:, 1].min()); gl = min(X['body'][~notleg, 1].min(), X['eyes'][:, 1].min())
        need = BODY_CLR + min(0., gl) - bl
        if need > 1e-4: p.T['hips'] = p.T['hips'] + (0, need, 0); continue
        break
    return p
IDLE_T, WALK, RUN = 2.6, dict(T=.56, s=.085), dict(T=.40, s=.11)   # s = a foot's half sweep (glb): she covers 4 s a cycle
for g in (WALK, RUN): g['v'] = round(4 * g['s'] * UNIT / g['T'], 4)   # m/s at 1:1 (base unit): the game's clipV = v / UNIT
def idle(u):
    p = Pose(SK); t = TAU * u; p.R['hips'] = rz(.035 * np.sin(t)) @ rx(.015 * np.sin(2 * t)); p.rot('abd', rx(.03 * np.sin(2 * t - .8)))
    p.T['chest'] = np.array([0, .006 * np.sin(2 * t), 0])                                                  # a breath
    lk = pulse(u, .10, .16, .30, .36) - pulse(u, .55, .61, .76, .82); p.rot('neck', ry(.10 * lk)); p.rot('head', ry(.22 * lk), rz(.08 * pulse(u, .84, .88, .93, .97)))
    feet(p, (0, 0, .05), (0, 0, .05)); lids(p, blink(u, .07, .47, .90)); return ground(p)
def waddle(u, g, lean, rock, yaw, hop):
    p = Pose(SK); t = TAU * u; c = np.cos(t); sn = np.sin(t)
    # a foot is down for half the cycle (sliding back under her, -s..+s reversed), up for the other half (swinging forward)
    def foot(ph):
        ph %= 1; down = ph < .5; k = ph / .5 if down else (ph - .5) / .5
        return (0., g['s'] * (1 - 2 * k), .05) if down else (hop * np.sin(np.pi * k), g['s'] * (2 * k - 1), .05)
    l, r = foot(u), foot(u + .5)
    p.R['hips'] = rx(lean) @ rz(rock * sn) @ ry(yaw * sn); p.T['hips'] = np.array([.010 * sn, .010 * abs(np.cos(t)), 0])  # rocks onto the planted foot
    p.rot('head', rz(-.5 * rock * sn), rx(-.4 * lean)); feet(p, l, r); lids(p, blink(u, .60) if lean < .1 else 0); return ground(p)
walk = lambda u: waddle(u, WALK, .06, .14, .10, .040)
run = lambda u: waddle(u, RUN, .22, .08, .06, .050)
def sit(u):
    p = Pose(SK); t = TAU * u; p.T['hips'] = np.array([0, -.06, 0]); p.R['hips'] = rx(-.10 + .015 * np.sin(2 * t))
    p.T['chest'] = np.array([0, .006 * np.sin(2 * t), 0]); lk = pulse(u, .55, .62, .78, .85); p.rot('head', rx(.05), ry(.18 * lk), rz(.10 * pulse(u, .20, .25, .40, .45)))
    feet(p, (.010, .07, .25), (.010, .07, .25)); lids(p, blink(u, .35, .92)); return ground(p)
def sleep(u):
    p = Pose(SK); t = TAU * u; p.T['hips'] = np.array([.04, -.08, 0]); p.R['hips'] = rz(-.38 + .015 * np.sin(t)) @ rx(-.08)
    p.T['chest'] = np.array([0, .005 * np.sin(t), 0]); p.rot('head', rx(.16 + .02 * np.sin(t)), rz(.10)); feet(p, (.02, -.02, .35), (.03, -.02, .35)); lids(p, 1); return ground(p)
clips, T = {}, {}
for c, fn, k, t in (('idle', idle, 120, IDLE_T), ('walk', walk, 36, WALK['T']), ('run', run, 30, RUN['T']), ('sit', sit, 60, 3.0), ('lie', sleep, 44, 4.4)): clips[c] = wrap(fn, k); T[c] = t
K.write(GLB_OUT, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(GLB_OUT); pos = P.m['body']['POSITION']; F = P.m['body']['F']
M = dict(form=FORM, ground=True, bones=len(nb), glb_bytes=os.path.getsize(GLB_OUT), tris=dict(body=len(F), eyes=len(P.m['eyes']['F']), lamp=len(P.m['lamp']['F'])), unit_m=round(UNIT, 4), glb_long=round(LONG, 4))
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 140; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g) for g in gl]; al = [np.vstack([x, P.verts('eyes', g), P.verts('lamp', g)]) for x, g in zip(fr, gl)]
    d = dict(dur_s=round(T[c], 3), lowest_glb=round(min(x[:, 1].min() for x in al), 4), body_lowest_glb=round(min(x[:, 1].min() for x in fr), 4), mean_low=round(float(np.mean([x[:, 1].min() for x in al])), 4),
             top_glb=round(max(x[:, 1].max() for x in al), 3), mean_top=round(float(np.mean([x[:, 1].max() for x in al])), 3))
    s = [np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    if c in ('walk', 'run'): g = dict(walk=WALK, run=RUN)[c]; d['plays_1to1_at_mps'] = g['v']; d['stride_glb'] = round(4 * g['s'], 3)
    M[c] = d
M['body_mean_top'] = round(float(np.mean([np.ptp(P.verts('body', P.globals('idle', T['idle'] * k / 120))[:, 1]) for k in range(120)])), 3)
lo, hi = np.full(3, 9.), np.full(3, -9.)
for c in clips:
    for k in range(60): g = P.globals(c, T[c] * k / 60); X = np.vstack([P.verts(q, g) for q in ('body', 'eyes', 'lamp')]); lo = np.minimum(lo, X.min(0)); hi = np.maximum(hi, X.max(0))
M['bounds'] = dict(min=[round(float(x), 3) for x in lo], max=[round(float(x), 3) for x in hi])
json.dump(M, open(MET_OUT, 'w'), indent=1); [print(k, v) for k, v in M.items()]
