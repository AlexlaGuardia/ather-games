# ── THE KEEPER'S RIGHT GLOVE — real-time hand mesh, replaces the "stick" placeholder ──────────
# Built against the LOCKED look: /root/athernyx/CANON/design-briefs/refs/vessel-glove-t0-1.png
# (flat-lay: cream/tan stitched cloth, seam lines down each finger, a plain dark-brown leather
# strap across the wrist, a folded cuff) and the family law in
# /root/athernyx/CANON/design-briefs/shimmer-casting-vessels.md — NO METAL anywhere, tier-0 has
# ONE dark unlit "seat" (a crude cloudy crystal) on the back of the hand, embedded flush (never a
# bezel/rim — "the vessel closed around it"), craft does not grey (warm tones only).
#
# This is NOT the inventory-icon sprite pipeline (vessel_glove.py / vessel_common.py, which render
# a flat 2D panel icon in camera-unit space). This is a REAL-TIME MESH for the first-person rig in
# `src/app/shimmer/voxel3d/hands.ts`, which mounts its placeholder glove with these conventions
# (read from the file's own local frame, `hands.ts` L178-228): the `arm` group's local +Z points
# toward the ELBOW (camera side), local -Z points toward the FINGERS, local +Y is the back of the
# hand (the seat sits at +y), and the wrist sits at local z≈0 (the cuff is centred there). ★ The
# rig's numbers are already in METRES (P.forearm.l = 0.60 ~ 60cm forearm, P.glove.w = 0.10 ~ 10cm
# palm width) so THIS MESH IS BUILT TO REAL SCALE AND SHOULD DROP IN WITHOUT RESCALING — origin at
# the wrist centre, fingers along -Z, back of hand +Y, thumb on -X (per the task brief).
#
# Run:  RENDER_OUT=/tmp/glove_hand /opt/blender/blender -b -P tools/render/glove_t0_hand.py
# Out:  $RENDER_OUT/glove-t0.glb  (+ $RENDER_OUT/turntable/*.png, 8 frames for the contact sheet)
import bpy, bmesh, math, os
from mathutils import Vector

OUT = os.environ.get("RENDER_OUT", "/tmp/glove_hand")
TT_DIR = os.path.join(OUT, "turntable")
os.makedirs(TT_DIR, exist_ok=True)
RES = int(os.environ.get("RES", "640"))
SAMPLES = int(os.environ.get("SAMPLES", "48"))
DO_RENDER = os.environ.get("NO_RENDER", "0") != "1"

# ── palette (Alex's hex, converted to 0..1) — NO metal, ever: Metallic stays 0.0 on the one material.
CLOTH        = (0x2c / 0x2c, 0, 0)  # placeholder, overwritten below (kept for readability of the diff)
CLOTH        = (0xC9/255, 0xB4/255, 0x8A/255)   # lit cloth
CLOTH_SHADOW = (0xA8/255, 0x90/255, 0x5F/255)   # shadow cloth / cuff fold
SEAM         = tuple(c * 0.72 for c in CLOTH)   # "a shade darker than seams"
STRAP        = (0x5A/255, 0x3A/255, 0x22/255)   # plain dark-brown leather-ish strap, sewn not buckled
SEAT         = (0x4A/255, 0x46/255, 0x38/255)   # crude cloudy crystal, dormant, unlit


# ── geometry constants, METRES, origin = wrist centre ─────────────────────────────────────────
KNUCKLE_Z = -0.075          # palm length: wrist (z=0) to knuckle line
PALM_HALF_W = 0.045         # palm ~9cm wide
PALM_Y_TOP = 0.013          # back-of-hand surface
PALM_Y_BOT = -0.013         # palm surface
FOREARM_LEN = 0.08          # ~8cm stub past the wrist, for the sleeve to overlap
FOREARM_R = 0.027

FINGERS = [  # name, x at knuckle, total length (wrist->tip), base/tip radius, spread lean
    ("index",  -0.033, 0.100, 0.0085, 0.0055, -1.0),
    ("middle", -0.011, 0.116, 0.0090, 0.0058,  0.0),
    ("ring",    0.011, 0.108, 0.0086, 0.0056,  0.6),
    ("pinky",   0.033, 0.082, 0.0075, 0.0050,  1.4),
]
KNUCKLE_Y = 0.006  # fingers root near the dorsal side of the palm block, not its centre
SEG_FRAC = (0.42, 0.32, 0.26)  # proximal / middle / distal, fraction of total finger length

THUMB_X, THUMB_Z, THUMB_Y = -0.032, -0.040, -0.006
THUMB_LEN = 0.074
THUMB_RB, THUMB_RT = 0.0105, 0.0065
THUMB_FRAC = (0.55, 0.45)

# pose tables — see the docstring above `curl_dir` / `thumb_dir` for what these angles mean
POSE = {
    "open": dict(finger_phi=(5, 8, 12), lean_scale=1.0, thumb_psi=(10, 18), thumb_ylift=(-0.05, -0.08)),
    "fist": dict(finger_phi=(78, 160, 220), lean_scale=-1.15, thumb_psi=(80, 168), thumb_ylift=(0.16, 0.44)),
}


def curl_dir(phi_deg, lean_x):
    """Direction a finger segment points, in the (x,y,z) local frame. phi=0 -> straight -Z
    (extended); phi=90 -> straight -Y (curled flat toward the palm); phi=180 -> +Z (curled all
    the way back under, toward the wrist) — a hook, which is what a fist's fingers are."""
    phi = math.radians(phi_deg)
    return Vector((lean_x, -math.sin(phi), -math.cos(phi))).normalized()


def thumb_dir(psi_deg, ylift):
    """psi=0 -> straight -X (thumb out to the side, open); psi=90 -> straight -Z (folded across
    the front of the curled fingers, fist). ylift rides the thumb up over the curled pack in fist."""
    psi = math.radians(psi_deg)
    return Vector((-math.cos(psi), ylift, -math.sin(psi))).normalized()


def chain_points(base, total_len, fracs, dirs):
    pts = [Vector(base)]
    p = Vector(base)
    for frac, d in zip(fracs, dirs):
        p = p + d * (total_len * frac)
        pts.append(p.copy())
    return pts


def set_vcol(obj, rgb):
    mesh = obj.data
    attr = mesh.color_attributes.get("Col")
    if attr is None:
        attr = mesh.color_attributes.new(name="Col", type='FLOAT_COLOR', domain='CORNER')
    for d in attr.data:
        d.color = (rgb[0], rgb[1], rgb[2], 1.0)


def add(prim, **kw):
    prim(**kw)
    return bpy.context.active_object


def tapered_segment(name, base, tip, r_base, r_tip, mat, vcol, bevel_frac=0.55, vertices=8, cap=False):
    base_v, tip_v = Vector(base), Vector(tip)
    d = tip_v - base_v
    length = d.length
    if length < 1e-6:
        return []
    mid = (base_v + tip_v) * 0.5
    cone = add(bpy.ops.mesh.primitive_cone_add, vertices=vertices, radius1=r_base, radius2=r_tip,
               depth=length, location=(mid.x, mid.y, mid.z))
    cone.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bev = cone.modifiers.new("b", 'BEVEL')
    bev.width = max(r_tip * bevel_frac, 0.0015)
    bev.segments = 1
    bev.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier="b")
    bpy.ops.object.shade_smooth()
    assign(cone, mat)
    set_vcol(cone, vcol)
    parts = [cone]
    if cap:
        capobj = add(bpy.ops.mesh.primitive_uv_sphere_add, segments=6, ring_count=4,
                     radius=r_tip * 0.95, location=(tip_v.x, tip_v.y, tip_v.z))
        bpy.ops.object.shade_smooth()
        assign(capobj, mat)
        set_vcol(capobj, vcol)
        parts.append(capobj)
    return parts


def assign(obj, mat):
    if not obj.data.materials:
        obj.data.materials.append(mat)
    else:
        obj.data.materials[0] = mat
    return obj


def flat_solid(name, pts_xz, y_top, thickness, bevel=0.003):
    """A hand-authored (x,z) silhouette at a fixed y_top, solidified toward -Y (into the palm)
    and bevelled round. Auto-corrects winding so the top face normal always faces +Y — no manual
    guessing about vertex order."""
    verts = [(x, y_top, z) for x, z in pts_xz]
    faces = [list(range(len(verts)))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    if mesh.polygons[0].normal.y < 0:
        faces = [list(reversed(faces[0]))]
        mesh.clear_geometry()
        mesh.from_pydata(verts, [], faces)
        mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    sol = obj.modifiers.new("sol", 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = -1
    bpy.ops.object.modifier_apply(modifier="sol")
    bev = obj.modifiers.new("bev", 'BEVEL')
    bev.width = bevel
    bev.segments = 3
    bev.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier="bev")
    bpy.ops.object.shade_smooth()
    return obj


def make_material():
    m = bpy.data.materials.new("glove_t0_cloth")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.82
    b.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.25
    attr = nt.nodes.new('ShaderNodeAttribute')
    attr.attribute_name = "Col"
    attr.attribute_type = 'GEOMETRY'
    nt.links.new(attr.outputs['Color'], b.inputs['Base Color'])
    return m


def build_palm(mat):
    # (x, z) outline, wrist end narrow, knuckle end wide with a thumb-web notch on the -X side
    pts = [
        (-0.024, 0.0), (0.024, 0.0),
        (0.036, -0.028), (0.043, -0.055), (PALM_HALF_W, -0.070),
        (0.040, -KNUCKLE_Z * -1 + 0.003),  # placeholder, replaced below
    ]
    pts = [
        (-0.024, 0.0), (0.024, 0.0),
        (0.036, -0.026), (0.042, -0.050), (PALM_HALF_W, -0.070),
        (0.041, -0.078),
        (-0.041, -0.078),
        (-PALM_HALF_W, -0.070), (-0.040, -0.044),  # wider notch on the thumb side
        (-0.030, -0.020),
    ]
    obj = flat_solid("palm", pts, PALM_Y_TOP, PALM_Y_TOP - PALM_Y_BOT, bevel=0.004)
    assign(obj, mat)
    set_vcol(obj, CLOTH)
    return obj


def build_forearm_stub(mat):
    obj = add(bpy.ops.mesh.primitive_cone_add, vertices=14, radius1=FOREARM_R, radius2=FOREARM_R * 0.96,
              depth=FOREARM_LEN, location=(0, -0.001, FOREARM_LEN / 2))
    obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.shade_smooth()
    assign(obj, mat)
    set_vcol(obj, CLOTH_SHADOW)
    return obj


def build_cuff_and_strap(mat):
    parts = []
    # the folded cuff — a soft roll of cloth just past the wrist, toward the elbow
    cuff = add(bpy.ops.mesh.primitive_torus_add, major_radius=FOREARM_R + 0.006, minor_radius=0.014,
               major_segments=20, minor_segments=10, location=(0, 0, 0.048))
    cuff.scale.z = 0.7
    bpy.ops.object.shade_smooth()
    assign(cuff, mat)
    set_vcol(cuff, CLOTH_SHADOW)
    parts.append(cuff)
    # the plain dark strap across the wrist — sewn/tied, no buckle, no metal
    strap = add(bpy.ops.mesh.primitive_torus_add, major_radius=FOREARM_R + 0.003, minor_radius=0.010,
                major_segments=20, minor_segments=8, location=(0, 0, 0.016))
    strap.scale.z = 0.55
    bpy.ops.object.shade_smooth()
    assign(strap, mat)
    set_vcol(strap, STRAP)
    parts.append(strap)
    return parts


def build_seat(mat):
    """The one dark, dormant seat — flush cabochon, never a rim/bezel (canon: 'the vessel closed
    around it', never a socket)."""
    parts = []
    r = 0.011
    loc = (0.0, PALM_Y_TOP - 0.001, -0.040)
    disc = add(bpy.ops.mesh.primitive_cylinder_add, vertices=20, radius=r, depth=0.006,
               location=loc)
    disc.rotation_euler = (math.radians(90), 0, 0)
    bev = disc.modifiers.new("b", 'BEVEL')
    bev.width = r * 0.3
    bev.segments = 3
    bpy.ops.object.modifier_apply(modifier="b")
    bpy.ops.object.shade_smooth()
    assign(disc, mat)
    set_vcol(disc, SEAT)
    parts.append(disc)
    dome = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=2, radius=r * 0.68,
               location=(loc[0], loc[1] + 0.004, loc[2]))
    dome.scale.y = 0.5
    bpy.ops.object.shade_smooth()
    assign(dome, mat)
    set_vcol(dome, SEAT)
    parts.append(dome)
    return parts


def finger_chain(pose, x, total, rb, rt, lean):
    """Returns (pts[4], radii[4], dirs[3]) for one finger under a given pose — the single source
    both the finger geometry AND its seam ridge are built from, so a seam can never go stiff
    while the finger it rides curls under it (the first cut's bug: the seam was a straight line
    hardcoded for the OPEN pose and stuck out through the fist like a broken bone)."""
    phis = pose["finger_phi"]
    lean_scaled = [lean * pose["lean_scale"] * f for f in (0.3, 0.7, 1.0)]
    dirs = [curl_dir(phis[i], lean_scaled[i]) for i in range(3)]
    base = (x, KNUCKLE_Y, KNUCKLE_Z)
    pts = chain_points(base, total, SEG_FRAC, dirs)
    cum = [0.0]
    for f in SEG_FRAC:
        cum.append(cum[-1] + f)
    radii = [rb + (rt - rb) * c for c in cum]
    return pts, radii, dirs


def thumb_chain(pose):
    psis = pose["thumb_psi"]
    ylifts = pose["thumb_ylift"]
    tdirs = [thumb_dir(psis[0], ylifts[0]), thumb_dir(psis[1], ylifts[1])]
    tbase = (THUMB_X, THUMB_Y, THUMB_Z)
    tpts = chain_points(tbase, THUMB_LEN, THUMB_FRAC, tdirs)
    tcum = [0.0, THUMB_FRAC[0], 1.0]
    tradii = [THUMB_RB + (THUMB_RT - THUMB_RB) * c for c in tcum]
    return tpts, tradii, tdirs


def build_seams(pose_name, mat):
    """Visible relief the way the ref reads it — a raised stitch ridge down each finger, riding
    the SAME curl the finger itself uses, plus one across the palm. A shade darker than the
    cloth. Thin authored strips, not a texture."""
    pose = POSE[pose_name]
    parts = []
    for (name, x, total, rb, rt, lean) in FINGERS:
        pts, radii, dirs = finger_chain(pose, x, total, rb, rt, lean)
        for i in range(3):
            d = dirs[i]
            perp = Vector((0.0, -d.z, d.y))
            if perp.length < 1e-5:
                perp = Vector((0, 0, 1))
            perp.normalize()
            off0 = radii[i] * 0.85 + 0.0015
            off1 = radii[i + 1] * 0.85 + 0.0015
            base = pts[i] + perp * off0
            tip = pts[i + 1] + perp * off1
            parts += tapered_segment(f"seam-{name}-{i}", base, tip, 0.0032, 0.0018, mat, SEAM,
                                      vertices=6, bevel_frac=0.5)
    ridge = add(bpy.ops.mesh.primitive_cylinder_add, vertices=8, radius=0.0035, depth=PALM_HALF_W * 1.7,
                location=(0, PALM_Y_TOP - 0.001, -0.030))
    ridge.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.shade_smooth()
    assign(ridge, mat)
    set_vcol(ridge, SEAM)
    parts.append(ridge)
    return parts


def build_digits(pose_name, mat):
    pose = POSE[pose_name]
    parts = []
    for (name, x, total, rb, rt, lean) in FINGERS:
        pts, radii, dirs = finger_chain(pose, x, total, rb, rt, lean)
        for i in range(3):
            parts += tapered_segment(f"{name}-seg{i}", pts[i], pts[i + 1], radii[i], radii[i + 1],
                                      mat, CLOTH, cap=(i == 2))
    tpts, tradii, tdirs = thumb_chain(pose)
    for i in range(2):
        parts += tapered_segment(f"thumb-seg{i}", tpts[i], tpts[i + 1], tradii[i], tradii[i + 1],
                                  mat, CLOTH, cap=(i == 1))
    return parts


def join_all(parts, name, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = active or parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    return obj


def tri_count(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    n = len(bm.faces)
    bm.free()
    return n


def build_hand(pose_name, mat):
    parts = [build_palm(mat), build_forearm_stub(mat)]
    parts += build_cuff_and_strap(mat)
    parts += build_seat(mat)
    parts += build_seams(pose_name, mat)
    parts += build_digits(pose_name, mat)
    obj = join_all(parts, f"glove_{pose_name}")
    return obj


# ── lighting + camera, for the contact sheet only (not exported) ──────────────────────────────
def configure_render(scene):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    scene.render.film_transparent = False
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.image_settings.file_format = 'PNG'
    # ★ Standard view transform, not Filmic/AgX — those curves lift shadows and desaturate,
    # which is exactly why the first pass read as uniformly pale cream regardless of the
    # material's actual (much darker) vertex colours. A game-asset reference render wants the
    # literal albedo, not a photographic tone curve.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.45, 0.45, 0.45, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    return scene


def add_area(scene, loc, energy, color, size, target=(0, 0, -0.06)):
    ld = bpy.data.lights.new("l", 'AREA')
    ld.energy = energy
    ld.color = color
    ld.size = size
    ob = bpy.data.objects.new("l", ld)
    ob.location = loc
    scene.collection.objects.link(ob)
    c = ob.constraints.new('TRACK_TO')
    tgt = bpy.data.objects.new("t", None)
    tgt.location = target
    scene.collection.objects.link(tgt)
    c.target = tgt
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    return ob


def setup_lights(scene):
    # ★ FIX (first render, self-critique): 40/14/18W area lights at ~0.3-0.5m from an
    # 8x11cm object blew the whole render to white — these energies were copied from the
    # vessel sprite rig, which sits its lights 3+ camera-units away. At hand scale, low
    # single-digit watts is already bright. Cut ~20x and it reads correctly.
    add_area(scene, (0.25, 0.30, 0.15), 1.1, (1.0, 0.93, 0.82), 0.18)   # warm key
    add_area(scene, (-0.30, -0.10, 0.10), 0.4, (0.75, 0.80, 0.95), 0.18)  # cool fill
    add_area(scene, (0.0, -0.05, 0.35), 0.5, (1.0, 0.88, 0.70), 0.12)   # warm rim from above


def cam_at(scene, loc, target=(0, 0, -0.06), ortho=False, scale=0.34):
    cd = bpy.data.cameras.new("cam")
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = scale
    else:
        cd.lens = 45
    cam = bpy.data.objects.new("cam", cd)
    cam.location = loc
    scene.collection.objects.link(cam)
    c = cam.constraints.new('TRACK_TO')
    tgt = bpy.data.objects.new("camtgt", None)
    tgt.location = target
    scene.collection.objects.link(tgt)
    c.target = tgt
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    scene.camera = cam
    return cam


VIEWS = [
    ("back",       (0.0, 0.30, -0.09)),    # dorsal — the seat, the seams
    ("palm",       (0.0, -0.30, -0.06)),   # palmar
    ("thumb-side", (-0.32, 0.05, -0.06)),  # profile from -X, thumb toward camera
    ("3q-behind",  (0.16, 0.20, 0.16)),    # three-quarter, behind + above — how the player sees it
]
_only = os.environ.get("VIEWS_ONLY")
if _only:
    _names = set(_only.split(","))
    VIEWS = [v for v in VIEWS if v[0] in _names]
_poses_only = os.environ.get("POSES_ONLY")


def clear_lights_and_cameras(scene):
    for o in list(scene.collection.objects):
        if o.type in ('LIGHT', 'CAMERA') or (o.type == 'EMPTY' and o.name in ('t', 'camtgt')):
            bpy.data.objects.remove(o, do_unlink=True)


def render_turntable_all(scene, fist, open_):
    pairs = [(fist, "fist"), (open_, "open")]
    if _poses_only:
        keep = set(_poses_only.split(","))
        pairs = [p for p in pairs if p[1] in keep]
    for obj, pose_name in pairs:
        fist.hide_render = (obj is not fist)
        open_.hide_render = (obj is not open_)
        for vname, loc in VIEWS:
            clear_lights_and_cameras(scene)
            setup_lights(scene)
            cam_at(scene, loc, target=(0, 0, -0.05))
            path = os.path.join(TT_DIR, f"glove-{pose_name}-{vname}.png")
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            print(f"RENDERED {path}")
    fist.hide_render = False
    open_.hide_render = False


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    mat = make_material()
    fist = build_hand("fist", mat)
    open_ = build_hand("open", mat)
    fist.name = "glove_fist"; fist.data.name = "glove_fist"
    open_.name = "glove_open"; open_.data.name = "glove_open"

    for o in (fist, open_):
        n = tri_count(o)
        print(f"TRIS {o.name}: {n}")

    if DO_RENDER:
        configure_render(scene)
        render_turntable_all(scene, fist, open_)

    # export both, in their ORIGINAL bind pose, at the world origin, no extra objects
    bpy.ops.object.select_all(action='DESELECT')
    fist.select_set(True)
    open_.select_set(True)
    glb_path = os.path.join(OUT, "glove-t0.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
        export_vertex_color='MATERIAL',
        export_normals=True,
        export_cameras=False,
        export_lights=False,
    )
    print(f"GLB {glb_path}")


if __name__ == "__main__":
    main()
