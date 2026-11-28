"""M202 v2 (Alex 11-28: "luminore and luminix both lose their flight in these two evos.. let's get rid of the wings kind of like it turned into
an egg form before awakening"): the EGG / cocoon helpers for Luminore + Luminix. Both stay grounded and wingless: no wings, no wing fins, no
arms; one rounded shell-body standing on two short feet, waiting to break out (the Dewbear line's cocoon rule). Shared here:
  wingless(S)       no wings (the base eyes() builds them through S.wing), no arms (field term + rig bones gone)
  plates(S, V, ..)  a colour class: the shell's plate seams (a spherical Voronoi over seed directions from her middle)
  crack(S, ..)      a glowing hatch line round her (an unlit strip: living light showing through the shell where she will break out)"""
import numpy as np
from lum_common import V3

def wingless(S):
    S.wing = lambda name, sx: []
    S.arms = lambda M: np.full(np.shape(M)[:-1], 9.)

def seeds(n, seed):
    """n roughly even directions (a Fibonacci sphere, jittered)"""
    rng = np.random.default_rng(seed); k = np.arange(n) + .5; y = 1 - 2 * k / n; r = np.sqrt(1 - y * y); a = k * np.pi * (3 - 5 ** .5)
    U = np.c_[r * np.cos(a), y, r * np.sin(a)] + rng.normal(0, .12, (n, 3)); return U / np.linalg.norm(U, axis=1, keepdims=True)

def plates(V, c, U, w):
    """> 0 on a seam between two plates (width w in direction space)"""
    D = V - c; D = D / np.maximum(np.linalg.norm(D, axis=1, keepdims=True), 1e-9); dots = np.sort(D @ U.T, axis=1)
    return np.clip(w - (dots[:, -1] - dots[:, -2]), -.05, .05)

def crack(S, c, y0, amp, col, skip, n=9, wd=.009, seed=3, az0=-np.pi, az1=np.pi):
    """a zigzag hatch line round her at height y0 (direction elevation), cast onto her surface from c; skip(az) True = leave a gap there"""
    rng = np.random.default_rng(seed); az = np.linspace(az0, az1, n * 4 + 1); el = np.full(len(az), y0)
    el[::2] += amp * (.6 + .4 * rng.random(len(el[::2]))); el[1::2] -= amp * (.6 + .4 * rng.random(len(el[1::2])))
    t = np.linspace(az0, az1, n * 24 + 1); E = np.interp(t, az, el); parts, run = [], []
    for a, e in zip(t, E):
        if skip(a):
            if len(run) > 5: parts.append(run)
            run = []; continue
        run.append(V3(np.sin(a) * np.cos(e), np.sin(e), np.cos(a) * np.cos(e)))
    if len(run) > 5: parts.append(run)
    return [S.strip(S.ray(c, np.array(r), 1.2), col, wd, .004) for r in parts]
