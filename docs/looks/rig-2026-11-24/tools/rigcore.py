"""M132 s1 rig core (shared by every body plan): glb in/out, skin weights, FK / two-bone IK, cap, measures.
Runs under Blender's python (bpy ships numpy). Axes are the game's glb axes: y up, +z = the way she faces, +x = her left.
A skeleton is an ordered dict name -> (parent, joint xyz); every joint's rest rotation is identity, so a bone's local
rotation is written in plain model axes and a clip can be read by eye."""
import json, struct
import numpy as np

CT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

class Glb:
    def __init__(s, path):
        b = open(path, 'rb').read(); l = struct.unpack('<I', b[12:16])[0]
        s.j = json.loads(b[20:20 + l]); s.bin = b[28 + l:]
    def acc(s, i):
        a = s.j['accessors'][i]; v = s.j['bufferViews'][a['bufferView']]
        o = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(s.bin, CT[a['componentType']], a['count'] * NC[a['type']], o).reshape(a['count'], -1)
    def meshes(s):
        out = {}
        for n in s.j['nodes']:
            if 'mesh' not in n: continue
            p = s.j['meshes'][n['mesh']]['primitives'][0]
            out[n['name']] = dict(F=s.acc(p['indices']).reshape(-1, 3).astype(int), **{k: s.acc(v) for k, v in p['attributes'].items()})
        return out

# ── maths ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def rx(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def ry(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
def align(a, b):
    """the smallest rotation that takes direction a to direction b"""
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = a @ b
    if c < -0.9999: return rx(np.pi)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]); return np.eye(3) + K + K @ K / (1 + c)
def quat(R):
    w = np.sqrt(max(0, 1 + R[0, 0] + R[1, 1] + R[2, 2])) / 2; x = np.sqrt(max(0, 1 + R[0, 0] - R[1, 1] - R[2, 2])) / 2
    y = np.sqrt(max(0, 1 - R[0, 0] + R[1, 1] - R[2, 2])) / 2; z = np.sqrt(max(0, 1 - R[0, 0] - R[1, 1] + R[2, 2])) / 2
    return np.array([np.copysign(x, R[2, 1] - R[1, 2]), np.copysign(y, R[0, 2] - R[2, 0]), np.copysign(z, R[1, 0] - R[0, 1]), w])
def mat(q):
    x, y, z, w = q / np.linalg.norm(q)
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def smooth(a, b, t): t = np.clip((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# ── pose ───────────────────────────────────────────────────────────────────────────────────────────────────────────
class Pose:
    """local rotation + local translation offset per bone; globals are resolved on demand, parents first"""
    def __init__(s, sk): s.sk = sk; s.R = {b: np.eye(3) for b in sk}; s.T = {b: np.zeros(3) for b in sk}
    def rot(s, b, *Rs):
        for R in Rs: s.R[b] = s.R[b] @ R
    def glob(s, b):
        par, j = s.sk[b]; j = np.array(j)
        if par is None: return s.R[b], j + s.T[b]
        Rp, pp = s.glob(par); return Rp @ s.R[b], pp + Rp @ (j - np.array(s.sk[par][1]) + s.T[b])
    def leg(s, up, lo, ft, target, footR=np.eye(3), bend=(0, 0, 1), maxstretch=1.6):
        """two-bone IK up -> lo -> ft: the ft joint lands on `target` (model space) with foot rotation `footR`. A target past
        the leg's reach lengthens both bones (joint offsets, no scale); returns the stretch (1 = none)."""
        J = {b: np.array(s.sk[b][1]) for b in (up, lo, ft)}
        Rp, A = s.glob(s.sk[up][0])[0], s.glob(up)[1]; target = np.array(target, float)
        l1, l2 = np.linalg.norm(J[lo] - J[up]), np.linalg.norm(J[ft] - J[lo]); d = target - A; D = np.linalg.norm(d); u = d / D
        k = max(1.0, D / (0.995 * (l1 + l2))); k = min(k, maxstretch); a, b = l1 * k, l2 * k; Dc = np.clip(D, abs(a - b) * 1.02, (a + b) * 0.999)
        x = (a * a - b * b + Dc * Dc) / (2 * Dc); h = np.sqrt(max(0, a * a - x * x))
        n = np.array(bend, float); n = n - (n @ u) * u; n /= np.linalg.norm(n)
        K = A + u * x + n * h
        R1 = align(Rp @ (J[lo] - J[up]), K - A) @ Rp
        R2 = align(R1 @ (J[ft] - J[lo]), target - K) @ R1
        s.R[up] = Rp.T @ R1; s.R[lo] = R1.T @ R2; s.R[ft] = R2.T @ footR
        s.T[lo] = R1.T @ (K - A) - (J[lo] - J[up]); s.T[ft] = R2.T @ (target - K) - (J[ft] - J[lo])
        return D / (l1 + l2)

# ── skin weights ───────────────────────────────────────────────────────────────────────────────────────────────────
def edges(F): return np.unique(np.sort(np.concatenate([F[:, :2], F[:, 1:], F[:, [0, 2]]]), 1), axis=0)
def skin_weights(V, F, bones, iters, rigid=()):
    """bones: list of (name, a, b, radius, gate(V)->bool mask or None). Each vertex goes to the capsule it is deepest in
    (distance / radius) among those whose gate lets it in; then the hard map is relaxed over the mesh's OWN edges, so two
    parts that only touch in the air (leg / belly, tail / haunch) never share weight unless the mesh joins them.
    rigid: (bone index, gate) pairs held at weight 1 throughout: a sole must be one solid piece or it slides."""
    D = np.full((len(V), len(bones)), 1e9)
    for i, (n, a, b, r, gate) in enumerate(bones):
        a, b = np.array(a, float), np.array(b, float); ab = b - a
        t = np.clip(((V - a) @ ab) / max(1e-9, ab @ ab), 0, 1); d = np.linalg.norm(V - a - t[:, None] * ab, axis=1) / r
        D[:, i] = np.where(gate(V), d, 1e8 + d) if gate else d
    W = np.zeros_like(D); W[np.arange(len(V)), D.argmin(1)] = 1
    # weld by position first (a glb can hold the same point twice at a colour seam)
    _, w = np.unique(np.round(V, 5), axis=0, return_inverse=True); w = w.ravel(); n = w.max() + 1
    hold = [(b, np.unique(w[g(V)])) for b, g in rigid]
    S = np.zeros((n, W.shape[1])); c = np.zeros(n); np.add.at(S, w, W); np.add.at(c, w, 1); S /= c[:, None]
    E = edges(w[F]); E = E[E[:, 0] != E[:, 1]]
    deg = np.zeros(n); np.add.at(deg, E.ravel(), 1); deg = np.maximum(deg, 1)
    for b, k in hold: S[k] = 0; S[k, b] = 1
    for _ in range(iters):
        N = np.zeros_like(S); np.add.at(N, E[:, 0], S[E[:, 1]]); np.add.at(N, E[:, 1], S[E[:, 0]])
        S = 0.5 * S + 0.5 * N / deg[:, None]; S /= S.sum(1, keepdims=True)
        for b, k in hold: S[k] = 0; S[k, b] = 1
    return four(S[w])
def four(W):
    W = W.copy(); o = np.argsort(-W, 1)[:, 4:]; np.put_along_axis(W, o, 0, 1); W[W < 0.004] = 0; return W / W.sum(1, keepdims=True)

def cap_holes(m, ymax):
    """The sculpts are cut open where they touch the ground. Fill every boundary loop whose mean y < ymax with a fan whose
    rim copies the loop's own points and colours. Adds vertices at the END; none of the live ones moves."""
    V, F = m['POSITION'], m['F']; _, w = np.unique(np.round(V, 5), axis=0, return_inverse=True); w = w.ravel()
    rep = {}; [rep.setdefault(k, i) for i, k in enumerate(w)]
    he = {}
    for t in w[F]:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): he[(a, b)] = he.get((a, b), 0) + 1
    nxt = {}
    for (a, b) in he:
        if (b, a) not in he: nxt.setdefault(b, []).append(a)      # reversed: the cap's own winding
    loops, left = [], sum(len(x) for x in nxt.values())
    while any(nxt.values()):
        s0 = next(k for k in nxt if nxt[k]); lp = [s0]; cur = s0
        while nxt.get(cur):
            cur = nxt[cur].pop()
            if cur == s0: break
            lp.append(cur)
        if cur == s0 and len(lp) > 2: loops.append(lp)
    P, N, C, T, src = [], [], [], [], []; n0 = len(V); done = 0
    for lp in loops:
        ids = [rep[k] for k in lp]; pts = V[ids]
        if pts[:, 1].mean() > ymax: continue
        done += 1; b = n0 + len(P); c = pts.mean(0); c[1] = pts[:, 1].mean()
        P += [*pts, c]; C += [*m['COLOR_0'][ids], m['COLOR_0'][ids].mean(0).astype(np.uint8)]; N += [np.array([0, -1, 0])] * (len(ids) + 1)
        src += [*[[i] for i in ids], ids]
        T += [[b + i, b + (i + 1) % len(ids), b + len(ids)] for i in range(len(ids))]
    if not done: return m, [], (len(loops), 0, left)
    out = dict(m, POSITION=np.vstack([V, P]).astype(np.float32), COLOR_0=np.vstack([m['COLOR_0'], C]).astype(np.uint8), F=np.vstack([F, T]))
    out['NORMAL'] = np.vstack([m['NORMAL'], N]).astype(np.float32)
    return out, src, (len(loops), done, left)

def skin(V, W, sk, pose):
    out = np.zeros_like(V, dtype=float)
    for i, b in enumerate(sk):
        if not W[:, i].any(): continue
        R, p = pose.glob(b); out += W[:, i:i + 1] * ((V - np.array(sk[b][1])) @ R.T + p)
    return out

# ── glb out ────────────────────────────────────────────────────────────────────────────────────────────────────────
def write(path, parts, sk, clips, fps):
    """parts: name -> dict(POSITION, COLOR_0, [NORMAL], F, W). clips: name -> list of Pose (first == last). One skin, shared."""
    names = list(sk); bufs, views, accs = [], [], []
    def add(a, ct, ty, target=None, norm=False, mm=False):
        b = a.tobytes(); off = sum(len(x) for x in bufs); bufs.append(b + b'\0' * (-len(b) % 4))
        v = dict(buffer=0, byteOffset=off, byteLength=len(b));
        if target: v['target'] = target
        views.append(v); d = dict(bufferView=len(views) - 1, componentType=ct, count=len(a) if ty != 'SCALAR' else a.size, type=ty)
        if norm: d['normalized'] = True
        if mm: d['min'] = [float(x) for x in np.atleast_1d(a.min(0))]; d['max'] = [float(x) for x in np.atleast_1d(a.max(0))]
        accs.append(d); return len(accs) - 1
    nodes, meshes = [], []
    for i, b in enumerate(names):
        par, j = sk[b]; t = np.array(j) - (np.array(sk[par][1]) if par else 0)
        nodes.append(dict(name='b_' + b, translation=[float(x) for x in t], children=[k for k, c in enumerate(names) if sk[c][0] == b]))
        if not nodes[-1]['children']: del nodes[-1]['children']
    ibm = np.tile(np.eye(4, dtype=np.float32), (len(names), 1, 1))
    for i, b in enumerate(names): ibm[i, :3, 3] = -np.array(sk[b][1])
    ib = add(ibm.transpose(0, 2, 1).reshape(-1, 16).copy(), 5126, 'MAT4')
    roots = [0]
    for n, m in parts.items():
        o = np.argsort(-m['W'], 1)[:, :4]; w = np.take_along_axis(m['W'], o, 1); w = np.round(w / w.sum(1, keepdims=True) * 255).astype(int)
        w[:, 0] += 255 - w.sum(1); o = np.where(w > 0, o, 0)
        at = dict(POSITION=add(m['POSITION'].astype(np.float32), 5126, 'VEC3', 34962, mm=True), COLOR_0=add(m['COLOR_0'].astype(np.uint8), 5121, 'VEC4', 34962, True),
                  JOINTS_0=add(o.astype(np.uint8), 5121, 'VEC4', 34962), WEIGHTS_0=add(w.astype(np.uint8), 5121, 'VEC4', 34962, True))
        if 'NORMAL' in m: at['NORMAL'] = add(m['NORMAL'].astype(np.float32), 5126, 'VEC3', 34962)
        ix = add(m['F'].astype(np.uint16).reshape(-1), 5123, 'SCALAR', 34963)
        meshes.append(dict(name=n, primitives=[dict(attributes=at, indices=ix, mode=4)]))
        nodes.append(dict(name=n, mesh=len(meshes) - 1, skin=0)); roots.append(len(nodes) - 1)
        m['Wq'] = np.zeros_like(m['W']); np.put_along_axis(m['Wq'], o[:, ::-1], w[:, ::-1] / 255, 1)
        for c in range(4): pass
    anims = []
    for cn, poses in clips.items():
        t = add((np.arange(len(poses)) / fps[cn]).astype(np.float32).reshape(-1, 1), 5126, 'SCALAR', mm=True); S, C = [], []
        for i, b in enumerate(names):
            q = np.array([quat(p.R[b]) for p in poses])
            for k in range(1, len(q)):
                if q[k] @ q[k - 1] < 0: q[k] *= -1
            tr = np.array([np.array(nodes[i]['translation']) + p.T[b] for p in poses])
            if np.abs(q - [0, 0, 0, 1]).max() > 1e-5: S.append(dict(input=t, output=add(q.astype(np.float32), 5126, 'VEC4'))); C.append(dict(sampler=len(S) - 1, target=dict(node=i, path='rotation')))
            if np.abs(tr - nodes[i]['translation']).max() > 1e-5: S.append(dict(input=t, output=add(tr.astype(np.float32), 5126, 'VEC3'))); C.append(dict(sampler=len(S) - 1, target=dict(node=i, path='translation')))
        anims.append(dict(name=cn, samplers=S, channels=C))
    blob = b''.join(bufs)
    j = dict(asset=dict(version='2.0', generator='ather M132 rigcore'), scene=0, scenes=[dict(nodes=roots)], nodes=nodes, meshes=meshes, accessors=accs, bufferViews=views,
             buffers=[dict(byteLength=len(blob))], skins=[dict(joints=list(range(len(names))), inverseBindMatrices=ib, skeleton=0)], animations=anims)
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
    open(path, 'wb').write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(blob), b'BIN\0') + blob)
    return len(js) + len(blob) + 28, sum(len(bufs[a['bufferView']]) if False else 0 for a in accs)

# ── measure: read the FILE back, play it between keys the way three does (slerp / lerp), skin, and look ────────────────
class Player:
    def __init__(s, path):
        s.g = Glb(path); s.names = [s.g.j['nodes'][i]['name'][2:] for i in s.g.j['skins'][0]['joints']]; s.par = {}
        for i in s.g.j['skins'][0]['joints']:
            for c in s.g.j['nodes'][i].get('children', []): s.par[c] = i
        s.m = s.g.meshes(); s.clips = {a['name']: a for a in s.g.j['animations']}
        s.ibm = s.g.acc(s.g.j['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    def dur(s, c): return float(s.g.acc(s.clips[c]['samplers'][0]['input'])[-1, 0])
    def globals(s, clip=None, t=0):
        L = {}
        for i in s.g.j['skins'][0]['joints']: L[i] = [np.array(s.g.j['nodes'][i]['translation'], float), np.array([0, 0, 0, 1.0])]
        if clip:
            a = s.clips[clip]
            for ch in a['channels']:
                sm = a['samplers'][ch['sampler']]; T = s.g.acc(sm['input'])[:, 0]; O = s.g.acc(sm['output']).astype(float)
                k = int(np.clip(np.searchsorted(T, t, 'right') - 1, 0, len(T) - 2)); u = np.clip((t - T[k]) / (T[k + 1] - T[k]), 0, 1)
                v = O[k] * (1 - u) + O[k + 1] * u
                if ch['target']['path'] == 'rotation': L[ch['target']['node']][1] = v / np.linalg.norm(v)
                else: L[ch['target']['node']][0] = v
        G = []
        for i in s.g.j['skins'][0]['joints']:
            M = np.eye(4); M[:3, :3] = mat(L[i][1]); M[:3, 3] = L[i][0]
            G.append(G[s.par[i]] @ M if i in s.par else M)
        return [g @ b for g, b in zip(G, s.ibm)]
    def verts(s, part, M):
        m = s.m[part]; V = np.c_[m['POSITION'].astype(float), np.ones(len(m['POSITION']))]; w = m['WEIGHTS_0'] / 255.; J = m['JOINTS_0']; A = np.array(M)
        return np.einsum('vk,vkij,vj->vi', w, A[J], V)[:, :3]
