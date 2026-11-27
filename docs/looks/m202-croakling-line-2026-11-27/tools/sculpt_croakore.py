"""M202 CROAKORE (Croakling's Earth form; locked art athernyx assets/stage2/027-croakore.png, looked at, never traced, never in this repo).
python sculpt_croakore.py <out.glb>. Starts from the base Croakling (croak_common.base()); what is HERS, not the base's:
  a TOAD: the heaviest of the line, a massive low barrel with the head sunk into the shoulders (no neck), thick arms, WARTS all over
  her back, head and haunches, MOSS on her crown, brow and shoulders; an ochre-gold coat on a golden belly; heavy-lidded orange eyes
  with a horizontal slit pupil; the lure's orb an amber teardrop. Size dial 1.5 (the line's biggest)."""
import sys, os, numpy as np
import croak_common as C
from croak_common import cone, ell, su, ss, V3
S = C.base()
S.TC, S.TR = V3(0, .29, -.03), V3(.42, .29, .31)
S.HC, S.HR = V3(0, .50, .09), V3(.38, .17, .28)
S.EBC = V3(.205, .640, .150); S.RE = .074; S.KE = S.RE / .066                    # smaller, heavier eyes, set low on the broad head
S.L0, S.L1, S.L2 = V3(0, .665, -.02), V3(-.13, 1.06, .05), V3(-.42, .895, .21); S.ORB, S.ORBR = V3(-.444, .800, .240), V3(.078, .098, .078)
S.ARM = ((.255, .360, .190), (.270, .070, .320)); S.HAND = V3(.285, .030, .345)
S.HAUNCH, S.HAUNCHR = V3(.350, .200, -.070), V3(.190, .175, .235); S.SHIN = ((.400, .120, -.160), (.440, .072, .070)); S.FOOT = V3(.450, .030, .125); C.retip(S)
S.SMILE_Y = .425; S.BOUNDS = (V3(-.70, -.033, -.45), V3(.70, .86, .58))
_arms = S.arms
def arms(M):                                                                     # thick forearms
    a, b = V3(*S.ARM[0]), V3(*S.ARM[1]); return su(_arms(M), cone(M, a, b, .092, .066), .03)
S.arms = arms
def torso(M):
    d = su(ell(M, S.TC, S.TR), ell(M, (0, .23, .08), (.38, .21, .28)), .06); return ss(d, M[..., 1] - .045, .03)
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, (0, .455, .16), (.35, .110, .225)), .05)
    d = su(d, ell(M, S.EBC, (.104, .094, .100)), .05)
    return su(d, ell(M, S.EBC + V3(0, .040, -.010), (.112, .040, .090)), .03)     # the heavy brow ridge over each eye
S.throat = lambda M: ell(M, (0, .390, .235), (.26, .085, .13))
# warts: bumps on the back, crown and haunches (not the belly or the face front)
WB = None
def warts(M):
    d = 9
    for p in WB: d = np.minimum(d, ell(M, p, (.028, .022, .028)))
    return d
S.torso, S.head = torso, head
WB = C.surf_pts(S, 70, 27, lambda P: (P[:, 2] < .20) & (P[:, 1] > .12) & (np.abs(P[:, 0]) > .02)); WB = np.c_[np.abs(WB[:, 0]), WB[:, 1:]]
_t, _h = torso, head
S.torso = lambda M: su(_t(M), warts(M), .022)
S.head = lambda M: su(_h(M), warts(M), .022)
S.SKIN, S.BELLY, S.PAD = map(S.C8, ('#c3912c', '#f0c552', '#d8aa4a')); S.HEADC = S.SKIN; MOSS = S.C8('#6e9a34')
S.STALK, S.BULB, S.CAP, S.MOUTH = (136, 96, 40), (255, 158, 52), (196, 104, 32), (92, 58, 20)
C.eye_palette(S, pupil_ry=.42, rim=(150, 96, 30), iris=(226, 120, 40), pupil=(26, 16, 10), hi=(255, 244, 220), hi2=(250, 214, 170))
_classes = S.classes
def classes(V):
    out = _classes(V); X, Y, Z = np.abs(V[:, 0]), V[:, 1], V[:, 2]
    n = np.sin(23 * X + 3) * np.sin(19 * Z + 1) + .7 * np.sin(31 * Y + 13 * X)                            # ragged moss edge
    top = (Y - .60) * 3 + .35 * n                                                                       # the crown + brow
    sh = .9 - np.hypot((X - .30) / .14, (Y - .42) / .10) + .35 * n                                       # each shoulder
    moss = np.maximum(top, sh) * .05; keep = (out[0] < 0) & (Z < .30)
    out.append(np.where(keep, np.clip(moss, -.05, .05), -.05)); return out
S.classes = classes; S.PAL = [S.BELLY, S.PAD, MOSS]
if __name__ == '__main__': C.build(S, sys.argv[1])
