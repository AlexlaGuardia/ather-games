"""python facts.py <glb>...: topology of the body node, colour-split vertices welded by position; legs = separate outlines a little above the paws"""
import sys, trimesh, numpy as np
for p in sys.argv[1:]:
    sc = trimesh.load(p); g = [x for n, x in sc.geometry.items() if 'body' in n][0]; e = [x for n, x in sc.geometry.items() if 'eyes' in n][0]; m = trimesh.Trimesh(np.asarray(g.vertices), g.faces, process=False); m = trimesh.Trimesh(m.vertices, m.faces, process=False); m.merge_vertices(merge_norm=True, merge_tex=True)
    u, c = np.unique(np.sort(m.edges, 1), axis=0, return_counts=True); H = m.bounds[1, 1]; legs = []
    for k in (.08, .12, .16, .20):
        s = m.section((0, 1, 0), (0, k * H, 0)); legs.append(len(s.discrete) if s else 0)
    print(p.split('/')[-1], 'body tris', len(m.faces), 'eyes tris', len(e.faces), 'verts in file', len(g.vertices), '| open edges', int((c == 1).sum()), 'non-manifold', int((c > 2).sum()), '| islands', m.body_count, '| handles', (2 * m.body_count - m.euler_number) // 2 if (c == 2).all() else 'n/a', '| outlines at 8/12/16/20% height', legs, '| size', m.extents.round(3).tolist())
