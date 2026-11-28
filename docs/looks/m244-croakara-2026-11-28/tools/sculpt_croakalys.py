"""M244 sheet 11: CROAKALYS (Croakara's Virtuoso), OWNER PREVIEW.   python sculpt_croakalys.py <out.glb> [tris]
Art LOCKED athernyx assets/stage3/034-croakalys.png (PRIVATE, read for shape + colour). Starts from the LIVE Croakara (m202-croakling-line
tools/sculpt_croakara.py, imported, never edited: her head, huge lilac-ringed eyes, wide smile, violet bud lure, gold flowing marks = pattern
only, her palette) and STANDS HER UP, re-shaped by name: the head lifted onto a standing egg body with a pale belly, two bowed legs on flat
four-toed feet, both arms FLUNG OUT wide and up (four round-padded fingers), a thick tail lying out behind her, her mouth OPEN (a painted
maw + tongue under the smile, as Croakarkor's grin). Motif (aura, unlit, on the chest): bright streaks of song bursting out round her.
Exposes the names rig_croakalys.py reads (the sheet 9 biped's interface): P_, HC, HS, TCU, trunk_up, head_up, legs_up, tail_up, arm_side,
AURA_BONE, AURA_DEFAULT."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-croakling-line-2026-11-27/tools'))
import sculpt_croakara as F0
import croak_common as C
from croak_common import cone, ell, su, ss, V3
from sculpt_v2 import catmull
S = F0.S
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
D = V3(0, .44, -.02); HS = 1.0
S.HC = S.HC + D; S.EBC = S.EBC + D; S.L0, S.L1, S.L2, S.ORB = S.L0 + D, S.L1 + D, S.L2 + D, S.ORB + D; S.SMILE_Y += D[1]; S.HR = V3(.35, .17, .26)
HC = S.HC
P_ = dict(HIP=V3(.125, .40, -.03), KNEE=V3(.215, .23, .07), ANK=V3(.225, .055, -.01), RL=(.080, .060),
          SHO=V3(.200, .76, .02), ELB=V3(.380, .84, .07), HND=V3(.540, .96, .09), RA=(.058, .046), FIST=.050,
          trunk=((0, .58, -.01), (.255, .26, .215)), belly=((0, .54, .06), (.225, .21, .19)),
          tail=[(0, .44, -.16), (0, .30, -.30), (-.04, .16, -.44), (-.12, .085, -.58), (-.22, .065, -.68), (-.32, .06, -.72)], tr=[.11, .10, .085, .065, .045, .024])
P_['SHO2'], P_['ELB2'], P_['HND2'] = P_['SHO'], P_['ELB'], P_['HND']
P_['chest'] = ((0, .71, .0), (.20, .12, .16))   # the rig's chest joint
TCU = catmull([(*a, r) for a, r in zip(P_['tail'], P_['tr'])], 8)
def head_up(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(ell(M, S.HC, S.HR), ell(M, V3(0, .465, .15) + D, (S.HR[0] - .03, .110, .215)), .05); d = su(d, ell(M, S.EBC, (.128, .120, .120)), .05)
    return su(d, ell(M, V3(0, .400, .215) + D, (.22, .085, .125)), .05)
def trunk_up(P):
    (c, r), (c2, r2) = P_['trunk'], P_['belly']; d = su(ell(P, c, r), ell(P, c2, r2), .07)
    return su(d, cone(P, (0, .74, .0), HC - V3(0, .10, .04), .17, .16), .07)
def legs_up(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); a, b, c = P_['HIP'], P_['KNEE'], P_['ANK']; r0, r1 = P_['RL']
    d = su(su(ell(M, a + V3(.02, .0, 0), (.13, .12, .13)), cone(M, a, b, r0, r1), .05), cone(M, b, c, r1, r1 * .78), .03)
    d = su(d, ell(M, c + V3(.02, -.025, .05), (.07, .028, .10)), .025)
    for a_, L in ((-.35, .13), (.0, .15), (.35, .145), (.75, .12)):                                         # four toes, round pads
        q = c + V3(.02 + L * np.sin(a_), -.026, .06 + L * np.cos(a_)); q[1] = .028
        d = su(d, su(cone(M, c + V3(.02, -.02, .06), q, .022, .016), ell(M, q, (.030, .026, .030)), .006), .012)
    return d
def arm_side(M, S_, E_, H_):
    r0, r1 = P_['RA']; d = su(cone(M, S_, E_, r0, r1), cone(M, E_, H_, r1, r1 * .85), .025)
    u = nz(H_ - E_); d = su(d, ell(M, H_ + u * .02, (P_['FIST'], P_['FIST'], P_['FIST'] * .7)), .02)
    w = nz(np.cross(u, V3(0, 0, 1)))
    for a_ in (-.95, -.32, .32, .95):                                                                      # four fingers fanned wide
        q = H_ + u * .02 + (u * np.cos(a_) + w * np.sin(a_)) * (P_['FIST'] + .065)
        d = su(d, su(cone(M, H_ + u * .02, q, .016, .012), ell(M, q, (.022, .022, .022)), .005), .010)
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
S.BOUNDS = (V3(-.74, -.033, -.86), V3(.74, 1.36, .62))
MAW, TONGUE = S.C8('#5a1e3a'), S.C8('#e07a8a')
def classes(V):
    X, Y, Z = np.abs(V[:, 0]), V[:, 1], V[:, 2]; out = []
    (c, r) = P_['belly']; qb = (X / .19) ** 2 + ((Y - .55) / .25) ** 2
    tk = trunk_up(V); oth = np.minimum.reduce([arms_up(V), legs_up(V), tail_up(V), head_up(V)])
    out.append(np.where((tk < oth - .004) & (Z > 0), np.clip(.03 * (1 - qb), -.05, .05), -.05))                     # the pale glowing belly
    out.append(np.where(Y < .035, .02, -.05))                                                                      # foot pads
    f = np.sin(17 * Y + 5.5 * np.sin(9 * Z + 2.2 * X) + 7 * X) * .045; out.append(np.where((Y > .06) & (Y < 1.18) & (qb > 1.1), C.marks(V, f, .0095), -.05))   # gold flowing marks (pattern)
    sy = S.SMILE_Y + .020 * (X / .25) ** 2; front = (Z > HC[2] + .10) & (Y > HC[1] - .25)
    out.append(np.where(front, np.clip(np.minimum.reduce([sy - .004 - Y, Y - (sy - .115 * np.clip(1 - (X / .26) ** 2, 0, 1)), .26 - X]), -.05, .05), -.05))   # the open maw
    out.append(np.where(front, np.clip(.03 * (1 - (X / .11) ** 2 - ((Y - (S.SMILE_Y - .085)) / .035) ** 2), -.05, .05), -.05))                              # her tongue
    return out
S.classes = classes; S.PAL = [S.BELLY, S.PAD, S.C8('#e8b830'), MAW, TONGUE]
# the base finish refines the face only where the base frog's face was: refine hers
_fin_src = __import__('inspect').getsource(S.finish); a = "lambda V: ((V[:, 2] > .22) & (V[:, 1] > .40)) | (V[:, 1] < .07)"; assert a in _fin_src
exec(compile(_fin_src.replace(a, "lambda V: ((V[:, 2] > .20) & (V[:, 1] > .80)) | (V[:, 1] < .05)"), 'croak_finish', 'exec'), S.__dict__)
# ── her motif: streaks of song bursting out round her (aura, chest) ──
STREAK = (255, 236, 170)
AURA_BONE = {STREAK: 'chest'}; AURA_DEFAULT = 'root'
def tube(Q, r0, r1, col, sides=6):
    Q = np.asarray(Q, float); n = len(Q); t = np.gradient(Q, axis=0); t /= np.linalg.norm(t, axis=1, keepdims=True); P, Fc = [], []
    a0 = nz(np.cross(t[0], V3(0, 1, 0) if abs(t[0][1]) < .9 else V3(1, 0, 0)))
    for i in range(n):
        u = nz(np.cross(np.cross(t[i], a0), t[i])); w = np.cross(t[i], u); r = r0 + (r1 - r0) * i / max(1, n - 1)
        for j in range(sides): a = 2 * np.pi * j / sides; P.append(Q[i] + r * (np.cos(a) * u + np.sin(a) * w))
    for i in range(n - 1):
        for j in range(sides):
            a, b, c, d = i * sides + j, i * sides + (j + 1) % sides, (i + 1) * sides + j, (i + 1) * sides + (j + 1) % sides; Fc += [(a, c, b), (b, c, d)]
    return np.array(P), np.array(Fc), col
def aura_parts():
    out = []
    for s in (1, -1):
        for k, (a0, y0, L) in enumerate(((.25, 1.12, .26), (-.10, .92, .30), (-.45, .70, .24), (.65, 1.30, .18))):
            dirn = nz(V3(s * np.cos(a0), np.sin(a0) * .8, .25)); p0 = V3(0, y0, .05) + dirn * (.50 if k < 3 else .42)
            t = np.linspace(0, 1, 14); side = nz(np.cross(dirn, V3(0, 0, 1)))
            Q = [p0 + dirn * L * u + side * .025 * np.sin(u * 2 * np.pi * 1.5) for u in t]; out.append(tube(Q, .010, .004, STREAK, 5))
    return out
_glb = S.glb
def glb_with_aura(path, parts):
    aV, aF, aC = S.join(aura_parts()); parts = dict(parts, aura=(aV, aF, aC, S.normals(aV, aF))); print('aura tris', len(aF)); return _glb(path, parts)
S.glb = glb_with_aura
_dec = S.decimate
def decimate(V, Fc, n):
    import trimesh, fast_simplification as fs
    t = _dec(V, Fc, n)
    if t is not None and len(t.faces) < n * 1.15: return t
    src = t if t is not None else trimesh.Trimesh(V, Fc, process=False)
    for agg in (1, 2, 3, 4, 5, 6, 7):
        v, f = fs.simplify(np.asarray(src.vertices, np.float32), np.asarray(src.faces, np.int32), target_count=n, agg=agg); q = trimesh.Trimesh(v, f, process=False); q.merge_vertices(); trimesh.repair.fix_winding(q)
        if q.is_watertight and q.is_winding_consistent and q.body_count == 1 and q.euler_number <= 2: return q
    return t
S.decimate = decimate
if __name__ == '__main__': C.build(S, sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 7200)
