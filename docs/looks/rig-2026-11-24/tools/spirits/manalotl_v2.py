"""Manalotl v2 (M132 s1b): surgery_v2's body (tail freed, rooted at the rump), 7 tail bones, a lower front stance."""
import numpy as np
from rigcore import smooth
from plans import lowlong_v2 as L
import spirits.manalotl as V1, surgery_v2 as X
NAME, HEIGHT, PARTS_RIGID, CAP_Y, SIDE_AZ, BEFORE = 'manalotl', V1.HEIGHT, V1.PARTS_RIGID, V1.CAP_Y, V1.SIDE_AZ, V1.BEFORE
NT = 7; Z0 = -.56; BL = (X.LEN + .04) / NT; TAIL = ['tail%d' % (i + 1) for i in range(NT)]
AX = np.arctan2(.035, X.LEN)          # the bind axis already dips this much
SK = {b: v for b, v in V1.SK.items() if not b.startswith('tail')}
for i, b in enumerate(TAIL): SK[b] = (TAIL[i - 1] if i else 'pelvis', (.10, .19 - .035 * max(0, (-Z0 + i * BL) - .60) / X.LEN, Z0 - i * BL))
def J(b): return SK[b][1]
arm = lambda s: (lambda V: (V[:, 1] < .30) & (V[:, 2] > .30) & ((V[:, 0] > .13) if s else (V[:, 0] < -.04)))
hind = lambda s: (lambda V: (V[:, 1] < .16) & (np.abs(V[:, 2] + (.0 if s else .07)) < .15) & (((V[:, 0] > .19) & ((V[:, 1] < .118) | (V[:, 2] > -.02))) if s else (V[:, 0] < .0)))
BONES = []
for b in V1.BONES:
    if b[0].startswith('tail'): continue
    g = None if b[4] is V1.trunk else V1.headg if b[0] == 'head' else {'fl': arm(True), 'fr': arm(False), 'hl': hind(True), 'hr': hind(False)}[b[0][:2]]
    BONES.append((*b[:4], g))
SMOOTH = V1.SMOOTH
paw = lambda f, s, y: (f, lambda V: arm(s)(V) & (V[:, 1] < y))
RIGID = [paw('fl_paw', True, .13), paw('fr_paw', False, .14), ('hl_paw', lambda V: hind(True)(V) & (V[:, 1] < .06) & (V[:, 0] > .2)), ('hr_paw', lambda V: hind(False)(V) & (V[:, 1] < .06) & (V[:, 0] < -.03))]
def body_fix(V, W, nb):
    W = V1.fan(V, W, nb); c = [smooth(0, 1, (Z0 - i * BL - V[:, 2]) / (.22 if i == 0 else BL * 1.1) + .5) for i in range(NT)] + [np.zeros(len(V))]
    W = W * (1 - c[0])[:, None]
    for i, b in enumerate(TAIL): W[:, nb.index(b)] += c[i] - c[i + 1]
    return W
def part_weights(p, mm, nb, bodyV, bodyW): return V1.part_weights(p, mm, nb, bodyV, bodyW)
DIP = [.25, .28, .22, .12, .0, -.10, -.15]
D = dict(tail=TAIL, axis=AX, rise=.024, idlepitch=.17, dip=DIP, curl=np.radians([36, 84, 122, 146, 162, 174, 182]), curldip=[.28, .30, .22, .08, 0, 0, -.02],
         stance=dict(fl=(.28, .37), fr=(-.17, .35), hl=(.32, -.02), hr=(-.15, -.09)), drop=dict(fl=-.07, fr=-.07, hl=0, hr=0))
WALK = dict(V1.WALK, reach=.108, rise=.024, pitch=.17, tailsw=(.15, .58), taillag=.075, dip=DIP)
RUN = dict(V1.RUN, reach=.118, rise=.028, pitch=.17, tailsw=(.18, .60), taillag=.085, dip=[.16, .18, .14, .06, 0, -.06, -.08])
def clips():
    out, info = {}, {}
    for n, g in (('walk', WALK), ('run', RUN)):
        T = 2 * g['reach'] * HEIGHT / g['duty'] / g['v']; out[n], s = L.gait(SK, D, g, 24); info[n] = dict(T=T, g=g, stretch=s)
    out['idle'] = L.idle(SK, D, 60); info['idle'] = dict(T=8.0)
    out['sit'] = L.sit(SK, D, 60); info['sit'] = dict(T=7.0)
    return out, info
REEL, CAM_D = V1.REEL, 4.4
