"""M202 LEPNIX'S OWN GAIT (2026-11-28): the unicorn foal stands on four legs, so she gets a four-legged clip set in place of the base
rabbit's hops + two-paw groom. rig_lep.py splices this file into the base rig (after its pose helpers, before its clip loop) for lepnix
only: same 20 bones + names, her joints already moved onto the foal body (rig_lep.py FOAL).
Each leg is a TWO-BONE IK with NO STRETCH (the rabbit's stub leg was drawn out up to 2.7x): forelegs arm_ (shoulder) -> paw_ (knee) ->
hoof, knee bends forward; hind legs thigh_ (hip) -> foot_ (hock) -> hoof, hock bends back. A target past the leg's reach is clipped.
  idle  weight shift, breath, looks round, ears swivel, tail swish, ONE foreleg paws the ground, a sniff, blinks, the twitchy nose
  walk  a four-beat walk (LH, LF, RH, RF a quarter apart), head nods
  run   a TROT: diagonal pairs (LF+RH, RF+LH) half a cycle apart, a small level bob (no hop), tail up, ears back
  sit   a foal's sit: rump lowered onto folded hind legs, forelegs straight (no grooming)
  lie   asleep on folded legs, head low, ears back, lids shut
idle / sit / lie end in ground(p, 0) (her lowest point on the ground in every key); walk / run are only lifted out if a point sinks."""
DEM = []                                                           # reach demand (target distance / leg length) before the clip
def hoof0(s, fore): return J(('paw_' if fore else 'foot_') + s) + ((0, -.14, .01) if fore else (0, -.12, .03))
def leg2(p, s, fore, tgt, bend=None):
    """place the hoof end of the leg on `tgt` (model space) by turning the two bones only (no joint moves, so no stretch)"""
    up, lo = ('arm_' if fore else 'thigh_') + s, ('paw_' if fore else 'foot_') + s
    Rp = p.glob(SK[up][0])[0]; A = p.glob(up)[1]; ju, jl, je = J(up), J(lo), hoof0(s, fore); tgt = np.asarray(tgt, float)
    l1, l2 = np.linalg.norm(jl - ju), np.linalg.norm(je - jl); d = tgt - A; D = np.linalg.norm(d); u = d / D; DEM.append(D / (l1 + l2))
    Dc = float(np.clip(D, abs(l1 - l2) * 1.02, (l1 + l2) * .999)); x = (l1 * l1 - l2 * l2 + Dc * Dc) / (2 * Dc); h = np.sqrt(max(0., l1 * l1 - x * x))
    n = np.array(bend if bend is not None else ((0, 0, 1) if fore else (0, 0, -1)), float); n = n - (n @ u) * u; n /= np.linalg.norm(n)
    Kn = A + u * x + n * h; E = A + u * Dc
    R1 = K.align(Rp @ (jl - ju), Kn - A) @ Rp; R2 = K.align(R1 @ (je - jl), E - Kn) @ R1
    p.R[up] = Rp.T @ R1; p.R[lo] = R1.T @ R2; p.T[lo] = np.zeros(3); ST.append(1.0)
LEGS = [(s, f) for f in (True, False) for s in ('l', 'r')]
def plant(p, fore_dz=0., hind_dz=0., spread=0.):
    for s, f in LEGS: q = hoof0(s, f); leg2(p, s, f, (q[0] * (1 + spread), .03, q[2] + (fore_dz if f else hind_dz)))
def idle(u):
    """weight shift, breath, looks round, ears swivel, tail swish, ONE foreleg paws the ground (twice), a sniff, blinks, nose twitch"""
    p = Pose(SK); br = np.sin(TAU * u * 3); p.T['root'] = np.array([.004 * np.sin(TAU * u * 2), -.012, 0]); p.R['root'] = rz(.012 * np.sin(TAU * u * 2)); breathe(p, br)
    lk = pulse(u, .12, .18, .32, .38); sn = pulse(u, .70, .75, .84, .89)
    p.rot('chest', rx(.08 * sn)); p.rot('neck', ry(.16 * lk), rx(.14 * sn)); p.rot('head', ry(.20 * lk), rx(.12 * sn + .02 * br), rz(.08 * pulse(u, .40, .44, .52, .56)))
    el, er_ = pulse(u, .20, .24, .34, .38), pulse(u, .44, .48, .58, .62); ears(p, .30 * el - .10 * er_, -.30 * er_ + .05 * el, 0, .05 * np.sin(TAU * u * 2))
    p.rot('tail', ry(.22 * np.sin(TAU * u * 3)), rx(.06 * np.sin(TAU * u * 1.5)))
    lids(p, blink(u, .09, .40, .62, .93)); twitch(p, max(pulse(u, .03, .05, .30, .33), pulse(u, .70, .72, .84, .86), .35), u, 48)
    pw = pulse(u, .44, .47, .60, .63); sc = np.sin(TAU * (u - .47) / .065)                     # paw: the left foreleg lifts and scrapes twice
    for s, f in LEGS:
        q = hoof0(s, f); y, z = .03, q[2]
        if f and s == 'l': y += pw * (.040 + .012 * sc); z += pw * (.035 * sc + .01)
        leg2(p, s, f, (q[0], y, z))
    return ground(p, 0)
WALK = dict(v=.6, duty=.65, reach=.085, n=32, strike={'foot_l': 0., 'arm_l': .25, 'foot_r': .5, 'arm_r': .75}, lift=.035, drop=.020, bob=.004)
RUN = dict(v=2.8, duty=.32, reach=.110, n=30, strike={'arm_l': 0., 'foot_r': 0., 'arm_r': .5, 'foot_l': .5}, lift=.050, drop=.028, bob=.007)
for G in (WALK, RUN): G['start'] = {k.replace('arm_', 'paw_'): (1 - v) % 1 for k, v in G['strike'].items()}   # foot bone -> clip phase her stance starts
def gait(u, G, lean, earb, nod, tailup):
    """every hoof on its own phase: planted for `duty` (slides back +reach -> -reach under her as she moves), then lifted and swung forward"""
    p = Pose(SK); k = u % 1; d = G['duty']; r = G['reach']
    p.T['root'] = np.array([0, -G['drop'] + G['bob'] * np.cos(TAU * 2 * k), 0]); p.R['root'] = rx(lean)
    p.rot('chest', rx(.02 * np.sin(TAU * 2 * k))); p.rot('neck', rx(-lean * .6 + nod * np.sin(TAU * 2 * k - .5))); p.rot('head', rx(-lean * .4 - .5 * nod * np.sin(TAU * 2 * k - .9)))
    ears(p, -earb, -earb, .3 * earb, .03); p.rot('tail', rx(tailup + .05 * np.sin(TAU * 2 * k)), ry(.10 * np.sin(TAU * k)))
    for s, f in LEGS:
        q = (k - G['strike'][('arm_' if f else 'foot_') + s]) % 1; h0 = hoof0(s, f)
        if q < d: z = r * (1 - 2 * q / d); y = .03
        else: w = (q - d) / (1 - d); z = -r + 2 * r * sm(0, 1, w); y = .03 + G['lift'] * np.sin(np.pi * w) ** 1.5
        leg2(p, s, f, (h0[0] + (.004 if f else .002) * (1 if s == 'l' else -1), y, h0[2] + z))
    l = low(p)                                                     # lifted out if anything sinks, never pulled down: the trot's
    if l < 0: p.T['root'] = p.T['root'] + np.array([0, -l, 0])     # moment of suspension stays (a float of a few mm, not a hop)
    return p
walk = lambda u: gait(u, WALK, .00, .05, .030, .05)
run = lambda u: gait(u, RUN, .06, .45, .018, .35)
def sit(u):
    """a foal's sit: the rump lowers onto folded hind legs (body pitched up about the shoulders), forelegs straight and planted, looks about, no grooming"""
    p = Pose(SK); br = np.sin(TAU * u * 2); a = -.62; Rr = rx(a); c = np.array([0, .33, -.02]); p.R['root'] = Rr; p.T['root'] = c - Rr @ c + np.array([0, -.02, 0]); breathe(p, br)
    lk = pulse(u, .25, .32, .50, .57); p.rot('chest', rx(-a * .30)); p.rot('neck', rx(-a * .35), ry(.18 * lk)); p.rot('head', rx(-a * .30 + .03 * br), ry(.18 * lk), rz(.10 * pulse(u, .62, .66, .74, .78)))
    ears(p, .15 * pulse(u, .30, .34, .46, .50), -.10, 0, .05 * np.sin(TAU * u)); lids(p, max(blink(u, .15, .55, .85), .25)); twitch(p, .35, u, 30)
    p.rot('tail', rx(.95), ry(.35 + .08 * np.sin(TAU * u * 2)))
    for s in ('l', 'r'):
        q = hoof0(s, True); leg2(p, s, True, (q[0], .03, q[2] + .03))
        q = hoof0(s, False); leg2(p, s, False, (q[0] * 1.15, .03, -.09), (0, -.5, -1))
    return ground(p, 0)
def lie(u):
    """asleep on folded legs: body lowered, forelegs folded under the chest, hind legs folded to the side, head low, ears back, lids shut"""
    p = Pose(SK); br = np.sin(TAU * u); p.T['root'] = np.array([0, -.17, 0]); p.T['chest'] = np.array([0, .004 * br, 0]); p.rot('chest', rx(.12))
    p.rot('neck', rx(.24)); p.rot('head', rx(.20 + .01 * br), rz(.08)); ears(p, -1.2, -1.15, .3, -.1); lids(p, 1); twitch(p, .15, u, 10)
    p.rot('tail', rx(1.10), ry(.6))
    for s in ('l', 'r'):
        x = 1 if s == 'l' else -1; q = hoof0(s, True); leg2(p, s, True, (q[0], .03, -.10), (0, -1, 1))
        q = hoof0(s, False); leg2(p, s, False, (q[0] + x * .06, .03, -.12), (x * .8, -.4, -1))
    return ground(p, 0)
