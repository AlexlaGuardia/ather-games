"""M202: VOLTBEAR (Dewbear's Storm second form) as HER OWN CREATURE. From the LOCKED art /root/athernyx/assets/stage2/018-voltbear.png
(grimoire-ledger #18). Storm is in her anatomy: a segmented, spined grub with lightning running through her.
What the picture shows -> what this body carries as SHAPE:
  - an upright pill of stacked ring segments (the tardigrade's own
    segmented body, no barrel, no hoops)                            -> four round segments stacked under a head, creased between
  - a ridged hood over the crown and down the sides, the face open  -> a shell hood layer, high over the brow, low at the sides
  - pale ice-blue spines along the hood's rim and down her sides    -> sixteen cone spines round the hood, ten down her flanks
  - big round blue eyes under heavy half-closed lids (sleepy, cross)-> blue lens eyes with lid ridges over their top half
  - a small frown, warm blush on the cheeks                         -> a mouth line (geometry), a blush colour
  - short clawed arms at the top segment's sides                    -> stub arms with claw knobs
  - two short stubby feet                                           -> four short legs (front pair under the face, hind under the back)
  - white lightning cracking over the whole body                    -> branching unlit pale veins laid on her surface
Where the art is silent (README): her hind pair of legs (a tardigrade walks on all of them); the back of the hood carries its
ridges and spines as the sides do; a short tail nub low at the back.
Nothing of Cragbear's barrel: no staves, no hoops, no moss; her silhouette is a spined pill, tall and narrow-shouldered."""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bear_common import *
NAME = 'voltbear'
LO, HI = (-.58, -.07, -.50), (.58, 1.22, .50)
HC, HR = (0, .84, .01), (.355, .265, .33)                                              # the head under the hood
SEG = [(.640, .375, .110, .335), (.480, .385, .100, .345), (.335, .370, .095, .335), (.200, .330, .095, .300)]   # y, rx, ry, rz
L = dict(f=[(.16, .15, .12), (.16, .08, .13), (.165, .03, .15)], h=[(.16, .15, -.13), (.16, .08, -.14), (.165, .03, -.15)],
         arm=[(.33, .60, .06), (.40, .52, .10), (.41, .46, .12)], tail=[(0, .22, -.27), (0, .20, -.33), (0, .19, -.37)])
EYE, EYE_R = (.128, .785), .066
RIG = dict(spine=dict(pelvis=(0, .30, -.10), spine=(0, .40, -.02), chest=(0, .52, .04), neck=(0, .66, .04), head=(0, .80, .06)),
           crown=.68, legy=.12, legx=(.06, .29), arm=lambda V: (np.abs(V[:, 0]) > .34) & (V[:, 1] < .66) & (V[:, 1] > .38) & (V[:, 2] > -.06) & (V[:, 2] < .22),
           tailbox=(-.25, .10, .12, .30), stance=(.165, .15, -.15), walk=dict(roll=.05, yaw=.06, arm=.30), run=dict(roll=.08, yaw=.08, arm=.50))

def hood_edge(P):
    x, z = P[..., 0], P[..., 2]; th = np.arctan2(x, z); c = np.cos(th)
    return .70 + .245 * np.clip(c, 0, 1) ** 1.6 - .04 * (c < 0) * -c
def trunk(P):
    d = ell(P, HC, HR)
    for y, rx, ry, rz in SEG: d = su(d, ell(P, (0, y, 0), (rx, ry * 1.25, rz)), .035)
    return d
def hood(P): return np.maximum(ell(P, HC, (HR[0] + .03, HR[1] + .03, HR[2] + .03)), hood_edge(P) - P[..., 1])
def face(P):
    M = mir(P); d = ell(M, (EYE[0], EYE[1] + .035, .30), (.085, .036, .055), rotz(-.10))   # the heavy lids over each eye's top half
    return su(d, ell(M, (.10, .70, .30), (.06, .04, .035)), .02)                          # round cheeks
SPN = []
for k in range(12):                                                                 # the hood's rim, round the sides and back (the face open)
    th = (1 if k < 6 else -1) * (1.05 + (k % 6) * .32); y = .70 + .245 * max(np.cos(th), 0) ** 1.6 + .015
    SPN.append((th, y, .062 if abs(th) < 1.6 else .05))
for th in (-.75, -.25, .25, .75): SPN.append((th, 1.045, .06))                     # and along the crown's top edge
for s in (1, -1):
    for y, ln in ((.60, .045), (.47, .045), (.34, .04), (.22, .035), (.12, .03)): SPN.append((s * 1.85, y, ln)); SPN.append((s * 2.5, y + .03, ln * .8)) if y > .3 else None
def _sp():
    from bear_common import Deco
    D = Deco(lambda P: np.minimum(trunk(P), hood(P))); out = []
    for th, y, ln in SPN:
        P, G = D.at([th], [y]); g = G[0] + V3(0, .35, 0); g /= np.linalg.norm(g); out.append((P[0] - G[0] * .01, P[0] + g * ln))
    return out
SPINES = _sp()
def spines(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b in SPINES: d = np.minimum(d, cone(P, a, b, .028, .004))
    return d
def limbs(P):
    M = mir(P); a = L['arm']; d = su(cone(M, a[0], a[1], .065, .055), cone(M, a[1], a[2], .055, .05), .02)
    for oz in (-.03, .0, .03): d = su(d, ell(M, (a[2][0] + .01, a[2][1] - .05, a[2][2] + oz), (.018, .024, .016)), .01)
    for lg in (L['f'], L['h']):
        d = su(d, cone(M, lg[0], lg[2], .085, .07), .03); d = su(d, ell(M, (lg[2][0], .035, lg[2][2] + .025), (.085, .04, .095)), .03)
        for ox in (-.04, 0, .04): d = su(d, ell(M, (lg[2][0] + ox, .025, lg[2][2] + .11), (.022, .02, .022)), .01)
    return d
def tailnub(P): return cone(P, L['tail'][0], L['tail'][2], .05, .03)
def field(P):
    b = su(trunk(P), face(P), .02); b = su(b, hood(P), .01); b = su(b, limbs(P), .03); b = su(b, tailnub(P), .03); return su(b, spines(P), .012)

PAL = dict(lo='#6a98c8', hi='#c2daf2', crease='#5682b2', hood='#86a6ca', hoodl='#aec8e2', spine='#8edcf2', lid='#86a4c6', blush='#e3a0a4', nose='#7a90aa')
ORDER = ('crease', 'hood', 'hoodl', 'spine', 'lid', 'blush')
def classes(V):
    x, y, z = V.T; A = np.abs(x); out = []; th = np.arctan2(x, z)
    out.append(np.max([.012 - np.abs(y - (SEG[i][0] + SEG[i + 1][0]) / 2 - .005) for i in range(3)] + [.012 - np.abs(y - .555)], 0))
    out.append(y - hood_edge(V) + .006)
    out.append(np.where(y - hood_edge(V) > .02, .010 - np.abs(((np.sqrt(np.maximum(0, (y - .70))) * 9) % 1) - .5) * .06, -1.))   # ridges along the hood
    out.append(np.where(spines(V) < .004, 1., -1.))
    out.append(np.where(ell(np.c_[A, y, z], (EYE[0], EYE[1] + .035, .30), (.087, .038, .057), rotz(-.10)) < .004, 1., -1.))
    out.append(np.where(ell(np.c_[A, y, z], (.17, .70, .27), (.05, .03, .06)) < 0, 1., -1.))
    return out

def deco():
    D = Deco(field); rng = np.random.default_rng(18)
    for s in (1, -1):
        P, G = D.at([s * np.arcsin(EYE[0] / .34)], [EYE[1] - .01]); p, g = P[0], G[0]; t = np.cross(g, V3(0, 1, 0)); t /= np.linalg.norm(t); u = np.cross(t, g)
        if t[0] * s < 0: t = -t
        D.lens(p + g * .002, EYE_R, .40, g, (236, 230, 206), 3); D.lens(p + g * .008, EYE_R * .74, .40, g, (60, 150, 200), 3)
        D.lens(p + g * .015, EYE_R * .48, .40, g, (14, 18, 30), 3); D.lens(p + g * .024 + t * .014 - u * .004, .012, .5, g, (255, 255, 250), 2)
    th = np.linspace(-.06, .06, 9); D.stroke(th, .685 + 3 * th ** 2 - .0, .0065, (50, 40, 60))      # the frown: ends turned down
    def bolt(th, y, dth, dy, n, w, depth):
        pts = [(th, y)]
        for _ in range(n): th += dth + rng.uniform(-.08, .08); y += dy + rng.uniform(-.012, .012); pts.append((th, y))
        a = np.array(pts); D.stroke(a[:, 0], np.clip(a[:, 1], .1, 1.05), w, (255, 248, 214), .005)
        if depth:
            for i in rng.choice(np.arange(1, n), 2, replace=False): bolt(pts[i][0], pts[i][1], dth * rng.choice([-1.6, 1.6]), dy * .8, n // 2, w * .7, depth - 1)
    for th0, y0, dth in ((.15, .62, -.03), (-.35, .60, .03), (.80, .66, .05), (-.85, .64, -.04), (1.6, .85, .01), (-1.7, .87, -.01), (2.7, .95, .03), (-2.6, .9, -.03)):
        bolt(th0, y0, dth, -.055, 9, .010, 1)
    return D.mesh()

if __name__ == '__main__': build(sys.modules[__name__], sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10000)
