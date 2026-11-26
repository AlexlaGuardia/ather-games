"""M202: ARCLOTL (Manalotl's Storm second form) as HER OWN CREATURE, from the LOCKED art /root/athernyx/assets/stage2/
015-arclotl.png (grimoire-ledger #15). Storm is in the anatomy: she is the line's stout, charged one.
    python sculpt_arclotl.py <out.glb> [tris]
What the picture shows -> what this body carries as SHAPE:
  - a round barrel body, a big round belly, short thick legs                  -> the roundest trunk of the line, the belly bulging
                                                                              low and forward, stumpy legs (her sit = the art's stance)
  - a broad flat paddle tail on the ground                                    -> a thick tail flattening into a WIDE flat paddle
                                                                              (Marlotl's fin stands tall; this one lies flat)
  - six spiky gills, jagged, with crackling forked tendrils off them          -> three straight thick gill spikes a side, each with
                                                                              saw-tooth side spikes and two thin forked tendrils off its
                                                                              tip (the lightning), no fronds, no web, no leaf
  - a spark on her brow                                                       -> a lilac spark mark (colour)
  - pale crackle lines over her skin, a pale cream belly                      -> crackle veins (colour) on a cream belly
  - sky-blue coat, bright blue eyes with a gold glint                        -> blue coat, blue iris, a warm catchlight
Where the art is silent: the tendril count and shape (two a gill, three kinks each); claws on all four feet."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from lotl_common import V3, su, ell, cone, mir, box, polyline, seg_t, run
DY = 0.
L = dict(head=(0, .44, .38), chest=(0, .30, .16), pelvis=(0, .27, -.26),
         f=[(.165, .240, .170), (.255, .140, .215), (.265, .036, .245)],
         h=[(.170, .220, -.250), (.270, .130, -.285), (.275, .036, -.260)],
         tail=[(0, .25, -.38), (0, .19, -.56), (0, .13, -.72), (0, .095, -.86), (0, .08, -.95)], tailr=[.12, .095, .075, .060, .030])
SITA = .12
EYE, EYE_R, IRIS, SHINE = (.150, .455), .060, (40, 110, 190), (255, 236, 150)
SMILE_W, SMILE, SMILE_COL = .135, (lambda x: .355 + 1.6 * x ** 2), (30, 40, 60)
BOUNDS = ((-.66, -.033, -1.02), (.66, .92, .68))

def head(P):
    h = ell(P, (0, .430, .375), (.285, .205, .220))                                   # a wide head
    h = su(h, ell(P, (0, .415, .470), (.230, .160, .130)), .06)
    return su(h, ell(P, (0, .350, .420), (.220, .090, .165)), .05)
def trunk(P):
    b = ell(P, (0, .300, -.050), (.245, .240, .300))                                  # a round barrel
    return su(b, ell(P, (0, .235, .060), (.215, .195, .225)), .08)                    # the big belly, low + forward
def legs(P):
    M = mir(P); f, h = L['f'], L['h']; d = cone(M, f[0], f[1], .060, .048); d = su(d, cone(M, f[1], f[2], .048, .042), .03)
    d = su(d, ell(M, (.272, .024, .272), (.050, .024, .048)), .025)
    t = cone(M, h[0], h[1], .070, .055); t = su(t, cone(M, h[1], h[2], .055, .046), .03); t = su(t, ell(M, (.282, .024, -.240), (.054, .024, .056)), .025)
    for a in np.radians([-40, 0, 40]):
        df = V3(np.sin(a) * .8 + .2, 0, np.cos(a)); df /= np.linalg.norm(df); p0 = V3(.278, .022, .300)
        d = su(d, cone(M, p0, p0 + df * .050 + V3(0, -.008, 0), .016, .007), .008)
        p1 = V3(.288, .022, -.195); t = su(t, cone(M, p1, p1 + df * .050 + V3(0, -.008, 0), .016, .007), .008)
    return su(d, t, .001)
def tail(P):
    """thick at the root, then a wide flat paddle lying on the ground"""
    z = -P[..., 2]; sx = np.interp(z, [.38, .56, .76, .95], [1., .70, .36, .30]); sy = np.interp(z, [.38, .56, .76, .95], [1., 1.35, 2.4, 2.6])
    Q = np.stack([P[..., 0] * sx, P[..., 1] * sy, P[..., 2]], -1); pts = [((a[0], a[1] * np.interp(-a[2], [.38, .56, .76, .95], [1., 1.35, 2.4, 2.6]), a[2]), r) for a, r in zip(L['tail'], L['tailr'])]
    d = np.full(P.shape[:-1], 9.)
    for (a, ra), (b, rb) in zip(pts[:-1], pts[1:]): d = np.minimum(d, cone(Q, a, b, ra, rb))
    return d / np.maximum(sy, 1)
# gills: three straight spikes a side, saw-toothed, two forked tendrils off each tip
GILLS = [((.195, .555, .320), (.50, .80, -.30), .250), ((.245, .470, .315), (.90, .28, -.32), .270), ((.235, .380, .320), (.86, -.26, -.36), .220)]
def _frame(d):
    u = V3(*d) / np.linalg.norm(d); v = np.cross(u, V3(0, 0, 1)); v /= np.linalg.norm(v); return u, v
def tendrils(root, d, ln):
    u, v = _frame(d); tip = V3(*root) + u * ln; out = []
    for sg, k in ((1, .9), (-1, 1.1)):
        p = [tip - u * .03]; q = tip - u * .03
        for j in range(3): q = q + u * .050 * k + v * sg * (.035 if j % 2 == 0 else -.018) + V3(0, 0, -.012); p.append(q)
        out.append(p)
    return out
def _gill(M, root, d, ln):
    u, v = _frame(d); r = V3(*root); g = cone(M, r, r + u * ln, .036, .010)
    for k, s in enumerate((.30, .52, .74)):                                            # saw teeth, alternating
        sg = 1 if k % 2 == 0 else -1; p0 = r + u * ln * s; g = su(g, cone(M, p0, p0 + v * sg * .060 + u * .045, .018, .004), .008)
    for p in tendrils(root, d, ln): g = np.minimum(g, polyline(M, p, .0085, .0045))
    return g
GLO, GHI = V3(-.66, .22, .05), V3(.66, .92, .42)
def _gills(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for g in GILLS: d = np.minimum(d, _gill(M, *g))
    return d
def gills(P): return np.minimum(box(_gills, P, GLO, GHI), np.maximum(np.abs(P[..., 0]) - .66, .22))
def tendril_d(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for g in GILLS:
        for p in tendrils(*g): d = np.minimum(d, seg_t(M, p)[0])
    return d
def body(P):
    b = su(trunk(P), head(P), .08); b = su(b, np.minimum(box(legs, P, V3(-.40, -.05, -.36), V3(.40, .30, .36)), .3), .035)
    return su(b, tail(P), .05)
def field(P): return su(body(P), gills(P), .014)

PAL = dict(lo='#5d8fc8', hi='#9cc6ee', belly='#e6eef4', crack='#9fc0e4', vein='#eef8ff', gill='#6e8fbc', gtip='#a8c8ec', tend='#8fe0ff', claw='#3c5a86', spark='#c8a8f0', blush='#e8b4cc')
def classes(V):
    x, y, z = V.T; A = np.abs(x); out = []
    out.append(np.where(z > -.12, .125 - np.sqrt((x / 1.25) ** 2 + ((y - .23) / 1.3) ** 2), -1.))                        # the cream belly
    c = np.sin(x * 34 + 2.1 * np.sin(y * 21)) * np.sin(y * 31 + 2.0 * np.sin(z * 17 + x * 9))
    out.append(np.where((z > -.12) & (A < .17) & (y < .40), .10 - np.abs(c), -1.))                                    # crackle lines on the belly
    out.append(np.where((y > .14) & (np.abs(c) < .07) & ~((z > -.12) & (A < .17) & (y < .40)) & (z < .30), 1., -1.))  # pale crackle veins over the coat
    gf = gills(V); td = tendril_d(V)
    out.append(np.where(gf < .006, 1., -1.)); out.append(np.where(gf < .006, np.abs(x) - .40, -1.)); out.append(np.where((gf < .006) & (td < .012), 1., -1.))
    out.append(np.where((y < .03) & ((A > .26) | (z > .29)), 1., -1.))
    out.append(.022 - np.sqrt(x ** 2 + ((y - .600) * 1.2) ** 2 + (z - .50) ** 2 * .2))                               # the spark on her brow
    out.append(.026 - np.sqrt(((A - .190) * .9) ** 2 + ((y - .385) * 1.6) ** 2 + (z - .55) ** 2 * .3))
    return out
ORDER = ('belly', 'crack', 'vein', 'gill', 'gtip', 'tend', 'claw', 'spark', 'blush')

if __name__ == '__main__':
    run(sys.modules[__name__], 'arclotl')
