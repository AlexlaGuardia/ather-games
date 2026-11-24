"""blender -b -P reel.py -- <outdir>: idle, walk, run of ../b-rigged.glb through Blender's own glTF importer; side view (tracking) + front three-quarter"""
import sys, os, math; HERE = os.path.dirname(os.path.abspath(__file__)); out = sys.argv[-1]; sys.argv = ['x', '--', os.path.join(HERE, '../b-rigged.glb'), out + '/x', '10']
src = open(os.path.join(HERE, 'look.py')).read(); src = src[:src.index('R = max(1.')]; exec(src)
arm = next(o for o in sc.objects if o.type == 'ARMATURE'); arm.parent = hol
for o in sc.objects:
    if o.type == 'MESH' and o.parent == hol: o.parent = arm; o.matrix_parent_inverse.identity()
    if o.type == 'MESH' and any(m.type == 'WELD' for m in o.modifiers):
        for n in ('ARMATURE', 'WELD', 'DISPLACE'): o.modifiers.move(next(i for i, m in enumerate(o.modifiers) if m.type == n), len(o.modifiers) - 1)
base = hol.location.copy(); sc.cycles.samples = 5; fr = 0; y = 0; FPS = 24
for clip, dur, v in (('idle', 2.4, 0), ('walk', 2.2, .55), ('run', 2.2, 1.92)):
    a = next(x for x in bpy.data.actions if x.name.startswith(clip)); arm.animation_data_create(); [setattr(t, 'mute', True) for t in arm.animation_data.nla_tracks]; arm.animation_data.action = a
    if getattr(a, 'slots', None): arm.animation_data.action_slot = a.slots[0]
    L = a.frame_range[1] - a.frame_range[0]; T = L / sc.render.fps
    for b in arm.pose.bones: b.matrix_basis.identity()
    for i in range(int(dur * FPS)):
        y += v / FPS; u = (i / FPS / T) % 1; f = a.frame_range[0] + L * u; sc.frame_set(int(f), subframe=f - int(f)); hol.location = base; hol.location.y = base.y - y
        shot(f's{fr:04d}', -math.pi / 2, .12, 3, (0, -y, .34), 22, 420, 320); shot(f'q{fr:04d}', -.75, .22, 3, (0, -y, .34), 22, 420, 320); fr += 1
