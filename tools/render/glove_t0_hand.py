# Tier-0 casting glove — the REAL-TIME hand mesh for the first-person rig (`voxel3d/hands.ts`).
#
# ★ DRAFT 4 (2026-09-16, play lane): THE HAND IS ONE SKINNED BODY, NOT TUBES ON A BRICK.
# Drafts 1–3 built a beveled box palm, a 7.5cm forearm cylinder with an 8.5cm ring on it, and
# four swept tubes for fingers. Alex, in-game: *"the arm is looking like a hammer with the fingers
# all disfigured."* The turntable agreed — the fist curled its fingertips INTO the palm block, the
# open fingers were four parallel sticks, and from the player's own eye the forearm+ring were the
# nearest and largest thing on screen: a handle with a head on it. Joint tuning cannot fix a
# construction that has no knuckles, no heel, no taper and no blend between palm and digit.
#
# So: a vertex TREE (forearm → wrist → heel → knuckle row → five digits) run through Blender's
# Skin modifier with a per-joint radius pair (wide/flat at the palm, round at the fingers) and one
# subdivision. One continuous surface: the palm is a padded loaf that thins toward the knuckles,
# each finger grows out of it, the fist balls into a single rounded mass with the knuckles bulging
# where the bend is, and the forearm is a NARROWER oval than the hand it feeds — the arm reads as
# an arm because the hand is the wide end. The ref (`refs/vessel-glove-t0-1.png`) is a plump quilted
# work glove whose fingers touch at the base; the base radii here are chosen so they do.
#
# Contract with `hands.ts` (unchanged since draft 2): objects `glove_fist` + `glove_open`, metres,
# origin at the WRIST centre, fingers along −Z, back of hand +Y, thumb −X, vertex colours in `Col`.
# The rig replaces the file's material with Lambert + vertex colours; only the colour survives.
#
# Run:  RENDER_OUT=tools/render/out/hands-draft4 /opt/blender/blender -b -P tools/render/glove_t0_hand.py
#       (NO_RENDER=1 for the GLB alone · SAMPLES/RES for the review renders)
# Out:  $RENDER_OUT/glove-t0.glb · $RENDER_OUT/turntable/*.png · turntable/player-pov.png
# ⚠ Never write under public/ from here — an untracked public file blocks every lane's coord build.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

OUT = os.environ.get("RENDER_OUT", "/tmp/glove_hand")
TT_DIR = os.path.join(OUT, "turntable")
os.makedirs(TT_DIR, exist_ok=True)
RES = int(os.environ.get("RES", "640"))
SAMPLES = int(os.environ.get("SAMPLES", "48"))
DO_RENDER = os.environ.get("NO_RENDER", "0") != "1"

# ── palette — NO metal, ever (the vessel card's law; the rig's Lambert cannot carry it anyway) ──
CLOTH        = (0xC9/255, 0xB4/255, 0x8A/255)   # lit cloth
CLOTH_SHADOW = (0xA8/255, 0x90/255, 0x5F/255)   # the hem's fold
STRAP        = (0x5A/255, 0x3A/255, 0x22/255)   # plain dark-brown wrap, sewn not buckled
SEAT         = (0x4A/255, 0x46/255, 0x38/255)   # crude cloudy crystal, dormant, unlit

# ── the hand, in metres. A right hand, wrist at the origin. ─────────────────────────────────────
# Skin radii are (half-width along X, half-thickness along Y) at each joint.
# The glove ends at the wrist with a hem, like the ref. Past it is the keeper's SLEEVE — plain
# tunic cloth, baggier than the wrist, long enough to leave the player's frame instead of ending
# in mid-air (draft 3's forearm stopped 7cm out and floated).
FOREARM = [  # (pos, radii) from the elbow end down to the wrist
    (Vector((0.000, 0.003, 0.125)), (0.035, 0.028)),   # ⚠ the rig aims the elbow end TOWARD the eye, so
    (Vector((0.000, 0.002, 0.060)), (0.034, 0.027)),   # perspective fattens the sleeve — keep it lean
    (Vector((0.000, 0.001, 0.030)), (0.031, 0.023)),
]
SLEEVE = (0x7C/255, 0x74/255, 0x62/255)          # undyed tunic cloth, a shade darker than the glove
SLEEVE_Z = 0.034                                 # above this the tree wears the sleeve colour
WRIST   = (Vector((0.000, 0.000, 0.000)), (0.030, 0.021))
HEEL    = (Vector((0.002, -0.001, -0.038)), (0.041, 0.018))   # the padded heel: widest, thickest
KNUCKLE = (Vector((0.004, 0.001, -0.078)), (0.044, 0.014))    # the knuckle row: wide, thin
PALM_BACK_Y = KNUCKLE[0].y + KNUCKLE[1][1]                    # where the seat sits

# fingers: (name, knuckle x, knuckle z, length, open splay deg). Knuckle z follows the arc of a
# real hand (middle longest and furthest); lengths are a padded glove's, not a skeleton's.
FINGERS = [
    ("index",  -0.033, -0.094, 0.070, -5.0),
    ("middle", -0.011, -0.099, 0.077,  0.0),
    ("ring",    0.011, -0.095, 0.072,  4.0),
    ("pinky",   0.032, -0.086, 0.057,  8.0),
]
KNUCKLE_Y = 0.001
SEG_FRAC = (0.42, 0.32, 0.26)               # proximal / middle / distal
FINGER_R = (0.0118, 0.0110, 0.0100, 0.0090)  # radius at knuckle / PIP / DIP / tip — plump, 2.2cm spacing
                                             # means they TOUCH at the base like the ref's
THUMB_INNER = Vector((-0.020, -0.004, -0.032))   # the thumb's root, buried in the heel
THUMB_ROOT = Vector((-0.040, -0.006, -0.036))    # where it leaves the palm
THUMB_LEN = 0.062
THUMB_FRAC = (0.55, 0.45)
THUMB_R = (0.0135, 0.0120, 0.0105)

# joint angles, cumulative "phi": 0 = straight on along −Z, 90 = straight into the palm (−Y),
# 180 = back toward the wrist (+Z). The fist is a RELAXED fist — tips resting on the palm, not
# driven through it (draft 3 buried them 4mm inside the block).
POSE = {
    "open": dict(phi=(8.0, 14.0, 18.0), splay=1.0,
                 thumb=(Vector((-0.58, 0.26, -0.77)), Vector((-0.42, 0.18, -0.89)))),
    "fist": dict(phi=(80.0, 175.0, 205.0), splay=0.0,
                 # across the curled index+middle: sweeps from −X toward −Z, leaning to the palm side
                 thumb=(Vector((-0.55, -0.30, -0.78)), Vector((0.30, -0.45, -0.84)))),
}

# the cloth extras: hem at the far end, the wrap at the wrist, the seat on the back
HEM_Z = (0.020, 0.034)                          # the glove's folded edge, just past the wrist-bone
HEM_PROUD = 0.004
WRAP_Z = (-0.058, -0.044)                        # across the hand, where the ref's strap crosses
WRAP_PROUD = 0.003
SEAT_Z = -0.070          # on the knuckle arc, centred — the card's "one seat, on that same arc"
SEAT_R = 0.0075


def curl_dir(phi_deg, splay_deg=0.0):
    phi = math.radians(phi_deg)
    d = Vector((0.0, -math.sin(phi), -math.cos(phi)))
    a = math.radians(splay_deg)
    return Vector((d.x * math.cos(a) + d.z * math.sin(a), d.y, -d.x * math.sin(a) + d.z * math.cos(a))).normalized()


def set_vcol(obj, rgb, above_z=None, above_rgb=None):
    """One colour per corner; with `above_z`, corners whose vertex sits past that z take `above_rgb`
    (the sleeve on the one continuous skin body)."""
    mesh = obj.data
    attr = mesh.color_attributes.get("Col")
    if attr is None:
        attr = mesh.color_attributes.new(name="Col", type='FLOAT_COLOR', domain='CORNER')
    for loop, d in zip(mesh.loops, attr.data):
        c = rgb
        if above_z is not None and mesh.vertices[loop.vertex_index].co.z > above_z:
            c = above_rgb
        d.color = (c[0], c[1], c[2], 1.0)


def assign(obj, mat):
    if not obj.data.materials:
        obj.data.materials.append(mat)
    else:
        obj.data.materials[0] = mat
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


# ── the skin tree ────────────────────────────────────────────────────────────────────────────────
class Tree:
    def __init__(self):
        self.verts, self.radii, self.edges = [], [], []

    def add(self, pos, radii, parent=None):
        i = len(self.verts)
        self.verts.append(Vector(pos)); self.radii.append(tuple(radii))
        if parent is not None:
            self.edges.append((parent, i))
        return i

    def chain(self, parent, pts, radii, subdiv=2):
        """Walk `pts` from `parent`'s position, inserting `subdiv` rings per segment so a bend is a
        curve of rings rather than one kinked ring. Radii interpolate along the walk."""
        prev = parent
        p0 = self.verts[parent]; r0 = self.radii[parent]
        for p1, r1 in zip(pts, radii):
            for s in range(1, subdiv + 1):
                t = s / subdiv
                prev = self.add(p0.lerp(p1, t), (r0[0] + (r1[0] - r0[0]) * t, r0[1] + (r1[1] - r0[1]) * t), prev)
            p0, r0 = p1, r1
        return prev


def digit_points(base, total, fracs, dirs):
    pts, p = [], Vector(base)
    for f, d in zip(fracs, dirs):
        p = p + d * (total * f)
        pts.append(p.copy())
    return pts


def build_skin_hand(pose_name):
    pose = POSE[pose_name]
    t = Tree()
    root = t.add(*FOREARM[0])
    prev = t.chain(root, [FOREARM[1][0], FOREARM[2][0], WRIST[0]], [FOREARM[1][1], FOREARM[2][1], WRIST[1]], subdiv=2)
    prev = t.chain(prev, [HEEL[0], KNUCKLE[0]], [HEEL[1], KNUCKLE[1]], subdiv=3)
    knuckle = prev
    for name, x, z, length, splay in FINGERS:
        base = Vector((x, KNUCKLE_Y, z))
        dirs = [curl_dir(pose["phi"][i], splay * pose["splay"] * (0.5 + 0.25 * i)) for i in range(3)]
        pts = digit_points(base, length, SEG_FRAC, dirs)
        # a short stalk from the knuckle row to the finger's own knuckle, then the three phalanges
        k = t.add(base, (FINGER_R[0], FINGER_R[0]), knuckle)
        t.chain(k, pts, [(r, r) for r in FINGER_R[1:]], subdiv=2)
    body = skin_to_mesh(t, root, f"body_{pose_name}")

    # ★ THE THUMB IS ITS OWN SKINNED BODY. Branching it off the wide flat heel vertex made the Skin
    # modifier hull the heel + thumb radii into one convex wedge — a flat shelf under the thumb and
    # a collar at the wrist (draft 4a). Rooted INSIDE the palm and overlapping it instead, the
    # thumb grows out of the loaf with no hull to bridge. Overlap is invisible on a one-colour cloth.
    th = Tree()
    troot = th.add(THUMB_INNER, (THUMB_R[0], THUMB_R[0] * 0.8))
    tdirs = [d.normalized() for d in pose["thumb"]]
    tpts = digit_points(THUMB_ROOT, THUMB_LEN, THUMB_FRAC, tdirs)
    tr = th.chain(troot, [THUMB_ROOT], [(THUMB_R[0], THUMB_R[0])], subdiv=2)
    th.chain(tr, tpts, [(r, r) for r in THUMB_R[1:]], subdiv=2)
    thumb = skin_to_mesh(th, troot, f"thumb_{pose_name}")
    return join_all([body, thumb], f"hand_{pose_name}")


def skin_to_mesh(t, root, name):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in t.verts], t.edges, [])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    skin = obj.modifiers.new("Skin", 'SKIN')
    skin.use_smooth_shade = True
    sv = mesh.skin_vertices[0].data
    for i, (rx, ry) in enumerate(t.radii):
        sv[i].radius = (rx, ry)
        sv[i].use_root = (i == root)
    sub = obj.modifiers.new("Sub", 'SUBSURF')
    sub.levels = sub.render_levels = 1
    # bake the modifiers into a plain mesh
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.clear()
    obj.data = baked
    baked.name = name
    for p in baked.polygons:
        p.use_smooth = True
    return obj


# ── the cloth extras ────────────────────────────────────────────────────────────────────────────
def oval_band(name, z0, z1, rx, ry, segs=24, cx=0.0):
    """A closed ring of cloth between z0 and z1, an oval rx×ry — open at both ends, two-sided."""
    bm = bmesh.new()
    rings = []
    for z in (z0, z1):
        ring = [bm.verts.new((cx + rx * math.cos(2 * math.pi * i / segs), ry * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)]
        rings.append(ring)
    for i in range(segs):
        a, b = rings[0][i], rings[0][(i + 1) % segs]
        c, d = rings[1][(i + 1) % segs], rings[1][i]
        bm.faces.new((a, b, c, d))
    # cap the band's thickness with a second, inner shell so it has an edge to read
    inner = []
    for z in (z0, z1):
        inner.append([bm.verts.new((cx + (rx - 0.002) * math.cos(2 * math.pi * i / segs), (ry - 0.002) * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for i in range(segs):
        for outer, inr in ((rings[0], inner[0]), (rings[1], inner[1])):
            a, b = outer[i], outer[(i + 1) % segs]
            c, d = inr[(i + 1) % segs], inr[i]
            bm.faces.new((a, b, c, d))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh); bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for p in mesh.polygons:
        p.use_smooth = True
    return obj


def build_extras(mat):
    parts = []
    # the hem: a flared fold of cloth at the far end of the forearm, a shade darker
    rx, ry = FOREARM[2][1]
    hem = oval_band("hem", HEM_Z[0], HEM_Z[1], rx + HEM_PROUD, ry + HEM_PROUD)
    assign(hem, mat); set_vcol(hem, CLOTH_SHADOW); parts.append(hem)
    # the wrap: a dark band around the wrist, just past the heel
    zc = (WRAP_Z[0] + WRAP_Z[1]) / 2
    f = (zc - HEEL[0].z) / (KNUCKLE[0].z - HEEL[0].z)          # the palm's own oval at that z
    rx = HEEL[1][0] + (KNUCKLE[1][0] - HEEL[1][0]) * f
    ry = HEEL[1][1] + (KNUCKLE[1][1] - HEEL[1][1]) * f
    wrap = oval_band("wrap", WRAP_Z[0], WRAP_Z[1], rx + WRAP_PROUD, ry + WRAP_PROUD, cx=KNUCKLE[0].x * f + HEEL[0].x * (1 - f))
    assign(wrap, mat); set_vcol(wrap, STRAP); parts.append(wrap)
    # the seat: a crude cloudy crystal sunk into the back of the hand on the knuckle arc
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=SEAT_R, location=(KNUCKLE[0].x, PALM_BACK_Y + SEAT_R * 0.35, SEAT_Z))
    seat = bpy.context.active_object
    seat.name = "seat"
    seat.scale = (1.0, 0.75, 1.0)
    assign(seat, mat); set_vcol(seat, SEAT); parts.append(seat)
    return parts


def join_all(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
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
    hand = build_skin_hand(pose_name)
    assign(hand, mat); set_vcol(hand, CLOTH, above_z=SLEEVE_Z, above_rgb=SLEEVE)
    parts = [hand] + build_extras(mat)
    obj = join_all(parts, f"glove_{pose_name}")
    # sanity: the hand must be wider than the forearm, and the fist's fingertips must stay outside the palm
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    print(f"{obj.name}: x[{min(xs):.3f},{max(xs):.3f}] y[{min(ys):.3f},{max(ys):.3f}]")
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
    ("back",       (0.0, 0.30, -0.09)),
    ("palm",       (0.0, -0.30, -0.06)),
    ("thumb-side", (-0.32, 0.05, -0.06)),
    ("3q-behind",  (0.16, 0.20, 0.16)),
]


def clear_lights_and_cameras(scene):
    for o in list(scene.collection.objects):
        if o.type in ('LIGHT', 'CAMERA') or (o.type == 'EMPTY' and o.name in ('t', 'camtgt')):
            bpy.data.objects.remove(o, do_unlink=True)


def render_turntable_all(scene, fist, open_):
    for obj, pose_name in ((fist, "fist"), (open_, "open")):
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


# ── the 9th frame: THE PLAYER'S OWN VIEW — hands.ts's frame (fov 75 vertical, DEFAULT_TUNE wrist) ──
POV_CAM_FOV_V = 75.0
POV_HAND_POS = Vector((0.32, -0.20, -0.50))
POV_AIM_REL = Vector((-0.14, 0.27, -0.16))


def render_player_pov(scene, fist, open_):
    for pov_pose, src in (("open", open_), ("fist", fist)):
        clear_lights_and_cameras(scene)
        fist.hide_render = True
        open_.hide_render = True
        hand = bpy.data.objects.new("pov_hand", src.data)
        scene.collection.objects.link(hand)
        hand.location = POV_HAND_POS
        f = POV_AIM_REL.normalized()
        to_cam = (Vector((0, 0, 0)) - POV_HAND_POS).normalized()
        up_ref = to_cam - f * to_cam.dot(f)
        if up_ref.length < 1e-4:
            up_ref = Vector((0, 1, 0)) - f * f.y
        up_ref.normalize()
        right = f.cross(up_ref).normalized()
        true_up = right.cross(f).normalized()
        basis = Matrix((right, true_up, -f)).transposed()
        hand.rotation_mode = 'QUATERNION'
        hand.rotation_quaternion = basis.to_quaternion()
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
        cam.rotation_euler = (0, 0, 0)
        scene.collection.objects.link(cam)
        scene.camera = cam
        scene.render.resolution_x = 960
        scene.render.resolution_y = 540
        path = os.path.join(TT_DIR, f"player-pov-{pov_pose}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {path}")
        bpy.data.objects.remove(hand, do_unlink=True)
    fist.hide_render = False
    open_.hide_render = False


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    mat = make_material()
    fist = build_hand("fist", mat)
    open_ = build_hand("open", mat)
    for o in (fist, open_):
        print(f"TRIS {o.name}: {tri_count(o)}")

    if DO_RENDER:
        configure_render(scene)
        render_turntable_all(scene, fist, open_)
        render_player_pov(scene, fist, open_)

    # ★★ THE EXPORT FRAME. The glTF exporter converts Blender's Z-up to glTF's Y-up: file (x,y,z) =
    # blender (x, z, −y). Drafts 1–3 built in the RIG's frame (fingers −Z, back +Y) and exported it
    # raw, so the file's fingers pointed along −Y and its forearm along +Y — the glove hung 90°
    # off the stick forearm in-game, a head on a handle. THAT was the hammer. So: rotate the
    # finished meshes +90° about X (build fingers −Z → blender +Y → file −Z; build back +Y →
    # blender +Z → file +Y) AFTER the review renders, which look at the build frame. Verified by
    # reading the file's POSITION accessor bounds back: fingers must be the long −Z extent.
    rot = Matrix.Rotation(math.radians(90.0), 4, 'X')
    for o in (fist, open_):
        o.data.transform(rot)
        o.data.update()
    bpy.ops.object.select_all(action='DESELECT')
    fist.select_set(True)
    open_.select_set(True)
    glb_path = os.path.join(OUT, "glove-t0.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_materials='EXPORT', export_vertex_color='MATERIAL', export_normals=True,
        export_cameras=False, export_lights=False,
    )
    print(f"GLB {glb_path}")


if __name__ == "__main__":
    main()
