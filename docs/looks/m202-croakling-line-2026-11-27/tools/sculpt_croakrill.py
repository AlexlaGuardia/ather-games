"""M202 CROAKRILL (Croakling's Water form; locked art athernyx assets/stage2/008-croakrill.png, looked at, never traced, never in this repo).
python sculpt_croakrill.py <out.glb>. Starts from the base Croakling (croak_common.base()); what is HERS, not the base's:
  a TALLER, sleeker WATER body: a smooth droplet torso, leaning a little forward like a swimmer about to slip in, high on long arms;
  a smaller jaw; bigger glossy eyes that are nearly all pupil;
  GILL FRONDS (pass 2, Alex 11-27 "they should flow: soft, layered, not stiff spikes"): four soft flat RIBBONS a side off the back of
  her cheek, layered one over the next, each drifting back and down in a gentle S and thinning to a wisp;
  LONG WEBBED toes (fingers and toes 1.3x, full webs between them); her coat WATER, not paint: deep teal along the back running to
  aqua flanks, pale flowing ripple lines over it (canon Second Form Water: "flowing patterns, aquatic adaptation"), a few dark teal
  spots (the art's); a pale lime belly; the lure's orb a cool CYAN water drop."""
import sys, numpy as np
import croak_common as C
from croak_common import cone, ell, su, ss, V3
S = C.base()
S.TC, S.TR = V3(0, .33, -.05), V3(.30, .33, .25)                               # taller, narrower: a droplet
S.HC, S.HR = V3(0, .58, .09), V3(.32, .18, .26)
S.EBC = V3(.190, .735, .145); S.RE = .092; S.KE = S.RE / .066                    # bigger eyes, higher
S.L0, S.L1, S.L2 = V3(0, .745, -.01), V3(-.12, 1.16, .06), V3(-.40, .985, .22); S.ORB, S.ORBR = V3(-.424, .898, .250), V3(.088, .092, .088)
S.ARM = ((.205, .420, .185), (.215, .070, .315)); S.HAND = V3(.226, .030, .345)
S.FINGERS = [(a, L * 1.32) for a, L in S.FINGERS]; S.TOES = [(a * 1.1, L * 1.38) for a, L in S.TOES]
S.HAUNCH, S.HAUNCHR = V3(.290, .215, -.095), V3(.150, .165, .205); S.FOOT = V3(.395, .030, .125); C.retip(S)
S.SMILE_Y = .475; S.BOUNDS = (V3(-.62, -.033, -.62), V3(.62, .95, .60))
_torso = S.torso
def torso(M):                                                                    # the droplet: a smooth tapering back swelling into the rump
    return su(_torso(M), ell(M, (0, .52, -.12), (.20, .17, .20)), .10)
S.torso = torso
# the fronds: (root, sweep back, drop, flare out, length, root width); each a flat ribbon on a gentle S
FR = [((.265, .640, -.02), .34, .17, .13, .38, .050), ((.285, .590, -.01), .38, .25, .16, .44, .054),
      ((.290, .540, .00), .36, .29, .18, .40, .048), ((.270, .495, -.03), .28, .26, .14, .30, .040)]
def ribbon(root, back, drop, out, ln, w0, n=17):
    """points, tangents, widths and frame along one frond: back along -z, down, out to the side, an S-wave in its own plane"""
    t = np.linspace(0, 1, n); r = V3(*root)
    P = np.c_[r[0] + out * t ** .8 + .028 * np.sin(np.pi * 2 * t) * t, r[1] - drop * t ** 1.4 + .022 * np.sin(np.pi * 2.2 * t + .4), r[2] - back * t * ln / .4]
    T = np.gradient(P, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True); N = np.cross(T, V3(0, 1, 0)); N /= np.linalg.norm(N, axis=1, keepdims=True)
    Wd = np.cross(N, T); w = w0 * (1 - t) ** .7 * (.55 + .45 * np.sin(np.pi * np.clip(t * 1.3 + .15, 0, 1))) + .006
    return P, T, Wd, N, w, t
RIB = [ribbon(*f) for f in FR]
def fronds(M):
    d = np.full(M.shape[:-1], 9.)
    for P, T, Wd, N, w, t in RIB:
        sl = np.linalg.norm(P[1] - P[0])
        for i in range(len(P)):
            R = np.c_[T[i], Wd[i], N[i]]; d = np.minimum(d, ell(M, P[i], (sl * 1.5, w[i], .016 - .006 * t[i]), R))
    return d
def frond_d(V):
    M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; return fronds(M)
_head = S.head
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, (0, .515, .16), (.30, .110, .215)), .05); d = su(d, ell(M, S.EBC, (.124, .118, .118)), .05)
    return su(d, fronds(M), .018)
S.head = head
def throat(M): return ell(M, (0, .445, .235), (.215, .085, .125))
S.throat = throat
def webs(M):
    d = 9
    for c, tp in ((S.HAND, S.FT_TIPS), (S.FOOT, S.TOE_TIPS)):
        for a, b in zip(tp[:-1], tp[1:]):                                          # a full web from the palm out between each pair of toes
            m = (V3(*a) + V3(*b)) / 2 * .72 + c * .28; d = np.minimum(d, ell(M, m, (.066, .010, .066)))
    return d
_pads = S.pads
S.pads = lambda M: np.minimum(_pads(M), webs(M))
S.SKIN, S.BELLY, S.PAD = map(S.C8, ('#4fc6b0', '#e3ee9e', '#8fe2c8')); S.HEADC = S.SKIN
DEEP, RIPPLE, SPOT, FROND, FTIP = map(S.C8, ('#2a9a96', '#b8f4ea', '#1f6f6a', '#7fdcd2', '#c6faf2'))
S.STALK, S.BULB, S.CAP, S.MOUTH = (52, 128, 116), (150, 246, 236), (64, 168, 158), (24, 82, 66)
C.eye_palette(S, rim=(40, 120, 104), iris=(36, 70, 72), hi=(250, 255, 255), hi2=(200, 240, 236))
SP = C.surf_pts(S, 26, 8, lambda P: (P[:, 1] > .18) & (P[:, 2] < .10) & (P[:, 1] < .62))
_classes = S.classes
def classes(V):
    out = _classes(V); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; belly = out[0] > 0; low = V[:, 1] < .06
    fd = frond_d(V); onf = fd < .006; body = ~belly & ~low & ~onf
    out.append(np.where(body, np.clip(V[:, 1] - .30 - .9 * M[:, 0] ** 2 + .05 * np.sin(9 * V[:, 2]), -.05, .05), -.05))          # deep teal back
    rip = np.sin(26 * V[:, 1] + 7 * np.sin(6 * V[:, 2] + 5 * M[:, 0]) + 4 * M[:, 0])                                                # flowing ripple lines
    out.append(np.where(body & (V[:, 1] > .14), C.marks(V, rip * .028, .0055), -.05))
    d = np.min(np.linalg.norm(M[:, None] - np.c_[np.abs(SP[:, 0]), SP[:, 1:]][None], axis=2), 1)
    out.append(np.where(body, np.clip(.022 - d, -.05, .05), -.05))                                                                    # a few dark spots
    out.append(np.where(onf, .05, -.05))                                                                                              # the fronds, paler
    tt = np.full(len(V), -.05)
    for P, *_ in RIB: tt = np.maximum(tt, np.where(onf, np.clip(.12 - np.min(np.linalg.norm(M[:, None] - P[-4:][None], axis=2), 1), -.05, .05), -.05))
    out.append(tt); return out                                                                                                        # their wispy tips palest
S.classes = classes; S.PAL = [S.BELLY, S.PAD, DEEP, RIPPLE, SPOT, FROND, FTIP]
def decimate(V, F, n):
    """the Marlotl rule (her webbed gill blades had the same trouble): closed and one piece, a pinched edge allowed, an open one not"""
    import trimesh, fast_simplification as fs
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
S.decimate = decimate
if __name__ == '__main__': C.build(S, sys.argv[1], 15000)   # the ribbons need the triangles to stay closed
