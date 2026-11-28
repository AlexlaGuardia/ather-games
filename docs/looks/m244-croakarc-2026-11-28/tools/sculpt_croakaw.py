"""M244 sheet 9: CROAKARC's four AWAKENED forms (Croakarkor / Croakarielle / Arcvik / Croakarcun), OWNER PREVIEW.
    python sculpt_croakaw.py <kor|ielle|arcvik|cun> <out.glb>
Canon: CANON/world/spirits-species.md 'Croakarc (Storm): Croakarkor . Croakarielle . **Arcvik** (Ace, pure) . Croakarcun'. Art LOCKED athernyx
assets/stage3/025-028 (PRIVATE, read for shape + colour, never copied here). Each starts from the LIVE Croakarc (m202-croakling-pass2 tools/
sculpt_croakarc.py, imported, never edited: the skink head with the Croakling's big eyes + smile, the pointed crest, the violet brow gem, the
dorsal spines, the glowing branching lightning veins) and re-shapes her by name:
  kor    CHAMPION: stands UP, heavy, armoured pauldrons, a toothy grin, a bulb LURE on a stalk, lightning crackling round her
  ielle  VIRTUOSO: stands up, slim, one hand raised palm up, a RING of glowing orbs on a thread of current round her
  arcvik ACE (pure Storm): stays a skink, leaner, a taller crest, a BOLT striking the ground ahead of her (starburst where it lands)
  cun    ENIGMA: sits up like a frog, eyes CLOSED, a flat hushed mouth; her lure floats FREE above her, a slow ball of lightning on one thread
Palette from the locked art (paler, silvery ice-blue than the live form). Parts: body, eyes (unlit: eyes, gem, veins, teeth, stalk, lashes),
AURA (unlit, the motif: per-colour bone in AURA_BONE, the rest on AURA_DEFAULT; rig_croakup.py / rig_arcvik.py)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-croakling-pass2-2026-11-27/tools'))
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['CROAKAW_FORM']
import sculpt_croakarc as SM
S, V3, su, ell, cone = SM.S, SM.V3, SM.su, SM.ell, SM.cone
lin, C = SM.lin, SM.C
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
mir = SM.mir
UPRIGHT = FORM != 'arcvik'
SM.PAL.update(lo='#7f9cba', hi='#d0dfec', belly='#eef4f8', pad='#c2d4e6', halo='#dcecff')   # the locked art's silvery ice-blue

# ── the skink head, moved + grown onto an upright body: TF takes a world point into the live head's own space ──
HC0 = V3(*SM.L['head'])
P_ = dict(
    kor=dict(HC=(0, .86, .10), hs=1.22, trunk=((0, .50, .00), (.235, .285, .195)), chest=((0, .66, .02), (.215, .15, .17)),
             HIP=(.135, .32, -.02), KNEE=(.180, .18, .07), ANK=(.170, .045, -.01), RL=(.080, .062),
             SHO=(.205, .69, .02), ELB=(.300, .52, .10), HND=(.320, .38, .18), RA=(.070, .056), FIST=.060,
             tail=[(0, .30, -.14), (0, .20, -.32), (0, .10, -.52), (0, .075, -.72), (0, .14, -.92), (0, .30, -1.02), (0, .44, -.98)], tr=[.12, .10, .075, .055, .040, .028, .014]),
    ielle=dict(HC=(0, .88, .08), hs=1.16, trunk=((0, .53, .00), (.155, .26, .145)), chest=((0, .68, .01), (.145, .12, .125)),
               HIP=(.100, .34, -.01), KNEE=(.120, .19, .06), ANK=(.115, .045, -.01), RL=(.056, .044),
               SHO=(.145, .71, .01), ELB=(.270, .80, .08), HND=(.330, .95, .14), RA=(.046, .036), FIST=.045,
               SHO2=(.145, .71, .01), ELB2=(.215, .54, .08), HND2=(.235, .41, .15),
               tail=[(0, .30, -.12), (0, .20, -.30), (0, .12, -.50), (0, .14, -.70), (0, .28, -.84), (0, .48, -.86), (0, .62, -.78)], tr=[.090, .072, .055, .040, .030, .020, .010]),
    cun=dict(HC=(0, .70, .09), hs=1.24, trunk=((0, .34, -.02), (.245, .28, .23)), chest=((0, .50, .03), (.21, .14, .17)),
             HIP=(.150, .18, -.06), KNEE=(.230, .17, .14), ANK=(.200, .045, .04), RL=(.085, .064),
             SHO=(.170, .52, .10), ELB=(.175, .31, .21), HND=(.115, .10, .29), RA=(.058, .046), FIST=.050,
             tail=[(0, .14, -.22), (0, .07, -.42), (0, .045, -.60), (.10, .045, -.74), (.26, .05, -.76), (.38, .06, -.62), (.40, .07, -.46)], tr=[.10, .08, .060, .045, .034, .024, .012]),
).get(FORM, {})
if UPRIGHT:
    HC, HS = V3(*P_['HC']), P_['hs']
    for k in ('HIP', 'KNEE', 'ANK', 'SHO', 'ELB', 'HND', 'SHO2', 'ELB2', 'HND2'):
        if k in P_: P_[k] = V3(*P_[k])
    if 'SHO2' not in P_: P_['SHO2'], P_['ELB2'], P_['HND2'] = P_['SHO'], P_['ELB'], P_['HND']
else:
    HC, HS = HC0.copy(), 1.0
TF = lambda P: (P - HC) / HS + HC0
IT = lambda q: (np.asarray(q, float) - HC0) * HS + HC
head0 = SM.head
def head_up(P): return head0(TF(P)) * HS

def legs_up(P):
    M = mir(P); a, b, c = P_['HIP'], P_['KNEE'], P_['ANK']; r0, r1 = P_['RL']
    d = su(cone(M, a, b, r0, r1), cone(M, b, c, r1, r1 * .78), .03)
    d = su(d, ell(M, c + V3(.01, -.020, .035), (r1 * 1.0, .026, r1 * 1.25)), .025)                       # a flat foot
    for k, a_ in enumerate(np.radians([-40, -8, 24])):                                                     # three toes with round pads
        df = nz(V3(np.sin(a_) + .15, 0, np.cos(a_))); p0 = c + V3(.01, -.030, .05); q = p0 + df * .085 * (1 + .25 * (P_['RL'][0] > .07))
        d = su(d, su(cone(M, p0, q, .016, .012), ell(M, q, (.022, .015, .022)), .006), .012)
    return d
def arm_side(M, S_, E_, H_):
    r0, r1 = P_['RA']; d = su(cone(M, S_, E_, r0, r1), cone(M, E_, H_, r1, r1 * .85), .025)
    d = su(d, ell(M, H_ + nz(H_ - E_) * .02, (P_['FIST'], P_['FIST'] * .8, P_['FIST'])), .02)
    for k, a_ in enumerate((-.6, 0, .6)):                                                                  # three round-padded fingers
        u = nz(H_ - E_); w = nz(np.cross(u, V3(0, 0, 1) if abs(u[2]) < .9 else V3(1, 0, 0))); q = H_ + u * (P_['FIST'] + .035) + w * a_ * .045
        d = su(d, su(cone(M, H_ + u * P_['FIST'] * .6, q, .014, .011), ell(M, q, (.017, .017, .017)), .005), .010)
    return d
def arms_up(P):
    """right arm (x < 0) may differ from the left (Croakarielle raises one hand)"""
    R = P * V3(-1, 1, 1)
    return np.minimum(arm_side(P, P_['SHO'], P_['ELB'], P_['HND']), arm_side(R, P_['SHO2'], P_['ELB2'], P_['HND2']))
TCU = S.catmull([(*a, r) for a, r in zip(P_.get('tail', []), P_.get('tr', []))], 6) if UPRIGHT else None
def tail_up(P):
    Q = P * V3(1.18, 1, 1); d = np.full(P.shape[:-1], 9.)
    for a, b in zip(TCU[:-1], TCU[1:]): d = np.minimum(d, cone(Q, a[:3], b[:3], a[3], b[3]))
    return d / 1.10
def pauldrons(P):
    """Croakarkor: a rounded armour plate over each shoulder, ridged, with three studs"""
    M = mir(P); c = P_['SHO'] + V3(.025, .055, -.005)
    d = ell(M, c, (.125, .085, .125)); d = np.maximum(d, -ell(M, c - V3(.02, .07, 0), (.115, .085, .12)))  # a shell, open underneath
    return su(d, ell(M, c + V3(.0, .075, 0), (.060, .022, .095)), .02)
def trunk_up(P):
    (c, r), (c2, r2) = P_['trunk'], P_['chest']
    d = su(ell(P, c, r), ell(P, c2, r2), .08)
    return su(d, cone(P, c2 + V3(0, .05, .02), HC - V3(0, .10 * HS, .07 * HS), .12 * HS, .10 * HS), .07)  # the neck
def body0_up(P):
    b = su(trunk_up(P), head_up(P), .07); b = su(b, legs_up(P), .045); b = su(b, arms_up(P), .040); b = su(b, tail_up(P), .06)
    if FORM == 'kor': b = su(b, pauldrons(P), .012)
    return b

if UPRIGHT:
    SM.body0 = body0_up; SM.head = head_up
    def march(p, d, n=90):
        p = np.asarray(p, float); d = nz(d)
        for _ in range(n): p = p + d * np.clip(body0_up(p[None])[0], -.03, .03) * .9
        return p
    back = [march((0, y, -.9), (0, 0, 1)) for y in np.linspace(HC[1] - .02, .36, 7)]
    tl = [march((t[0], .9, t[2]), (0, -1, 0)) for t in TCU[6::5][:9]]
    SPN = back + tl; SPH = list(np.linspace(.040, .034, len(back))) + list(np.linspace(.032, .014, len(tl)))
    SPG = [nz(np.array([body0_up((p + np.eye(3)[i] * 2e-3)[None])[0] - body0_up((p - np.eye(3)[i] * 2e-3)[None])[0] for i in range(3)])) for p in SPN]
    def spines(P):
        d = np.full(P.shape[:-1], 9.)
        for p, g, hh in zip(SPN, SPG, SPH):
            d = np.minimum(d, cone(P, p - g * .015, p + g * hh + V3(0, .006, -.006), .020, .003))
        return d
    def field(P): return su(body0_up(P), SM.box(spines, P, V3(-.07, .0, -1.2), V3(.07, 1.3, .3)), .012)
else:
    # ARCVIK: the live skink, leaner (a racer), a taller swept crest
    def trunk_ar(P):
        b = ell(P, (0, .200, -.09), (.140, .108, .40))
        return su(b, cone(P, (0, .210, .22), (0, .200, -.40), .102, .094), .06)
    def head_ar(P): return su(head0(P), cone(P, (0, .330, .395), (0, .560, .250), .074, .006), .05)
    SM.trunk = trunk_ar; SM.head = head_ar
    SM.SPN = [SM.march_down(0, z) for z in (.26, .14, .02, -.10, -.22, -.34, -.48, -.62, -.76, -.90, -1.03)]
    SM.SPH = [h * 1.25 for h in SM.SPH]
    field = SM.field
SM.field = field
grad, onto = SM.grad, SM.onto

# ── the lightning veins on her skin (as the live form: thin unlit tubes + a pale halo in the skin) ──
EYE_C = [IT(V3(s * .118, .315, .475)) for s in (1, -1)]
def ok_pt(p):
    if p[1] < .07: return False
    if min(np.linalg.norm(p - e) for e in EYE_C) < .10 * HS: return False
    q = TF(p); return not (q[2] > .48 and q[1] < .26 and abs(q[0]) < .16)                                   # keep clear of the mouth
def bolts_up(seed=44):
    rng = np.random.default_rng(seed); out = []
    (c, r) = P_['trunk']
    seeds = [V3(*c) + nz(rng.normal(size=3)) * .5 for _ in range(18)] + [HC + nz(rng.normal(size=3) * (1, 1, .4) - V3(0, 0, .6)) * .4 for _ in range(4)] + [V3(*t[:3]) + V3(0, .3, 0) for t in TCU[8::10]]
    def walk(p, d, n, depth):
        pts = [p]
        for k in range(n):
            g = grad(p[None])[0]; nrm = g / np.linalg.norm(g); d = d - (d @ nrm) * nrm; d /= np.linalg.norm(d)
            a = rng.uniform(-.55, .55) * (1.6 if rng.random() < .25 else 1); b = np.cross(nrm, d); d2 = np.cos(a) * d + np.sin(a) * b
            q = onto((p + d2 * rng.uniform(.028, .042))[None])[0]
            if not ok_pt(q): break
            pts.append(q); p = q
            if depth < 2 and rng.random() < (.22 if depth == 0 else .12):
                b2 = np.cross(nrm, d); walk(p, d + b2 * rng.choice([-1, 1]) * 1.2, int(rng.integers(3, 7 - depth)), depth + 1)
        if len(pts) > 2: out.append(np.array(pts))
    for s in seeds:
        p = onto(s[None])[0]
        if not ok_pt(p): continue
        g = grad(p[None])[0]; t = np.cross(g, rng.normal(size=3)); walk(p, t / np.linalg.norm(t), int(rng.integers(8, 14)), 0)
    return out

# ── colour classes (positive inside); later classes win ──
ORDER = ('belly', 'pad', 'armor', 'armrim', 'halo', 'mouth', 'nose')
SM.PAL.update(armor='#9cb2c8', armrim='#e2ecf6', mouth='#2e4a72' if FORM != 'kor' else '#7a2c3c', nose='#34507a')
BOLTS = None
def classes(V):
    x, y, z = V.T; A = np.abs(x); q = TF(V); qx, qy, qz = q.T; qA = np.abs(qx); out = []
    if UPRIGHT:
        (c, r) = P_['trunk']; lo_y = .16 if FORM != 'cun' else .08
        out.append(np.minimum.reduce([z - (c[2] + .07 - .25 * np.clip(A - .06, 0, 1)), .15 - A, y - lo_y, (HC[1] - .10 * HS) - y]))  # the pale belly + throat
        out.append(np.where(y < .028, 1., -1.))                                                                 # foot pads
    else:
        out.append(np.minimum.reduce([.150 - y + .05 * np.clip(A - .05, 0, 1), .118 - A + .3 * np.clip(.20 - y, 0, .1), z + .46, .60 - z]))
        out.append(np.where((y < .040) & (A > .20), 1., -1.))
    if FORM == 'kor': pd = pauldrons(V); out.append(.006 - pd); out.append(np.minimum(.006 - pd, V[:, 1] - (P_['SHO'][1] + .095)))   # steel plates, a pale ridge
    else: out += [np.full(len(V), -1.), np.full(len(V), -1.)]
    out.append(np.where(y > .06, .0095 - SM.seg_dist(V, BOLTS), -1.))
    sm = .200 + .95 * qx ** 2
    if FORM == 'kor': out.append(np.minimum.reduce([np.minimum(qy - (sm - .034), sm + .004 - qy), .150 - qA, qz - .48]))   # the wide open grin
    elif FORM == 'cun': out.append(np.full(len(V), -1.))                                                     # hushed: the flat mouth is a line (eyes part)
    else: out.append(np.minimum.reduce([.0085 - np.abs(qy - sm), .150 - qA, qz - .50]))
    out.append(.0095 - np.sqrt((qA - .036) ** 2 + (qy - .245) ** 2 + (qz - .655) ** 2 * .2))
    return out

def tube(Q, r0, r1, col, sides=6):
    Q = np.asarray(Q, float); n = len(Q); t = np.gradient(Q, axis=0); t /= np.linalg.norm(t, axis=1, keepdims=True)
    a0 = nz(np.cross(t[0], V3(0, 1, 0) if abs(t[0][1]) < .9 else V3(1, 0, 0))); P, F = [], []
    for i in range(n):
        u = nz(np.cross(t[i], a0) if i else a0 - (a0 @ t[0]) * t[0]); u = nz(np.cross(np.cross(t[i], a0), t[i])); w = np.cross(t[i], u); r = r0 + (r1 - r0) * i / max(1, n - 1)
        for j in range(sides): a = 2 * np.pi * j / sides; P.append(Q[i] + r * (np.cos(a) * u + np.sin(a) * w))
    for i in range(n - 1):
        for j in range(sides):
            a, b, c, d = i * sides + j, i * sides + (j + 1) % sides, (i + 1) * sides + j, (i + 1) * sides + (j + 1) % sides; F += [(a, c, b), (b, c, d)]
    return np.array(P), np.array(F), col
def sphere(c, r, col, sub=2, sc=(1, 1, 1)):
    import trimesh
    b = trimesh.creation.icosphere(subdivisions=sub, radius=r); return b.vertices * sc + c, np.array(b.faces), col
def jag(a, b, n, amp, rng):
    a, b = V3(*a), V3(*b); t = np.linspace(0, 1, n); P = a + np.outer(t, b - a); d = nz(b - a)
    w1 = nz(np.cross(d, V3(0, 0, 1) if abs(d[2]) < .9 else V3(1, 0, 0))); w2 = np.cross(d, w1)
    off = rng.uniform(-amp, amp, (n, 2)); off[0] = off[-1] = 0
    return P + off[:, :1] * w1 + off[:, 1:] * w2
def surf(p0, d):   # first body-surface point along a ray (d) from p0
    p = np.asarray(p0, float); d = nz(d)
    for _ in range(120): p = p + d * np.clip(field(p[None])[0], -.02, .02) * .9
    return onto(p[None])[0]

BOLT, BOLT2, ORB, ORBH, THREAD, BULB, BULBH, STAR = (236, 248, 255), (200, 230, 255), (255, 236, 160), (255, 252, 230), (214, 240, 255), (190, 240, 255), (246, 255, 255), (255, 255, 240)
AURA_DEFAULT = 'root'
AURA_BONE = dict(kor={BOLT: 'chest', BOLT2: 'chest', BULB: 'head', BULBH: 'head'}, ielle={ORB: 'chest', ORBH: 'chest', THREAD: 'chest'},
                 arcvik={}, cun={BULB: 'float', BULBH: 'float', THREAD: 'float'})[FORM]   # the strike (Arcvik) stands on the ground ahead of her (root)
def eyes_parts():
    out = []
    ec_iris = (46, 104, 204)
    for s in (1, -1):
        u = V3(s * .62, .42, .66); u /= np.linalg.norm(u); p = IT(V3(s * .118, .315, .475))
        for _ in range(60): p = p + u * np.clip(-field(p[None])[0], -.02, .02) * .8
        p = onto(p[None])[0]; g = grad(p[None])[0]; g /= np.linalg.norm(g)
        if FORM == 'cun':   # CLOSED: the lid (body tone) shut over the eye, a soft lash arc
            out.append(sphere(p - g * .020 * HS, .072 * HS, (170, 192, 216), 3))
            up = nz(np.cross(g, np.cross(V3(0, 1, 0), g))); side = nz(np.cross(up, g))
            Q = [p + g * .046 * HS + side * x * HS - up * (.012 - 3.2 * x * x) * HS for x in np.linspace(-.055, .055, 11)]
            out.append(tube(Q, .006 * HS, .006 * HS, (40, 60, 96), 6)); continue
        for c, r, col, sub in ((p - g * .020 * HS, .074 * HS, (190, 210, 236), 3), (p + g * .004 * HS, .056 * HS, ec_iris, 3), (p + g * .030 * HS, .036 * HS, (10, 14, 22), 3),
                               (p + g * .064 * HS + V3(s * .010, .016, 0) * HS, .012 * HS, (255, 255, 255), 1), (p + g * .062 * HS + V3(-s * .012, -.012, 0) * HS, .006 * HS, (214, 236, 255), 1)):
            out.append(sphere(c, r, col, sub))
        if FORM == 'kor':   # a hard brow over each eye: a fierce, low-inside line
            up = nz(np.cross(g, np.cross(V3(0, 1, 0), g))); side = nz(np.cross(up, g)) * s
            Q = [p + g * .050 * HS + up * (.050 + .045 * t) * HS + side * (-.05 + .10 * t) * HS for t in np.linspace(0, 1, 8)]
            out.append(tube(Q, .010 * HS, .007 * HS, (40, 62, 100), 6))
    p = onto(IT(V3(.0, .33, .50))[None])[0]; g = grad(p[None])[0]; g /= np.linalg.norm(g)                   # the violet brow gem
    for c, r, col in ((p + g * .002, .028 * HS, (170, 112, 236)), (p + g * .016 * HS, .012 * HS, (236, 214, 255))):
        out.append(sphere(c, r, col, 2, (1, 1, .55)))
    if FORM == 'kor':   # teeth along both lips of the open grin, and the lure stalk up off her brow
        for row, off, dirn in (('up', .002, -1), ('lo', .038, 1)):
            for x in np.linspace(-.12, .12, 9):
                q = V3(x, .200 + .95 * x * x + (.0 if row == 'up' else -.036), .70); pp = surf(IT(q), V3(0, 0, -1) + V3(0, 0, 0)); g = grad(pp[None])[0]; g /= np.linalg.norm(g)
                tip = pp + V3(0, dirn * .028 * HS, 0) + g * .006; out.append(tube([pp + g * .004, tip], .011 * HS, .002, (250, 252, 255), 5))
        top = onto(IT(V3(0, .40, .47))[None])[0]; Q = [top + V3(0, .0, 0) + V3(0, .16, .05) * t + V3(0, 0, .03) * np.sin(np.pi * t) for t in np.linspace(0, 1, 9)]
        out.append(tube(Q, .013, .008, (206, 226, 246), 6)); globals()['LURE_TOP'] = Q[-1]
    if FORM == 'cun':   # a flat, hushed mouth line
        Q = [surf(IT(V3(x, .205 + .25 * x * x, .70)), V3(0, 0, -1)) for x in np.linspace(-.10, .10, 9)]; Q = [q + grad(q[None])[0] / np.linalg.norm(grad(q[None])[0]) * .004 for q in Q]
        out.append(tube(Q, .0055, .0055, (40, 60, 96), 5))
    tv, tf = SM.vein_tubes(BOLTS); out.append((tv, tf, SM.VEIN))
    return out
def aura_parts():
    rng = np.random.default_rng(7); out = []
    if FORM == 'kor':
        c = LURE_TOP + V3(0, .045, 0); out += [sphere(c, .055, BULB, 3), sphere(c, .030, BULBH, 2)]               # the glowing bulb on the stalk
        for k in range(7):                                                                                           # lightning crackling out from her
            a = 2 * np.pi * k / 7 + .3; y0 = .25 + .5 * rng.random(); s = V3(np.cos(a) * .30, y0, np.sin(a) * .24); e = s + V3(np.cos(a) * .32, rng.uniform(-.25, .30), np.sin(a) * .28)
            Q = jag(s, e, 9, .045, rng); out.append(tube(Q, .010, .004, BOLT, 5))
            m = Q[4]; Q2 = jag(m, m + V3(np.cos(a + .8) * .14, rng.uniform(-.15, .1), np.sin(a + .8) * .14), 5, .025, rng); out.append(tube(Q2, .006, .002, BOLT2, 5))
    elif FORM == 'ielle':
        ctr, R = V3(-.02, .80, -.06), .50; tl = np.radians(28)
        ring = lambda a: ctr + R * V3(np.cos(a), np.sin(a) * np.cos(tl), -np.sin(a) * np.sin(tl))                    # a standing ring round her, over her head, leaning back
        A = np.linspace(0, 2 * np.pi, 120); Q = np.array([ring(a) + V3(0, .012 * np.sin(9 * a), 0) for a in A]); out.append(tube(Q, .0055, .0055, THREAD, 5))
        for k in range(9):
            a = 2 * np.pi * k / 9 + .2; out += [sphere(ring(a), .048, ORB, 2), sphere(ring(a), .024, ORBH, 1)]
        h = P_['HND'] + V3(.03, .07, .03); out += [sphere(h, .040, ORB, 2), sphere(h, .020, ORBH, 1)]                # one resting over her raised palm
        b = surf(V3(0, .50, .6), V3(0, 0, -1)) + V3(0, 0, .045); out += [sphere(b, .036, ORB, 2), sphere(b, .018, ORBH, 1)]   # and the one glowing at her belly
    elif FORM == 'arcvik':
        g0 = V3(.06, .0, 1.05); top = V3(.30, 1.45, 1.30)
        Q = jag(top, g0 + V3(0, .01, 0), 16, .07, rng); out.append(tube(Q, .022, .012, BOLT, 6)); out.append(tube(Q + V3(0, 0, .002), .010, .006, STAR, 5))
        for i in (5, 9):
            m = Q[i]; Q2 = jag(m, m + V3(rng.uniform(-.3, .3), -.32, rng.uniform(-.1, .2)), 6, .04, rng); out.append(tube(Q2, .010, .003, BOLT2, 5))
        for k in range(10):                                                                                          # the starburst where it lands
            a = 2 * np.pi * k / 10; L = .16 if k % 2 else .26; out.append(tube([g0 + V3(0, .012, 0), g0 + V3(np.cos(a) * L, .012 + .05 * (k % 2 == 0), np.sin(a) * L)], .016, .002, STAR, 4))
        out.append(sphere(g0 + V3(0, .02, 0), .045, STAR, 2, (1, .5, 1)))
    elif FORM == 'cun':
        c = V3(.02, 1.36, .18); out += [sphere(c, .13, BULB, 3), sphere(c, .075, BULBH, 2)]                         # her lure, floating free: a slow ball of lightning
        top = onto(IT(V3(0, .45, .38))[None])[0]; Q = jag(c - V3(0, .12, 0), top + V3(0, .02, 0), 12, .022, rng); out.append(tube(Q, .0065, .0045, THREAD, 5))   # tethered by one thread
    return out

def join(parts):
    Vs, Fs, Cs, o = [], [], [], 0
    for v, f, col in parts: Vs.append(v); Fs.append(np.asarray(f) + o); o += len(v); Cs.append(np.tile(lin(col), (len(v), 1)))
    return np.vstack(Vs), np.vstack(Fs).astype(int), np.vstack(Cs)
def finish(V, Fa, path):
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(Fa), -1); pal = [C(SM.PAL[k]) for k in ORDER]
    for k in range(len(ORDER)):
        V, Fa, lab, side = S.cut(V, Fa, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = .004; N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(SM.PAL['lo']) * (1 - sh[g]) + C(SM.PAL['hi']) * sh[g]
    eV, eF, eC = join(eyes_parts()); aV, aF, aC = join(aura_parts())
    S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=(eV, eF, eC.astype(np.uint8), S.normals(eV, eF)), aura=(aV, aF, aC.astype(np.uint8), S.normals(aV, aF))))
    print(FORM, 'body tris', len(FF), 'eyes tris', len(eF), 'aura tris', len(aF), 'bolts', len(BOLTS), 'bounds', VV.min(0).round(3).tolist(), VV.max(0).round(3).tolist())

def build(out, tris=11000):
    global BOLTS
    import trimesh
    from marching import surface
    BOLTS = bolts_up() if UPRIGHT else SM.bolts()
    SM.BOLTS = BOLTS
    def decimate(V, F, n):
        import fast_simplification as fs
        best = None
        for agg in (3, 4, 5, 6):
            for k in (1, .95, 1.05, .9, 1.1):
                v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=int(n * k), agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices()
                c = np.unique(t.edges_sorted, axis=0, return_counts=True)[1]
                if t.body_count == 1 and (c % 2).sum() == 0 and len(t.faces) < n * 1.4:
                    p = int((c > 2).sum()); best = (p, t) if best is None or p < best[0] else best
                    if p == 0: return t
        if best is None: raise SystemExit('no closed decimation')
        print('pinched edges', best[0]); return best[1]
    if UPRIGHT: lo, hi, h = V3(-.55, -.033, -1.10), V3(.55, 1.30, .62), .0072
    else: lo, hi, h = V3(-.42, -.033, -1.50), V3(.42, .66, .70), .0065
    Vr, Fr = surface(field, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight)
    parts = m.split(only_watertight=False); k = max(parts, key=lambda c: len(c.faces)); print('dropped crumbs', len(parts) - 1)
    t = decimate(k.vertices, k.faces, tris); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count)
    finish(np.array(t.vertices), np.array(t.faces), out)
if __name__ == '__main__': build(sys.argv[2], 12000 if UPRIGHT else 11000)
