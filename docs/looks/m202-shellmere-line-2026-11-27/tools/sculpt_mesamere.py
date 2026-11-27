"""M202 MESAMERE (Shellmere's Earth form, her natural affinity; locked art athernyx assets/stage2/007-mesamere.png, looked at, never traced,
never in this repo). python sculpt_mesamere.py <out.glb>. Starts from the base Shellmere (shell_common.base()); what is HERS, not the base's:
  a great old stone tortoise: a much TALLER, broader dome of heavy stone plates (seams cut deep), a thick flared lip with MOSS lumps along it,
  a glowing amber CRYSTAL set in the crown of the shell (the art's top glow), warm golden skin, thick pillar legs with plated scales and
  pale claws, brown eyes, NO antennae (the art has none). Dial 1.5 (the heaviest of the line)."""
import sys, numpy as np
import shell_common as C
from shell_common import cone, ell, su, ss, V3
S = C.base(); S.ANT = False
S.SC, S.SR = V3(0, .300, -.08), V3(.50, .56, .55)
S.LEGS = [((.240, .265, .240), (.355, .062, .350)), ((.240, .245, -.320), (.355, .062, -.415))]
S.BOUNDS = (V3(-.68, -.033, -.82), V3(.68, 1.02, .76)); C.scutes(S, vz=(-.30, .02, .32), cx=.31, cz=(-.30, .02, .30), mk=9, my=.31)
def dome(M):
    d = ss(ell(M, S.SC, S.SR), M[..., 1] - .262, .03); g = S.scute_gap(M)
    return d + .019 * np.exp(-(g / .017) ** 2) * (M[..., 1] > .30) - .010 * np.clip(g / .09, 0, 1) * (M[..., 1] > .34)   # deep seams, slab faces bulge
rng = np.random.default_rng(7); _t = np.linspace(.08, np.pi - .05, 16)
MOSS = np.array([(.985 * .56 * np.sin(t) + rng.normal(0, .01), .335 + rng.normal(0, .015), S.SC[2] + .985 * .61 * np.cos(t)) for t in _t] +
                [(.48 * np.sin(t), .40 + rng.normal(0, .02), S.SC[2] + .53 * np.cos(t)) for t in _t[::2] + .1])
MR = rng.uniform(.040, .060, len(MOSS))
def moss(M): return np.min(np.linalg.norm(M[..., None, :] - MOSS, axis=-1) - MR, -1)
def rim(M): return su(ell(M, (0, .305, S.SC[2]), (.56, .062, .61)), moss(M), .02)
def plastron(M): return su(ell(M, (0, .240, -.060), (.38, .12, .46)), ell(M, (0, .255, .230), (.25, .11, .16)), .05)
def legs(M):
    d = 9
    for a, b in S.LEGS:
        a, b = V3(*a), V3(*b); d = np.minimum(d, cone(M, a, b + V3(0, .030, 0), .128, .112))
        d = su(d, ell(M, b + V3(.006, -.017, .012), (.118, .046, .122)), .03)
        for t in (-.6, 0, .6): d = su(d, ell(M, b + V3(.075 * np.sin(t) + .012, -.030, .100 * np.cos(t)), (.036, .032, .036)), .014)
    return d
def claws(M):
    d = 9
    for a, b in S.LEGS:
        b = V3(*b)
        for t in (-.6, 0, .6): d = np.minimum(d, ell(M, b + V3(.090 * np.sin(t) + .014, -.034, .124 * np.cos(t)), (.022, .019, .022)))
    return d
S.dome, S.rim, S.plastron, S.legs, S.claws = dome, rim, plastron, legs, claws
S.SKIN, S.SHELLC, S.GROOVE, S.PLAST, S.CLAWC, S.BLUSH = map(S.C8, ('#dba650', '#ab9c78', '#5e5340', '#f4c35c', '#efe4c8', '#eba870')); S.HEADC = S.SKIN
MOSSC, PLATE = S.C8('#7cae48'), S.C8('#9a6830')
LP = rng.normal(0, 1, (260, 3))
_classes = S.classes
def classes(V):
    out = _classes(V); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]
    out.append(np.where(V[:, 1] > .29, np.clip(.012 - (np.min(np.linalg.norm(M[:, None] - MOSS, axis=-1) - MR, -1)), -.05, .05), -.05))   # moss
    lg = S.legs(M); other = np.minimum(np.minimum(S.dome(M), S.rim(M)), np.minimum(S.head(M), S.plastron(M)))
    P = np.vstack([np.array(a) + (np.array(b) - np.array(a)) * t for a, b in S.LEGS for t in np.linspace(0, 1, 6)]); pts = P[np.arange(len(LP)) % len(P)] + LP * .10
    dd = np.sort(np.linalg.norm(M[:, None] - pts, axis=-1), -1); g = dd[:, 1] - dd[:, 0]
    out.append(np.where((lg < other) & (V[:, 1] > .07) & (V[:, 1] < .27), .007 - g, -.05))                                            # leg plate seams
    return out
S.classes = classes; S.PAL = [S.PLAST, S.SHELLC, S.GROOVE, S.CLAWC, S.BLUSH, MOSSC, PLATE]
C.eye_palette(S, rim=(40, 26, 14), iris=(120, 76, 36), hi2=(240, 214, 170))
def runes():
    """her crown crystal (the art's top glow): a tapered six-sided amber crystal and two small ones, set into the top of the dome"""
    top = C.shell_pt(S, S.SC + V3(0, 1, .02)); parts = []
    for off, hgt, r in ((V3(0, 0, 0), .17, .068), (V3(.06, -.012, -.035), .075, .030), (V3(-.05, -.012, .04), .065, .026)):
        b = top + off - V3(0, .02, 0); a = np.arange(6) / 6 * 2 * np.pi
        P = np.vstack([b + np.c_[r * np.cos(a), np.zeros(6), r * np.sin(a)], b + V3(0, hgt * .75, 0) + np.c_[r * .8 * np.cos(a), np.zeros(6), r * .8 * np.sin(a)], [b + V3(0, hgt, 0)]])
        parts.append(C.hull_part(P, (255, 214, 118)))
    return parts
S.runes = runes
if __name__ == '__main__': C.build(S, sys.argv[1])
