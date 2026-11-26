"""M202: LUMEBEAR (Dewbear's Mana second form) as HER OWN CREATURE. From the LOCKED art /root/athernyx/assets/stage2/017-lumebear.png
(grimoire-ledger #17). Mana is in her anatomy: she is a carved rune-vessel.
What the picture shows -> what this body carries as SHAPE:
  - a tall egg of a vessel, head and trunk one piece, a domed lid    -> one upright egg (taller than wide), a raised lid dome on top
  - a lid rim, a hoop under the face, a hoop low on the belly        -> three raised violet hoops + a bottom rim
  - vertical staves between the hoops                                -> ten carved stave grooves (geometry)
  - glowing gold runes: a band on the lid, one big glyph per stave,
    a band round the bottom, two beside the eyes                     -> unlit gold strokes laid on her surface (glyphs drawn here,
                                                                        not canon runes: marks like the art's)
  - round bear ears on the lid                                       -> two round ears with a hollow
  - a little raised muzzle with a black nose and a small mouth       -> a muzzle bump, a nose, a mouth line (geometry)
  - big round amber eyes with a white catchlight                     -> amber lens eyes
  - flat clawed flippers standing out from her sides                 -> two flat fins angled out and down, three claw points each
  - four pointed peg feet that lift the vessel off the ground        -> four cone legs, the vessel floats on them
Where the art is silent (README): the back carries staves and runes like the front; a short tail nub low at the back (the
Dewbear's); the hind pegs sit under her back, the fore pair under her face (four legs, as a tardigrade).
The art's body shares Cragbear's BARREL idea (staves + hoops): it is drawn that way. What makes her her own: an upright egg
standing on four pegs (Cragbear is a squat ball on stumps), a lid with ears, flippers, a muzzle, no moss and no brow."""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bear_common import *
NAME = 'lumebear'
LO, HI = (-.66, -.03, -.50), (.66, 1.16, .52)
BC, BR = (0, .58, 0), (.37, .44, .35)
HOOPS = (.905, .625, .285, .175)
L = dict(f=[(.17, .19, .13), (.18, .10, .145), (.19, .02, .16)], h=[(.17, .19, -.13), (.18, .10, -.145), (.19, .02, -.16)],
         arm=[(.34, .55, .03), (.45, .44, .05), (.51, .36, .06)], tail=[(0, .30, -.30), (0, .27, -.36), (0, .25, -.40)])
EYE, EYE_R = (.145, .80), .066
# the rig reads these (rig_bear.py): spine joints, what the head carries, the arms, the leg zone, gaits
RIG = dict(spine=dict(pelvis=(0, .40, -.12), spine=(0, .46, -.02), chest=(0, .52, .06), neck=(0, .66, .06), head=(0, .78, .08)),
           crown=.70, legy=.16, legx=(.07, .32), arm=lambda V: (np.abs(V[:, 0]) > .36) & (V[:, 1] < .66) & (V[:, 1] > .24) & (V[:, 2] > -.12) & (V[:, 2] < .20),
           tailbox=(-.28, .10, .18, .38), stance=(.19, .16, -.16), walk=dict(roll=.06, yaw=.04, arm=.22), run=dict(roll=.09, yaw=.05, arm=.40))

def vessel(P):
    b = ell(P, BC, BR)
    b = su(b, ell(P, (0, .99, 0), (.27, .09, .25)), .06)                            # the lid dome
    b = su(b, ell(P, (0, .77, .30), (.075, .058, .05)), .03)                         # the muzzle bump
    x, y, z = P[..., 0], P[..., 1], P[..., 2]; th = np.arctan2(x, z); N = 10
    g = np.abs(((th / (2 * np.pi) * N + .5) % 1) - .5); on = (y < HOOPS[1] - .03) & (y > HOOPS[2] + .03)
    return b + .0075 * np.exp(-(g / .05) ** 2) * on
def hoops(P):
    b = ell(P, BC, BR); return np.minimum.reduce([np.maximum(b - .015, np.abs(P[..., 1] - y) - .022) for y in HOOPS])
def ears(P):
    M = mir(P); e = ell(M, (.25, .985, -.02), (.090, .088, .045), rotz(-.45))
    return ss(e, ell(M, (.255, .99, .025), (.055, .052, .03), rotz(-.45)), .01)       # the hollow
def fins(P):
    M = mir(P); a = L['arm']; d = ell(M, ((a[0][0] + a[2][0]) / 2, (a[0][1] + a[2][1]) / 2, .04), (.055, .15, .035), rotz(.75))
    for k, o in enumerate((-.03, 0, .03)): d = su(d, cone(M, (a[2][0] - .01, a[2][1] + .01, .04 + o), (a[2][0] + .03, a[2][1] - .055, .05 + o * 1.4), .016, .004), .01)
    return d
def legs(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for lg in (L['f'], L['h']): d = np.minimum(d, cone(M, (lg[0][0] - .01, .24, lg[0][2] * .9), lg[2], .075, .016))
    return d
def tailnub(P): return cone(P, L['tail'][0], L['tail'][2], .05, .03)
def body(P):
    b = np.minimum(vessel(P), hoops(P)); b = su(b, ears(P), .025); b = su(b, fins(P), .03); b = su(b, legs(P), .035); return su(b, tailnub(P), .03)
field = body

PAL = dict(lo='#5a3ca8', hi='#9f80e2', seam='#5a3f9e', hoop='#9a80e0', lid='#a68ae6', earin='#8a6cd2', muzzle='#c6b2f2', nose='#2a1c34', claw='#8466c8', peg='#7a5cc0')
ORDER = ('seam', 'hoop', 'lid', 'earin', 'muzzle', 'nose', 'claw', 'peg')
def classes(V):
    x, y, z = V.T; A = np.abs(x); th = np.arctan2(x, z); out = []
    g = np.abs(((th / (2 * np.pi) * 10 + .5) % 1) - .5); out.append(np.where((y < HOOPS[1] - .035) & (y > HOOPS[2] + .035), .022 - g, -1.))
    out.append(np.max([.026 - np.abs(y - h) for h in HOOPS], 0) * (np.sqrt(x ** 2 + z ** 2) > .2))
    out.append(np.where(y > 1.0, 1., -1.) * (A < .2))                                                    # the lid's top, a shade lighter
    out.append(np.where(ell(np.c_[A, y, z], (.255, .99, .025), (.06, .057, .04), rotz(-.45)) < .004, 1., -1.))
    out.append(np.where(ell(V, (0, .77, .30), (.08, .062, .055)) < .006, 1., -1.) * (z > .3))
    out.append(np.where(ell(V, (0, .79, .355), (.030, .020, .018)) < .006, 1., -1.))
    out.append(np.where((A > .47) & (y < .37), 1., -1.))
    out.append(np.where(y < .15, 1., -1.))
    return out

def deco():
    D = Deco(field); rng = np.random.default_rng(17); GOLD = (246, 186, 64)
    for s in (1, -1):                                                                    # amber lens eyes
        P, G = D.at([s * np.arcsin(EYE[0] / .36)], [EYE[1]]); p, g = P[0], G[0]; t = np.cross(g, V3(0, 1, 0)); t /= np.linalg.norm(t); u = np.cross(t, g)
        if t[0] * s < 0: t = -t
        D.lens(p + g * .003, EYE_R, .40, g, (150, 70, 10), 3); D.lens(p + g * .010, EYE_R * .82, .40, g, (240, 164, 40), 3)
        D.lens(p + g * .018, EYE_R * .40, .40, g, (40, 20, 6), 3); D.lens(p + g * .028 + t * .018 + u * .020, .016, .5, g, (255, 252, 240), 2)
    th = np.linspace(-.07, .07, 9); D.stroke(th, .735 - 1.6 * th ** 2 + .0, .007, (60, 30, 70))      # the small mouth under the nose
    D.stroke([0, 0], [.765, .742], .006, (60, 30, 70))
    for k in range(12):                                                                  # the lid band
        t0 = -np.pi + (k + .5) * 2 * np.pi / 12
        if abs(t0) < .5: continue                                                        # (over the face the band runs above the ears' line)
        for a, b in rune(rng, t0, .955, .20, .05): D.stroke(a, b, .011, GOLD)
    for k in range(10):                                                                  # one big glyph a stave
        t0 = -np.pi + (k + .5) * 2 * np.pi / 10
        for a, b in rune(rng, t0, .455, .30, .20): D.stroke(a, b, .014, GOLD)
    for k in range(14):                                                                  # the bottom band
        t0 = -np.pi + (k + .5) * 2 * np.pi / 14
        for a, b in rune(rng, t0, .232, .20, .06): D.stroke(a, b, .011, GOLD)
    for s in (1, -1):                                                                    # beside the eyes
        for a, b in rune(rng, s * .95, .78, .22, .12): D.stroke(a, b, .012, GOLD)
    return D.mesh()

if __name__ == '__main__': build(sys.modules[__name__], sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10000)
