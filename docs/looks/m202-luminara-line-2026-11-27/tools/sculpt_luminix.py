"""M202 LUMINIX v2, the EGG form (Luminara's Water form; locked art athernyx assets/stage2/031-luminix.png, looked at, never traced, never in
this repo). Alex 11-28: she loses her flight, "like it turned into an egg form before awakening". python sculpt_luminix.py <out.glb>.
Starts from the base Luminara (lum_common.base()); what is HERS, not the base's:
  a round WATER-DROP EGG of a body (head and abdomen one ball, no waist), teal, paler down the front, the shell cut into soft water PLATES
  (deeper teal seams); a curling wave FIN on the crown and a small one behind it (head fins, not wings); NO wings, no wing fins, no arms, no
  antennae (lum_egg.wingless); a pale aqua HATCH LINE glowing round her (where she will break out); pale water swirls and BUBBLES on her
  and in her big pale belly lamp; two short pointed feet to waddle on; dark teal eyes. Grounded: rig_lum_ground.py."""
import sys, numpy as np
import lum_common as C, lum_egg as G
from lum_common import cone, ell, su, V3
S = C.base(); S.TRIS = 9500
S.HC, S.HR = V3(0, .63, .18), V3(.245, .235, .235)
S.AC, S.AR_ = V3(0, .37, -.02), V3(.315, .315, .315); C.axis(S, (0, .9, .44))
S.EBC = V3(.100, .655, .330)
S.BOUNDS = (V3(-.40, -.10, -.38), V3(.40, 1.06, .50))
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, (0, .58, .24), (.21, .14, .17)), .06)
    d = su(d, cone(M, (0, .80, .06), (0, .99, .02), .075, .012), .05); return su(d, cone(M, (0, .74, -.10), (0, .85, -.21), .055, .010), .04)   # the crown fin + the one behind
def thorax(M): return ell(M, (0, .47, .06), (.22, .16, .20))
def abdomen(M): q = S.aq(M); return ell(q, (0, 0, 0), S.AR_)
S.ARM = ((.240, .420, .040), (.300, .380, .060)); S.HAND = V3(.305, .375, .062)
S.LEG = ((.130, .110, .060), (.150, -.010, .090)); S.FOOTL = V3(.152, -.020, .100)
def arms(M): return su(cone(M, S.ARM[0], S.ARM[1], .040, .030), ell(M, S.HAND, (.032, .028, .032)), .012)
def legs(M): return su(cone(M, S.LEG[0], S.LEG[1], .085, .030), ell(M, S.FOOTL + V3(0, .008, .01), (.045, .030, .060)), .03)   # short stubby feet, a point to the toe
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(abdomen(M), thorax(M), .14); d = su(d, head(M), .14); return su(d, legs(M), .05)
S.head, S.thorax, S.abdomen, S.arms, S.legs, S.field = head, thorax, abdomen, arms, legs, field; G.wingless(S)
PLATE_C, PLATE_U = V3(0, .42, .0), G.seeds(14, 21)
TEAL, TEAL_L, TEAL_D, FACE, LIMB, SEAM = map(S.C8, ('#47aab6', '#86d2d4', '#2f8696', '#9edcd8', '#3c98a8', '#246c7c'))
S.GOLD, S.FACE, S.HEADC = TEAL, FACE, FACE
def classes(V):
    M, ab, hd, tx, ar, lg = C.regions(S, V); core = np.minimum(np.minimum(ab, hd), tx); body = core < np.minimum(ar, lg) - .004
    front = (V[:, 2] - .12) - .5 * np.abs(V[:, 0]); back = (-.05 - V[:, 2]) + .25 * (V[:, 1] - .4)
    return [np.where(body, np.clip(back, -.05, .05), -.05), np.where(body & (M[:, 1] < .55), np.clip(front, -.05, .05), -.05),
            np.where(body & (V[:, 1] > .02), G.plates(V, PLATE_C, PLATE_U, .035), -.05),
            C.face(S, M, hd, ab, .19, .60, .14, .25), np.where(np.minimum(ar, lg) < core - .002, .02, -.05)]
S.classes = classes; S.PAL = [TEAL_D, TEAL_L, SEAM, FACE, LIMB]
S.ANT = False
S.MEMB, S.VEIN, S.RIM = (92, 186, 198), (156, 224, 230), (52, 140, 160)
S.REMAP = {C.EYE_LIT['rim']: (22, 62, 74), C.EYE_LIT['iris']: (44, 122, 142), C.EYE_LIT['pupil']: (12, 30, 40), C.EYE_LIT['blush']: (238, 214, 128)}
S.LAMP_R = .22; S.LAMP_U = V3(0, -.30, 1.); S.LAMP_COLS = ((170, 236, 240), (206, 246, 246), (238, 255, 250))
SWIRL, BUB, BUBHI, HATCH = (176, 238, 242), (224, 250, 255), (250, 255, 255), (200, 255, 248)
S.DECO = [SWIRL, BUB, BUBHI, HATCH]
def deco():
    parts = []; rng = np.random.default_rng(9); c = V3(0, .45, .02)
    for k in range(7):                                                                                       # water swirls flowing over her
        az0 = rng.uniform(-np.pi, np.pi); t = np.linspace(0, 1, 26); az = az0 + 1.6 * t; el = -.6 + 1.5 * t + .25 * np.sin(t * 7 + k)
        U = np.c_[np.sin(az) * np.cos(el), np.sin(el), np.cos(az) * np.cos(el)]
        keep = ~((U[:, 2] > .55) & (U[:, 1] > .05))                                                          # not over her face / lamp
        if keep.sum() < 6: continue
        Q = S.ray(c, U[keep], 1.2); parts.append(S.strip(Q, SWIRL, .0055, .004))
    for k in range(22):                                                                                      # bubbles on her skin
        u = rng.standard_normal(3); u /= np.linalg.norm(u)
        if u[2] > .5 and u[1] > -.2: continue
        p = S.ray(c, u[None], 1.2)[0]; r = rng.uniform(.012, .028); parts.append(S.ball(p, V3(r, r, r), BUB, 6, 10)); parts.append(S.ball(p + V3(-.3, .4, .5) * r * .5, V3(r, r, r) * .3, BUBHI, 4, 6))
    lp = S.ray(S.AC, (S.LAMP_U / np.linalg.norm(S.LAMP_U))[None], .7)[0]; n, t1, t2 = S.frame(lp)              # bubbles in the lamp
    for k, (a, b, r) in enumerate(((-.07, .06, .028), (.06, -.04, .022), (.02, .10, .014), (-.03, -.11, .034), (.10, .07, .012))):
        q = lp + a * t1 + b * t2; q = S.ray(S.AC, ((q - S.AC) / np.linalg.norm(q - S.AC))[None], .8)[0] + n * .042; parts.append(S.ball(q, V3(r, r, r * .5), BUB, 6, 10))
    parts += G.crack(S, V3(0, .44, .0), .02, .06, HATCH, lambda a: abs(a) < .9, n=11, seed=6)              # the hatch line, a gap over her lamp
    return parts
S.deco = deco
if __name__ == '__main__': C.build(S, sys.argv[1])
