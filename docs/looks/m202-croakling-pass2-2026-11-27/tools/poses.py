"""blender -b -P poses.py -- <rigged.glb> <out dir> <prefix> : the rigged glb through BLENDER'S OWN importer + armature (a second reader of
the file), posed at clip phases, look.py's toon materials. Writes <prefix>_<clip>_<view>_<k>.png: walk + run phases from the side and from
ABOVE (the sprawl's S-swing reads from above), sit + lie three-quarter. Rig proof for Alex (rig-check style)."""
import bpy, sys, os, math
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__)); A = sys.argv[sys.argv.index('--') + 1:]; GLB, OUT, PRE = A[0], A[1], A[2]
LOOK = os.path.join(HERE, '../../m202-croakling-line-2026-11-27/tools/look.py'); os.environ['LOOK_H'] = '1'
src = open(LOOK).read(); sys.argv = ['x', '--', GLB, '/tmp/x', '10']; exec(src[:src.index('ms = [o for o')])
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=GLB); sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
for o in sc.objects:
    if o.type == 'MESH':
        me = o.data; vc = me.color_attributes[0].name if me.color_attributes else None; me.materials.clear(); me.materials.append(mat(vc, o.name.startswith('eyes')))
    if o.name.startswith('Icosphere'): o.hide_render = True
sc.render.engine = 'CYCLES'; sc.cycles.samples = 10; sc.cycles.use_denoising = False; sc.view_settings.view_transform = 'Standard'
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.30, .40, .42, 1)
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -.0005)); fl = bpy.context.object; fm = bpy.data.materials.new('f'); fm.use_nodes = True
fm.node_tree.nodes['Principled BSDF'].inputs[0].default_value = (.12, .19, .10, 1); fl.data.materials.append(fm)
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co; cam.type = 'ORTHO'
sun = bpy.data.lights.new('s', 'SUN'); so = bpy.data.objects.new('s', sun); sc.collection.objects.link(so); so.rotation_euler = (.6, .2, .4)
acts = {a.name.split('_')[0].split('.')[0]: a for a in bpy.data.actions}; print('actions', list(acts))
arm.animation_data_create()
for tr in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(tr)
def pose(clip, k):
    a = acts[clip]; arm.animation_data.action = a; f0, f1 = a.frame_range; sc.frame_set(int(round(f0 + (f1 - f0) * k)))
def shot(name, view, scale, w=420, h=300):
    sc.render.resolution_x, sc.render.resolution_y = w, h; cam.ortho_scale = scale
    if view == 'side': co.location = (8, .37, .30); co.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    elif view == 'top': co.location = (0, .30, 8); co.rotation_euler = (0, 0, math.pi / 2)
    else: d = Vector((math.sin(-.75) * math.cos(.35), -math.cos(-.75) * math.cos(.35), math.sin(.35))); co.location = Vector((0, .3, .2)) + d * 8; co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, f'{PRE}_{name}.png'); bpy.ops.render.render(write_still=True)
for clip in ('walk', 'run'):
    for i, k in enumerate((0, .25, .5, .75)):
        pose(clip, k); shot(f'{clip}_side_{i}', 'side', 2.5); shot(f'{clip}_top_{i}', 'top', 2.5)
for clip in ('idle', 'sit', 'lie'): pose(clip, .3); shot(f'{clip}_tq_0', 'tq', 2.3)
