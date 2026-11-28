"""M202 LEPAURA (Lepara's Mana form; the grimoire's MOON-HARE divergence; locked art athernyx assets/stage2/034-lepaura.png, looked at, never
traced, never in this repo).  python sculpt_lepaura.py <out.glb>.  Starts from the base Lepara (lep_common.base()); what is HERS:
  a taller, leaner hare sitting up (a long chest, slimmer haunches), taller ears, a big curling plume tail standing up behind her in place
  of the base's flat paddle, a fuller face; a lilac coat over a pale lilac front, blue eyes; a gold crescent on her brow (the ledger's
  moon-hare mark) and GOLD INFUSION MARKINGS = a flowing pattern only, never a sigil (Magii ruling 0d6d577), on shoulders, forelegs and haunches."""
import sys, os, numpy as np
import lep_common as C
from lep_common import cone, ell, su, ss, V3
S = C.base()
S.EC = V3(.140, .880, -.024)                                                            # taller ears, set higher
def ears(M):
    d = ell(M, S.EC, (.084, .212, .034), S.ER)
    return ss(d, -ell(M, S.EC + S.ER @ V3(0, .016, .027), (.058, .172, .022), S.ER), .008)
S.ears = ears
def body(M):
    d = ell(M, (0, .215, -.015), (.215, .225, .210)); d = su(d, ell(M, (0, .360, .030), (.160, .140, .150)), .06)    # a long chest
    return su(d, ell(M, (.140, .130, -.040), (.105, .115, .140)), .05)                                             # slimmer haunches
S.body = body
TP = [V3(0, .10, -.24), V3(0, .17, -.33), V3(0, .29, -.385), V3(0, .41, -.38), V3(0, .49, -.33), V3(0, .515, -.265)]
TR = [.062, .085, .092, .082, .062, .036]
def tail(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b, ra, rb in zip(TP[:-1], TP[1:], TR[:-1], TR[1:]): d = np.minimum(d, cone(P, a, b, ra, rb))
    for k, (c, r) in enumerate(zip(TP[1:5], TR[1:5])):                                     # soft fur points out of the plume's back
        n = V3(0, -.3 + .35 * k, -1.); n /= np.linalg.norm(n); d = su(d, cone(P, c + n * r * .4, c + n * (r + .028), r * .45, .004), .03)
    return d
S.tail = tail
_head = S.head
S.head = lambda M: su(_head(M), ell(M, S.HC + V3(.150, -.090, .040), (.095, .080, .090)), .05)                  # fuller cheek fluff
S.BOUNDS = (V3(-.36, -.033, -.62), V3(.36, 1.13, .40))
S.CREAM, S.HEADC, S.BELLY, S.EARIN, S.BILLC, S.BLUSH = map(S.C8, ('#a594d6', '#ab9cdc', '#e6def4', '#f2a0a0', '#e8e0f4', '#d8a8d6'))
GOLD = S.C8('#e8bc3a')
C.eye_palette(S, rim=(40, 52, 96), iris=(116, 156, 214))
PEND = ((0, .335, .205), (0, 1, -.15), (0, .1, 1), .036, .024)                         # the gold diamond on her necklace (the art's pendant)
_body = S.body; S.body = lambda M: su(_body(M), C.gem(M, *PEND), .004)
_classes = S.classes
def classes(V):
    out = _classes(V); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; X, Y, Z = M.T
    hd = S.head(M); low = np.minimum(_body(M), S.arms(M))
    # GOLD INFUSION MARKINGS: smooth flowing ribbons (pattern only, never a sigil: Magii 0d6d577) sweeping over haunch + foreleg
    f = np.sin(8.5 * Y + 3.2 * np.sin(6 * Z + 2 * X) + 6 * X) * .05
    gold = np.clip(C.marks(f, .0115), -.05, .05); keep = (low < hd - .01) & (Y > .05) & (Y < .40) & (X > .12)
    # the necklace: a gold band round the neck, dipping to the pendant at the front
    neck = np.clip(.009 - np.abs(Y - (.385 - .04 * np.clip(Z / .2, 0, 1) ** 2)), -.05, .05); nk = (Y > .30) & (Y < .45) & (Z > -.05)
    # the crescent on her brow (the ledger's moon-hare mark): a big circle minus an offset one, both smooth
    cy, r1, r2 = .655, .052, .040
    cres = np.minimum(r1 - np.hypot(V[:, 0], Y - cy), np.hypot(V[:, 0] - .022, Y - cy - .014) - r2)
    out.append(np.where(keep, gold, -.05)); out.append(np.where(nk, neck, -.05))
    out.append(np.where((Z > .12) & (hd < low), np.clip(cres, -.05, .05), -.05))
    out.append(np.clip(-C.gem(M, *PEND) + .002, -.05, .05)); return out
S.classes = classes; S.PAL = S.PAL[:0] + [S.BELLY, S.HEADC, S.EARIN, S.BLUSH, S.BILLC, GOLD, GOLD, GOLD, S.C8('#fff0b0')]
_fin = S.finish
def finish(V, F, path, eye):                                                                   # finer mesh over the brow, so the crescent keeps its edge
    V, F = S.refine(V, F, lambda V: (V[:, 2] > .10) & (V[:, 1] > .58) & (V[:, 1] < .74) & (np.abs(V[:, 0]) < .12), .02); _fin(V, F, path, eye)
S.finish = finish
if __name__ == '__main__': C.build(S, sys.argv[1], 10000)
