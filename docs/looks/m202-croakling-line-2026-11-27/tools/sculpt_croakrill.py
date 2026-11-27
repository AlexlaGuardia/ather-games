"""M202 CROAKRILL (Croakling's Water form; locked art athernyx assets/stage2/008-croakrill.png, looked at, never traced, never in this repo).
python sculpt_croakrill.py <out.glb>. Starts from the base Croakling (croak_common.base()); what is HERS, not the base's:
  a TALLER, upright, sleeker body (sits high on long straight arms), a smaller jaw, bigger glossy eyes that are nearly all pupil;
  GILL FRONDS: three trailing tendrils a side off the back of her head; LONG WEBBED toes (fingers and toes 1.3x, a web between them);
  dark teal SPOTS on her back, haunches and arms; a mint coat over a pale lime belly; the lure's orb a cool CYAN water drop."""
import sys, numpy as np
import croak_common as C
from croak_common import cone, ell, su, ss, V3
S = C.base()
S.TC, S.TR = V3(0, .33, -.03), V3(.32, .33, .26)                               # taller, a touch narrower
S.HC, S.HR = V3(0, .58, .07), V3(.33, .18, .26)
S.EBC = V3(.190, .735, .125); S.RE = .092; S.KE = S.RE / .066                    # bigger eyes, higher
S.L0, S.L1, S.L2 = V3(0, .745, -.03), V3(-.12, 1.16, .04), V3(-.40, .985, .20); S.ORB, S.ORBR = V3(-.424, .898, .230), V3(.088, .092, .088)
S.ARM = ((.205, .420, .175), (.215, .070, .305)); S.HAND = V3(.226, .030, .335)
S.FINGERS = [(a, L * 1.32) for a, L in S.FINGERS]; S.TOES = [(a * 1.1, L * 1.3) for a, L in S.TOES]
S.HAUNCH, S.HAUNCHR = V3(.300, .215, -.085), V3(.150, .165, .205); S.FOOT = V3(.395, .030, .125); C.retip(S)
S.SMILE_Y = .475; S.BOUNDS = (V3(-.62, -.033, -.45), V3(.62, .95, .58))
FR = [((.255, .60, -.06), (.36, .50, -.20), (.33, .37, -.26)), ((.27, .55, -.04), (.40, .44, -.13), (.40, .31, -.17)), ((.24, .65, -.10), (.30, .58, -.27), (.25, .46, -.34))]
def fronds(M):
    d = 9
    for a, b, c in FR:
        a, b, c = V3(*a), V3(*b), V3(*c); d = np.minimum(d, su(cone(M, a, b, .022, .016), cone(M, b, c, .016, .009), .012))
    return d
_head = S.head
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, (0, .515, .14), (.31, .110, .215)), .05); d = su(d, ell(M, S.EBC, (.124, .118, .118)), .05)
    return su(d, fronds(M), .03)
S.head = head
def throat(M): return ell(M, (0, .445, .215), (.215, .085, .125))
S.throat = throat
def webs(M):
    d = 9
    for c, tp in ((S.HAND, S.FT_TIPS), (S.FOOT, S.TOE_TIPS)):
        for a, b in zip(tp[:-1], tp[1:]):                                          # a thin web from the palm out between each pair of toes
            m = (V3(*a) + V3(*b)) / 2 * .78 + c * .22; d = np.minimum(d, ell(M, m, (.055, .010, .055)))
    return d
_pads = S.pads
S.pads = lambda M: np.minimum(_pads(M), webs(M))
S.SKIN, S.BELLY, S.PAD = map(S.C8, ('#55c39c', '#e3ee9e', '#8fe2bc')); S.HEADC = S.SKIN; SPOT = S.C8('#2a8170')
S.STALK, S.BULB, S.CAP, S.MOUTH = (52, 128, 116), (150, 246, 236), (64, 168, 158), (24, 82, 66)
C.eye_palette(S, rim=(40, 120, 104), iris=(36, 70, 72), hi=(250, 255, 255), hi2=(200, 240, 236))
SP = C.surf_pts(S, 70, 8, lambda P: (P[:, 1] > .14) & (P[:, 2] < .16) & (P[:, 1] < .66))
_classes = S.classes
def classes(V):
    out = _classes(V); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]
    d = np.min(np.linalg.norm(M[:, None] - np.c_[np.abs(SP[:, 0]), SP[:, 1:]][None], axis=2), 1)
    belly = out[0] > 0; out.append(np.where(belly | (V[:, 1] < .06), -.05, np.clip(.026 - d, -.05, .05))); return out
S.classes = classes; S.PAL = [S.BELLY, S.PAD, SPOT]
if __name__ == '__main__': C.build(S, sys.argv[1])
