"""Vulnyx on the quadruped plan. Darting and light (spirits-species.md temperament, via spirit-models.ts)."""
import numpy as np
from plans import quadruped as Q
NAME, HEIGHT, PARTS_RIGID = 'vulnyx', 0.70, {'eyes': 'head'}
CAP_Y = 0.06
SK = {
 'root': (None, (-.05, 0, 0)), 'pelvis': ('root', (-.05, .15, -.13)), 'rump': ('pelvis', (-.05, .07, -.12)), 'spine': ('pelvis', (-.05, .25, .02)), 'chest': ('spine', (-.05, .33, .13)),
 'neck': ('chest', (-.05, .42, .19)), 'head': ('neck', (-.05, .50, .21)), 'ear_l': ('head', (.09, .72, .16)), 'ear_r': ('head', (-.19, .72, .16)),
 'fl_up': ('chest', (.035, .30, .17)), 'fl_lo': ('fl_up', (.03, .15, .185)), 'fl_paw': ('fl_lo', (.015, .04, .215)),
 'fr_up': ('chest', (-.13, .30, .17)), 'fr_lo': ('fr_up', (-.13, .15, .165)), 'fr_paw': ('fr_lo', (-.13, .04, .185)),
 'hl_up': ('pelvis', (.13, .18, .01)), 'hl_lo': ('hl_up', (.16, .10, .11)), 'hl_paw': ('hl_lo', (.16, .035, .15)),
 'hr_up': ('pelvis', (-.19, .17, -.02)), 'hr_lo': ('hr_up', (-.19, .09, .06)), 'hr_paw': ('hr_lo', (-.19, .035, .08)),
 'tail1': ('pelvis', (.17, .08, -.10)), 'tail2': ('tail1', (.31, .17, -.04)), 'tail3': ('tail2', (.42, .42, .01)),
}
def J(b): return SK[b][1]
tail = lambda V: (V[:, 0] > .20 + np.clip(.12 - V[:, 1], 0, .1) * .9 ) & ((V[:, 1] > .22) | (V[:, 0] > .27) | (V[:, 2] < -.02)) & ~((V[:, 0] < .29) & (V[:, 1] > .5) & (V[:, 2] > .13))
fore = lambda s: (lambda V: (V[:, 1] < .30) & (V[:, 2] > .10) & ((V[:, 0] > -.05) == s) & (V[:, 0] < np.where(V[:, 1] < .08, .085, .115)) & (V[:, 0] > -.2))
hind = lambda s: (lambda V: (V[:, 1] < .24) & ((V[:, 0] > .09) if s else (V[:, 0] < -.15)) & (V[:, 2] > -.13) & ~tail(V) & (s | (V[:, 2] < .135)))
headg = lambda V: (V[:, 1] > .44) & ~tail(V)
trunk = lambda V: ~tail(V) & (V[:, 1] < .55)
BONES = [
 ('pelvis', (-.05, .13, -.17), (-.05, .18, -.08), .16, trunk), ('rump', (-.17, -.01, -.14), (.1, -.01, -.14), .085, lambda V: trunk(V) & (V[:, 1] < .12) & (V[:, 2] < .06)), ('spine', J('spine'), (-.05, .30, .06), .13, trunk), ('chest', J('chest'), (-.05, .36, .16), .13, trunk),
 ('neck', J('neck'), (-.05, .46, .2), .12, trunk), ('head', (-.05, .56, .22), (-.05, .70, .2), .2, headg),
 ('ear_l', (.10, .76, .16), (.14, .98, .16), .10, headg), ('ear_r', (-.20, .76, .16), (-.24, .98, .16), .10, headg),
 ('fl_up', J('fl_up'), J('fl_lo'), .055, fore(True)), ('fl_lo', J('fl_lo'), (.02, .075, .20), .06, fore(True)), ('fl_paw', (.01, .03, .20), (.01, .02, .27), .065, fore(True)),
 ('fr_up', J('fr_up'), J('fr_lo'), .055, fore(False)), ('fr_lo', J('fr_lo'), (-.13, .075, .175), .06, fore(False)), ('fr_paw', (-.135, .03, .17), (-.135, .02, .24), .065, fore(False)),
 ('hl_up', J('hl_up'), J('hl_lo'), .10, hind(True)), ('hl_lo', J('hl_lo'), (.16, .08, .13), .06, hind(True)), ('hl_paw', (.16, .03, .06), (.16, .02, .2), .07, hind(True)),
 ('hr_up', J('hr_up'), J('hr_lo'), .10, hind(False)), ('hr_lo', J('hr_lo'), (-.19, .08, .07), .06, hind(False)), ('hr_paw', (-.2, .03, 0), (-.2, .02, .16), .07, hind(False)),
 ('tail1', J('tail1'), J('tail2'), .14, tail), ('tail2', J('tail2'), J('tail3'), .14, tail), ('tail3', J('tail3'), (.55, .7, .03), .14, tail),
]
SMOOTH = 7
RIGID = [('fl_paw', lambda V: fore(True)(V) & (V[:, 1] < .05)), ('fr_paw', lambda V: fore(False)(V) & (V[:, 1] < .05)),
         ('hl_paw', lambda V: (V[:, 1] < .05) & (V[:, 0] > .115) & (V[:, 0] < .24) & (V[:, 2] > .06)), ('hr_paw', lambda V: (V[:, 1] < .05) & (V[:, 0] < -.14) & (V[:, 2] > .0) & (V[:, 2] < .13))]
D = dict(pitch=.48, neck=.55, tail=['tail1', 'tail2', 'tail3'], idletail=[.35, .15, 0], idlelift=[-.55, 0, 0], drop=dict(hr=-.008, fl=.001), tuck=(0, .07, .04),
         stance=dict(fl=(.015, .20), fr=(-.125, .20), hl=(.12, -.13), hr=(-.20, -.13)))
WALK = dict(v=.55, duty=.62, reach=(.105, .105), lift=.06, toe=.5, phase=dict(hl=0, fl=.75, hr=.5, fr=.25), beats=2, bob0=0.4, bob=.008, dy=-.005, pitch=0, rock=0, flex=0, yaw=.07, roll=.05,
            nod=.02, headdown=0, ear=0, earf=.05, tailback=[.5, .3, .1], taillift=[-.65, -.05, 0], tailf=.03, tailsw=.14)
RUN = dict(v=1.92, duty=.32, reach=(.115, .115), lift=.08, toe=.9, phase=dict(hl=.0, hr=.93, fl=.52, fr=.45), beats=1, bob0=-0.5, bob=.022, dy=.0, pitch=.04, rock=.13, flex=.16, yaw=0, roll=.02,
           nod=0, headdown=.06, ear=-.28, earf=.12, tailback=[.75, .45, .2], taillift=[-1.05, -.25, -.1], tailf=.14, tailsw=.06)
def clips():
    out, info = {}, {}
    for n, g in (('walk', WALK), ('run', RUN)):
        T = 2 * g['reach'][0] * HEIGHT / g['duty'] / g['v']; out[n], s = Q.gait(SK, D, g, 24); info[n] = dict(T=T, g=g, stretch=s)
    out['idle'] = Q.idle(SK, D, 48); info['idle'] = dict(T=4.8)
    out['sit'] = Q.sit(SK, D, 48); info['sit'] = dict(T=5.0)
    return out, info
# the live hop-trot, for the "before" half (spirit-models.ts grownTrot: lengths x 0.70/0.55, speeds x sqrt; TROT defaults)
_k = .70 / .55
BEFORE = dict(stride=.27 * _k, hopH=.05 * _k, stretch=.07, squash=.15, squashK=22, speed=1.15 * _k ** .5, dash=1.7 * _k ** .5, sitY=.88, sitPitch=-.2,
              sway=dict(along='x', sign=1, **{'from': .25}, to=.62, dir='z', amp=.07, ampRun=.05, hz=1.7, hzRun=6.3))
REEL = [('sit', 1.2), ('idle', 1.6), ('walk', 1.8), ('run', 2.0)]; CAM_D = 4.4
