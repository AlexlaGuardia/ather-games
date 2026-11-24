"""blender -b -P look.py -- <glb> <out prefix> [size]: the Vulnyx look.py recipe (3-step toon, emissive floor, pale hull, unlit eyes) at 0.45 m, with the Noctyx tints:
emissive violet, hull pale violet. (3-step toon, emissive floor, pale hull, unlit eyes). A glb without vertex colours renders grey clay."""
import bpy, sys, math, numpy as np
from mathutils import Vector
glb, out, size = (sys.argv[sys.argv.index('--') + 1:] + ['420'])[:3]; size = int(size)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb); sc = bpy.context.scene; H = .45
def mat(vc, unlit=False, hull=False):
    m = bpy.data.materials.new('m'); m.use_nodes = True; t = m.node_tree; t.nodes.clear(); L = t.links.new; N = t.nodes.new; o = N('ShaderNodeOutputMaterial'); e = N('ShaderNodeEmission'); g = N('ShaderNodeNewGeometry')
    if hull:
        tr = N('ShaderNodeBsdfTransparent'); e.inputs[0].default_value = (.72, .64, 1, 1); x = N('ShaderNodeMixShader'); k = N('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = .38
        L(g.outputs['Backfacing'], k.inputs[0]); L(k.outputs[0], x.inputs[0]); L(tr.outputs[0], x.inputs[1]); L(e.outputs[0], x.inputs[2]); L(x.outputs[0], o.inputs[0]); return m
    if vc: c = N('ShaderNodeVertexColor'); c.layer_name = vc
    else: c = N('ShaderNodeRGB'); c.outputs[0].default_value = (.8, .8, .78, 1)
    gm = N('ShaderNodeGamma'); gm.inputs[1].default_value = 2.2; L(c.outputs[0], gm.inputs[0])
    if unlit: L(c.outputs[0], e.inputs[0]); L(e.outputs[0], o.inputs[0]); return m
    d = N('ShaderNodeVectorMath'); d.operation = 'DOT_PRODUCT'; d.inputs[1].default_value = Vector((-.45, -.35, .82)).normalized(); L(g.outputs['Normal'], d.inputs[0])
    r = N('ShaderNodeValToRGB'); r.color_ramp.interpolation = 'CONSTANT'; r.color_ramp.elements[0].color = (.5, .5, .5, 1); r.color_ramp.elements[1].position = .33; r.color_ramp.elements[1].color = (.78, .78, .78, 1)
    q = r.color_ramp.elements.new(.66); q.color = (1, 1, 1, 1); L(d.outputs['Value'], r.inputs[0]); mx = N('ShaderNodeMixRGB'); mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1; L(gm.outputs[0], mx.inputs[1]); L(r.outputs[0], mx.inputs[2])
    ad = N('ShaderNodeMixRGB'); ad.blend_type = 'ADD'; ad.inputs[0].default_value = .10; ad.inputs[2].default_value = (.60, .52, .94, 1); L(mx.outputs[0], ad.inputs[1]); L(ad.outputs[0], e.inputs[0]); L(e.outputs[0], o.inputs[0]); return m
ms = [o for o in sc.objects if o.type == 'MESH']; P = np.vstack([[tuple(o.matrix_world @ v.co) for v in o.data.vertices] for o in ms]); lo, hi = P.min(0), P.max(0); s = H / (hi[2] - lo[2])
hol = bpy.data.objects.new('h', None); sc.collection.objects.link(hol); hol.scale = (s,) * 3; hol.location = (-(lo[0] + hi[0]) / 2 * s, -(lo[1] + hi[1]) / 2 * s, -lo[2] * s)
for o in ms:
    o.parent = hol; me = o.data; vc = me.color_attributes[0].name if me.color_attributes else None; me.materials.clear(); me.materials.append(mat(vc, o.name.startswith('eyes')))
    if not o.name.startswith('eyes') and vc: h = o.copy(); h.data = me.copy(); sc.collection.objects.link(h); h.data.materials.clear(); h.data.materials.append(mat(vc, hull=True)); d = h.modifiers.new('d', 'DISPLACE'); d.strength = .012; d.mid_level = 0
    if vc and not o.name.startswith('eyes'):                    # weld the colour-split verts for the hull only, so it does not crack
        w = h.modifiers.new('w', 'WELD'); w.merge_threshold = 1e-5; h.modifiers.move(1, 0)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 12; sc.cycles.use_denoising = False; sc.view_settings.view_transform = 'Standard'; sc.cycles.transparent_max_bounces = 12
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.30, .40, .42, 1)
gm = bpy.data.materials.new('g'); gm.use_nodes = True; n = gm.node_tree; n.nodes.clear(); o = n.nodes.new('ShaderNodeOutputMaterial'); e = n.nodes.new('ShaderNodeEmission'); ck = n.nodes.new('ShaderNodeTexChecker'); tc = n.nodes.new('ShaderNodeNewGeometry')
ck.inputs['Scale'].default_value = 4; ck.inputs[1].default_value = (.10, .17, .09, 1); ck.inputs[2].default_value = (.13, .21, .11, 1); n.links.new(tc.outputs['Position'], ck.inputs[0]); n.links.new(ck.outputs[0], e.inputs[0]); n.links.new(e.outputs[0], o.inputs[0])
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -.0005)); bpy.context.object.data.materials.append(gm)
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
def shot(f, az, el, dist, tgt, fov, w=size, h=size):
    sc.render.resolution_x, sc.render.resolution_y = w, h; d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))); co.location = Vector(tgt) + d * dist; co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.angle = math.radians(fov); sc.render.filepath = f'{out}_{f}.png'; bpy.ops.render.render(write_still=True)
R = 1.0; c = (0, 0, .225)
for f, az, el in (('front', 0, .05), ('side', -math.pi / 2, .06), ('rear', -math.pi + .75, .32), ('tq', -.65, .16)): shot(f, az, el, 1.75 * R, c, 22)
shot('face', -.12, .04, 1.0, (0, -.1, .345), 24); shot('game', -.5, math.atan2(1.4, 4.6), 4.8, (0, 0, .5), 64, 390, 844)
