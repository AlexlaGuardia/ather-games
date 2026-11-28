"""M202 LUMINARC (Luminara's Storm form; locked art athernyx assets/stage2/029-luminarc.png, looked at, never traced, never in this repo).
python sculpt_luminarc.py <out.glb>. Starts from the base Luminara (lum_common.base()); what is HERS, not the base's:
  icy pale blue all over; an ANGULAR head (a pointed crown and two temple points, a brow plate); long BRANCHED lightning antennae
  (antler forks, no knobs); a collar of ice crystal petals round her neck; an upright oval abdomen drawn to a point; white LIGHTNING
  forks laid over her body (unlit strips: they glow); long thin dangling legs and longer arms; long narrow pale wings with white
  jagged veins; an open happy mouth; blue eyes; a pale cyan lamp."""
import sys, numpy as np
import lum_common as C
from lum_common import cone, ell, su, V3
S = C.base(); S.TRIS = 9500
S.AC, S.AR_ = V3(0, .28, -.12), V3(.215, .215, .29); C.axis(S, (0, .82, .57))
S.BOUNDS = (V3(-.32, -.08, -.46), V3(.32, 1.02, .46))
TIP = S.AC - S.AX * .38
def abdomen(M):
    q = S.aq(M); return su(ell(q, (0, 0, 0), S.AR_), cone(M, S.AC - S.AX * .12, TIP, .15, .02), .08)
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, (0, .605, .245), (.190, .135, .150)), .05)
    d = su(d, cone(M, S.HC + V3(0, .10, -.02), V3(0, .95, .17), .12, .012), .05)                   # the pointed crown
    d = su(d, cone(M, S.HC + V3(.10, .08, 0), V3(.205, .84, .17), .07, .012), .04)                 # temple points
    return su(d, ell(M, (0, .79, .30), (.09, .035, .05)), .03)                                       # brow plate
S.abdomen, S.head = abdomen, head
S.ARM = ((.110, .430, .110), (.215, .315, .245)); S.HAND = V3(.226, .300, .258)
S.LEG = ((.075, .405, -.010), (.160, .215, .075)); S.FOOTL = V3(.166, .205, .082)
def arms(M): return su(cone(M, S.ARM[0], S.ARM[1], .032, .022), ell(M, S.HAND, (.030, .028, .030)), .012)
def legs(M): return su(cone(M, S.LEG[0], S.LEG[1], .022, .015), ell(M, S.FOOTL, (.020, .018, .024)), .010)
S.arms, S.legs = arms, legs
ICE, ICE_D, FACE, LIMB, SEAMC = map(S.C8, ('#a9c6ea', '#86a6d6', '#dce9f8', '#93b2de', '#d8e8fa'))
S.GOLD, S.FACE, S.HEADC = ICE, FACE, FACE
def classes(V):
    M, ab, hd, tx, ar, lg = C.regions(S, V); core = np.minimum(np.minimum(ab, hd), tx)
    dors = (M - S.AC) @ S.ADN
    crown = np.where(hd < np.minimum(ab, tx), (M[:, 1] - .74) + .3 * (.15 - M[:, 2]), -1)
    cr = np.sin(M[:, 0] * 31 + M[:, 1] * 17) + np.sin(M[:, 1] * 29 - M[:, 2] * 23) + np.sin(M[:, 2] * 27 + M[:, 0] * 13)   # ice crackle seams
    return [np.where(core < np.minimum(ar, lg) - .004, np.clip(np.maximum(np.where(ab < hd, dors - .06, -1), crown), -.05, .05), -.05),
            np.where((ab < np.minimum(hd, tx)) & (dors > .02), np.clip(.004 - np.abs(cr) * .02, -.05, .05), -.05),
            C.face(S, M, hd, ab), np.where(np.minimum(ar, lg) < core - .002, .02, -.05)]
S.classes = classes; S.PAL = [ICE_D, SEAMC, FACE, LIMB]
S.A0, S.A1, S.A2 = V3(.060, .860, .150), V3(.110, 1.090, .080), V3(.250, 1.230, .150); S.KNOB = S.A2
S.abz = lambda t: np.outer((1 - t) ** 2, S.A0) + np.outer(2 * (1 - t) * t, S.A1) + np.outer(t * t, S.A2)
S.KNOBS = False; S.BOUNDS = (S.BOUNDS[0], V3(.32, 1.02, .46))
S.STALK, S.KNOBC, S.KNOBHI = (196, 220, 246), (190, 214, 244), (230, 240, 255)
S.MEMB, S.VEIN, S.RIM = (224, 234, 246), (252, 253, 255), (150, 180, 222)
S.REMAP = {C.EYE_LIT['rim']: (22, 40, 84), C.EYE_LIT['iris']: (74, 146, 226), C.EYE_LIT['pupil']: (16, 24, 52)}
S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.46, .5, .34), .60, .19), 'h': (S.WROOT['h'], *S.wdir(-.18, .5, .46), .46, .15)}
S.LAMP_R = .16; S.LAMP_U = V3(0, -.10, 1.); S.LAMP_COLS = ((196, 236, 255), (226, 246, 255), (246, 252, 255))
BOLT, PETAL, MOUTH, TONGUE = (238, 250, 255), (206, 226, 250), (118, 36, 52), (240, 120, 126)
S.DECO = [BOLT, PETAL, MOUTH, TONGUE]
def deco():
    parts = []; c = S.AC.copy()
    for k, (a, b) in enumerate((((.07, .50, .16), (.16, .06, .02)), ((-.09, .48, .14), (-.13, .10, .10)), ((.21, .38, -.10), (.12, .02, -.20)), ((-.20, .40, -.15), (-.06, .00, -.24)))):
        Q = C.jag(S, c, V3(*a), V3(*b), 5, .035, 7 + k); parts.append(S.strip(Q, BOLT, .0095, .004))
        m = Q[len(Q) // 2]; br = C.jag(S, c, m, m + V3(np.sign(a[0]) * .10, -.08, .04), 3, .02, 40 + k); parts.append(S.strip(br, BOLT, .0065, .004))
    for k in range(9):                                                                                       # the ice collar
        az = (k / 9 - .5) * 2.6 * np.pi / 2 * 1.35; u = V3(np.sin(az), -.25, np.cos(az)); b = V3(0, .535, .07) + V3(np.sin(az) * .12, 0, np.cos(az) * .11)
        parts.append(C.crystal(b, u, .050, .110, PETAL, 4, .02, tw=.785))
    T = np.linspace(0, 1, 60); BZ = S.abz(T)                                                                 # antler forks off each antenna (antenna colour: they ride its bones)
    for sx in (1, -1):
        X = V3(sx, 1, 1)
        for t0, dv, L in ((.35, (.9, .5, .2), .09), (.55, (-.5, .8, .3), .08), (.72, (.8, .4, -.3), .08), (.86, (-.2, .9, .4), .06), (.62, (.3, -.2, .9), .06)):
            p = S.abz(np.array([t0]))[0]; d = V3(*dv); d /= np.linalg.norm(d); q = p + d * L; m_ = (p + q) / 2 + V3(.012, .01, 0) * np.sign(dv[0])
            Cc = np.array([p, m_, q]); parts.append(C.tube(Cc * X, .009, .003, S.STALK))
    p = S.ray(S.HC, (V3(0, -.42, 1) / np.linalg.norm(V3(0, -.42, 1)))[None], .5)[0]; n, t1, t2 = S.frame(p)         # the open mouth
    P_, F_, _ = S.disc(p, n, t1, t2, .034, MOUTH, .0045, 16); P_[1:] = p + n * .0045 + (P_[1:] - p - n * .0045) * V3(1, .55, 1); parts.append((P_, F_, MOUTH))
    parts.append(S.disc(p - V3(0, .008, -.002), n, t1, t2, .016, TONGUE, .0060, 12))
    return parts
S.deco = deco
if __name__ == '__main__': C.build(S, sys.argv[1])
