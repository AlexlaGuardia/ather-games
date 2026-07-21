# flora_tree.py — picaso (GLB branch, 2026-07-21)
# Model-to-GLB producer for Shimmer play3d (react-three-fiber).
# Builds ONE stylized low-poly tree, materials named 'Trunk'/'Canopy' (neutral white so
# r3f tints per-instance from NODE_LOOK: look.trunk/look.canopy/look.glow/scale).
# Exports GLB (neutral) + renders a preview PNG (sample-tinted) so we can LOOK at the form.
#   /opt/blender/blender -b -P tools/render/flora_tree.py
# Env: OUT (glb+png dir), RES (preview px). No color baked into the GLB.
import bpy, bmesh, os, math
from mathutils import Vector

OUT = os.environ.get('OUT', '/root/ather-games/public/models/flora')
RES = int(os.environ.get('RES', '512'))
os.makedirs(OUT, exist_ok=True)

# --- clean slate ---
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, base=(1,1,1,1), rough=0.85, emit=(0,0,0,1), emit_str=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = base
    b.inputs['Roughness'].default_value = rough
    b.inputs['Emission Color'].default_value = emit
    b.inputs['Emission Strength'].default_value = emit_str
    return m

trunk_mat  = mat('Trunk',  base=(1,1,1,1), rough=0.9)
canopy_mat = mat('Canopy', base=(1,1,1,1), rough=0.75)

# --- trunk: slightly tapered, faint lean ---
bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=0.15, radius2=0.10, depth=1.0, location=(0,0,0.5))
trunk = bpy.context.object; trunk.name = 'trunk'
trunk.rotation_euler = (math.radians(2.5), 0, 0.3)
trunk.data.materials.append(trunk_mat)
bpy.ops.object.shade_flat()

# --- canopy: 3 offset low-poly icospheres = a clustered, non-spherical silhouette ---
blobs = [((0,0,1.55),0.62),((0.28,0.12,1.32),0.40),((-0.22,-0.14,1.40),0.42)]
canopy_objs = []
for i,(loc,r) in enumerate(blobs):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=loc)
    o = bpy.context.object; o.name = f'canopy{i}'
    # jitter verts for organic low-poly read
    bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts:
        v.co += Vector(((hash((i,v.index,'x'))%100-50)/900.0,
                        (hash((i,v.index,'y'))%100-50)/900.0,
                        (hash((i,v.index,'z'))%100-50)/900.0))
    bm.to_mesh(o.data); bm.free()
    o.data.materials.append(canopy_mat)
    canopy_objs.append(o)

# join canopy blobs, then join trunk -> single object, 2 material slots
bpy.ops.object.select_all(action='DESELECT')
for o in canopy_objs: o.select_set(True)
bpy.context.view_layer.objects.active = canopy_objs[0]
bpy.ops.object.join(); canopy = bpy.context.object; canopy.name='canopy'
bpy.ops.object.shade_flat()
bpy.ops.object.select_all(action='DESELECT')
canopy.select_set(True); trunk.select_set(True)
bpy.context.view_layer.objects.active = trunk
bpy.ops.object.join()
tree = bpy.context.object; tree.name = 'FloraTree'
# origin to base so it plants on ground (min z -> 0)
bpy.context.scene.cursor.location = (0,0,0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

# --- export GLB (neutral, tint-ready) ---
glb = os.path.join(OUT, 'tree.glb')
bpy.ops.object.select_all(action='DESELECT'); tree.select_set(True)
bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True,
                          export_yup=True, export_format='GLB')
print('WROTE', glb)

# --- preview render (sample tint just to judge FORM) ---
trunk_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.42,0.26,0.14,1)
canopy_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.31,0.78,0.60,1)
scn = bpy.context.scene
scn.render.engine='CYCLES'; scn.cycles.samples=48; scn.cycles.device='CPU'
scn.render.resolution_x=RES; scn.render.resolution_y=RES
scn.render.film_transparent=False
# world bg
scn.world = bpy.data.worlds.new('W'); scn.world.use_nodes=True
scn.world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.09,0.10,0.13,1)
# ground
bpy.ops.mesh.primitive_plane_add(size=8, location=(0,0,0))
gp=bpy.context.object; gp.data.materials.append(mat('G', base=(0.14,0.15,0.13,1), rough=1.0))
# camera 3/4 eye-level
bpy.ops.object.camera_add(location=(2.6,-3.0,2.0)); cam=bpy.context.object
cam.rotation_euler=(math.radians(66),0,math.radians(42)); scn.camera=cam
# key sun + fill
bpy.ops.object.light_add(type='SUN', location=(3,-2,6)); bpy.context.object.data.energy=3.2
bpy.ops.object.light_add(type='AREA', location=(-3,-1,3)); bpy.context.object.data.energy=180
scn.render.filepath=os.path.join(OUT,'tree_preview.png')
bpy.ops.render.render(write_still=True)
print('WROTE preview')
