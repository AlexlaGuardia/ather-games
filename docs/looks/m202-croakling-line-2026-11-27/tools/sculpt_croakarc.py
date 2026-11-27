"""M202 CROAKARC (Croakling's Storm form; locked art athernyx assets/stage2/028-croakarc.png, looked at, never traced, never in this repo).
python sculpt_croakarc.py <out.glb>. Starts from the base Croakling (croak_common.base()); what is HERS, not the base's:
  a SKINK, not a frog (grimoire-ledger divergence_note: "Croakling-storm = a skink, not a frog (lure dropped)"): NO LURE; a longer, lower
  body; a LONG TAIL off the rump curling up behind her; a pointed CREST sweeping up off the back of her head; a row of small DORSAL
  SPINES from crown to tail; pale silver-blue skin with white LIGHTNING VEINS; a violet brow gem; round blue eyes; a smaller frog's face.
  The tail rides the base rig's three lure bones (re-seated along the tail, parented to the hips: rig_croak.py), so the rig plan stays one."""
import sys, os, numpy as np
import croak_common as C
from croak_common import cone, ell, su, ss, V3
S = C.base(); S.LURE = False
S.TC, S.TR = V3(0, .27, -.09), V3(.30, .25, .34)                                 # longer, lower, slimmer
S.HC, S.HR = V3(0, .53, .10), V3(.30, .175, .26)
S.EBC = V3(.180, .668, .150); S.RE = .082; S.KE = S.RE / .066
S.ARM = ((.200, .350, .170), (.225, .070, .310)); S.HAND = V3(.240, .030, .335)
S.HAUNCH, S.HAUNCHR = V3(.285, .190, -.150), V3(.145, .150, .200); S.SHIN = ((.330, .110, -.240), (.370, .070, -.010)); S.FOOT = V3(.380, .030, .050); C.retip(S)
S.SMILE_Y = .455; S.BOUNDS = (V3(-.60, -.033, -1.02), V3(.60, .98, .55))
# the tail: a quadratic Bezier off the rump, low then curling up (x = 0: the field is mirrored)
T0, T1, T2 = V3(0, .17, -.36), V3(0, .02, -.80), V3(0, .40, -.86)
tb = lambda t: np.outer((1 - t) ** 2, T0) + np.outer(2 * (1 - t) * t, T1) + np.outer(t * t, T2)
TP = tb(np.linspace(0, 1, 13)); TRAD = np.linspace(.115, .022, 13)
def tail(M):
    d = 9
    for i in range(12): d = np.minimum(d, cone(M, TP[i], TP[i + 1], TRAD[i], TRAD[i + 1]))
    return d
CRS = [(V3(0, .66, .08), V3(0, .80, -.02), .085, .045), (V3(0, .80, -.02), V3(0, .90, -.10), .045, .010)]
def crest(M): return np.minimum(*[cone(M, a, b, ra, rb) for a, b, ra, rb in CRS])
SPN = [V3(0, .73 - .02 * k, -.10 - .07 * k) for k in range(0)] + [V3(0, y, z) for y, z in ((.56, -.22), (.52, -.30), (.46, -.38))] + [TP[i] for i in (2, 4, 6, 8)]
def spines(M):
    d = 9
    for p in SPN:
        q = p + V3(0, .055, 0); d = np.minimum(d, cone(M, p - V3(0, .02, 0), q, .022, .004))
    return d
_head = S.head
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, (0, .490, .17), (.27, .105, .21)), .05); d = su(d, ell(M, S.EBC, (.110, .104, .104)), .05)
    return su(d, crest(M), .05)
def torso(M):
    d = su(ell(M, S.TC, S.TR), ell(M, (0, .22, .03), (.28, .19, .28)), .06); d = su(d, tail(M), .07); d = su(d, spines(M), .015)
    return ss(d, M[..., 1] - .045, .03)
S.head, S.torso = head, torso
S.throat = lambda M: ell(M, (0, .430, .235), (.20, .080, .12))
S.SKIN, S.BELLY, S.PAD = map(S.C8, ('#a9c3e0', '#edf3fa', '#c8daee')); S.HEADC = S.SKIN; VEIN = S.C8('#ffffff')
S.STALK, S.BULB, S.CAP = (201, 13, 197), (13, 199, 203), (197, 203, 13); S.MOUTH = (52, 74, 110)   # no lure: colours nothing else uses (the rig picks lure verts by colour)
C.eye_palette(S, rim=(150, 180, 214), iris=(58, 120, 214), hi=(255, 255, 255), hi2=(214, 236, 255))
def gem():                                                                                 # the violet brow gem (unlit, rides the head)
    o = S.HC + V3(.07, .14, 0); u = V3(.06, .30, 1.); u /= np.linalg.norm(u); p = S.ray(o, u, .5)[0]; n, t1, t2 = S.frame(p)
    return [S.disc(p, n, t1, t2, .030, (176, 120, 236), .004, 12), S.disc(p, n, t1, t2, .013, (236, 214, 255), .007, 8)]
S.EXTRA = gem
_classes = S.classes
def classes(V):
    out = _classes(V); X, Y, Z = np.abs(V[:, 0]), V[:, 1], V[:, 2]
    a = np.sin(13 * Z + 4 * np.sin(17 * Y) + 3 * X) + .6 * np.sin(21 * Y - 9 * Z + 11 * X)            # branching, jagged
    out.append(np.where((Y > .05), C.marks(V, a * .03, .0075), -.05)); return out
S.classes = classes; S.PAL = [S.BELLY, S.PAD, VEIN]
if __name__ == '__main__': C.build(S, sys.argv[1])
