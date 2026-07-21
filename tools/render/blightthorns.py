import bpy, math, os

OUT = os.environ.get("RENDER_OUT", "/tmp/thorns_frames")
os.makedirs(OUT, exist_ok=True)
RES = 256

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

tgt = bpy.data.objects.new("tgt", None); tgt.location = (0, 0, 1.0)
scene.collection.objects.link(tgt)
def track_to(o):
    c = o.constraints.new('TRACK_TO'); c.target = tgt
    c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'

# ── wood material: dark bark, matte, noise-bumped grain ──────────────────────
wood = bpy.data.materials.new("wood"); wood.use_nodes = True
wt = wood.node_tree; wb = wt.nodes["Principled BSDF"]
wb.inputs["Base Color"].default_value = (0.085, 0.05, 0.028, 1)  # dark bark-brown
wb.inputs["Roughness"].default_value = 0.78
noise = wt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 9.0
bump = wt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
wt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
wt.links.new(bump.outputs['Normal'], wb.inputs['Normal'])

# ── silver glowing tip material ──────────────────────────────────────────────
silver = bpy.data.materials.new("silver"); silver.use_nodes = True
sb = silver.node_tree.nodes["Principled BSDF"]
sb.inputs["Base Color"].default_value = (0.72, 0.75, 0.82, 1)
sb.inputs["Emission Color"].default_value = (0.82, 0.87, 0.98, 1)  # cold silver
sb.inputs["Emission Strength"].default_value = 15.0

# ── the rooted wooden base it grips the failing ground with (small — the thorns are the threat) ──
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.56, location=(0, 0, 0.02))
base = bpy.context.active_object; base.scale = (1.05, 0.92, 0.26)
tx = bpy.data.textures.new("gnarl", 'CLOUDS'); tx.noise_scale = 0.3
d = base.modifiers.new("d", 'DISPLACE'); d.texture = tx; d.strength = 0.2
bpy.ops.object.shade_smooth()
base.data.materials.append(wood)

# ── the blight-thorns: gnarled wooden spikes (thin, tapered, leaning off-true),
#    each with a silver glowing tip. Empty-per-thorn so tip + spike lean together. ──
# three clusters → a row of thorns doesn't read copy-pasted (drawSpike picks one by seed)
VARIANT = int(os.environ.get("VARIANT", "0"))
THORN_SETS = [
    [   # 0 — full 5-thorn crown (the approved look)
        ( 0.00,  0.05,  0.14,   2.20,   -6,  'Y'),
        (-0.30,  0.04,  0.11,   1.66,  -20,  'Y'),
        ( 0.32, -0.02,  0.12,   1.80,   18,  'Y'),
        (-0.16, -0.16,  0.09,   1.18,  -12,  'X'),
        ( 0.19,  0.18,  0.09,   1.06,   12,  'X'),
    ],
    [   # 1 — a leaning 4-thorn cluster
        (-0.10,  0.03,  0.13,   2.00,  -14,  'Y'),
        ( 0.28,  0.00,  0.12,   1.70,   26,  'Y'),
        (-0.34, -0.04,  0.10,   1.40,  -28,  'Y'),
        ( 0.10, -0.18,  0.09,   1.10,   10,  'X'),
    ],
    [   # 2 — a sparse, tall trio
        ( 0.02,  0.02,  0.15,   2.35,    4,  'Y'),
        (-0.26,  0.00,  0.11,   1.55,  -22,  'Y'),
        ( 0.30, -0.04,  0.11,   1.62,   20,  'Y'),
    ],
]
thorns = THORN_SETS[VARIANT]
for (x, y, rad, h, lean, axis) in thorns:
    piv = bpy.data.objects.new(f"piv_{x}", None); piv.location = (x, y, 0)
    scene.collection.objects.link(piv)
    # spike: a fine cone with length geometry (subdivided) so it can gnarl/bend organically
    bpy.ops.mesh.primitive_cone_add(vertices=9, radius1=rad, radius2=0.0, depth=h, location=(x, y, h / 2))
    sp = bpy.context.active_object
    sp.modifiers.new("sub", 'SUBSURF').levels = 1
    gt = bpy.data.textures.new(f"g{x}", 'CLOUDS'); gt.noise_scale = 0.5
    gd = sp.modifiers.new("gnarl", 'DISPLACE'); gd.texture = gt; gd.strength = 0.08  # woody irregularity
    bend = sp.modifiers.new("bend", 'SIMPLE_DEFORM'); bend.deform_method = 'BEND'
    bend.angle = math.radians(24 * (1 if x >= 0 else -1)); bend.deform_axis = 'X'      # a thorn's curve
    bpy.ops.object.shade_smooth()
    sp.data.materials.append(wood)
    sp.parent = piv; sp.matrix_parent_inverse = piv.matrix_world.inverted()
    piv.rotation_euler = (math.radians(lean) if axis == 'X' else 0,
                          math.radians(lean) if axis == 'Y' else 0,
                          math.radians(x * 40))
    # find the ACTUAL deformed apex (after bend+lean) so the glowing bead sits on the real tip, not buried
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = sp.evaluated_get(dg); me = ev.to_mesh(); mw = ev.matrix_world
    apex = max((mw @ v.co for v in me.vertices), key=lambda p: p.z)
    ev.to_mesh_clear()
    # silver glowing tip bead at the real apex
    bpy.ops.mesh.primitive_uv_sphere_add(radius=max(rad, 0.12) * 1.05, location=(apex.x, apex.y, apex.z + 0.04))
    tip = bpy.context.active_object; bpy.ops.object.shade_smooth()
    tip.data.materials.append(silver)

# ── lighting: moody, cold rim so the silver tips + bark read ──────────────────
def area(name, loc, energy, color, size=4.0):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.color = color; ld.size = size
    ob = bpy.data.objects.new(name, ld); ob.location = loc
    scene.collection.objects.link(ob); track_to(ob)
area("key",  (3.0, -3.6, 4.6), 480, (1.0, 0.96, 0.9))     # slightly warm key on the wood
area("rim",  (-2.6, 3.0, 4.4), 1100, (0.66, 0.74, 0.95))  # cold rim
area("fill", (0.0, -5.0, 1.0),  70, (0.55, 0.6, 0.72), size=6.0)

world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.014, 0.022, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35

cam_d = bpy.data.cameras.new("cam"); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 3.3
cam = bpy.data.objects.new("cam", cam_d); cam.location = (0.75, -6.0, 2.35)
scene.collection.objects.link(cam); track_to(cam); scene.camera = cam

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.cycles.samples = 110; scene.cycles.use_denoising = True
try: scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
scene.render.film_transparent = True
scene.render.resolution_x = RES; scene.render.resolution_y = RES
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'

# compositor glare → the tips actually GLOW (fog-glow bloom off the emissive silver)
scene.use_nodes = True; nt = scene.node_tree
rl = next(n for n in nt.nodes if n.type == 'R_LAYERS')
cp = next(n for n in nt.nodes if n.type == 'COMPOSITE')
glare = nt.nodes.new('CompositorNodeGlare'); glare.glare_type = 'FOG_GLOW'
glare.quality = 'HIGH'; glare.threshold = 0.38; glare.size = 8
nt.links.new(rl.outputs['Image'], glare.inputs['Image'])
nt.links.new(glare.outputs['Image'], cp.inputs['Image'])

scene.render.filepath = os.path.join(OUT, f"thorns{VARIANT}.png")
bpy.ops.render.render(write_still=True)
print("DONE")
