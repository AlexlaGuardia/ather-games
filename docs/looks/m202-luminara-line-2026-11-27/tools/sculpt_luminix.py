"""M202 LUMINIX (Luminara's Water form; locked art athernyx assets/stage2/031-luminix.png, looked at, never traced, never in this repo).
python sculpt_luminix.py <out.glb>. Starts from the base Luminara (lum_common.base()); what is HERS, not the base's:
  a round WATER drop of a body (head and abdomen one ball, no waist), teal, paler down the front; a curling wave FIN on the crown and a
  small one behind it; side fins and lower fins in place of wings (thin, beating like a swimmer's); two pointed fin-feet below; pale
  water swirls flowing over her (unlit strips); BUBBLES on her and in her big pale belly lamp; no antennae; dark teal eyes."""
import sys, numpy as np
import lum_common as C
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
S.LEG = ((.130, .120, .060), (.175, -.040, .110)); S.FOOTL = V3(.180, -.048, .114)
def arms(M): return su(cone(M, S.ARM[0], S.ARM[1], .040, .030), ell(M, S.HAND, (.032, .028, .032)), .012)
def legs(M): return cone(M, S.LEG[0], S.LEG[1], .075, .010)                                          # pointed fin-feet
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(abdomen(M), thorax(M), .12); d = su(d, head(M), .12); d = su(d, legs(M), .05); return su(d, arms(M), .03)
S.head, S.thorax, S.abdomen, S.arms, S.legs, S.field = head, thorax, abdomen, arms, legs, field
TEAL, TEAL_L, TEAL_D, FACE, LIMB = map(S.C8, ('#47aab6', '#86d2d4', '#2f8696', '#9edcd8', '#3c98a8'))
S.GOLD, S.FACE, S.HEADC = TEAL, FACE, FACE
def classes(V):
    M, ab, hd, tx, ar, lg = C.regions(S, V); core = np.minimum(np.minimum(ab, hd), tx); body = core < np.minimum(ar, lg) - .004
    front = (V[:, 2] - .12) - .5 * np.abs(V[:, 0]); back = (-.05 - V[:, 2]) + .25 * (V[:, 1] - .4)
    return [np.where(body, np.clip(back, -.05, .05), -.05), np.where(body & (M[:, 1] < .55), np.clip(front, -.05, .05), -.05),
            C.face(S, M, hd, ab, .19, .60, .14, .25), np.where(np.minimum(ar, lg) < core - .002, .02, -.05)]
S.classes = classes; S.PAL = [TEAL_D, TEAL_L, FACE, LIMB]
S.ANT = False
S.MEMB, S.VEIN, S.RIM = (92, 186, 198), (156, 224, 230), (52, 140, 160)
S.REMAP = {C.EYE_LIT['rim']: (22, 62, 74), C.EYE_LIT['iris']: (44, 122, 142), C.EYE_LIT['pupil']: (12, 30, 40), C.EYE_LIT['blush']: (238, 214, 128)}
S.WROOT = {'f': V3(.270, .440, -.020), 'h': V3(.230, .230, -.120)}
S.WINGS = {'f': (S.WROOT['f'], *S.wdir(-.35, .3, .25), .24, .13), 'h': (S.WROOT['h'], *S.wdir(-.75, .3, .70), .20, .11)}
def wing_outline(L, W, k=30):
    th = np.linspace(0, 2 * np.pi, k, endpoint=False); s = L * (.5 - .5 * np.cos(th)); t = W * np.sin(th) * (1 - s / L) ** .8 * 1.2   # a fin: broad at the root, pointed
    return np.c_[s, t]
S.wing_outline = wing_outline
S.LAMP_R = .22; S.LAMP_U = V3(0, -.30, 1.); S.LAMP_COLS = ((170, 236, 240), (206, 246, 246), (238, 255, 250))
SWIRL, BUB, BUBHI = (176, 238, 242), (224, 250, 255), (250, 255, 255)
S.DECO = [SWIRL, BUB, BUBHI]
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
    return parts
S.deco = deco
if __name__ == '__main__': C.build(S, sys.argv[1])
