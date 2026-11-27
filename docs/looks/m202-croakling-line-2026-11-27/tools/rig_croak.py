"""M202 the Croakling line's rigs: python rig_croak.py <form>  -> ../<form>-rigged.glb + ../<form>-metrics.json
Each form runs the BASE Croakling's own rig (docs/looks/m174-croakling-2026-11-27/tools/rig_croakling.py, read and run, never edited) on her
own sculpt module (sculpt_<form>.py, which has already re-shaped the base module by name), so she gets the base's 19-bone plan and its five
clips (idle / walk hops / run bounds / sit croaks / lie) fitted to HER landmarks. Three hooks, used by Croakarc only (no lure, a tail):
  HOOK_SK  re-seats the three lure bones along her tail, parented to the hips;   HOOK_W  weights the tail's skin onto them;
  HOOK_LURE  turns the clips' lure motion into a tail's (sway = side to side, pitch = up / down, swing = the tip's whip).
Also writes `body_mean_top` (the idle clip's mean body top, glb units, the lure not counted) = the number the prod check sizes her by."""
import sys, os, json, importlib, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, HERE)
FORM = sys.argv[1]; F = importlib.import_module('sculpt_' + FORM); S = F.S
import croak_common as C
src = open(os.path.join(C.BASE, 'rig_croakling.py')).read()
for a, b in (("os.path.join(HERE, '../croakling.glb')", "GLB_IN"), ("os.path.join(HERE, '../croakling-rigged.glb')", "GLB_OUT"),
             ("os.path.join(HERE, '../croakling-metrics.json')", "MET_OUT"), ("J = lambda b: np.array(SK[b][1])", "HOOK_SK(SK)\nJ = lambda b: np.array(SK[b][1])"),
             ("W = K.four(W); parts = {'body': dict(m, W=W)}", "W = HOOK_W(W, V0, nb); W = K.four(W); parts = {'body': dict(m, W=W)}"),
             ("pulse = lambda u, a, b, c, d:", "lure = HOOK_LURE(lure)\npulse = lambda u, a, b, c, d:"),
             ("import numpy as np, rigcore as K, sculpt_croakling as S", "import numpy as np, rigcore as K")):
    assert a in src, a; src = src.replace(a, b)
D = os.path.join(HERE, '..'); ns = dict(__name__='rig', __file__=os.path.join(C.BASE, 'rig_croakling.py'), S=S,
     GLB_IN=os.path.join(D, f'{FORM}.glb'), GLB_OUT=os.path.join(D, f'{FORM}-rigged.glb'), MET_OUT=os.path.join(D, f'{FORM}-metrics.json'))
TAIL = getattr(F, 'TP', None)
def hook_sk(SK):
    if TAIL is None: return
    SK['lure'] = ('hips', tuple(TAIL[2])); SK['lure2'] = ('lure', tuple(TAIL[6])); SK['lure3'] = ('lure2', tuple(TAIL[9]))
def hook_w(W, V0, nb):
    if TAIL is None: return W
    A = np.c_[np.abs(V0[:, 0]), V0[:, 1:]]; dt = F.tail(A); other = np.minimum(np.minimum(S.head(A), S.hind(A)), S.arms(A))
    on = (dt < .012) & (V0[:, 2] < -.30) & (dt < other)
    TS = np.linspace(0, 1, 201); BZ = F.tb(TS); t = TS[np.argmin(np.linalg.norm(V0[on][:, None] - BZ[None], axis=2), 1)]
    sm = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
    k0, k1, k2 = sm(.05, .25, t), sm(.35, .60, t), sm(.62, .85, t); ix = nb.index; Wt = np.zeros((on.sum(), W.shape[1]))
    Wt[:, ix('hips')] = 1 - k0; Wt[:, ix('lure')] = k0 - k1; Wt[:, ix('lure2')] = k1 - k2; Wt[:, ix('lure3')] = k2
    W = W.copy(); W[on] = Wt; print('tail verts', on.sum()); return W
def hook_lure(fn):
    if TAIL is None: return fn
    rx, ry = ns['rx'], ns['ry']
    def tail(p, sway, pitch, swing, swing2=0., droop=0.):
        """the base's lure motion read as a tail: sway swishes it, pitch lifts it (a hop lifts the tail), droop lays it flat (asleep)"""
        p.rot('lure', ry(1.6 * sway), rx(-.35 * pitch + .25 * droop)); p.rot('lure2', ry(1.2 * sway + .8 * swing), rx(-.25 * pitch + .2 * droop)); p.rot('lure3', ry(1.4 * swing + .6 * swing2), rx(.15 * droop))
    return tail
ns.update(HOOK_SK=hook_sk, HOOK_W=hook_w, HOOK_LURE=hook_lure)
sys.modules['sculpt_croakling'] = S
exec(compile(src, 'rig_croakling(' + FORM + ')', 'exec'), ns)
P, T = ns['P'], ns['T']; tops = [P.verts('body', P.globals('idle', T['idle'] * k / 110))[:, 1].max() - P.verts('body', P.globals('idle', T['idle'] * k / 110))[:, 1].min() for k in range(110)]
M = json.load(open(ns['MET_OUT'])); M['body_mean_top'] = round(float(np.mean(tops)), 3); json.dump(M, open(ns['MET_OUT'], 'w'), indent=1); print('body_mean_top', M['body_mean_top'])
