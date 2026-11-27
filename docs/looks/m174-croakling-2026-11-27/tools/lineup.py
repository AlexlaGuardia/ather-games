"""blender -b -P lineup.py -- <out.png>: the ten base forms at TRUE RELATIVE SIZE, grimoire order (#001-#010), orthographic, each at the
height the game draws her (spirit-models.ts SPIRIT_RIGS h = GROWN / glb tall; Lepara + Shellmere + Croakling from spirit-base-preview.ts). Not built yet = a grey
block of her ruled GROWN height. Rest pose (the Hovari's bind pose hangs in the air, as she hovers in game)."""
import bpy, sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = sys.argv[sys.argv.index('--') + 1]; os.environ['LOOK_H'] = '1'
src = open(os.path.join(HERE, 'look.py')).read(); sys.argv = ['x', '--', os.path.join(HERE, '../croakling.glb'), '/tmp/x', '10']; exec(src[:src.index('ms = [o for o')])
SP = os.path.join(HERE, '../../../../public/open/spirits/')
# name, glb (None = not built), metres per glb unit, grown height (blocks)
ROW = [('vulnyx', 'vulnyx-rigged.glb', .70 / 1.003, 0), ('manalotl', 'manalotl-rigged.glb', .90 / 2.145, 0), ('dewbear', 'dewbear-rigged.glb', .50, 0), ('shellmere', 'shellmere-rigged.glb', .45 / .97, 0), ('athowl', 'athowl-rigged.glb', .50 / 1.005, 0),
       ('croakling', 'croakling-rigged.glb', .40 / .999, 0), ('luminara', None, 0, .10), ('lepara', 'lepara-rigged.glb', .48 / .982, 0), ('hovari', 'hovari-rigged.glb', .219, 0), ('noctyx', 'noctyx-rigged.glb', .45 / .999, 0)]
GAP = .75
[bpy.data.objects.remove(o) for o in list(bpy.data.objects)]                         # look.py's own import of croakling.glb
blk = bpy.data.materials.new('blk'); blk.diffuse_color = (.5, .5, .5, 1); blk.use_nodes = True; nt = blk.node_tree; nt.nodes.clear(); e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (.42, .44, .46, 1); o_ = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], o_.inputs[0])
for i, (n, g, s, gh) in enumerate(ROW):
    x = (i - 4.5) * GAP
    if g is None:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, gh / 2)); c = bpy.context.object; c.scale = (min(.30, gh * 1.4), .25, gh); c.data.materials.append(blk); continue
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=SP + g); new = [o for o in bpy.data.objects if o not in before]
    ico = [o for o in new if o.name.startswith('Icosphere')]; new = [o for o in new if not o.name.startswith('Icosphere')]; [bpy.data.objects.remove(o) for o in ico]
    hol = bpy.data.objects.new('h' + n, None); sc.collection.objects.link(hol); hol.scale = (s,) * 3; hol.location = (x, 0, 0); hol.rotation_euler = (0, 0, -.55)
    for o in new:
        if o.parent is None: o.parent = hol
        if o.type == 'MESH': me = o.data; vc = me.color_attributes[0].name if me.color_attributes else None; me.materials.clear(); me.materials.append(mat(vc, o.name.startswith('eyes')))
sc.render.engine = 'CYCLES'; sc.cycles.samples = 10; sc.cycles.use_denoising = False; sc.view_settings.view_transform = 'Standard'
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.30, .40, .42, 1)
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = GAP * 10.2; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0, -20, .64); co.rotation_euler = (math.pi / 2, 0, 0); sc.render.resolution_x, sc.render.resolution_y = 2040, 345; cam.shift_y = 0.0
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
