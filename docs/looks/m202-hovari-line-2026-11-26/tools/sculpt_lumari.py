"""LUMARI (Hovari, Mana, ledger #35, 035-lumari.png): her own body, read from her locked art.
A PLUMP violet hummingbird, the roundest of the line (a full egg of a belly under a round head), faceted violet feathers, a dark
violet eye, the LONGEST needle beak tilted up, broad violet wings held open, a tail of three long pointed feathers, and a gold
flowing infusion pattern across her chest and one cheek (a flowing pattern, never a sigil: 0d6d577).   python sculpt_lumari.py out.glb"""
import sys, numpy as np
import hov_common as H
from hov_common import cone, ell, su, V3, C8, hexes, coat_paint, ss, mixc
LID, ZW, TH = .07, -.090, .0110
SH, WR = V3(.175, .585), V3(.410, .790)
# broad blades, the art's wide open wings
FE = [((.395, .795), (.720, .975), .050), ((.385, .780), (.725, .840), .054), ((.360, .755), (.680, .700), .055), ((.325, .720), (.600, .570), .054),
      ((.285, .685), (.500, .480), .052), ((.245, .645), (.390, .425), .046), ((.205, .605), (.290, .410), .042)]
FE = [(a, b, w * 1.15) for a, b, w in FE]     # broad, weighty blades (Alex 11-27 on the Athowl line: not dainty)
TO = V3(0, .330, -.120); TD = V3(0, -.340, -.200); TD /= np.linalg.norm(TD)
TF = [((.0, .0), (.0, .500), .056), ((.05, .0), (.150, .470), .054), ((.07, .02), (.215, .330), .044)]     # three long pointed feathers
BK = [V3(0, .800, .160), V3(0, .815, .320), V3(0, .905, .860)]
HC = V3(0, .810, .020)
def beak(M): return cone(M, (0, .798, .130), (0, .805, .205), .044, .029)
def egg(M):   # the roundest belly of the line
    b = ell(M, (0, .440, .030), (.262, .255, .250)); b = su(b, ell(M, (0, .600, .025), (.180, .15, .165)), .07); return su(b, ell(M, (0, .320, -.060), (.150, .13, .130)), .08)
def ball(M): return ell(M, HC, (.205, .195, .205))
def core(M): return su(egg(M), ball(M), .055)
TU = H.lay_tufts(core, H.rows([(.715, .080, .030, .056, [58, 78, 98, 122, 146, 170]), (.615, .078, .028, .058, [48, 70, 146, 172]), (.520, .080, .028, .062, [22, 46, 70, 128, 152, 176]),
     (.420, .080, .028, .062, [10, 36, 60, 86, 112, 138, 164]), (.320, .078, .026, .056, [0, 26, 52, 80, 108, 136]), (.870, .070, .026, .052, [124, 148, 172]), (.805, .070, .024, .052, [110, 136, 162])]))     # her own layered feather tips (rows read from her art)
def head(M): return H.coat_on(M, ball(M), TU, .735, 9)
def trunk(M): return su(H.coat_on(M, egg(M), TU, -9, .735), cone(M, (.120, .570, -.045), (.175, .595, ZW), .075, .044), .04)
def thigh(M): return cone(M, (.082, .260, .080), (.088, .185, .105), .045, .016)
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); b = su(trunk(M), head(M), .050); b = su(b, thigh(M), .02)
    b = su(b, H.B.tail(M), .02); b = su(b, H.B.wing(M), .016); return su(b, beak(M), .030)
VIO = hexes('#2f1b5e', '#5b3596', '#8c5cc8'); BELLY = C8('#a77ad8') / 255.
WING = hexes('#5e3a9e', '#8a62c4', '#b394e0', '#d4c0f2'); TAIL = hexes('#3a2274', '#6a42aa', '#9670d0'); COV = hexes('#6a44aa', '#45287e'); GOLD = C8('#e9b949') / 255.
def flow(V, c, body, w, t):
    """the gold infusion pattern: flowing bands over her chest and her left cheek (waves and a ring, no glyph)"""
    x, y, z = V.T; front = ss(.02, .09, z) * body
    chest = ss(1.0, .75, np.sqrt((x / .26) ** 2 + ((y - .50) / .22) ** 2)); cheek = ss(1.0, .7, np.sqrt(((x - .10) / .10) ** 2 + ((y - .735) / .075) ** 2))
    band = np.abs(np.sin(34 * y + 4.5 * np.sin(14 * x + 1.0))); ring = np.abs(np.hypot(x - .05, y - .56) - .075)
    k = np.maximum(ss(.30, .13, band) * chest, ss(.024, .010, ring) * chest) + ss(.32, .14, np.abs(np.sin(48 * y + 9 * x))) * cheek
    return mixc(c, GOLD, np.clip(k, 0, 1) * front)
def paint(V, N, C): return coat_paint(V, N, C, VIO, [0, .5, 1], (0, .42, .16), BELLY, WING, [.0, .35, .7, 1.05], COV, TAIL, flow, tipc=C8("#b48ce6") / 255.)
YAW, EY, ER = np.radians(42), .797, V3(.0660, .0700)
RB = [C8(s) for s in ('#9a74d8', '#b896ec', '#d6c0f6', '#f0c870', '#e6d4ff')]
PAL = dict(rim=(30, 16, 48), white=(236, 226, 246), iris=(70, 40, 112), glow=(160, 118, 214), pupil=(12, 8, 20), hi2=(240, 226, 255), hi3=(210, 190, 240),
           lash=(40, 22, 70), blush=(128, 86, 182), lid=(112, 72, 170), lidline=(38, 20, 66), toes=(30, 26, 36), beak_a=(48, 44, 58), beak_b=(100, 96, 118), beak_c=(30, 24, 36))
H.bind(globals())
if __name__ == '__main__': H.build(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 2500)
