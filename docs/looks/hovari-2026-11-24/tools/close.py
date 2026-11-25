"""blender -b -P close.py -- <outdir>: the sheet stills, the scale line-up and the dim-ground phone crop of ../hovari-rigged.glb through Blender's own glTF importer"""
import sys, os, math; HERE = os.path.dirname(os.path.abspath(__file__)); a_ = sys.argv[sys.argv.index('--') + 1:]; out = a_[0]; ST = len(a_) > 1; sys.argv = ['x', '--', os.path.join(HERE, '../hovari-rigged.glb'), out + '/x', '10']
src = open(os.path.join(HERE, 'look.py')).read(); src = src[:src.index('R = .62')]; exec(src)
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
C = .64
for n, c, u, az, el, z in (('h_front', 'idle', .004, 0, .06, C), ('h_tq', 'idle', .104, -.65, .14, C), ('h_side', 'idle', .004, -1.57, .06, C), ('h_rear', 'idle', .015, 2.5, .25, C), ('h_beat', 'idle', .0165, -.1, .05, C), ('h_beat2', 'idle', .034, -.1, .05, C), ('walk', 'walk', .07, -.75, .12, C), ('walk2', 'walk', .30, -1.3, .12, C), ('run1', 'run', .05, -.75, .12, C), ('run2', 'run', .13, -1.45, .12, C), ('run3', 'run', .05, 2.5, .35, C), ('sit', 'sit', .33, -.45, .12, .56), ('sit2', 'sit', .70, -.45, .12, .56), ('lie', 'lie', .2, -.55, .05, .52), ('lie2', 'lie', .2, -1.45, .10, .52), ('gl0', 'glance', .10, -.5, .10, C), ('gl1', 'glance', .33, -.5, .10, C), ('gl2', 'glance', .70, -.5, .10, C), ('slp', 'lie', .2, -.5, -.25, .56)): pose(c, u); shot(n, az, el, .70 if n == 'slp' else 1.15, (0, 0, z), 22, 420, 420)
pose('idle', .0165)
def guest(f, h, x, em, hl, k):
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, f)); os_ = [o for o in bpy.context.selected_objects if o.type == 'MESH']; g = bpy.data.objects.new('g', None); sc.collection.objects.link(g); g.scale = (h,) * 3; g.location = (x, -.02, 0)
    def tint(m, hull=False):
        for n in m.node_tree.nodes:
            if n.type == 'EMISSION' and hull: n.inputs[0].default_value = (*hl, 1)
            if n.type == 'MIX_RGB' and n.blend_type == 'ADD': n.inputs[0].default_value = k; n.inputs[2].default_value = (*em, 1)
        return m
    for o in os_:
        o.parent = g; me = o.data; vc = me.color_attributes[0].name; e = o.name.startswith('eyes'); me.materials.clear(); me.materials.append(tint(mat(vc, e)))
        if not e: q = o.copy(); q.data = me.copy(); sc.collection.objects.link(q); q.data.materials.clear(); q.data.materials.append(tint(mat(vc, hull=True), True)); w = q.modifiers.new('w', 'WELD'); w.merge_threshold = 1e-5; d = q.modifiers.new('d', 'DISPLACE'); d.strength = .013; d.mid_level = 0
shot('phone', -.4, math.atan2(1.4, 4.6), 4.8, (0, 0, .6), 64, 390, 844)
guest('../../vulnyx-2026-11-24/b-v2.glb', .7, -.86, (1, .65, .07), (1, .87, .48), .16); guest('../../athowl-2026-11-24/athowl.glb', .5, -.38, (.80, .72, 1), (.90, .84, 1), .10); guest('../../noctyx-2026-11-24/noctyx.glb', .45, .46, (.60, .52, .94), (.72, .64, 1), .10); guest('../../dewbear-2026-11-24/dewbear-v2.glb', .5, 1.06, (.8, .95, 1), (.85, .95, 1), .10); hol.location.x = .05
shot('scale', 0, .10, 3.9, (.06, 0, .42), 36, 820, 440)
# a dim Wilds: ground and sky near black, lit colour to a third; the emissive floor, hull and eyes stay (as in game)
for m in bpy.data.materials:
    for n in m.node_tree.nodes if m.node_tree else []:
        if n.type == 'VALTORGB':
            for e in n.color_ramp.elements: e.color = (*[c * .34 for c in e.color[:3]], 1)
        if n.type == 'TEX_CHECKER': n.inputs[1].default_value = (.014, .022, .022, 1); n.inputs[2].default_value = (.019, .030, .028, 1)
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.020, .028, .045, 1)
shot('dim', 0, .10, 3.9, (.06, 0, .42), 36, 820, 440); shot('dimphone', -.4, math.atan2(1.4, 4.6), 4.8, (0, 0, .6), 64, 390, 844)
