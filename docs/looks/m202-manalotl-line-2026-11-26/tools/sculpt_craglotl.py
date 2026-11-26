"""M202: CRAGLOTL (Manalotl's Earth second form) as HER OWN CREATURE, from the LOCKED art /root/athernyx/assets/stage2/
016-craglotl.png (grimoire-ledger #16). Earth is in the anatomy: she is the line's ground-hugger.
    python sculpt_craglotl.py <out.glb> [tris]
What the picture shows -> what this body carries as SHAPE:
  - one broad low dome, head and body a single mass, pressed to the ground   -> a wide flat trunk (0.60 wide, 0.38 tall) the head
                                                                              melts into, no neck, the widest of the line
  - a stone sitting on her crown, pebbles set in her back                     -> a rock on the crown + three stones in the back (shape, grey)
  - moss over the top of her head and back                                    -> moss patches (colour) on the top
  - short leafy orange gills like flames, four a side, fanned flat            -> four short broad leaf blades a side, fanned out, not up
  - legs splayed wide, flat stubby feet                                       -> thick sprawled legs, wider than any other form's, short claws
  - a warm amber glow in her belly and under her smile                       -> the belly + chin paler and warm (colour; the glow is M204's)
  - a short thick tail                                                        -> a short thick tail laid on the ground, no fin
Where the art is silent: the tail (the art hides it behind her); the back stones (the art shows one on her head and pebbles
round her); claws on the hind feet too."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from lotl_common import V3, su, ell, cone, mir, box, polyline, seg_t, run
DY = 0.
L = dict(head=(0, .34, .40), chest=(0, .26, .18), pelvis=(0, .26, -.30),
         f=[(.200, .170, .190), (.330, .105, .230), (.365, .036, .265)],
         h=[(.200, .170, -.300), (.330, .105, -.345), (.365, .036, -.320)],
         tail=[(0, .24, -.38), (0, .19, -.52), (0, .145, -.65), (0, .115, -.75), (0, .10, -.82)], tailr=[.13, .10, .070, .042, .018])
SITA = .22
EYE, EYE_R, IRIS, SHINE = (.150, .385), .058, (92, 52, 20), (255, 246, 220)
SMILE_W, SMILE, SMILE_COL = .150, (lambda x: .275 + 2.4 * x ** 2), (70, 30, 12)
BOUNDS = ((-.62, -.033, -1.0), (.62, .72, .70))

def head(P):
    h = ell(P, (0, .330, .390), (.300, .215, .235))
    h = su(h, ell(P, (0, .315, .480), (.245, .170, .135)), .07)                       # the broad face
    return su(h, ell(P, (0, .255, .430), (.235, .100, .170)), .05)                    # a full chin under the big smile
def trunk(P):
    b = ell(P, (0, .250, -.060), (.300, .200, .370))                                  # low and very wide
    return su(b, ell(P, (0, .200, .050), (.270, .150, .280)), .06)                    # the belly spreads on the ground
STONES = [((0.015, .550, .335), (.088, .062, .078)), ((.135, .425, -.050), (.058, .040, .052)), ((-.110, .420, -.200), (.052, .036, .050)), ((.060, .400, -.300), (.040, .030, .040))]
def stones(P):
    d = np.full(P.shape[:-1], 9.)
    for c, r in STONES: d = np.minimum(d, ell(P, c, r) + .006 * np.sin(P[..., 0] * 70) * np.sin(P[..., 2] * 60))   # a lumpy stone
    return d
def legs(P):
    M = mir(P); f, h = L['f'], L['h']; d = cone(M, f[0], f[1], .070, .055); d = su(d, cone(M, f[1], f[2], .055, .045), .03)
    d = su(d, ell(M, (.372, .024, .295), (.058, .024, .050)), .025)
    t = cone(M, h[0], h[1], .075, .058); t = su(t, cone(M, h[1], h[2], .058, .047), .03); t = su(t, ell(M, (.372, .024, -.345), (.058, .024, .050)), .025)
    for a in np.radians([-45, -10, 25]):                                               # three short thick claws
        df = V3(np.sin(a) * .9 + .35, 0, np.cos(a)); df /= np.linalg.norm(df); p0 = V3(.380, .022, .310)
        d = su(d, cone(M, p0, p0 + df * .060 + V3(0, -.008, 0), .020, .010), .01)
        dh = V3(np.sin(a) * .9 + .40, 0, np.cos(a) * .5 - .4); dh /= np.linalg.norm(dh); p1 = V3(.384, .022, -.360)
        t = su(t, cone(M, p1, p1 + dh * .058 + V3(0, -.008, 0), .020, .010), .01)
    return su(d, t, .001)
def tail(P):
    pts = list(zip(L['tail'], L['tailr'])); d = np.full(P.shape[:-1], 9.); Q = P * V3(.85, 1.15, 1)
    for (a, ra), (b, rb) in zip(pts[:-1], pts[1:]): d = np.minimum(d, cone(Q, a, b, ra, rb))
    return d
# gills: four short broad leaf blades a side, fanned out flat like flames (Marlotl's stood tall and webbed; these hug the head)
GILLS = [((.215, .470, .330), (.55, .80, -.25), .190), ((.255, .420, .320), (.85, .45, -.28), .215), ((.270, .350, .315), (.95, .05, -.30), .210), ((.250, .285, .320), (.85, -.35, -.30), .170)]
def _frame(d):
    u = V3(*d) / np.linalg.norm(d); v = np.cross(u, V3(0, 0, 1)); v /= np.linalg.norm(v); return u, v, np.cross(u, v)
def gill1(M, root, d, ln):
    u, v, n = _frame(d); q = M - V3(*root); a = q @ u; b = q @ v; c = q @ n; t = np.clip(a / ln, 0, 1)
    hw = .052 * np.sin(np.pi * np.clip(t * .9 + .05, 0, 1)) ** .6 * (1 + .25 * np.sin(a * 60))            # a leaf whose edge is notched (flame tongues)
    bl = np.maximum.reduce([np.abs(b) - hw, np.abs(c) - .011 * (1 - .5 * t), -a + .01, a - ln])
    return su(cone(M, root, V3(*root) + u * ln * .9, .030, .010), bl, .014), t
GLO, GHI = V3(-.62, .10, .05), V3(.62, .72, .45)
def _gills(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for g in GILLS: d = np.minimum(d, gill1(M, *g)[0])
    return d
def gills(P): return np.minimum(box(_gills, P, GLO, GHI), np.maximum(np.abs(P[..., 0]) - .62, .1))
def gill_t(P):
    M = mir(P); best, t = np.full(P.shape[:-1], 9.), np.zeros(P.shape[:-1])
    for g in GILLS:
        d, tt = gill1(M, *g); w = d < best; best = np.where(w, d, best); t = np.where(w, tt, t)
    return best, t
def body(P):
    b = su(trunk(P), head(P), .10); b = su(b, np.minimum(box(legs, P, V3(-.48, -.05, -.48), V3(.48, .26, .42)), .3), .04)
    b = su(b, tail(P), .06); return su(b, stones(P), .012)
def field(P): return su(body(P), gills(P), .018)

PAL = dict(lo='#b85a1c', hi='#e8902e', belly='#f7c25a', glow='#ffd978', moss='#7f9a36', mossd='#5e7a2a', stone='#8c887a', gill='#e46a24', gtip='#ffc24a',
           claw='#7a3a14', blush='#f0a070')
def _noise(V): x, y, z = V.T; return np.sin(x * 23 + 1.3) * np.sin(z * 19 + .7) + .6 * np.sin(x * 41 - z * 37 + y * 13)
def classes(V):
    x, y, z = V.T; A = np.abs(x); out = []
    out.append(np.minimum.reduce([.17 - y + .05 * np.clip(A - .1, 0, 1), z + .36, .58 - z, .25 - A]))                       # warm belly + chin
    out.append(.035 - np.sqrt(((A - .0) * .35) ** 2 + ((y - .16) * .9) ** 2 + ((z - .30) * .25) ** 2))               # the glow core, front-low
    nz = _noise(V); out.append(np.where((y > .40 - .05 * (z < .2)) & ~((z > .46) & (A < .22) & (y < .50)), nz + .2 - .3 * (y < .44), -1.))   # moss over the top, off the face
    out.append(np.where((y > .43), nz - .45, -1.))                                                                    # darker moss heart
    out.append(.006 - stones(V))                                                                                     # stones grey
    gd, gt = gill_t(V); out.append(np.where(gd < .007, 1., -1.)); out.append(np.where(gd < .007, gt - .62 + .06 * np.sin(z * 80), -1.))
    out.append(np.where((y < .03) & (A > .36), 1., -1.))                                                             # dark claw tips
    out.append(.030 - np.sqrt(((A - .195) * .9) ** 2 + ((y - .305) * 1.6) ** 2 + (z - .55) ** 2 * .3))              # blush under the eyes
    return out
ORDER = ('belly', 'glow', 'moss', 'mossd', 'stone', 'gill', 'gtip', 'claw', 'blush')

if __name__ == '__main__':
    run(sys.modules[__name__], 'craglotl')
