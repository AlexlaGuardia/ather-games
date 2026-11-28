"""M244 sheet 5: LUMINEL's four AWAKENED forms (Luminok / Lumilys / Lumivex / Elhae), OWNER PREVIEW.
    python sculpt_lumaw.py <luminok|lumilys|lumivex|elhae> <out.glb>
Canon: CANON/world/spirits-species.md 'Named, the Luminara line' (Alex 11-28); art LOCKED-AFK athernyx assets/stage3/017-020 (PRIVATE, read
for shape + colour, never copied here). Each starts from the LIVE Luminel (docs/looks/m202-luminara-line-2026-11-27/tools/sculpt_luminel.py,
imported, never edited) and re-shapes her by name: a new SILHOUETTE (abdomen, thorax, limbs, wing outline) and her motif carried boldly.
Glow = her own body (no lantern, no sigil, no coins, no lure). Parts: body, eyes (unlit: crystals, markings), lamp (the base rig reads it) and
AURA = her lamp again + her motif (the look's glow part, drawn with emissive; per-colour bone in S.AURA_BONE, rig_lumaw.py)."""
import sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-luminara-line-2026-11-27/tools'))
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['LUMAW_FORM']
import lum_common as C
import sculpt_luminel as L
from lum_common import cone, ell, su, V3
from sculpt_v2 import glb, normals, cut
S = L.S; S.FORM = FORM; S.AURA = []; S.AURA_BONE = {}; S.aura_parts = lambda: []
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)

# ── extra builders ──
def torus(c, n, R, r, col, nu=64, nv=8):
    n = nz(n); t1 = nz(np.cross(n, V3(1, 0, 0) if abs(n[0]) < .9 else V3(0, 1, 0))); t2 = np.cross(n, t1)
    u, v = np.meshgrid(np.arange(nu) / nu * 2 * np.pi, np.arange(nv) / nv * 2 * np.pi, indexing='ij'); u, v = u.ravel(), v.ravel()
    ring = np.cos(u)[:, None] * t1 + np.sin(u)[:, None] * t2; P = c + ring * (R + r * np.cos(v))[:, None] + n * (r * np.sin(v))[:, None]
    F = np.array([f for i in range(nu) for j in range(nv) for a, b, cc, d in [(i * nv + j, i * nv + (j + 1) % nv, ((i + 1) % nu) * nv + j, ((i + 1) % nu) * nv + (j + 1) % nv)] for f in ((a, cc, d), (a, d, b))])
    f0 = F[0]; out = P[f0[0]] - (c + ring[f0[0]] * R)
    return P, (F if np.cross(P[f0[1]] - P[f0[0]], P[f0[2]] - P[f0[0]]) @ out > 0 else F[:, ::-1]), col
def star(c, r, col, face=V3(0, 0, 1)):
    """a four-point star: two crossed thin bipyramids in the plane facing `face`"""
    f = nz(face); a = nz(np.cross(f, V3(0, 1, 0) if abs(f[1]) < .9 else V3(1, 0, 0))); b = np.cross(f, a)
    return [C.crystal(c, a, r * .28, r, col, 4, r), C.crystal(c, b, r * .28, r, col, 4, r)]
def ribbon(Q, w, up, col):
    """a flat two-sided ribbon along path Q (widths w), its width across `up` x tangent"""
    Q = np.asarray(Q, float); T = np.gradient(Q, axis=0); B = np.cross(T, up); B /= np.linalg.norm(B, axis=1, keepdims=True); n = len(Q)
    P = np.vstack([Q + B * np.asarray(w)[:, None], Q - B * np.asarray(w)[:, None]]); F = np.array([f for i in range(n - 1) for f in ((i, n + i, n + i + 1), (i, n + i + 1, i + 1))])
    return [(P, F, col), (P.copy(), F[:, ::-1], col)]

if FORM == 'luminok':
    # CHAMPION: the armoured bruiser. Broad, heavy, a short wide faceted shield of an abdomen, a wide thorax, SIX thick spiked legs splayed
    # out, heavy gauntlet arms, short broad angular GOLD wings, a pointed crest on the brow, and her lamp a big gold disc on the belly.
    S.TRIS = 11000; S.AC, S.AR_ = V3(0, .25, -.04), V3(.330, .300, .300); C.axis(S, (0, .90, .44)); TIP = S.AC - S.AX * .34
    S.TXR = V3(.200, .160, .165); S.BOUNDS = (V3(-.62, -.16, -.42), V3(.62, .95, .50))
    def abdomen(M):
        q = S.aq(M); d = ell(q, (0, 0, 0), S.AR_); return su(d, cone(M, S.AC - S.AX * .14, TIP, .20, .03), .08)
    S.abdomen = abdomen
    LEGS = [((.13, .40, .05), (.30, .26, .16), (.42, .02, .20)), ((.16, .36, -.04), (.38, .22, -.02), (.52, -.06, -.04)), ((.13, .32, -.12), (.32, .16, -.24), (.40, -.10, -.34))]
    def legs(M):
        d = None
        for a, b, c in LEGS:
            e = su(cone(M, a, b, .050, .040), cone(M, b, c, .040, .016), .02); d = e if d is None else np.minimum(d, e)
        return d
    S.legs = legs
    def arms(M):
        d = cone(M, S.ARM[0], S.ARM[1], .052, .044); return su(d, ell(M, S.HAND, (.050, .046, .050)), .015)
    S.arms = arms
    VIO_L, VIO_D, FACE, LIMB, PLATE = map(S.C8, ('#7b5cc0', '#4f3790', '#f6e6d8', '#5c43a0', '#9a80dc'))
    S.FACE = S.HEADC = FACE; base_cls = S.classes
    def classes(V):
        k = base_cls(V); M, ab, hd, tx, ar, lg = C.regions(S, V)
        plate = np.where((tx < np.minimum(ab, hd)) & (M[:, 2] < .06), .02, -.05)                 # a paler armour plate over the shoulders
        return k + [plate]
    S.classes = classes; S.PAL = [VIO_L, VIO_D, FACE, LIMB, PLATE]
    S.MEMB, S.VEIN, S.RIM = (246, 212, 92), (214, 160, 40), (176, 120, 30)
    S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.30, .5, .34), .56, .31), 'h': (S.WROOT['h'], *S.wdir(-.30, .5, .44), .44, .24)}
    def wing_outline(L_, W, k=30):
        th = np.linspace(0, 2 * np.pi, k, endpoint=False); s = L_ * (.5 - .5 * np.cos(th)); t = W * np.sin(th) * np.clip(1.3 * (s / L_) ** .5 * (1.25 - s / L_), 0, 1.1)   # angular, broad
        return np.c_[s, t]
    S.wing_outline = wing_outline
    S.LAMP_R = .25; S.LAMP_U = V3(0, -.20, 1.); S.LAMP_COLS = ((212, 136, 18), (234, 174, 40), (250, 212, 96))
    GEM, GEMHI, SPIKE = (150, 118, 226), (226, 210, 255), (112, 84, 196)
    S.DECO = [GEM, GEMHI, SPIKE]
    def deco():
        parts = []
        p = S.ray(S.HC, nz(V3(0, .75, .62))[None], .5)[0]; n = S.grad(p[None], 3e-3)[0]                      # the pointed crest
        parts.append(C.crystal(p - n * .02, n + V3(0, .7, -.1), .055, .16, GEM, 5, .03))
        for sx in (1, -1):
            for (a, b, c) in LEGS:                                                                             # a spur on every knee
                parts.append(C.crystal(V3(sx * b[0], b[1], b[2]), V3(sx * .5, .9, 0), .022, .07, SPIKE, 4, .02))
            h = S.HAND * V3(sx, 1, 1); parts.append(C.crystal(h, V3(sx * .3, .4, 1), .022, .07, SPIKE, 4, .02))   # gauntlet points
            sh = C.onsurf(S, S.AC, [(sx * .19, .52, -.02)])[0]; parts.append(C.crystal(sh, V3(sx * .8, .6, -.1), .045, .13, GEM, 5, .03))   # pauldrons
        return parts
    S.deco = deco
    RAY = (255, 214, 96)
    def aura_parts():                                                                                          # a sunburst rim round her belly lamp
        p = S.LAMP_AT; n = nz(V3(0, -.20, 1.)); t1 = nz(np.cross(n, V3(0, 1, 0))); t2 = np.cross(n, t1); out = []
        a = np.arange(48) / 48 * 2 * np.pi; Q = C.onsurf(S, S.AC, p + S.LAMP_R * 1.06 * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2))
        out.append(C.tube(np.vstack([Q, Q[:1]]) + S.grad(np.vstack([Q, Q[:1]]), 3e-3) * .012, .015, .015, RAY, 6))   # a gold rim ON her belly round the lamp
        for i in range(12):                                                                                    # sunburst points lying along the body
            q = Q[i * 4]; g = S.grad(q[None], 3e-3)[0]; u = q - p; u = u - (u @ g) * g; out.append(C.crystal(q + g * .006, nz(u), .020, .07 + .04 * (i % 2), RAY, 4, .01))
        return out
    S.aura_parts = aura_parts; S.AURA_BONE = {RAY: 'abd'}

elif FORM == 'lumilys':
    # VIRTUOSO: the constellation dancer. Slender and tall, a narrow waist, a long tapered abdomen with a GOLD CHEVRON band, a gold heart-gem
    # on the chest, long slim pointed GOLD wings with star-point veins, and over her a gold HALO ring with two CONSTELLATIONS of stars.
    S.TRIS = 9500; S.AC, S.AR_ = V3(0, .22, -.07), V3(.180, .180, .330); C.axis(S, (0, .95, .30)); TIP = S.AC - S.AX * .46
    S.TXR = V3(.125, .130, .130); S.BOUNDS = (V3(-.30, -.32, -.40), V3(.30, .93, .46))
    def abdomen(M):
        q = S.aq(M); d = ell(q, (0, 0, 0), S.AR_); return su(d, cone(M, S.AC - S.AX * .16, TIP, .13, .015), .08)
    S.abdomen = abdomen
    def legs(M):
        return su(cone(M, S.LEG[0], (.12, .20, .05), .022, .016), cone(M, (.12, .20, .05), (.10, .02, .07), .016, .010), .01)   # long dancer's legs
    S.legs = legs
    VIO_L, VIO_D, FACE, LIMB, GOLDB = map(S.C8, ('#8c6ad0', '#5c3f9a', '#fbe9e4', '#6d50b2', '#e8b640'))
    S.FACE = S.HEADC = FACE; base_cls = S.classes
    def classes(V):
        k = base_cls(V); M, ab, hd, tx, ar, lg = C.regions(S, V); q = S.aq(M)
        z = q[:, 2] + .55 * np.abs(q[:, 0]); band = np.clip(.035 - np.abs(z - .02), -.05, .05)                 # the chevron (a V down the front)
        return k + [np.where((ab < np.minimum(hd, tx) - .004) & (np.minimum(ar, lg) > ab), band, -.05)]
    S.classes = classes; S.PAL = [VIO_L, VIO_D, FACE, LIMB, GOLDB]
    S.MEMB, S.VEIN, S.RIM = (250, 226, 120), (222, 170, 50), (200, 150, 60)
    S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.55, .5, .22), .62, .19), 'h': (S.WROOT['h'], *S.wdir(-.10, .5, .30), .50, .15)}
    def wing_outline(L_, W, k=30):
        th = np.linspace(0, 2 * np.pi, k, endpoint=False); s = L_ * (.5 - .5 * np.cos(th)); t = W * np.sin(th) * (s / L_) ** .55 * (1.35 - s / L_) ** 1.4   # long, drawn to a point
        return np.c_[s, t]
    S.wing_outline = wing_outline
    S.LAMP_R = .15; S.LAMP_U = V3(0, -.45, 1.); S.LAMP_COLS = ((236, 180, 70), (252, 220, 130), (255, 246, 214))
    GEM, GEMHI = (240, 196, 70), (255, 240, 190)
    S.DECO = [GEM, GEMHI]
    def deco():
        p = C.onsurf(S, S.AC, [(0, .47, .18)])[0]; n = S.grad(p[None], 3e-3)[0]
        return [C.crystal(p - n * .005, n, .030, .06, GEM, 4, .02), C.crystal(p + n * .01 + V3(0, .02, 0), n, .008, .02, GEMHI, 4)]
    S.deco = deco
    HALO, STAR, LINE = (255, 214, 100), (255, 236, 150), (236, 196, 96)
    def aura_parts():
        out = [torus(V3(0, .64, -.24), V3(0, .30, 1), .60, .018, HALO, 72, 6)]   # a nimbus ring standing behind her
        for cons in ([(.30, 1.12, .00), (.42, 1.22, .03), (.55, 1.16, .00), (.62, 1.30, -.03), (.48, 1.36, -.02)],
                     [(-.32, 1.18, -.04), (-.46, 1.28, -.02), (-.58, 1.20, .02), (-.52, 1.06, .03)]):
            Q = np.array(cons, float)
            for i, c in enumerate(Q): out += star(c, .070 if i % 2 == 0 else .052, STAR)
            for a, b in zip(Q[:-1], Q[1:]): out.append(C.tube(np.linspace(a, b, 6), .008, .008, LINE, 5))
        return out
    S.aura_parts = aura_parts; S.AURA_BONE = {HALO: 'chest', STAR: 'chest', LINE: 'chest'}

elif FORM == 'lumivex':
    # ACE: the light-trail racer. Long and LOW: the abdomen laid out straight behind her like a dart, gold-splotched to a glowing gold tail,
    # narrow swept-back wings, and a long gold LIGHT TRAIL streaming off the tail tip.
    S.TRIS = 10000; S.AC, S.AR_ = V3(0, .40, -.30), V3(.200, .195, .380); C.axis(S, (0, .16, .99)); TIP = S.AC - S.AX * .48
    S.BOUNDS = (V3(-.30, .02, -.92), V3(.30, .93, .46))
    def abdomen(M):
        q = S.aq(M); d = ell(q, (0, 0, 0), S.AR_); return su(d, cone(M, S.AC - S.AX * .20, TIP, .15, .05), .07)
    S.abdomen = abdomen
    VIO_L, VIO_D, FACE, LIMB, GOLDS = map(S.C8, ('#8466c4', '#5f4498', '#fdf0de', '#6a4eae', '#eec04a'))
    S.FACE = S.HEADC = FACE; base_cls = S.classes
    def classes(V):
        k = base_cls(V); M, ab, hd, tx, ar, lg = C.regions(S, V); q = S.aq(M)
        sp = np.sin(13 * q[:, 0] + 7 * q[:, 1]) * np.sin(11 * q[:, 2] - 5 * q[:, 1]) + 1.6 * np.clip(-q[:, 2] - .10, 0, 1) * 4 - .55   # gold splotches, gold to the tail
        return k + [np.where((ab < np.minimum(hd, tx) - .004) & (q[:, 2] < .10), np.clip(.03 * sp, -.05, .05), -.05)]
    S.classes = classes; S.PAL = [VIO_L, VIO_D, FACE, LIMB, GOLDS]
    S.MEMB, S.VEIN, S.RIM = (232, 222, 246), (232, 190, 80), (176, 150, 220)
    S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.62, .5, .70), .56, .17), 'h': (S.WROOT['h'], *S.wdir(.30, .5, .95), .44, .13)}
    def wing_outline(L_, W, k=30):
        th = np.linspace(0, 2 * np.pi, k, endpoint=False); s = L_ * (.5 - .5 * np.cos(th)); t = W * np.sin(th) * (s / L_) ** .35 * (1.3 - s / L_)   # swept, narrow
        return np.c_[s, t]
    S.wing_outline = wing_outline
    S.LAMP_R = .17; S.LAMP_U = V3(0, -.10, -1.); S.LAMP_COLS = ((240, 176, 40), (252, 214, 96), (255, 244, 190))
    TRAIL, TRAIL2 = (255, 216, 90), (236, 214, 255)
    def aura_parts():
        t = np.linspace(0, 1, 40); p0 = TIP + S.AX * -.05
        Q = p0 + np.c_[.14 * np.sin(t * 2.4 * np.pi) * t, -.14 * t - .06 * np.sin(t * 2 * np.pi), -1.30 * t]
        Q2 = p0 + np.c_[-.08 * np.sin(t * 2 * np.pi + 1) * t, -.06 * t + .04 * np.sin(t * 3 * np.pi), -.75 * t]
        return ribbon(Q, .13 * (1 - t) ** .7 + .008, nz(V3(1, .5, 0)), TRAIL) + ribbon(Q2, .06 * (1 - t) + .005, nz(V3(1, -.5, 0)), TRAIL2)   # a standing ribbon: it reads from the side
    S.aura_parts = aura_parts; S.AURA_BONE = {TRAIL: 'abd', TRAIL2: 'abd'}

elif FORM == 'elhae':
    # ENIGMA: the blazing core. A long kite-pointed faceted abdomen, a BLAZING white-gold core where thorax meets abdomen, ROOTS OF LIGHT
    # running out of it in every direction, broad pale lilac wings with gold veins, curled gold-tipped antennae.
    S.TRIS = 10000; S.AC, S.AR_ = V3(0, .26, -.04), V3(.215, .215, .300); C.axis(S, (0, .96, .28)); TIP = S.AC - S.AX * .52
    S.BOUNDS = (V3(-.32, -.36, -.40), V3(.32, .93, .46))
    def abdomen(M):
        q = S.aq(M); d = ell(q, (0, 0, 0), S.AR_); return su(d, cone(M, S.AC - S.AX * .10, TIP, .19, .01), .10)
    S.abdomen = abdomen
    VIO_L, VIO_D, FACE, LIMB = map(S.C8, ('#7258b8', '#4a3288', '#f4e8f4', '#5a409c'))
    S.FACE = S.HEADC = FACE; S.PAL = [VIO_L, VIO_D, FACE, LIMB]
    S.KNOBC, S.KNOBHI = (236, 190, 70), (255, 236, 170)
    S.MEMB, S.VEIN, S.RIM = (226, 220, 246), (236, 194, 80), (200, 180, 236)
    S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.36, .5, .18), .60, .27), 'h': (S.WROOT['h'], *S.wdir(-.22, .5, .26), .48, .22)}
    S.LAMP_R = .21; S.LAMP_U = V3(0, .22, 1.); S.LAMP_COLS = ((255, 226, 110), (255, 244, 186), (255, 255, 240))
    ROOT, ROOT2 = (255, 224, 110), (255, 246, 200)
    def aura_parts():
        c = S.LAMP_AT; rng = np.random.default_rng(7); out = []; n0 = nz(V3(0, .3, 1))
        for i in range(14):
            a = i / 14 * 2 * np.pi + .1; u = nz(V3(np.cos(a) * 1.3, np.sin(a) * .8 - .10, .45)); side = nz(np.cross(u, n0)); L_ = .55 + .30 * rng.random()
            t = np.linspace(0, 1, 18); Q = c + n0 * .08 + np.outer(t * L_, u) + np.outer(.06 * np.sin(t * (3 + i % 3) * np.pi + i) * t, side) + np.outer(-.08 * t * t, V3(0, 1, 0))
            out.append(C.tube(Q, .032, .004, ROOT if i % 3 else ROOT2, 6))
            if i % 2 == 0:                                                                                    # a fork off every other root
                j = 9; v = nz(u + side * .8); t2 = np.linspace(0, 1, 9); Q2 = Q[j] + np.outer(t2 * L_ * .4, v); out.append(C.tube(Q2, .010, .002, ROOT, 5))
        return out
    S.aura_parts = aura_parts; S.AURA_BONE = {ROOT: 'chest', ROOT2: 'chest'}
    S.A0, S.A1, S.A2 = V3(.060, .835, .165), V3(.150, 1.080, .060), V3(.290, 1.090, .230); S.KNOB = S.A2 + V3(.004, -.012, .012)   # swept out + curled forward
    S.abz = lambda t: np.outer((1 - t) ** 2, S.A0) + np.outer(2 * (1 - t) * t, S.A1) + np.outer(t * t, S.A2)
else:
    raise SystemExit('form?')

def finish(S_, V, F, path, eye):
    """lum_common.finish + the AURA part (her lamp again + her motif)"""
    V, F = S.refine(V, F, lambda V: (V[:, 2] > .26) & (V[:, 1] > .52), .024)
    lab = np.full(len(F), -1)
    for k in range(len(S.PAL)): V, F, lab, side = cut(V, F, lab, S.classes(V)[k]); lab = np.where(side, k, lab)
    N = S.grad(V, .006); cols = np.array([S.PAL[k] if k >= 0 else S.GOLD for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN = V[key[:, 0]], N[key[:, 0]]; CC = np.c_[key[:, 1:], np.full(len(key), 255)].astype(float); FF = inv.reshape(-1, 3)
    sh = np.clip(.5 + .5 * NN[:, 1], 0, 1); CC[:, :3] = CC[:, :3] * (.86 + .14 * sh[:, None])
    lP, lF, lC = C.lamp(S)
    gl = np.exp(-np.linalg.norm(VV - S.LAMP_AT, axis=1) ** 2 / .03); CC[:, :3] = np.minimum(255, CC[:, :3] * (1 + .22 * gl[:, None]) + 30 * gl[:, None])
    eV, eF, eC = S.join(eye); lCa = np.c_[lC, np.full(len(lC), 255)]
    mV, mF, mC = S.join(S.aura_parts()); aV = np.vstack([lP, mV]); aF = np.vstack([lF, mF + len(lP)]); aC = np.vstack([lCa, mC])
    glb(path, dict(body=(VV, FF, np.round(CC), NN), eyes=(eV, eF, eC, normals(eV, eF)), lamp=(lP, lF, lCa, normals(lP, lF)), aura=(aV, aF, aC, normals(aV, aF))))
    print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF), 'lamp tris', len(lF), 'aura tris', len(aF), 'verts', len(aV))
C.finish = finish
if __name__ == '__main__': C.build(S, sys.argv[2])
