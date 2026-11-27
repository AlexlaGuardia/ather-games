"""M202 VOLTMERE (Shellmere's Storm form; locked art athernyx assets/stage2/021-voltmere.png, looked at, never traced, never in this repo).
python sculpt_voltmere.py <out.glb>. Starts from the base Shellmere (shell_common.base()); what is HERS, not the base's:
  a WIDE, low, blocky pale-blue shell: each scute a raised slab (seams cut deep and wide), a broad flared lip, white LIGHTNING forks
  crackling over the shell (unlit strips, not colour cuts: the Croakarc lesson), knobbly scaled legs with long pale claws, pale icy-blue
  skin, ice-blue eyes, NO antennae (the art has none)."""
import sys, numpy as np
import shell_common as C
from shell_common import cone, ell, su, ss, V3
S = C.base(); S.ANT = False
S.SC, S.SR = V3(0, .330, -.07), V3(.53, .37, .55)
S.LEGS = [((.250, .265, .245), (.380, .062, .345)), ((.250, .245, -.320), (.375, .062, -.400))]
S.BOUNDS = (V3(-.70, -.033, -.80), V3(.70, .76, .76)); C.scutes(S, vz=(-.30, .02, .32), cx=.32, cz=(-.30, .02, .30), mk=9, my=.33)
def dome(M):
    d = ss(ell(M, S.SC, S.SR), M[..., 1] - .262, .03); g = S.scute_gap(M)
    return d + .020 * np.exp(-(g / .020) ** 2) * (M[..., 1] > .30) - .016 * np.clip(g / .08, 0, 1) * (M[..., 1] > .33)      # raised slabs
def rim(M): return ell(M, (0, .305, S.SC[2]), (.585, .058, .60))
rng = np.random.default_rng(11); KN = []
for a, b in S.LEGS:
    for t in np.linspace(.1, .8, 5):
        for ang in np.linspace(0, 2 * np.pi, 7)[:-1] + t * 3: c = np.array(a) + (np.array(b) - np.array(a)) * t; KN.append(c + .105 * np.array([np.cos(ang), 0, np.sin(ang)]))
KN = np.array(KN)
def legs(M):
    d = 9
    for a, b in S.LEGS:
        a, b = V3(*a), V3(*b); d = np.minimum(d, cone(M, a, b + V3(0, .030, 0), .108, .088))
        d = su(d, ell(M, b + V3(.006, -.017, .012), (.100, .048, .104)), .03)
        for t in (-.55, 0, .55): d = su(d, ell(M, b + V3(.060 * np.sin(t) + .010, -.030, .084 * np.cos(t)), (.032, .029, .032)), .014)
    return su(d, np.min(np.linalg.norm(M[..., None, :] - KN, axis=-1), -1) - .024, .02)                                             # knobbly scales
def claws(M):
    d = 9
    for a, b in S.LEGS:
        b = V3(*b)
        for t in (-.55, 0, .55): q = b + V3(.070 * np.sin(t) + .012, -.036, .100 * np.cos(t)); d = np.minimum(d, cone(M, q, q + V3(.022 * np.sin(t), -.010, .040 * np.cos(t)), .019, .006))
    return d
S.dome, S.rim, S.legs, S.claws = dome, rim, legs, claws
S.SKIN, S.SHELLC, S.GROOVE, S.PLAST, S.CLAWC, S.BLUSH = map(S.C8, ('#bccde8', '#a2b9de', '#5f78a8', '#e4d4a4', '#f6f2e8', '#c8d4f0')); S.HEADC = S.SKIN
S.PAL = [S.PLAST, S.SHELLC, S.GROOVE, S.CLAWC, S.BLUSH]
C.eye_palette(S, rim=(22, 40, 70), iris=(84, 168, 232), hi2=(220, 240, 255))
BOLT = (240, 248, 255)
def runes():
    parts = []
    for k, (az, el) in enumerate([(.3, 1.3), (1.0, .9), (1.7, 1.2), (2.4, .8), (2.9, 1.1), (-.3, 1.2), (-1.1, .95), (-1.8, 1.25), (-2.5, .85), (-2.95, 1.05)]):
        a = S.SC + V3(np.sin(az) * .1, .5, np.cos(az) * .1); b = S.SC + V3(np.sin(az) * np.cos(.25 / el), .04, np.cos(az) * np.cos(.25 / el)) * V3(1, 1, 1)
        Q = C.jag(S, a, b, 5, .07, 31 + k); parts.append(S.strip(Q, BOLT, .0068, .004))
        m = Q[len(Q) // 2]; br = C.jag(S, m, m + V3(np.sin(az + .9) * .3, -.15, np.cos(az + .9) * .3), 3, .05, 61 + k); parts.append(S.strip(br, BOLT, .0050, .004))   # a fork
    return parts
S.runes = runes
if __name__ == '__main__': C.build(S, sys.argv[1])
