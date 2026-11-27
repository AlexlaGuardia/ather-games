"""REDO 2026-11-27: grown fledgling proportions via H.Grow (see hov_common); her own body below otherwise unchanged.
TIDARI (Hovari, Water, ledger #37, 037-tidari.png): her own body, read from her locked art.
A SLEEK teal hummingbird, the slimmest of the line: a small neat head with a water-drop gem standing on her crown, a dark eye, a
short fine beak, a smooth slim body patterned with ripple rings, narrow translucent wings swept HIGH over her back, and a long tail
of narrow pointed feathers.   python sculpt_tidari.py out.glb"""
import sys, numpy as np
import hov_common as H
from hov_common import cone, ell, su, V3, C8, hexes, coat_paint, gem, ss, mixc
LID, ZW, TH = .07, -.095, .0090
SH, WR = V3(.160, .600), V3(.355, .845)
# narrow blades swept up high (the art's raised wing), the tips over her crown
FE = [((.350, .850), (.560, 1.015), .036), ((.340, .835), (.610, .950), .039), ((.320, .810), (.625, .860), .040), ((.295, .775), (.590, .735), .039),
      ((.260, .735), (.520, .620), .037), ((.225, .690), (.420, .540), .034), ((.190, .640), (.300, .490), .031)]
FE = [(a, b, w * 1.15) for a, b, w in FE]     # broad, weighty blades (Alex 11-27 on the Athowl line: not dainty)
TO = V3(0, .345, -.110); TD = V3(0, -.330, -.250); TD /= np.linalg.norm(TD)
TF = [((.0, .0), (.0, .640), .040), ((.03, .0), (.090, .610), .040), ((.05, .01), (.165, .530), .036)]          # the long narrow tail
BK = [V3(0, .792, .130), V3(0, .797, .270), V3(0, .812, .600)]
HC = V3(0, .805, .030)
def beak(M): return cone(M, (0, .790, .105), (0, .794, .170), .038, .025)
def egg(M):   # sleek: narrow and drawn out toward the tail
    b = ell(M, (0, .465, .025), (.190, .210, .185)); b = su(b, ell(M, (0, .615, .025), (.140, .13, .135)), .07); return su(b, ell(M, (0, .330, -.085), (.110, .12, .105)), .09)
def ball(M): return ell(M, HC, (.172, .168, .178))
def core(M): return su(egg(M), ball(M), .055)
G = H.Grow(kz=1.22, kx=.92); G.body(globals())     # REDO: grown fledgling proportions (hov_common.Grow)
TU = H.lay_tufts(core, H.rows([(.710, .090, .022, .044, [62, 84, 106, 130, 156, 180]), (.615, .088, .020, .044, [54, 76, 150, 176]), (.520, .090, .020, .046, [26, 52, 78, 130, 158]),
     (.425, .090, .020, .046, [40, 66, 92, 118, 146, 172]), (.340, .086, .018, .044, [0, 30, 60, 90, 120, 150]), (.860, .076, .020, .040, [130, 156]), (.795, .076, .018, .040, [114, 142, 170])]))     # her own layered feather tips (rows read from her art)
def head(M): return H.coat_on(M, ball(M), TU, .735, 9)
def trunk(M): return su(H.coat_on(M, egg(M), TU, -9, .735), cone(M, (.105, .585, -.050), (.160, .610, ZW), .066, .038), .04)
def thigh(M): return cone(M, (.072, .300, .075), (.078, .215, .098), 0.0500, 0.0187)     # REDO heft: thicker legs
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); b = su(trunk(M), head(M), .045); b = su(b, thigh(M), .02)
    b = su(b, H.B.tail(M), .02); b = su(b, H.B.wing(M), .016); return su(b, beak(M), .030)
TEAL = hexes('#0a5868', '#14909c', '#42c2c0'); BELLY = C8('#7edcd2') / 255.
WING = hexes('#1f97a2', '#62c8c6', '#a8e6e0', '#d8f6f0'); TAIL = hexes('#0e6878', '#2a9aa8', '#7cd0cc'); COV = hexes('#1a8a98', '#0d6070')
def ripples(V, c, body, w, t):
    """ripple rings: pale circles of a water surface laid over her coat"""
    x, y, z = V.T; A = np.abs(x); cell = np.c_[A * 22 + np.sin(y * 9) * 1.5, y * 22 + z * 6]; f = cell - np.round(cell); r = np.hypot(f[:, 0], f[:, 1])
    k = ss(.11, .04, np.abs(r - .32)) * body; return mixc(c, C8('#b4f4ee') / 255., .85 * k)
def paint(V, N, C): return coat_paint(V, N, C, TEAL, [0, .5, 1], (0, .45, .14), BELLY, WING, [.0, .35, .7, 1.05], COV, TAIL, ripples, tipc=C8("#7fe0dc") / 255.)
YAW, EY, ER = np.radians(42), .792, V3(.0590, .0630)
RB = [C8(s) for s in ('#5ccac4', '#8edcd6', '#c0f0ea', '#7ab8f0', '#e0fbf6')]
PAL = dict(rim=(10, 26, 30), white=(220, 240, 238), iris=(28, 52, 60), glow=(80, 150, 160), pupil=(6, 10, 14), hi2=(220, 250, 250), hi3=(180, 230, 230),
           lash=(12, 46, 54), blush=(40, 140, 150), lid=(30, 132, 142), lidline=(10, 46, 54), toes=(30, 30, 32), beak_a=(44, 48, 54), beak_b=(96, 104, 112), beak_c=(28, 30, 34))
def extra():
    a = np.arange(10) / 10 * 2 * np.pi; ys = [0, .015, .037, .060, .082, .102]; rs = [.0, .031, .038, .032, .018, .0]
    P = [V3(0, 1.0 + ys[0], .045)] + [V3(r * np.cos(t), 1.0 + y, .045 + r * np.sin(t)) for y, r in zip(ys[1:-1], rs[1:-1]) for t in a] + [V3(0, 1.0 + ys[-1] + .015, .045)]
    P = np.array(P); n = 10; F = [(0, 1 + (i + 1) % n, 1 + i) for i in range(n)]
    for j in range(3): F += [f for i in range(n) for f in ((1 + j * n + i, 1 + j * n + (i + 1) % n, 1 + (j + 1) * n + (i + 1) % n), (1 + j * n + i, 1 + (j + 1) * n + (i + 1) % n, 1 + (j + 1) * n + i))]
    F += [(1 + 3 * n + i, 1 + 3 * n + (i + 1) % n, len(P) - 1) for i in range(n)]; return [(P, np.array(F), (120, 200, 255))]            # the water drop on her crown
G.face(globals()); H.bind(globals())
if __name__ == '__main__': H.build(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 2500)
