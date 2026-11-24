"""blender -b -P seams.py : glowing part + eyes follow the body (seam gap through every clip), and the slide instrument can fail"""
import sys, os; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np, rigcore as K
P = K.Player(os.path.join(HERE, '../manalotl-rigged.glb')); H = .9 / 1.29; B, F = P.m['body']['POSITION'], P.m['frills']['POSITION']
d = ((F[:, None] - B[None]) ** 2).sum(2); i = d.argmin(1); on = np.sqrt(d.min(1)) < .012
for c in P.clips:
    g = 0
    for k in range(16):
        M = P.globals(c, P.dur(c) * k / 16); g = max(g, (np.linalg.norm(P.verts('frills', M)[on] - P.verts('body', M)[i[on]], axis=1) - np.sqrt(d.min(1))[on]).max())
    print('frills', c, 'touching verts', int(on.sum()), 'seam opens at most %.1f mm' % (g * H * 1000))
for n, h in (('vulnyx', .7), ('manalotl', H)):
    P = K.Player(os.path.join(HERE, '..', n + '-rigged.glb')); b = P.m['body']; e = P.m['eyes']['POSITION']; d = ((e[:, None] - b['POSITION'][None]) ** 2).sum(2); j = d.argmin(1); g = 0
    for c in P.clips:
        for k in range(16): M = P.globals(c, P.dur(c) * k / 16); g = max(g, np.abs(np.linalg.norm(P.verts('eyes', M) - P.verts('body', M)[j], axis=1) - np.sqrt(d.min(1))).max())
    print('eyes', n, 'shift on the face at most %.2f mm' % (g * h * 1000))
import importlib
for n, f, v in (('vulnyx', 'fl', .55), ('manalotl', 'fl', .42)):
    P = K.Player(os.path.join(HERE, '..', n + '-rigged.glb')); S = importlib.import_module('spirits.' + n); g = S.WALK; b = P.m['body']; T = P.dur('walk'); w = ((b['JOINTS_0'] == P.names.index(f + '_paw')) * b['WEIGHTS_0']).sum(1) > 252; off = g['phase'][f]; N = 40
    a = np.array([P.verts('body', P.globals('walk', (((u * g['duty'] / N) - off) % 1) * T))[w].mean(0) * S.HEIGHT for u in range(N)]); t = np.arange(N) * g['duty'] / N * T
    for m in (1, 1.2): print('slide', n, 'ground speed x%.1f: %.1f mm' % (m, np.ptp(a[:, 2] + m * v * t) * 1000))
