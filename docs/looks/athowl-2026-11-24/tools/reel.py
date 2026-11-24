"""blender -b -P reel.py -- <outdir> [stills]: every clip of ../athowl-rigged.glb through Blender's own glTF importer; front three-quarter + side. stills = 6 frames a clip"""
import sys, os, math; HERE = os.path.dirname(os.path.abspath(__file__)); a_ = sys.argv[sys.argv.index('--') + 1:]; out = a_[0]; ST = len(a_) > 1; sys.argv = ['x', '--', os.path.join(HERE, '../athowl-rigged.glb'), out + '/x', '10']
src = open(os.path.join(HERE, 'look.py')).read(); src = src[:src.index('R = .92')]; exec(src)
[bpy.data.objects.remove(o) for o in list(sc.objects) if o.name.startswith('Icosphere')]; hol.scale = (H,) * 3; hol.location = (0, 0, 0)      # the importer's bone shape had set the scale
arm = next(o for o in sc.objects if o.type == 'ARMATURE'); arm.parent = hol
for o in sc.objects:
    if o.type == 'MESH' and o.parent == hol: o.parent = arm; o.matrix_parent_inverse.identity()
    if o.type == 'MESH' and any(m.type == 'WELD' for m in o.modifiers):
        for n in ('ARMATURE', 'WELD', 'DISPLACE'): o.modifiers.move(next(i for i, m in enumerate(o.modifiers) if m.type == n), len(o.modifiers) - 1)
base = hol.location.copy(); base.z = 0; sc.cycles.samples = 5; fr = 0; y = 0; FPS = 24
for clip, dur, v in (('idle', 7.5, 0), ('walk', 2., .55), ('run', 2.2, 2.8), ('glide', 2.4, 2.8), ('sit', 6., 0), ('lie', 3., 0)):
    a = next(x for x in bpy.data.actions if x.name.startswith(clip)); arm.animation_data_create(); [setattr(t, 'mute', True) for t in arm.animation_data.nla_tracks]; arm.animation_data.action = a
    if getattr(a, 'slots', None): arm.animation_data.action_slot = a.slots[0]
    L = a.frame_range[1] - a.frame_range[0]; T = L / sc.render.fps; n = 6 if ST else int(dur * FPS)
    for b in arm.pose.bones: b.matrix_basis.identity()
    for i in range(n):
        if not ST: y += v / FPS
        if not ST and os.path.exists(f'{out}/x_s{fr + 1:04d}.png'): fr += 1; continue      # already rendered: a cut-short run goes on
        u = ((.04, .36, .50, .57, .84, .95)[i] if clip == 'idle' else (.05, .24, .34, .6, .75, .9)[i] if clip == 'sit' else i / 6) if ST else (i / FPS / T) % 1; f = a.frame_range[0] + L * u; sc.frame_set(int(f), subframe=f - int(f)); hol.location = base; hol.location.y = base.y - y; fl = clip in ('run', 'glide'); c = (0, -y, .34 if fl else .27); D = 2.6 if fl else 2.1
        shot(f's{fr:04d}', -math.pi / 2, .10, D, c, 22, 380, 320); shot(f'q{fr:04d}', -.6, .16, D, c, 22, 380, 320); fr += 1
