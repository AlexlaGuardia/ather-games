"""BETA M244 MODEL-QUALITY EXPERIMENT on VULNAROK (owner preview only, nothing live).
Runs the LIVE build (m244-vulnara-2026-11-27/tools/rig_biped.py, unchanged) and intercepts rigcore.write, so the variant is the
live Vulnarok plus two passes that each switch on alone:
  Q_PAINT=1   art-led colour pass: palette taken off the locked stage-3 art (navy-indigo coat, pale lavender brush, orange ear
              insides, cream-gold muzzle, gold blaze) + the chest blaze PROJECTED from the art onto the chest front + facet
              patches (value steps per surface cell, the crystal plates of the art).
  Q_JIGGLE=1  secondary motion baked into every clip: ears + tail chain ride damped springs driven by the acceleration of
              the point they hang from (anchor's rigid motion), so they lag, overshoot and settle. Same bones, same clip
              names: spirit-model.tsx plays it unchanged.
    Q_PAINT=1 Q_JIGGLE=1 uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification,pillow \
        python rig_quality.py <unrigged vulnarok.glb> <out-rigged.glb> <metrics.json>
ART: read-only from /root/athernyx/assets/stage3/001-vulnarok.png (private; only sampled colours land in the glb)."""
import sys, os, runpy
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LIVE = os.path.join(HERE, '../../m244-vulnara-2026-11-27/tools')
sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.path.insert(0, LIVE); sys.dont_write_bytecode = True
import rigcore as K
ART = '/root/athernyx/assets/stage3/001-vulnarok.png'
PAINT, JIG = os.environ.get('Q_PAINT') == '1', os.environ.get('Q_JIGGLE') == '1'
STATS = {}

# ───────────────────────────── (a) art-led colour + chest projection ─────────────────────────────
DENSE = int(os.environ.get('Q_DENSE', '1'))     # midpoint passes over the chest front, so the projected blaze has verts to land on
def densify(part, passes):
    """split the chest-front faces `passes` times; every per-vertex attribute (normal, colour, skin weights) is interpolated
    at the new midpoints, weights cut back to four influences (the game skins with four)"""
    import trimesh
    V, F = part['POSITION'].astype(float), part['F']; keys = [k for k in ('POSITION', 'NORMAL', 'COLOR_0', 'W') if k in part]
    A = np.concatenate([part[k].astype(float).reshape(len(V), -1) for k in keys], 1); n0 = len(V)
    for _ in range(passes):
        P = A[:, :3]; c = P[F].mean(1)
        fi = np.where((c[:, 2] > .04) & (np.abs(c[:, 0]) < .17) & (c[:, 1] > .64) & (c[:, 1] < 1.04))[0]
        A, F = trimesh.remesh.subdivide(A, F, face_index=fi)
    out = dict(part); o = 0
    for k in keys:
        w = part[k].reshape(len(V), -1).shape[1]; x = A[:, o:o + w]; o += w
        if k == 'NORMAL': x = x / np.linalg.norm(x, axis=1, keepdims=True)
        if k == 'W': x = K.four(x)
        out[k] = x.astype(part[k].dtype) if k != 'W' else x
    out['F'] = F; STATS['dense'] = dict(passes=passes, verts_before=n0, verts_after=len(A)); return out

def paint(part):
    from PIL import Image
    if DENSE: part = densify(part, DENSE)
    V = part['POSITION'].astype(float); C = part['COLOR_0'].astype(float); rgb = C[:, :3]
    art = np.asarray(Image.open(ART).convert('RGB')).astype(float)
    near = lambda c, tol=22: np.abs(rgb - np.array(c)).max(1) < tol
    bodyish = (rgb[:, 2] > rgb[:, 0] + 40) & (rgb.sum(1) < 470)          # the violet coat classes (88,72,160 .. 120,104,192)
    pale = near((232, 232, 248), 14); tailtip = near((216, 208, 240), 14); earin = near((232, 160, 176), 26)
    tail = (V[:, 2] < -.20) & (V[:, 1] < .70) | (V[:, 2] < -.34)
    out = rgb.copy()
    # coat: art hue (indigo, bluer than live), value kept at game depth; keep the live per-class light/dark spread
    lum = rgb[bodyish].mean(1); rel = (rgb[bodyish].mean(1) - lum.mean()) / 255.
    out[bodyish] = np.clip(np.array((84, 82, 146)) * (1 + 1.6 * rel)[:, None], 0, 255)
    out[tail & (bodyish | tailtip | pale)] = (192, 170, 222)               # the art's brush is pale lavender, not coat
    out[tail & tailtip] = (226, 214, 242)
    chest = pale & (V[:, 1] < 1.02) & ~tail; muzzle = pale & (V[:, 1] >= 1.02)
    out[chest] = (84, 82, 146); out[muzzle] = (226, 196, 146)              # art: dark chest, cream-gold muzzle + jaw
    out[earin] = (238, 164, 108)
    # PROJECTION: the art's torso front onto the chest front (planar, +z facing, box fit by hand on the art's torso)
    box = (282, 360, 520, 655)                                             # art px x0, y0, x1, y1 : throat -> waist
    roi = (V[:, 2] > .02) & (np.abs(V[:, 0]) < .21) & (V[:, 1] > .60) & (V[:, 1] < 1.06) & ~tail
    if 'NORMAL' in part: roi &= part['NORMAL'][:, 2] > .25
    u = (V[roi, 0] + .21) / .42; v = (1.06 - V[roi, 1]) / .46
    px = np.clip(box[0] + u * (box[2] - box[0]), 0, 1023).astype(int); py = np.clip(box[1] + v * (box[3] - box[1]), 0, 1023).astype(int)
    s = np.zeros((roi.sum(), 3))
    for dx in (-3, 0, 3):
        for dy in (-3, 0, 3): s += art[np.clip(py + dy, 0, 1023), np.clip(px + dx, 0, 1023)]
    s /= 9; gold = (s[:, 0] > 185) & (s[:, 0] - s[:, 2] > 55)
    idx = np.where(roi)[0]; out[idx[gold]] = (228, 178, 72)
    STATS['paint'] = dict(coat=int(bodyish.sum()), brush=int((tail & (bodyish | tailtip | pale)).sum()), chest_roi=int(roi.sum()), blaze=int(gold.sum()), ear=int(earin.sum()))
    # facets: a value step per surface cell (~6 cm), the art's flat crystal planes; not on gold / eyes / ears
    rng = np.random.default_rng(244); seeds = V[rng.choice(len(V), 260, replace=False)]
    from scipy.spatial import cKDTree
    cell = cKDTree(seeds).query(V)[1]; step = rng.uniform(-.09, .09, len(seeds))[cell]
    fac = (bodyish | chest | tail) & ~np.isin(np.arange(len(V)), idx[gold])
    out[fac] = np.clip(out[fac] * (1 + step[fac])[:, None], 0, 255)
    part = dict(part); C2 = C.copy(); C2[:, :3] = out; part['COLOR_0'] = C2.astype(np.uint8); return part

# ───────────────────────────── (c) secondary motion: damped springs on ears + tail ─────────────────────────────
EAR_T, TAIL_T = .16, .11                       # target peak (rad) in the WALK: each ear; each tail bone (tip sums ~4x)
def spring(u, dt, w0, z, loops=4, sub=8):
    n = len(u); th = np.zeros(2); out = np.zeros((n, 2)); h = dt / sub
    for L in range(loops):
        for k in range(n):
            a0, a1 = u[k], u[(k + 1) % n]
            for j in range(sub):
                f = a0 + (a1 - a0) * j / sub; acc = -w0 * w0 * th[0] - 2 * z * w0 * th[1] + f
                th = np.array([th[0] + h * (th[1] + h * acc), th[1] + h * acc])
            if L == loops - 1: out[k] = th
    return out[:, 0]
import re
ECHO = lambda b: re.match(r'e\d+_', b) is not None
def chains(sk):
    for p in [''] + sorted({b.split('_')[0] + '_' for b in sk if b.startswith('e') and '_' in b and b.split('_')[0][1:].isdigit()}):
        for s in 'lr':
            if p + 'ear_' + s in sk: yield 'ear', [p + 'ear_' + s], p + 'head'
        if p + 'tail1' in sk: yield 'tail', [p + f'tail{i}' for i in range(1, 5)], p + 'pelvis'
def tip_acc(sk, poses, bones, anchor, fps):
    ja = np.array(sk[anchor][1]); jt = np.array(sk[bones[-1]][1]) if len(bones) > 1 else np.array(sk[bones[0]][1]) + (0, .18, 0)
    P, R = [], []
    for p in poses[:-1]:
        Ra, pa = p.glob(anchor); R.append(Ra); P.append(pa + Ra @ (jt - ja))
    P = np.array(P); a = (np.roll(P, -1, 0) - 2 * P + np.roll(P, 1, 0)) * fps * fps
    a = (np.roll(a, -1, 0) + 2 * a + np.roll(a, 1, 0)) / 4                     # light smoothing of the 2nd difference
    return np.einsum('kji,kj->ki', np.array(R), a)                            # into the anchor's frame
def jiggle(sk, clips, fps):
    raw = {}
    for c, poses in clips.items():
        if len(poses) < 4: continue
        dt = 1. / fps[c]
        for kind, bones, anchor in chains(sk):
            a = tip_acc(sk, poses, bones, anchor, fps[c])
            if kind == 'ear':   # fore-aft (+ a little bob) -> pitch; side -> roll.  ear: ~7 Hz, light damping
                th = np.c_[spring(-(a[:, 2] + .5 * a[:, 1]), dt, 44, .22), spring(a[:, 0], dt, 44, .22)]
            else:               # bob -> lift; side -> swing.  tail: ~3 Hz, softer
                th = np.c_[spring(-a[:, 1], dt, 19, .30), spring(a[:, 0], dt, 19, .30)]
            raw[c, tuple(bones)] = (kind, th)
    # one gain per kind, fitted on her own walk, used for every clip (so idle stays small, run grows)
    gain = {}
    for kind, T in (('ear', EAR_T), ('tail', TAIL_T)):
        pk = max([np.abs(th).max() for (c, b), (k, th) in raw.items() if c == 'walk' and k == kind and not ECHO(b[0])] or [1])
        gain[kind] = T / pk
    peak = {}
    for (c, bones), (kind, th) in raw.items():
        th = np.clip(th * gain[kind], -1.6 * (EAR_T if kind == 'ear' else TAIL_T), 1.6 * (EAR_T if kind == 'ear' else TAIL_T))
        n = len(th); poses = clips[c]
        for k in range(n):
            if kind == 'ear':
                b = bones[0]; sgn = 1 if b.endswith('_l') else -1
                poses[k].rot(b, K.rx(th[k, 0]), K.rz(th[k, 1]))
            else:
                for i, b in enumerate(bones):         # each bone a beat behind the one before, growing to the tip
                    kk = (k - 2 * i) % n; w = (.45, .7, .9, 1.0)[i]
                    poses[k].rot(b, K.rx(w * th[kk, 0]), K.ry(w * th[kk, 1]))
        for b in bones: poses[-1].R[b] = poses[0].R[b].copy()
        if not ECHO(bones[0]): peak[f'{c}:{bones[0]}'] = round(float(np.abs(th).max()), 3)
    STATS['jiggle'] = dict(gain={k: round(v, 5) for k, v in gain.items()}, peak_rad=peak)

_write = K.write
def write(path, parts, sk, clips, fps):
    if PAINT: parts = dict(parts, body=paint(parts['body']))
    if JIG: jiggle(sk, clips, fps)
    print('QUALITY', STATS)
    return _write(path, parts, sk, clips, fps)
K.write = write
IN, OUT, MET = sys.argv[1:4]
sys.argv = [os.path.join(LIVE, 'rig_biped.py'), IN, OUT, MET]
runpy.run_path(os.path.join(LIVE, 'rig_biped.py'), run_name='__main__')
import json
m = json.load(open(MET)); m['quality'] = dict(on=dict(paint=PAINT, jiggle=JIG), **STATS); json.dump(m, open(MET, 'w'), indent=1)
