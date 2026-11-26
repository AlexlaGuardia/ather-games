"""blender -b -P pose.py -- <rigged glb> <out prefix> <clip> <t 0..1> : look.py's renders of one frame of one clip (the rigged glb through
Blender's importer + armature), so sit / lie / walk read as the game will pose them"""
import os, sys, bpy
a = sys.argv[sys.argv.index('--') + 1:]; t = float(a.pop()); clip = a.pop(); sys.argv = sys.argv[:sys.argv.index('--') + 1] + a
src = open('/root/ather-games/docs/looks/vulnyx-2026-11-24/tools/look.py').read()
old = "sc = bpy.context.scene; H = .70"; assert old in src
src = src.replace(old, old + '''
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]; act = [x for x in bpy.data.actions if x.name.split('_')[0] == CLIP or x.name.startswith(CLIP)][0]
arm.animation_data_create(); arm.animation_data.action = act; f0, f1 = act.frame_range; sc.frame_set(int(f0 + (f1 - f0) * T)); bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
for o in [o for o in sc.objects if o.type == 'MESH']:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); o.modifiers.clear(); o.parent = None; o.data = me; o.matrix_world = o.matrix_world
arm.animation_data.action = None
''')
CLIP, T = clip, t; exec(src)
