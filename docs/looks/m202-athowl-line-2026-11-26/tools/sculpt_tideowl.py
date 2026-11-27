"""TIDEOWL (Athowl, Water, ledger #25, 025-tideowl.png): her own body, read from her locked art.
Sleek and long: a teardrop body that leans forward and runs back into a LONG tail of overlapping feathers, a smooth round head
with NO tufts, a pale heart-shaped face, a round water-drop gem on her crown, big dark teal eyes in pale rings, long wings folded
along her back past her tail root, scaled wing feathers, longer legs that show (grey with pale talons).   python sculpt_tideowl.py out.glb"""
import sys, numpy as np
from owl_common import Owl, Wing, cone, ell, su, ss, V3, C8, zig, yrot, mirror

NECK_Y, NECK_R, GROOVE, LID = .560, (.13, .29), .30, .065
WING_YMAX = .60; WING_CUT = ((.22, .50, -.02), .08); SHOULDER = ((.14, .50, -.02), (.24, .52, -.02), .055, .040)
WING = Wing((.245, .540, -.020), (.200, .160, -.330), .70, [(.40, 0, .45, .110, 0), (.80, .040, .32, .040, 1), (.78, -.010, .32, .045, 1), (.70, -.060, .30, .045, 1), (.58, .080, .28, .035, 1)], bow=.040)
def rxm(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
DROP = ((0, .370, -.04), (.230, .250, .300), rxm(-.45))
def trunk(P, M):
    b = ell(M, *DROP); b = su(b, ell(M, (0, .50, .02), (.18, .12, .18)), .08)
    for x, ln in ((0, 0), (.055, -.02)):                                                       # the long tail: overlapping feathers to the back
        b = su(b, cone(M, (x * .5, .27, -.24), (x, .15 + ln * .5, -.54 + ln), .060, .022), .04)
    return su(b, feet(M), .03)
DC = (.100, .705, .175)
def head(M):
    d = ell(M, (0, .715, .03), (.245, .200, .225))
    d = su(d, ell(M, DC, (.105, .100, .080), yrot(.30)), .035)
    d = ss(d, ell(M, V3(*DC) + V3(0, 0, .095) @ yrot(.30).T, (.088, .085, .028), yrot(.30)), .010)
    b = cone(M, (0, .665, .245), (0, .605, .275), .026, .019); b = su(b, cone(M, (0, .610, .273), (0, .570, .262), .019, .004), .02)
    return su(d, b, .010)
def feet(M):
    d = cone(M, (.085, .22, .03), (.095, .055, .07), .042, .024)                                 # longer legs that show
    for x, z in ((-.035, .115), (0, .13), (.035, .115)): d = su(d, cone(M, (.095, .040, .07), (.095 + x, .030, z), .017, .019), .006)
    return su(d, cone(M, (.095, .05, .07), (.09, .035, .02), .017, .015), .006)
BOUNDS = ((-.40, -.03, -.66), (.40, .97, .36))
LM = dict(pelvis=(0, .25, -.04), chest=(0, .40, 0), leg=(.085, .20, .03), shin=(.092, .12, .05), foot=(.095, .05, .07), lids=(0, .70, .16),
          tail1=(0, .25, -.24), tail2=(0, .18, -.40), tailtip=(0, .15, -.54), tuft=((.15, .82, .05), (.18, .86, .03)),
          tuftmask=lambda A: (A[:, 0] > .99), tailmask=lambda V: (V[:, 2] < -.25) & (V[:, 1] < .32), leg_ymax=.19,
          core=lambda A: ell(A, *DROP), wing_x0=.17, wing_x1=.23, drop_max=.040)

TEAL, DEEP, PALE, BEAK, TOE = map(C8, ('#3fb8c4', '#23808e', '#bdf0f0', '#4a4a50', '#e8e4dc'))
COAT = (C8('#2a9aaa'), C8('#7fdce0')); COAT_KEY = C8('#7fdce0')
def classes(V, o):
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; on, t, w, n = o.wingmask(V); out = []
    out.append(np.where(on, np.maximum((t - .58 - .10 * zig(w / .12, 4)) * WING.WL, .012 - np.abs(((t * 7 + np.abs(w) * 10) % 1) - .5) * .05), -.05))   # deep wing ends + scale rows
    out.append(np.where((z > .1) & (y > .58) & (y < .82), .11 - np.hypot(A / 1.25, (y - .70) * (1 + (y < .70))), -.05))           # pale heart face
    out.append(np.where((z > .18) & (y < .67) & (y > .56), np.minimum(.026 - A, z - np.interp(y, [.57, .61, .65, .67], [.255, .27, .26, .25])), -.05))
    out.append(np.where((y < .20) & (np.abs(z - .06) < .09), np.minimum(.20 - y, .12 - A + .0), -.05))                             # grey legs
    out.append(np.where(y < .07, np.minimum(.07 - y, z - .07), -.05))                                                               # pale talons
    return out
PAL = [DEEP, PALE, BEAK, BEAK, TOE]
EYE = dict(c=DC, yaw=.30, r=.068, dome=.018, rings=[(.068, (200, 236, 236)), (.058, (16, 60, 70)), (.048, (30, 120, 130)), (.032, (8, 20, 24))],
           lid=(120, 210, 214), lidline=(30, 100, 110))
def decals(o, parts):
    o.disc2(parts, 0, .875, .026, (150, 230, 255), .007, 16); o.disc2(parts, .006, .884, .009, (240, 252, 255), .010, 10)     # the round water gem on her crown
    for x, z in ((-.035, .115), (0, .13), (.035, .115)): o.claw(parts, (.095 + x * 1.1, .030, z + .012), (.095 + x * 1.2, .005, z + .032), .010, (200, 196, 186))

if __name__ == '__main__':
    Owl(sys.modules[__name__]).run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 4400)
