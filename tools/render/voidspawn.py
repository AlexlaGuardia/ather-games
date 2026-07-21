import bpy, math, os

OUT = os.environ.get("RENDER_OUT", "/tmp/voidspawn_frames")  # override with RENDER_OUT=/path
os.makedirs(OUT, exist_ok=True)
N = 8          # frames in the breathe loop
RES = 128      # native frame size (supersampled — blitted small in-game)

# ── clean slate ──────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# aim target (creature centre) — cam + lights track it
tgt = bpy.data.objects.new("tgt", None); tgt.location = (0, 0, 1.0)
scene.collection.objects.link(tgt)

def track_to(obj):
    c = obj.constraints.new('TRACK_TO'); c.target = tgt
    c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'

# ── the void-spawn body: a lumpy dome, barely cohered ────────────────────────
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1.0, location=(0, 0, 1.0))
body = bpy.context.active_object
body.scale = (1.0, 0.9, 1.02)  # squashed front-to-back, slightly dome
# organic surface — grey that grew wrong (chunkier so the silhouette isn't a clean ball)
tex = bpy.data.textures.new("blob", 'CLOUDS'); tex.noise_scale = 0.42
disp = body.modifiers.new("disp", 'DISPLACE'); disp.texture = tex
disp.strength = 0.24; disp.mid_level = 0.5
body.modifiers.new("sub", 'SUBSURF').render_levels = 2
bpy.ops.object.shade_smooth()

bmat = bpy.data.materials.new("void"); bmat.use_nodes = True
bp = bmat.node_tree.nodes["Principled BSDF"]
bp.inputs["Base Color"].default_value = (0.10, 0.10, 0.13, 1)   # darker cold grey
bp.inputs["Roughness"].default_value = 0.78
body.data.materials.append(bmat)

# ── the void hollow — a recessed pit, not a ball: embedded deep, dead matte ───
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.44, location=(0, -0.72, 1.04))
hollow = bpy.context.active_object; bpy.ops.object.shade_smooth()
hmat = bpy.data.materials.new("hollow"); hmat.use_nodes = True
hp = hmat.node_tree.nodes["Principled BSDF"]
hp.inputs["Base Color"].default_value = (0.004, 0.005, 0.01, 1)  # void-black
hp.inputs["Roughness"].default_value = 1.0                        # no highlight → reads as a hole
hp.inputs["Specular IOR Level"].default_value = 0.0
hollow.data.materials.append(hmat)

# ── two dead glint-eyes staring from the void ────────────────────────────────
glints = []
for gx in (-0.14, 0.14):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.082, location=(gx, -1.18, 1.07))
    g = bpy.context.active_object
    gm = bpy.data.materials.new("glint"); gm.use_nodes = True
    ge = gm.node_tree.nodes["Principled BSDF"]
    ge.inputs["Emission Color"].default_value = (0.62, 0.68, 0.82, 1)
    ge.inputs["Emission Strength"].default_value = 6.5
    g.data.materials.append(gm); glints.append(g)

# ── lighting: cold + moody, a strong GREY_HOT rim to match the game ───────────
def add_area(name, loc, energy, color, size=4.0):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.color = color; ld.size = size
    ob = bpy.data.objects.new(name, ld); ob.location = loc
    scene.collection.objects.link(ob); track_to(ob); return ob
add_area("key",  (3.2, -4.0, 5.0), 620, (0.95, 0.96, 1.0))
add_area("rim",  (-2.6, 3.2, 4.6), 1300, (0.66, 0.74, 0.95))  # strong cold edge
add_area("fill", (0.0, -5.5, 1.0), 80,  (0.5, 0.58, 0.78), size=6.0)

world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.014, 0.022, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32

# ── camera: orthographic, slight 3/4 from front-above (the Clash read) ────────
cam_d = bpy.data.cameras.new("cam"); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 3.05
cam = bpy.data.objects.new("cam", cam_d); cam.location = (0.8, -6.0, 2.5)
scene.collection.objects.link(cam); track_to(cam); scene.camera = cam

# ── render settings ──────────────────────────────────────────────────────────
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
try: scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
scene.render.film_transparent = True
scene.render.resolution_x = RES; scene.render.resolution_y = RES
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

base_z = 1.0
for i in range(N):
    ph = (i / N) * math.tau
    body.location.z = base_z + math.sin(ph) * 0.07          # hover bob
    br = 1.0 + math.cos(ph) * 0.045                          # breathe (volume-ish)
    body.scale = (1.0 * br, 0.92 * br, 1.06 / (br * 0.55 + 0.45))
    for g in glints:
        g.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 5.0 + 2.5 * (0.5 + 0.5 * math.sin(ph))
    scene.render.filepath = os.path.join(OUT, f"f{i}.png")
    bpy.ops.render.render(write_still=True)
    print(f"rendered frame {i+1}/{N}")
print("DONE")
