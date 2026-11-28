"""M244 sheet 15: ARCLOTL's four AWAKENED forms (Storm), OWNER PREVIEW.    ARCAW_FORM=<tar|elle|cis|lun> python sculpt_arcaw.py <out.glb> [tris]
Art LOCKED athernyx assets/stage3/081-084 (PRIVATE, read for shape + colour). Each starts from the LIVE Arclotl (m202-manalotl-line tools/
sculpt_arclotl.py, imported, never edited: her wide head, blue eyes with the warm glint, the smile, three saw-tooth gill spikes a side with two
forked tendrils off each tip, the spark on her brow, crackle veins on a cream belly, her palette) and re-shapes her BY NAME:
  tar  ARCLOTAR (Champion)  STANDS UP (the ground biped): a stocky barrel on two thick legs, arms out with claws spread, bigger gill spikes, a
                            thick stocky tail with a saw row down its back. Aura (chest): bolts crackling round her.
  elle ARCLELLE (Virtuoso)  STANDS UP, slender: a narrow waist, long legs (her idle lifts one foot: she dances on the other), both arms out wide,
                            one high, her gills swept back, a long tail with a saw-fin. NO frills. Aura (chest): ribbons of current looping round her.
  cis  ARCIS (Ace, pure)    STANDS UP, compact and crouched, arms reaching out, steel-grey gill spikes (her pure Storm). Aura (root): the big
                            lightning ORB she sits inside (a cage of rings) + bolts on its shell.
  lun  ARCLUN (Enigma)      stays on four legs (the art glides level): a sleek, long, low body, gills swept back like wings, a long slender tail
                            with a fin. Aura (root): sound rings spreading round her head.
Exposes the names the rigs read: biped (rig_arcaw.py, sheet 9's ground biped): P_, HC, HS, TCU, trunk_up, head_up, legs_up, tail_up,
arm_side, AURA_BONE, AURA_DEFAULT; quadruped (rig_arclun.py, rig_lotl.py + an aura): L, GILLS, DY, gills, SITA."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-manalotl-line-2026-11-26/tools'))
import sculpt_arclotl as A
import lotl_common as LC
from lotl_common import V3, su, ell, cone, mir, box, polyline, seg_t, S
from sculpt_v2 import catmull
FORM = os.environ.get('ARCAW_FORM', 'tar'); NAME = dict(tar='arclotar', elle='arclelle', cis='arcis', lun='arclun')[FORM]
BIPED = FORM != 'lun'
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
# ── the head + gills: hers, lifted by D onto the standing body (biped) ──
D = dict(tar=V3(0, .50, -.20), elle=V3(0, .58, -.22), cis=V3(0, .36, -.18), lun=V3(0, 0, 0))[FORM]
GK = dict(tar=1.22, elle=1.05, cis=1.0, lun=1.12)[FORM]            # gill length
GSWEEP = dict(tar=0., elle=.35, cis=0., lun=.55)[FORM]              # gills swept back (z)
GILLS = [(tuple(V3(*r) + D), tuple(nz(V3(d[0], d[1], d[2] - GSWEEP))), ln * GK) for r, d, ln in A.GILLS]
DY = -D[1]; EYE, EYE_R, IRIS, SHINE, SMILE_W, SMILE_COL = A.EYE, A.EYE_R, A.IRIS, A.SHINE, A.SMILE_W, A.SMILE_COL
if FORM == 'lun': SMILE_W = .10
SMILE = A.SMILE
HC = V3(0, .430, .375) + D; HS = 1.0
def head0(P): return A.head(P - D)
GLO, GHI = V3(-.80, .18, -.25) + D, V3(.80, 1.02, .45) + D
def _gills(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for g in GILLS: d = np.minimum(d, A._gill(M, *g))
    return d
def gills(P): return np.minimum(box(_gills, P, GLO, GHI), np.maximum(np.abs(P[..., 0]) - .80, .22))
def tendril_d(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for g in GILLS:
        for p in A.tendrils(*g): d = np.minimum(d, seg_t(M, p)[0])
    return d
def head_up(P): return su(head0(P), gills(P), .014)            # the rig's head term: her head + her gills (they ride the head bone)
# ── the standing bodies (biped) ──
P_ = dict(
  tar=dict(HIP=V3(.150, .34, -.04), KNEE=V3(.215, .19, .04), ANK=V3(.225, .055, -.01), RL=(.095, .075),
           SHO=V3(.215, .72, .04), ELB=V3(.385, .62, .12), HND=V3(.500, .50, .20), RA=(.072, .060), FIST=.050,
           trunk=((0, .52, -.02), (.285, .33, .25)), belly=((0, .46, .07), (.255, .26, .21)), chest=((0, .70, .0), (.24, .14, .18)),
           tail=[(0, .36, -.20), (0, .24, -.36), (0, .14, -.54), (0, .085, -.72), (0, .07, -.88)], tr=[.13, .115, .095, .070, .040]),
  elle=dict(HIP=V3(.115, .44, -.03), KNEE=V3(.165, .25, .06), ANK=V3(.150, .055, -.01), RL=(.070, .052),
            SHO=V3(.180, .82, .03), ELB=V3(.360, .92, .08), HND=V3(.530, 1.02, .12), RA=(.050, .040), FIST=.040,
            SHO2=V3(.180, .80, .03), ELB2=V3(.370, .76, .10), HND2=V3(.540, .74, .16),
            trunk=((0, .64, -.01), (.200, .29, .185)), belly=((0, .60, .05), (.180, .22, .16)), chest=((0, .80, .0), (.18, .12, .15)),
            tail=[(0, .46, -.16), (0, .32, -.32), (0, .19, -.50), (0, .11, -.70), (0, .08, -.88), (0, .075, -1.0)], tr=[.10, .088, .072, .055, .036, .018]),
  cis=dict(HIP=V3(.150, .30, -.03), KNEE=V3(.225, .18, .07), ANK=V3(.215, .050, -.01), RL=(.085, .068),
           SHO=V3(.200, .58, .06), ELB=V3(.340, .52, .20), HND=V3(.440, .44, .32), RA=(.062, .050), FIST=.045,
           trunk=((0, .44, -.02), (.265, .28, .245)), belly=((0, .40, .07), (.240, .23, .20)), chest=((0, .58, .0), (.22, .12, .17)),
           tail=[(0, .30, -.20), (0, .19, -.34), (0, .11, -.48), (0, .075, -.62)], tr=[.11, .095, .070, .035]),
).get(FORM, {})
if BIPED:
    for k in ('SHO', 'ELB', 'HND'): P_.setdefault(k + '2', P_[k])
    TCU = catmull([(*a, r) for a, r in zip(P_['tail'], P_['tr'])], 8)
def trunk_up(P):
    (c, r), (c2, r2) = P_['trunk'], P_['belly']; d = su(ell(P, c, r), ell(P, c2, r2), .07)
    return su(d, cone(P, P_['chest'][0], HC - V3(0, .14, .06), .17, .16), .07)
def legs_up(P):
    M = mir(P); a, b, c = P_['HIP'], P_['KNEE'], P_['ANK']; r0, r1 = P_['RL']
    d = su(su(ell(M, a + V3(.02, 0, 0), (r0 * 1.5, r0 * 1.4, r0 * 1.5)), cone(M, a, b, r0, r1), .05), cone(M, b, c, r1, r1 * .80), .03)
    d = su(d, ell(M, c + V3(.01, -.028, .04), (.075, .028, .095)), .025)                              # a flat sole
    for a_ in (-.45, 0., .45):                                                                       # three toes, a claw each (hers)
        dirn = V3(np.sin(a_), 0, np.cos(a_)); p0 = c + V3(.01, -.030, .06); q = p0 + dirn * .09; q[1] = .022
        d = su(d, cone(M, p0, q, .024, .016), .012); d = su(d, cone(M, q, q + dirn * .045 + V3(0, -.006, 0), .014, .005), .006)
    return d
def arm_side(M, S_, E_, H_):
    r0, r1 = P_['RA']; d = su(cone(M, S_, E_, r0, r1), cone(M, E_, H_, r1, r1 * .85), .025)
    u = nz(H_ - E_); d = su(d, ell(M, H_ + u * .015, (P_['FIST'], P_['FIST'] * .8, P_['FIST'])), .02)
    w = nz(np.cross(u, V3(0, 1, 0)))
    for a_ in (-.70, 0., .70):                                                                       # three clawed fingers spread
        q = H_ + u * .015 + (u * np.cos(a_) + w * np.sin(a_)) * (P_['FIST'] + .045)
        d = su(d, cone(M, H_ + u * .015, q, .017, .012), .010); d = su(d, cone(M, q, q + (u * np.cos(a_) + w * np.sin(a_)) * .035, .011, .004), .005)
    return d
def arms_up(P): return np.minimum(arm_side(P, P_['SHO'], P_['ELB'], P_['HND']), arm_side(P * V3(-1, 1, 1), P_['SHO2'], P_['ELB2'], P_['HND2']))
TEETH = dict(tar=[.18, .34, .50, .66, .80], elle=[.22, .38, .54, .70], cis=[.30, .55]).get(FORM, [])
def tail_up(P):
    """her tail, flattened side to side into a paddle toward the tip (hers lay flat; standing, it lies out behind her), + a saw row on top"""
    Q = P * V3(1.35, 1, 1); d = np.full(P.shape[:-1], 9.)
    for a, b in zip(TCU[:-1], TCU[1:]): d = np.minimum(d, cone(Q, a[:3] * V3(1.35, 1, 1), b[:3] * V3(1.35, 1, 1), a[3], b[3]))
    d = d / 1.2
    for t in TEETH:                                                                                   # the saw row (Arclotar's spikes, Arclelle's fin)
        i = int(t * (len(TCU) - 1)); p = TCU[i]; up = p[:3] + V3(0, p[3] * .9, 0); tip = up + V3(0, .055 + .5 * p[3], -.05)
        d = su(d, cone(P, up - V3(0, .02, 0), tip, p[3] * .45, .006), .012)
    return d
def biped_field(P):
    d = su(trunk_up(P), head0(P), .08); d = su(d, legs_up(P), .045); d = su(d, arms_up(P), .040); d = su(d, tail_up(P), .06)
    return su(d, gills(P), .014)
# ── Arclun: her own four-legged body, sleek + low (the quadruped rig reads L) ──
L = dict(A.L, tail=[(0, .27, -.40), (0, .24, -.60), (0, .21, -.80), (0, .19, -.98), (0, .18, -1.12)]); SITA = A.SITA   # her own longer tail chain
def lun_trunk(P):
    b = ell(P, (0, .290, -.080), (.205, .200, .350))                                   # long + narrow, no big belly
    return su(b, ell(P, (0, .255, .060), (.185, .165, .220)), .08)
def lun_tail(P):
    """long + slender, a fin standing up along its back half"""
    pts = [(0, .27, -.40), (0, .24, -.60), (0, .21, -.80), (0, .19, -.98), (0, .18, -1.12)]; d = polyline(P * V3(1.3, 1, 1), [V3(*p) * V3(1.3, 1, 1) for p in pts], .105, .022) / 1.15
    fin = np.maximum(np.maximum(np.abs(P[..., 0]) - .012, ell(P, (0, .23, -.86), (.04, .135, .30))), -(P[..., 1] - .17))
    return su(d, fin, .02)
def lun_body(P):
    b = su(lun_trunk(P), A.head(P), .08); b = su(b, np.minimum(box(A.legs, P, V3(-.40, -.05, -.36), V3(.40, .30, .36)), .3), .035)
    return su(b, lun_tail(P), .05)
def lun_field(P): return su(lun_body(P), gills(P), .014)
field = biped_field if BIPED else lun_field
BOUNDS = ((-.86, -.033, -1.08), (.86, 1.62, .78)) if BIPED else ((-.86, -.033, -1.20), (.86, 1.02, .72))
# ── colour: hers (Arcis greyer in the gills, the pure Storm) ──
PAL = dict(A.PAL)
if FORM == 'cis': PAL.update(gill='#7c869a', gtip='#c4ccd8', lo='#4f86c8', hi='#94c2f0')
if FORM == 'elle': PAL.update(lo='#68a0d6', hi='#b4dcf8')
if FORM == 'lun': PAL.update(lo='#6a98c8', hi='#b0d0ee')
if FORM == 'tar': PAL.update(gill='#6c84b8', gtip='#b6a8e8')                     # her spikes tipped lilac (the art's purple shading)
def classes(V):
    x, y, z = V.T; Ax = np.abs(x); out = []; H = V - D; hx, hy, hz = H.T
    if BIPED:
        (c, r) = P_['belly']; qb = (x / (r[0] * .82)) ** 2 + ((y - c[1]) / (r[1] * 1.05)) ** 2
        tk = trunk_up(V); oth = np.minimum.reduce([arms_up(V), legs_up(V), tail_up(V), head0(V)])
        bel = (tk < oth - .004) & (z > .02); out.append(np.where(bel, np.clip(.04 * (1 - qb), -.05, .05), -.05))
    else:
        bel = (z > -.12); out.append(np.where(bel, .125 - np.sqrt((x / 1.25) ** 2 + ((y - .23) / 1.3) ** 2), -1.))
    c = np.sin(x * 34 + 2.1 * np.sin(y * 21)) * np.sin(y * 31 + 2.0 * np.sin(z * 17 + x * 9))
    inb = bel & (out[0] > 0)
    out.append(np.where(inb, .10 - np.abs(c), -1.))                                                        # crackle lines on the belly
    out.append(np.where((y > .14) & (np.abs(c) < .07) & ~inb & (hz < .30), 1., -1.))                      # pale crackle veins over the coat
    gf = gills(V); td = tendril_d(V)
    out.append(np.where(gf < .006, 1., -1.)); out.append(np.where(gf < .006, np.abs(hx) - .40 * GK, -1.)); out.append(np.where((gf < .006) & (td < .012), 1., -1.))
    if BIPED:
        hand = np.where((x >= 0)[:, None], P_['HND'], P_['HND2'] * V3(-1, 1, 1)); dh = np.linalg.norm(V - hand, axis=1)
        out.append(np.where(((y < .03) & (z > P_['ANK'][2] + .10)) | ((arms_up(V) < .003) & (dh > P_['FIST'] + .07) & (dh < P_['FIST'] + .16)), 1., -1.))   # toe + finger claws
    else: out.append(np.where((y < .03) & ((Ax > .26) | (z > .29)), 1., -1.))                            # claws
    out.append(.022 - np.sqrt(hx ** 2 + ((hy - .600) * 1.2) ** 2 + (hz - .50) ** 2 * .2))                  # the spark on her brow
    out.append(.026 - np.sqrt(((np.abs(hx) - .190) * .9) ** 2 + ((hy - .385) * 1.6) ** 2 + (hz - .55) ** 2 * .3))
    return out
ORDER = A.ORDER
# ── her motif: the aura part (unlit, glows in game) ──
lin = lambda c: np.round(255 * (np.array(c) / 255.) ** 2.2)
BOLT, RIB, ORB, RING = (236, 248, 255), (170, 230, 255), (190, 225, 255), (210, 236, 255)
AURA_BONE = dict(tar={BOLT: 'chest'}, elle={RIB: 'chest'}, cis={}, lun={}).get(FORM, {}); AURA_DEFAULT = 'root'
def tube(Q, r0, r1, col, sides=6, closed=False):
    Q = np.asarray(Q, float); n = len(Q); t = np.gradient(Q, axis=0); t /= np.linalg.norm(t, axis=1, keepdims=True); Pp, Fc = [], []
    a0 = nz(np.cross(t[0], V3(0, 1, 0) if abs(t[0][1]) < .9 else V3(1, 0, 0)))
    for i in range(n):
        u = nz(np.cross(np.cross(t[i], a0), t[i])); w = np.cross(t[i], u); r = r0 + (r1 - r0) * i / max(1, n - 1)
        for j in range(sides): a = 2 * np.pi * j / sides; Pp.append(Q[i] + r * (np.cos(a) * u + np.sin(a) * w))
    for i in range(n - (0 if closed else 1)):
        i2 = (i + 1) % n
        for j in range(sides):
            a, b, c_, d = i * sides + j, i * sides + (j + 1) % sides, i2 * sides + j, i2 * sides + (j + 1) % sides; Fc += [(a, c_, b), (b, c_, d)]
    return np.array(Pp), np.array(Fc), col
def bolt(p0, dirn, L, seed, r=.010, kinks=5, side=None):
    rng = np.random.default_rng(seed); dirn = nz(dirn); side = nz(np.cross(dirn, V3(0, 1, 0)) if side is None else side); up = np.cross(dirn, side); Q = [p0]
    for k in range(1, kinks + 1): Q.append(p0 + dirn * L * k / kinks + (side * rng.uniform(-1, 1) + up * rng.uniform(-1, 1)) * L * .12 * (k < kinks))
    out = []
    for a, b in zip(Q[:-1], Q[1:]): out.append(tube([a, b], r, r * .8, BOLT, 5))
    return out
def ring(c, ax, R, r, col, n=48):
    ax = nz(ax); u = nz(np.cross(ax, V3(0, 1, 0) if abs(ax[1]) < .9 else V3(1, 0, 0))); w = np.cross(ax, u)
    return tube([c + R * (np.cos(a) * u + np.sin(a) * w) for a in np.linspace(0, 2 * np.pi, n, endpoint=False)], r, r, col, 5, closed=True)
ORB_C, ORB_R = V3(0, .68, -.02), .67
def aura_parts():
    out = []
    if FORM == 'tar':                       # bolts crackling out round her chest + shoulders
        for k, (az, el, L_) in enumerate(((.5, .5, .30), (1.2, .1, .26), (2.0, .6, .24), (2.6, -.1, .28), (-.5, .45, .30), (-1.2, .05, .26), (-2.0, .55, .24), (-2.6, -.15, .28), (0, .9, .22))):
            dirn = V3(np.sin(az) * np.cos(el), np.sin(el), np.cos(az) * np.cos(el)); out += bolt(V3(0, .66, 0) + dirn * .36, dirn, L_, 10 + k)
    elif FORM == 'elle':                    # ribbons of current looping round her
        for k, (y0, tilt, R, ph) in enumerate(((.38, .22, .62, 0.), (.70, -.18, .70, 2.1), (1.36, .20, .42, 4.0))):
            t = np.linspace(0, 2 * np.pi, 72, endpoint=False); Q = np.stack([R * np.cos(t + ph), y0 + R * tilt * np.sin(t + ph) + .05 * np.sin(3 * t), R * .85 * np.sin(t + ph)], 1)
            out.append(tube(Q, .009, .009, RIB, 6, closed=True))
    elif FORM == 'cis':                     # the lightning orb: a cage of rings round her + bolts over its shell
        for a in np.radians([0, 45, 90, 135]): out.append(ring(ORB_C, V3(np.cos(a), 0, np.sin(a)), ORB_R, .007, ORB))
        for yy in (-.45, 0, .45): out.append(ring(ORB_C + V3(0, ORB_R * yy, 0), V3(0, 1, 0), ORB_R * np.sqrt(1 - yy * yy), .006, ORB))
        rng = np.random.default_rng(3)
        for k in range(7):
            th, ph = rng.uniform(0, 2 * np.pi), rng.uniform(-.2, 1.2); n_ = V3(np.cos(th) * np.cos(ph), np.sin(ph), np.sin(th) * np.cos(ph)); p0 = ORB_C + n_ * ORB_R * 1.01
            Q = [p0]
            for j in range(5): Q.append(ORB_C + nz(Q[-1] - ORB_C + V3(*rng.uniform(-.09, .09, 3)) - V3(0, .06, 0)) * ORB_R * 1.012)
            for a, b in zip(Q[:-1], Q[1:]): out.append(tube([a, b], .008, .007, BOLT, 5))
    elif FORM == 'lun':                     # sound rings spreading round her head, behind and to the sides
        hc = V3(0, .50, .30)
        for k, R in enumerate((.46, .60, .74)):
            t = np.linspace(np.radians(-25), np.radians(205), 60); zc = hc[2] - .12 - .12 * k
            Q = np.stack([R * np.cos(t), hc[1] + R * .80 * np.sin(t), zc - .10 * np.sin(t) ** 2], 1); Q[:, 1] = np.maximum(Q[:, 1], .12)
            out.append(tube(Q, .008, .008, RING, 5))
    return out
_glb = S.glb
def glb_with_aura(path, parts):
    aV, aF, aC = [], [], []; o = 0
    for v, f, col in aura_parts(): aV.append(v); aF.append(f + o); o += len(v); aC.append(np.tile((*lin(col), 255), (len(v), 1)))
    aV, aF, aC = np.vstack(aV), np.vstack(aF), np.vstack(aC).astype(np.uint8)
    parts = dict(parts, aura=(aV, aF, aC, S.normals(aV, aF))); print('aura tris', len(aF), 'y', aV[:, 1].min().round(3), aV[:, 1].max().round(3)); return _glb(path, parts)
S.glb = glb_with_aura
if __name__ == '__main__': LC.run(sys.modules[__name__], NAME)
