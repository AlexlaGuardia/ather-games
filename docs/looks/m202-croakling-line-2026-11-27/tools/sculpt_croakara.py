"""M202 CROAKARA (Croakling's Mana form; locked art athernyx assets/stage2/026-croakara.png, looked at, never traced, never in this repo).
python sculpt_croakara.py <out.glb>. Starts from the base Croakling (croak_common.base()); what is HERS, not the base's:
  a WIDE, round, low body squatting on legs splayed out wide (the art's sumo frog), a broad flat head with a wide smile, huge round eyes
  on a pale lilac ring; a violet coat over a pale glowing lilac belly; GOLD INFUSION MARKINGS = a flowing pattern only, in the element's
  look, never a sigil (Magii ruling 0d6d577), on her arms, haunches, back and crown; the lure's orb a violet-pink bud with little points."""
import sys, os, numpy as np
import croak_common as C
from croak_common import cone, ell, su, ss, V3
S = C.base()
S.TC, S.TR = V3(0, .28, -.01), V3(.41, .27, .29)                                # wider, lower
S.HC, S.HR = V3(0, .52, .08), V3(.39, .18, .28)
S.EBC = V3(.215, .672, .135); S.RE = .094; S.KE = S.RE / .066                    # huge round eyes
S.L0, S.L1, S.L2 = V3(0, .690, -.03), V3(-.14, 1.10, .04), V3(-.44, .925, .20); S.ORB, S.ORBR = V3(-.465, .838, .230), V3(.090, .092, .090)
S.ARM = ((.255, .360, .185), (.300, .070, .310)); S.HAND = V3(.320, .030, .335)  # arms set wide
S.FINGERS = [(a * 1.15, L * 1.15) for a, L in S.FINGERS]
S.HAUNCH, S.HAUNCHR = V3(.380, .190, -.050), V3(.185, .160, .225); S.SHIN = ((.430, .110, -.150), (.490, .068, .080)); S.FOOT = V3(.505, .030, .140)
S.TOES = [(a * 1.15, L * 1.15) for a, L in S.TOES]; C.retip(S)
S.SMILE_Y = .430; S.BOUNDS = (V3(-.72, -.033, -.42), V3(.72, .88, .56))
def torso(M):
    d = su(ell(M, S.TC, S.TR), ell(M, (0, .23, .08), (.37, .21, .27)), .06); return ss(d, M[..., 1] - .045, .03)
S.torso = torso
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, (0, .465, .15), (.36, .115, .225)), .05); return su(d, ell(M, S.EBC, (.128, .120, .120)), .05)
S.head = head
S.throat = lambda M: ell(M, (0, .400, .225), (.26, .090, .135))
S.SKIN, S.BELLY, S.PAD = map(S.C8, ('#8b76c8', '#f8e4d8', '#b8a6e6')); S.HEADC = S.SKIN; GOLD = S.C8('#e8b830')
S.STALK, S.BULB, S.CAP, S.MOUTH = (124, 98, 176), (240, 172, 250), (172, 112, 214), (62, 40, 104)
C.eye_palette(S, rim=(214, 186, 240), iris=(176, 136, 226), hi=(255, 250, 255), hi2=(236, 222, 250))
_classes = S.classes
def classes(V):
    out = _classes(V); X, Y, Z = np.abs(V[:, 0]), V[:, 1], V[:, 2]
    f = np.sin(17 * Y + 5.5 * np.sin(9 * Z + 2.2 * X) + 7 * X) * .045                                   # thin flowing ribbons, not glyphs (~14% of her coat)
    gold = C.marks(V, f, .0095); keep = (out[0] < 0) & (Y > .06) & (Y < .78)
    out.append(np.where(keep, gold, -.05)); return out
S.classes = classes; S.PAL = [S.BELLY, S.PAD, GOLD]
if __name__ == '__main__': C.build(S, sys.argv[1])
