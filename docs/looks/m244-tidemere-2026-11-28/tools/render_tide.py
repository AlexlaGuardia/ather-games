"""M244 sheet 11 (m244-croakarc render_croak.py, unchanged but the name): quick look renders of a rigged awakened glb through BLENDER'S OWN glTF importer (a second reader of the file).
    /opt/blender/blender -b -P render_awake.py -- <rigged.glb> <out.png> <clip:t,clip:t,...> [view=side|three|front] [size]
One row of frames (vertex colours, workbench), each the clip at time fraction t, the same ortho camera for all (true relative size)."""
import bpy, sys, os, math
a = sys.argv[sys.argv.index('--') + 1:]; src, out, jobs = a[0], a[1], [j.split(':') for j in a[2].split(',')]; view = a[3] if len(a) > 3 else 'three'; size = float(a[4]) if len(a) > 4 else 2.6
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src); sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE'); acts = {x.name: x for x in bpy.data.actions}
sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'VERTEX'; sh.show_cavity = False; sh.show_object_outline = True
sc.render.resolution_x, sc.render.resolution_y = 520, 620; sc.render.film_transparent = False; sc.world = bpy.data.worlds.new('w'); sc.world.color = (.93, .91, .86)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = size
# glTF +z forward / +y up -> blender: -y forward? the importer maps glTF (x, y, z) to blender (x, -z, y)
d = dict(side=(4, 0, 0), front=(0, -4, 0), three=(3, -3.0, .6), rear=(0, 4, 0))[view]; cx, cy, cz = 0, 0, float(a[5]) if len(a) > 5 else 2.2
cam.location = (cx + d[0], cy + d[1], cz + d[2]); look = (cx - cam.location[0], cy - cam.location[1], cz - cam.location[2])
import mathutils; cam.rotation_euler = mathutils.Vector(look).to_track_quat('-Z', 'Y').to_euler()
fr = []
for i, (clip, t) in enumerate(jobs):
    ac = acts.get(clip) or next(x for n, x in acts.items() if n.startswith(clip))
    arm.animation_data_create(); arm.animation_data.action = ac
    for o in sc.objects:
        if o.type == 'MESH' and o.animation_data: o.animation_data.action = None
    f0, f1 = ac.frame_range; sc.frame_set(int(round(f0 + (f1 - f0) * float(t))))
    p = out.replace('.png', f'-{i}.png'); sc.render.filepath = p; bpy.ops.render.render(write_still=True); fr.append(p)
print('FRAMES', ','.join(fr))
