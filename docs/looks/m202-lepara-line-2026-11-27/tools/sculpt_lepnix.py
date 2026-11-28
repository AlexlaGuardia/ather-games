"""M202 LEPNIX (Lepara's Water form; the grimoire's UNICORN divergence, grimoire-ledger #33: "water Lepara branches rabbit -> aqua
unicorn foal w/ horn + water-mane"; locked art athernyx assets/stage2/033-lepnix.png, looked at, never traced, never in this repo).
    python sculpt_lepnix.py <out.glb>
She keeps the BASE Lepara's head, face, eyes, snout and twitchy nose BY NAME (lep_common.base(): the base module, fresh) and gets her
own body: a foal STANDING on four long slim legs with small hooves, a level trunk set behind the head, an arched neck, a single horn
on her brow, a flowing water-mane down the neck + a forelock, smaller pointed ears, a long plume tail. Aqua coat, paler belly, pale
bubble rings on the haunches + legs (the art's spots), a cyan drop gem on her chest. Part names stay the base's so its rig masks
hold: arms = her FORELEGS, feet = her lower HIND legs + hooves, body = trunk + neck + thighs; rig_lep.py moves the joints for her."""
import sys, os, numpy as np
import lep_common as C
from lep_common import cone, ell, su, ss, V3
S = C.base()
S.EA = .30; S.EC = V3(.150, .800, -.030); S.ER = np.c_[[np.cos(S.EA), -np.sin(S.EA), 0], [np.sin(S.EA), np.cos(S.EA), 0], [0, 0, 1]]
def ears(M):                                                                                  # smaller, pointed foal ears
    d = ell(M, S.EC, (.058, .120, .030), S.ER)
    return ss(d, -ell(M, S.EC + S.ER @ V3(0, .010, .022), (.038, .092, .018), S.ER), .007)
S.ears = ears
FL = ((.085, .330, -.020), (.080, .170, .000), (.082, .030, .010))                            # foreleg: shoulder, knee, hoof (M = |x|)
HL = ((.095, .300, -.300), (.090, .150, -.330), (.088, .030, -.300))                          # hind leg: hip, hock, hoof
def leg(M, P, r):
    d = cone(M, P[0], P[1], r[0], r[1]); d = su(d, cone(M, P[1], P[2], r[1], r[2]), .02)
    return su(d, ell(M, (P[2][0], .026, P[2][2] + .008), (.036, .030, .040)), .015)            # the little hoof
S.arms = lambda M: leg(M, FL, (.048, .036, .032))
S.feet = lambda M: su(cone(M, HL[1], HL[2], .036, .032), ell(M, (HL[2][0], .026, HL[2][2] + .008), (.037, .030, .041)), .015)
def body(M):
    d = ell(M, (0, .350, -.160), (.135, .120, .230))                                          # the level trunk, behind the head
    d = su(d, ell(M, (0, .345, -.020), (.120, .110, .110)), .06)                               # chest
    d = su(d, cone(M, (0, .380, -.030), (0, .490, .020), .085, .075), .05)                     # the arched neck up into the head
    d = su(d, ell(M, (.085, .310, -.290), (.060, .095, .085)), .04)                            # thighs
    d = su(d, cone(M, HL[0], HL[1], .052, .038), .03)                                          # upper hind leg
    return su(d, C.gem(M, *CHEST), .004)
CHEST = ((0, .335, .095), (0, 1, -.1), (0, .1, 1), .034, .022)
S.body = body
MANE = [((.0, .715, -.020), (.060, .600, -.150), .062, .024), ((.0, .650, -.090), (.065, .520, -.200), .060, .022),
        ((.0, .570, -.125), (.060, .450, -.220), .056, .020), ((.0, .490, -.155), (.050, .390, -.230), .050, .016)]
def mane(M):
    d = np.full(M.shape[:-1], 9.)
    for a, b, ra, rb in MANE: d = np.minimum(d, cone(M, a, b, ra, rb))
    return su(d, cone(M, (.0, .730, .060), (.060, .660, .150), .040, .012), .02)              # the forelock, swept to one side of the horn
HORN = ((0, .700, .140), (0, .885, .225))
_head = S.head
def head(M):
    d = su(_head(M), mane(M), .03)
    return su(d, cone(M, HORN[0], HORN[1], .030, .004), .012)
S.head = head
TP = [V3(0, .400, -.370), V3(0, .430, -.440), V3(0, .380, -.520), V3(0, .290, -.560), V3(0, .200, -.540)]
TR = [.050, .068, .072, .060, .030]
def tail(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b, ra, rb in zip(TP[:-1], TP[1:], TR[:-1], TR[1:]): d = np.minimum(d, cone(P, a, b, ra, rb))
    return d
S.tail = tail
S.BOUNDS = (V3(-.34, -.033, -.66), V3(.34, 1.0, .40))
S.CREAM, S.HEADC, S.BELLY, S.EARIN, S.BILLC, S.BLUSH = map(S.C8, ('#78d2d4', '#80d8da', '#c4f0ee', '#f0b4b0', '#d4f6f4', '#e8b4c0'))
MANEC, HORNC, HOOF, SPOT, GEM = map(S.C8, ('#3fb0c0', '#eefcfa', '#3a8f9c', '#d4fbf8', '#7ff0ff'))
C.eye_palette(S, rim=(26, 70, 96), iris=(70, 150, 190))
_classes = S.classes
def classes(V):
    out = _classes(V); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; X, Y, Z = M.T
    out.append(np.clip(np.minimum(_head(M), S.body(M)) - mane(M) - .002, -.05, .05))            # the mane (darker teal)
    hn = cone(M, HORN[0], HORN[1], .030, .004); out.append(np.where(Y > .69, np.clip(-hn + .003, -.05, .05), -.05))   # the horn
    out.append(np.where(Y < .06, .05, -.05))                                                   # hooves
    # bubble rings: small pale circles scattered over haunch + legs (a ring, not a dot: the art's spots)
    rng = np.random.default_rng(33); cs = np.c_[rng.uniform(.06, .14, 26), rng.uniform(.08, .40, 26), rng.uniform(-.40, .0, 26)]
    r = np.min(np.linalg.norm(M[:, None, :] - cs[None], axis=2) - rng.uniform(.018, .030, 26)[None], 1)
    out.append(np.where((S.head(M) > .02) & (Z < .02), np.clip(.006 - np.abs(r), -.05, .05), -.05))
    out.append(np.clip(-C.gem(M, *CHEST) + .002, -.05, .05)); return out
S.classes = classes; S.PAL = [S.BELLY, S.HEADC, S.EARIN, S.BLUSH, S.BILLC, MANEC, HORNC, HOOF, SPOT, GEM]
if __name__ == '__main__': C.build(S, sys.argv[1], 10000)
