"""VOLTOWL (Athowl, Storm, ledger #23, 023-voltowl.png): her own body, read from her locked art.
A small round pale-blue body with a white face, held up by BIG wings raised open in a V (the art's display pose is her rest pose:
she stands with them half-spread, and the rig beats them from there), jagged ice-feather edges, short pointed ear tufts, piercing
blue eyes under a frowning brow, a violet crystal on her brow, a fan of pointed tail feathers under her, small grey talons.
    python sculpt_voltowl.py out.glb"""
import sys, numpy as np
from owl_common import Owl, Wing, cone, ell, su, ss, V3, C8, zig, yrot, mirror

NECK_Y, NECK_R, GROOVE, LID = .530, (.13, .29), .30, .065
WING_YMAX = 1.2; WING_CUT = ((.21, .50, .0), .07); SHOULDER = ((.14, .49, .0), (.24, .52, .0), .055, .040)
WING = Wing((.230, .520, .000), (.600, .860, -.040), .15, [(.36, 0, .40, .120, 0), (.82, .055, .26, .040, 1), (.80, .000, .27, .045, 1), (.74, -.055, .28, .045, 1), (.64, -.105, .27, .040, 1), (.52, -.135, .22, .035, 1), (.40, -.150, .18, .030, 1)], bow=.030, thick=(.040, .030))
BALL = ((0, .345, .0), (.245, .235, .230))
def trunk(P, M):
    b = ell(M, *BALL); b = su(b, ell(M, (0, .47, .0), (.19, .12, .19)), .08)
    for x, ln in ((0, .0), (.07, .02), (.14, .05)):                                            # the fan of pointed tail feathers under her
        b = su(b, cone(M, (x * .6, .19, -.05), (x, .07 + ln, -.14), .045, .006), .03)
    return su(b, feet(M), .03)
DC = (.105, .675, .170)
def head(M):
    d = ell(M, (0, .695, -.005), (.255, .190, .225))
    d = su(d, ell(M, DC, (.105, .100, .085), yrot(.30)), .035)
    d = ss(d, ell(M, V3(*DC) + V3(0, 0, .098) @ yrot(.30).T, (.090, .086, .030), yrot(.30)), .010)
    d = su(d, cone(M, (.17, .80, .07), (.215, .905, .03), .055, .004), .03)                   # short pointed ear tufts
    d = su(d, cone(M, (.0, .84, .14), (.0, .90, .12), .05, .004), .03)                        # the brow crest under her crystal
    b = cone(M, (0, .640, .215), (0, .585, .245), .026, .018); b = su(b, cone(M, (0, .590, .243), (0, .550, .238), .018, .004), .02)
    return su(d, b, .010)
def feet(M):
    d = cone(M, (.085, .16, .02), (.090, .055, .05), .040, .030)
    for x, z in ((-.035, .085), (0, .10), (.035, .085)): d = su(d, cone(M, (.090, .045, .05), (.090 + x, .030, z), .018, .020), .006)
    return d
BOUNDS = ((-.75, -.03, -.30), (.75, 1.0, .36))
LM = dict(pelvis=(0, .24, -.02), chest=(0, .38, 0), leg=(.085, .17, .02), shin=(.088, .11, .04), foot=(.090, .05, .05), lids=(0, .67, .16),
          tail1=(0, .20, -.06), tail2=(0, .13, -.11), tailtip=(0, .07, -.15), tuft=((.17, .80, .07), (.215, .905, .03)),
          tuftmask=lambda A: (A[:, 0] > .15) & (A[:, 1] > .79), tailmask=lambda V: (V[:, 2] < -.06) & (V[:, 1] < .20) & (V[:, 1] > .05), leg_ymax=.17,
          core=lambda A: ell(A, *BALL), wing_x0=.20, wing_x1=.24, up0=.80)

ICE, PALE, WHITE, CRY, BEAK, TOE, BROW = map(C8, ('#7fa8e6', '#bcd6fa', '#f2f7ff', '#b49cff', '#4a5468', '#8a93a6', '#2e3e66'))
COAT = (C8('#7d9fd6'), C8('#cfe1fb')); COAT_KEY = C8('#cfe1fb')
def classes(V, o):
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; on, t, w, n = o.wingmask(V); out = []
    out.append(np.where(on, (t - .62 - .12 * zig(w / .12 + .3, 4)) * WING.WL, -.05))                       # jagged deeper-blue wing tips
    q = (M - V3(*DC)) @ yrot(.30); e = 1 - np.sqrt((q[:, 0] / .16) ** 2 + (q[:, 1] / .14) ** 2)
    out.append(np.where((z > .08) & (y > .55) & (y < .80), np.maximum(e * .1, np.minimum(.16 - A, .78 - y) * .3), -.05))      # the white face
    out.append(np.where((z > .1) & (y < .50) & (y > .16) & ~on, .12 - np.hypot(x / 1.1, (y - .33) / 1.4), -.05))                 # white breast
    out.append(np.where((z > .18) & (y < .66) & (y > .54), np.minimum(.026 - A, z - np.interp(y, [.55, .59, .63, .66], [.23, .245, .235, .22])), -.05))   # beak
    out.append(np.where(y < .07, np.minimum(.07 - y, z - .03), -.05))                                        # talons
    return out
PAL = [ICE, WHITE, WHITE, BEAK, TOE]
EYE = dict(c=DC, yaw=.30, r=.066, dome=.018, rings=[(.066, (24, 40, 80)), (.058, (40, 110, 210)), (.046, (90, 170, 240)), (.026, (12, 16, 30))],
           lid=(206, 222, 248), lidline=(60, 80, 130), brow=(46, 62, 102))
def decals(o, parts):
    GY = .835                                                                                   # the violet crystal on her brow: a faceted diamond
    o.put(parts, [(0, GY + .045), (.022, GY), (0, GY - .040), (-.022, GY), (0, GY)], [(4, 0, 1), (4, 1, 2), (4, 2, 3), (4, 3, 0)], (180, 150, 255), .006)
    o.put(parts, [(0, GY + .030), (.010, GY + .004), (0, GY - .010), (-.010, GY + .004), (0, GY + .006)], [(4, 0, 1), (4, 1, 2), (4, 2, 3), (4, 3, 0)], (236, 224, 255), .009)
    for sg in (1, -1):                                                                          # pale lightning veins on her breast: branching strokes
        o.stroke(parts, [(sg * .03, .45), (sg * .07, .40), (sg * .05, .35), (sg * .10, .29), (sg * .08, .24)], .008, (236, 246, 255), .004)
        o.stroke(parts, [(sg * .05, .35), (sg * .015, .31), (sg * .03, .26)], .006, (236, 246, 255), .004)
    for x, z in ((-.035, .085), (0, .10), (.035, .085)): o.claw(parts, (.090 + x * 1.1, .030, z + .012), (.090 + x * 1.2, .005, z + .032), .011, (70, 76, 92))

if __name__ == '__main__':
    Owl(sys.modules[__name__]).run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 4400)
