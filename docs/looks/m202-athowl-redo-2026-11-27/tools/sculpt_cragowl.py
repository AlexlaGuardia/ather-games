"""CRAGOWL (Athowl, Earth, ledger #24, 024-cragowl.png): her own body, read from her locked art.
Stocky and shaggy brown: a broad barrel body under layered scale feathers, a wide flat head with BRANCHING ANTLERS where the tufts
would be (three tines a side), a ruff of shaggy cheek feathers, moss on her shoulders and brow, an amber gem on her brow, round
amber eyes with big dark pupils, long heavy wings folded down her sides to her feet, a short square tail, big dark talons.
    python sculpt_cragowl.py out.glb"""
import sys, numpy as np
from owl_common import Owl, Wing, cone, ell, su, ss, V3, C8, zig, yrot, mirror

NECK_Y, NECK_R, GROOVE, LID = .540, (.15, .33), .355, .075
WING_YMAX = .58; WING_CUT = ((.28, .48, .0), .09); SHOULDER = ((.19, .48, .0), (.31, .49, .01), .065, .045)
WING = Wing((.315, .510, .020), (.350, .085, .035), .45, [(.40, 0, .47, .160, 0), (.79, .066, .30, .062, 1), (.81, .005, .31, .068, 1), (.75, -.062, .31, .066, 1), (.62, .105, .26, .050, 1), (.56, -.105, .26, .048, 1)], bow=.064, thick=(.052, .034))   # REDO: heavier, layered (no lobe past the tip: it hangs by her feet and the hop dipped it under the ground)
BARREL = ((0, .315, .0), (.345, .282, .312))       # REDO: a broader barrel (belly kept 33 mm up: lower, the hop's pelvis bob sank it)
def trunk(P, M):
    b = ell(M, *BARREL); b = su(b, ell(M, (0, .46, .0), (.28, .16, .26)), .10)
    b = su(b, cone(P * V3(.6, 1, 1), (0, .19, -.24), (0, .10, -.33), .09, .06), .05)            # a short square tail
    return su(b, feet(M), .03)
DC = (.135, .705, .195)
def head(M):
    d = ell(M, (0, .72, -.01), (.32, .21, .28))
    d = su(d, ell(M, DC, (.125, .122, .095), yrot(.30)), .035)
    d = ss(d, ell(M, V3(*DC) + V3(0, 0, .115) @ yrot(.30).T, (.105, .103, .035), yrot(.30)), .010)
    for x, y in ((.27, .62), (.30, .70), (.24, .60), (.28, .78), (.21, .66)): d = su(d, cone(M, (x - .06, y, .12), (x + .07, y - .05, .10), .062, .007), .03)     # shaggy cheek ruff (the lowest tuft kept above the neck groove: across it, it closed a loop)
    for a, b, ra, rb in (((.17, .86, .03), (.23, 1.00, .0), .046, .033), ((.23, 1.00, .0), (.27, 1.14, -.02), .033, .016),    # antlers: a beam and two tines
                         ((.225, .985, .0), (.12, 1.07, .03), .026, .014), ((.245, 1.05, -.008), (.35, 1.10, -.01), .024, .013)):
        d = su(d, cone(M, a, b, ra, rb), .016)
    b = cone(M, (0, .665, .290), (0, .600, .325), .032, .024); b = su(b, cone(M, (0, .605, .322), (0, .555, .322), .024, .004), .02)
    return su(d, b, .010)
def feet(M):
    d = cone(M, (.13, .15, .02), (.135, .075, .05), .080, .046)                                   # REDO: shaggy feathered trousers
    for x, z in ((-.07, .135), (0, .16), (.07, .135)): d = su(d, cone(M, (.135 + x * .5, .044, .06), (.135 + x * 1.1, .038, z), .036, .036), .008)
    return d
BOUNDS = ((-.47, -.03, -.44), (.47, 1.18, .44))
PLUME = (.050, .060, .013, .10, .50)    # REDO: layered scale feathers over her whole front (was six lumps)
LM = dict(pelvis=(0, .21, -.02), chest=(0, .37, 0), leg=(.125, .16, .02), shin=(.13, .10, .045), foot=(.13, .05, .06), lids=(0, .70, .19),
          tail1=(0, .18, -.24), tail2=(0, .13, -.30), tailtip=(0, .09, -.36), tuft=((.19, .90, .02), (.29, 1.13, -.02)),
          tuftmask=lambda A: (A[:, 1] > .90), tailmask=lambda V: (V[:, 2] < -.27) & (V[:, 1] < .22), leg_ymax=.11,
          core=lambda A: ell(A, *BARREL), wing_x0=.25, wing_x1=.31)

# the wing tip flares out to 0.35: hung straight down (0.315) the blade ran inside the barrel and came out again = a handle
BROWN, DARK, TAN, MOSS, ANTLER, BEAK, TOE = map(C8, ('#8a5a2c', '#5a3818', '#c99a5a', '#6f9a3a', '#a07a4a', '#2e2620', '#3a2e24'))
COAT = (C8('#6e4520'), C8('#b07a3c')); COAT_KEY = C8('#b07a3c')
def classes(V, o):
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; on, t, w, n = o.wingmask(V); out = o.plumage(V, on, .24, .12)
    out.append(np.where(on & (t > .22), .010 - np.abs(((t * 6 + .6 * zig(w / .07, 1)) % 1) - .5) * .05, -.05))            # REDO: wing feather rows
    out.append(np.where(on, (t - .55 - .12 * zig(w / .18 + .2, 5)) * WING.WL, -.05))                          # dark wing ends
    q = (M - V3(*DC)) @ yrot(.30); e = 1 - np.sqrt((q[:, 0] / .135) ** 2 + (q[:, 1] / .132) ** 2)
    out.append(np.where(q[:, 2] > .02, e * .12, -.05))                                                         # tan eye discs
    out.append(.055 + .02 * zig(x * 3 + z * 2, 6) - np.minimum(np.hypot(A - .22, y - .50), np.hypot(x, y - .86) + .01))   # moss on her shoulders + brow
    out.append(np.where(y > .88, .1 + y - .95, -.05))                                                          # antlers
    out.append(np.where((z > .22) & (y < .67) & (y > .54), np.minimum(.034 - A, z - np.interp(y, [.55, .59, .64, .67], [.31, .32, .31, .30])), -.05))
    out.append(np.where(y < .085, np.minimum(.085 - y, z - .05), -.05))
    return out
PAL = [C8('#4a2c12'), C8('#d0a466'), C8('#4e3015'), DARK, TAN, MOSS, ANTLER, BEAK, TOE]
EYE = dict(c=DC, yaw=.30, r=.084, dome=.022, rings=[(.084, (60, 34, 10)), (.075, (200, 120, 20)), (.064, (240, 170, 40)), (.050, (24, 14, 8))],
           lid=(150, 104, 60), lidline=(70, 44, 20))
def decals(o, parts):
    GY = .845; o.put(parts, [(0, GY + .040), (.024, GY), (0, GY - .034), (-.024, GY), (0, GY)], [(4, 0, 1), (4, 1, 2), (4, 2, 3), (4, 3, 0)], (250, 190, 60), .007)   # amber gem
    for x, z in ((-.07, .135), (0, .16), (.07, .135)): o.claw(parts, (.135 + x * 1.1, .046, z + .026), (.135 + x * 1.15, .022, z + .054), .021, (40, 32, 26))   # REDO: tips 22 mm up, the hop's toe-roll dipped 13 mm ones   # tips 13 mm up: lower, the landing (run>walk) blend dipped them 3 mm

if __name__ == '__main__':
    Owl(sys.modules[__name__]).run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 6500)
