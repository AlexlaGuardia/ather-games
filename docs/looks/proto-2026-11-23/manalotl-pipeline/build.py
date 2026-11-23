# Manalotl game-ready glb from the cleaned Hunyuan3D-2 shape (same recipe as the Vulnyx color.py):
# nodes body / frills / eyes, vertex colours (sRGB->linear bytes, as the Vulnyx glb), y 0..1, faces +z.
import trimesh,numpy as np,json,math,sys
P=json.load(open(sys.argv[1])); OUT=sys.argv[2]
d=trimesh.load('/tmp/manalotl-spike/clean.ply',force='mesh'); v=np.load('/tmp/manalotl-spike/vn.npy')
m=trimesh.Trimesh(v,d.faces,process=False); m.fix_normals(); v=m.vertices; n=m.vertex_normals
hx=P['headx']
lin=lambda c:np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
h=lambda s:np.array([int(s[i:i+2],16) for i in (1,3,5)])/255
BODY,BELLY,STALK,TIP=h(P['body']),h(P['belly']),h(P['stalk']),h(P['tip'])
# frill = outside the head sides above the shoulders, or above the crown, behind the face
fr=((np.abs(v[:,0]-hx)>P['frx'])&(v[:,1]>P['fry']))|(v[:,1]>P['crown'])
fr&=v[:,2]<P['frz']
nb=m.vertex_neighbors
cls=fr.astype(int)
for _ in range(2):
    cls=np.array([np.bincount(cls[[i]+list(nb[i])],minlength=2).argmax() for i in range(len(v))])
col=np.tile(BODY,(len(v),1))
b=P['belly_box']; bel=(v[:,1]>b[0])&(v[:,1]<b[1])&(np.abs(v[:,0]-hx)<b[2])&(n[:,2]>0.1)&(n[:,1]<0.3)&(v[:,2]>b[3])
col[bel]=BELLY
# frills: stalk colour at the root -> pale feather tips, by distance from the head centre
r=np.hypot(v[:,0]-hx,(v[:,1]-P['fry'])*0.8); t=np.clip((r-P['frx'])/0.35,0,1)[:,None]
fcol=STALK*(1-t)+TIP*t
col[cls==1]=fcol[cls==1]
for _ in range(2): col=np.array([col[[i]+list(nb[i])].mean(0) for i in range(len(v))])
col[cls==1]=fcol[cls==1]*0.6+col[cls==1]*0.4
C=(np.c_[col,np.ones(len(v))]*255).round().astype(np.uint8)  # raw sRGB bytes: spirit-model.tsx linearises them once
fm=cls[m.faces].sum(1)>=2
def sub(mask):
    F=m.faces[mask]; u,inv=np.unique(F,return_inverse=True)
    s=trimesh.Trimesh(v[u],inv.reshape(-1,3),vertex_normals=n[u],process=False,vertex_colors=C[u]); return s
body,frills=sub(~fm),sub(fm)
# eyes: big round dark eyes on the face surface (+z), smile line under them
Zg=np.load('/tmp/manalotl-spike/frontZ.npy')
def zat(x,y):
    j=int(round((x+0.36)/0.02)); i=int(round((0.92-y)/0.02)); return np.nanmax(Zg[max(i-1,0):i+2,max(j-1,0):j+2])
def disc(cx,cy,cz,sx,sy,col,seg=24,rot=0):
    th=np.linspace(0,2*np.pi,seg,endpoint=False); pts=np.c_[sx*np.cos(th),sy*np.sin(th)]
    c_,s_=math.cos(rot),math.sin(rot); pts=pts@np.array([[c_,s_],[-s_,c_]])
    V=np.vstack([[0,0,0],np.c_[pts,np.zeros(seg)]])+[cx,cy,cz]
    # bend onto the head: push each ring point to the surface depth there
    F=[[0,1+i,1+(i+1)%seg] for i in range(seg)]
    t=trimesh.Trimesh(V,F,process=False); t.visual.vertex_colors=np.tile(np.r_[lin(np.array(col)/255)*255,255],(len(V),1)).astype(np.uint8); return t
E=P['eyes']; parts=[]
for side in (-1,1):
    cx=hx+E['x']*side; cy=E['y']; z0=zat(cx,cy)+E['dz']; W=E['r']
    parts+=[disc(cx,cy,z0,W*1.12,W*1.12,[58,34,38]),                 # soft dark-plum outline
            disc(cx,cy,z0+0.005,W,W,[52,48,56]),                       # dark grey iris
            disc(cx,cy-W*0.05,z0+0.01,W*0.6,W*0.6,[18,14,18]),       # pupil
            disc(cx+W*0.28*side*0+W*0.22,cy+W*0.32,z0+0.015,W*0.26,W*0.26,[255,255,255],12),  # catchlight (upper right, as the concept)
            disc(cx-W*0.3,cy-W*0.38,z0+0.015,W*0.1,W*0.1,[235,235,240],8)]
S=P.get('smile')
if S:
    # the eternal smile: a thin gentle arc, a strip of quads following the face surface
    k=24; xs=np.linspace(-S['w']/2,S['w']/2,k); ys=S['y']-S['curve']*(1-(2*xs/S['w'])**2)
    th=S['th']; V=[];F=[]
    for i,(x,y) in enumerate(zip(xs+hx,ys)):
        tt=th*(0.55+0.45*(1-abs(2*(x-hx)/S['w'])))
        z=zat(x,y)+S['dz']; V+= [[x,y+tt/2,z],[x,y-tt/2,z]]
        if i: a=2*i; F+=[[a-2,a-1,a],[a,a-1,a+1]]
    sm=trimesh.Trimesh(np.array(V),F,process=False); sm.visual.vertex_colors=np.tile(np.r_[lin(np.array(S['col'])/255)*255,255],(len(V),1)).astype(np.uint8); parts.append(sm)
eyes=trimesh.util.concatenate(parts)
sc=trimesh.Scene()
for nm,g in (('body',body),('frills',frills),('eyes',eyes)): sc.add_geometry(g,node_name=nm,geom_name=nm)
sc.export(OUT)
print('tris body',len(body.faces),'frills',len(frills.faces),'eyes',len(eyes.faces),'bounds',m.bounds.round(3).tolist())
