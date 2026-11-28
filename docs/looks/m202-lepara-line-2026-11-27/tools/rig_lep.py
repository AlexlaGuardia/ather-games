"""M202 the Lepara line's rigs (Lepaura / Leparc / Lepore): python rig_lep.py <form>  -> ../<form>-rigged.glb + ../<form>-metrics.json
Each runs the BASE Lepara's own rig (docs/looks/m174-lepara-snout-2026-11-27/tools/rig_lepara.py, read and run, never edited) on her own
sculpt module (sculpt_<form>.py, which has already re-shaped the base module by name), so she gets the base's 20 bones and its five clips
(idle with the twitchy nose / walk hops / run bounds / sit grooming / lie loaf) fitted to her part masks.
Also writes `body_mean_top` (the idle clip's mean body height, glb units) = the number the prod check sizes her by."""
import sys, os, json, importlib, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, HERE)
FORM = sys.argv[1]; F = importlib.import_module('sculpt_' + FORM); S = F.S
import lep_common as C
src = open(os.path.join(C.BASE, 'rig_lepara.py')).read()
for a, b in (("os.path.join(HERE, '../lepara.glb')", "GLB_IN"), ("os.path.join(HERE, '../lepara-rigged.glb')", "GLB_OUT"),
             ("os.path.join(HERE, '../lepara-metrics.json')", "MET_OUT"), ("import numpy as np, rigcore as K, sculpt_lepara as S", "import numpy as np, rigcore as K")):
    assert a in src, a; src = src.replace(a, b)
# LEPNIX (the unicorn foal) stands on four long legs: her joints move onto her own body, the base's clips are kept (bones + names as the base)
FOAL = (("'hips': ('root', (0, .17, -.03))", "'hips': ('root', (0, .34, -.20))"), ("'chest': ('hips', (0, .32, .01))", "'chest': ('hips', (0, .37, -.03))"),
        ("'neck': ('chest', (0, .40, .03))", "'neck': ('chest', (0, .46, .01))"), ("'tail': ('hips', (0, .10, -.22))", "'tail': ('hips', (0, .40, -.37))"),
        ("('chest', (x * .165, .33, .07))", "('chest', (x * .085, .33, -.02))"), ("('arm_' + s, (x * .142, .24, .19))", "('arm_' + s, (x * .080, .17, .00))"),
        ("('hips', (x * .15, .13, -.03))", "('hips', (x * .095, .30, -.30))"), ("('thigh_' + s, (x * .13, .036, .12))", "('thigh_' + s, (x * .090, .15, -.33))"),
        ("('hips', (0, .04, -.03), (0, .22, -.03), .26", "('hips', (0, .33, -.36), (0, .35, -.12), .20"), ("('chest', (0, .28, .01), (0, .38, .03), .20", "('chest', (0, .35, -.10), (0, .40, .00), .18"),
        ("('neck', (0, .39, .03), (0, .44, .05), .12", "('neck', (0, .42, -.01), (0, .50, .03), .12"), ("('tail', J('tail'), (0, .085, -.43), .10", "('tail', J('tail'), (0, .25, -.55), .10"),
        ("J('paw_' + s) + (0, -.01, .03), .05", "J('paw_' + s) + (0, -.14, .01), .05"), ("J('thigh_' + s) + (0, -.05, .07), .12", "J('thigh_' + s) + (0, -.12, -.02), .08"),
        ("J('foot_' + s) + (0, 0, .14), .09", "J('foot_' + s) + (0, -.12, .03), .07"))
if FORM == 'lepnix':
    for a, b in FOAL: assert a in src, a; src = src.replace(a, b)
    # her idle stamps a foreleg (the base's wave + thump): ground it like sit + lie, so no hoof sinks
    a_ = "foot(p, 'l'); foot(p, 'r', .01 * th, .045 * th, 0, rx(-.35 * th)); return p"; assert a_ in src; src = src.replace(a_, a_[:-8] + 'return ground(p, 0)')
D = os.path.join(HERE, '..'); ns = dict(__name__='rig', __file__=os.path.join(C.BASE, 'rig_lepara.py'), S=S,
     GLB_IN=os.path.join(D, f'{FORM}.glb'), GLB_OUT=os.path.join(D, f'{FORM}-rigged.glb'), MET_OUT=os.path.join(D, f'{FORM}-metrics.json'))
sys.modules['sculpt_lepara'] = S
exec(compile(src, 'rig_lepara(' + FORM + ')', 'exec'), ns)
P, T = ns['P'], ns['T']; fr = [P.verts('body', P.globals('idle', T['idle'] * k / 110)) for k in range(110)]; tops = [x[:, 1].max() - x[:, 1].min() for x in fr]
M = json.load(open(ns['MET_OUT'])); M['body_mean_top'] = round(float(np.mean(tops)), 3); M['nose_to_tail'] = round(float(np.mean([np.ptp(x[:, 2]) for x in fr])), 3)
json.dump(M, open(ns['MET_OUT'], 'w'), indent=1); print('body_mean_top', M['body_mean_top'], 'nose_to_tail', M['nose_to_tail'])
