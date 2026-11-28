"""M244 sheet 11: the rig for Croakgulp / Croakavis / Araeth: python rig_croakaraw.py <gulp|avis|araeth> <in.glb> <out-rigged.glb> <metrics.json>
Each runs the LIVE Croakara's rig = the BASE Croakling's own rig (docs/looks/m174-croakling-2026-11-27/tools/rig_croakling.py, read and run, never
edited; its 19 bones and five clips: idle, walk hops, run bounds, sit croaks, lie asleep) on her re-shaped sculpt (sculpt_croakaraw.py), fitted
to HER landmarks, plus one hook: her AURA part (the motif) is carried too. Aura colours in AURA_LURE ride the lure tip (lure3: Araeth's pot +
bottles swing with her globe), AURA_ROOT ride the root (Croakavis's ghost), the rest is skinned to the nearest body vertex (Croakgulp's
belly swirl). The base's ground() / low() count the aura too, so nothing she carries goes under the ground. Baked springs (the m244-quality
pass c numbers) on the lure chain: the globe lags her head as she moves. Writes body_mean_top (the idle mean body top, glb units)."""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, HERE)
FORM, GLB_IN, GLB_OUT, MET_OUT = sys.argv[1:5]; os.environ['CROAKARAW_FORM'] = FORM
import sculpt_croakaraw as F; S = F.S
import croak_common as C
from scipy.spatial import cKDTree
src = open(os.path.join(C.BASE, 'rig_croakling.py')).read()
for a, b in (("os.path.join(HERE, '../croakling.glb')", "GLB_IN"), ("os.path.join(HERE, '../croakling-rigged.glb')", "GLB_OUT"),
             ("os.path.join(HERE, '../croakling-metrics.json')", "MET_OUT"),
             ("parts['eyes'] = dict(live['eyes'], W=K.four(e));", "parts['eyes'] = dict(live['eyes'], W=K.four(e)); aP, aw = HOOK_AURA(parts, live, W, V0, nb);"),
             ("def low(p): return min(K.skin(V0, W, SK, p)[:, 1].min(), K.skin(eP, e, SK, p)[:, 1].min())",
              "def low(p): return min(K.skin(V0, W, SK, p)[:, 1].min(), K.skin(eP, e, SK, p)[:, 1].min(), K.skin(aP, aw, SK, p)[:, 1].min())"),
             ("path = GLB_OUT; K.write(", "HOOK_SPRING(clips, T, SK, ground); path = GLB_OUT; K.write("),
             ("import numpy as np, rigcore as K, sculpt_croakling as S", "import numpy as np, rigcore as K"),
             # her head rides higher (sculpt lift(): DY), so the neck / head / throat joints, the head + lid masks and the head segment follow it
             ("'neck': ('chest', (0, .40, .05)), 'head': ('neck', (0, .48, .06))", "'neck': ('chest', (0, .40 + DY * .6, .05)), 'head': ('neck', (0, .48 + DY, .06 + DZ))"),
             ("'throat': ('chest', (0, .40, .24))", "'throat': ('chest', (0, .40 + DY, .24 + DZ))"),
             ("hed = isp(HD) & (V0[:, 1] > .43) & ~arm; thr = isp(TH) & ~arm & ~hed & (V0[:, 1] < .43)", "hed = isp(HD) & (V0[:, 1] > .43 + DY) & ~arm; thr = isp(TH) & ~arm & ~hed & (V0[:, 1] < .43 + DY)"),
             ("('neck', (0, .40, .05), (0, .46, .06), .14, g(bod | hed)),", "('neck', (0, .40 + DY * .6, .05), (0, .46 + DY, .06 + DZ), .14, g(bod | hed)),"),
             ("('head', (0, .50, .06), (0, .62, .12), .30, g(hed)), ('throat', (0, .39, .22), (0, .39, .32), .085, g(thr))",
              "('head', (0, .50 + DY, .06 + DZ), (0, .62 + DY, .12 + DZ), .30, g(hed)), ('throat', (0, .39 + DY, .22 + DZ), (0, .39 + DY, .32 + DZ), .085, g(thr))"),
             ("lid = isc(tuple(S.HEADC), S.MOUTH) & (eP[:, 1] > .60)", "lid = isc(tuple(S.HEADC), S.MOUTH) & (eP[:, 1] > .60 + DY + .02)")):
    assert a in src, a; src = src.replace(a, b)
lin = lambda c: np.round(255 * (np.array(c) / 255.) ** 2.2)
def hook_aura(parts, live, W, V0, nb):
    aP = live['aura']['POSITION'].astype(float); aC = live['aura']['COLOR_0'][:, :3].astype(int); ix = nb.index
    isc = lambda cs: np.zeros(len(aP), bool) if not cs else np.min([np.abs(aC - lin(c)).max(1) for c in cs], 0) <= 1
    aw = W[cKDTree(V0).query(aP)[1]].copy(); lu, ro = isc(F.AURA_LURE), isc(F.AURA_ROOT)
    aw[lu] = 0; aw[lu, ix('lure3')] = 1; aw[ro] = 0; aw[ro, ix('root')] = 1
    aw = ns['K'].four(aw); parts['aura'] = dict(live['aura'], W=aw); print('aura verts', len(aP), 'on the lure', int(lu.sum()), 'on the root', int(ro.sum())); return aP, aw
def hook_spring(clips, T, SK, ground):
    """the m244-quality pass c springs on the lure chain, driven by the lure base's acceleration (in the head's frame)"""
    K = ns['K']; rx, rz = K.rx, K.rz
    def spring(u, dt, w0, z, loops=4, sub=8):
        n = len(u); th = np.zeros(2); out = np.zeros((n, 2)); h = dt / sub
        for L in range(loops):
            for k in range(n):
                a0, a1 = u[k], u[(k + 1) % n]
                for j in range(sub):
                    f = a0 + (a1 - a0) * j / sub; acc = -w0 * w0 * th[0] - 2 * z * w0 * th[1] + f; th = np.array([th[0] + h * (th[1] + h * acc), th[1] + h * acc])
                if L == loops - 1: out[k] = th
        return out[:, 0]
    fps = {c: (len(v) - 1) / T[c] for c, v in clips.items()}; raw = {}
    for c, poses in clips.items():
        R, P = [], []
        for p in poses[:-1]: Ra, pa = p.glob('lure'); R.append(Ra); P.append(pa)
        P = np.array(P); a = (np.roll(P, -1, 0) - 2 * P + np.roll(P, 1, 0)) * fps[c] ** 2; a = (np.roll(a, -1, 0) + 2 * a + np.roll(a, 1, 0)) / 4; a = np.einsum('kji,kj->ki', np.array(R), a)
        raw[c] = np.c_[spring(a[:, 2], 1 / fps[c], 14, .28), spring(-a[:, 0], 1 / fps[c], 14, .28)]
    gain = .16 / max(np.abs(raw['walk']).max(), 1e-6); JIG = {}
    for c, th in raw.items():
        th = np.clip(th * gain, -.26, .26); n = len(th); JIG[c] = round(float(np.abs(th).max()), 3)
        for k in range(n): clips[c][k].rot('lure2', rx(.5 * th[k, 0]), rz(.5 * th[k, 1])); clips[c][k].rot('lure3', rx(th[(k - 1) % n, 0]), rz(th[(k - 1) % n, 1]))
        clips[c][-1].R['lure2'], clips[c][-1].R['lure3'] = clips[c][0].R['lure2'].copy(), clips[c][0].R['lure3'].copy()
        if c in ('sit', 'lie'): clips[c] = [ground(p, 0) for p in clips[c]]
    globals()['JIG'] = JIG; print('lure spring peak rad', JIG)
ns = dict(DY=float(F.D[1]), DZ=float(F.D[2]), __name__='rig', __file__=os.path.join(C.BASE, 'rig_croakling.py'), S=S, GLB_IN=GLB_IN, GLB_OUT=GLB_OUT, MET_OUT=MET_OUT, HOOK_AURA=hook_aura, HOOK_SPRING=hook_spring)
sys.modules['sculpt_croakling'] = S
exec(compile(src, 'rig_croakling(' + FORM + ')', 'exec'), ns)
P, T = ns['P'], ns['T']; tops = [P.verts('body', P.globals('idle', T['idle'] * k / 110)) for k in range(110)]
M = json.load(open(MET_OUT)); M['body_mean_top'] = round(float(np.mean([x[:, 1].max() - x[:, 1].min() for x in tops])), 3); M['jiggle_peak_rad'] = JIG
gl = [(c, P.globals(c, T[c] * k / 60)) for c in T for k in range(60)]; M['aura_lowest_glb'] = round(float(min(P.verts('aura', g)[:, 1].min() for c, g in gl)), 4)
M['glbLen'] = round(float(np.ptp(P.m['body']['POSITION'][:, 2])), 3); M['tris']['aura'] = len(P.m['aura']['F'])
json.dump(M, open(MET_OUT, 'w'), indent=1); print('body_mean_top', M['body_mean_top'], 'aura lowest', M['aura_lowest_glb'], 'glbLen', M['glbLen'])
