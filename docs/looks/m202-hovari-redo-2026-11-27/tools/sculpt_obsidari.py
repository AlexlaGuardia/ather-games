"""REDO 2026-11-27: grown fledgling proportions via H.Grow (see hov_common); her own body below otherwise unchanged.
OBSIDARI (Hovari, Earth, ledger #36, 036-obsidari.png): her own body, read from her locked art.
A stocky amber hummingbird made of overlapping stone-chip feathers: the BIGGEST head of the line, lumpy with chips, a heavy round
body, a collar of green gems at her throat, grey stones and moss set into her flank and wing shoulder, an amber eye, a short strong
beak, short broad leaf-shaped wings raised high, and a broad amber tail fan.   python sculpt_obsidari.py out.glb"""
import sys, numpy as np
import hov_common as H
from hov_common import cone, ell, su, V3, C8, hexes, coat_paint, ss, mixc
LID, ZW, TH = .07, -.080, .0120
SH, WR = V3(.170, .600), V3(.365, .800)
# short broad leaf blades, raised: her wings stand up, not out
FE = [((.355, .805), (.590, .965), .056), ((.345, .790), (.615, .905), .060), ((.325, .765), (.600, .770), .060), ((.295, .730), (.540, .640), .058),
      ((.260, .695), (.460, .545), .055), ((.225, .655), (.370, .480), .050), ((.190, .615), (.280, .455), .045)]
FE = [(a, b, w * 1.15) for a, b, w in FE]     # broad, weighty blades (Alex 11-27 on the Athowl line: not dainty)
TO = V3(0, .350, -.100); TD = V3(0, -.310, -.215); TD /= np.linalg.norm(TD)
TF = [((.0, .0), (.0, .440), .066), ((.04, .0), (.140, .420), .064), ((.07, .02), (.240, .360), .058), ((.08, .03), (.235, .300), .050)]      # the broad fan
BK = [V3(0, .800, .175), V3(0, .815, .300), V3(0, .875, .640)]
HC = V3(0, .825, .015)
CHIPS = [(np.radians(a), y) for a, y in ((20, 1.045), (90, 1.065), (160, 1.035))]     # REDO: stood taller, so her ridge still crowns the line on the grown-down head       # a ridge of three chips down her crown (more chips round it closed a ring round a hole: a handle)
def beak(M): return cone(M, (0, .800, .150), (0, .808, .225), .050, .034)
def egg(M):   # heavy and round, a deep chest
    b = ell(M, (0, .450, .020), (.250, .245, .240)); b = su(b, ell(M, (0, .615, .020), (.185, .15, .170)), .07); return su(b, ell(M, (0, .335, -.060), (.150, .13, .125)), .08)
def ball(M):
    d = ell(M, HC, (.228, .215, .225))
    for a, y in CHIPS:                                                                                    # stone chips set INTO her crown (on the head's own surface: a chip off it would bridge to the next one round a hole)
        rr = .82 * np.sqrt(max(1 - ((y - HC[1]) / .215) ** 2, .05)); d = su(d, ell(M, (0, y, np.cos(a) * .225 * rr + HC[2]), (.050, .032, .050)), .022)
    return d
COLLAR = [((np.sin(a) * .155, .655 - .02 * abs(np.sin(a)), np.cos(a) * .155 + .02)) for a in np.radians([-15, 15, 45, 75])]
STONES = [((.170, .520, .045), .058), ((.200, .410, .040), .050), ((.160, .350, .060), .036)]
def core(M): return su(egg(M), ball(M), .055)
G = H.Grow(sh=.88, kz=1.16, kx=.95); G.body(globals())     # REDO: grown fledgling proportions (hov_common.Grow)
COLLAR = [(c[0] * G.kx, c[1], c[2] * G.kz) for c in COLLAR]; STONES = [((c[0] * G.kx, c[1], c[2] * G.kz), r) for c, r in STONES]     # set on the grown egg
TU = H.lay_tufts(core, H.rows([(.730, .072, .034, .058, [52, 72, 92, 112, 132, 152, 172]), (.640, .070, .032, .058, [46, 66, 148, 168]), (.555, .072, .032, .060, [18, 40, 62, 84, 130, 152, 174]),
     (.470, .072, .032, .060, [6, 28, 50, 72, 94, 116, 138, 160]), (.385, .070, .030, .058, [0, 22, 44, 66, 88, 110, 132, 154]), (.305, .066, .028, .054, [10, 36, 62, 88, 114, 140]),
     (.905, .066, .032, .056, [120, 144, 168]), (.845, .066, .030, .056, [108, 132, 156, 178]), (.960, .060, .028, .052, [130, 160])]))     # her own layered feather tips (rows read from her art)
def head(M): return H.coat_on(M, ball(M), TU, .735, 9)
def trunk(M):
    b = su(H.coat_on(M, egg(M), TU, -9, .735), cone(M, (.115, .585, -.045), (.170, .610, ZW), .080, .046), .04)
    for c in COLLAR: b = su(b, ell(M, (abs(c[0]), c[1], c[2]), (.054, .040, .044)), .012)                       # the green gem collar
    for c, r in STONES: b = su(b, ell(M, c, (r * .8, r, r)), .015)                                             # stones set in her flank
    return b
def thigh(M): return cone(M, (.082, .295, .075), (.088, .205, .100), 0.0600, 0.0225)     # REDO heft: thicker legs
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); b = su(trunk(M), head(M), .045); b = su(b, thigh(M), .02)
    b = su(b, H.B.tail(M), .02); b = su(b, H.B.wing(M), .016); return su(b, beak(M), .030)
AMB = hexes('#6e3c10', '#a8641c', '#d89a3c'); BELLY = C8('#e8b45a') / 255.
WING = hexes('#b0681e', '#d89a40', '#ecbe68', '#f4d48a'); TAIL = hexes('#7a4414', '#b06e24', '#d89a44'); COV = hexes('#c07a28', '#8a5018')
GREEN, STONE, MOSS = C8('#22a050') / 255., C8('#9c9a88') / 255., C8('#5e8a2a') / 255.
def chips(V, c, body, w, t):
    """stone-chip feathers (dark seams on a scale lattice), the gem collar green, the flank stones grey in a bed of moss"""
    x, y, z = V.T; A = np.abs(x)
    seam = np.minimum(np.abs(np.sin(26 * y + 9 * np.sin(11 * A + 3 * z))), np.abs(np.sin(20 * A + 18 * z + 6 * y))); c = mixc(c, c * .62, ss(.14, .05, seam) * body)
    P = np.c_[A, y, z]; g = np.min([np.linalg.norm((P - (abs(q[0]), q[1], q[2])) / (.058, .044, .048), axis=1) for q in COLLAR], 0); c = mixc(c, GREEN, ss(1.15, .95, g))
    s = np.min([np.linalg.norm((P - q) / (r * .85, r * 1.05, r * 1.05), axis=1) for q, r in STONES], 0); c = mixc(c, MOSS, ss(1.7, 1.15, s) * body); c = mixc(c, STONE, ss(1.12, .95, s))
    return c
def paint(V, N, C): return coat_paint(V, N, C, AMB, [0, .5, 1], (0, .44, .16), BELLY, WING, [.0, .35, .7, 1.05], COV, TAIL, chips, tipc=C8("#f2c470") / 255.)
YAW, EY, ER = np.radians(42), .805, V3(.0680, .0720)
RB = [C8(s) for s in ('#e0a040', '#f0c060', '#f6dc90', '#9ad070', '#ffe8b0')]
PAL = dict(rim=(40, 24, 10), white=(246, 236, 210), iris=(200, 128, 30), glow=(250, 196, 90), pupil=(14, 10, 6), hi2=(255, 246, 220), hi3=(250, 226, 170),
           lash=(70, 40, 14), blush=(176, 104, 40), lid=(176, 110, 40), lidline=(76, 42, 14), toes=(28, 24, 22), beak_a=(44, 40, 38), beak_b=(96, 90, 86), beak_c=(28, 24, 22))
G.face(globals()); H.bind(globals())
if __name__ == '__main__': H.build(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 2500)
