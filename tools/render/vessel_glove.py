# ── THE CASTING GLOVE — Shimmer casting vessel, render-to-sprite ──────────────────────────────
# Open-fingered, back-of-hand casting focus. Built against the LOCKED brief:
#   /root/athernyx/CANON/design-briefs/shimmer-casting-vessels.md (RULED 2026-09-03, amended 09-04/05)
# Read shimmer-gathering-focuses.md FIRST — this card inherits its two-state (dormant/channelling)
# and no-metal laws whole.
#
# DORMANT state only (inventory-icon state): real material, honest joinery, NO glow — except the
# canon-named exception, tier 3's resting fingertip glow (starwillow "glows faintly at the tips
# even dormant... the only vessel that is never fully dark").
#
# Renders the family across TIER (0-3) x SEATS (1-3; tier 0 is pinned to 1 — Greg's floor is a
# one-letter word, not "three seats missing two"). No crafting recipe is implied by the tier
# tables here — per the brief, a vessel is found/won/bought/given, never made by a keeper.
#
# Run:  RENDER_OUT=/tmp/vessels /opt/blender/blender -b -P tools/render/vessel_glove.py
# Out:  $RENDER_OUT/glove-t{TIER}-s{SEATS}.png
import bpy, math, os, sys
import mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vessel_common import (
    fresh_scene, setup_light_and_cam, mat_cloth, mat_wood, mat_cord, mat_sap, mat_nacre,
    mat_shimmerscale, mat_void, assign, add, join_all, outline_solid, build_seat, tapered_digit,
)

OUT = os.environ.get("RENDER_OUT", "/tmp/vessel_frames")
os.makedirs(OUT, exist_ok=True)

# ★★ FORM PASS 3 (2026-09-09, hub): THE GLOVE IS DRAWN ON A HAND.
# Two passes tried to make the VESSEL ALONE read as a hand — finger loops (curtain rings), then
# stub cones on a mitten (twigs on a mitten, Alex). Measured, the defect was proportion: the pad
# ran 1.55 units wrist-to-knuckle and the fingers 0.16–0.22, i.e. ~13% of the palm, where a hand's
# fingers are ~85–95% of its palm. But the brief's glove is OPEN-FINGERED with its body across the
# BACK of the hand: the vessel by itself is a pad, a cuff and a few loops, and no arrangement of
# those is hand-shaped, because the hand is what is missing. So the icon now carries a quiet
# hand — full-length fingers, a thumb that leaves the outline, a forearm stub under the cuff, all in
# one matte low-contrast material — and the VESSEL sits on it: pad over the back of the hand, cuff
# past the wrist-bone, a sleeve at each finger root and the thumb root. The hand is substrate, not
# subject: it is what makes "open-fingered, back-of-hand" legible, and it carries no tier, no
# material of its own worth reading, no glow.
HAND_Z = 0.05        # hand top surface
HAND_THICK = 0.08
Z0 = HAND_Z + 0.09   # vessel pad top surface, sitting ON the hand
THICK = 0.075

# the palm: wrist-neck (low y) widening to the knuckle line (high y), rounded across the top
HAND_PTS = [
    (-0.24, -0.95), (0.24, -0.95),
    (0.34, -0.70), (0.42, -0.35),
    (0.48, 0.05), (0.50, 0.35),
    (0.46, 0.50), (0.30, 0.56), (0.0, 0.58), (-0.30, 0.56), (-0.46, 0.50),
    (-0.50, 0.35), (-0.48, 0.05),
    (-0.42, -0.35), (-0.34, -0.70),
]
# a forearm stub so the cuff wraps SOMETHING and the wrist reads as a wrist, not a stem
FOREARM_PTS = [(-0.22, -0.90), (0.22, -0.90), (0.21, -1.55), (-0.21, -1.55)]
# full-length digits rooted just inside the knuckle line: (base_x, base_y, tip_x, tip_y, r_base, r_tip)
# middle longest, index/ring next, little shortest — the stagger every hand shows
# ★ fanned, not parallel: a relaxed hand spreads ~6–8° per finger from the middle; parallel
# digits read as a rake. Slightly thicker too — 0.075 on a 1.0 palm was a twig.
HAND_FINGERS = [
    (-0.36, 0.46, -0.52, 1.14, 0.084, 0.062),
    (-0.12, 0.50, -0.17, 1.34, 0.088, 0.064),
    (0.12, 0.50, 0.21, 1.28, 0.086, 0.063),
    (0.36, 0.44, 0.55, 1.00, 0.078, 0.058),
]
HAND_THUMB = (-0.40, -0.30, -0.94, 0.30, 0.088, 0.062)

# THE VESSEL PAD — across the back of the hand only, inset from the hand's own edge so the hand
# shows around it (that margin is what says "worn ON a hand" rather than "is the hand")
PAD_PTS = [
    (-0.19, -0.86), (0.19, -0.86),
    (0.27, -0.66), (0.33, -0.36),
    (0.38, 0.0), (0.40, 0.26),
    (0.34, 0.40), (0.18, 0.46), (0.0, 0.47), (-0.18, 0.46), (-0.34, 0.40),
    (-0.40, 0.26), (-0.38, 0.0),
    (-0.33, -0.36), (-0.27, -0.66),
]
# the cuff, flaring past the wrist-bone around the forearm stub
# ★ a BAND around the forearm, not a knob under the palm: the first cut flared to a fat octagon
# that read as a pommel. Now a wrap a little wider than the forearm stub, low profile, "cuffing a
# little past the wrist-bone" and no further.
CUFF_PTS = [
    (-0.27, -0.96), (0.27, -0.96),
    (0.28, -1.22), (-0.28, -1.22),
]

# seats on the back-of-hand pad, a shallow arc along the knuckle line, centred whatever the count
SEAT_LAYOUT = {
    0: [],                     # an UNCUT glove: no word yet, no seat (`move: null`) — same state as the bracelet's s0
    1: [(0.0, 0.26)],
    # ★ C, Alex's pick 2026-09-09: the pair follows the KNUCKLE LINE down toward the little finger. Level
    # in the model rendered as two equal discs almost side by side under the off-axis camera and read
    # like EYES; three seats never did, because the arc carried them. So the pair rides the same arc.
    2: [(-0.11, 0.30), (0.19, 0.21)],
    3: [(-0.25, 0.19), (0.0, 0.30), (0.25, 0.19)],
}

HAND_MAT_RGB = (0.30, 0.245, 0.215)   # matte, low-contrast; a hand, not a material to read


def _sleeve(name, base, tip, r, mat, at=0.16, depth=0.15):
    """a short band of vessel material around a digit near its root — how an open-fingered glove
    actually holds on. Oriented along the digit; radius a little over the digit's own."""
    b = mathutils.Vector(base); t = mathutils.Vector(tip)
    d = t - b
    c = b + d * at
    cyl = add(bpy.ops.mesh.primitive_cylinder_add, vertices=14, radius=r, depth=depth,
              location=(c.x, c.y, c.z))
    cyl.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    assign(cyl, mat)
    return cyl


def build_hand():
    """the quiet hand under the vessel — one material, no tier, no glow"""
    hand_mat = mat_cloth("hand", HAND_MAT_RGB, rough=0.92)
    parts = []
    palm = outline_solid("hand-palm", HAND_PTS, HAND_Z, thickness=HAND_THICK)
    assign(palm, hand_mat); parts.append(palm)
    arm = outline_solid("hand-forearm", FOREARM_PTS, HAND_Z - 0.01, thickness=HAND_THICK * 0.9)
    assign(arm, hand_mat); parts.append(arm)
    fz = HAND_Z - HAND_THICK * 0.5
    for (bx, by, tx, ty, rb, rt) in HAND_FINGERS:
        parts += tapered_digit(f"hand-finger-{bx:.2f}", (bx, by, fz), (tx, ty, fz + 0.02), rb, rt, hand_mat)
    tbx, tby, ttx, tty, trb, trt = HAND_THUMB
    parts += tapered_digit("hand-thumb", (tbx, tby, fz), (ttx, tty, fz + 0.02), trb, trt, hand_mat)
    return parts, fz


def build_sleeves(loop_mat, fz, glow=False):
    """the vessel's hold on the digits: a sleeve at each finger root and the thumb root.
    tier 3: starwillow's resting light lives at the FINGERTIPS per canon — here that is a small
    glowing bead at the far end of each finger sleeve, not the whole hand."""
    parts = []
    tip_mat = None
    if glow:
        tip_mat = bpy.data.materials.new("starwillow-tip-glow")
        tip_mat.use_nodes = True
        b = tip_mat.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (0.86, 0.90, 0.78, 1)
        b.inputs["Roughness"].default_value = 0.4
        b.inputs["Emission Color"].default_value = (0.80, 0.92, 0.62, 1)
        b.inputs["Emission Strength"].default_value = 1.8
    for (bx, by, tx, ty, rb, rt) in HAND_FINGERS:
        parts.append(_sleeve(f"sleeve-{bx:.2f}", (bx, by, fz), (tx, ty, fz + 0.02), rb * 1.28, loop_mat))
        if glow:
            b_ = mathutils.Vector((bx, by, fz)); t_ = mathutils.Vector((tx, ty, fz + 0.02))
            c = b_ + (t_ - b_) * 0.97
            bead = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=2, radius=rt * 0.7,
                       location=(c.x, c.y, c.z + rt * 0.6))
            assign(bead, tip_mat); parts.append(bead)
    tbx, tby, ttx, tty, trb, trt = HAND_THUMB
    parts.append(_sleeve("sleeve-thumb", (tbx, tby, fz), (ttx, tty, fz + 0.02), trb * 1.25, loop_mat, at=0.22))
    return parts


def build_glove(tier, seats):
    parts = []

    if tier == 0:
        body_mat = mat_cloth("glove-cloth", (0.74, 0.67, 0.53), rough=0.85)
        cuff_mat = mat_cloth("glove-cloth-cuff", (0.62, 0.55, 0.43), rough=0.85)
        loop_mat = body_mat
        closure_mat = None
    elif tier == 1:
        body_mat = mat_wood("glove-goldwood", (0.70, 0.48, 0.15), rough=0.52, grain_scale=10, grain_strength=0.12)
        cuff_mat = mat_cord("glove-cord-cuff", (0.40, 0.30, 0.19))
        loop_mat = body_mat
        closure_mat = mat_cord("glove-lash-cord", (0.36, 0.27, 0.16))
    elif tier == 2:
        body_mat = mat_wood("glove-shimmeroak", (0.36, 0.19, 0.08), rough=0.40, grain_scale=22, grain_strength=0.22)
        cuff_mat = mat_sap("glove-sap-cuff", (0.58, 0.32, 0.05))
        loop_mat = body_mat
        closure_mat = mat_sap("glove-sap-seat", (0.62, 0.34, 0.05))
    else:
        body_mat = mat_wood("glove-starwillow", (0.70, 0.74, 0.60), rough=0.42, grain_scale=7, grain_strength=0.08)
        cuff_mat = body_mat
        loop_mat = body_mat
        closure_mat = mat_nacre("glove-nacre-seat")

    hand_parts, fz = build_hand()
    parts += hand_parts

    pad = outline_solid("pad", PAD_PTS, Z0, thickness=THICK)
    assign(pad, body_mat)
    parts.append(pad)

    cuff = outline_solid("cuff", CUFF_PTS, Z0 - 0.03, thickness=THICK * 0.9)
    assign(cuff, cuff_mat)
    parts.append(cuff)

    parts += build_sleeves(loop_mat, fz, glow=(tier == 3))

    if tier == 1:
        # visible lashing — two cord wraps across the neck, a small knot bead on one.
        # "Visible knots. A first attempt, and honest about it."
        for y in (-0.56, -0.74):
            wrap = add(bpy.ops.mesh.primitive_cylinder_add, vertices=10, radius=0.018,
                       depth=0.56, location=(0, y, Z0 + 0.01))
            wrap.rotation_euler = (0, math.radians(90), 0)
            assign(wrap, closure_mat)
            parts.append(wrap)
        knot = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=1, radius=0.035,
                   location=(0.27, -0.56, Z0 + 0.015))
        assign(knot, closure_mat)
        parts.append(knot)

    r = 0.085
    for (sx, sy) in SEAT_LAYOUT[seats]:
        parts += build_seat(sx, sy, Z0, r, tier, filled_tier0=True, closure_mat=closure_mat)

    return join_all(parts, active=pad)


def render_one(tier, seats):
    scene = fresh_scene()
    setup_light_and_cam(scene, ortho_scale=3.25, cam_loc=(0.30, -0.75, 3.4))
    obj = build_glove(tier, seats)
    path = os.path.join(OUT, f"glove-t{tier}-s{seats}.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"DONE {path}")


if __name__ == "__main__":
    for tier in (0, 1, 2, 3):
        seat_counts = (1,) if tier == 0 else (0, 1, 2, 3)   # the floor is always cut for one letter
        for seats in seat_counts:
            render_one(tier, seats)
