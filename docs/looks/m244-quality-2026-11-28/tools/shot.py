"""M244 quality experiment: one look render through Blender's glTF importer, same light + camera for every model.
    /opt/blender/blender -b -P shot.py -- <glb> <out.png> <view> [clip:t] [size] [colour=VERTEX|TEXTURE] [rotx_deg]
view: front | three | side | rear. Only body + eyes render (echoes hidden). Workbench STUDIO light, ortho; clip:t poses an armature at time fraction t."""
import bpy, sys, math, mathutils
a = sys.argv[sys.argv.index('--') + 1:]; src, out, view = a[0], a[1], a[2]
clip = a[3] if len(a) > 3 and a[3] != '-' else None; size = float(a[4]) if len(a) > 4 else 2.0
col = a[5] if len(a) > 5 else 'VERTEX'; rx = float(a[6]) if len(a) > 6 else 0
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src); sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = col; sh.show_cavity = False; sh.show_object_outline = True
sc.render.resolution_x, sc.render.resolution_y = 480, 560; sc.world = bpy.data.worlds.new('w'); sc.world.color = (.93, .91, .86)
if rx:
    for o in sc.objects:
        if o.parent is None: o.rotation_mode = 'XYZ'; o.rotation_euler[0] += math.radians(rx)
arm = next((o for o in sc.objects if o.type == 'ARMATURE'), None)
if arm and clip:
    c, t = clip.split(':'); ac = bpy.data.actions.get(c) or next(x for n, x in bpy.data.actions.items() if n.startswith(c))
    arm.animation_data_create(); arm.animation_data.action = ac; f0, f1 = ac.frame_range; sc.frame_set(int(round(f0 + (f1 - f0) * float(t))))
for o in sc.objects:
    if o.type == 'MESH' and o.name not in ('body', 'eyes'): o.hide_render = True   # echoes (aura) are the same in both: hidden so the body reads
bpy.context.view_layer.update()
# frame on the body's bounds (aura / echoes excluded by name)
pts = []
for o in sc.objects:
    if o.type == 'MESH' and o.name in ('body', 'eyes'):
        dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); me = e.to_mesh()
        pts += [e.matrix_world @ v.co for v in me.vertices]; e.to_mesh_clear()
lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
cen = (lo + hi) / 2; ht = hi.z - lo.z
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
cam.data.ortho_scale = size if size > 0 else ht * 1.25
d = dict(side=(4, 0, 0), front=(0, -4, 0), three=(3, -3.0, .6), rear=(0, 4, 0))[view]
cam.location = cen + mathutils.Vector(d); cam.rotation_euler = (cen - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = out; bpy.ops.render.render(write_still=True)
print('SHOT', out, 'h=%.3f' % ht)
