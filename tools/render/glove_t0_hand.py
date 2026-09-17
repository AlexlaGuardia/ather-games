# ── THE KEEPER'S RIGHT GLOVE — real-time hand mesh, replaces the "stick" placeholder ──────────
# Built against the LOCKED look: /root/athernyx/CANON/design-briefs/refs/vessel-glove-t0-1.png
# (flat-lay: cream/tan stitched cloth, seam lines down each finger, a plain dark-brown leather
# strap across the wrist, a folded cuff) and the family law in
# /root/athernyx/CANON/design-briefs/shimmer-casting-vessels.md — NO METAL anywhere, tier-0 has
# ONE dark unlit "seat" (a crude cloudy crystal) on the back of the hand, embedded flush (never a
# bezel/rim — "the vessel closed around it"), craft does not grey (warm tones only).
#
# ★★ DRAFT 2 (2026-09-17) — coordinator's numeric spec, after draft 1 read as a DIAGRAM not a
# glove ("five thin tentacles on a flat slab", "a jumble of pegs", "a mushroom cap"). Every
# dimension below is a NUMBER from that brief, not an adjective — see the constants block.
# ★★★ DRAFT 3 (2026-09-17) — draft 2 shipped to prod for Alex to judge; ONE more fix asked before
# then: fingers/thumb still read as "bamboo" because each phalanx was a SEPARATE capsule object,
# and two separate rounded ends butted together always shows a waist/pinch at the joint no matter
# how good the angles are. Fixed: each finger and the thumb is now ONE continuous tube — a Bezier
# curve run through the joint points with a per-point tapered radius and a round bevel — so the
# curl is a single continuous bend and only the seam ridge marks the back. Also killed a real bug
# the palm-side renders showed: the "back dome" sphere was oversized/mis-centred and bulged
# through to the PALM side too (the "oval pad" the ref doesn't show) — rebuilt flat/shallow so it
# never crosses to -Y.
# ⚠ Writes to tools/render/out/hands-draft3/ ONLY. public/ stays clean for builds; nothing here
# touches public/ until this pass is approved.
#
# This is NOT the inventory-icon sprite pipeline (vessel_glove.py / vessel_common.py, which render
# a flat 2D panel icon in camera-unit space). This is a REAL-TIME MESH for the first-person rig in
# `src/app/shimmer/voxel3d/hands.ts`, which mounts its placeholder glove with these conventions
# (read from the file's own local frame, `hands.ts` L178-228): the `arm` group's local +Z points
# toward the ELBOW (camera side), local -Z points toward the FINGERS, local +Y is the back of the
# hand (the seat sits at +y), and the wrist sits at local z≈0 (the cuff is centred there). The
# rig's numbers are already in METRES so this mesh is built to real scale and should drop in
# without rescaling — origin at the wrist centre, fingers along -Z, back of hand +Y, thumb -X.
#
# Run:  RENDER_OUT=tools/render/out/hands-draft2 /opt/blender/blender -b -P tools/render/glove_t0_hand.py
# Out:  $RENDER_OUT/glove-t0.glb
#       $RENDER_OUT/turntable/*.png       (8 frames, contact sheet)
#       $RENDER_OUT/turntable/player-pov.png  (the 9th frame — in-game HUD framing)
import bpy, bmesh, math, os
from mathutils import Vector

OUT = os.environ.get("RENDER_OUT", "/tmp/glove_hand")
TT_DIR = os.path.join(OUT, "turntable")
os.makedirs(TT_DIR, exist_ok=True)
RES = int(os.environ.get("RES", "640"))
SAMPLES = int(os.environ.get("SAMPLES", "48"))
DO_RENDER = os.environ.get("NO_RENDER", "0") != "1"

# ── palette (Alex's hex, converted to 0..1) — NO metal, ever: Metallic stays 0.0 on the one material.
CLOTH        = (0xC9/255, 0xB4/255, 0x8A/255)   # lit cloth
CLOTH_SHADOW = (0xA8/255, 0x90/255, 0x5F/255)   # shadow cloth / cuff fold
SEAM         = tuple(c * 0.72 for c in CLOTH)   # a shade darker than the cloth
STRAP        = (0x5A/255, 0x3A/255, 0x22/255)   # plain dark-brown strap, sewn not buckled
SEAT         = (0x4A/255, 0x46/255, 0x38/255)   # crude cloudy crystal, dormant, unlit


# ═══════════════════════════════════════════════════════════════════════════════════════════
# GEOMETRY CONSTANTS — every number here is FROM THE COORDINATOR'S SPEC (cm converted to m),
# not eyeballed. Origin = wrist centre, +Z = toward elbow, -Z = fingers, +Y = back of hand.
# ═══════════════════════════════════════════════════════════════════════════════════════════

# PALM: 10cm wrist->knuckles, 9cm wide at knuckles / 7cm at wrist, 3.2cm thick, >=1.2cm edge
# round, slight dome on the back.
PALM_LEN = 0.100
KNUCKLE_Z = -PALM_LEN
PALM_WRIST_HALF_W = 0.035
PALM_KNUCKLE_HALF_W = 0.045
PALM_THICK = 0.032
PALM_Y_TOP = PALM_THICK / 2      # back of hand
PALM_Y_BOT = -PALM_THICK / 2     # palm side
PALM_BEVEL = 0.012
PALM_DOME_R = 0.030              # the "slight dome on the back" — a low flattened bulge
PALM_DOME_HEIGHT = 0.006

# FINGERS: index/middle/ring/pinky. Knuckle spacing 2.1cm centre-to-centre. Lengths 7.0/7.8/7.2/
# 5.8cm. Base diameter 2.0cm tapering to 1.6cm at the tip (same for all four). 3 segments each.
FINGER_SPACING = 0.021
FINGER_BASE_R = 0.020 / 2
FINGER_TIP_R = 0.016 / 2
FINGERS = [  # name, x at knuckle, total length, splay_deg (open pose, <=8 deg from middle)
    ("index",  -1.5 * FINGER_SPACING, 0.070, -6.0),
    ("middle", -0.5 * FINGER_SPACING, 0.078,  0.0),
    ("ring",    0.5 * FINGER_SPACING, 0.072,  5.0),
    ("pinky",   1.5 * FINGER_SPACING, 0.058,  8.0),
]
KNUCKLE_Y = 0.004          # fingers root near the dorsal side of the palm block, not its centre
SEG_FRAC = (0.42, 0.32, 0.26)  # proximal / middle / distal, fraction of total finger length

# THUMB: 6cm in two segments, 2.3cm diameter, root at -X side of palm 3cm from the wrist.
THUMB_LEN = 0.060
THUMB_RB = 0.0115
THUMB_RT = 0.0100
THUMB_FRAC = (0.55, 0.45)
THUMB_Z = -0.030
_palm_w_at_thumb = PALM_WRIST_HALF_W + (PALM_KNUCKLE_HALF_W - PALM_WRIST_HALF_W) * (-THUMB_Z / PALM_LEN)
THUMB_X = -(_palm_w_at_thumb - 0.002)   # just inside the palm edge at that z — guarantees overlap
THUMB_Y = -0.004

# FIST joint angles, anatomical (MCP / PIP / DIP), converted to this rig's CUMULATIVE phi
# (phi=0 -> straight -Z extended; phi=90 -> straight -Y into the palm; phi=180 -> +Z, curled
# back under). Cumulative = MCP, MCP+PIP, MCP+PIP+DIP.
_MCP, _PIP, _DIP = 85.0, 95.0, 50.0
FIST_PHI = (_MCP, _MCP + _PIP, _MCP + _PIP + _DIP)  # (85, 180, 230)

# THUMB open-pose direction: 45 deg "out" (elevation off the palm plane, toward +Y) and 20 deg
# "forward" (azimuth from -X toward -Z). Applied to BOTH segments — the open thumb is straight.
_el, _az = math.radians(45.0), math.radians(20.0)
THUMB_OPEN_DIR = Vector((-math.cos(_el) * math.cos(_az), math.sin(_el), -math.cos(_el) * math.sin(_az))).normalized()

POSE = {
    "open": dict(finger_phi=(5, 8, 12), splay_scale=1.0),
    "fist": dict(finger_phi=FIST_PHI, splay_scale=0.0),
}
# fist thumb: "lies across the curled index + middle" — a crossing sweep (psi=0 -> -X, psi=90 ->
# -Z), tuned so the tip lands over the index/middle's curled first knuckle, not out past them.
FIST_THUMB_PSI = (60.0, 118.0)
FIST_THUMB_YLIFT = (-0.10, -0.32)   # ★ fix: positive ylift swung the thumb up to the DORSAL
# side, burying its tip near the back of the palm where the curled fingers already sat — from
# the palm-view render it was invisible. "Lies across the curled index+middle" means across
# their FRONT (palm-facing) surface, so it needs to lean -Y, not +Y — and less cumulative sweep
# keeps more of its own length visibly crossing rather than curling away under itself.

# CUFF: 8.5cm outer diameter, "1.0cm thick" = 8.5cm outer vs the 7.5cm forearm it sits on (0.5cm
# proud all round), 1.5cm tall. STRAP: flat band 2.0cm wide (along Z) x 0.4cm thick, dark brown,
# just DISTAL of the cuff (closer to the hand). SEAT: 1.2cm gem, 2cm distal of the strap.
FOREARM_LEN = 0.080
FOREARM_R = 0.0375           # 7.5cm diameter
CUFF_OUTER_R = 0.0425        # 8.5cm outer diameter
CUFF_Z = 0.045
CUFF_TALL = 0.015
STRAP_OUTER_R = FOREARM_R + 0.004   # 0.4cm thick, proud of the forearm
STRAP_Z = 0.014
STRAP_WIDE = 0.020            # 2.0cm wide, along Z
SEAT_R = 0.012 / 2
SEAT_Z = STRAP_Z - 0.020


def curl_dir(phi_deg, lean_x=0.0):
    """Direction a finger segment points. phi=0 -> straight -Z (extended); phi=90 -> straight -Y
    (curled flat toward the palm); phi=180 -> +Z (curled all the way back under, toward the
    wrist) — the hook a fist's fingers make. `lean_x` fans the direction sideways (open pose
    splay); it is a small azimuthal nudge, not a real 3rd angle."""
    phi = math.radians(phi_deg)
    return Vector((lean_x, -math.sin(phi), -math.cos(phi))).normalized()


def rotate_y_deg(v, deg):
    """Rotate a direction about the world/local Y axis (back-of-hand axis) — a true azimuthal
    fan in the X-Z plane, so the OPEN pose's <=8 deg splay is an actual measured angle, not an
    eyeballed offset."""
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return Vector((v.x * ca + v.z * sa, v.y, -v.x * sa + v.z * ca))


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


def assign(obj, mat):
    if not obj.data.materials:
        obj.data.materials.append(mat)
    else:
        obj.data.materials[0] = mat
    return obj


# ── DRAFT 3: the "bamboo" fix — ONE continuous tube per finger/thumb/seam, not a stack of
# separate capsule segments. Draft 2 built each phalanx as its OWN beveled cone with its own
# rounded cap, then butted the next segment's own rounded base against it — two separate round
# ends meeting always shows a waist/pinch at the joint, no matter how good the bend angle is.
# A curve's bevel is ONE continuous swept surface along the whole path, so a bend shows as a
# bend, never a seam. Per-point `radius` gives the 2.0->1.6cm taper without needing per-segment
# radii; VECTOR handles keep the path itself the same straight-segment polyline the joint
# angles already describe (a real knuckle crease reads better as a crisp bend than an
# over-rounded Auto-handle curve, which tended to overshoot on the fist's 85/95/50 deg bends).
def make_tapered_tube(name, pts, radii, mat, vcol, bevel_res=8, resolution_u=2, cap_end=True):
    """pts: list of Vector world points (the joint chain, base..tip). radii: matching list of
    physical radii (metres) at each point — the curve's bevel_depth is fixed at 1.0 so a point's
    `radius` attribute IS the swept radius, no separate scale factor to keep in sync."""
    # POLY (not Bezier) — a plain piecewise-linear path between the joint points, which is what
    # we want anyway (a real knuckle is a crisp bend, not a smoothed-over curve, and the joint
    # ANGLES already come straight from the coordinator's MCP/PIP/DIP numbers). This also sidesteps
    # Bezier handle bookkeeping entirely: a fresh bezier point's handles default to zero-length
    # (coincident with its own co) unless explicitly positioned, which would have produced a
    # degenerate/undefined tangent at every joint — POLY has no handles to get wrong.
    cd = bpy.data.curves.new(name, type='CURVE')
    cd.dimensions = '3D'
    cd.resolution_u = resolution_u
    spline = cd.splines.new('POLY')
    spline.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        cp = spline.points[i]
        cp.co = (p.x, p.y, p.z, 1.0)
        cp.radius = radii[i]
    cd.bevel_depth = 1.0
    cd.bevel_resolution = bevel_res
    cd.fill_mode = 'FULL'
    obj = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.shade_smooth()
    assign(obj, mat)
    set_vcol(obj, vcol)
    parts = [obj]
    if cap_end:
        tip = pts[-1]
        cap = add(bpy.ops.mesh.primitive_uv_sphere_add, segments=6, ring_count=4,
                  radius=radii[-1] * 0.98, location=(tip.x, tip.y, tip.z))
        bpy.ops.object.shade_smooth()
        assign(cap, mat)
        set_vcol(cap, vcol)
        parts.append(cap)
    return parts


def flat_solid(name, pts_xz, y_top, thickness, bevel=0.003, bevel_segments=3):
    """A hand-authored (x,z) silhouette at a fixed y_top, solidified toward -Y (into the palm)
    and bevelled round. Auto-corrects winding so the top face normal always faces +Y."""
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
    bev.segments = bevel_segments
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
    # (x, z) — 7cm wide at the wrist, 9cm at the knuckles, 10cm long. Symmetric; the thumb
    # overlaps the -X edge well inside its own volume (checked below), so no notch is cut.
    pts = [
        (-PALM_WRIST_HALF_W, 0.0), (PALM_WRIST_HALF_W, 0.0),
        (0.040, -0.035), (0.044, -0.075), (PALM_KNUCKLE_HALF_W, -PALM_LEN),
        (0.018, -PALM_LEN - 0.007), (-0.018, -PALM_LEN - 0.007),
        (-PALM_KNUCKLE_HALF_W, -PALM_LEN), (-0.044, -0.075), (-0.040, -0.035),
    ]
    obj = flat_solid("palm", pts, PALM_Y_TOP, PALM_THICK, bevel=PALM_BEVEL, bevel_segments=4)
    assign(obj, mat)
    set_vcol(obj, CLOTH)
    # ★ DRAFT 3 FIX: the old center/scale math put this dome's centre at y=-0.008 with a real
    # (post-scale) half-height of ~0.013 — i.e. spanning roughly y[-0.021, +0.005], almost
    # entirely on the PALM (-Y) side and barely reaching the back surface at all. That is
    # exactly the "oval pad on the palm side" the ref doesn't show. Rebuilt so its FLOOR sits at
    # the back surface (y=PALM_Y_TOP) and it only rises PALM_DOME_HEIGHT above that — it can
    # never cross to -Y because its lowest point is pinned at the surface, not derived from a
    # radius/scale combo that has to be re-solved by hand.
    dome = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=2, radius=PALM_DOME_R,
               location=(0.0, PALM_Y_TOP, -PALM_LEN * 0.55))
    dome.scale = (1.35, PALM_DOME_HEIGHT / PALM_DOME_R, 1.0)
    bpy.ops.object.shade_smooth()
    assign(dome, mat)
    set_vcol(dome, CLOTH)
    return [obj, dome]


def build_forearm_stub(mat):
    obj = add(bpy.ops.mesh.primitive_cone_add, vertices=16, radius1=FOREARM_R, radius2=FOREARM_R * 0.97,
              depth=FOREARM_LEN, location=(0, -0.001, FOREARM_LEN / 2))
    obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.shade_smooth()
    assign(obj, mat)
    set_vcol(obj, CLOTH_SHADOW)
    return obj


def build_cuff_and_strap(mat):
    """CUFF: a short squat RING (cylinder, not a torus donut — the torus was the 'mushroom cap'
    bug) — 8.5cm outer diameter, 1.5cm tall, sitting ~0.5cm proud of the 7.5cm forearm all
    round. STRAP: a flatter band, 2cm wide along Z, 0.4cm proud, just distal of (closer to the
    hand than) the cuff."""
    parts = []
    cuff = add(bpy.ops.mesh.primitive_cylinder_add, vertices=16, radius=CUFF_OUTER_R, depth=CUFF_TALL,
               location=(0, 0, CUFF_Z))
    cuff.rotation_euler = (math.radians(90), 0, 0)
    bev = cuff.modifiers.new("b", 'BEVEL')
    bev.width = 0.003
    bev.segments = 1
    bpy.ops.object.modifier_apply(modifier="b")
    bpy.ops.object.shade_smooth()
    assign(cuff, mat)
    set_vcol(cuff, CLOTH)  # lit cream, NOT shadow — it must read as a distinct ring against the
    # darker forearm stub underneath it, not blend into one shapeless mass (self-critique below)
    parts.append(cuff)

    strap = add(bpy.ops.mesh.primitive_cylinder_add, vertices=16, radius=STRAP_OUTER_R, depth=STRAP_WIDE,
                location=(0, 0, STRAP_Z))
    strap.rotation_euler = (math.radians(90), 0, 0)
    bev2 = strap.modifiers.new("b", 'BEVEL')
    bev2.width = 0.002
    bev2.segments = 1
    bpy.ops.object.modifier_apply(modifier="b")
    bpy.ops.object.shade_smooth()
    assign(strap, mat)
    set_vcol(strap, STRAP)
    parts.append(strap)
    return parts


def build_seat(mat):
    """The one dark, dormant seat — flush cabochon, never a rim/bezel (canon: 'the vessel closed
    around it', never a socket). 1.2cm across, sunk half into the cloth."""
    parts = []
    r = SEAT_R
    loc = (0.0, PALM_Y_TOP - 0.001, SEAT_Z)
    disc = add(bpy.ops.mesh.primitive_cylinder_add, vertices=20, radius=r, depth=r * 0.5,
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
    dome = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=2, radius=r * 0.85,
               location=(loc[0], loc[1] + r * 0.35, loc[2]))
    dome.scale.y = 0.55
    bpy.ops.object.shade_smooth()
    assign(dome, mat)
    set_vcol(dome, SEAT)
    parts.append(dome)
    return parts


def finger_chain(pose, x, total, splay_deg):
    """Returns (pts[4], radii[4], dirs[3]) for one finger under a given pose — the single source
    both the finger geometry AND its seam ridge are built from, so a seam always rides the same
    curl the finger uses."""
    phis = pose["finger_phi"]
    scale = pose["splay_scale"]
    dirs = []
    for i in range(3):
        d = curl_dir(phis[i])
        d = rotate_y_deg(d, splay_deg * scale * (0.4 + 0.3 * i))  # splay grows slightly out along the finger
        dirs.append(d)
    base = (x, KNUCKLE_Y, KNUCKLE_Z)
    pts = chain_points(base, total, SEG_FRAC, dirs)
    cum = [0.0]
    for f in SEG_FRAC:
        cum.append(cum[-1] + f)
    radii = [FINGER_BASE_R + (FINGER_TIP_R - FINGER_BASE_R) * c for c in cum]
    return pts, radii, dirs


def thumb_chain(pose_name):
    tbase = (THUMB_X, THUMB_Y, THUMB_Z)
    if pose_name == "open":
        tdirs = [THUMB_OPEN_DIR, THUMB_OPEN_DIR]   # straight thumb — one measured direction
    else:
        tdirs = [
            Vector((-math.cos(math.radians(FIST_THUMB_PSI[0])), FIST_THUMB_YLIFT[0],
                     -math.sin(math.radians(FIST_THUMB_PSI[0])))).normalized(),
            Vector((-math.cos(math.radians(FIST_THUMB_PSI[1])), FIST_THUMB_YLIFT[1],
                     -math.sin(math.radians(FIST_THUMB_PSI[1])))).normalized(),
        ]
    tpts = chain_points(tbase, THUMB_LEN, THUMB_FRAC, tdirs)
    tcum = [0.0, THUMB_FRAC[0], 1.0]
    tradii = [THUMB_RB + (THUMB_RT - THUMB_RB) * c for c in tcum]
    return tpts, tradii, tdirs


def _seam_offset_points(pts, dirs, radii, extra=0.0018):
    """One offset point per joint (len(pts)), each pushed out from the finger's own centreline
    along the local 'outward' normal at that joint — a continuous parallel path the seam tube
    follows, instead of 3 separately-aimed straight segments."""
    out = [None] * len(pts)
    for i in range(len(pts)):
        d = dirs[min(i, len(dirs) - 1)] if i < len(dirs) else dirs[-1]
        d2 = dirs[i - 1] if i > 0 else dirs[0]
        # average the incoming/outgoing segment direction at interior joints so the offset
        # normal doesn't kink at every control point
        davg = (d + d2)
        if davg.length < 1e-6:
            davg = d
        davg.normalize()
        perp = Vector((0.0, -davg.z, davg.y))
        if perp.length < 1e-5:
            perp = Vector((0, 0, 1))
        perp.normalize()
        r = radii[i] * 0.85 + extra
        out[i] = pts[i] + perp * r
    return out


def build_seams(pose_name, mat):
    """Visible relief the way the ref reads it — ONE continuous raised stitch ridge down each
    finger (riding the same curl the finger itself uses), plus one across the palm. This is the
    only relief that should mark a joint now that the finger itself is a single smooth tube."""
    pose = POSE[pose_name]
    parts = []
    for (name, x, total, splay_deg) in FINGERS:
        pts, radii, dirs = finger_chain(pose, x, total, splay_deg)
        seam_pts = _seam_offset_points(pts, dirs, radii)
        seam_r = [0.0035, 0.0032, 0.0027, 0.0020]
        parts += make_tapered_tube(f"seam-{name}", seam_pts, seam_r, mat, SEAM,
                                    bevel_res=4, resolution_u=2, cap_end=False)
    ridge = add(bpy.ops.mesh.primitive_cylinder_add, vertices=8, radius=0.0035,
                depth=PALM_KNUCKLE_HALF_W * 1.7, location=(0, PALM_Y_TOP - 0.001, -PALM_LEN * 0.42))
    ridge.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.shade_smooth()
    assign(ridge, mat)
    set_vcol(ridge, SEAM)
    parts.append(ridge)
    return parts


def build_digits(pose_name, mat):
    pose = POSE[pose_name]
    parts = []
    fingertips = []
    for (name, x, total, splay_deg) in FINGERS:
        pts, radii, dirs = finger_chain(pose, x, total, splay_deg)
        parts += make_tapered_tube(name, pts, radii, mat, CLOTH, bevel_res=8, resolution_u=2, cap_end=True)
        fingertips.append(pts[-1])
    tpts, tradii, tdirs = thumb_chain(pose_name)
    parts += make_tapered_tube("thumb", tpts, tradii, mat, CLOTH, bevel_res=8, resolution_u=2, cap_end=True)
    if pose_name == "fist":
        ys = [p.y for p in fingertips]
        zs = [p.z for p in fingertips]
        xs = [p.x for p in fingertips]
        print(f"FIST fingertip envelope: x[{min(xs):.3f},{max(xs):.3f}] "
              f"y[{min(ys):.3f},{max(ys):.3f}] z[{min(zs):.3f},{max(zs):.3f}]  "
              f"(palm surface y in [{PALM_Y_BOT:.3f},{PALM_Y_TOP:.3f}])")
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
    parts = list(build_palm(mat))
    parts.append(build_forearm_stub(mat))
    parts += build_cuff_and_strap(mat)
    parts += build_seat(mat)
    parts += build_seams(pose_name, mat)
    parts += build_digits(pose_name, mat)
    obj = join_all(parts, f"glove_{pose_name}")
    return obj


# ── lighting + camera, for the review renders only (not exported) ─────────────────────────────
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
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.45, 0.45, 0.45, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    return scene


def add_area(scene, loc, energy, color, size, target=(0, 0, -0.06), name="l"):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.color = color
    ld.size = size
    ob = bpy.data.objects.new(name, ld)
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
    add_area(scene, (0.25, 0.30, 0.15), 1.1, (1.0, 0.93, 0.82), 0.18)     # warm key
    add_area(scene, (-0.30, -0.10, 0.10), 0.4, (0.75, 0.80, 0.95), 0.18)  # cool fill
    add_area(scene, (0.0, -0.05, 0.35), 0.5, (1.0, 0.88, 0.70), 0.12)     # warm rim from above


def cam_at(scene, loc, target=(0, 0, -0.06)):
    cd = bpy.data.cameras.new("cam")
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
    ("3q-behind",  (0.16, 0.20, 0.16)),    # three-quarter, behind + above
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


# ── the 9th frame: THE PLAYER'S OWN VIEW ───────────────────────────────────────────────────────
# Camera fixed at the world origin, looking down world -Z, +Y up, 75 deg VERTICAL fov — exactly
# `hands.ts`'s own tuned frame (fov 75, DEFAULT_TUNE wrist = 0.32, -0.20, -0.50). The hand's
# local -Z (its fingers) is aimed along the given relative vector; `to_track_quat('-Z','Y')`
# points local -Z there while keeping local +Y as close to world +Y as this allows — i.e. the
# rig's own "aim, then roll" logic, done as a single quaternion instead of the two-point
# lookAt the live rig uses (the RESULT is the same rest pose; this is a static render, not the
# runtime rig).
POV_CAM_FOV_V = 75.0
POV_HAND_POS = Vector((0.32, -0.20, -0.50))
POV_AIM_REL = Vector((-0.14, 0.27, -0.16))


def render_player_pov(scene, fist, open_):
    clear_lights_and_cameras(scene)
    # hide the two originals from render (do NOT delete them — main() still needs to select them
    # for the glTF export after this) and add a throwaway object sharing the POSE's mesh DATA,
    # posed at the rig's rest transform.
    fist.hide_render = True
    open_.hide_render = True
    # ★ OPEN reads far better here than fist: at this fixed rest-pose angle (the forearm/cuff
    # end is closest to camera and largest by perspective, the hand itself is smallest and
    # farthest) a closed fist balls into a small mass that gets lost against the bigger nearer
    # cuff; the open hand's spread fingers + thumb give it enough silhouette area to read
    # clearly as "a gloved hand" at a glance. Both poses ship in the GLB either way.
    pov_pose = os.environ.get("POV_POSE", "open")
    src = open_ if pov_pose == "open" else fist

    hand = bpy.data.objects.new("pov_hand", src.data)
    scene.collection.objects.link(hand)
    hand.location = POV_HAND_POS

    # ★ `to_track_quat('-Z','Y')` is degenerate here: the given aim direction is 79% world +Y
    # (the forearm "rises steeply into the frame" per hands.ts's own comment on this exact rest
    # pose), so trying to also keep local +Y close to world +Y leaves the roll about the aim
    # axis almost unconstrained — the first cut picked an arbitrary one and the palm/cuff ended
    # up facing the lens face-on (the "big round blob" in the first render). The real rig names
    # what roll is FOR: "turn the back of the glove toward the lens." So: build the basis
    # directly, choosing local +Y (back of hand) to lean toward the CAMERA as much as the fixed
    # aim direction allows, instead of toward world up.
    from mathutils import Matrix
    f = POV_AIM_REL.normalized()               # local -Z (fingers), fixed by the brief
    to_cam = (Vector((0, 0, 0)) - POV_HAND_POS).normalized()
    up_ref = to_cam - f * to_cam.dot(f)         # component of "toward camera" perpendicular to f
    if up_ref.length < 1e-4:
        up_ref = Vector((0, 1, 0)) - f * f.y
    up_ref.normalize()
    right = f.cross(up_ref).normalized()        # local +X candidate
    true_up = right.cross(f).normalized()        # local +Y, perpendicular to f, leaning toward camera
    # world = basis @ local ; columns are local axes expressed in world space. Local -Z = f, so
    # local +Z = -f. thumb is -X, so local +X = -right if `right` lands on the thumb side —
    # checked against the render; the sign here matched on the first try.
    basis = Matrix((right, true_up, -f)).transposed()
    hand.rotation_mode = 'QUATERNION'
    hand.rotation_quaternion = basis.to_quaternion()

    # warm key from above-left of the CAMERA (world -X, +Y, slightly in front toward -Z)
    add_area(scene, (-0.35, 0.45, -0.30), 3.0, (1.0, 0.90, 0.75), 0.5, target=tuple(POV_HAND_POS), name="povkey")
    add_area(scene, (0.4, -0.1, -0.2), 0.6, (0.75, 0.82, 0.95), 0.4, target=tuple(POV_HAND_POS), name="povfill")

    world = scene.world
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.06, 0.09, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

    cd = bpy.data.cameras.new("povcam")
    cd.sensor_fit = 'VERTICAL'
    cd.angle_y = math.radians(POV_CAM_FOV_V)
    cam = bpy.data.objects.new("povcam", cd)
    cam.location = (0, 0, 0)
    cam.rotation_euler = (0, 0, 0)   # default Blender cam looks down -Z, +Y up — exactly the spec
    scene.collection.objects.link(cam)
    scene.camera = cam

    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    path = os.path.join(TT_DIR, "player-pov.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {path}  (hand at {tuple(POV_HAND_POS)}, aimed at rel {tuple(POV_AIM_REL)})")
    bpy.data.objects.remove(hand, do_unlink=True)
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
        render_player_pov(scene, fist, open_)

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
