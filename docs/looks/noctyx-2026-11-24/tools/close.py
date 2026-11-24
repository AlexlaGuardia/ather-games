"""blender -b -P close.py -- <outdir>: the sheet stills, the scale line-up and the dim-ground phone crop of ../noctyx-rigged.glb through Blender's own glTF importer"""
import sys, os, math; HERE = os.path.dirname(os.path.abspath(__file__)); a_ = sys.argv[sys.argv.index('--') + 1:]; out = a_[0]; ST = len(a_) > 1; sys.argv = ['x', '--', os.path.join(HERE, '../noctyx-rigged.glb'), out + '/x', '10']
src = open(os.path.join(HERE, 'look.py')).read(); src = src[:src.index('R = 1.0')]; exec(src)
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
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=.014, depth=.5, location=(0, 0, .495 + .0145), rotation=(0, math.pi / 2, 0)); bar = bpy.context.object; bm = bpy.data.materials.new('bar'); bm.use_nodes = True; bm.node_tree.nodes.clear(); e_ = bm.node_tree.nodes.new('ShaderNodeEmission'); e_.inputs[0].default_value = (.10, .07, .05, 1); bm.node_tree.links.new(e_.outputs[0], bm.node_tree.nodes.new('ShaderNodeOutputMaterial').inputs[0]); bar.data.materials.append(bm); bar.hide_render = True
TG = dict(run=(0, 0, .36), glide=(0, 0, .36))
for n, c, u, az, el in (('c_front', 'idle', .02, 0, .08), ('c_tq', 'idle', .02, -.6, .16), ('c_side', 'idle', .02, -1.57, .06), ('c_rear', 'idle', .02, -2.4, .25), ('c_shift', 'idle', .48, -.5, .14), ('walk', 'walk', .62, -.75, .12), ('run1', 'run', .22, -.7, .12), ('run2', 'run', .72, -.6, .14), ('run3', 'run', .05, 2.5, .40), ('glide', 'glide', .1, -.35, .28), ('glide2', 'glide', .1, 0, -.02), ('sit', 'sit', .30, -.45, .12), ('lie', 'lie', .4, -.4, .14), ('hang1', 'hang', .1, -.45, .05), ('hang2', 'hang', .62, -.1, .05)): bar.hide_render = c != 'hang'; pose(c, u); shot(n, az, el, 1.75, TG.get(c, (0, 0, .23)), 24, 420, 420)
bar.hide_render = True; pose('idle', .02)
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
shot('phone', -.4, math.atan2(1.4, 4.6), 4.8, (0, 0, .5), 64, 390, 844)
guest('../../vulnyx-2026-11-24/b-v2.glb', .7, -.78, (1, .65, .07), (1, .87, .48), .16); guest('../../athowl-2026-11-24/athowl.glb', .5, -.32, (.80, .72, 1), (.90, .84, 1), .10); guest('../../dewbear-2026-11-24/dewbear-v2.glb', .5, .70, (.8, .95, 1), (.85, .95, 1), .10); hol.location.x = .18
shot('scale', 0, .10, 3.9, (-.04, 0, .34), 33, 760, 420)
# a dim Wilds: ground and sky near black, lit colour to a third; the emissive floor, hull and eyes stay (as in game)
for m in bpy.data.materials:
    for n in m.node_tree.nodes if m.node_tree else []:
        if n.type == 'VALTORGB':
            for e in n.color_ramp.elements: e.color = (*[c * .34 for c in e.color[:3]], 1)
        if n.type == 'TEX_CHECKER': n.inputs[1].default_value = (.014, .022, .022, 1); n.inputs[2].default_value = (.019, .030, .028, 1)
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.020, .028, .045, 1)
shot('dim', 0, .10, 3.9, (-.04, 0, .34), 33, 760, 420); hol.location.x = .27; shot('dimphone', -.4, math.atan2(1.4, 4.6), 4.8, (0, 0, .5), 64, 390, 844)
