"""M202 LEPORE (Lepara's Earth form, her natural element; locked art athernyx assets/stage2/006-lepore.png, looked at, never traced, never in
this repo).  python sculpt_lepore.py <out.glb>.  Starts from the base Lepara (lep_common.base()); what is HERS:
  the heaviest of the line: a round barrel belly, thick forearms with big paws, broad hind feet with pads, a wide full face; mossy STONE
  PLATES on her shoulders and forearms, an amber crystal on her brow and a smaller one on her chest; a warm brown coat over a cream belly,
  dark-tipped ears, green VINE MARKINGS on her belly sides (infusion markings, pattern only: Magii ruling 0d6d577). Dial 1.5 in game."""
import sys, os, numpy as np
import lep_common as C
from lep_common import cone, ell, su, ss, V3
S = C.base()
def body(M):
    d = ell(M, (0, .205, .000), (.285, .230, .255)); d = su(d, ell(M, (0, .190, .085), (.225, .175, .175)), .06)        # the barrel belly
    d = su(d, ell(M, (0, .345, .025), (.185, .120, .155)), .06); return su(d, ell(M, (.165, .125, -.030), (.130, .125, .160)), .05)
def plates(M):
    """the stone plates: a shoulder pauldron each side and a bracer on each forearm (raised, rimmed)"""
    R = np.array([[np.cos(.55), -np.sin(.55), 0], [np.sin(.55), np.cos(.55), 0], [0, 0, 1]])
    d = ss(ell(M, (.215, .385, .045), (.125, .046, .125), R), -ell(M, (.195, .345, .045), (.120, .046, .118), R), .01)   # a curved leaf-stone pauldron standing off the shoulder
    return np.minimum(d, ell(M, (.175, .290, .120), (.066, .048, .066)))                                          # a bracer on the forearm
S.plates = plates
S.body = lambda M: su(body(M), plates(M), .012)
S.arms = lambda M: su(cone(M, (.180, .345, .070), (.160, .230, .195), .058, .052), ell(M, (.160, .220, .215), (.062, .046, .052)), .02)
def feet(M):
    c = V3(.135, .040, .175); d = ell(M, c, (.082, .048, .115))
    for dx in (-.040, 0, .040): d = su(d, ell(M, c + V3(dx, -.004, .098), (.030, .031, .031)), .012)
    return d
S.feet = feet
_head = S.head
def head(M):
    d = su(_head(M), ell(M, S.HC + V3(.150, -.080, .045), (.130, .105, .110)), .05)                          # a wider, fuller face
    return su(d, C.gem(M, S.HC + V3(0, .115, .185), (0, 1, .3), (0, -.3, 1), .044, .028), .004)            # the amber brow crystal
S.head = head
CHEST = ((0, .375, .190), (0, 1, -.2), (0, .2, 1), .034, .022)
S.body = (lambda b: (lambda M: su(b(M), C.gem(M, *CHEST), .004)))(S.body)                                  # the chest crystal
S.BOUNDS = (V3(-.42, -.033, -.52), V3(.42, 1.07, .44))
S.CREAM, S.HEADC, S.BELLY, S.EARIN, S.BILLC, S.BLUSH = map(S.C8, ('#bd8644', '#c38e4e', '#f0d4a2', '#f09a68', '#f4e0c0', '#e8a878'))
MOSS, RIM, AMBER, VINE, TIP, PAD = map(S.C8, ('#6f9a48', '#c9a23a', '#f2c430', '#5f8a3a', '#5a3a22', '#e89a84'))
C.eye_palette(S, rim=(70, 44, 26), iris=(120, 76, 40))
_classes = S.classes
def classes(V):
    out = _classes(V); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; X, Y, Z = M.T
    pl = plates(M); bd = body(M); hd = S.head(M)
    out.append(np.where(pl < bd + .002, np.clip(-pl + .010, -.05, .05), -.05))                         # the plate's gold rim
    out.append(np.where(pl < bd + .002, np.clip(-pl + .002, -.05, .05), -.05))                          # moss-green stone inside it
    q = (M - S.EC) @ S.ER; out.append(np.where((q[:, 1] > .135) & (S.ears(M) < hd), .05, -.05))            # dark ear tips
    f = np.sin(14 * Y + 4 * np.sin(7 * Z)) * .03 + (X - .17) * .25
    out.append(np.where((Z > .02) & (Y > .08) & (Y < .33) & (X > .09), C.marks(f, .010), -.05))            # vines down her belly sides
    out.append(np.where((Y < .05) & (Z > .17) & (S.feet(M) < bd), .05, -.05))                             # pink toe pads
    g = np.minimum(C.gem(M, S.HC + V3(0, .115, .185), (0, 1, .3), (0, -.3, 1), .044, .028), C.gem(M, *CHEST))
    out.append(np.clip(-g + .002, -.05, .05)); return out
S.classes = classes; S.PAL = [S.BELLY, S.HEADC, S.EARIN, S.BLUSH, S.BILLC, RIM, MOSS, TIP, VINE, PAD, AMBER]
if __name__ == '__main__': C.build(S, sys.argv[1], 10000)
