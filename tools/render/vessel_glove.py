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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vessel_common import (
    fresh_scene, setup_light_and_cam, mat_cloth, mat_wood, mat_cord, mat_sap, mat_nacre,
    mat_shimmerscale, mat_void, assign, add, join_all, outline_solid, build_seat,
)

OUT = os.environ.get("RENDER_OUT", "/tmp/vessel_frames")
os.makedirs(OUT, exist_ok=True)

Z0 = 0.09      # pad top surface
THICK = 0.085

# the reference silhouette (Greg's / tier-0 IS this shape — brief: "design the Worn set first,
# every tiered focus is a variation on it"). A rounded shield tapering to a narrow wrist-neck.
PAD_PTS = [
    (-0.22, -0.98), (0.22, -0.98),
    (0.36, -0.86), (0.50, -0.58),
    (0.58, -0.16), (0.55, 0.20),
    (0.42, 0.48), (0.20, 0.58),
    (-0.20, 0.58), (-0.42, 0.48),
    (-0.55, 0.20), (-0.58, -0.16),
    (-0.50, -0.58), (-0.36, -0.86),
]
# a wristband cuff flaring below the pad's narrow neck ("cuffing a little past the wrist-bone")
CUFF_PTS = [
    (-0.40, -0.96), (0.40, -0.96),
    (0.46, -1.10), (0.44, -1.28),
    (0.30, -1.40), (0.0, -1.44), (-0.30, -1.40),
    (-0.44, -1.28), (-0.46, -1.10),
]

FINGER_X = (-0.27, -0.09, 0.09, 0.27)
THUMB_LOC = (-0.70, -0.28, Z0 + 0.02)

SEAT_LAYOUT = {
    1: [(0.0, 0.40)],
    2: [(-0.14, 0.38), (0.14, 0.38)],
    3: [(-0.24, 0.34), (0.0, 0.44), (0.24, 0.34)],
}


def build_finger_loops(body_mat, glow=False):
    parts = []
    for x in FINGER_X:
        t = add(bpy.ops.mesh.primitive_torus_add, major_radius=0.115, minor_radius=0.030,
                location=(x, 0.60, Z0 + 0.02), major_segments=20, minor_segments=10)
        t.rotation_euler = (math.radians(8), 0, 0)  # a small forward tilt — open, not flat-stamped
        assign(t, body_mat)
        parts.append(t)
    thumb = add(bpy.ops.mesh.primitive_torus_add, major_radius=0.135, minor_radius=0.033,
                location=THUMB_LOC, major_segments=20, minor_segments=10)
    thumb.rotation_euler = (math.radians(-14), math.radians(18), math.radians(28))
    assign(thumb, body_mat)
    parts.append(thumb)
    if glow:
        gm = bpy.data.materials.new("starwillow-tip-glow")
        gm.use_nodes = True
        b = gm.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (0.86, 0.90, 0.78, 1)
        b.inputs["Metallic"].default_value = 0.0
        b.inputs["Roughness"].default_value = 0.4
        b.inputs["Emission Color"].default_value = (0.80, 0.92, 0.62, 1)
        b.inputs["Emission Strength"].default_value = 0.9  # a RESTING glow, not a cast-bloom
        for p in parts:
            assign(p, gm)
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

    pad = outline_solid("pad", PAD_PTS, Z0, thickness=THICK)
    assign(pad, body_mat)
    parts.append(pad)

    cuff = outline_solid("cuff", CUFF_PTS, Z0 - 0.012, thickness=THICK * 0.85)
    assign(cuff, cuff_mat)
    parts.append(cuff)

    parts += build_finger_loops(loop_mat, glow=(tier == 3))

    if tier == 1:
        # visible lashing — two cord wraps across the neck, a small knot bead on one.
        # "Visible knots. A first attempt, and honest about it."
        for y in (-0.62, -0.80):
            wrap = add(bpy.ops.mesh.primitive_cylinder_add, vertices=10, radius=0.018,
                       depth=0.60, location=(0, y, Z0 + 0.01))
            wrap.rotation_euler = (0, math.radians(90), 0)
            assign(wrap, closure_mat)
            parts.append(wrap)
        knot = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=1, radius=0.035,
                   location=(0.29, -0.62, Z0 + 0.015))
        assign(knot, closure_mat)
        parts.append(knot)

    r = 0.075
    for (sx, sy) in SEAT_LAYOUT[seats]:
        parts += build_seat(sx, sy, Z0, r, tier, filled_tier0=True, closure_mat=closure_mat)

    return join_all(parts, active=pad)


def render_one(tier, seats):
    scene = fresh_scene()
    setup_light_and_cam(scene, ortho_scale=2.55, cam_loc=(0.30, -0.75, 3.4))
    obj = build_glove(tier, seats)
    path = os.path.join(OUT, f"glove-t{tier}-s{seats}.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"DONE {path}")


if __name__ == "__main__":
    for tier in (0, 1, 2, 3):
        seat_counts = (1,) if tier == 0 else (1, 2, 3)
        for seats in seat_counts:
            render_one(tier, seats)
