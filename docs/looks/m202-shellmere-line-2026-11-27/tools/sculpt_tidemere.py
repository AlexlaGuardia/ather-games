"""M202 TIDEMERE (Shellmere's Water form; locked art athernyx assets/stage2/022-tidemere.png, looked at, never traced, never in this repo).
python sculpt_tidemere.py <out.glb>. Starts from the base Shellmere (shell_common.base()); what is HERS, not the base's:
  a SEA TURTLE, not a tortoise: a long, LOW, streamlined teardrop shell (a slim lip), FLIPPERS for legs (long swept fore-flippers, small
  hind paddles; flat blades, no toes, no claws), a longer neck reaching forward with the head carried out front, flowing SWIRL carvings on
  the shell (unlit pale-aqua strips, a curl per scute), pale spots on the flippers, teal skin, big deep-blue eyes, NO antennae (the art
  has none). The flippers ride the base rig's leg + foot bones (LEGS = shoulder -> flipper tip, the tip on the ground)."""
import sys, numpy as np
import shell_common as C
from shell_common import cone, ell, su, ss, V3
S = C.base(); S.ANT = False
S.SC, S.SR = V3(0, .270, -.12), V3(.44, .25, .62)
S.HC = C.HC0 + V3(0, -.020, .130)
S.LEGS = [((.220, .255, .230), (.600, .050, .080)), ((.200, .240, -.380), (.370, .050, -.640))]
S.BOUNDS = (V3(-.72, -.033, -1.0), V3(.72, .70, .88)); C.scutes(S, vz=(-.36, .00, .32), cx=.26, cz=(-.34, -.02, .28), mk=9, my=.28)
def dome(M):
    d = ss(ell(M, S.SC, S.SR), M[..., 1] - .232, .03)
    d = su(d, ell(M, S.SC + V3(0, 0, -.20), (.30, .18, .45)), .10)                                         # the teardrop: tapering long to the rear
    return d + .007 * np.exp(-(S.scute_gap(M) / .012) ** 2) * (M[..., 1] > .28)
def rim(M): return ell(M, (0, .262, S.SC[2] - .02), (.455, .030, .64))
def plastron(M): return ell(M, (0, .225, -.10), (.34, .085, .52))
def neck(M): return cone(M, (0, .300, .200), (0, .400, .530), .118, .108)
def blade(M, pts, rads, flat):
    d = 9
    for i in range(len(pts) - 1):
        for t in np.linspace(0, 1, 6):
            c = pts[i] + (pts[i + 1] - pts[i]) * t; r = rads[i] + (rads[i + 1] - rads[i]) * t; d = np.minimum(d, ell(M, c, (r, r * flat, r)))
    return d
FORE = [V3(.200, .260, .230), V3(.380, .190, .250), V3(.520, .100, .170), V3(.600, .035, .080)]
HIND = [V3(.180, .240, -.360), V3(.300, .140, -.520), V3(.370, .035, -.640)]
def legs(M):
    return np.minimum(su(cone(M, FORE[0], FORE[1], .085, .075), blade(M, FORE[1:], [.085, .095, .040], .38), .05),
                      su(cone(M, HIND[0], HIND[1], .075, .060), blade(M, HIND[1:], [.070, .040], .40), .04))
def claws(M): return np.full(M.shape[:-1], 9.)
def tail(P): return cone(P, (0, .210, -.640), (0, .160, -.780), .050, .018)
S.dome, S.rim, S.plastron, S.neck, S.legs, S.claws, S.tail = dome, rim, plastron, neck, legs, claws, tail
S.SKIN, S.SHELLC, S.GROOVE, S.PLAST, S.CLAWC, S.BLUSH = map(S.C8, ('#58c4b4', '#36a69c', '#1f7a76', '#cdeedd', '#9ee6d8', '#8fdcc8')); S.HEADC = S.SKIN
SPOT = S.C8('#b8f0e2'); rng = np.random.default_rng(5)
SP = np.vstack([np.array(p) + (np.array(q) - np.array(p)) * t + rng.normal(0, .03, 3) for p, q in ((FORE[1], FORE[3]), (HIND[1], HIND[2])) for t in rng.uniform(0, 1, 14)])
S.PAL = [S.PLAST, S.SHELLC, S.GROOVE, S.CLAWC, S.BLUSH, SPOT]
_classes = S.classes
def classes(V):
    out = _classes(V); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; lg = S.legs(M)
    out.append(np.where((lg < np.minimum(S.dome(M), S.neck(M))) & (V[:, 1] > .06), .016 - np.min(np.linalg.norm(M[:, None] - SP, axis=-1), -1), -.05)); return out
S.classes = classes
C.eye_palette(S, rim=(14, 30, 60), iris=(40, 96, 176), hi2=(200, 236, 255))
SWIRL = (170, 238, 222)
def runes():
    """a flowing curl per scute (an Archimedean spiral on the shell surface) + one long wave line down each side"""
    parts = []
    for c in S.SCUTES:
        for s in ((1,) if c[0] == 0 else (1, -1)):
            p = C.shell_pt(S, V3(c[0] * s, c[1], c[2])); n, t1, t2 = S.frame(p); a = np.linspace(0, 3.2 * np.pi, 40); r = .012 + .060 * a / a[-1]
            tg = p + r[:, None] * (np.cos(s * a)[:, None] * t1 + np.sin(s * a)[:, None] * t2); Q = S.ray(np.tile(S.SC, (40, 1)), (tg - S.SC) / np.linalg.norm(tg - S.SC, axis=1, keepdims=True), 1.5)
            parts.append(S.strip(Q, SWIRL, .0058, .0035))
    for s in (1, -1):
        z = np.linspace(.30, -.60, 40); tg = np.c_[s * (.36 + .025 * np.sin(z * 14)), np.full(40, .36), S.SC[2] + z]; Q = S.ray(np.tile(S.SC, (40, 1)), (tg - S.SC) / np.linalg.norm(tg - S.SC, axis=1, keepdims=True), 1.5)
        parts.append(S.strip(Q, SWIRL, .0050, .0035))
    return parts
S.runes = runes
if __name__ == '__main__': C.build(S, sys.argv[1])
