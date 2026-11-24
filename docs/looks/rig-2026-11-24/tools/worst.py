"""blender -b -P worst.py -- <name> <clip> : the most-stretched edges and the bones that pull them (weight debugging)"""
import sys, os; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np, rigcore as K
name, clip = sys.argv[sys.argv.index('--') + 1:][:2]; P = K.Player(os.path.join(HERE, '..', name + '-rigged.glb')); b = P.m['body']; V = b['POSITION']; E = K.edges(b['F'])
l0 = np.linalg.norm(V[E[:, 0]] - V[E[:, 1]], axis=1); ok = l0 > .006; best = 0 * l0
for k in range(12):
    f = P.verts('body', P.globals(clip, P.dur(clip) * k / 12)); best = np.maximum(best, np.linalg.norm(f[E[:, 0]] - f[E[:, 1]], axis=1) / l0 * ok)
nm = lambda i: '+'.join(f'{P.names[j]}{w/255:.1f}' for j, w in zip(b['JOINTS_0'][i], b['WEIGHTS_0'][i]) if w > 25)
for e in np.argsort(-best)[:24]: print(round(float(best[e]), 1), np.round(V[E[e, 0]], 2), nm(E[e, 0]), '|', np.round(V[E[e, 1]], 2), nm(E[e, 1]))
