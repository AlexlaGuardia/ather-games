"""M244 sheet 9: ARCVIK's rig = the live CROAKARC skink rig (m202-croakling-pass2 tools/rig_croakarc.py, copied, the changes marked M244):
the same 24 bones + clips; her body from sculpt_croakaw.py arcvik; + an AURA part (the strike + starburst on the root: it stands on the
ground ahead of her) + the m244-quality baked tail springs.
The live header follows.
M202 pass 2: CROAKARC's own skeleton (the Croakling's Storm form as a SKINK: long low trunk slung between splayed legs, head forward,
a long tail curling up at its end, a pointed crest; sculpt_croakarc.py). Off rig_marlotl.py (the M132 quadruped plan, 24 bones, clips
walk / run / idle / sit / lie, solved sit + lie): both gaits a lizard's SPRAWL (diagonal pairs, the spine swinging side to side in an S,
head held level against it, elbows and knees out, the tail sweeping behind), never a hop. The run is a scurry: the same gait, faster,
a deeper swing. The ear bones stay in the plan (it flicks them) and carry nothing: she has no ears. Her lightning tubes (on the unlit
eyes part) are skinned to the nearest body vertex, so they ride the skin; eyes + gem ride the head.
    python rig_croakarc.py -- <in.glb> <out-rigged.glb> <metrics.json>"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.dont_write_bytecode = True
import numpy as np, rigcore as K
sys.path.insert(0, HERE); os.environ['CROAKAW_FORM'] = 'arcvik'; import sculpt_croakaw as AW; SM = AW.SM   # M244
ARGS = sys.argv[sys.argv.index('--') + 1:]; IN, OUT, MET = [os.path.abspath(x) for x in ARGS[:3]]
from plans import quadruped as Q
from rigcore import Pose
H = .40 * 1.4 / .999   # metres per glb unit in game (the base Croakling's GROWN 0.40 m over her glb's 0.999, x the dial 1.4)
SK = {'root': (None, (0, 0, 0)), 'pelvis': ('root', (0, .20, -.30)), 'spine': ('pelvis', (0, .20, -.06)), 'chest': ('spine', (0, .20, .16)), 'neck': ('chest', (0, .22, .27)), 'head': ('neck', (0, .25, .34))}
f, h = SM.L['f'], SM.L['h']
for s, x in (('l', 1), ('r', -1)):
    X = lambda p, x=x: (x * p[0], p[1], p[2])
    SK |= {'ear_' + s: ('head', (x * .10, .33, .42)), 'f%s_up' % s: ('chest', X(f[0])), 'f%s_lo' % s: ('f%s_up' % s, X(f[1])), 'f%s_paw' % s: ('f%s_lo' % s, X(f[2])),
           'h%s_up' % s: ('pelvis', X(h[0])), 'h%s_lo' % s: ('h%s_up' % s, X(h[1])), 'h%s_paw' % s: ('h%s_lo' % s, X(h[2]))}
TL = SM.L['tail']; TP = [TL[0], TL[1], TL[3], TL[5], TL[7]]
for i in range(4): SK['tail%d' % (i + 1)] = ('tail%d' % i if i else 'pelvis', TP[i])
J = lambda b: SK[b][1]
tail = lambda V: (V[:, 2] < -.44) & (np.abs(V[:, 0]) < .16)
legz = lambda V: (np.abs(V[:, 0]) > .10) & (V[:, 1] < .19) & (((V[:, 2] > .10) & (V[:, 2] < .42)) | ((V[:, 2] < -.24) & (V[:, 2] > -.52)))
body = lambda V: ~tail(V) & (V[:, 2] < .32)
hd = lambda V: (V[:, 2] > .22) & ~legz(V)
B = [('pelvis', (0, .20, -.44), (0, .20, -.18), .15, body), ('spine', J('spine'), (0, .20, .06), .15, body), ('chest', (0, .20, .10), (0, .20, .22), .15, body),
     ('neck', (0, .21, .22), (0, .23, .30), .13, lambda V: (V[:, 2] > .14) & ~legz(V)), ('head', (0, .25, .32), (0, .25, .60), .24, hd)]
for s, x in (('l', 1), ('r', -1)):
    fore = lambda V, x=x: (V[:, 0] * x > .09) & (V[:, 2] > .10) & (V[:, 2] < .42) & (V[:, 1] < .20)
    hind = lambda V, x=x: (V[:, 0] * x > .09) & (V[:, 2] < -.22) & (V[:, 2] > -.52) & (V[:, 1] < .20) & ~tail(V)
    B += [('ear_' + s, (x * .10, .33, .42), (x * .12, .36, .40), .01, lambda V: np.zeros(len(V), bool)),
          ('f%s_up' % s, (x * f[0][0], f[0][1], f[0][2]), J('f%s_lo' % s), .055, fore), ('f%s_lo' % s, J('f%s_lo' % s), J('f%s_paw' % s), .046, fore),
          ('f%s_paw' % s, (x * .276, .025, .30), (x * .32, .015, .37), .075, fore),
          ('h%s_up' % s, (x * h[0][0], h[0][1], h[0][2]), J('h%s_lo' % s), .060, hind), ('h%s_lo' % s, J('h%s_lo' % s), J('h%s_paw' % s), .050, hind),
          ('h%s_paw' % s, (x * .286, .025, -.36), (x * .33, .015, -.42), .075, hind)]
B += [('tail%d' % (i + 1), TP[i], TP[i + 1], .20, tail) for i in range(4)]
nb = list(SK); nm = [b[0] for b in B]
RIG = [(nm.index(a + s + '_paw'), (lambda V, x=x, a=a: (V[:, 1] < .045) & (V[:, 0] * x > .20) & ((V[:, 2] > 0) == (a == 'f')))) for a in 'fh' for s, x in (('l', 1), ('r', -1))]
TAU = 2 * np.pi; sm = K.smooth
D = dict(pitch=0, neck=.5, tail=['tail1', 'tail2', 'tail3', 'tail4'], idletail=[0, 0, 0, 0], idlelift=[0, 0, 0, 0], drop={}, stance={p + s: (x * w, z) for s, x in (('l', 1), ('r', -1)) for p, w, z in (('f', .272, .290), ('h', .282, -.370))})
# a salamander's sprawl: diagonal pairs, the spine swinging side to side (wave), the tail sculling behind; the run is the same
# gait, faster, with a deeper swing (no gallop: her legs are short and splayed)
WALK = dict(v=.40, duty=.62, reach=.085, lift=.038, toe=.4, phase=dict(hl=0, fr=.06, hr=.5, fl=.56), beats=2, bob0=.4, bob=.004, dy=-.012, n=24, over=.25, wave=.22, tsw=.26)
RUN = dict(v=1.30, duty=.42, reach=.110, lift=.048, toe=.5, phase=dict(hl=0, fr=0, hr=.5, fl=.5), beats=2, bob0=.4, bob=.005, dy=-.018, n=20, over=.25, wave=.30, tsw=.32)
live = K.Glb(IN).meshes(); parts = {}; m = live['body']; V0 = m['POSITION'].astype(float)
w = K.skin_weights(V0, m['F'], B, 7, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, nb.index(n)] += w[:, i]
W = K.four(W); parts['body'] = dict(m, W=W); eP = live['eyes']['POSITION'].astype(float); eC = live['eyes']['COLOR_0'][:, :3].astype(int)
vein = np.abs(eC - np.array(SM.lin(SM.VEIN)[:3])).max(1) <= 1; e = np.zeros((len(eP), len(nb))); e[:, nb.index('head')] = 1
from scipy.spatial import cKDTree
_, nn = cKDTree(V0).query(eP[vein]); e[vein] = W[nn]; parts['eyes'] = dict(live['eyes'], W=K.four(e)); print('vein verts', vein.sum(), 'of', len(eP))
ax = np.zeros((len(live['aura']['POSITION']), len(nb))); ax[:, nb.index('root')] = 1; parts['aura'] = dict(live['aura'], POSITION=(live['aura']['POSITION'] + np.array([0, .005, 0], np.float32)), W=ax)   # lifted 5 mm: the starburst's tubes sat 4 mm under   # M244: the strike on the ground (root)
LEGS = ('fl', 'fr', 'hl', 'hr'); SOLE = {f: V0[(W[:, nb.index(f + '_paw')] > .5) & (V0[:, 1] < .10)] - np.array(SK[f + '_paw'][1]) for f in LEGS}
LEN = {f: sum(np.linalg.norm(np.array(SK[f + a][1]) - np.array(SK[f + b][1])) for a, b in (('_up', '_lo'), ('_lo', '_paw'))) for f in LEGS}
def clear(f, R):
    """how far the paw joint must rise so a turned paw stays above the ground"""
    return max(0, SK[f + '_paw'][1][1] * -1 - (SOLE[f] @ R.T)[:, 1].min() + .0) if f else 0
def setleg(p, f, z, y, R=np.eye(3), planted=True, x=None, bend=None, cap=1.0):
    hx, hz = D['stance'][f]; t = np.array([hx if x is None else x, SK[f + '_paw'][1][1] + max(y, clear(f, R)), hz + z]); A = p.glob(f + '_up')[1]
    if not planted:                                  # a swinging paw is pulled in to the leg's reach, never the leg out to the paw
        d = t - A; k = np.linalg.norm(d) / (cap * .99 * LEN[f])
        if k > 1: t = A + d / k; t[1] = max(t[1], SK[f + '_paw'][1][1] + clear(f, R))
    sx = 1 if f[1] == 'l' else -1
    return p.leg(f + '_up', f + '_lo', f + '_paw', t, R, bend=bend or ((sx, .55, -.15) if f[0] == 'f' else (sx, .55, .15)), maxstretch=2)
def feet(p, ph, g):
    st = []
    for f, off in g['phase'].items():
        u = (ph + off) % 1
        if u < g['duty'] - 1e-9: st.append(setleg(p, f, g['reach'] * (1 - 2 * u / g['duty']), g.get('plant', 0))); continue
        u = (u - g['duty']) / (1 - g['duty']); r = g['reach']; mm = -2 * r * (1 - g['duty']) / g['duty'] * g['over']
        z = (2*u**3 - 3*u**2 + 1) * -r + (u**3 - 2*u**2 + u) * mm + (3*u**2 - 2*u**3) * r + (u**3 - u**2) * mm
        st.append(setleg(p, f, z, g['lift'] * max(0, np.sin(np.pi * u)) ** 1.2, rx(g['toe'] * np.sin(np.pi * u) * (1 - u) * 2), False))
    return max(st)
def rx(a): return K.rx(a)
def tail(p, lift, sw, ph, side=(0, 0, 0, 0)):
    for i, b in enumerate(D['tail']): p.rot(b, rx(lift[i]), K.ry(side[i] + sw * np.sin(TAU * ph - i * .9) * (.5 + i * .35)))
def walk(g):
    out, st = [], []
    for i in range(g['n'] + 1):
        ph = (i % g['n']) / g['n']; c = np.cos(TAU * 2 * ph + g['bob0']); s = np.sin(TAU * ph); p = Q.stand(SK, D, 0, g['dy'] + g['bob'] * c, 0)
        w = g['wave']; p.rot('pelvis', K.ry(-.6 * w * s), K.rz(.03 * s)); p.rot('spine', K.ry(w * s)); p.rot('chest', K.ry(w * .6 * s)); p.rot('neck', K.ry(-w * .9 * s)); p.rot('head', rx(.02 * c), K.ry(-w * .5 * s))
        Q.ears(p, (.05 if w < .15 else -.22) + .06 * np.sin(TAU * ph * 2 - .8), .04 * s); tail(p, [0, -.03, -.02, -.02], g['tsw'], ph + .25); st.append(feet(p, ph, g)); out.append(p)
    return out, max(st)
PB = W[:, [nb.index(b) for b in nb if b in ('tail2', 'tail3', 'tail4') or b[-3:] in ('_lo', 'paw') or b[0] == 'f']].sum(1) < .25; TB = W[:, [nb.index(b) for b in D['tail']]].sum(1) > .5
def low(p, M): return K.skin(V0[M], W[M], SK, p)[:, 1].min()
def rest(kind, n, pose):
    out, st = [], []
    for i in range(n + 1):
        u = (i % n) / n; br = np.sin(TAU * u * 2); e = sm(0, .10, u) * (1 - sm(.90, 1, u)); look = .5 * (sm(.14, .19, u) - sm(.40, .45, u)) - .45 * (sm(.56, .61, u) - sm(.80, .85, u))
        p = pose(br); p.rot('neck', K.ry(look * .35)); p.rot('head', K.ry(look * .6), K.rz(-.14 * look)); p.rot('chest', rx(.010 * br))
        fl = np.sin(np.pi * np.clip((u - .48) / .05, 0, 1)); p.rot('ear_l', K.rz(-.35 * fl)); p.rot('ear_r', K.rz(.22 * np.sin(np.pi * np.clip((u - .9) / .05, 0, 1))))
        st.append(POST[kind](p, u)); out.append(p)
    return out, max(st)
# sit: on her haunches, forelegs straight under the chest, brush laid round her left side with its tip up
def sitpose(br):
    p = Pose(SK); a = SITA; ch, pv = np.array(SK['chest'][1]), np.array(SK['pelvis'][1]); R = rx(-a); d = ch + np.array([0, SITY, -.035]) - R @ (ch - pv)
    p.R['pelvis'] = R; p.T['pelvis'] = d - pv; p.rot('spine', rx(.05)); p.rot('chest', rx(.05)); p.rot('neck', rx(.12)); p.rot('head', rx(.10)); return p
def sitpost(p, u):
    st = [setleg(p, f, -.035, 0) for f in ('fl', 'fr')] + [setleg(p, f, .10, 0, x=.290 * (1 if f == 'hl' else -1), bend=(.6 if f == 'hl' else -.6, .9, .4)) for f in ('hl', 'hr')]
    sw = .05 * np.sin(TAU * u); tail(p, [SITT[0], SITT[1], SITT[2], SITT[3] + .04 * np.sin(TAU * u * 2)], 0, 0, (.30 + sw * .2, .26 + sw * .6, .22 + sw, .10 + sw)); return max(st)
def liepose(br):
    p = Pose(SK); p.T['root'] = np.array([0, LIEY + .002 * br, 0]); p.R['pelvis'] = rx(.0); p.rot('spine', rx(-.02)); p.rot('chest', rx(-.02)); p.rot('neck', rx(-.04)); p.rot('head', rx(-.02)); return p
def liepost(p, u):
    st = [setleg(p, f, .05, 0, x=.330 * s, bend=(s * .9, .6, -.3)) for f, s in (('fl', 1), ('fr', -1))] + [setleg(p, f, -.04, 0, x=.330 * s, bend=(s * .9, .6, .3)) for f, s in (('hl', 1), ('hr', -1))]
    sw = .04 * np.sin(TAU * u); tail(p, [LIET, -.10, -.30, -.28 + .03 * np.sin(TAU * u * 2)], 0, 0, (.40 + sw * .2, .55 + sw * .5, .55 + sw, .45 + sw)); return max(st)
POST = dict(sit=sitpost, lie=liepost)
# numbers the ground decides: solved, not guessed (rump / belly / brush just touch)
def solve(f, a, b):
    for _ in range(22):
        c = (a + b) / 2; a, b = (a, c) if f(c) > 0 else (c, b)
    return b
SITA = .30; SITY = -.03; SITT = [0, -.12, -.05, 0]; LIEY = -.2; LIET = 0
SITY = -.130
RUMP = W[:, [nb.index('pelvis'), nb.index('spine')]].sum(1) > .5
def _sy(v): global SITY; SITY = v; p = sitpose(0); sitpost(p, 0); return low(p, RUMP) - .006   # the rump SITS (Vulnara's floated ~3 cm)
SITY = solve(_sy, -.30, .15)   # her sit is low: the solve needed room above the Vulnyx's ceiling (it pinned at .02, rump 2 cm under)
def _st(v): global SITT; SITT = [v, -.12, -.05, 0]; return min(low((lambda p: (sitpost(p, u), p)[1])(sitpose(0)), TB) for u in (.25, .75)) - .010
_st(solve(_st, -.1, .8))   # her tail lies along the ground beside her (a wide range found a tail stood straight up)
BODY = W[:, [nb.index(b) for b in ('pelvis', 'spine', 'chest')]].sum(1) > .6
def _ly(v): global LIEY; LIEY = v; p = liepose(-1); liepost(p, 0); return low(p, BODY) - .008
LIEY = solve(_ly, -.36, 0)
def _lt(v): global LIET; LIET = v; return min(low((lambda p: (liepost(p, u), p)[1])(liepose(-1)), TB) for u in (.25, .75)) - .010
_lt(solve(_lt, -.6, 1.6)); p = sitpose(0); sitpost(p, 0); print('rump', low(p, W[:, [nb.index('pelvis'), nb.index('spine')]].sum(1) > .5)); print('solved', SITY, SITT, LIEY, LIET)
def idle(n):
    """a basking skink: low and still, slow breath, the head lifts and glances with holds, the tail tip curls and uncurls, a sideways sweep"""
    out = []
    for i in range(n + 1):
        u = (i % n) / n; br = np.sin(TAU * u * 2); p = Q.stand(SK, D, 0, .004 * br, 0)
        look = .55 * (sm(.12, .16, u) - sm(.38, .42, u)) - .5 * (sm(.55, .59, u) - sm(.82, .86, u)); lift = .10 * (sm(.60, .66, u) - sm(.80, .88, u))
        p.rot('chest', rx(.012 * br)); p.rot('neck', K.ry(look * .30), rx(-lift)); p.rot('head', K.ry(look * .55), K.rz(-.10 * look), rx(-.5 * lift))
        tail(p, [0, 0, -.06 * np.sin(TAU * u), -.14 * np.sin(TAU * u) - .05], .10, u)
        for f in ('fl', 'fr', 'hl', 'hr'): setleg(p, f, 0, 0)
        out.append(p)
    return out
clips, T, st = {}, {}, {}
for n, g, fn in (('walk', WALK, walk), ('run', RUN, walk)): T[n] = 2 * g['reach'] * H / g['duty'] / g['v']; clips[n], st[n] = fn(g)
clips['idle'] = idle(48); T['idle'] = 4.8; clips['sit'], st['sit'] = rest('sit', 48, sitpose); T['sit'] = 5.; clips['lie'], st['lie'] = rest('lie', 48, liepose); T['lie'] = 5.6
for _c in clips.values():   # M244: the live lie drops the ROOT (LIEY); carry that on the pelvis so the root (her ground strike) stays at y = 0
    for _p in _c: _p.T['pelvis'] = _p.T['pelvis'] + _p.T['root']; _p.T['root'] = np.zeros(3)
exec(open(os.path.join(HERE, 'springs.py')).read())   # M244: baked tail springs (m244-quality pass c)
path = OUT; K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; bw = lambda b: (ww * (JJ == P.names.index(b))).sum(1); M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), weights_bad=int((~np.isfinite(ww)).sum()))
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 80; fr = [P.verts('body', P.globals(c, T[c] * k / N)) for k in range(N)]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(f[:, 1].min() for f in fr) * H, 4), rest_lowest_m=round(float(pos[:, 1].min()) * H, 4))
    q = np.array([np.percentile(np.linalg.norm(f[E[ok, 0]] - f[E[ok, 1]], axis=1) / l0[ok], [99, 100]) for f in fr]); d['edge_stretch_p99'], d['edge_stretch_max'] = [round(float(x), 2) for x in q.max(0)]
    if c in st: d['leg_reach_ratio_max'] = round(float(st[c]), 2)
    if c in ('walk', 'run'):
        g = dict(walk=WALK, run=RUN)[c]; dr = 0
        for f, off in g['phase'].items():
            so = (bw(f + '_paw') > .99) & (pos[:, 1] < .025); k = sorted((i for i in range(N) if ((i / N + off) % 1) < g['duty']), key=lambda i: (i / N + off) % 1); A = np.array([fr[i][so] for i in k]) * H; A[:, :, 2] += (g['v'] * np.array([((i / N + off) % 1) * T[c] for i in k]))[:, None]; x = np.linalg.norm((A - A[0])[:, :, [0, 2]], axis=2).max(1); dr = max(dr, x.max())
        d['stride_m'] = round(g['v'] * T[c], 3); d['plays_1to1_at_mps'] = g['v']; d['cadence_at_mps'] = {str(v): round(v / (g['v'] * T[c]), 2) for v in (.55, 1.15, 1.92, g['v'], 4.2, 6.5)}
        d['planted_foot_drift_max_m'] = round(float(dr), 4)
    h = [np.vstack([x, P.verts('eyes', P.globals(c, T[c] * k / N))]) for k, x in enumerate(fr) if k % 8 == 0]; d['length_m'], d['height_m'] = round(float(np.mean([x[:, 2].max() - x[:, 2].min() for x in h])) * H, 3), round(float(np.mean([x[:, 1].max() for x in h])) * H, 3)
    i = int(np.argmin([f[:, 1].min() for f in fr])); k = int(fr[i][:, 1].argmin()); d['lowest_bone'] = P.names[JJ[k][ww[k].argmax()]]
    M[c] = d
tops = [(lambda x: x[:, 1].max() - x[:, 1].min())(P.verts('body', P.globals('idle', T['idle'] * k / 110))) for k in range(110)]; M['body_mean_top'] = round(float(np.mean(tops)), 3)
M['glbLen'] = round(float(np.ptp(pos[:, 2])), 3); M['H'] = H; M['vein_verts'] = int(vein.sum())
json.dump(M, open(MET, 'w'), indent=1); print(json.dumps(M))
