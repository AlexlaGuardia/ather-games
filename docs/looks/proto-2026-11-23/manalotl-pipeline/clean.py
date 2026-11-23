import trimesh,numpy as np,sys
d=trimesh.load('dec_raw.ply',force='mesh')
L=float(sys.argv[1]); C=float(sys.argv[2])
e=d.edges_unique_length; mx=e[d.faces_unique_edges].max(1)
keep=mx<L
yc=d.triangles_center[:,1]; keep&=yc>d.vertices[:,1].min()+C
d.update_faces(keep); d.remove_unreferenced_vertices()
cc=d.split(only_watertight=False); cc=sorted(cc,key=lambda c:-len(c.faces))
print([len(c.faces) for c in cc[:6]])
m=cc[0]; print(len(m.faces),m.bounds); m.export('clean.ply')
