# ── SHARED RIG — casting-vessel renders (glove + bracelet), /picaso pipeline ──────────────
# Runs INSIDE Blender. Shared materials, lighting, camera and seat-closure helpers for
# vessel_glove.py and vessel_bracelet.py so both objects render in one consistent light
# and the seat treatment (the brief's hardest law) is written ONCE, not twice.
#
# Built against: /root/athernyx/CANON/design-briefs/shimmer-casting-vessels.md (RULED 2026-09-03,
# amended 09-04/09-05) and its sibling shimmer-gathering-focuses.md.
#
# ★ WHY PROCEDURAL BPY, NOT MESHY: the existing concept sheet (refs/CASTING-VESSELS-concept-sheet.png)
# is exactly what happens when a generator is trusted with this brief — its own footer admits the
# empty seats "survived on the tier-1 bracelet ONLY" and that bracelet's seats "carry a raised lip
# that edges toward a rim". A socket-rim is the one thing this brief bars by name (it reads as a
# manabox). Hand-authored geometry is the only way to GUARANTEE no rim exists, so every seat here is
# built explicitly: a flush dark void, never a ring drawn around one.
import bpy, math, os

RES_X = int(os.environ.get("RES_X", "512"))
RES_Y = int(os.environ.get("RES_Y", "512"))  # square canvas; the panel's 92x82 box is near-square
# (1.12:1) and will letterbox/contain-fit a square sprite cleanly rather than fighting a forced crop

VOID = (0.012, 0.010, 0.014)  # an empty seat: dark, near-black — never a lit hole, never rimmed


def fresh_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 160
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    scene.render.film_transparent = True
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    return scene


def track_target(scene, loc=(0, 0, 0)):
    tgt = bpy.data.objects.new("tgt", None)
    tgt.location = loc
    scene.collection.objects.link(tgt)
    return tgt


def track_to(o, tgt):
    c = o.constraints.new('TRACK_TO')
    c.target = tgt
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'


def area(scene, tgt, name, loc, energy, color, size=5.0):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.color = color
    ld.size = size
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    scene.collection.objects.link(ob)
    track_to(ob, tgt)
    return ob


def setup_light_and_cam(scene, ortho_scale=2.6, cam_loc=(0.35, -0.85, 3.35)):
    """A soft, warm, honest-craft studio rig — NOT the coin's metal-popping rig. No hard
    speculars; the family is cloth, wood, crystal, shell — it should look touchable, matte,
    lived-in, never chromed. Top-down-ish ortho so the flat icon reads like the concept
    sheet's product photography (object laid flat, camera above and a little in front)."""
    tgt = track_target(scene, (0, 0, 0.05))
    area(scene, tgt, "key", (1.6, -2.0, 3.2), 140, (1.0, 0.95, 0.86), size=6.0)
    area(scene, tgt, "fill", (-2.0, -1.0, 2.2), 55, (0.72, 0.78, 0.92), size=6.0)
    area(scene, tgt, "rim", (0.0, 2.4, 1.6), 90, (0.95, 0.85, 0.65), size=4.0)

    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.06, 0.055, 0.05, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55

    cam_d = bpy.data.cameras.new("cam")
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = ortho_scale
    cam = bpy.data.objects.new("cam", cam_d)
    cam.location = cam_loc
    scene.collection.objects.link(cam)
    track_to(cam, tgt)
    scene.camera = cam
    return cam


# ── materials — NO metal anywhere. Metallic stays 0.0 on every one of these, always. ──────────
def _mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes["Principled BSDF"]


def mat_cloth(name, color, rough=0.82):
    m, b = _mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Specular IOR Level"].default_value = 0.25
    return m


def mat_wood(name, color, rough=0.55, grain_scale=14.0, grain_strength=0.14):
    m, b = _mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Specular IOR Level"].default_value = 0.3
    nt = m.node_tree
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = grain_scale
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1.0, 6.0, 1.0)  # stretch noise into grain lines
    coord = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(coord.outputs['Object'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = grain_strength
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def mat_cord(name, color=(0.42, 0.33, 0.22), rough=0.75):
    m, b = _mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    return m


def mat_silverthread(name, rough=0.62):
    """Moonvine fibre, RULED not-metal — a pale cool cord, matte, never chromed. The canon
    trap here is literal: 'silver' cues a metal shader by reflex. Metallic stays 0.0 and
    roughness stays high on purpose; the coolness comes from base-color hue, not from specular."""
    m, b = _mat(name)
    b.inputs["Base Color"].default_value = (0.80, 0.82, 0.84, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Specular IOR Level"].default_value = 0.35
    return m


def mat_crystal_cloudy(name):
    """Tier-0 crude manalic crystal — the mortal world's conduit tech. Sealed, unattuned,
    NO glow (dormant + it was never a glowing tier to begin with)."""
    m, b = _mat(name)
    b.inputs["Base Color"].default_value = (0.80, 0.81, 0.83, 1)
    b.inputs["Roughness"].default_value = 0.38
    b.inputs["Metallic"].default_value = 0.0
    if "Transmission Weight" in b.inputs:
        b.inputs["Transmission Weight"].default_value = 0.35
    return m


def mat_sap(name, color=(0.62, 0.34, 0.05)):
    """Amber sap-seal — glassy, glossy, low roughness, some transmission so it reads as a
    pooled and hardened glaze, not a painted disc."""
    m, b = _mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = 0.12
    b.inputs["Metallic"].default_value = 0.0
    if "Transmission Weight" in b.inputs:
        b.inputs["Transmission Weight"].default_value = 0.55
    return m


def mat_nacre(name):
    """Pearlshell — a fresnel-driven iridescent tint (pale pink/blue/white). Cycles has no
    one-node iridescence BSDF at this pipeline's Blender version, so this fakes it with a
    layer-weight-driven color ramp feeding emission-free Base Color — cheap, and correct at
    icon scale (a shell's iridescence is a tint that shifts with angle, not a hard highlight)."""
    m, b = _mat(name)
    b.inputs["Base Color"].default_value = (0.90, 0.88, 0.90, 1)
    b.inputs["Roughness"].default_value = 0.28
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Specular IOR Level"].default_value = 0.5
    nt = m.node_tree
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.35
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.85, 0.78, 0.92, 1)  # lilac at grazing
    ramp.color_ramp.elements[1].color = (0.78, 0.92, 0.95, 1)  # pale teal face-on
    nt.links.new(lw.outputs['Facing'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    return m


def mat_void():
    m, b = _mat("void")
    b.inputs["Base Color"].default_value = (*VOID, 1)
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Specular IOR Level"].default_value = 0.05  # dead-flat — a rim would catch light, this must not
    return m


def mat_shimmerscale(name):
    """Shimmerscale wrap — small overlapping golden scales, faked at icon scale with a
    fresnel-tilted warm-gold sheen rather than individually modeled scales (sub-pixel at the
    92x82 panel size the sprite serves; see the build note in vessel_bracelet.py)."""
    m, b = _mat(name)
    b.inputs["Base Color"].default_value = (0.78, 0.55, 0.14, 1)
    b.inputs["Roughness"].default_value = 0.30
    b.inputs["Metallic"].default_value = 0.0
    nt = m.node_tree
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.5
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.55, 0.36, 0.06, 1)
    ramp.color_ramp.elements[1].color = (0.92, 0.75, 0.30, 1)
    nt.links.new(lw.outputs['Facing'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    return m


def assign(obj, mat):
    if not obj.data.materials:
        obj.data.materials.append(mat)
    else:
        obj.data.materials[0] = mat
    return obj


def add(prim, **kw):
    prim(**kw)
    return bpy.context.active_object


def outline_solid(name, pts, z_top, thickness=0.09, bevel=0.022):
    """A flat hand-authored silhouette (list of (x,y) points, one closed loop) given real
    thickness and a rounded edge — the coin's 'body' trick, generalized. This is what stands
    in for boolean/notch modeling: author the SHAPE exactly, extrude it, round it. No autogen
    step touches this geometry, so nothing can sneak in a rim or a socket that wasn't drawn."""
    verts = [(x, y, z_top) for x, y in pts]
    faces = [list(range(len(verts)))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    sol = obj.modifiers.new("sol", 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = -1  # keep the authored face as the TOP, extrude downward
    bpy.ops.object.modifier_apply(modifier="sol")
    bev = obj.modifiers.new("bev", 'BEVEL')
    bev.width = bevel
    bev.segments = 3
    bev.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier="bev")
    bpy.ops.object.shade_smooth()
    return obj


def join_all(parts, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = active or parts[0]
    bpy.ops.object.join()
    return bpy.context.active_object


# ── the seat itself — built ONCE, reused by both objects, so the no-rim law can't drift ──────
def build_seat(x, y, z, r, tier, filled_tier0=False, closure_mat=None):
    """Returns the list of objects making up one seat. NEVER produces a raised ring/bezel:
    the void disc sits FLUSH (slightly recessed in Z, never proud of the surface), and any
    closure geometry on top (a cord cross, a sap dome, a nacre dome) matches the void disc's
    own footprint radius so no contrasting rim shows at the seam.
      tier 0 → filled: a cloudy crystal cabochon (Greg's pair is described WITH its crystal)
      tier 1 → empty: dark void + two crossing cord strands ("woven in")
      tier 2 → empty: dark void under a glassy amber sap dome ("sap-sealed")
      tier 3 → empty: dark void under a pearlescent nacre dome ("nacre-clasped")
    """
    parts = []
    void = add(bpy.ops.mesh.primitive_cylinder_add, vertices=28, radius=r, depth=0.014,
               location=(x, y, z - 0.007))
    assign(void, mat_void())
    parts.append(void)

    if tier == 0 and filled_tier0:
        gem = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=2, radius=r * 0.88,
                   location=(x, y, z + r * 0.32))
        gem.scale = (1.0, 1.0, 0.55)
        assign(gem, mat_crystal_cloudy("seat-crystal"))
        bpy.ops.object.shade_smooth()
        parts.append(gem)
        return parts

    if tier == 1:
        for ang in (35, -35):
            c = add(bpy.ops.mesh.primitive_cylinder_add, vertices=8, radius=r * 0.05,
                     depth=r * 2.3, location=(x, y, z + 0.006))
            c.rotation_euler = (math.radians(90), 0, math.radians(ang))
            assign(c, closure_mat)
            parts.append(c)
        return parts

    # tier 2 / tier 3 — a shallow dome, SAME footprint radius as the void beneath it
    dome = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=2, radius=r,
               location=(x, y, z))
    dome.scale = (1.0, 1.0, 0.42)
    assign(dome, closure_mat)
    bpy.ops.object.shade_smooth()
    parts.append(dome)
    return parts
