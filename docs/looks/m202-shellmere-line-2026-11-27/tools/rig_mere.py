"""M202 the Shellmere line's rigs: python rig_mere.py <form>  -> ../<form>-rigged.glb + ../<form>-metrics.json
Each form runs the BASE Shellmere's own rig (docs/looks/m174-shellmere-2026-11-27/tools/rig_shellmere.py, read and run, never edited) on her
own sculpt module (sculpt_<form>.py, which has already re-shaped the base module by name), so she gets the base's 18-bone plan and its five
clips (idle looks + nod / walk plod / run trot / sit / lie asleep, head drawn in) fitted to HER landmarks: the legs come from her LEGS (Tidemere's
flippers: shoulder -> blade tip), the head / lids joints follow her head centre (DH = her HC - the base's). The antenna bones stay for every
form (the clips key them); a form without antennae has no verts on them. SHELL_GLB_TALL for the game = `body_mean_top` (the idle clip's mean body height, antennae + crystal not counted) = what the prod check sizes her by."""
import sys, os, importlib, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, HERE)
FORM = sys.argv[1]; F = importlib.import_module('sculpt_' + FORM); S = F.S
import shell_common as C
src = open(os.path.join(C.BASE, 'rig_shellmere.py')).read(); DH = S.HC - C.HC0
for a, b in (("os.path.join(HERE, '../shellmere.glb')", "GLB_IN"), ("os.path.join(HERE, '../shellmere-rigged.glb')", "GLB_OUT"),
             ("os.path.join(HERE, '../shellmere-metrics.json')", "MET_OUT"), ("import numpy as np, rigcore as K, sculpt_shellmere as S", "import numpy as np, rigcore as K"),
             ("('neck', (0, .45, .42))", "('neck', tuple(DH + (0, .45, .42)))"), ("('head', (0, .50, .62))", "('head', tuple(DH + (0, .50, .62)))"),
             ("(0, .36, .22), (0, .44, .40), .14", "(0, .36, .22), tuple(DH + (0, .44, .40)), .14"), ("(0, .45, .45), (0, .50, .58), .26", "tuple(DH + (0, .45, .45)), tuple(DH + (0, .50, .58)), .26")):
    assert src.count(a) == 1, a; src = src.replace(a, b)
D = os.path.join(HERE, '..'); ns = dict(__name__='rig', __file__=os.path.join(C.BASE, 'rig_shellmere.py'), DH=DH,
     GLB_IN=os.path.join(D, f'{FORM}.glb'), GLB_OUT=os.path.join(D, f'{FORM}-rigged.glb'), MET_OUT=os.path.join(D, f'{FORM}-metrics.json'))
sys.modules['sculpt_shellmere'] = S; ns['S'] = S
exec(compile(src, 'rig_shellmere(' + FORM + ')', 'exec'), ns)
import json
P, T = ns['P'], ns['T']; tops = [np.ptp(P.verts('body', P.globals('idle', T['idle'] * k / 110))[:, 1]) for k in range(110)]
M = json.load(open(ns['MET_OUT'])); M['body_mean_top'] = round(float(np.mean(tops)), 3); json.dump(M, open(ns['MET_OUT'], 'w'), indent=1); print('body_mean_top', M['body_mean_top'])
