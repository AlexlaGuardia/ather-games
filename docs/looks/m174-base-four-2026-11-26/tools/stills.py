"""blender -b -P stills.py -- <rigged.glb> <out prefix> [H]: three-quarter stills of every clip at fixed moments (the sheet's clip row), through Blender's own glTF importer"""
import sys, os, math; HERE = os.path.dirname(os.path.abspath(__file__)); a_ = sys.argv[sys.argv.index('--') + 1:]; G, out = a_[0], a_[1]; os.environ['LOOK_H'] = a_[2] if len(a_) > 2 else '.48'
sys.argv = ['x', '--', G, out, '300']; src = open(os.path.join(HERE, 'look.py')).read(); exec(src[:src.index('R = H * 1.9')])
[bpy.data.objects.remove(o) for o in list(sc.objects) if o.name.startswith('Icosphere')]; hol.scale = (H,) * 3; hol.location = (0, 0, 0)
arm = next(o for o in sc.objects if o.type == 'ARMATURE'); arm.parent = hol
for o in sc.objects:
    if o.type == 'MESH' and o.parent == hol: o.parent = arm; o.matrix_parent_inverse.identity()
    if o.type == 'MESH' and any(m.type == 'WELD' for m in o.modifiers):
        for n in ('ARMATURE', 'WELD', 'DISPLACE'): o.modifiers.move(next(i for i, m in enumerate(o.modifiers) if m.type == n), len(o.modifiers) - 1)
sc.cycles.samples = 8
MOM = dict(idle=(.03, .57, .85), walk=(.20, .70), run=(.10, .62), sit=(.40, .80), lie=(.5,))
for clip, us in MOM.items():
    a = next(x for x in bpy.data.actions if x.name.startswith(clip)); arm.animation_data_create(); [setattr(t, 'mute', True) for t in arm.animation_data.nla_tracks]; arm.animation_data.action = a
    if getattr(a, 'slots', None): arm.animation_data.action_slot = a.slots[0]
    L = a.frame_range[1] - a.frame_range[0]
    for k, u in enumerate(us): f = a.frame_range[0] + L * u; sc.frame_set(int(f), subframe=f - int(f)); shot(f'{clip}{k}', -.6, .14, H * 3.6, (0, 0, H * .5), 22, 300, 300)
