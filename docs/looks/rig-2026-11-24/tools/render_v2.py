"""blender -b -P render_v2.py -- v1|v2 <outdir> <job>   job = views | weights | clip:side | clip:rear   (render.py with a v1/v2 switch, fixed framing and a check from every side)
Renders the RIGGED GLB THROUGH BLENDER'S OWN IMPORTER + armature (so the file is read by a second reader). Colours and the
pale hull follow spirit-model.tsx's recipe (3-step toon, emissive floor, hull at ~1/3 alpha, unlit eyes, glowing frills); the
hull here is a displaced back-face shell, close to the game's 1.06x one."""
import bpy, sys, os, math, importlib, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import rigcore as K
from mathutils import Vector
ver, out, job = sys.argv[sys.argv.index('--') + 1:][:3]; name = 'manalotl'; S = importlib.import_module('spirits.manalotl' + ('_v2' if ver == 'v2' else '')); H = S.HEIGHT
os.makedirs(out, exist_ok=True); before = False
bpy.ops.wm.read_factory_settings(use_empty=True)
src = os.path.join(HERE, '../../../../public/open/spirits', name + '.glb') if before else os.path.join(HERE, '..', name + '-rigged' + ('-v2' if ver == 'v2' else '') + '.glb')
bpy.ops.import_scene.gltf(filepath=src); sc = bpy.context.scene
TINT = dict(vulnyx=((1, .65, .07), (1, .87, .48)), manalotl=((1, .35, .45), (1, .75, .79)))[name]
def mat(vc, unlit=False, glow=0, hull=None):
    m = bpy.data.materials.new('m'); m.use_nodes = True; n = m.node_tree; n.nodes.clear(); L = n.links.new; N = n.nodes.new
    o = N('ShaderNodeOutputMaterial'); e = N('ShaderNodeEmission'); g = N('ShaderNodeNewGeometry')
    if hull:
        t = N('ShaderNodeBsdfTransparent'); e.inputs[0].default_value = (*hull, 1); x = N('ShaderNodeMixShader'); k = N('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = .38
        L(g.outputs['Backfacing'], k.inputs[0]); L(k.outputs[0], x.inputs[0]); L(t.outputs[0], x.inputs[1]); L(e.outputs[0], x.inputs[2]); L(x.outputs[0], o.inputs[0]); return m
    c = N('ShaderNodeVertexColor'); c.layer_name = vc; gm = N('ShaderNodeGamma'); gm.inputs[1].default_value = 2.2; L(c.outputs[0], gm.inputs[0])
    if unlit or job == 'weights': L(gm.outputs[0], e.inputs[0]); L(e.outputs[0], o.inputs[0]); return m
    d = N('ShaderNodeVectorMath'); d.operation = 'DOT_PRODUCT'; d.inputs[1].default_value = Vector((-.45, -.35, .82)).normalized(); L(g.outputs['Normal'], d.inputs[0])
    r = N('ShaderNodeValToRGB'); r.color_ramp.interpolation = 'CONSTANT'; r.color_ramp.elements[0].color = (.5, .5, .5, 1); r.color_ramp.elements[1].position = .33; r.color_ramp.elements[1].color = (.78, .78, .78, 1)
    q = r.color_ramp.elements.new(.66); q.color = (1, 1, 1, 1); L(d.outputs['Value'], r.inputs[0])
    mx = N('ShaderNodeMixRGB'); mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1; L(gm.outputs[0], mx.inputs[1]); L(r.outputs[0], mx.inputs[2])
    ad = N('ShaderNodeMixRGB'); ad.blend_type = 'ADD'; ad.inputs[0].default_value = .16 + glow; ad.inputs[2].default_value = (*TINT[0], 1); L(mx.outputs[0], ad.inputs[1]); L(ad.outputs[0], e.inputs[0]); L(e.outputs[0], o.inputs[0]); return m
arm = next((o for o in sc.objects if o.type == 'ARMATURE'), None); meshes = [o for o in sc.objects if o.type == 'MESH' and o.name.split('.')[0] in ('body', 'frills', 'eyes')]
for o in list(sc.objects):
    if o.type == 'MESH' and o not in meshes: bpy.data.objects.remove(o)
hol = bpy.data.objects.new('holder', None); sc.collection.objects.link(hol)
(arm or hol).parent = hol if arm else None
for o in meshes:
    nm = o.name.split('.')[0]; me = o.data; vc = me.color_attributes[0].name
    if job == 'weights':
        import colorsys; a = me.color_attributes.new('w', 'FLOAT_COLOR', 'POINT'); vc = 'w'; names = [v.name for v in o.vertex_groups]
        for v in me.vertices:
            c = np.zeros(3)
            for g in v.groups: c += g.weight * np.array(colorsys.hsv_to_rgb((g.group * .381966) % 1, .85, .45 + .5 * ((g.group * .7) % 1)))
            a.data[v.index].color = (*c, 1)
    me.materials.clear(); me.materials.append(mat(vc, nm == 'eyes', .15 if nm == 'frills' else 0))
    if not arm: o.parent = hol
    if nm != 'eyes' and job != 'weights':
        h = o.copy(); h.data = me.copy(); sc.collection.objects.link(h); h.data.materials.clear(); h.data.materials.append(mat(vc, hull=TINT[1]))
        d = h.modifiers.new('d', 'DISPLACE'); d.strength = .022; d.mid_level = 0
        if not arm: meshes_h = h; h.parent = hol
P = K.Glb(src).meshes(); allv = np.vstack([P[p]['POSITION'] for p in P]); cx, cz = .1, 0.0   # the same for v1 and v2: her body centre
def place(x=0, y=0, z=0, pitch=0, sx=1, sy=1, yaw=0):
    """the game group: centred on the model's own cx/cz, metres"""
    hol.scale = (H * sx, H * sx, H * sy); hol.rotation_euler = (pitch, 0, yaw); cy, sn = math.cos(yaw), math.sin(yaw)
    ox, oy = -cx * H, cz * H; hol.location = (x + ox * cy - oy * sn, -z + ox * sn + oy * cy, y)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.use_denoising = False; sc.view_settings.view_transform = 'Standard'; sc.cycles.transparent_max_bounces = 12
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.30, .40, .42, 1)
# ground: 0.25 m stripes, so a sliding foot shows
gm = bpy.data.materials.new('g'); gm.use_nodes = True; n = gm.node_tree; n.nodes.clear(); o = n.nodes.new('ShaderNodeOutputMaterial'); e = n.nodes.new('ShaderNodeEmission'); ck = n.nodes.new('ShaderNodeTexChecker'); tc = n.nodes.new('ShaderNodeNewGeometry')
ck.inputs['Scale'].default_value = 4; ck.inputs[1].default_value = (.10, .17, .09, 1); ck.inputs[2].default_value = (.13, .21, .11, 1); n.links.new(tc.outputs['Position'], ck.inputs[0]); n.links.new(ck.outputs[0], e.inputs[0]); n.links.new(e.outputs[0], o.inputs[0])
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -.0005)); bpy.context.object.data.materials.append(gm); ground = bpy.context.object
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
def look(az, el, dist, tgt, fov=26):
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))); co.location = Vector(tgt) + d * dist; co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.angle = math.radians(fov)
def shot(f): sc.render.filepath = os.path.join(out, f); bpy.ops.render.render(write_still=True)
def act(clip, u):
    a = bpy.data.actions.get(clip) or next(x for x in bpy.data.actions if x.name.startswith(clip)); arm.animation_data_create(); arm.animation_data.action = a
    if hasattr(arm.animation_data, 'action_slot') and a.slots: arm.animation_data.action_slot = a.slots[0]
    for b in arm.pose.bones: b.matrix_basis.identity()
    for t in arm.animation_data.nla_tracks: t.mute = True
    f = a.frame_range[0] + (a.frame_range[1] - a.frame_range[0]) * (u % 1); sc.frame_set(int(f), subframe=f - int(f))
SIDE = getattr(S, 'SIDE_AZ', -math.pi / 2 + .12)
TGT = (0, .16, H * .42)
VIEWS = dict(side=(SIDE, .12), left=(-SIDE, .12), rear=(math.pi, .2), rearq=(2.45, .35), front=(.5, .2), top=(math.pi / 2 + .001, 1.5), below=(2.4, -.75))
if job in ('views', 'weights'):
    sc.render.resolution_x, sc.render.resolution_y = 360, 270
    for c, u in (('idle', .1), ('walk', .0), ('walk', .5), ('run', .25), ('sit', 0)):
        place(); act(c, u)
        for v, (az, el) in VIEWS.items(): ground.hide_render = v == 'below'; look(az, el, 4, TGT, 25); shot(f'{c}{int(u * 100)}_{v}.png')
    os.system('cd ' + out + ' && ffmpeg -v error -y ' + ' '.join(f'-i {c}_{v}.png' for c in ('idle10', 'walk0', 'walk50', 'run25', 'sit0') for v in VIEWS) + ' -filter_complex "xstack=inputs=35:layout=' + '|'.join(f'{360 * (i % 7)}_{270 * (i // 7)}' for i in range(35)) + '" views.png')
else:
    FPS = 24; sc.render.resolution_x, sc.render.resolution_y = 480, 300; sc.cycles.samples = 5; _, info = S.clips(); z = 0; fr = 0
    az, el = (SIDE, math.radians(14)) if job == 'clip:side' else (2.45, math.radians(24))
    for seg, dur in S.REEL:
        ph = 0; spd = info[seg].get('g', {}).get('v', 0)
        for i in range(int(dur * FPS)):
            z += spd / FPS; ph += 1 / FPS / info[seg]['T']; place(0, 0, z); act(seg, ph); look(az, el, 4.1, (0, TGT[1] - z, TGT[2]), 25); shot(f'{fr:04d}.png'); fr += 1
