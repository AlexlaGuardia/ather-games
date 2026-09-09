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
    # ★ TUNABLE SO THE FIRST LOOK IS CHEAP (2026-09-09). 160 samples x 512px x 10 frames per object
    # is ~25 min an object on this CPU, and Cycles writes a PNG only when a FRAME completes — so
    # every run that got cut off mid-frame left no file and no error, which reads exactly like a
    # crash. Three runs died that way before anyone looked at the sample count.
    # ⚠ The default is unchanged at 160: this makes the cost visible, it does not lower the bar.
    # Judge the SILHOUETTE and the seat read at SAMPLES=32 (denoised, ~30s a frame), then render
    # the approved shape at the default before anything ships.
    scene.cycles.samples = int(os.environ.get("SAMPLES", "160"))
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
    """★ FIX 2026-09-09 (picaso, self-critique pass): a single flat Base Color + a bump-only
    grain is exactly what reads as tinted plastic — the ALBEDO never varies, only the normal
    does, so under this soft area-light rig it just looks like smooth beige resin. Real wood's
    color itself streaks. Fix: the same noise field now ALSO drives a colour ramp mixed into
    Base Color (dark heartwood streaks through the base hue) and a small Roughness jitter
    (wood's sheen is uneven, a plastic's is uniform) — the bump stays, doing normal work only."""
    m, b = _mat(name)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Specular IOR Level"].default_value = 0.3
    nt = m.node_tree
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1.0, 6.0, 1.0)  # stretch noise into grain lines
    nt.links.new(coord.outputs['Object'], mapping.inputs['Vector'])

    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = grain_scale
    noise.inputs['Detail'].default_value = 3.0
    nt.links.new(mapping.outputs['Vector'], noise.inputs['Vector'])

    # albedo streaking — dark heartwood value mixed in by the SAME field driving the bump, so
    # the shaded grain and the coloured grain register as one streak, not two textures
    dark = tuple(c * 0.52 for c in color)
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.38
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (*color, 1)
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])

    # roughness jitter — an uneven, hand-finished sheen instead of a uniform plastic gloss
    rmath = nt.nodes.new('ShaderNodeMath')
    rmath.operation = 'MULTIPLY_ADD'
    rmath.inputs[1].default_value = 0.10
    rmath.inputs[2].default_value = rough - 0.05
    nt.links.new(noise.outputs['Fac'], rmath.inputs[0])
    nt.links.new(rmath.outputs['Value'], b.inputs['Roughness'])

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
#
# ★ FIX 2026-09-09 (picaso, self-critique pass): the first cut domed the closure geometry
# (an ico_sphere) OVER a flat void disc of the SAME radius. That looks safe on paper — "same
# footprint" — but a sphere's silhouette only reaches its full radius at its equator; anywhere
# below that its cross-section is narrower than r, so the flat void disc's edge peeked out past
# the dome's base as a thin dark ring. Rendered proof: bracelet-t0-s1's crystal seat showed
# exactly that — a visible dark outline around the gem, i.e. a bezel by accident, the one thing
# this brief bars by name. FIX: the closure is now a FLAT DISC at the void's own radius (so the
# footprints are identical, not merely equal-looking), with a smaller, strictly-inset dome on
# top purely for glassy dimension — inset enough that it can never reach the disc's own edge.
def build_seat(x, y, z, r, tier, filled_tier0=False, closure_mat=None):
    """Returns the list of objects making up one seat. NEVER produces a raised ring/bezel:
    the void disc sits FLUSH (slightly recessed in Z, never proud of the surface), and any
    closure geometry sits on a disc of the EXACT SAME radius as the void — never merely a
    same-radius dome, whose curved footprint can undershoot and let the void peek out as a rim.
      tier 0 → filled: a cloudy crystal cabochon (Greg's pair is described WITH its crystal)
      tier 1 → empty: dark void + two crossing cord strands ("woven in")
      tier 2 → empty: dark void under a glassy amber sap seal ("sap-sealed")
      tier 3 → empty: dark void under a pearlescent nacre clasp ("nacre-clasped")
    """
    parts = []
    void = add(bpy.ops.mesh.primitive_cylinder_add, vertices=28, radius=r, depth=0.014,
               location=(x, y, z - 0.007))
    assign(void, mat_void())
    parts.append(void)

    if tier == 1:
        for ang in (35, -35):
            c = add(bpy.ops.mesh.primitive_cylinder_add, vertices=8, radius=r * 0.05,
                     depth=r * 2.3, location=(x, y, z + 0.006))
            c.rotation_euler = (math.radians(90), 0, math.radians(ang))
            assign(c, closure_mat)
            parts.append(c)
        return parts

    if tier == 0 and not filled_tier0:
        return parts  # an unwritten tier-0 seat is just the void — Greg's pair arrives uncut

    # tier 0 (filled) / tier 2 / tier 3 — a flush disc at the VOID'S OWN RADIUS (guarantees no
    # peeking edge), with a smaller inset dome on top for glassy roundness only.
    mat = mat_crystal_cloudy("seat-crystal") if (tier == 0 and filled_tier0) else closure_mat
    disc = add(bpy.ops.mesh.primitive_cylinder_add, vertices=28, radius=r * 0.995, depth=0.02,
               location=(x, y, z + 0.003))
    bev = disc.modifiers.new("b", 'BEVEL')
    bev.width = r * 0.18
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier="b")
    assign(disc, mat)
    bpy.ops.object.shade_smooth()
    parts.append(disc)

    bump = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=2, radius=r * 0.62,
               location=(x, y, z + 0.02))
    bump.scale = (1.0, 1.0, 0.45)
    assign(bump, mat)
    bpy.ops.object.shade_smooth()
    parts.append(bump)
    return parts


# ── the braid — real interleaved-strand geometry, so a seat can be a void IN the weave ────────
#
# ★ FIX 2026-09-09 (picaso, self-critique pass): the first cut of the bracelet was one smooth
# torus with build_seat's void/closure disc glued on top of it. That is not "a void in the
# weave" — the ring underneath is unbroken, so an empty seat reads as a bandage patch stuck on
# a continuous hoop, and a filled seat reads as a bead sitting ON a rail, the exact barred-manabox
# read this whole family exists to avoid. Fix: the ring body is now built as one or two actual
# tube strands, swept as Blender curves (bevel_depth = strand radius) around the ring, each
# strand's RADIUS modulated by a sine so two strands visibly interleave (cross over each other's
# radial path — the read a top-down ortho camera can actually see, since it can't read a z-only
# weave from nearly overhead), and each strand's path is literally SPLIT into arcs that stop
# short of every seat angle and resume after it. The seat sits in the resulting gap — an actual
# absence in the geometry, not a disc laid over continuous material.
def _tube_from_points(name, points, radius, mat, bevel_res=3, resolution_u=3):
    if len(points) < 2:
        return None
    cd = bpy.data.curves.new(name, type='CURVE')
    cd.dimensions = '3D'
    cd.resolution_u = resolution_u
    spline = cd.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for i, (x, y, z) in enumerate(points):
        spline.points[i].co = (x, y, z, 1)
    cd.bevel_depth = radius
    cd.bevel_resolution = bevel_res
    cd.fill_mode = 'FULL'
    obj = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    assign(obj, mat)
    bpy.ops.object.shade_smooth()
    return obj


def build_woven_ring(major_r, strand_r, seat_angles_deg, mat, n_strands=2, seat_gap_deg=None,
                      n_periods=12, amp_ratio=1.8, scale_z=0.34, min_run_deg=18, name_prefix="ring",
                      seat_r=None):
    """A ring of `n_strands` (1 = a plain single cord, 2 = two strands that visibly interleave)
    built as real tube geometry, broken into arcs so each angle in `seat_angles_deg` interrupts
    every strand. Returns the list of tube mesh objects (join them with the rest of the part).

    ★ FIX 2026-09-09 (picaso, self-critique pass, round 2): the first cut sized the gap to each
    seat independently, so two CLOSE seats (a 2- or 3-seat bracelet) left a short, isolated
    sliver of braid stranded between them — a floating twig with no seat under it. Widening the
    gap to force adjacent seats to merge overcorrected: it pushed every seat far enough from the
    braid's cut end that the seat read as floating in open space instead of nested IN the weave.
    Right fix is `min_run_deg`: keep the gap SNUG (close to the seat's own footprint) and instead
    drop any leftover run too short to read as a real strand of braid, which merges only the
    slivers a close seat-pair produces, without pushing well-spaced seats away from the ring.

    ★★ FIX 2026-09-09 (play lane) — THE GAP WAS NEVER ACTUALLY SNUG, AND THE COMMENT ABOVE SAID IT
    WAS. `seat_gap_deg` was a hardcoded 27, while a SEAT_R=0.086 seat on an R=0.82 ring spans 12
    degrees. So the braid was cut 2.2x wider than the thing filling it and **55% of every gap was
    bare background**. On a dark ground that is fatal in a way a light one would forgive: the void
    is near-black, the background is near-black, and with no material touching the void's edge
    there is no boundary to see. The seat stops reading as nested in the weave and starts reading
    as a detached blob near a broken ring — which is exactly how it renders, and exactly the same
    failure the SVG placeholder had for the same reason.
    ⚠ THE PROSE WAS RIGHT AND THE NUMBER WAS WRONG, which is the hard kind to catch: the docstring
    asserts snugness, so reading the code agrees with itself and only ARITHMETIC disagrees.
    So the gap is no longer a number that can drift from the seat — pass `seat_r` and it is DERIVED
    from the footprint, plus a fraction of a strand so the braid end kisses the void without
    overlapping it. `seat_gap_deg` stays as an explicit override for a caller that means it."""
    if seat_gap_deg is None:
        if seat_r is None:
            raise ValueError("build_woven_ring needs seat_r (to derive the gap) or an explicit "
                             "seat_gap_deg — a default gap is what drifted from the seat size")
        seat_gap_deg = math.degrees(2.0 * (seat_r + strand_r * 0.30) / major_r)
    step = 1.5
    forb = [((a - seat_gap_deg / 2) % 360, (a + seat_gap_deg / 2) % 360) for a in seat_angles_deg]

    def forbidden(ang):
        for lo, hi in forb:
            if lo <= hi:
                if lo <= ang <= hi:
                    return True
            elif ang >= lo or ang <= hi:
                return True
        return False

    n = int(360 / step)
    angles = [i * step for i in range(n)]
    runs, cur = [], []
    for ang in angles:
        if forbidden(ang):
            if len(cur) > 1:
                runs.append(cur)
            cur = []
        else:
            cur.append(ang)
    if len(cur) > 1:
        runs.append(cur)
    if len(runs) > 1 and not forbidden(0.0) and not forbidden(angles[-1]):
        runs[0] = runs[-1] + runs[0]
        runs.pop()
    # ★ FIX: span by ENDPOINT SUBTRACTION breaks on the wraparound-merged run (its last angle is
    # numerically SMALLER than its first, e.g. 304.5 -> 235.5 after wrapping through 0), which
    # made the filter read the majority of the ring as a negative-length "sliver" and drop it.
    # Span by point COUNT instead — correct for a wrapped run and for a normal one alike.
    runs = [r for r in runs if len(r) * step >= min_run_deg or len(runs) == 1]
    # ★ FIX 2026-09-09: an UNCUT ring (no seats, `SEAT_ANGLES[0]`) is ONE run from 0 to 358.5 and the
    # tube stopped a step short of where it began — a 1.5° nick at the seam, which on a braid reads
    # as a BREAK (seen on the first t1-s0 render). A run nothing interrupts is closed by coming back
    # to its first angle a full turn later; the weave phase is continuous there because n_periods
    # is an integer, so the strand meets itself.
    if len(runs) == 1 and not forb:
        runs[0] = runs[0] + [runs[0][0] + 360.0]

    parts = []
    signs = [1] if n_strands == 1 else [1, -1]
    amp = strand_r * amp_ratio if n_strands > 1 else 0.0
    for s_idx, sign in enumerate(signs):
        for r_idx, run in enumerate(runs):
            pts = []
            for ang in run:
                rad = math.radians(ang)
                wob = math.sin(math.radians(ang) * n_periods)
                r = major_r + sign * amp * wob
                z = sign * strand_r * 0.9 * wob * scale_z
                pts.append((r * math.cos(rad), r * math.sin(rad), z))
            obj = _tube_from_points(f"{name_prefix}-s{s_idx}-r{r_idx}", pts, strand_r, mat)
            if obj:
                parts.append(obj)
    return parts


# ── a solid tapered digit — the fix for "fingers render as open rings" ────────────────────────
#
# ★ FIX 2026-09-09 (picaso, self-critique pass): the first cut built each finger/thumb as a
# torus lying almost flat under a near-top-down ortho camera — which is exactly what a torus
# looks like from that angle: a closed ring, hole facing the lens, read instantly as a curtain
# ring rather than a digit. A finger reads as a finger from a TAPER and a rounded tip, not from
# a hole through it (the brief's own SVG placeholder settled this the same way, in 2D — solid
# shapes, real gaps, a taper). Base and tip are hand-authored world points (mathutils tracks the
# cone between them), never derived, so nothing autogenerated can sneak a ring back in.
import mathutils


def tapered_digit(name, base, tip, r_base, r_tip, mat, bevel_frac=0.8, tip_cap=True):
    """A solid finger/thumb: a tapered cone from `base` to `tip` (both (x,y,z) world points),
    bevelled round at both ends, with a small rounded cap sphere fused at the tip so the end
    reads as a soft fingertip rather than a flat-cut cone face."""
    base_v = mathutils.Vector(base)
    tip_v = mathutils.Vector(tip)
    direction = tip_v - base_v
    length = direction.length
    mid = (base_v + tip_v) * 0.5
    cone = add(bpy.ops.mesh.primitive_cone_add, vertices=12, radius1=r_base, radius2=r_tip,
               depth=length, location=(mid.x, mid.y, mid.z))
    cone.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    bpy.context.view_layer.objects.active = cone
    bev = cone.modifiers.new("b", 'BEVEL')
    bev.width = r_tip * bevel_frac
    bev.segments = 3
    bev.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier="b")
    bpy.ops.object.shade_smooth()
    assign(cone, mat)
    parts = [cone]
    if tip_cap:
        cap = add(bpy.ops.mesh.primitive_uv_sphere_add, segments=10, ring_count=6,
                   radius=r_tip * 0.92, location=(tip_v.x, tip_v.y, tip_v.z))
        bpy.ops.object.shade_smooth()
        assign(cap, mat)
        parts.append(cap)
    return parts
