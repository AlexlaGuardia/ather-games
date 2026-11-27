"""M202 AURMERE (Shellmere's Mana form; locked art athernyx assets/stage2/020-aurmere.png, looked at, never traced, never in this repo).
python sculpt_aurmere.py <out.glb>. Starts from the base Shellmere (shell_common.base()); what is HERS, not the base's:
  a high round VIOLET dome (a near half-sphere, taller and rounder than the base's, a slim lip), the canon shell rune-light grown over the
  whole shell: the base's gold ring + inner ring + spokes + centre dot on EVERY scute, the marginals too, and a gold ring on each foreleg
  (rings only, no invented glyphs); slate-blue skin, a glowing amber plastron, LONGER antennae with bigger gold bulbs, big dark eyes."""
import sys, numpy as np
import shell_common as C
from shell_common import cone, ell, su, ss, V3
S = C.base()
S.SC, S.SR = V3(0, .300, -.07), V3(.45, .50, .48)
S.AB, S.AT = V3(.062, .600, .505), V3(.185, 1.06, .455)
S.LEGS = [((.220, .265, .240), (.335, .062, .345)), ((.220, .245, -.300), (.330, .062, -.380))]
S.BOUNDS = (V3(-.56, -.033, -.70), V3(.56, .86, .74)); C.scutes(S, vz=(-.26, .02, .29), cx=.27, cz=(-.27, .02, .28), mk=9, my=.33)
def rim(M): return ell(M, (0, .300, S.SC[2]), (.475, .040, .50))
S.rim = rim
S.SKIN, S.SHELLC, S.GROOVE, S.PLAST, S.CLAWC, S.BLUSH = map(S.C8, ('#9fb1d6', '#8a72c6', '#52408e', '#f2b860', '#eee8f8', '#c8a8e0')); S.HEADC = S.SKIN
S.PAL = [S.PLAST, S.SHELLC, S.GROOVE, S.CLAWC, S.BLUSH]
S.RUNE, S.BULB, S.STALK = (246, 204, 92), (255, 210, 96), (196, 178, 236)
C.eye_palette(S, rim=(20, 22, 44), iris=(52, 60, 120), hi2=(214, 214, 255))
_runes = S.runes
def ring(p, r, wd):
    n, t1, t2 = S.frame(p); a = np.arange(28) / 28 * 2 * np.pi; tg = p + r * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2)
    return S.strip(S.ray(S.SC, (tg - S.SC) / np.linalg.norm(tg - S.SC, axis=1, keepdims=True), 1.5), S.RUNE, wd, closed=True)
def runes():
    parts = _runes()                                                                         # the base's rings, on her scutes (re-seated by C.scutes)
    for c in [m for m in S.MARG if m[0] > .2]:                                                                 # + a small ring + dot on each marginal (mirrored)
        for s in (1, -1):
            cc = V3(c[0] * s, c[1] + .03, c[2]); p = C.shell_pt(S, cc); n, t1, t2 = S.frame(p); parts += [ring(p, .040, .0055), S.disc(p, n, t1, t2, .010, S.RUNE)]
    for s in (1, -1):                                                                        # a gold ring on the outer face of each foreleg
        a, b = np.array(S.LEGS[0][0]), np.array(S.LEGS[0][1]); c = (a + (b - a) * .45) * V3(s, 1, 1); u = V3(s, .1, .45); u /= np.linalg.norm(u); p = S.ray(c, u, .4)[0]
        n, t1, t2 = S.frame(p); k = np.arange(24) / 24 * 2 * np.pi; Q = p + .042 * (np.cos(k)[:, None] * t1 + np.sin(k)[:, None] * t2); Q = Q - S.grad(Q, 3e-3) * S.field(Q)[:, None]
        parts += [S.strip(Q, S.RUNE, .0055, closed=True), S.disc(p, n, t1, t2, .012, S.RUNE)]
    return parts
S.runes = runes
if __name__ == '__main__': C.build(S, sys.argv[1])
