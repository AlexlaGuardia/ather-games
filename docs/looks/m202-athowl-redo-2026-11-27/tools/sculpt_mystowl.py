"""MYSTOWL (Athowl, Mana, ledger #4, 004-mystowl.png): her own body, read from her locked art.
A tall bottom-heavy EGG (widest low, at the belly), a head as wide as her body with two huge grey eye discs that nearly touch and
deep violet irises, tall ragged ear tufts at the crown corners, the gold third eye on her brow, short scalloped wings folded flat at
her sides, a gold flowing infusion pattern on her flanks, three dark claws a foot, no visible legs.   python sculpt_mystowl.py out.glb"""
import sys, numpy as np
from owl_common import Owl, Wing, cone, ell, su, ss, V3, C8, zig, yrot, mirror

NECK_Y, NECK_R, GROOVE, LID = .545, (.15, .33), .36, .075
WING_YMAX = .56; WING_CUT = ((.27, .47, .0), .09); SHOULDER = ((.18, .47, .0), (.30, .48, .01), .060, .040)
WING = Wing((.310, .500, .020), (.372, .155, .050), .55, [(.40, 0, .46, .150, 0), (.72, .055, .36, .062, 1), (.66, -.010, .36, .068, 1), (.58, -.070, .34, .064, 1), (.50, .110, .30, .050, 1), (.78, .020, .18, .045, 1), (.46, -.110, .26, .045, 1)], bow=.052, thick=(.046, .030))   # REDO: fuller blade, two more layered feathers
EGG = ((0, .335, 0), (.335, .270, .325))       # REDO: a deeper egg (heft); wider than .335 she swallows her wing root = handles
def trunk(P, M):
    b = ell(M, *EGG); b = su(b, ell(M, (0, .47, .0), (.29, .17, .27)), .10)                      # the egg runs up into her shoulders
    b = su(b, cone(P * V3(.8, 1, 1), (0, .20, -.22), (0, .10, -.33), .08, .03), .05)             # a short tail point
    return su(b, feet(M), .03)
DC = (.150, .700, .175)
def head(M):
    d = ell(M, (0, .735, -.01), (.335, .225, .280))
    d = su(d, ell(M, DC, (.160, .158, .110), yrot(.32)), .04)                                    # the big eye discs, nearly touching
    d = ss(d, ell(M, V3(*DC) + V3(0, 0, .135) @ yrot(.32).T, (.135, .133, .045), yrot(.32)), .012)
    for a, b, ra, rb in (((.22, .84, .14), (.30, .98, .09), .090, .026), ((.27, .86, .10), (.335, 1.00, .03), .070, .006), ((.17, .87, .13), (.21, 1.01, .07), .058, .006), ((.29, .83, .06), (.37, .94, .0), .060, .006)):
        d = su(d, cone(M, a, b, ra, rb), .03)                                                    # ragged tufts: four thick spikes a side
    for a, b in (((.26, .70, .12), (.37, .63, .09)), ((.28, .77, .08), (.38, .72, .04)), ((.24, .64, .15), (.33, .595, .14))):
        d = su(d, cone(M, a, b, .050, .006), .025)                                               # REDO: a shaggy cheek ruff (tips kept above the neck groove)
    b = cone(M, (0, .665, .275), (0, .600, .310), .030, .022); b = su(b, cone(M, (0, .605, .308), (0, .560, .310), .022, .004), .02)
    return su(d, b, .010)
def feet(M):
    d = ell(M, (.140, .066, .060), (.098, .060, .092))                                            # REDO: heavy feathered feet
    for x, z in ((-.065, .13), (0, .155), (.065, .13)): d = su(d, cone(M, (.140 + x * .5, .042, .07), (.140 + x * 1.1, .034, z), .036, .038), .008)
    return d
BOUNDS = ((-.52, -.03, -.42), (.52, 1.06, .42))
LM = dict(pelvis=(0, .22, -.02), chest=(0, .38, 0), leg=(.13, .16, .02), shin=(.14, .10, .05), foot=(.14, .05, .06), lids=(0, .70, .18),
          tail1=(0, .18, -.24), tail2=(0, .13, -.30), tailtip=(0, .09, -.36), tuft=((.24, .86, .12), (.32, 1.0, .06)),
          tuftmask=lambda A: (A[:, 0] > .17) & (A[:, 1] > .85), tailmask=lambda V: (V[:, 2] < -.27) & (V[:, 1] < .22), leg_ymax=.11,
          core=lambda A: ell(A, *EGG), wing_x0=.24, wing_x1=.30)

VIOLET, DEEP, LAV, DISC, GOLD, BEAK, TOE = map(C8, ('#9a7cd0', '#46297c', '#c3b0ea', '#c9c2d6', '#e8c25a', '#3a3340', '#4a4452'))
COAT = (C8('#6f55a6'), C8('#a78bdc')); COAT_KEY = C8('#a78bdc')
PLUME = (.052, .062, .011, .10, .50)    # REDO: layered breast feathers (row, feather width, proud by, y band)
GROOVE_SHADE = .2      # the neck groove's painted shadow, light on her: at the shared .7 her head/body join read as a hard box edge
# DEEP darker than her coat's own shade (#6f55a6): at #6c4fa8 her scalloped wing ends did not show
def classes(V, o):
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; on, t, w, n = o.wingmask(V); out = o.plumage(V, on)
    out.append(np.where(on & (t > .30), .010 - np.abs(((t * 6 + .6 * zig(w / .07, 1)) % 1) - .5) * .05, -.05))            # REDO: layered feather rows painted on the wing
    out.append(np.where(on, (t - .50 - .14 * zig(w / .2 + .3, 5)) * WING.WL, -.05))                          # deep violet scalloped wing ends
    out.append(np.where(on & (t < .42) & (n > -.004), .045 - np.abs(w - .02) * .4, -.05))                     # lighter wing shoulders
    q = (M - V3(*DC)) @ yrot(.32); e = 1 - np.sqrt((q[:, 0] / .150) ** 2 + (q[:, 1] / .148) ** 2)
    out.append(np.where(q[:, 2] > .02, e * .13, -.05))                                                         # grey eye discs
    out.append(np.where((z > .2) & (y < .70) & (y > .55), np.minimum(.032 - A, z - np.interp(y, [.56, .60, .66, .70], [.29, .30, .29, .28])), -.05))   # dark beak
    out.append(np.where(y < .085, np.minimum(.085 - y, z - .05), -.05))                                       # toes
    tp = V3(.32, .99, .06); out.append(.10 + .03 * zig(y + z, 14) - np.linalg.norm(M - tp, axis=1))             # tuft tips deep
    return out
PAL = [C8('#4f3588'), LAV, C8('#5a3f92'), DEEP, LAV, DISC, BEAK, TOE, DEEP]
EYE = dict(c=DC, yaw=.32, r=.098, dome=.024, rings=[(.098, (60, 30, 90)), (.086, (120, 60, 190)), (.072, (170, 110, 235)), (.050, (28, 12, 40))],
           lid=(190, 176, 222), lidline=(70, 50, 110))
def decals(o, parts):
    th = np.arange(24) / 24 * 2 * np.pi; GY = .865                                                   # the gold third eye on the brow (her art's mark)
    al = lambda k: np.c_[k * .070 * np.cos(th), GY + k * .040 * np.sign(np.sin(th)) * np.abs(np.sin(th)) ** 1.35]
    o.ring(parts, al(1), al(.80), (250, 214, 110), .0035); o.disc2(parts, 0, GY, .020, (120, 60, 30), .0040, 12)
    th = np.linspace(0, 1, 28, endpoint=False)                                                       # REDO (Magii 0d6d577): GLYPH PANELS on each flank,
    def panel(k):                                                                                    # as her art: a gold-framed panel, a flowing infusion
        a = th * 2 * np.pi; cx, cy, rx_, ry_ = .185, .275, .062 * k, .150 * k                        # pattern inside it (a pattern, never a sigil)
        return np.c_[cx + rx_ * np.sin(a) * (1 - .30 * np.clip(-np.cos(a), 0, 1)), cy + ry_ * np.cos(a) * (1 + .12 * (np.cos(a) < 0))]
    G = (236, 196, 92)
    for sg in (1, -1):
        sx = lambda X: np.c_[sg * X[:, 0], X[:, 1]]
        P = sx(panel(.96)); o.put(parts, np.vstack([[sg * .185, .275], P]), [(0, 1 + i, 1 + (i + 1) % 28) for i in range(28)], (86, 56, 140), .0032)
        o.ring(parts, sx(panel(1.0)), sx(panel(.86)), G, .0042)
        u = np.linspace(0, 1, 20)
        o.stroke(parts, np.c_[sg * (.185 + .030 * np.sin(u * 2 * np.pi * 1.25)), .155 + .24 * u], .009, G, .0046)               # the flowing spine
        for cy, dr in ((.215, 1), (.300, -1), (.375, 1)):                                                                      # three curls off it
            q = np.linspace(0, 1.6 * np.pi, 14); r_ = .026 * (1 - q / (2.2 * np.pi))
            o.stroke(parts, np.c_[sg * (.185 + dr * (.012 + r_ * np.cos(q))), cy + r_ * np.sin(q)], .007, G, .0046)
    for x, z in ((-.065, .13), (0, .155), (.065, .13)): o.claw(parts, (.140 + x * 1.1, .040, z + .026), (.140 + x * 1.15, .026, z + .056), .022, (52, 46, 60))   # tips 26 mm up: the run>lie + run>walk landings dipped lower ones 2.6 mm under

if __name__ == '__main__':
    Owl(sys.modules[__name__]).run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 6500)
