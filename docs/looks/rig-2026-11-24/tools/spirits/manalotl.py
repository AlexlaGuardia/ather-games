"""Manalotl on the low-and-long plan. A slow, low amble; she flows along the ground."""
import numpy as np
from rigcore import smooth
from plans import lowlong as L
NAME, HEIGHT, PARTS_RIGID = 'manalotl', 0.90 / 1.29, {'eyes': 'head'}
CAP_Y = 0.06
SK = {
 'root': (None, (.1, 0, 0)), 'pelvis': ('root', (.1, .18, -.28)), 'spine': ('pelvis', (.1, .24, -.06)), 'chest': ('spine', (.08, .29, .14)), 'neck': ('chest', (.07, .38, .26)), 'head': ('neck', (.06, .46, .36)),
 'frill_l': ('head', (.30, .55, .30)), 'frill_r': ('head', (-.20, .55, .30)),
 'fl_up': ('chest', (.22, .27, .31)), 'fl_lo': ('fl_up', (.26, .20, .41)), 'fl_paw': ('fl_lo', (.25, .11, .48)),
 'fr_up': ('chest', (-.12, .27, .31)), 'fr_lo': ('fr_up', (-.15, .20, .41)), 'fr_paw': ('fr_lo', (-.15, .12, .46)),
 'hl_up': ('pelvis', (.22, .16, -.02)), 'hl_lo': ('hl_up', (.29, .11, -.01)), 'hl_paw': ('hl_lo', (.30, .04, .02)),
 'hr_up': ('pelvis', (-.07, .16, -.08)), 'hr_lo': ('hr_up', (-.13, .11, -.08)), 'hr_paw': ('hr_lo', (-.12, .04, -.06)),
 'tail1': ('pelvis', (.38, .12, -.26)), 'tail2': ('tail1', (.48, .09, -.02)), 'tail3': ('tail2', (.53, .07, .20)), 'tail4': ('tail3', (.50, .05, .40)),
}
def J(b): return SK[b][1]
tail = lambda V: (V[:, 1] < .3) & (V[:, 0] > np.where(V[:, 2] > 0, .425, np.where(V[:, 2] > -.15, .445, .42))) & (V[:, 2] > -.36)
arm = lambda s: (lambda V: (V[:, 1] < .30) & (V[:, 2] > .30) & ((V[:, 0] > .13) if s else (V[:, 0] < -.04)) & ~tail(V))
hind = lambda s: (lambda V: (V[:, 1] < .16) & (np.abs(V[:, 2] + (.0 if s else .07)) < .15) & (((V[:, 0] > .19) & (V[:, 0] < .415)) if s else (V[:, 0] < .0)) & ~tail(V))
headg = lambda V: (V[:, 1] > .33) & (V[:, 2] > .08)
trunk = lambda V: ~tail(V)
BONES = [
 ('pelvis', (.1, .16, -.42), (.1, .2, -.22), .24, trunk), ('spine', J('spine'), (.1, .27, .05), .2, trunk), ('chest', J('chest'), (.07, .32, .22), .17, trunk), ('neck', J('neck'), (.07, .42, .30), .17, trunk),
 ('head', (.06, .5, .3), (.06, .55, .48), .24, headg),
 ('fl_up', J('fl_up'), J('fl_lo'), .07, arm(True)), ('fl_lo', J('fl_lo'), (.255, .15, .45), .07, arm(True)), ('fl_paw', J('fl_paw'), (.25, .08, .51), .07, arm(True)),
 ('fr_up', J('fr_up'), J('fr_lo'), .07, arm(False)), ('fr_lo', J('fr_lo'), (-.15, .16, .44), .07, arm(False)), ('fr_paw', J('fr_paw'), (-.15, .1, .5), .07, arm(False)),
 ('hl_up', J('hl_up'), J('hl_lo'), .08, hind(True)), ('hl_lo', J('hl_lo'), (.3, .07, .0), .07, hind(True)), ('hl_paw', (.3, .03, -.04), (.3, .02, .06), .09, hind(True)),
 ('hr_up', J('hr_up'), J('hr_lo'), .08, hind(False)), ('hr_lo', J('hr_lo'), (-.12, .07, -.07), .07, hind(False)), ('hr_paw', (-.12, .03, -.12), (-.12, .02, 0), .09, hind(False)),
 ('tail1', J('tail1'), J('tail2'), .11, tail), ('tail2', J('tail2'), J('tail3'), .09, tail), ('tail3', J('tail3'), J('tail4'), .08, tail), ('tail4', J('tail4'), (.46, .04, .6), .08, tail),
]
SMOOTH = 5
paw = lambda f, s, y: (f, lambda V: arm(s)(V) & (V[:, 1] < y))
RIGID = [paw('fl_paw', True, .13), paw('fr_paw', False, .14), ('hl_paw', lambda V: hind(True)(V) & (V[:, 1] < .06) & (V[:, 0] > .2)), ('hr_paw', lambda V: hind(False)(V) & (V[:, 1] < .06) & (V[:, 0] < -.03))]
def fan(V, W, nb):
    h = W[:, nb.index('head')].copy()
    for f, s in (('frill_l', 1), ('frill_r', -1)):
        k = h * smooth(0, .22, s * (V[:, 0] - SK[f][1][0])); W[:, nb.index(f)] += k; W[:, nb.index('head')] -= k
    return W
body_fix = fan   # the body mesh carries the fans' stubs too: same rule on both sides of the seam
def part_weights(p, mm, nb, bodyV, bodyW):
    """frills: the two gill fans, weight by how far out from the head's side; their roots stay welded to the head. A frill
    vertex that sits ON the body skin takes the body vertex's weights, so the seam cannot open."""
    V = mm['POSITION']; W = np.zeros((len(V), len(nb))); W[:, nb.index('head')] = 1; W = fan(V, W, nb)
    # z < 0: a stray island of the frill mesh that sits on her back
    d = ((V[:, None, :] - bodyV[None]) ** 2).sum(2); i = d.argmin(1); near = (d.min(1) < 1e-8) | (V[:, 2] < 0); W[near] = bodyW[i[near]]
    return W
D = dict(tail=['tail1', 'tail2', 'tail3', 'tail4'], uncurl=[.15, .40, .55, .5], rise=.03, idlepitch=.03,
         stance=dict(fl=(.27, .42), fr=(-.17, .42), hl=(.32, .0), hr=(-.15, -.06)), drop=dict(fl=-.07, fr=-.07, hl=0, hr=0))
WALK = dict(v=.42, duty=.62, reach=.115, lift=.04, phase=dict(fl=0, hr=.04, fr=.5, hl=.54), rise=.032, bob=.004, pitch=.03, wave=.13, wave0=.0, sway=.012, roll=.03, frill=.12, un=1, tailsw=.16)
RUN = dict(WALK, v=.62, duty=.52, reach=.125, lift=.05, rise=.042, bob=.008, wave=.17, frill=.18, tailsw=.22, pitch=.04)
def clips():
    out, info = {}, {}
    for n, g in (('walk', WALK), ('run', RUN)):
        T = 2 * g['reach'] * HEIGHT / g['duty'] / g['v']; out[n], s = L.gait(SK, D, g, 24); info[n] = dict(T=T, g=g, stretch=s)
    out['idle'] = L.idle(SK, D, 60); info['idle'] = dict(T=8.0)
    out['sit'] = L.sit(SK, D, 60); info['sit'] = dict(T=7.0)
    return out, info
BEFORE = dict(stride=.12 * HEIGHT / .15, hopH=.012 * HEIGHT / .15, stretch=.025, squash=.05, squashK=10, speed=.42, dash=.62, sitY=.93, sitPitch=-.08,
              sway=dict(along='z', sign=-1, **{'from': .15}, to=.64, dir='x', amp=.08, ampRun=.06, hz=.9, hzRun=2.6))
import math
SIDE_AZ = -math.pi / 2 + .3
REEL = [('sit', 1.2), ('idle', 2.0), ('walk', 2.4), ('run', 2.0)]; CAM_D = 4.4
