"""M202 Manalotl line: ONE skeleton script for Aurlotl / Arclotl / Craglotl, off rig_marlotl.py (the M132 quadruped plan, 24
bones, walk / run / idle / sit / lie, solved sit + lie). Every joint is placed from HER sculpt's landmarks (L, GILLS, DY), so
each form gets her own skeleton: the ear bones carry each side's gills, the tail bones her tail (Aurlotl's is a stub, Arclotl's a
paddle, Craglotl's short and thick). Her sit pitch is her own (SITA): Aurlotl and Arclotl sit UP, which is the art's standing
pose; Craglotl stays low.
    blender -b -P rig_lotl.py -- <form> <in.glb> <out-rigged.glb> <metrics.json>      (form: aurlotl | arclotl | craglotl)"""
import sys, os, json, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.dont_write_bytecode = True
import numpy as np, rigcore as K
sys.path.insert(0, HERE)
ARGS = sys.argv[sys.argv.index('--') + 1:]; SM = importlib.import_module('sculpt_' + ARGS[0]); IN, OUT, MET = [os.path.abspath(x) for x in ARGS[1:4]]
from plans import quadruped as Q
from rigcore import Pose
H = .69; DY = SM.DY; Lp, Lc, Lh = [np.array(SM.L[k]) - (0, DY, 0) for k in ('pelvis', 'chest', 'head')]
py, cy, hy = Lp[1] - .0, Lc[1] - .0, Lh[1] - .05
SK = {'root': (None, (0, 0, 0)), 'pelvis': ('root', (0, py, Lp[2] + .04)), 'spine': ('pelvis', (0, (py + cy) / 2, (Lp[2] + Lc[2]) / 2)), 'chest': ('spine', (0, cy, Lc[2] - .04)),
      'neck': ('chest', (0, (cy + hy) / 2 + .01, (Lc[2] + Lh[2]) / 2 + .04)), 'head': ('neck', (0, hy, Lh[2] - .08))}
f, h = SM.L['f'], SM.L['h']
ROOTS = np.array([np.array(g[0]) for g in SM.GILLS]); ER = ROOTS.mean(0) - (0, DY, 0); ER[0] = ROOTS[:, 0].min() - .02   # the ear bone: at her gill roots
for s, x in (('l', 1), ('r', -1)):
    X = lambda p, x=x: (x * p[0], p[1], p[2])
    SK |= {'ear_' + s: ('head', (x * ER[0], ER[1], ER[2])), 'f%s_up' % s: ('chest', X(f[0])), 'f%s_lo' % s: ('f%s_up' % s, X(f[1])), 'f%s_paw' % s: ('f%s_lo' % s, X(f[2])),
           'h%s_up' % s: ('pelvis', X(h[0])), 'h%s_lo' % s: ('h%s_up' % s, X(h[1])), 'h%s_paw' % s: ('h%s_lo' % s, X(h[2]))}
TP = [tuple(np.array(p) - (0, DY, 0)) for p in SM.L['tail']]; TZ = TP[0][2]
for i in range(4): SK['tail%d' % (i + 1)] = ('tail%d' % i if i else 'pelvis', TP[i])
J = lambda b: SK[b][1]
GS = lambda V: SM.gills(V)
F0, F2, H0, H2 = f[0], f[2], h[0], h[2]; LY = F0[1] + .015; HZ = Lh[2] - .20; HDY = Lh[1] - DY - .17
tail = lambda V: (V[:, 2] < TZ) & (np.abs(V[:, 0]) < .17)
gillv = lambda V: (GS(V) < .012) & (np.abs(V[:, 0]) > ER[0] - .02)
legz = lambda V: (np.abs(V[:, 0]) > F0[0] - .035) & (V[:, 1] < LY) & (((V[:, 2] > F2[2] - .19) & (V[:, 2] < F2[2] + .15)) | ((V[:, 2] < H2[2] + .14) & (V[:, 2] > H2[2] - .14)))
body = lambda V: ~tail(V) & ~gillv(V) & (V[:, 2] < HZ + .10)
hd = lambda V: (V[:, 2] > HZ) & ~gillv(V) & ~legz(V) & ((V[:, 1] > HDY) | (V[:, 2] > Lh[2] + .02))
B = [('pelvis', (0, py, TZ), (0, py, Lp[2] + .12), .16 + .3 * (Lc[1] > .3) * 0, body), ('spine', J('spine'), (0, (py + cy) / 2, (Lp[2] + Lc[2]) / 2 + .12), .16, body), ('chest', (0, cy, Lc[2] - .10), (0, cy, Lc[2] + .02), .16, body),
     ('neck', (0, (cy + hy) / 2, Lc[2] + .01), (0, (cy + hy) / 2 + .03, Lc[2] + .08), .14, lambda V: (V[:, 2] > Lc[2] - .08) & ~gillv(V) & ~legz(V)), ('head', (0, hy, Lh[2] - .10), (0, hy, Lh[2] + .18), .27, hd)]
for s, x in (('l', 1), ('r', -1)):
    fore = lambda V, x=x: (V[:, 0] * x > F0[0] - .035) & (V[:, 2] > F2[2] - .19) & (V[:, 2] < F2[2] + .15) & (V[:, 1] < F0[1] + .03) & ~gillv(V)
    hind = lambda V, x=x: (V[:, 0] * x > H0[0] - .06) & (V[:, 2] < H2[2] + .16) & (V[:, 2] > H2[2] - .14) & (V[:, 1] < H0[1] + .025) & ~tail(V)
    B += [('ear_' + s, (x * ER[0], ER[1], ER[2]), (x * (ER[0] + .22), ER[1] + .05, ER[2] - .14), .20, lambda V, x=x: gillv(V) & (V[:, 0] * x > 0)),
          ('f%s_up' % s, (x * F0[0], F0[1], F0[2]), J('f%s_lo' % s), .055, fore), ('f%s_lo' % s, J('f%s_lo' % s), J('f%s_paw' % s), .048, fore),
          ('f%s_paw' % s, (x * (F2[0] + .005), .025, F2[2] + .02), (x * (F2[0] + .05), .015, F2[2] + .09), .070, fore),
          ('h%s_up' % s, (x * H0[0], H0[1], H0[2]), J('h%s_lo' % s), .060, hind), ('h%s_lo' % s, J('h%s_lo' % s), J('h%s_paw' % s), .050, hind),
          ('h%s_paw' % s, (x * (H2[0] + .01), .025, H2[2] + .02), (x * (H2[0] + .06), .015, H2[2] - .04), .070, hind)]
B += [('tail%d' % (i + 1), TP[i], TP[i + 1], .22, tail) for i in range(4)]
nb = list(SK); nm = [b[0] for b in B]
MZ = (F2[2] + H2[2]) / 2
RIG = [(nm.index(a + s + '_paw'), (lambda V, x=x, a=a: (V[:, 1] < .045) & (V[:, 0] * x > (F2[0] if a == 'f' else H2[0]) - .06) & ((V[:, 2] > MZ) == (a == 'f')))) for a in 'fh' for s, x in (('l', 1), ('r', -1))]
TAU = 2 * np.pi; sm = K.smooth
D = dict(pitch=0, neck=.5, tail=['tail1', 'tail2', 'tail3', 'tail4'], idletail=[0, 0, 0, 0], idlelift=[0, 0, 0, 0], drop={}, stance={p + s: (x * w, z) for s, x in (('l', 1), ('r', -1)) for p, w, z in (('f', F2[0], F2[2]), ('h', H2[0], H2[2]))})
# a salamander's sprawl: diagonal pairs, the spine swinging side to side (wave), the tail sculling behind; the run is the same
# gait, faster, with a deeper swing (no gallop: her legs are short and splayed)
WALK = dict(v=.30, duty=.66, reach=.070, lift=.035, toe=.4, phase=dict(hl=0, fr=.08, hr=.5, fl=.58), beats=2, bob0=.4, bob=.004, dy=-.018, n=24, over=.25, wave=.13, tsw=.16)
RUN = dict(v=.95, duty=.46, reach=.085, lift=.045, toe=.5, phase=dict(hl=0, fr=0, hr=.5, fl=.5), beats=2, bob0=.4, bob=.006, dy=-.024, n=20, over=.25, wave=.20, tsw=.22)
def eye_weights(E, V0, W, head):
    """the 'eyes' part: eyes, smile and brow marks ride the head bone; a mark on the body (Aurlotl's chest / flank / arm panels)
    takes the weights of the body vertex under it, so it moves with the skin it is drawn on"""
    out = np.zeros((len(E), W.shape[1])); out[:, head] = 1
    for i in range(0, len(E), 2000):
        j = np.argmin(((E[i:i + 2000, None] - V0[None]) ** 2).sum(-1), 1); w = W[j]; body = w[:, head] < .5; out[i:i + 2000][body] = w[body]
    return out
live = K.Glb(IN).meshes(); parts = {}; m = live['body']; V0 = m['POSITION'].astype(float)
w = K.skin_weights(V0, m['F'], B, 7, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, nb.index(n)] += w[:, i]
W = K.four(W); parts['body'] = dict(m, W=W); parts['eyes'] = dict(live['eyes'], W=eye_weights(live['eyes']['POSITION'].astype(float), V0, W, nb.index('head')))
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
    return p.leg(f + '_up', f + '_lo', f + '_paw', t, R, bend=bend or ((0, 0, -1) if f[0] == 'f' else (0, .25, 1)), maxstretch=2)
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
    st = [setleg(p, f, -.035, 0) for f in ('fl', 'fr')] + [setleg(p, f, .10, 0, x=(H2[0] + .03) * (1 if f == 'hl' else -1), bend=(.6 if f == 'hl' else -.6, .9, .4)) for f in ('hl', 'hr')]
    sw = .05 * np.sin(TAU * u); tail(p, [SITT[0], SITT[1], SITT[2], SITT[3] + .04 * np.sin(TAU * u * 2)], 0, 0, (.30 + sw * .2, .26 + sw * .6, .22 + sw, .10 + sw)); return max(st)
def liepose(br):
    p = Pose(SK); p.T['root'] = np.array([0, LIEY + .002 * br, 0]); p.R['pelvis'] = rx(.0); p.rot('spine', rx(-.02)); p.rot('chest', rx(-.02)); p.rot('neck', rx(-.04)); p.rot('head', rx(-.02)); return p
def liepost(p, u):
    st = [setleg(p, f, .05, 0, x=(F2[0] + .07) * s, bend=(s * .9, .6, -.3)) for f, s in (('fl', 1), ('fr', -1))] + [setleg(p, f, -.04, 0, x=(H2[0] + .07) * s, bend=(s * .9, .6, .3)) for f, s in (('hl', 1), ('hr', -1))]
    sw = .04 * np.sin(TAU * u); tail(p, [LIET, -.10, -.30, -.28 + .03 * np.sin(TAU * u * 2)], 0, 0, (.40 + sw * .2, .55 + sw * .5, .55 + sw, .45 + sw)); return max(st)
POST = dict(sit=sitpost, lie=liepost)
# numbers the ground decides: solved, not guessed (rump / belly / brush just touch)
def solve(f, a, b):
    for _ in range(22):
        c = (a + b) / 2; a, b = (a, c) if f(c) > 0 else (c, b)
    return b
SITA = getattr(SM, 'SITA', .30); SITY = -.03; SITT = [0, -.12, -.05, 0]; LIEY = -.2; LIET = 0
SITY = -.130
RUMP = W[:, [nb.index('pelvis'), nb.index('spine')]].sum(1) > .5
def _sy(v): global SITY; SITY = v; p = sitpose(0); sitpost(p, 0); return low(p, RUMP) - .006   # the rump SITS (Vulnara's floated ~3 cm)
SITY = solve(_sy, -.30, .45)   # her sit is low: the solve needed room above the Vulnyx's ceiling (it pinned at .02, rump 2 cm under)
def _st(v): global SITT; SITT = [v, -.12, -.05, 0]; return min(low((lambda p: (sitpost(p, u), p)[1])(sitpose(0)), TB) for u in (.25, .75)) - .010
_st(solve(_st, -.1, .8))   # her tail lies along the ground beside her (a wide range found a tail stood straight up)
BODY = W[:, [nb.index(b) for b in ('pelvis', 'spine', 'chest')]].sum(1) > .6
def _ly(v): global LIEY; LIEY = v; p = liepose(-1); liepost(p, 0); return low(p, BODY) - .008
LIEY = solve(_ly, -.36, 0)
def _lt(v): global LIET; LIET = v; return min(low((lambda p: (liepost(p, u), p)[1])(liepose(-1)), TB) for u in (.25, .75)) - .010
_lt(solve(_lt, -.6, 1.6)); p = sitpose(0); sitpost(p, 0); print('rump', low(p, W[:, [nb.index('pelvis'), nb.index('spine')]].sum(1) > .5)); print('solved', SITY, SITT, LIEY, LIET)
clips, T, st = {}, {}, {}
for n, g, fn in (('walk', WALK, walk), ('run', RUN, walk)): T[n] = 2 * g['reach'] * H / g['duty'] / g['v']; clips[n], st[n] = fn(g)
clips['idle'] = Q.idle(SK, D, 48); T['idle'] = 4.8; clips['sit'], st['sit'] = rest('sit', 48, sitpose); T['sit'] = 5.; clips['lie'], st['lie'] = rest('lie', 48, liepose); T['lie'] = 5.6
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
json.dump(M, open(MET, 'w'), indent=1); print(json.dumps(M))
