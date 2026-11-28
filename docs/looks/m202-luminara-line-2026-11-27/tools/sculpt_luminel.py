"""M202 LUMINEL (Luminara's Mana form; locked art athernyx assets/stage2/010-luminel.png, looked at, never traced, never in this repo).
python sculpt_luminel.py <out.glb>. Starts from the base Luminara (lum_common.base()); what is HERS, not the base's:
  an upright GEM of a body: the abdomen hangs straight under her, egg-round on top and drawn to a point below, cut in diamond facets
  (two violets); violet all over (hood and back a deeper violet), the cream face kept; a violet crystal on the brow; violet antennae
  with violet knobs; broad rounded wings of pale aqua with GOLD veins and a violet rim; a bigger lamp; GOLD flowing infusion markings
  on each flank (leaf-shaped loops, a curl inside; infusion pattern only, never a rune or sigil, Magii 0d6d577); lilac eyes."""
import sys, numpy as np
import lum_common as C
from lum_common import cone, ell, su, V3
S = C.base(); S.TRIS = 9500
S.AC, S.AR_ = V3(0, .27, -.06), V3(.240, .240, .29); C.axis(S, (0, .93, .37))
S.BOUNDS = (V3(-.32, -.16, -.40), V3(.32, .93, .46))
TIP = S.AC - S.AX * .40
def abdomen(M):
    q = S.aq(M); d = ell(q, (0, 0, 0), S.AR_)
    return su(d, cone(M, S.AC - S.AX * .12, TIP, .17, .02), .09)                               # drawn to a point below
S.abdomen = abdomen
VIO, VIO_L, VIO_D, FACE, LIMB = map(S.C8, ('#8466c4', '#a78ae2', '#5f4498', '#fdf0de', '#7458b4'))
S.GOLD, S.FACE, S.HEADC = VIO, FACE, FACE
def classes(V):
    M, ab, hd, tx, ar, lg = C.regions(S, V); q = S.aq(M); th = np.arctan2(q[:, 0], q[:, 1]); z = q[:, 2]
    fac = np.sin(5 * th + 15 * z) * np.sin(5 * th - 15 * z)                                    # diamond facets
    core = np.minimum(np.minimum(ab, hd), tx)
    dors = np.where(hd < np.minimum(ab, tx), (M[:, 1] - .70) + .25 * (-M[:, 2] + .10), -1)       # the hood
    return [np.where((ab < np.minimum(hd, tx) - .004) & (core < np.minimum(ar, lg)), np.clip(.02 * fac, -.05, .05), -.05),
            np.clip(np.where(core < np.minimum(ar, lg), dors, -.05), -.05, .05),
            C.face(S, M, hd, ab), np.where(np.minimum(ar, lg) < core - .002, .02, -.05)]
S.classes = classes; S.PAL = [VIO_L, VIO_D, FACE, LIMB]
S.STALK, S.KNOBC, S.KNOBHI = (96, 70, 160), (150, 112, 216), (226, 208, 255)
S.MEMB, S.VEIN, S.RIM = (214, 238, 236), (236, 196, 92), (164, 136, 210)
S.REMAP = {C.EYE_LIT['rim']: (60, 38, 96), C.EYE_LIT['iris']: (172, 132, 214), C.EYE_LIT['pupil']: (40, 22, 64)}
S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.40, .5, .26), .52, .25), 'h': (S.WROOT['h'], *S.wdir(-.24, .5, .36), .40, .19)}
def wing_outline(L, W, k=30):
    th = np.linspace(0, 2 * np.pi, k, endpoint=False); s = L * (.5 - .5 * np.cos(th)); t = W * np.sin(th) * (s / L) ** .30 * (1.05 - .15 * s / L)   # broad, rounded
    return np.c_[s, t]
S.wing_outline = wing_outline
S.LAMP_R = .19; S.LAMP_U = V3(0, -.05, 1.); S.LAMP_COLS = ((255, 206, 110), (255, 232, 160), (255, 250, 226))
GOLDM, GEM, GEMHI = (234, 186, 70), (176, 140, 236), (236, 222, 255)
S.DECO = [GOLDM, GEM, GEMHI]
def deco():
    parts = []; c = S.AC.copy()
    for sx in (1, -1):                                                                                     # the flank markings: a leaf loop + a curl inside
        t = np.linspace(0, 2 * np.pi, 40); lp = np.c_[sx * (.20 + 0 * t), .30 + .12 * np.cos(t), -.02 + .045 * np.sin(t) * (1 + .4 * np.cos(t))]
        Q = C.onsurf(S, c, lp); parts.append(S.strip(Q, GOLDM, .0060, .004, closed=True))
        u = np.linspace(0, 1.6 * np.pi, 16); cu = np.c_[sx * (.21 + 0 * u), .30 + .05 * np.cos(u) * (1 - u / 7), -.02 + .025 * np.sin(u)]
        parts.append(S.strip(C.onsurf(S, c, cu), GOLDM, .0045, .004))
        for k, (y, z) in enumerate(((.10, .10), (.13, -.12))):                                             # small gold flecks low on the gem
            p = C.onsurf(S, c, [(sx * .14, y, z)])[0]; n, t1, t2 = S.frame(p); parts.append(S.disc(p, n, t1, t2, .022, GOLDM, .004, 9))
    p = S.ray(S.HC, (V3(0, .62, .78) / np.linalg.norm(V3(0, .62, .78)))[None], .5)[0]; n = S.grad(p[None], 3e-3)[0]   # the brow crystal
    parts.append(C.crystal(p - n * .01, n + V3(0, .4, 0), .030, .075, GEM, 6, .02)); parts.append(C.crystal(p + n * .02 + V3(-.008, .012, 0), n, .007, .016, GEMHI, 4))
    return parts
S.deco = deco
if __name__ == '__main__': C.build(S, sys.argv[1])
