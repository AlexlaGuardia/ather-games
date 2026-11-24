"""blender -b -P close.py -- <outdir>: the sheet stills of ../dewbear-v2-rigged.glb through Blender's own glTF importer"""
import sys, os, math; HERE = os.path.dirname(os.path.abspath(__file__)); a_ = sys.argv[sys.argv.index('--') + 1:]; out = a_[0]; ST = len(a_) > 1; sys.argv = ['x', '--', os.path.join(HERE, '../dewbear-v2-rigged.glb'), out + '/x', '10']
src = open(os.path.join(HERE, 'look.py')).read(); src = src[:src.index('R = 1.12')]; exec(src)
[bpy.data.objects.remove(o) for o in list(sc.objects) if o.name.startswith('Icosphere')]; hol.scale = (H,) * 3; hol.location = (0, 0, 0)      # the importer's bone shape had set the scale
arm = next(o for o in sc.objects if o.type == 'ARMATURE'); arm.parent = hol
for o in sc.objects:
    if o.type == 'MESH' and o.parent == hol: o.parent = arm; o.matrix_parent_inverse.identity()
    if o.type == 'MESH' and any(m.type == 'WELD' for m in o.modifiers):
        for n in ('ARMATURE', 'WELD', 'DISPLACE'): o.modifiers.move(next(i for i, m in enumerate(o.modifiers) if m.type == n), len(o.modifiers) - 1)
base = hol.location.copy()
def pose(clip, u):
    a = next(x for x in bpy.data.actions if x.name.startswith(clip)); arm.animation_data_create(); [setattr(t, 'mute', True) for t in arm.animation_data.nla_tracks]; arm.animation_data.action = a
    if getattr(a, 'slots', None): arm.animation_data.action_slot = a.slots[0]
    for b in arm.pose.bones: b.matrix_basis.identity()
    f = a.frame_range[0] + (a.frame_range[1] - a.frame_range[0]) * u; sc.frame_set(int(f), subframe=f - int(f))
for n, c, u, az, el in (('idle', 'idle', .70, -.6, .14), ('walk', 'walk', .34, -.9, .12), ('run', 'run', .16, -.75, .12), ('sit', 'sit', .30, -.55, .12), ('lie', 'lie', .4, -.45, .22), ('tun1', 'tun', .19, -.75, .14), ('tun2', 'tun', .60, -.75, .14), ('tun3', 'tun', .60, -1.57, .10), ('tun4', 'tun', .60, 2.6, .05), ('lie2', 'lie', .4, -1.57, .08)): pose(c, u); shot(n, az, el, 2.2, (0, -.03, .26), 24, 420, 420)
