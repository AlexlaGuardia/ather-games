"""M244 sheet 12: RILLESSE (Croakrill's Virtuoso, PURE Water), OWNER PREVIEW.   python sculpt_rillesse.py <out.glb> [tris]
Art LOCKED athernyx assets/stage3/042-rillesse.png (PRIVATE, read for shape + colour). Starts from the LIVE Croakrill (m202-croakling-line
tools/sculpt_croakrill.py, imported, never edited: her head, big glossy eyes, the soft layered gill fronds, the cyan bulb lure, the teal /
aqua / lime palette, ripple lines + dark spots) and STANDS HER UP as a dancer, re-shaped by name: the head lifted onto a slim standing
droplet body with a pale lime belly, two bowed legs in a plie on long webbed four-toed feet, both arms raised UP and out (four round-padded
fingers), a short tail stub at her rump, fewer spots (pure Water). Motif (aura, unlit): the LILY PAD she dances on with two pink water
lilies on it (root), and water drops flung off her raised arms (chest).
Exposes the names rig_croakalys.py reads (the sheet 9 biped's interface): P_, HC, HS, TCU, trunk_up, head_up, legs_up, tail_up, arm_side,
AURA_BONE, AURA_DEFAULT."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-croakling-line-2026-11-27/tools'))
import sculpt_croakrill as F0
import croak_common as C
from croak_common import cone, ell, su, ss, V3
from sculpt_v2 import catmull
S = F0.S
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
D = V3(0, .42, -.02); HS = 1.0
S.HC = S.HC + D; S.EBC = S.EBC + D; S.L0, S.L1, S.L2, S.ORB = S.L0 + D, S.L1 + D, S.L2 + D, S.ORB + D; S.SMILE_Y += D[1]
F0.RIB = [(P + D, T, Wd, N, w, t) for P, T, Wd, N, w, t in F0.RIB]
HC = S.HC
P_ = dict(HIP=V3(.120, .40, -.03), KNEE=V3(.235, .23, .08), ANK=V3(.230, .055, -.01), RL=(.074, .056),
          SHO=V3(.190, .78, .02), ELB=V3(.355, .90, .06), HND=V3(.470, 1.10, .08), RA=(.054, .043), FIST=.046,
          trunk=((0, .58, -.02), (.235, .26, .205)), belly=((0, .54, .05), (.205, .21, .18)),
          tail=[(0, .42, -.15), (0, .36, -.21), (0, .31, -.25), (0, .27, -.28), (0, .245, -.30), (0, .23, -.31)], tr=[.09, .075, .06, .045, .032, .02])
P_['SHO2'], P_['ELB2'], P_['HND2'] = P_['SHO'], P_['ELB'], P_['HND']
P_['chest'] = ((0, .71, .0), (.19, .12, .15))
TCU = catmull([(*a, r) for a, r in zip(P_['tail'], P_['tr'])], 8)
def head_up(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(ell(M, S.HC, S.HR), ell(M, V3(0, .515, .16) + D, (S.HR[0] - .02, .110, .215)), .05); d = su(d, ell(M, S.EBC, (.124, .118, .118)), .05)
    d = su(d, F0.fronds(M), .018)
    return su(d, ell(M, V3(0, .445, .235) + D, (.205, .080, .120)), .05)
def trunk_up(P):
    (c, r), (c2, r2) = P_['trunk'], P_['belly']; d = su(ell(P, c, r), ell(P, c2, r2), .07)
    return su(d, cone(P, (0, .74, .0), HC - V3(0, .10, .04), .16, .15), .07)
TOE4 = ((-.38, .15), (.0, .175), (.38, .17), (.80, .14))
def legs_up(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); a, b, c = P_['HIP'], P_['KNEE'], P_['ANK']; r0, r1 = P_['RL']
    d = su(su(ell(M, a + V3(.02, .0, 0), (.12, .115, .125)), cone(M, a, b, r0, r1), .05), cone(M, b, c, r1, r1 * .78), .03)
    d = su(d, ell(M, c + V3(.02, -.025, .05), (.066, .026, .10)), .025)
    for a_, L in TOE4:                                                                                       # four long toes, round pads
        q = c + V3(.02 + L * np.sin(a_), -.026, .06 + L * np.cos(a_)); q[1] = .028
        d = su(d, su(cone(M, c + V3(.02, -.02, .06), q, .020, .014), ell(M, q, (.028, .024, .028)), .006), .012)
    for (a1, L1), (a2, L2) in zip(TOE4[:-1], TOE4[1:]):                                                      # full webs between them
        q1 = c + V3(.02 + L1 * np.sin(a1), 0, .06 + L1 * np.cos(a1)); q2 = c + V3(.02 + L2 * np.sin(a2), 0, .06 + L2 * np.cos(a2))
        m = (q1 + q2) / 2 * .72 + (c + V3(.02, 0, .06)) * .28; m[1] = .022; d = np.minimum(d, ell(M, m, (.060, .010, .060)))
    return d
def arm_side(M, S_, E_, H_):
    r0, r1 = P_['RA']; d = su(cone(M, S_, E_, r0, r1), cone(M, E_, H_, r1, r1 * .85), .025)
    u = nz(H_ - E_); d = su(d, ell(M, H_ + u * .02, (P_['FIST'], P_['FIST'], P_['FIST'] * .7)), .02)
    w = nz(np.cross(u, V3(0, 0, 1)))
    for a_ in (-.95, -.32, .32, .95):                                                                      # four fingers fanned wide
        q = H_ + u * .02 + (u * np.cos(a_) + w * np.sin(a_)) * (P_['FIST'] + .070)
        d = su(d, su(cone(M, H_ + u * .02, q, .015, .011), ell(M, q, (.021, .021, .021)), .005), .010)
    return d
def arms_up(P): return np.minimum(arm_side(P, P_['SHO'], P_['ELB'], P_['HND']), arm_side(P * V3(-1, 1, 1), P_['SHO2'], P_['ELB2'], P_['HND2']))
def tail_up(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b in zip(TCU[:-1], TCU[1:]): d = np.minimum(d, cone(P * V3(1, 1.25, 1), a[:3] * V3(1, 1.25, 1), b[:3] * V3(1, 1.25, 1), a[3], b[3]))
    return d / 1.12
def field(P):
    d = su(trunk_up(P), head_up(P), .08); d = su(d, legs_up(P), .045); d = su(d, arms_up(P), .040); d = su(d, tail_up(P), .06)
    return d
S.field = field
S.BOUNDS = (V3(-.74, -.033, -.52), V3(.74, 1.42, .62))
SP = C.surf_pts(S, 14, 8, lambda P: (P[:, 1] > .30) & (P[:, 2] < .05) & (P[:, 1] < 1.08))
def classes(V):
    X, Y, Z = np.abs(V[:, 0]), V[:, 1], V[:, 2]; M = np.c_[X, Y, Z]; out = []
    qb = (X / .18) ** 2 + ((Y - .55) / .25) ** 2
    tk = trunk_up(V); oth = np.minimum.reduce([arms_up(V), legs_up(V), tail_up(V), head_up(V)])
    fd = F0.fronds(M); onf = fd < .006
    out.append(np.where((tk < oth - .004) & (Z > 0), np.clip(.03 * (1 - qb), -.05, .05), -.05))                     # the pale lime belly
    out.append(np.where(Y < .035, .02, -.05))                                                                      # foot pads + webs
    body = ~onf & (Y > .06) & ~((tk < oth - .004) & (Z > 0) & (qb < 1))
    out.append(np.where(body, np.clip(-Z * .6 + .02 - .4 * (X - .1) ** 2 + .03 * np.sin(8 * Y), -.05, .05), -.05))   # deep teal down her back
    rip = np.sin(26 * Y + 7 * np.sin(6 * Z + 5 * X) + 4 * X)
    out.append(np.where(body & (Y > .14), C.marks(V, rip * .028, .0055), -.05))                                    # flowing ripple lines
    d = np.min(np.linalg.norm(M[:, None] - np.c_[np.abs(SP[:, 0]), SP[:, 1:]][None], axis=2), 1)
    out.append(np.where(body, np.clip(.022 - d, -.05, .05), -.05))                                                 # a few dark spots
    out.append(np.where(onf, .05, -.05))                                                                           # the fronds, paler
    tt = np.full(len(V), -.05)
    for P, *_ in F0.RIB: tt = np.maximum(tt, np.where(onf, np.clip(.12 - np.min(np.linalg.norm(M[:, None] - P[-4:][None], axis=2), 1), -.05, .05), -.05))
    out.append(tt); return out
S.classes = classes; S.PAL = [S.BELLY, S.PAD, F0.DEEP, F0.RIPPLE, F0.SPOT, F0.FROND, F0.FTIP]
# the base finish refines the face only where the base frog's face was: refine hers
_fin_src = __import__('inspect').getsource(S.finish); a = "lambda V: ((V[:, 2] > .22) & (V[:, 1] > .40)) | (V[:, 1] < .07)"; assert a in _fin_src
exec(compile(_fin_src.replace(a, "lambda V: ((V[:, 2] > .20) & (V[:, 1] > .80)) | (V[:, 1] < .05)"), 'croak_finish', 'exec'), S.__dict__)
# ── her motif (aura): the lily pad + two water lilies (root), water drops flung off her raised arms (chest) ──
PADG, PADV, PETAL, PETAL_HI, LILYC, DROP = (104, 172, 78), (150, 204, 104), (240, 140, 186), (252, 196, 220), (250, 212, 84), (176, 236, 250)
AURA_BONE = {DROP: 'chest'}; AURA_DEFAULT = 'root'
def lily_pad(R=.52, k=44, notch=.38, y0=.0008, y1=.0070):
    """a flat round pad with its notch, as a thin closed slab (top + bottom fans + rim)"""
    a = np.linspace(notch / 2, 2 * np.pi - notch / 2, k); a = a - np.pi / 2 + np.pi      # the notch points back-left
    rr = R * (1 + .025 * np.sin(5 * a))
    ring = np.c_[rr * np.cos(a), np.zeros(k), rr * np.sin(a)]; top = ring + V3(0, y1, 0); bot = ring + V3(0, y0, 0)
    P = np.vstack([[V3(0, y1, 0)], top, [V3(0, y0, 0)], bot]); ct, cb = 0, k + 1; Fc = []
    for i in range(k - 1):
        Fc += [(ct, 1 + i + 1, 1 + i), (cb, cb + 1 + i, cb + 2 + i), (1 + i, 1 + i + 1, cb + 2 + i), (1 + i, cb + 2 + i, cb + 1 + i)]
    Fc += [(ct, 1, cb + 1), (ct, cb + 1, cb), (ct, cb + k, 1 + k - 1), (ct, cb, cb + k)]      # close the notch edges
    return P, np.array(Fc), PADG
def ball(c, r, col, nu=7, nv=10):
    u_, v_ = np.meshgrid(np.linspace(0, np.pi, nu), np.arange(nv) / nv * 2 * np.pi, indexing='ij'); Sd = np.c_[(np.sin(u_) * np.cos(v_)).ravel(), np.cos(u_).ravel(), (np.sin(u_) * np.sin(v_)).ravel()]
    P = np.asarray(c, float) + Sd * np.asarray(r, float); Fb = [(i * nv + j, (i + 1) * nv + (j + 1) % nv, i * nv + (j + 1) % nv) for i in range(nu - 1) for j in range(nv)] + [(i * nv + j, (i + 1) * nv + j, (i + 1) * nv + (j + 1) % nv) for i in range(nu - 1) for j in range(nv)]
    return P, np.array(Fb), col
def petal(c, ang, tilt, L, W, col):
    """one pointed petal: a flattened ball stretched along its length, tipped up by tilt, facing out at ang"""
    P, Fb, _ = ball(V3(0, 0, 0), (W, .010, L), col, 6, 10); P[:, 2] = P[:, 2] + L * .95; P[:, 0] *= np.clip(1 - (P[:, 2] / (2 * L)) ** 2 * .9, .1, 1)
    ct, st = np.cos(tilt), np.sin(tilt); P = P @ np.array([[1, 0, 0], [0, ct, st], [0, -st, ct]]).T * V3(1, 1, 1)
    ca, sa = np.cos(ang), np.sin(ang); P = P @ np.array([[ca, 0, sa], [0, 1, 0], [-sa, 0, ca]]).T
    return P + c, Fb, col
def lily(c, s=1.):
    out = []
    for i in range(8): out.append(petal(c + V3(0, .012, 0), i * np.pi / 4, .40, .060 * s, .028 * s, PETAL))
    for i in range(6): out.append(petal(c + V3(0, .024, 0), i * np.pi / 3 + .3, .95, .048 * s, .022 * s, PETAL_HI))
    out.append(ball(c + V3(0, .040 * s, 0), (.024 * s, .016 * s, .024 * s), LILYC, 5, 8))
    return out
def aura_parts():
    rng = np.random.default_rng(42); out = [lily_pad()]
    for i in range(7):   # pale veins across the pad
        a = (i + .5) / 7 * (2 * np.pi - .5) + .25 - np.pi / 2 + np.pi; q = np.c_[np.linspace(.04, .48, 6) * np.cos(a), np.full(6, .0074), np.linspace(.04, .48, 6) * np.sin(a)]
        P = np.vstack([q + V3(-np.sin(a), 0, np.cos(a)) * .005, q - V3(-np.sin(a), 0, np.cos(a)) * .005]); Fc = np.array([f for j in range(5) for f in ((j, j + 1, 6 + j + 1), (j, 6 + j + 1, 6 + j))])
        out.append((P, Fc, PADV))
    out += lily(V3(-.40, .0, .26), 1.75) + lily(V3(.40, .0, -.10), 1.6)
    for s in (1, -1):    # drops flung off her raised hands + arms
        for k in range(7):
            h = P_['HND'] * V3(s, 1, 1); p = h + V3(s * rng.uniform(.04, .22), rng.uniform(-.25, .12), rng.uniform(-.08, .14)); r = rng.uniform(.010, .017)
            out.append(ball(p, (r, r * 1.6, r), DROP, 5, 8))
    return out
_glb = S.glb
def glb_with_aura(path, parts):
    aV, aF, aC = S.join(aura_parts()); parts = dict(parts, aura=(aV, aF, aC, S.normals(aV, aF))); print('aura tris', len(aF)); return _glb(path, parts)
S.glb = glb_with_aura
if __name__ == '__main__': C.build(S, sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 6100)
