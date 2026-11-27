"""(M202 Athowl line: this folder's look.py recipe with NO tint: no emissive add, no hull)
blender -b -P lineup.py -- <out prefix> <w> <h> <glb>:<scale> ... : the line side by side at TRUE relative size (scale = her game
metres per glb unit), in look.py's recipe (3-step toon, pale hull, unlit eyes); renders <out>_front.png and <out>_tq.png"""
import bpy, sys, math, numpy as np
from mathutils import Vector
A = sys.argv[sys.argv.index('--') + 1:]; out, W, Hh = A[0], int(A[1]), int(A[2]); items = [(a.rsplit(':', 1)[0], float(a.rsplit(':', 1)[1])) for a in A[3:]]
EM, HU = (0, 0, 0, 1), (1, 1, 1, 1)                          # NO tint on the lineup: her vertex colours only (the add is black, no hull)
src = open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'look.py')).read(); exec(src[src.index('def mat'):src.index('ms = [o for o')])
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; x0 = 0.
for k, (g, s) in enumerate(items):
    before = set(sc.objects); bpy.ops.import_scene.gltf(filepath=g); new = [o for o in sc.objects if o not in before]; ms = [o for o in new if o.type == 'MESH']
    P = np.vstack([[tuple(o.matrix_world @ v.co) for v in o.data.vertices] for o in ms]); lo, hi = P.min(0), P.max(0)
    hol = bpy.data.objects.new('h%d' % k, None); sc.collection.objects.link(hol); hol.scale = (s,) * 3; w = (hi[0] - lo[0]) * s
    hol.location = (x0 + w / 2 - (lo[0] + hi[0]) / 2 * s, -(lo[1] + hi[1]) / 2 * s, -lo[2] * s); x0 += w + .12
    for o in new:
        if o.parent is None: o.parent = hol
    for o in ms:
        me = o.data; vc = me.color_attributes[0].name if me.color_attributes else None; me.materials.clear(); me.materials.append(mat(vc, o.name.startswith('eyes')))
sc.render.engine = 'CYCLES'; sc.cycles.samples = 12; sc.cycles.use_denoising = False; sc.view_settings.view_transform = 'Standard'
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.30, .40, .42, 1)
gm = bpy.data.materials.new('g'); gm.use_nodes = True; n = gm.node_tree; n.nodes.clear(); o = n.nodes.new('ShaderNodeOutputMaterial'); e = n.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (.11, .19, .10, 1); n.links.new(e.outputs[0], o.inputs[0])
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -.0005)); bpy.context.object.data.materials.append(gm)
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co; cam.type = 'ORTHO'; cam.ortho_scale = x0 + .1
sc.render.resolution_x, sc.render.resolution_y = W, Hh; c = Vector((x0 / 2 - .06, 0, .46))
for f, az, el in (('front', 0, .05), ('tq', -.55, .14)):
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))); co.location = c + d * 6; co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); sc.render.filepath = f'{out}_{f}.png'; bpy.ops.render.render(write_still=True)
