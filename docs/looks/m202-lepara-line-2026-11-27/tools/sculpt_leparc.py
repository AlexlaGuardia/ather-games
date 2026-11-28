"""M202 LEPARC (Lepara's Storm form; "stays rabbit" per the grimoire ledger; locked art athernyx assets/stage2/032-leparc.png, looked at,
never traced, never in this repo).  python sculpt_leparc.py <out.glb>.  Starts from the base Lepara (lep_common.base()); what is HERS:
  a wild, static-fluffed hare: a spiky fur ruff standing off her chest, fur tufts flaring off her cheeks, long ears with tufted tips, a big
  round puff of a tail in place of the base's flat paddle, bigger hind feet; a pale storm-grey coat, pale front, blue eyes, a raised VIOLET
  diamond crystal on her brow, and pale LIGHTNING VEINS forking over her coat (infusion markings, pattern only: Magii ruling 0d6d577)."""
import sys, os, numpy as np
import lep_common as C
from lep_common import cone, ell, su, ss, V3
S = C.base()
S.EC = V3(.150, .862, -.022)
def ears(M):
    d = ell(M, S.EC, (.080, .205, .032), S.ER); d = ss(d, -ell(M, S.EC + S.ER @ V3(0, .016, .026), (.054, .165, .021), S.ER), .008)
    t = S.EC + S.ER @ V3(0, .18, 0)                                                      # a tuft of three points at each tip
    for dx, l in ((0, .060), (.028, .045), (-.028, .045)): d = su(d, cone(M, t + S.ER @ V3(dx * .6, -.02, -.005), t + S.ER @ V3(dx, l, -.01), .016, .003), .012)
    return d
S.ears = ears
RUFF = [((x, y, .16 + .04 * (1 - abs(x) / .15)), (x * 1.5, y - .07, .27 + .03 * (1 - abs(x) / .15))) for x in (-.13, -.075, -.025, .025, .075, .13) for y in (.40, .33)]
def body(M):
    d = ell(M, (0, .200, -.010), (.245, .220, .225)); d = su(d, ell(M, (0, .335, .025), (.170, .125, .150)), .06)
    d = su(d, ell(M, (.150, .130, -.030), (.120, .120, .150)), .05)
    d = su(d, ell(M, (0, .345, .110), (.150, .085, .090)), .05)                              # a soft fluffed chest (the art), no spikes
    return d
S.body = body
_head = S.head
def head(M):
    d = _head(M)
    for dy, l in ((-.10, .095), (-.055, .080), (-.14, .070)): d = su(d, cone(M, S.HC + V3(.19, dy, .04), S.HC + V3(.19 + l, dy - .035, .00), .032, .005), .025)  # cheek tufts
    return su(d, C.gem(M, S.HC + V3(0, .105, .190), (0, 1, .25), (0, -.3, 1), .040, .026), .004)                           # the brow crystal
S.head = head
def tail(P):
    c = V3(0, .155, -.300); d = ell(P, c, (.105, .100, .095))
    for k in range(9):                                                                     # a puff ball of soft points
        a = k * 2.4; n = V3(np.cos(a) * .8, .5 * np.sin(a * 1.3), -.6); n /= np.linalg.norm(n); d = su(d, cone(P, c + n * .07, c + n * .135, .035, .004), .03)
    return d
S.tail = tail
_feet = S.feet; S.feet = lambda M: su(_feet(M), ell(M, (.130, .040, .190), (.070, .042, .090)), .02)
S.BOUNDS = (V3(-.42, -.033, -.56), V3(.42, 1.12, .44))
S.CREAM, S.HEADC, S.BELLY, S.EARIN, S.BILLC, S.BLUSH = map(S.C8, ('#b6c0d0', '#bcc6d4', '#eaeef4', '#f2a8a0', '#eef2f6', '#e8c0c4'))
VEIN, GEM = S.C8('#f4fbff'), S.C8('#a874e8')
C.eye_palette(S, rim=(30, 70, 120), iris=(80, 160, 220))
_classes = S.classes
def classes(V):
    out = _classes(V); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; X, Y, Z = M.T
    tri = lambda t: np.abs(((t % 1) + 1) % 1 - .5) * 2                                     # a zigzag: lightning, not a smooth ribbon
    # pale lightning veins: a few long forks running down her flanks + haunches (zigzag in Z, slow in Y), wide enough to survive the mesh
    f1 = (tri(Z * 6.0 + .5 * Y) - .5) * .10 + (Y - .14 - .55 * X) * .45
    f2 = (tri(Z * 7.5 + 1.3) - .5) * .08 + (Y - .30 + .25 * X) * .55
    v = np.maximum(C.marks(f1, .010), C.marks(f2, .009)); keep = (Y > .04) & (Y < .46) & (X > .07) & (S.ears(M) > .01) & (S.head(M) > .01)
    out.append(np.where(keep, v, -.05))
    out.append(np.clip(-C.gem(M, S.HC + V3(0, .105, .190), (0, 1, .25), (0, -.3, 1), .040, .026) + .002, -.05, .05))
    return out
S.classes = classes; S.PAL = [S.BELLY, S.HEADC, S.EARIN, S.BLUSH, S.BILLC, VEIN, GEM]
if __name__ == '__main__': C.build(S, sys.argv[1], 10000)
