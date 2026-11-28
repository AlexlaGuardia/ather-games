"""M202 LUMINORE v2, the EGG form (Luminara's Earth form; locked art athernyx assets/stage2/030-luminore.png, looked at, never traced, never in
this repo). Alex 11-28: she loses her flight, "like it turned into an egg form before awakening". python sculpt_luminore.py <out.glb>.
Starts from the base Luminara (lum_common.base()); what is HERS, not the base's:
  a round STONE EGG of a body: head and abdomen one heavy egg (no waist), warm brown stone flecked darker and cut into shell PLATES (dark
  seams), a tan face with a round nose; a CROWN of amber crystals with MOSS packed round it, moss on the upper plates; NO wings, no arms, no
  antennae (lum_egg.wingless); an amber HATCH LINE glowing round her back and sides (where she will break out); two stubby feet below to
  waddle on; amber eyes; a big amber lamp in her belly. Grounded: rig_lum_ground.py."""
import sys, numpy as np
import lum_common as C, lum_egg as G
from lum_common import cone, ell, su, V3
S = C.base(); S.TRIS = 9500
S.HC, S.HR = V3(0, .64, .19), V3(.250, .235, .230)
S.AC, S.AR_ = V3(0, .32, .00), V3(.325, .315, .310); C.axis(S, (0, .96, .28))
S.EBC = V3(.100, .655, .330)
S.BOUNDS = (V3(-.40, -.10, -.38), V3(.40, .92, .50))
def head(M): return su(su(ell(M, S.HC, S.HR), ell(M, (0, .58, .24), (.22, .15, .17)), .06), ell(M, (0, .615, .43), (.040, .034, .036)), .02)   # + the round nose
def thorax(M): return ell(M, (0, .47, .06), (.22, .16, .20))
def abdomen(M): q = S.aq(M); return ell(q, (0, 0, 0), S.AR_)
S.ARM = ((.200, .420, .060), (.250, .370, .100)); S.HAND = V3(.255, .362, .105)
S.LEG = ((.110, .060, .040), (.135, .005, .085)); S.FOOTL = V3(.140, -.010, .100)
def arms(M): return su(cone(M, S.ARM[0], S.ARM[1], .045, .036), ell(M, S.HAND, (.038, .034, .038)), .015)
def legs(M): return su(cone(M, S.LEG[0], S.LEG[1], .055, .050), ell(M, S.FOOTL, (.068, .036, .078)), .03)
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(abdomen(M), thorax(M), .14); d = su(d, head(M), .16); return su(d, legs(M), .03)
S.head, S.thorax, S.abdomen, S.arms, S.legs, S.field = head, thorax, abdomen, arms, legs, field; G.wingless(S)
PLATE_C, PLATE_U = V3(0, .40, .02), G.seeds(16, 11)
STONE, FLECK, FACE, LIMB, CHIP, SEAM = map(S.C8, ('#8c5a30', '#664022', '#b88050', '#6c4224', '#c27a36', '#4a2c16'))
S.GOLD, S.FACE, S.HEADC = STONE, FACE, FACE
def classes(V):
    M, ab, hd, tx, ar, lg = C.regions(S, V); core = np.minimum(np.minimum(ab, hd), tx)
    n1 = np.sin(V[:, 0] * 41 + 1.3) * np.sin(V[:, 1] * 37 + .4) * np.sin(V[:, 2] * 43 + 2.1)
    n2 = np.sin(V[:, 0] * 23 - .7) * np.sin(V[:, 1] * 29 + 1.9) * np.sin(V[:, 2] * 19 + .3)
    body = core < np.minimum(ar, lg) - .004
    return [np.where(body, np.clip(n1 - .45, -.05, .05), -.05), np.where(body, np.clip(n2 - .55, -.05, .05), -.05),
            np.where(body & (V[:, 1] > .02), G.plates(V, PLATE_C, PLATE_U, .045), -.05),
            C.face(S, M, hd, ab, .19, .60, .14, .25), np.where(np.minimum(ar, lg) < core - .002, .02, -.05)]
S.classes = classes; S.PAL = [FLECK, CHIP, SEAM, FACE, LIMB]
S.ANT = False
S.MEMB, S.VEIN, S.RIM = (112, 70, 40), (84, 52, 30), (132, 86, 50)
S.REMAP = {C.EYE_LIT['rim']: (70, 34, 12), C.EYE_LIT['iris']: (226, 126, 40), C.EYE_LIT['pupil']: (30, 14, 6), C.EYE_LIT['blush']: (200, 110, 70)}
S.LAMP_R = .22; S.LAMP_U = V3(0, -.20, 1.); S.LAMP_COLS = ((255, 168, 60), (255, 200, 96), (255, 232, 160))
AMBER, AMBERHI, MOSS, MOSS2, HATCH = (250, 186, 56), (255, 222, 120), (112, 150, 50), (88, 128, 40), (255, 196, 84)
S.DECO = [AMBER, AMBERHI, MOSS, MOSS2, HATCH]
def deco():
    parts = []; rng = np.random.default_rng(5); c = S.HC.copy()
    for k, (az, el, s) in enumerate(((0, 1.45, 1.4), (.55, 1.2, 1.0), (-.55, 1.2, 1.0), (1.05, .95, .85), (-1.05, .95, .85), (1.55, .75, .75), (-1.55, .75, .75), (2.2, 1.0, .7), (-2.2, 1.0, .7), (3.0, 1.1, .8))):
        u = V3(np.sin(az) * np.cos(el), np.sin(el), np.cos(az) * np.cos(el)); p = S.ray(c, u[None], .6)[0]; n = S.grad(p[None], 3e-3)[0]
        parts.append(C.crystal(p - n * .02, n * .6 + V3(0, .7, 0), .045 * s, .13 * s, AMBER, 4, .03, tw=az))
    for k in range(46):                                                                                      # moss round the crown
        az = rng.uniform(-np.pi, np.pi); el = rng.uniform(.65, 1.15); u = V3(np.sin(az) * np.cos(el), np.sin(el), np.cos(az) * np.cos(el))
        if np.cos(az) > .55 and el < .95: continue                                                           # keep the face clear
        p = S.ray(c, u[None], .6)[0]; parts.append(C.blob(S, p, rng.uniform(.022, .034), MOSS if k % 3 else MOSS2, 5, 8, k))
    for sx in (1, -1):                                                                                       # moss on the upper plates (where the paddles were)
        for k in range(9):
            q = V3(sx * (.27 + rng.uniform(-.03, .03)), .50 + rng.uniform(-.06, .06), rng.uniform(-.12, .08)); p = C.onsurf(S, S.AC, [q])[0]
            parts.append(C.blob(S, p, rng.uniform(.018, .028), MOSS if k % 2 else MOSS2, 5, 8, 100 + k))
    # the hatch line: amber light through the shell round her back + sides, a gap over her lamp; a short second crack up her back
    parts += G.crack(S, V3(0, .40, .0), .02, .07, HATCH, lambda a: abs(a) < .95, n=10, seed=4)
    parts += G.crack(S, V3(0, .40, .0), .55, .06, HATCH, lambda a: False, n=2, seed=8, az0=np.pi - .45, az1=np.pi + .45)
    return parts
S.deco = deco
if __name__ == '__main__': C.build(S, sys.argv[1])
