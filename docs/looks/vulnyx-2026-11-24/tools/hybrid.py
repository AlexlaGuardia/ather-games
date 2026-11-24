"""Vulnyx, CANDIDATE A: free image-to-3D body (Hunyuan3D-2.1 Space, anonymous, from public/spirits/grimoire/fox-mana-beta.webp,
a standing fox already on the site) -> voxel distance field -> its head and the swirl discs fused to it cut away, legs thickened
-> candidate B's head and colours smooth-joined on -> one closed surface.   python -I-safe input: hybrid.py <raw.glb> <out.glb> [tris]"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, trimesh, fast_simplification as fs
from scipy import ndimage as nd
import sculpt as B
from marching import surface
RAW, OUT = sys.argv[1], sys.argv[2]; TRIS = int(sys.argv[3]) if len(sys.argv) > 3 else 4700
S = .60; T = np.array([0, .655 * S, -.185])
m = trimesh.load(RAW, force='mesh'); m.merge_vertices(); m = max(m.split(only_watertight=False), key=lambda c: len(c.faces))
p = .0105; vx = m.voxelized(p).fill(); o = np.pad(vx.matrix, 6); org = vx.transform[:3, 3] - 6 * p
kt = int((-.36 - org[2]) / p); ball = nd.iterate_structure(nd.generate_binary_structure(3, 1), 6); o = np.pad(o, 8); org = org - 8 * p; kt += 8; c_ = nd.binary_fill_holes(nd.binary_closing(o, ball)); o[:, :, :kt] = c_[:, :, :kt]   # the generated tail is a thin torn shell: close and fill it
d = (nd.distance_transform_edt(~o) - nd.distance_transform_edt(o)) * p; d = nd.gaussian_filter(d, 1.1)
def raw(P):
    q = ((P - T) / S - org) / p; return nd.map_coordinates(d, q.reshape(-1, 3).T, order=1, mode='nearest').reshape(P.shape[:-1]) * S
def field(P):
    y, z = P[..., 1], P[..., 2]; x = P[..., 0]
    r = raw(P) - .009 * np.clip((.33 - y) / .06, 0, 1) * (z > -.40) * np.clip((z + .40) / .05, 0, 1)        # legs thicker
    cutp = np.maximum((y - .455), (np.abs(x) - .125) * (z > .05) * 1.0 - 9 * (z <= .05)); keep = np.where(z > -.12, cutp, -9.)
    r = np.where(y < .235, B.ss(r, np.abs(x) - .011 + .5 * np.maximum(y - .20, 0), .01), r)   # a clear gap between the legs
    r = np.where(z > -.12, B.ss(r, -keep, .03), r)                         # no head, no swirls
    M = np.stack([np.abs(x), y, z], -1)
    n = B.cone(P, (0, .40, .13), (0, .53, .225), .098, .092)
    for a in (((0, .40, .205), (0, .285, .268), .058), ((.052, .41, .19), (.062, .315, .250), .050), ((.092, .425, .155), (.112, .345, .212), .042)): n = B.su(n, B.cone(M, *a, .004), .025)
    return B.su(B.su(r, n, .06), B.head(P), .03)
BASE = B.classes
def classes(V):
    c = BASE(V); x, y, z = V.T; c[1] = np.minimum(c[1], z - .17 - .3 * np.abs(x)); c[0] = np.minimum(c[0], y - .455)
    tipw = y - (.50 + .05 * B.zig(x * 1. + z, 9)); c[2] = np.where(z < -.40, tipw, -1.); return c
if __name__ == '__main__':
    lo, hi, h = np.array([-.341, -.043, -1.0]), np.array([.341, 1.03, .56]), .0078
    V, F = surface(field, lo, hi, h); k = max(trimesh.Trimesh(V, F, process=False).split(only_watertight=False), key=lambda c: len(c.faces)); trimesh.repair.fix_normals(k); print('raw', len(k.faces), 'handles', (2 - k.euler_number) // 2); V, F = k.vertices, k.faces
    m = t = B.decimate(V, F, TRIS); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    B.field = field; B.finish(np.array(t.vertices), np.array(t.faces), OUT, B.eyes(), classes)
