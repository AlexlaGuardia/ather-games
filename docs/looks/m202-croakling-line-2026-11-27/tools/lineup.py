"""blender -b -P lineup.py -- <out.png> <yaw> : the old base Croakling + her four second forms at TRUE RELATIVE SIZE (orthographic, rest pose),
each at the scale the game draws her (base: GROWN 0.40 / glb tall 0.999; a form: that x her dial, spirit-models.ts FORM_GROW_BY).
yaw 1.5708 = side (profile), -0.6 = three-quarter. Copy of the M174 lineup recipe (look.py's toon materials)."""
import bpy, sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); a_ = sys.argv[sys.argv.index('--') + 1:]; OUT, YAW = a_[0], float(a_[1]); os.environ['LOOK_H'] = '1'
src = open(os.path.join(HERE, 'look.py')).read(); sys.argv = ['x', '--', os.path.join(HERE, '../croakrill.glb'), '/tmp/x', '10']; exec(src[:src.index('ms = [o for o')])
SP = os.path.join(HERE, '../../../../public/open/spirits/'); B = .40 / .999
ROW = [('croakling (base)', 'croakling-rigged.glb', B), ('croakrill', 'croakrill-rigged.glb', B * 1.4), ('croakara', 'croakara-rigged.glb', B * 1.4), ('croakore', 'croakore-rigged.glb', B * 1.5), ('croakarc', 'croakarc-rigged.glb', B * 1.4)]
GAP = .95
[bpy.data.objects.remove(o) for o in list(bpy.data.objects)]
for i, (n, g, s) in enumerate(ROW):
    x = (i - 2) * GAP
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=SP + g); new = [o for o in bpy.data.objects if o not in before]
    ico = [o for o in new if o.name.startswith('Icosphere')]; new = [o for o in new if not o.name.startswith('Icosphere')]; [bpy.data.objects.remove(o) for o in ico]
    hol = bpy.data.objects.new('h' + n, None); sc.collection.objects.link(hol); hol.scale = (s,) * 3; hol.location = (x, 0, 0); hol.rotation_euler = (0, 0, YAW)
    for o in new:
        if o.parent is None: o.parent = hol
        if o.type == 'MESH': me = o.data; vc = me.color_attributes[0].name if me.color_attributes else None; me.materials.clear(); me.materials.append(mat(vc, o.name.startswith('eyes')))
sc.render.engine = 'CYCLES'; sc.cycles.samples = 10; sc.cycles.use_denoising = False; sc.view_settings.view_transform = 'Standard'
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.30, .40, .42, 1)
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = GAP * 5.3; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0, -20, .42); co.rotation_euler = (math.pi / 2, 0, 0); sc.render.resolution_x, sc.render.resolution_y = 2040, 560
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
