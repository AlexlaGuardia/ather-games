# ── THE MARK — coin family render (asset #1 of the /picaso pipeline) ───────────
# Builds ONE struck coin and renders it in three metal+wear passes: copper Mark,
# silver Crown, gold Sovereign. Render-to-sprite: model in 3D, bake to a flat icon
# the game blits as 2D (inventory icon + world pickup). No 3D engine at runtime.
#
# Built against the LOCKED canon brief: /root/athernyx/CANON/design-briefs/coin-family.md
#   • round struck coin, MILLED (reeded) edge — the Mint's anti-shave tell
#   • face = the Citadel Mint's bound Bind-family sigil (a knotted stave in a ring),
#     ringed by a denticle legend band — struck authority, not folk-token
#   • holds its shine, does NOT grey (money is the one bright thing)
#   • wear reads rank: copper Mark half-rubbed (low relief, rough), gold Sovereign crisp
# The exact sigil vector is build-craft (no canonical Bind glyph exists) and BECOMES the
# locked ref on Alex's approval.
#
# Run:  /opt/blender/blender -b -P tools/render/coin.py
# Out:  $RENDER_OUT/coin-{mark,crown,sovereign}.png  (default /tmp/coin_frames)

import bpy, math, os

OUT = os.environ.get("RENDER_OUT", "/tmp/coin_frames")
os.makedirs(OUT, exist_ok=True)
RES = 256

# denom → (base color, roughness, relief scale, wave in the seal). Wear says rank:
# copper is soft/rubbed (low relief, rougher, seal struck a touch off-true), gold is crisp.
DENOMS = {
    "mark":      dict(color=(0.590, 0.290, 0.150), rough=0.36, relief=0.64, skew=0.05),  # copper, worn
    "crown":     dict(color=(0.800, 0.810, 0.835), rough=0.28, relief=0.82, skew=0.02),  # silver, some wear
    "sovereign": dict(color=(0.930, 0.715, 0.285), rough=0.17, relief=1.00, skew=0.00),  # gold, crisp
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

tgt = bpy.data.objects.new("tgt", None); tgt.location = (0, 0, 0.02)
scene.collection.objects.link(tgt)
def track_to(o):
    c = o.constraints.new('TRACK_TO'); c.target = tgt
    c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'

def metal_mat(name, color, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = rough
    return m

FACE_Z = 0.07  # top face of the 0.14-thick coin

def add(prim, **kw):
    prim(**kw); return bpy.context.active_object

def build_coin(denom):
    d = DENOMS[denom]
    mat = metal_mat(denom, d["color"], d["rough"])
    relief = d["relief"]
    parts = []

    # body — high-facet cylinder; the 180 flat side facets ARE the milled edge at sprite scale
    body = add(bpy.ops.mesh.primitive_cylinder_add, vertices=180, radius=1.0, depth=0.14, location=(0, 0, 0))
    for f in body.data.polygons:               # smooth the caps, keep the rim faceted (reeding catches light)
        f.use_smooth = abs(f.normal.z) > 0.5
    bev = body.modifiers.new("bevel", 'BEVEL'); bev.width = 0.012; bev.segments = 2  # kill the razor rim
    parts.append(body)

    # denticle legend band — a ring of small raised beads reads as the Mint's inscription
    for i in range(56):
        a = (i / 56) * math.tau
        bead = add(bpy.ops.mesh.primitive_cube_add, size=1,
                   location=(0.80 * math.cos(a), 0.80 * math.sin(a), FACE_Z + 0.012 * relief))
        bead.scale = (0.028, 0.028, 0.016 * relief); bead.rotation_euler = (0, 0, a)
        parts.append(bead)

    # the Bind sigil — a SEALED GATE. Bind is the gatecraft rune-family (Eyuun's gates); a barred
    # portal ringed by the seal says "the Citadel binds even your coin" in the world's own language.
    # Two posts + lintel + sill frame the gate; a bind-bar across the opening seals it shut.
    skew = d["skew"]  # copper is struck a touch off-true (worn); gold is crisp (skew 0)
    ring = add(bpy.ops.mesh.primitive_torus_add, major_radius=0.40, minor_radius=0.045,
               location=(0, 0, FACE_Z + 0.018 * relief))
    ring.scale = (1, 1, relief); parts.append(ring)
    def bar(lx, ly, sx, sy):
        b = add(bpy.ops.mesh.primitive_cube_add, size=1, location=(lx, ly, FACE_Z + 0.02 * relief))
        b.scale = (sx, sy, 0.05 * relief); b.rotation_euler = (0, 0, skew); parts.append(b)
    bar(-0.17,  0.00, 0.055, 0.44)   # left post
    bar( 0.17,  0.00, 0.055, 0.44)   # right post
    bar( 0.00,  0.20, 0.44,  0.060)  # lintel (top span)
    bar( 0.00, -0.20, 0.44,  0.055)  # threshold / sill (bottom span)
    bar( 0.00,  0.00, 0.30,  0.052)  # bind-bar across the opening — the seal

    for p in parts:
        if not p.data.materials: p.data.materials.append(mat)
        else: p.data.materials[0] = mat
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    return bpy.context.active_object

# ── lighting: warm key pops copper/gold, cold rim catches the reeded edge + relief ──
def area(name, loc, energy, color, size=5.0):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.color = color; ld.size = size
    ob = bpy.data.objects.new(name, ld); ob.location = loc
    scene.collection.objects.link(ob); track_to(ob)
# big SOFT key at low energy → a broad sheen that doesn't clip to white, so the metal shows its
# body hue not its highlight. Warm world does most of the tinting (that's what makes copper copper).
area("key",  (2.6, -3.0, 4.4), 300, (1.0, 0.94, 0.84), size=9.0)
area("rim",  (-2.4, 2.6, 3.6), 520, (0.72, 0.80, 0.98), size=4.0)
area("fill", (0.0, -4.4, 1.2),  70, (0.62, 0.63, 0.7), size=7.0)

# the world IS the metal's color source here — warm + strong so copper/gold read true.
world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.095, 0.072, 0.048, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.15

# ORTHO, tilted off face-on so the FACE reads AND the milled edge/thickness show (icon + pickup)
cam_d = bpy.data.cameras.new("cam"); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 2.5
cam = bpy.data.objects.new("cam", cam_d); cam.location = (0.55, -1.5, 3.15)
scene.collection.objects.link(cam); track_to(cam); scene.camera = cam

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.cycles.samples = 140; scene.cycles.use_denoising = True
try: scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
scene.render.film_transparent = True
scene.render.resolution_x = RES; scene.render.resolution_y = RES
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'

# a soft glint bloom so struck metal reads "minted / valuable"
scene.use_nodes = True; nt = scene.node_tree
rl = next(n for n in nt.nodes if n.type == 'R_LAYERS')
cp = next(n for n in nt.nodes if n.type == 'COMPOSITE')
glare = nt.nodes.new('CompositorNodeGlare'); glare.glare_type = 'FOG_GLOW'
glare.quality = 'HIGH'; glare.threshold = 0.6; glare.size = 6
nt.links.new(rl.outputs['Image'], glare.inputs['Image'])
nt.links.new(glare.outputs['Image'], cp.inputs['Image'])

for denom in DENOMS:
    coin = build_coin(denom)
    scene.render.filepath = os.path.join(OUT, f"coin-{denom}.png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(coin, do_unlink=True)
    print(f"DONE {denom}")
