"""blender -b -P scale.py -- <out prefix> : the Dewbear (0.50 m) beside the Vulnyx v2 (0.70 m) and the Athowl (0.50 m), front + the phone screen"""
import sys, os; HERE = os.path.dirname(os.path.abspath(__file__)); out_ = sys.argv[-1]; sys.argv = ['x', '--', os.path.join(HERE, '../dewbear-v2.glb'), out_, '420']
src = open(os.path.join(HERE, 'look.py')).read(); exec(src[:src.index('R = 1.12')]); hol.location.x += .36
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, '../../vulnyx-2026-11-24/b-v2.glb')); V = list(bpy.context.selected_objects); h2 = bpy.data.objects.new('h2', None); sc.collection.objects.link(h2); h2.scale = (.7,) * 3; h2.location = (-.36, -.05, 0)
def fox(m, hull=False):
    for n in m.node_tree.nodes:
        if n.type == 'EMISSION' and hull: n.inputs[0].default_value = (1, .87, .48, 1)
        if n.type == 'MIX_RGB' and n.blend_type == 'ADD': n.inputs[0].default_value = .16; n.inputs[2].default_value = (1, .65, .07, 1)
    return m
for o in V:
    if o.type != 'MESH': continue
    o.parent = h2; me = o.data; vc = me.color_attributes[0].name; e = o.name.startswith('eyes'); me.materials.clear(); me.materials.append(fox(mat(vc, e)))
    if not e:
        h = o.copy(); h.data = me.copy(); sc.collection.objects.link(h); h.data.materials.clear(); h.data.materials.append(fox(mat(vc, hull=True), True)); w = h.modifiers.new('w', 'WELD'); w.merge_threshold = 1e-5; d = h.modifiers.new('d', 'DISPLACE'); d.strength = .016; d.mid_level = 0
OWL = os.path.join(HERE, '../../athowl-2026-11-24/athowl.glb'); bpy.ops.import_scene.gltf(filepath=OWL); h3 = bpy.data.objects.new('h3', None); sc.collection.objects.link(h3); h3.scale = (.5,) * 3; h3.location = (-.15, -.05, 0)
def owl(m, hull=False):
    for n in m.node_tree.nodes:
        if n.type == 'EMISSION' and hull: n.inputs[0].default_value = (.90, .84, 1, 1)
        if n.type == 'MIX_RGB' and n.blend_type == 'ADD': n.inputs[2].default_value = (.80, .72, 1, 1)
    return m
for o in list(bpy.context.selected_objects):
    if o.type != 'MESH': continue
    o.parent = h3; me = o.data; vc = me.color_attributes[0].name; e = o.name.startswith('eyes'); me.materials.clear(); me.materials.append(owl(mat(vc, e)))
    if not e:
        h = o.copy(); h.data = me.copy(); sc.collection.objects.link(h); h.data.materials.clear(); h.data.materials.append(owl(mat(vc, hull=True), True)); w = h.modifiers.new('w', 'WELD'); w.merge_threshold = 1e-5; d = h.modifiers.new('d', 'DISPLACE'); d.strength = .012; d.mid_level = 0
hol.location.x = .46; h2.location = (-.60, -.05, 0)
shot('scale', 0, .10, 3.6, (0, 0, .34), 33, 640, 420); hol.rotation_euler.z = -.6; shot('phone', -.4, __import__('math').atan2(1.4, 4.6), 4.8, (0, 0, .5), 64, 390, 844)
