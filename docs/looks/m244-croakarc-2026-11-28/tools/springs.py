# M244 sheet 9: the m244-quality (14c9850b) pass c tail springs, exec()d by rig_arcvik.py after its clips are built
rx, ry = K.rx, K.ry
# baked springs on the tail chain (the m244-quality pass c, its numbers)
TAIL_T = .11
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
def tail_acc(poses, fps):
    ja, jt = np.array(SK['pelvis'][1]), np.array(SK['tail4'][1]); P, R = [], []
    for p in poses[:-1]: Ra, pa = p.glob('pelvis'); R.append(Ra); P.append(pa + Ra @ (jt - ja))
    P = np.array(P); a = (np.roll(P, -1, 0) - 2 * P + np.roll(P, 1, 0)) * fps * fps; a = (np.roll(a, -1, 0) + 2 * a + np.roll(a, 1, 0)) / 4
    return np.einsum('kji,kj->ki', np.array(R), a)
fps = {c: (len(v) - 1) / T[c] for c, v in clips.items()}
ground = globals().get('ground', lambda p: p)
raw = {c: np.c_[spring(-a[:, 1], 1 / fps[c], 19, .30), spring(a[:, 0], 1 / fps[c], 19, .30)] for c in clips for a in [tail_acc(clips[c], fps[c])]}
gain = TAIL_T / max(np.abs(raw['walk']).max(), 1e-6); JIG = {}
for c, th in raw.items():
    th = np.clip(th * gain, -1.6 * TAIL_T, 1.6 * TAIL_T); n = len(th); JIG[c] = round(float(np.abs(th).max()), 3)
    for k in range(n):
        for i in range(4): kk = (k - 2 * i) % n; ww = (.45, .7, .9, 1.)[i]; clips[c][k].rot('tail%d' % (i + 1), rx(ww * th[kk, 0]), ry(ww * th[kk, 1]))
    for i in range(4): clips[c][-1].R['tail%d' % (i + 1)] = clips[c][0].R['tail%d' % (i + 1)].copy()
    clips[c] = [ground(p) for p in clips[c]]
