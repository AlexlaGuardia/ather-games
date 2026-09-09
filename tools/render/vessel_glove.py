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
    mat_shimmerscale, mat_void, assign, add, join_all, outline_solid, build_seat, tapered_digit,
)

OUT = os.environ.get("RENDER_OUT", "/tmp/vessel_frames")
os.makedirs(OUT, exist_ok=True)

Z0 = 0.09      # pad top surface
THICK = 0.085

# ★ FIX 2026-09-09 (picaso, self-critique pass): the play lane read the first pad as "a foot or
# a paw" — it was widest through the MIDDLE (an oval/leaf), so nothing in the silhouette actually
# said "hand". Redrawn as a real taper: WIDE across the knuckle line (high y, where the fingers
# root) narrowing steadily to the wrist-neck (low y, where the cuff starts) — the first of the
# brief's own three cues (taper / thumb leaves the outline / finger gaps).
PAD_PTS = [
    (-0.20, -0.95), (0.20, -0.95),
    (0.30, -0.78), (0.36, -0.52),
    (0.42, -0.22), (0.46, 0.08),
    (0.48, 0.32), (0.42, 0.50),
    (0.24, 0.58), (0.0, 0.60), (-0.24, 0.58),
    (-0.42, 0.50), (-0.48, 0.32),
    (-0.46, 0.08), (-0.42, -0.22),
    (-0.36, -0.52), (-0.30, -0.78),
]
# a wristband cuff flaring below the pad's own narrow neck (matched to the new 0.20 neck width,
# not the old 0.40 — "cuffing a little past the wrist-bone")
CUFF_PTS = [
    (-0.20, -0.94), (0.20, -0.94),
    (0.28, -1.08), (0.26, -1.26),
    (0.16, -1.38), (0.0, -1.42), (-0.16, -1.38),
    (-0.26, -1.26), (-0.28, -1.08),
]

# ★ FIX: fingers were open-hole tori (a curtain-ring read under a near-top-down camera). Now
# hand-authored base -> tip pairs for solid tapered digits (tapered_digit sweeps a cone between
# them) — base sits INSET into the pad silhouette (so the join is hidden, not a floating seam),
# tip sits beyond the pad edge with a slight z-lift for an open, springy curl. Outer two shorter,
# inner two longer — the knuckle-line stagger a real hand (and the SVG placeholder) both show.
# Each entry: (base_x, base_y, tip_x, tip_y, tip_z, r_base, r_tip)
FINGERS = [
    (-0.33, 0.46, -0.40, 0.62, Z0 + 0.035, 0.058, 0.036),
    (-0.11, 0.52, -0.13, 0.74, Z0 + 0.035, 0.060, 0.037),
    (0.11, 0.52, 0.13, 0.74, Z0 + 0.035, 0.060, 0.037),
    (0.33, 0.46, 0.40, 0.62, Z0 + 0.035, 0.058, 0.036),
]
# the thumb, angled off the pad's WRIST-side edge so its base is clearly a separate root from
# the fingers and its tip clears the silhouette by a wide margin — "the thumb leaves the outline"
THUMB = (-0.40, -0.28, -0.66, -0.58, Z0 + 0.03, 0.068, 0.040)

SEAT_LAYOUT = {
    1: [(0.0, 0.36)],
    2: [(-0.14, 0.34), (0.14, 0.34)],
    3: [(-0.24, 0.30), (0.0, 0.40), (0.24, 0.30)],
}


def build_finger_loops(body_mat, glow=False):
    """★ FIX 2026-09-09: solid tapered digits (tapered_digit), not tori. Fingertips get the
    tier-3 glow material; the thumb stays body_mat even when glow=True — canon names the
    resting light at "the fingertips" specifically, not the whole hand."""
    parts = []
    tip_mat = body_mat
    if glow:
        tip_mat = bpy.data.materials.new("starwillow-tip-glow")
        tip_mat.use_nodes = True
        b = tip_mat.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (0.86, 0.90, 0.78, 1)
        b.inputs["Metallic"].default_value = 0.0
        b.inputs["Roughness"].default_value = 0.4
        b.inputs["Emission Color"].default_value = (0.80, 0.92, 0.62, 1)
        b.inputs["Emission Strength"].default_value = 1.8  # ★ FIX: 0.9 didn't read against the key
        # light in the first pass — bumped so the "never fully dark" exception is actually visible,
        # still well under a channelling bloom (no glare/compositor bloom added — see build note)

    for (bx, by, tx, ty, tz, rb, rt) in FINGERS:
        finger_parts = tapered_digit(f"finger-{bx:.2f}", (bx, by, Z0 + 0.02), (tx, ty, tz), rb, rt, body_mat)
        if glow:
            assign(finger_parts[-1], tip_mat)  # only the rounded tip cap glows, not the shaft
        parts += finger_parts

    tbx, tby, ttx, tty, ttz, trb, trt = THUMB
    parts += tapered_digit("thumb", (tbx, tby, Z0 + 0.02), (ttx, tty, ttz), trb, trt, body_mat)
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

    r = 0.085
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
