"""M202: AURLOTL (Manalotl's Mana second form) as HER OWN CREATURE, from the LOCKED art /root/athernyx/assets/stage2/
014-aurlotl.png (grimoire-ledger #14). Mana is in the anatomy: she is the line's tall one, carried high, crowned.
    python sculpt_aurlotl.py <out.glb> [tris]
What the picture shows -> what this body carries as SHAPE:
  - she stands tall, a pear: narrow shoulders, wide hips, no tail to speak of -> a short pear trunk, chest carried HIGH on long
                                                                              forelegs, broad haunches, a stub of a tail (her sit is
                                                                              the art's upright stance)
  - a big round head on top, wide-set dark eyes, a wide smile                 -> the tallest dome of the line, set over the chest
  - six huge feathered gills sweeping up and out like a crown of horns        -> three gills a side, each a LONG curved dark stalk
                                                                              arcing up and back, dense feather fronds along it (no web:
                                                                              Marlotl's were fins, Craglotl's are leaves, these are plumes)
  - gold infusion markings: an oval panel on the brow, a round panel mid-chest, -> flowing glyph PANELS: interlaced knot strokes
    two knot panels on the belly flanks, arcs on the shoulders, an oval on      (a trefoil-knot line) inside oval/round outlines,
    each upper arm                                                              colour cuts on the body, unlit geometry on the brow
  - short arms, dark clawed feet                                              -> dark claws, three a foot
  - violet coat, a paler glowing belly                                        -> violet coat, a pale lilac belly (the glow is M204's)
Where the art is silent: the tail stub (the art hides her back); claws on all four feet.
Marks (Magii RULED-AFK 2026-11-26, athernyx 0d6d577, CANON_GAPS): NO sigil, ever (sigils are weapon crystals). Her gold marks are
the INFUSION MARKINGS a second form arrives with (design-briefs/base-forms.md:15): pattern only, flowing glyph panels in her
element's look, spelling no named rune. So: no cross, no letter; every panel is the same flowing interlace (a trefoil-knot line)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from lotl_common import V3, su, ell, cone, mir, box, polyline, seg_t, run
DY = 0.
L = dict(head=(0, .50, .36), chest=(0, .36, .16), pelvis=(0, .28, -.22),
         f=[(.130, .300, .170), (.200, .165, .215), (.215, .036, .245)],
         h=[(.150, .230, -.240), (.245, .130, -.275), (.250, .036, -.250)],
         tail=[(0, .27, -.34), (0, .245, -.42), (0, .22, -.48), (0, .205, -.52), (0, .20, -.54)], tailr=[.10, .070, .045, .026, .012])
SITA = .75
EYE, EYE_R, IRIS, SHINE = (.140, .520), .058, (52, 38, 96), (255, 255, 250)
SMILE_W, SMILE, SMILE_COL = .125, (lambda x: .405 + 2.6 * x ** 2), (52, 30, 70)
BOUNDS = ((-.64, -.033, -.62), (.64, 1.05, .66))

def head(P):
    h = ell(P, (0, .490, .350), (.250, .215, .215))                                   # the tallest dome
    h = su(h, ell(P, (0, .475, .445), (.205, .165, .125)), .06)
    return su(h, ell(P, (0, .410, .390), (.190, .090, .160)), .05)
def trunk(P):
    b = ell(P, (0, .340, .120), (.165, .175, .170))                                   # narrow high chest
    b = su(b, ell(P, (0, .275, -.120), (.230, .215, .200)), .10)                      # broad haunches: a pear
    return su(b, ell(P, (0, .250, .010), (.190, .165, .190)), .06)
def legs(P):
    M = mir(P); f, h = L['f'], L['h']; d = cone(M, f[0], f[1], .050, .040); d = su(d, cone(M, f[1], f[2], .040, .036), .03)
    d = su(d, ell(M, (.222, .024, .270), (.045, .024, .045)), .025)
    t = cone(M, h[0], h[1], .075, .055); t = su(t, cone(M, h[1], h[2], .055, .045), .03); t = su(t, ell(M, (.258, .026, -.235), (.055, .026, .060)), .025)
    for a in np.radians([-35, 0, 35]):
        df = V3(np.sin(a) * .8 + .15, 0, np.cos(a)); df /= np.linalg.norm(df); p0 = V3(.228, .022, .300)
        d = su(d, cone(M, p0, p0 + df * .045 + V3(0, -.008, 0), .014, .006), .008)
        p1 = V3(.262, .022, -.185); t = su(t, cone(M, p1, p1 + df * .050 + V3(0, -.008, 0), .016, .006), .008)
    return su(d, t, .001)
def tail(P):
    pts = list(zip(L['tail'], L['tailr'])); d = np.full(P.shape[:-1], 9.)
    for (a, ra), (b, rb) in zip(pts[:-1], pts[1:]): d = np.minimum(d, cone(P, a, b, ra, rb))
    return d
# gills: three long arcing plumes a side, a crown of horns (root behind the eyes, high on the head)
GILLS = [[(.170, .620, .300), (.225, .760, .265), (.300, .880, .205), (.390, .950, .130)],
         [(.215, .555, .295), (.330, .640, .260), (.450, .700, .200), (.560, .720, .130)],
         [(.215, .470, .300), (.335, .470, .265), (.450, .430, .210), (.540, .370, .150)]]
def _gill(M, pts):
    d = polyline(M, pts, .030, .010); fr = np.full(M.shape[:-1], 9.); P = [V3(*p) for p in pts]
    for i in range(len(P) - 1):
        u = P[i + 1] - P[i]; ln = np.linalg.norm(u); u = u / ln; v = np.cross(u, V3(0, 0, 1)); v /= np.linalg.norm(v)
        for k in range(5):
            s = (k + .5) / 5; p0 = P[i] + u * ln * s; w = .070 * (1 - .25 * (i + s) / 3) + .01
            for sg in (1, -1): fr = np.minimum(fr, cone(M, p0, p0 + v * sg * w + u * w * .65, .0120, .0058))
    return su(d, fr, .007)
GLO, GHI = V3(-.66, .30, .02), V3(.66, 1.02, .40)
def _gills(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for g in GILLS: d = np.minimum(d, _gill(M, g))
    return d
def gills(P): return np.minimum(box(_gills, P, GLO, GHI), np.maximum(np.abs(P[..., 0]) - .66, .3))
def gill_stalk(P):
    M = mir(P); best = np.full(P.shape[:-1], 9.); t = np.zeros(P.shape[:-1])
    for g in GILLS:
        d, tt = seg_t(M, g); w = d < best; best = np.where(w, d, best); t = np.where(w, tt, t)
    return best, t
def body(P):
    b = su(trunk(P), head(P), .08); b = su(b, np.minimum(box(legs, P, V3(-.36, -.05, -.36), V3(.36, .36, .36)), .3), .035)
    return su(b, tail(P), .05)
def field(P): return su(body(P), gills(P), .016)

PAL = dict(lo='#5a4aa6', hi='#8f80d8', belly='#c4b2f0', gill='#d6a6ea', gtip='#f2cdf2', stalk='#4a3a86', claw='#352a62', blush='#e6a6d6')
GOLD = (231, 189, 76)
def ring(A, y, z, cx, cy, r, w, zmin): return np.where(z > zmin, w - np.abs(np.sqrt((A - cx) ** 2 + (y - cy) ** 2) - r), -1.)
def knot(n=180, rot=0.):
    """the glyph line: a trefoil-knot projection (one closed, flowing, self-interlacing stroke; no straight bar, no letter), unit radius"""
    t = np.linspace(0, 2 * np.pi, n, endpoint=False); x = np.sin(t) + 2 * np.sin(2 * t); y = np.cos(t) - 2 * np.cos(2 * t)
    c, s = np.cos(rot), np.sin(rot); return np.c_[c * x - s * y, s * x + c * y] / 3.
KNOT = knot()
def classes(V):
    x, y, z = V.T; A = np.abs(x); out = []
    out.append(np.where((z > -.05) & (z < .36), .11 - np.sqrt((x / 1.4) ** 2 + ((y - .25) / 1.3) ** 2), -1.))     # the pale belly (front, middle)
    gd, gt = gill_stalk(V); gf = gills(V)
    out.append(np.where(gf < .006, 1., -1.)); out.append(np.where(gf < .006, gt - .70, -1.)); out.append(np.where((gf < .006) & (gd < .018), 1., -1.))   # plumes, paler tips, dark stalk
    out.append(np.where((y < .03) & ((A > .22) | (z > .28)), 1., -1.))
    out.append(.028 - np.sqrt(((A - .175) * .9) ** 2 + ((y - .445) * 1.6) ** 2 + (z - .52) ** 2 * .3))
    return out
ORDER = ('belly', 'gill', 'gtip', 'stalk', 'claw', 'blush')
def oval(rx, ry, n): t = np.linspace(0, 2 * np.pi, n, endpoint=False); return np.c_[rx * np.cos(t), ry * np.sin(t)]
def even(pts, step, closed=True):
    """resample a polyline to one point per `step` of arc length, so the dots touch and read as one stroke"""
    P = np.vstack([pts, pts[:1]]) if closed else pts; L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    u = np.arange(0, L[-1] - (step * .5 if closed else 0), step); return np.c_[np.interp(u, L, P[:, 0]), np.interp(u, L, P[:, 1])]
def EXTRA_EYES(lens, project, grad):
    """Her infusion markings, all as unlit gold geometry on the surface (a colour cut this thin on an 8k-tri body breaks into
    blobs and dashes). The game skins the 'eyes' part per vertex, so rig_lotl.py hands each mark the weights of the body under
    it (head marks stay on the head bone). No cross, no letter: the old placeholder sigil is gone (Magii 0d6d577).
      brow: an oval outline (wider than tall, as the art) round the knot   chest: a round outline round the knot, below the chin
      shoulders: an arc over each side of the chest panel                  flanks: a bigger knot, no outline, between the legs
      upper arms: a small oval on the outside of each foreleg"""
    def dots(uv, put, r, axis, mirror=False, sub=1):
        for u, w in uv:
            q = project(put(u, w), axis); g = grad(q); lens(q + g * .001, r, .45, g, GOLD, sub)
            if mirror: lens((q + g * .001) * [-1, 1, 1], r, .45, g * [-1, 1, 1], GOLD, sub)
    dots(even(oval(.058, .034, 200), .0075), lambda u, w: (u, .640 + w, .95), .0062, 2)                           # brow outline
    dots(even(KNOT * [.040, .024], .0062), lambda u, w: (u, .640 + w, .95), .0052, 2)                             # brow knot
    dots(even(oval(.054, .054, 200), .0072), lambda u, w: (u, .235 + w, .95), .0062, 2)                            # chest outline
    dots(even(KNOT * .035, .0060), lambda u, w: (u, .235 + w, .95), .0052, 2)                                      # chest knot
    arc = np.c_[.135 + .05 * np.cos(np.linspace(.55, 2.6, 60)), .265 + .05 * np.sin(np.linspace(.55, 2.6, 60))]
    dots(even(arc, .0070, False), lambda u, w: (u, w, .95), .0060, 2, True)                                       # shoulder arcs
    dots(even(KNOT[:, ::-1] * [.070, .062], .0072), lambda u, w: (.95, .240 + w, -.010 + u), .0062, 0, True)       # flank knots
    dots(even(oval(.024, .024, 100), .0066), lambda u, w: (.95, .235 + w, .195 + u), .0056, 0, True)               # upper-arm ovals

if __name__ == '__main__':
    run(sys.modules[__name__], 'aurlotl')
