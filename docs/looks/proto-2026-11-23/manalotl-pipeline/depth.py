import trimesh,numpy as np
d=trimesh.load('clean.ply',force='mesh'); v=np.load('vn.npy'); m=trimesh.Trimesh(v,d.faces,process=False)
p,_=trimesh.sample.sample_surface(m,400000)
G=0.02; xs=np.arange(-0.36,0.37,G); ys=np.arange(0.92,0.28,-G)
ix=np.round((p[:,0]+0.36)/G).astype(int); iy=np.round((0.92-p[:,1])/G).astype(int)
Z=np.full((len(ys),len(xs)),np.nan)
ok=(ix>=0)&(ix<len(xs))&(iy>=0)&(iy<len(ys))
for a,b,z in zip(iy[ok],ix[ok],p[ok,2]):
  if np.isnan(Z[a,b]) or z>Z[a,b]: Z[a,b]=z
np.save('frontZ.npy',Z)
for y,row in zip(ys,Z): print(f'{y:.2f}'+''.join('  .' if np.isnan(z) else f'{int(z*100):3d}' for z in row))
print('x   '+''.join(f'{int(round(x*100)):3d}' for x in xs))
