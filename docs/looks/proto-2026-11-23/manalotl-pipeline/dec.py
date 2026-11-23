import trimesh,numpy as np,fast_simplification as fs
from PIL import Image
m=trimesh.load('raw.glb',force='mesh')
m.merge_vertices();m.update_faces(m.nondegenerate_faces());m.remove_unreferenced_vertices()
print('raw',len(m.faces),m.bounds)
v,f=fs.simplify(m.vertices.astype(np.float32),m.faces.astype(np.int32),target_count=8000,agg=4)
d=trimesh.Trimesh(v,f,process=True)
cc=d.split(only_watertight=False); print('comps',[len(c.faces) for c in cc][:8])
print(len(d.faces),d.is_watertight,d.bounds)
d.export('dec_raw.ply')
for ax,name in [(0,'x'),(1,'y'),(2,'z')]:
    o=[i for i in range(3) if i!=ax]
    p=d.vertices[:,o]; lo=p.min(0);hi=p.max(0);s=(p-lo)/(hi-lo).max()*255
    im=np.zeros((256,256),np.uint8)
    for a,b in s.astype(int): im[255-b,a]=255
    Image.fromarray(im).save(f'sil_{name}.png')
ims=[Image.open(f'sil_{n}.png') for n in 'xyz']
c=Image.new('L',(768,256));[c.paste(i,(k*256,0)) for k,i in enumerate(ims)];c.save('sil.png')
