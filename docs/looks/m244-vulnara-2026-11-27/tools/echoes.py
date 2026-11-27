"""M244 s1b: RIGGED ECHOES / COPIES (Vulnarok's four gold self-echoes, Vulnavex's two gold copies). Each copy is the body mesh
(decimated) on its OWN copy of the skeleton (bones e<k>_<bone>, under the main root), so a copy plays her clip with its own delay
and, through its e<k>_root bone, its own place / size (a scale track: shrinking to nothing = the copy fading out, the glow material
is opaque). Works on any rigcore skeleton (quadruped or biped).
    spec = dict(off=(x, y, z), s=scale, delay=fraction of the clip, move=fn(clip, u) -> (dz, fade 0..1) or None = stand + full size)
"""
import numpy as np
import rigcore as K

def build(SK, V, F, W, nb, specs, tris=3000, color=(242, 197, 74)):
    """returns (SK2, aura part dict over SK2's bones). W: weights of V over nb (= list(SK))"""
    import fast_simplification as fs
    from scipy.spatial import cKDTree
    v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=tris); v = np.asarray(v, float); f = np.asarray(f)
    w = W[cKDTree(V).query(v)[1]]
    SK2 = dict(SK); P, Fs, Ws = [], [], []; nb2 = list(SK)
    for k, sp in enumerate(specs):
        o = np.array(sp['off'], float)
        for b, (par, j) in SK.items():
            SK2[f'e{k}_{b}'] = ('root' if par is None else f'e{k}_{par}', tuple(float(c) for c in np.array(j) + o))
    nb2 = list(SK2)
    for k, sp in enumerate(specs):
        o = np.array(sp['off'], float); Wk = np.zeros((len(v), len(nb2)))
        for i, b in enumerate(nb): Wk[:, nb2.index(f'e{k}_{b}')] = w[:, i]
        Fs.append(f + sum(len(x) for x in P)); P.append(v + o); Ws.append(Wk)
    Vv, Ff = np.vstack(P), np.vstack(Fs); N = np.zeros_like(Vv); fn = np.cross(Vv[Ff[:, 1]] - Vv[Ff[:, 0]], Vv[Ff[:, 2]] - Vv[Ff[:, 0]])
    for c in range(3): np.add.at(N, Ff[:, c], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    C = np.tile((*color, 255), (len(Vv), 1)).astype(np.uint8)
    return SK2, dict(POSITION=Vv.astype(np.float32), COLOR_0=C, NORMAL=N.astype(np.float32), F=Ff, W=np.vstack(Ws))

def pad(W, nb, SK2):
    """main-part weights over the bigger skeleton (main bones keep their indices: they come first)"""
    out = np.zeros((len(W), len(SK2))); out[:, :len(nb)] = W; return out

def clips(SK, SK2, clips, specs):
    """the main clips re-posed over SK2: every main bone as it was, each copy playing the same clip `delay` behind"""
    out = {}
    for name, poses in clips.items():
        n = len(poses) - 1; res = []
        for i in range(n + 1):
            p = poses[i]; q = K.Pose(SK2); q.R.update(p.R); q.T.update(p.T); q.S.update(p.S)
            for k, sp in enumerate(specs):
                src = poses[(i - int(round(sp['delay'] * n))) % n]
                for b in SK:
                    if b == 'root': continue
                    q.R[f'e{k}_{b}'] = src.R[b]; q.T[f'e{k}_{b}'] = src.T[b].copy()
                mv = sp['move'](name, (i % n) / n) if sp.get('move') else None
                dz, fade = mv if mv else (0., 1.)
                sc = max(1e-3, sp['s'] * fade); q.S[f'e{k}_root'] = sc
                q.T[f'e{k}_root'] = sc * src.T['root'] - p.T['root'] + np.array([0, 0, dz])
            res.append(q)
        out[name] = res
    return out
