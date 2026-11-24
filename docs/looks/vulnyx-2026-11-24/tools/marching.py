"""Marching tetrahedra off a scalar field, numpy only: six tets a cell, so the result is closed and manifold by construction."""
import numpy as np
TETS = [(0, 1, 3, 7), (0, 3, 2, 7), (0, 2, 6, 7), (0, 6, 4, 7), (0, 4, 5, 7), (0, 5, 1, 7)]          # corner bit 1 = x, 2 = y, 4 = z; all share the 0-7 diagonal
def surface(field, lo, hi, h):
    n = np.ceil((hi - lo) / h).astype(int) + 1; ax = [lo[i] + h * np.arange(n[i]) for i in range(3)]; D = np.empty(n, np.float64)
    for i in range(n[0]):
        Y, Z = np.meshgrid(ax[1], ax[2], indexing='ij'); D[i] = field(np.stack([np.full_like(Y, ax[0][i]), Y, Z], -1))
    D[np.abs(D) < h * 1e-2] = h * 1e-2
    off = np.array([[k & 1, k >> 1 & 1, k >> 2 & 1] for k in range(8)]); S = D < 0
    cnt = sum(S[tuple(slice(o[a], n[a] - 1 + o[a]) for a in range(3))].astype(int) for o in off); C = np.argwhere((cnt > 0) & (cnt < 8))
    gid = lambda I: (I[..., 0] * n[1] + I[..., 1]) * n[2] + I[..., 2]
    tri = []
    for t in TETS:
        G = np.stack([gid(C + off[k]) for k in t], 1); s = D.ravel()[G] < 0; c = s.sum(1)
        for w in (1, 3):
            m = c == w; g, q = G[m], s[m] if w == 1 else ~s[m]; o = np.argsort(~q, 1, kind='stable'); g = np.take_along_axis(g, o, 1)
            tri.append(np.stack([np.stack([g[:, 0], g[:, k]], -1) for k in (1, 2, 3)], 1))
        m = c == 2; g = np.take_along_axis(G[m], np.argsort(~s[m], 1, kind='stable'), 1); e = lambda a, b: np.stack([g[:, a], g[:, b]], -1)
        tri += [np.stack([e(0, 2), e(0, 3), e(1, 3)], 1), np.stack([e(0, 2), e(1, 3), e(1, 2)], 1)]
    tri = np.sort(np.concatenate(tri), -1); E, inv = np.unique(tri.reshape(-1, 2), axis=0, return_inverse=True); F = inv.reshape(-1, 3)
    P = lambda g: lo + h * np.stack(np.unravel_index(g, n), -1); a, b = D.ravel()[E[:, 0]], D.ravel()[E[:, 1]]; V = P(E[:, 0]) + (a / (a - b))[:, None] * (P(E[:, 1]) - P(E[:, 0]))
    c = V[F].mean(1); fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); g = np.stack([field(c + np.eye(3)[i] * h * .3) - field(c - np.eye(3)[i] * h * .3) for i in range(3)], -1)
    flip = (fn * g).sum(1) < 0; F[flip] = F[flip][:, ::-1]; return V, F
