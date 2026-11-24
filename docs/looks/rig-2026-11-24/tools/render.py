"""blender -b -P render.py -- <name> <outdir> <job>   job = rest | sheet | weights | clip:before | clip:rigged
Renders the RIGGED GLB THROUGH BLENDER'S OWN IMPORTER + armature (so the file is read by a second reader). Colours and the
pale hull follow spirit-model.tsx's recipe (3-step toon, emissive floor, hull at ~1/3 alpha, unlit eyes, glowing frills); the
hull here is a displaced back-face shell, close to the game's 1.06x one."""
import bpy, sys, os, math, importlib, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import rigcore as K
from mathutils import Vector
name, out, job = sys.argv[sys.argv.index('--') + 1:][:3]; S = importlib.import_module('spirits.' + name); H = S.HEIGHT
os.makedirs(out, exist_ok=True); before = job == 'clip:before'
bpy.ops.wm.read_factory_settings(use_empty=True)
src = os.path.join(HERE, '../../../../public/open/spirits', name + '.glb') if before else os.path.join(HERE, '..', name + '-rigged.glb')
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
P = K.Glb(src).meshes(); allv = np.vstack([P[p]['POSITION'] for p in P]); cx, cz = (allv[:, 0].min() + allv[:, 0].max()) / 2, (allv[:, 2].min() + allv[:, 2].max()) / 2
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
if job in ('rest', 'weights'):
    sc.render.resolution_x = sc.render.resolution_y = 420
    if arm:
        arm.animation_data_clear()
        for b in arm.pose.bones: b.matrix_basis.identity()
    place()
    for i, (az, el) in enumerate(((0, .1), (SIDE, .1), (-SIDE, .1), (2.6, .3))): look(az, el, 3, (0, 0, H * .45)); shot(f'{job}{i}.png')
elif job == 'sheet':
    sc.render.resolution_x, sc.render.resolution_y = 300, 260
    for c in ('idle', 'sit', 'walk', 'run'):
        for k in range(6):
            place(); act(c, k / 6); look(SIDE, .12, 3, (0, 0, H * .45), 22); shot(f'{c}_{k}.png')
            if c in ('walk', 'run') and k % 2 == 0:
                look(-SIDE, .12, 3, (0, 0, H * .45), 22); shot(f'{c}_o{k}.png'); look(-.7, .35, 3, (0, 0, H * .45), 22); shot(f'{c}_q{k}.png')
else:
    FPS = 24; sc.render.resolution_x, sc.render.resolution_y = 640, 300; sc.cycles.samples = 5; _, info = S.clips(); t = 0; z = 0; B = S.BEFORE; hop = 0; since = 9; fr = 0
    live = {o: np.array([v.co for v in o.data.vertices]) for o in sc.objects if o.type == 'MESH' and o != ground} if before else {}
    for seg, dur in S.REEL:
        ph = 0; spd = info[seg].get('g', {}).get('v', 0)
        for i in range(int(dur * FPS)):
            dt = 1 / FPS; z += spd * dt; t += dt
            if before:
                a = 0; y = 0; pitch = 0; sy = 1
                if spd:
                    h0 = hop; hop += spd * dt / (B['stride'] * max(1, spd / (B['dash'] * 1.2))); since = 0 if int(hop) != int(h0) else since + dt; a = math.sin(math.pi * (hop % 1)); r = min(1, spd / B['speed']); y = B['hopH'] * a * r ** .5
                    sq = math.exp(-since * B['squashK']); sy = 1 + B['stretch'] * a - B['squash'] * sq; pitch = .05 + .06 * sq
                elif seg == 'sit': sy = B['sitY']; pitch = B['sitPitch']
                sy += 0 if spd else math.sin(t * 2.2) * .015
                w = B['sway']; sw = 1.0 if spd else 0
                for o, V in live.items():      # the tail sway of the live vertex shader, in blender axes
                    al = {'x': V[:, 0], 'z': -V[:, 1]}[w['along']] * w['sign']; tw = np.clip((al - w['from']) / (w['to'] - w['from']), 0, 1); tw = tw * tw * (3 - 2 * tw); d = np.sin(t * (w['hz'] + sw * w['hzRun']) - al * 3) * (w['amp'] + w['ampRun'] * sw) * tw * tw
                    U = V.copy(); U[:, 0 if w['dir'] == 'x' else 1] += d * (1 if w['dir'] == 'x' else -1); o.data.vertices.foreach_set('co', U.ravel()); o.data.update()
                place(0, y, z, pitch, 1 / math.sqrt(max(.5, sy)), sy)
            else: ph += dt / info[seg]['T']; place(0, 0, z); act(seg, ph)
            look(SIDE, math.radians(14), S.CAM_D, (0, -z, H * .42), 26); shot(f'{fr:04d}.png'); fr += 1
