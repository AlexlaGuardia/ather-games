"""M202: TIDEBEAR (Dewbear's Water second form) as HER OWN CREATURE. From the LOCKED art /root/athernyx/assets/stage2/019-tidebear.png
(grimoire-ledger #19). Water is in her anatomy: a tall still column of water with a bear's calm face.
What the picture shows -> what this body carries as SHAPE:
  - a tall smooth capsule, the tallest and narrowest of the line   -> one upright capsule (height ~1.6 x width), no staves
  - a bear's head at the top: round ears, a raised muzzle, a black
    nose, eyes closed in two calm curves, a small smile             -> ears with a hollow, a muzzle, a nose; closed-eye curves and
                                                                       the smile as geometry lines
  - a little crown of ice-clear crystal points on her head          -> five crystal shards on the crown
  - two water rings round her middle                                -> two thin raised rings
  - arms folded down over her belly, paws resting on it             -> arms from the shoulders down the front, paws on the belly
  - a glowing teal heart of water with bubbles and kelp curls       -> a bright core colour, raised bubble domes, unlit pale kelp
                                                                       curls and bubble lenses laid on her surface
  - feet that spread into splashes of water at the ground           -> four flared splash feet, ridged fans
Where the art is silent (README): the hind pair of splash feet under her back (four legs, as a tardigrade); her back is smooth
water with the rings running round; a short tail nub low at the back. Translucency is not modelled (an opaque coat, the core
lighter): the glow slice can add it.
Nothing of Cragbear's barrel: no staves, no hoops of iron; her silhouette is a tall bear-headed column on splash feet."""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bear_common import *
NAME = 'tidebear'
LO, HI = (-.60, -.03, -.50), (.60, 1.26, .52)
BC, BR = (0, .58, 0), (.315, .53, .30)
RINGS = (.66, .36)
L = dict(f=[(.15, .12, .12), (.17, .07, .14), (.20, .02, .17)], h=[(.15, .12, -.12), (.17, .07, -.14), (.20, .02, -.17)],
         arm=[(.27, .74, .08), (.25, .58, .22), (.13, .50, .30)], tail=[(0, .20, -.27), (0, .18, -.32), (0, .17, -.36)])
RIG = dict(spine=dict(pelvis=(0, .32, -.08), spine=(0, .44, -.02), chest=(0, .56, .03), neck=(0, .74, .03), head=(0, .88, .05)),
           crown=.76, legy=.12, legx=(.06, .34), arm=lambda V: (V[:, 2] > .16) & (V[:, 1] < .76) & (V[:, 1] > .40) & (np.abs(V[:, 0]) > .05) & (V[:, 2] - np.sqrt(np.maximum(0, .3 ** 2 * (1 - ((V[:, 1] - .58) / .53) ** 2) - V[:, 0] ** 2 * (.3 / .315) ** 2)) > .012),
           tailbox=(-.25, .10, .10, .28), stance=(.20, .17, -.17), walk=dict(roll=.045, yaw=.035, arm=.10), run=dict(roll=.07, yaw=.05, arm=.18))

def column(P):
    b = ell(P, BC, BR)
    b = su(b, ell(P, (0, .82, .27), (.12, .085, .08)), .05)                           # the muzzle
    return b
def rings(P):
    b = ell(P, BC, BR); return np.minimum.reduce([np.maximum(b - .011, np.abs(P[..., 1] - y) - .014) for y in RINGS])
def ears(P):
    M = mir(P); e = ell(M, (.215, 1.04, -.02), (.085, .082, .045), rotz(-.35))
    return ss(e, ell(M, (.22, 1.045, .025), (.05, .048, .03), rotz(-.35)), .01)
CRY = [((0, 1.07, .02), (0, 1.22, .03), .035), ((.06, 1.06, .0), (.10, 1.17, .01), .026), ((-.06, 1.06, .0), (-.10, 1.17, .01), .026),
       ((.03, 1.07, .08), (.05, 1.15, .13), .02), ((-.04, 1.07, -.06), (-.06, 1.15, -.10), .02)]
def crystals(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b, r in CRY:
        g = V3(*b) - V3(*a); q = (P - V3(*a)) @ frame(g); t = np.clip(q[..., 1] / np.linalg.norm(g), 0, 1); w = r * (1 - t ** 1.5)
        pr = (np.maximum(np.abs(q[..., 0]), np.abs(q[..., 2])) * .9 + np.minimum(np.abs(q[..., 0]), np.abs(q[..., 2])) * .3 - w) * .8
        d = np.minimum(d, np.maximum.reduce([pr, -q[..., 1] - .03, q[..., 1] - np.linalg.norm(g)]))
    return d
def arms(P):
    M = mir(P); a = L['arm']; d = su(cone(M, a[0], a[1], .065, .058), cone(M, a[1], a[2], .058, .05), .03)
    d = su(d, ell(M, (a[2][0] - .01, a[2][1] - .01, a[2][2] + .01), (.055, .05, .04)), .02)
    for ox in (-.025, .0, .025): d = su(d, ell(M, (a[2][0] - .05 + ox * .4, a[2][1] - .045 + ox, a[2][2] + .03), (.014, .016, .012)), .008)
    return d
def feet(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for lg, zs in ((L['f'], 1), (L['h'], -1)):
        d = np.minimum(d, cone(M, (lg[0][0], .20, lg[0][2]), (lg[2][0], .05, lg[2][2]), .085, .06))
        d = su(d, ell(M, (lg[2][0] + .02, .028, lg[2][2] + .02 * zs), (.12, .032, .11)), .04)          # the splash fan
        for k in range(5):
            a = -.9 + k * .45; dirv = V3(np.sin(a) * .6 + .5, 0, np.cos(a) * zs); dirv /= np.linalg.norm(dirv)
            d = su(d, cone(M, (lg[2][0], .03, lg[2][2]), V3(lg[2][0], .022, lg[2][2]) + dirv * .15, .03, .008), .02)   # its ridges
    return d
def bubbles(P):
    d = np.full(P.shape[:-1], 9.)
    for c, r in BUBS: d = np.minimum(d, np.linalg.norm(P - c, axis=-1) - r)
    return d
_D = None
def _bubs():
    D = Deco(lambda P: np.minimum(column(P), rings(P))); rng = np.random.default_rng(19); out = []
    for th, y, r in ((.18, .55, .028), (-.05, .50, .022), (.35, .44, .018), (-.30, .40, .026), (.10, .30, .020), (-.15, .25, .016), (.40, .62, .014), (-.40, .55, .016)):
        P, G = D.at([th], [y]); out.append((P[0] + G[0] * r * .2, r))
    return out
BUBS = _bubs()
def tailnub(P): return cone(P, L['tail'][0], L['tail'][2], .05, .03)
def field(P):
    b = np.minimum(column(P), rings(P)); b = su(b, ears(P), .025); b = su(b, crystals(P), .01); b = su(b, arms(P), .02); b = su(b, feet(P), .035)
    b = su(b, tailnub(P), .03); return su(b, bubbles(P), .006)

PAL = dict(lo='#2676a2', hi='#68bcda', core='#72dee2', ring='#b6eaf2', cryst='#d6f6fb', earin='#5aa2c2', muzzle='#a6dcea', nose='#1c2630', blush='#e8b0a0', foam='#a8e2ee', bub='#c8f4f6')
ORDER = ('core', 'ring', 'cryst', 'earin', 'muzzle', 'nose', 'blush', 'foam', 'bub')
def classes(V):
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; out = []
    out.append(np.minimum.reduce([1 - np.sqrt((x / .22) ** 2 + ((y - .36) / .17) ** 2), z - .10, .455 - y]))
    out.append(np.max([.016 - np.abs(y - h) for h in RINGS], 0) * (np.sqrt(x ** 2 + z ** 2) > .2))
    out.append(np.where(crystals(V) < .004, 1., -1.))
    out.append(np.where(ell(M, (.22, 1.045, .025), (.056, .054, .04), rotz(-.35)) < .004, 1., -1.))
    out.append(np.where(ell(V, (0, .82, .27), (.125, .09, .085)) < .006, 1., -1.) * (z > .28))
    out.append(np.where(ell(V, (0, .845, .345), (.04, .028, .026)) < .006, 1., -1.))
    out.append(np.where(ell(M, (.17, .80, .26), (.045, .03, .05)) < 0, 1., -1.))
    out.append(np.where(y < .07, 1., -1.))
    out.append(np.where(bubbles(V) < .003, 1., -1.))
    return out

def deco():
    D = Deco(field); rng = np.random.default_rng(190); INK = (24, 36, 48)
    for s in (1, -1):                                                                    # the closed eyes: calm curves, a lash flick out
        th = np.linspace(.20, .50, 9) * s; D.stroke(th, .885 - 1.4 * (np.abs(th) - .35) ** 2 + .02, .0085, INK)
    th = np.linspace(-.13, .13, 13); D.stroke(th, .765 + .45 * (np.abs(th) - .065) ** 2 * 6 - .012, .0075, INK)   # the smile, two small curves
    D.stroke([0, 0], [.800, .772], .007, INK)
    for c, r in BUBS:                                                                    # a catchlight on each bubble
        P, G = D.at([np.arctan2(c[0], c[2])], [c[1]]); D.lens(P[0] + G[0] * (r * .9) + V3(0, r * .35, 0), r * .30, .5, G[0], (250, 255, 255), 1)
    for th0, y0, dth in ((-.25, .20, .06), (.30, .19, -.05), (.0, .22, .07), (-.62, .40, .05), (.62, .40, -.06)):   # kelp curls
        t = np.linspace(0, 1, 16); D.stroke(th0 + dth * np.sin(t * 5.5) + dth * t * 2, y0 + t * .20, .009, (196, 244, 240), .005)
    for k in range(18):                                                                  # small bubbles round her
        th, y = rng.uniform(-2.8, 2.8), rng.uniform(.2, .95); P, G = D.at([th], [y]); D.lens(P[0] + G[0] * .006, rng.uniform(.006, .011), .6, G[0], (206, 248, 250), 1)
    return D.mesh()

if __name__ == '__main__': build(sys.modules[__name__], sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10000)
