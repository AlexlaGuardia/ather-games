"""M244 sheet 16: CRAGKOR's rig (rig_arcaw.py copied, sculpt_cragaw.py swapped in; idle = the 'kor' braced stance). Sheet 15's notes: ARCLOTAR / ARCLELLE / ARCIS's rig = sheet 11's rig_croakalys.py (sheet 9's UPRIGHT ground biped), copied: Arclotl's awakened
sculpt module (sculpt_arcaw.py) swapped in, the lotl world scale, each her own idle (Arclotar braced, claws flexing; Arclelle dancing on ONE foot,
the other knee lifted, a slow twirl; Arcis crouched in her orb, hands out): ARCAW_FORM=<tar|elle|cis> python rig_arcaw.py <in.glb> <out-rigged.glb> <metrics.json>. Her eyes part (eyes,
smile, lure stalk + bud) rides the head. Sheet 9's notes follow.
-> rigged glb + metrics. A ground biped off rig_lumore.py (sheet 7), in the croak unit space (the base Croakling's
grown 0.40 m over her 0.999 glb), plus a four-bone TAIL. Bones: root, pelvis, spine, chest, neck, head, arm_l / farm_l / arm_r / farm_r,
leg_l / shin_l / leg_r / shin_r, tail1-4, + one motif bone per aura carrier (m_chest / m_head; Croakarcun's floating lure rides 'float', a
child of the root that bobs on its own). GROUND every frame: the PELVIS carries her height, solved so her lowest point (body, eyes, motif)
sits on the ground; the root never moves. Baked springs (m244-quality 14c9850b pass c) on the tail chain."""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, HERE)
import sculpt_cragaw as F
FORM = F.FORM
sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools'))
import rigcore as K
from rigcore import Pose, rx, ry, rz
from scipy.spatial import cKDTree
NAME = F.NAME
DIAL = dict(kor=1.85)[FORM]; UNIT = .90 * 1.4 / 1.92; TAU = 2 * np.pi; sm = K.smooth; P_ = F.P_   # UNIT: the lotl number space (Marlotl's dial 1.4 over the Manalotl's 0.90 m, per her 1.92 glb)
GLB_IN, GLB_OUT, MET_OUT = sys.argv[1:4]
live = K.Glb(GLB_IN).meshes(); m = live['body']; V = m['POSITION'].astype(float); A = np.c_[np.abs(V[:, 0]), V[:, 1:]]
eP = live['eyes']['POSITION'].astype(float); aP = live['aura']['POSITION'].astype(float)
HC = F.HC; HIP, KNEE, ANK = P_['HIP'], P_['KNEE'], P_['ANK']; TC = F.TCU
TJ = [tuple(TC[i, :3]) for i in (0, len(TC) // 4, len(TC) // 2, 3 * len(TC) // 4)]
SK = {'root': (None, (0, 0, 0)), 'pelvis': ('root', (0, HIP[1], -.02)), 'spine': ('pelvis', tuple(V3 := np.array(P_['trunk'][0]))), 'chest': ('spine', tuple(P_['chest'][0])),
      'neck': ('chest', tuple(HC - (0, .12 * F.HS, .06 * F.HS))), 'head': ('neck', tuple(HC - (0, .02, .02)))}
for s, x in (('l', 1), ('r', -1)):
    X = np.array((x, 1, 1)); sho, elb = (P_['SHO'], P_['ELB']) if s == 'l' else (P_['SHO2'], P_['ELB2'])
    SK['arm_' + s] = ('chest', tuple(sho * X)); SK['farm_' + s] = ('arm_' + s, tuple(elb * X))
    SK['leg_' + s] = ('pelvis', tuple(HIP * X)); SK['shin_' + s] = ('leg_' + s, tuple(KNEE * X))
for i in range(4): SK['tail%d' % (i + 1)] = ('tail%d' % i if i else 'pelvis', TJ[i])
MB = sorted(set(b for b in F.AURA_BONE.values() if b != 'float'))
for b in MB: SK['m_' + b] = (b, SK[b][1])
if 'float' in F.AURA_BONE.values(): SK['float'] = ('root', (0, 1.2, .15))
nb = list(SK); ix = nb.index
# ── regions: the nearest field term (mirrored), arms split at the elbow, legs at the knee, the tail into four along its curve ──
TR, HD, LG, TL = F.trunk_up(V), F.head_up(V), F.legs_up(V), F.tail_up(V)
ARL = F.arm_side(V, P_['SHO'], P_['ELB'], P_['HND']); ARR = F.arm_side(V * (-1, 1, 1), P_['SHO2'], P_['ELB2'], P_['HND2'])
terms = [TR, HD, LG, ARL, ARR, TL]
mn = np.min(terms, 0); isp = lambda d: d <= mn + 1e-9
def past(P0, P1, Q): d = P1 - P0; return ((Q - P0) @ d) / (d @ d)
arml, armr = isp(ARL) & (V[:, 0] > 0), isp(ARR) & (V[:, 0] < 0)
farl = arml & (past(P_['SHO'], P_['ELB'], A) > .85); farr = armr & (past(P_['SHO2'], P_['ELB2'], A) > .85)
leg = isp(LG) & ~arml & ~armr & (V[:, 1] < HIP[1] + .08); shin = leg & (past(HIP, KNEE, A) > .85)
tail = isp(TL) & ~leg & (V[:, 2] < -.10); hed = isp(HD) & ~arml & ~armr & (V[:, 1] > HC[1] - .20 * F.HS)
tseg = np.clip(cKDTree(TC[:, :3]).query(V)[1] * 4 // len(TC), 0, 3)
trunk = ~(arml | armr | leg | tail | hed)
g_ = lambda k: (lambda v: k)
c0, c2 = np.array(P_['trunk'][0]), np.array(P_['chest'][0])
B = [('pelvis', np.array((0, HIP[1] - .04, -.02)), np.array((0, HIP[1] + .08, -.02)), .22, g_(trunk & (V[:, 1] < c0[1]) | (leg & ~shin))),
     ('spine', c0 - (0, .06, 0), c0 + (0, .08, 0), .24, g_(trunk)), ('chest', c2 - (0, .04, 0), c2 + (0, .06, 0), .20, g_(trunk | ((arml | armr) & ~farl & ~farr))),
     ('neck', np.array(SK['neck'][1]), HC - (0, .06, 0), .14, g_(trunk | hed)), ('head', HC - (0, .02, .02), HC + (0, .10, .02), .30, g_(hed))]
for s, x in (('l', 1), ('r', -1)):
    X = np.array((x, 1, 1)); side = V[:, 0] * x > 0; S_, E_, H_ = (P_['SHO'], P_['ELB'], P_['HND']) if s == 'l' else (P_['SHO2'], P_['ELB2'], P_['HND2'])
    ar, fa = (arml, farl) if s == 'l' else (armr, farr)
    B += [('arm_' + s, S_ * X, E_ * X, .09, g_(ar)), ('farm_' + s, E_ * X, H_ * X * 1.08, .10, g_(fa)),
          ('leg_' + s, HIP * X, KNEE * X, .11, g_(leg & side)), ('shin_' + s, KNEE * X, ANK * X + (0, -.04, .08), .11, g_(shin & side))]
for i in range(4):
    a, b = np.array(TJ[i]), (np.array(TJ[i + 1]) if i < 3 else TC[-1, :3]); B += [('tail%d' % (i + 1), a, b, .22, g_(tail & (tseg >= i - 1) & (tseg <= i + 1)))]
w = K.skin_weights(V, m['F'], B, 6); W = np.zeros((len(V), len(nb)))
for i, b in enumerate(B): W[:, ix(b[0])] += w[:, i]
W = K.four(W)
# eyes part: eyes + gem ride the head; veins, teeth, stalk, mouth line ride the nearest body vertex
lin = lambda c: np.round(255 * (np.array(c) / 255.) ** 2.2)
eC = live['eyes']['COLOR_0'][:, :3].astype(int); e = np.zeros((len(eP), len(nb))); e[:, ix('head')] = 1
skinned = np.zeros(len(eP), bool); print('eyes verts', len(eP), 'skinned to the body', int(skinned.sum()))
aC = live['aura']['COLOR_0'][:, :3].astype(int); aw = np.zeros((len(aP), len(nb))); aw[:, ix(F.AURA_DEFAULT)] = 1
for col, bn in F.AURA_BONE.items():
    k = np.abs(aC - lin(col)).max(1) <= 1; aw[k] = 0; aw[k, ix(bn if bn == 'float' else 'm_' + bn)] = 1; print('aura', col, bn, int(k.sum()))
parts = {'body': dict(m, W=W), 'eyes': dict(live['eyes'], W=K.four(e)), 'aura': dict(live['aura'], W=aw)}
PV = {p: (parts[p]['POSITION'].astype(float), parts[p]['W']) for p in parts}
GROUNDED = (aw[:, ix('root')] > .5) | ((aw[:, ix('float')] > .5) if 'float' in SK else False)
# ── motion ──
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
def ground(p):
    for b in MB: p.S.setdefault('m_' + b, 1.00002)
    for _ in range(4):
        X = {q: K.skin(PV[q][0], PV[q][1], SK, p) for q in PV}
        lo = min(X['body'][:, 1].min(), X['eyes'][:, 1].min(), X['aura'][~GROUNDED, 1].min() if (~GROUNDED).any() else 9.)
        if abs(lo) < 2e-4: break
        p.T['pelvis'] = p.T['pelvis'] + (0, -lo, 0)
    return p
def limbs(p, ll, lr, al, ar, kl=0., kr=0., el=0., er=0.):
    p.R['leg_l'] = p.R['leg_l'] @ rx(ll); p.R['leg_r'] = p.R['leg_r'] @ rx(lr); p.R['shin_l'] = rx(kl); p.R['shin_r'] = rx(kr)
    p.R['arm_l'] = p.R['arm_l'] @ rx(al); p.R['arm_r'] = p.R['arm_r'] @ rx(ar); p.R['farm_l'] = p.R['farm_l'] @ rx(el); p.R['farm_r'] = p.R['farm_r'] @ rx(er)
def tailsw(p, sw, ph, lift=0.):
    for i in range(4): p.rot('tail%d' % (i + 1), rx(lift * (i + 1) / 4), ry(sw * np.sin(TAU * ph - i * .9) * (.5 + i * .35)))
def floaty(p, u):
    if 'float' in SK: p.T['float'] = np.array([.01 * np.sin(TAU * u), .035 * np.sin(TAU * u), 0]); p.R['float'] = ry(.25 * np.sin(TAU * u))
LEGL = float(HIP[1] - ANK[1] + .04)
GAIT = dict(cis=dict(walk=dict(T=.66, a=.26, k=.45, arm=.10, lean=.05, rock=.07), run=dict(T=.46, a=.46, k=.90, arm=.16, lean=.16, rock=.05)), tar=dict(walk=dict(T=.70, a=.30, k=.50, arm=.22, lean=.06, rock=.08), run=dict(T=.50, a=.50, k=.95, arm=.45, lean=.22, rock=.05)), elle=dict(walk=dict(T=.60, a=.34, k=.55, arm=.16, lean=.03, rock=.05), run=dict(T=.42, a=.58, k=1.05, arm=.30, lean=.16, rock=.04)), alys=dict(walk=dict(T=.62, a=.32, k=.55, arm=.10, lean=.04, rock=.07), run=dict(T=.44, a=.55, k=1.0, arm=.18, lean=.18, rock=.05)), kor=dict(walk=dict(T=.70, a=.30, k=.50, arm=.28, lean=.06, rock=.08), run=dict(T=.50, a=.50, k=.95, arm=.55, lean=.22, rock=.05)),
            ielle=dict(walk=dict(T=.62, a=.32, k=.50, arm=.22, lean=.03, rock=.05), run=dict(T=.44, a=.55, k=1.0, arm=.45, lean=.18, rock=.04)),
            cun=dict(walk=dict(T=.70, a=.14, k=.12, arm=.06, lean=.03, rock=.10), run=dict(T=.50, a=.22, k=.20, arm=.10, lean=.08, rock=.10)))[FORM]   # Croakarcun: a sitter's shuffle (her hands sit by her feet, so small swings)
for g in GAIT.values(): g['s'] = LEGL * np.sin(g['a']); g['v_glb'] = round(4 * g['s'] / g['T'], 4); g['v'] = round(g['v_glb'] * UNIT * DIAL / 1.4, 4)
RAISE = 1.   # Croakarielle's raised left hand barely swings
def idle(u):
    p = Pose(SK); t = TAU * u; p.T['chest'] = np.array([0, .006 * np.sin(2 * t), 0]); p.rot('spine', rx(.015 * np.sin(2 * t - .8)))
    lk = pulse(u, .10, .16, .30, .36) - pulse(u, .55, .61, .76, .82)
    if FORM == 'tar':     # braced wide, claws flexing, chest heaving with the crackle, glaring round
        p.R['pelvis'] = rz(.03 * np.sin(t)); p.rot('neck', ry(.16 * lk)); f = .14 * np.sin(2 * t) ** 2
        limbs(p, -.04, -.04, -.06 - f, -.06 - f, .07, .07, -.20 - f, -.20 - f); p.R['leg_l'] = p.R['leg_l'] @ rz(.07); p.R['leg_r'] = p.R['leg_r'] @ rz(-.07); tailsw(p, .10, u)
    elif FORM == 'elle':  # dancing on ONE foot: the right knee lifted, a slow twirl on the planted left, arms swaying with the current
        p.R['pelvis'] = ry(.30 * np.sin(t)) @ rz(-.05); p.rot('head', rz(.08 * np.sin(t + .6)), rx(-.06)); p.rot('arm_l', rz(.10 * np.sin(t))); p.rot('arm_r', rz(-.10 * np.sin(t + .5)))
        limbs(p, .02, -1.05 - .10 * np.sin(2 * t), 0, 0, .05, 1.45, 0, 0); tailsw(p, .20, u, .04)
    elif FORM == 'cis':   # crouched inside her orb, hands reaching out, a small charged bob, looking round
        p.R['pelvis'] = rx(.08); p.T['chest'] = np.array([0, .008 * np.sin(2 * t), 0]); p.rot('neck', ry(.18 * lk)); p.rot('head', rx(-.08))
        limbs(p, -.30, -.30, -.10 - .05 * np.sin(2 * t), -.10 - .05 * np.sin(2 * t + 1), .55, .55, -.15, -.15); tailsw(p, .08, u)
    elif FORM == 'alys':    # arms flung out singing: a bouncing sway, arms pumping up on the beat, head thrown back
        b = np.sin(2 * t) ** 2; p.R['pelvis'] = rz(.05 * np.sin(t)); p.rot('head', rx(-.10 - .06 * b), rz(.07 * np.sin(t))); p.rot('chest', rx(-.04 * b))
        p.rot('arm_l', rz(.18 * b)); p.rot('arm_r', rz(-.18 * b)); p.rot('farm_l', rz(.15 * b)); p.rot('farm_r', rz(-.15 * b)); limbs(p, -.03, -.03, 0, 0, .05 + .08 * b, .05 + .08 * b); tailsw(p, .16, u)
    elif FORM == 'kor':     # a wide braced stance, claws flexing, chest heaving, glaring round
        p.R['pelvis'] = rz(.03 * np.sin(t)); p.rot('neck', ry(.14 * lk)); f = .12 * np.sin(2 * t) ** 2
        limbs(p, -.04, -.04, -.08 - f, -.08 - f, .06, .06, -.30 - f, -.30 - f); p.R['leg_l'] = p.R['leg_l'] @ rz(.08); p.R['leg_r'] = p.R['leg_r'] @ rz(-.08); tailsw(p, .10, u)
    elif FORM == 'ielle':  # poised, the raised hand presenting, a slow sway with the orbs
        p.R['pelvis'] = rz(.04 * np.sin(t)); p.rot('head', rz(.06 * np.sin(t)), ry(.12 * lk)); p.rot('arm_l', rz(.06 * np.sin(t))); limbs(p, 0, 0, 0, .04 * np.sin(t)); tailsw(p, .14, u, .03 * np.sin(t))
    else:                  # hushed: sat still, the faintest breath, the lure drifting over her
        p.R['pelvis'] = rx(.02 * np.sin(t)); p.rot('head', rx(.10)); tailsw(p, .04, u)
    floaty(p, u); return ground(p)
def gait(u, g):
    p = Pose(SK); t = TAU * u; sn, cs = np.sin(t), np.cos(t)
    ll, lr = -g['a'] * sn, g['a'] * sn
    kl, kr = g['k'] * max(0., cs) ** 1.5, g['k'] * max(0., -cs) ** 1.5
    p.R['pelvis'] = rx(g['lean']) @ rz(g['rock'] * sn) @ ry(.06 * sn); p.rot('head', rx(-.6 * g['lean']), rz(-.5 * g['rock'] * sn))
    el = -.25 - .5 * g['lean']; limbs(p, ll, lr, -RAISE * g['arm'] * lr / g['a'], -g['arm'] * ll / g['a'], kl, kr, el * RAISE, el)
    tailsw(p, (.18 + .5 * g['lean']) * (.15 if FORM == 'cun' else 1), u, .05 * (FORM != 'cun')); floaty(p, u); return ground(p)   # Croakarcun's tail curls round her on the ground: it barely sweeps
def sit(u):
    p = Pose(SK); t = TAU * u; p.T['chest'] = np.array([0, .006 * np.sin(2 * t), 0]); lk = pulse(u, .55, .62, .78, .85); p.rot('head', ry(.16 * lk))
    if FORM == 'cun': p.R['pelvis'] = rx(-.05); limbs(p, -.25, -.25, 0, 0, .3, .3)
    else:
        p.R['pelvis'] = rx(-.10 + .012 * np.sin(2 * t)); limbs(p, -.95, -.95, -.10, -.10, 1.25, 1.25, -.40, -.40)
        p.R['leg_l'] = p.R['leg_l'] @ rz(.15); p.R['leg_r'] = p.R['leg_r'] @ rz(-.15)
    tailsw(p, .06, u, .10); floaty(p, u); return ground(p)
def lie(u):
    p = Pose(SK); t = TAU * u; p.S.update({'m_' + b: .02 for b in MB if not (FORM == 'kor' and b == 'head')})   # asleep, her crackle folds away (the bulb stays lit)
    if FORM == 'cun':   # she sleeps where she sits: settled lower, head bowed onto her chest, the lure hanging still over her
        p.R['pelvis'] = rx(.06 + .02 * np.sin(t)); p.rot('neck', rx(.25)); p.rot('head', rx(.20)); tailsw(p, .02, u); floaty(p, u * 0); return ground(p)
    p.R['pelvis'] = rz(1.40) @ rx(.05 * np.sin(t) - .10); p.T['chest'] = np.array([0, .005 * np.sin(t), 0])
    p.rot('head', rx(.20 + .02 * np.sin(t))); limbs(p, -.55, -.35, -.30, -.10, .70, .60, -.80, -.60); tailsw(p, .04, u, -.2); floaty(p, u); return ground(p)
clips, T = {}, {}
for c, fn, k, t in (('idle', idle, 120, 2.8), ('walk', lambda u: gait(u, GAIT['walk']), 36, GAIT['walk']['T']), ('run', lambda u: gait(u, GAIT['run']), 30, GAIT['run']['T']),
                    ('sit', sit, 60, 3.0), ('lie', lie, 44, 4.4)): clips[c] = wrap(fn, k); T[c] = t
# baked springs on the tail chain (the m244-quality pass c, its numbers)
TAIL_T = .11 if FORM != 'cun' else .02
def spring(u, dt, w0, z, loops=4, sub=8):
    n = len(u); th = np.zeros(2); out = np.zeros((n, 2)); h = dt / sub
    for L in range(loops):
        for k in range(n):
            a0, a1 = u[k], u[(k + 1) % n]
            for j in range(sub):
                f = a0 + (a1 - a0) * j / sub; acc = -w0 * w0 * th[0] - 2 * z * w0 * th[1] + f
                th = np.array([th[0] + h * (th[1] + h * acc), th[1] + h * acc])
            if L == loops - 1: out[k] = th
    return out[:, 0]
def tail_acc(poses, fps):
    ja, jt = np.array(SK['pelvis'][1]), np.array(SK['tail4'][1]); P, R = [], []
    for p in poses[:-1]: Ra, pa = p.glob('pelvis'); R.append(Ra); P.append(pa + Ra @ (jt - ja))
    P = np.array(P); a = (np.roll(P, -1, 0) - 2 * P + np.roll(P, 1, 0)) * fps * fps; a = (np.roll(a, -1, 0) + 2 * a + np.roll(a, 1, 0)) / 4
    return np.einsum('kji,kj->ki', np.array(R), a)
fps = {c: (len(v) - 1) / T[c] for c, v in clips.items()}
raw = {c: np.c_[spring(-a[:, 1], 1 / fps[c], 19, .30), spring(a[:, 0], 1 / fps[c], 19, .30)] for c in clips for a in [tail_acc(clips[c], fps[c])]}
gain = TAIL_T / max(np.abs(raw['walk']).max(), 1e-6); JIG = {}
for c, th in raw.items():
    th = np.clip(th * gain, -1.6 * TAIL_T, 1.6 * TAIL_T); n = len(th); JIG[c] = round(float(np.abs(th).max()), 3)
    for k in range(n):
        for i in range(4): kk = (k - 2 * i) % n; ww = (.45, .7, .9, 1.)[i]; clips[c][k].rot('tail%d' % (i + 1), rx(ww * th[kk, 0]), ry(ww * th[kk, 1]))
    for i in range(4): clips[c][-1].R['tail%d' % (i + 1)] = clips[c][0].R['tail%d' % (i + 1)].copy()
    clips[c] = [ground(p) for p in clips[c]]
K.write(GLB_OUT, parts, SK, clips, fps)
P = K.Player(GLB_OUT); F_ = P.m['body']['F']
M = dict(form=NAME, ground=True, biped=True, bones=len(nb), glb_bytes=os.path.getsize(GLB_OUT), tris=dict(body=len(F_), eyes=len(P.m['eyes']['F']), aura=len(P.m['aura']['F'])), unit_m=round(UNIT, 4), jiggle_peak_rad=JIG)
E = K.edges(F_); pos = P.m['body']['POSITION']; l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); okE = l0 > .006
for c in clips:
    N = 100; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g) for g in gl]; al = [np.vstack([x] + [P.verts(q, g) for q in ('eyes', 'aura')]) for x, g in zip(fr, gl)]
    d = dict(dur_s=round(T[c], 3), lowest_glb=round(min(x[:, 1].min() for x in al), 4), body_lowest_glb=round(min(x[:, 1].min() for x in fr), 4), body_max_lowest_glb=round(max(x[:, 1].min() for x in fr), 4), top_glb=round(max(x[:, 1].max() for x in al), 3))
    s = [np.linalg.norm(x[E[okE, 0]] - x[E[okE, 1]], axis=1) / l0[okE] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    if c in GAIT: d['v_glb'] = GAIT[c]['v_glb']; d['plays_1to1_at_mps'] = GAIT[c]['v']
    M[c] = d
M['body_mean_top'] = round(float(np.mean([P.verts('body', P.globals('idle', T['idle'] * k / 60))[:, 1].max() for k in range(60)])), 3)
M['glbLen'] = round(float(np.ptp(pos[:, 2])), 3)
json.dump(M, open(MET_OUT, 'w'), indent=1); print(json.dumps({k: M[k] for k in ('glbLen', 'body_mean_top', 'bones', 'glb_bytes', 'tris', 'jiggle_peak_rad')})); [print(c, M[c]) for c in clips]
