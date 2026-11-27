"""Croakling rig + clips on rigcore (M132 s1), the Lepara / Shellmere route.   python rig_croakling.py  -> ../croakling-rigged.glb + ../croakling-metrics.json
19 bones: root, hips, chest, neck, head, a lid bone an eye (each slides along its own eye's facing), throat (the puff), the LURE on three bones
(lure at the head, lure2 mid-stalk, lure3 at the tip with the orb hanging off it), and arm + paw, thigh + foot a side.
Manner = spirits-species.md "Jumpy, vocal, playful ... Goofy energy from throat puffing, eye bulging, mid-hop freeze poses" + base-forms.md section 7
"zero grace, all enthusiasm; the lantern bobs as it hops". Clips under the game's names: idle (breathes, throat puffs, the lantern sways and its orb
swings like a pendulum, looks round, blinks), walk (small hops, the lure trailing and bobbing on each landing), run (long bounds), sit (squats low and
croaks: a big throat puff, lantern perked up), lie (SLEEP: belly flat, legs splayed, lantern drooped down in front of its face, lids shut)."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; [sys.path.insert(0, p) for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), HERE)]
import numpy as np, rigcore as K, sculpt_croakling as S
from rigcore import Pose, rx, ry, rz
GROWN = .40; TAU = 2 * np.pi; sm = K.smooth
EL, ENL = S.eye_normal(); LM = S.bez(np.array([.5]))[0]
SK = {'root': (None, (0, 0, 0)), 'hips': ('root', (0, .15, -.05)), 'chest': ('hips', (0, .30, .02)), 'neck': ('chest', (0, .40, .05)), 'head': ('neck', (0, .48, .06)),
      'lids': ('head', tuple(EL)), 'lids_r': ('head', tuple(EL * (-1, 1, 1))), 'throat': ('chest', (0, .40, .24)),
      'lure': ('head', tuple(S.L0)), 'lure2': ('lure', tuple(LM)), 'lure3': ('lure2', tuple(S.L2))}
for s, x in (('l', 1), ('r', -1)):
    X = np.array([x, 1, 1]); SK['arm_' + s] = ('chest', tuple(np.array(S.ARM[0]) * X)); SK['paw_' + s] = ('arm_' + s, tuple(S.HAND * X))
    SK['thigh_' + s] = ('hips', tuple(np.array((.30, .20, -.08)) * X)); SK['foot_' + s] = ('thigh_' + s, tuple(S.FOOT * X))
J = lambda b: np.array(SK[b][1]); nb = list(SK); ix = nb.index
live = K.Glb(os.path.join(HERE, '../croakling.glb')).meshes(); m = live['body']; V0 = m['POSITION'].astype(float); A0 = np.c_[np.abs(V0[:, 0]), V0[:, 1:]]
TO, HD, TH, AR, HI, PD = S.torso(A0), S.head(A0), S.throat(A0), S.arms(A0), S.hind(A0), S.pads(A0)
mn = np.min([TO, HD, TH, AR, HI, PD], 0); isp = lambda d: d <= mn + 1e-9
dt = lambda C: np.min(np.linalg.norm(A0[:, None] - np.array(C)[None], axis=2), 1); nearhand = dt(S.FT_TIPS) < dt(S.TOE_TIPS)      # each toe pad goes with the limb whose tip it is
arm = (isp(AR) | (isp(PD) & nearhand)) & (A0[:, 1] < .40); hin = (isp(HI) | (isp(PD) & ~nearhand)) & ~arm
hed = isp(HD) & (V0[:, 1] > .43) & ~arm; thr = isp(TH) & ~arm & ~hed & (V0[:, 1] < .43); bod = ~(arm | hin | hed | thr)
g = lambda mask: (lambda V: mask)
B = [('hips', (0, .06, -.05), (0, .24, -.05), .30, g(bod)), ('chest', (0, .26, .02), (0, .40, .05), .24, g(bod | thr)), ('neck', (0, .40, .05), (0, .46, .06), .14, g(bod | hed)),
     ('head', (0, .50, .06), (0, .62, .12), .30, g(hed)), ('throat', (0, .39, .22), (0, .39, .32), .085, g(thr))]; RIG = []
for s, x in (('l', 1), ('r', -1)):
    sd = V0[:, 0] * x > 0; X = np.array([x, 1, 1])
    B += [('arm_' + s, J('arm_' + s), J('paw_' + s), .075, g(arm & sd)), ('paw_' + s, J('paw_' + s), J('paw_' + s) + (0, 0, .08), .07, g(arm & sd & (V0[:, 1] < .08)))]
    RIG.append((len(B) - 1, g(arm & sd & (V0[:, 1] < .035))))
    B += [('thigh_' + s, J('thigh_' + s), J('thigh_' + s) + (J('foot_' + s) - J('thigh_' + s)) * .6, .17, g(hin & sd)), ('foot_' + s, J('foot_' + s), J('foot_' + s) + (0, 0, .14), .10, g(hin & sd & (V0[:, 1] < .07)))]
    RIG.append((len(B) - 1, g(hin & sd & (V0[:, 1] < .035))))
nm = [b[0] for b in B]; w = K.skin_weights(V0, m['F'], B, 6, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, ix(n)] += w[:, i]
W = K.four(W); parts = {'body': dict(m, W=W)}
eP = live['eyes']['POSITION'].astype(float); eC = live['eyes']['COLOR_0'][:, :3].astype(int); isc = lambda *cs: np.min([np.abs(eC - np.round(255 * (np.array(c) / 255.) ** 2.2)).max(1) for c in cs], 0) <= 1
lid = isc(tuple(S.HEADC), S.MOUTH) & (eP[:, 1] > .60); stk = isc(S.STALK); orb = isc(S.BULB, S.CAP)
e = np.zeros((len(eP), len(nb))); e[:, ix('head')] = 1; e[lid & (eP[:, 0] > 0)] = 0; e[lid & (eP[:, 0] > 0), ix('lids')] = 1; e[lid & (eP[:, 0] < 0)] = 0; e[lid & (eP[:, 0] < 0), ix('lids_r')] = 1
TS = np.linspace(0, 1, 201); BZ = S.bez(TS); tt = TS[np.argmin(np.linalg.norm(eP[stk][:, None] - BZ[None], axis=2), 1)]
k1 = sm(.15, .55, tt); k2 = sm(.55, .95, tt); e[stk] = 0; e[stk, ix('lure')] = 1 - k1; e[stk, ix('lure2')] = k1 - k2; e[stk, ix('lure3')] = k2; e[orb] = 0; e[orb, ix('lure3')] = 1
parts['eyes'] = dict(live['eyes'], W=K.four(e)); print('lid verts', lid.sum(), 'stalk verts', stk.sum(), 'orb verts', orb.sum())
TOP = max(V0[:, 1].max(), eP[:, 1].max()); H = GROWN / TOP; print('top', round(TOP, 3), 'H', round(H, 4))
SOLE = {b: V0[W[:, ix(b)] > .5] - J(b) for b in ('foot_l', 'foot_r', 'paw_l', 'paw_r')}; ST = []
def low(p): return min(K.skin(V0, W, SK, p)[:, 1].min(), K.skin(eP, e, SK, p)[:, 1].min())
def plant(p, L, f, z=0, y=0, x=0, R=np.eye(3)):
    """a one-bone limb: it aims at the planted foot / paw and is drawn out or pushed in to reach it"""
    j = J(f); sx = 1 if f.endswith('_l') else -1; c = max(0, -j[1] - (SOLE[f] @ R.T)[:, 1].min()); T = np.array([j[0] + sx * x, j[1] + max(y, c), j[2] + z])
    p.R[L] = np.eye(3); Rp, A = p.glob(L); d0 = j - J(L); R1 = K.align(Rp @ d0, T - A) @ Rp; p.R[L] = Rp.T @ R1; p.T[f] = R1.T @ (T - A) - d0; p.R[f] = R1.T @ R; ST.append(np.linalg.norm(T - A) / np.linalg.norm(d0))
def feet(p, z=0, y=0, x=0, R=np.eye(3), s=('l', 'r')): [plant(p, 'thigh_' + q, 'foot_' + q, z, y, x, R) for q in s]
def paws(p, z=0, y=0, x=0, R=np.eye(3), s=('l', 'r')): [plant(p, 'arm_' + q, 'paw_' + q, z, y, x, R) for q in s]
def lids(p, k): p.T['lids'] = ENL * S.LID * k; p.T['lids_r'] = ENL * (-1, 1, 1) * S.LID * k
def puff(p, k): p.T['throat'] = np.array([0, -.010 * k, .045 * k])
def lure(p, sway, pitch, swing, swing2=0., droop=0.):
    """sway = side to side at the base, pitch = forward (+) / back (-), swing = the orb's pendulum, droop = sags the whole stalk forward and down"""
    p.rot('lure', rx(.45 * droop + .5 * pitch), rz(sway)); p.rot('lure2', rx(.55 * droop + .35 * pitch), rz(.6 * sway)); p.rot('lure3', rx(.35 * droop + swing2), rz(swing))
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
blink = lambda u, *cs: max(pulse(u, c, c + .024, c + .026, c + .050) for c in cs)
def breathe(p, b): p.T['chest'] = np.array([0, .004 * b, 0]); p.rot('chest', rx(-.012 * b))
def idle(u):
    """breathes with little throat flutters, two big puffs, the lantern sways and its orb swings, a look round, blinks"""
    p = Pose(SK); br = np.sin(TAU * u * 3); breathe(p, br)
    pf = max(pulse(u, .30, .34, .38, .42), pulse(u, .44, .48, .52, .56)); puff(p, .25 + .15 * np.sin(TAU * u * 12) * (1 - pf) + .75 * pf)
    lk = pulse(u, .10, .16, .26, .32) - pulse(u, .62, .68, .78, .84); p.rot('neck', ry(.12 * lk)); p.rot('head', ry(.22 * lk), rx(-.06 * pf + .01 * br), rz(.08 * pulse(u, .86, .89, .93, .96)))
    lure(p, .14 * np.sin(TAU * u * 2) - .10 * lk, .10 * np.sin(TAU * u * 3 + .7) - .12 * pf, .30 * np.sin(TAU * u * 4 - .9), .20 * np.sin(TAU * u * 3 - 1.4))
    lids(p, max(blink(u, .07, .36, .58, .90), .5 * pulse(u, .44, .47, .52, .55))); paws(p); feet(p); return p
WALK = dict(v=.55, duty=.45, reach=.080, n=24); RUN = dict(v=2.4, duty=.24, reach=.150, n=30)
def hop(u, G, hgt, lean, sq, arms_, lift):
    """everything planted for `duty`, then the body springs off the hind feet, hands reach forward, lands; the lantern trails and bobs"""
    p = Pose(SK); d = G['duty']; r = G['reach']; k = u % 1
    if k < d: q = k / d; air = 0; drop = sq * np.sin(np.pi * q); zf = r * (1 - 2 * q); yf = 0
    else: q = (k - d) / (1 - d); air = np.sin(np.pi * q); drop = 0; zf = -r + 2 * r * sm(.05, .95, q); yf = hgt * air * .85
    p.T['root'] = np.array([0, hgt * air - drop + lift, 0]); p.R['root'] = rx(lean * (np.sin(TAU * k - .6) * .8 + .2))
    p.rot('neck', rx(-lean * .4)); p.rot('head', rx(-lean * .5 - .05 * np.sin(TAU * k - .3))); puff(p, .2 + .3 * drop / max(sq, 1e-6))
    land = np.sin(TAU * k + 1.2); lure(p, .06 * np.sin(TAU * k), -.35 * air + .22 * drop / max(sq, 1e-6), .10 * np.sin(TAU * k), .45 * land * (.5 + .5 * air) + .25 * drop / max(sq, 1e-6))
    feet(p, zf, yf, .004, rx(-.5 * air * (k >= d))); paws(p, zf + arms_ * air * .5, yf * (1 + arms_), 0, rx(-.4 * air * (k >= d)))
    lids(p, .25 * drop / max(sq, 1e-6)); return p
walk = lambda u: hop(u, WALK, .060, .10, .012, .25, .020)
run = lambda u: hop(u, RUN, .110, .22, .015, .30, .055)
def ground(p, aim=0):
    l = low(p); p.T['root'] = p.T['root'] + np.array([0, aim - l, 0]); return p
def sit(u):
    """squats low and croaks: the throat swells big three times, the lantern perks up and jiggles with each croak, eyes squeeze"""
    p = Pose(SK); br = np.sin(TAU * u * 2); p.T['hips'] = np.array([0, -.03, -.01]); p.rot('hips', rx(.04)); breathe(p, br)
    cr = max(pulse(u, c, c + .04, c + .08, c + .13) for c in (.12, .30, .48)); puff(p, .3 + 1.25 * cr)
    lk = pulse(u, .62, .68, .80, .86); p.rot('neck', rx(-.06 * cr), ry(.10 * lk)); p.rot('head', rx(-.12 * cr + .01 * br), ry(.20 * lk))
    lure(p, .10 * np.sin(TAU * u * 3) + .08 * lk, -.25 * cr - .10, .25 * np.sin(TAU * u * 9) * cr + .12 * np.sin(TAU * u * 2), -.30 * cr)
    lids(p, max(.6 * cr, blink(u, .70, .93))); paws(p, 0, 0, .01); feet(p, -.01, 0, .02); return ground(p, 0)
def lie(u):
    """asleep: belly flat on the ground, legs splayed out, chin down, the lantern drooped forward in front of the face, slow puffs, lids shut"""
    p = Pose(SK); br = np.sin(TAU * u); p.T['hips'] = np.array([0, -.05, 0]); p.T['chest'] = np.array([0, -.04 + .004 * br, .01]); p.rot('chest', rx(.06)); p.rot('neck', rx(.10))
    p.rot('head', rx(.10 + .01 * br)); puff(p, .15 + .25 * (br + 1) / 2); lure(p, .05, 0, .04 * br, 0, 1.0); lids(p, 1)
    paws(p, .05, 0, .06); feet(p, .03, 0, .05); return ground(p, 0)
clips, T, R = {}, {}, {}
for n, fn, k, t in (('idle', idle, 48, 8.), ('walk', walk, WALK['n'], 2 * WALK['reach'] * H / WALK['duty'] / WALK['v']), ('run', run, RUN['n'], 2 * RUN['reach'] * H / RUN['duty'] / RUN['v']), ('sit', sit, 44, 6.), ('lie', lie, 20, 4.4)):
    ST.clear(); clips[n] = wrap(fn, k); T[n] = t; R[n] = max(ST); print(n, 'leg reach', round(min(ST), 2), round(max(ST), 2))
path = os.path.join(HERE, '../croakling-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), tris=dict(body=len(F), eyes=len(P.m['eyes']['F'])), height_m=H)
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 110; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g_) for g_ in gl]; ef = [P.verts('eyes', g_) for g_ in gl]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(min(x[:, 1].min(), y[:, 1].min()) for x, y in zip(fr, ef)) * H, 4))
    s = [np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    i = int(np.argmax([x.max() for x in s])); k = int(s[i].argmax()); vv = E[ok][k][0]; d['worst_edge_at'] = [P.names[JJ[vv][ww[vv].argmax()]], *np.round(pos[vv], 2).tolist()]
    d['leg_reach_ratio_max'] = round(float(R[c]), 2); d['mean_top'] = round(float(np.mean([max(x[:, 1].max(), y[:, 1].max()) for x, y in zip(fr, ef)])), 3)
    if c in ('walk', 'run'):
        G = WALK if c == 'walk' else RUN; dr = 0
        for fs in ('foot_l', 'foot_r', 'paw_l', 'paw_r'):
            J_ = P.names.index(fs); so = np.where((pos[:, 1] < .03) & ((ww * (JJ == J_)).sum(1) > .97))[0]; A = []
            for k in np.linspace(.002, G['duty'] - .002, 24): t = k * T[c]; x = P.verts('body', P.globals(c, t))[so] * H; x[:, 2] += G['v'] * k * T[c]; A.append(x)
            A = np.array(A); dr = max(dr, float(np.linalg.norm((A - A[0])[:, :, [0, 2]], axis=2).max()))
        d['planted_foot_drift_max_m'] = round(dr, 4); v = G['v']; d['stride_m'] = round(v * T[c], 3); d['plays_1to1_at_mps'] = v; d['cadence_at_mps'] = {str(q): round(q / (v * T[c]), 2) for q in (.55, 1.15, 1.92, 2.8, 4.2, 6.5, 9)}
    d['span_m'], d['length_m'], d['top_m'] = [round(float(max(f(x) for x in fr + ef)) * H, 3) for f in (lambda x: np.ptp(x[:, 0]), lambda x: np.ptp(x[:, 2]), lambda x: x[:, 1].max())]; M[c] = d
json.dump(M, open(os.path.join(HERE, '../croakling-metrics.json'), 'w'), indent=1); [print(k, v) for k, v in M.items()]
