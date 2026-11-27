"""VOLTARI (Hovari, Storm, ledger #5, 005-voltari.png): her own body, read from her locked art.
A slim slate-blue hummingbird, longer than she is round, with a fine fuzzed crown and a violet crystal standing on it, a clear blue
eye, a very long needle beak, LONG pale translucent wings raised wide with ragged tips, a long ragged tail fan, and pale lightning
veins branching over her whole coat and wings.   python sculpt_voltari.py out.glb"""
import sys, numpy as np
import hov_common as H
from hov_common import cone, ell, su, V3, C8, cone2, feather, hexes, coat_paint, gem, tube, ss, mixc
LID, ZW, TH = .07, -.085, .0095
SH, WR = V3(.165, .590), V3(.420, .810)
# seven long narrow feathers, tips swept far out and up (the art's wings reach past her beak's length), ragged
FE = [((.400, .805), (.735, 1.000), .040), ((.390, .790), (.735, .875), .042), ((.365, .765), (.705, .740), .043), ((.330, .730), (.660, .600), .041),
      ((.290, .695), (.560, .500), .040), ((.250, .655), (.440, .430), .036), ((.205, .615), (.320, .405), .034)]
FE = [(a, b, w * 1.15) for a, b, w in FE]     # broad, weighty blades (Alex 11-27 on the Athowl line: not dainty)
TO = V3(0, .350, -.110); TD = V3(0, -.300, -.240); TD /= np.linalg.norm(TD)
TF = [((.0, .0), (.0, .560), .050), ((.03, .0), (.105, .530), .048), ((.05, .01), (.200, .470), .046), ((.07, .02), (.285, .385), .040)]     # long ragged fan
BK = [V3(0, .792, .140), V3(0, .800, .300), V3(0, .835, .760)]
HC = V3(0, .815, .010)
def beak(M): return cone(M, (0, .790, .110), (0, .795, .180), .042, .028)
def egg(M):   # slimmer and longer than round: chest high, the belly drawn back to the tail
    b = ell(M, (0, .470, .020), (.205, .215, .200)); b = su(b, ell(M, (0, .620, .020), (.150, .13, .140)), .07); return su(b, ell(M, (0, .330, -.080), (.120, .13, .110)), .09)
def ball(M):
    d = ell(M, HC, (.190, .180, .195))
    for a in np.radians([-40, -20, 0, 20, 40]): d = su(d, ell(M, (np.sin(a) * .10, .965, np.cos(a) * .06 - .02), (.05, .035, .05)), .03)    # the fuzzed crown
    return d
def core(M): return su(egg(M), ball(M), .055)
TU = H.lay_tufts(core, H.rows([(.725, .095, .034, .046, [62, 82, 102, 128, 154, 180]), (.625, .092, .032, .046, [54, 74, 150, 180]), (.530, .095, .032, .050, [26, 52, 78, 130, 160]),
     (.430, .095, .032, .050, [40, 66, 92, 118, 146]), (.340, .090, .030, .046, [30, 60, 90, 120]), (.815, .085, .030, .044, [116, 142, 180])]))     # her own layered feather tips (rows read from her art)
def head(M): return H.coat_on(M, ball(M), TU, .735, 9)
def trunk(M): return su(H.coat_on(M, egg(M), TU, -9, .735), cone(M, (.110, .575, -.045), (.165, .600, ZW), .070, .040), .04)
def thigh(M): return cone(M, (.076, .300, .070), (.082, .215, .095), .043, .016)
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); b = su(trunk(M), head(M), .045); b = su(b, thigh(M), .02)
    b = su(b, H.B.tail(M), .02); b = su(b, H.B.wing(M), .016); return su(b, beak(M), .030)
SLATE = hexes('#2c4a6e', '#4a6f96', '#7d9fbe'); BELLY = C8('#a9cbe0') / 255.
WING = hexes('#5d87a8', '#9cc4d2', '#cfe6e4', '#e8f4ee'); TAIL = hexes('#3e6488', '#6f97b6', '#bcd8de'); COV = hexes('#4e7aa0', '#36597e')
def veins(V, c, body, w, t):
    """pale lightning veins: thin branching ridges of a folded wave field (a crackle, not a mark)"""
    x, y, z = V.T; A = np.abs(x)
    v1 = np.abs(np.sin(9 * y + 6 * A + 2.2 * np.sin(17 * z + 11 * y))); v2 = np.abs(np.sin(13 * A - 7 * y + 3 * z + 2 * np.sin(23 * y)))
    ln = np.minimum(v1, v2 * 1.15); k = ss(.27, .10, ln) * np.where(w, .85, .95)
    return mixc(c, C8('#f2fcff') / 255., k)
def paint(V, N, C): return coat_paint(V, N, C, SLATE, [0, .5, 1], (0, .43, .15), BELLY, WING, [.0, .35, .7, 1.05], COV, TAIL, veins, tipc=C8("#9cc0dc") / 255.)
YAW, EY, ER = np.radians(42), .797, V3(.0620, .0660)
RB = [C8(s) for s in ('#9cc8e0', '#bfe2ee', '#e6f6f4', '#a9c4ff', '#d2ecff')]
PAL = dict(rim=(18, 30, 46), white=(230, 244, 250), iris=(40, 130, 210), glow=(150, 214, 255), pupil=(8, 12, 22), hi2=(214, 240, 255), hi3=(180, 220, 250),
           lash=(24, 44, 70), blush=(90, 128, 166), lid=(84, 120, 156), lidline=(22, 40, 64), toes=(30, 30, 34), beak_a=(46, 52, 62), beak_b=(98, 108, 124), beak_c=(30, 30, 38))
def extra():
    P, F = gem((.040, 1.040, .030), .044, .095, 6); return [(P, F, (150, 96, 230))]                   # the violet crystal on her crown
H.bind(globals())
if __name__ == '__main__': H.build(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 2500)
