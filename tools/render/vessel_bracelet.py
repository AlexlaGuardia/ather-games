# ── THE CASTING BRACELET — Shimmer casting vessel, render-to-sprite ───────────────────────────
# Worn at the wrist of the off hand — the tacticals. Built against the LOCKED brief:
#   /root/athernyx/CANON/design-briefs/shimmer-casting-vessels.md (RULED 2026-09-03, amended 09-04/05)
#
# "The bracelet can vary in look" (Alex, 2026-09-03) — braid pattern, wrap count, bead count and
# arrangement are free; the TIER still reads off the MATERIAL alone. Never a torc, chain, band,
# or cuff (barred, collar-family) and never at the neck.
#
# DORMANT state only — no glow anywhere on this family (unlike the glove, no tier-3 exception is
# named for the bracelet in the brief; its resting state stays fully dark).
#
# Renders TIER (0-3) x SEATS (1-3; tier 0 pinned to 1, same law as the glove).
#
# Run:  RENDER_OUT=/tmp/vessels /opt/blender/blender -b -P tools/render/vessel_bracelet.py
# Out:  $RENDER_OUT/bracelet-t{TIER}-s{SEATS}.png
import bpy, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vessel_common import (
    fresh_scene, setup_light_and_cam, mat_cloth, mat_wood, mat_cord, mat_sap, mat_nacre,
    mat_shimmerscale, mat_silverthread, mat_void, assign, add, join_all, build_seat,
)

OUT = os.environ.get("RENDER_OUT", "/tmp/vessel_frames")
os.makedirs(OUT, exist_ok=True)

R = 0.82          # ring major radius
SCALE_Z = 0.34    # flatten the torus — reads as a flat braid-band icon, matches the glove's flat read
SEAT_R = 0.078


def ring_point(angle_deg, radius=R, z=0.0):
    a = math.radians(angle_deg)
    return (radius * math.cos(a), radius * math.sin(a), z)


SEAT_ANGLES = {
    1: [-90],
    2: [-110, -70],
    3: [-124, -90, -56],
}


def build_ring(minor, mat, major=R):
    t = add(bpy.ops.mesh.primitive_torus_add, major_radius=major, minor_radius=minor,
            major_segments=48, minor_segments=14, location=(0, 0, 0))
    t.scale = (1, 1, SCALE_Z)
    assign(t, mat)
    return t


def build_bracelet(tier, seats):
    parts = []

    if tier == 0:
        ring_mat = mat_cord("bracelet-cord0", (0.55, 0.53, 0.50))  # greyed with age
        closure_mat = None
        minor = 0.040
        top_z = minor * SCALE_Z
        ring = build_ring(minor, ring_mat)
        parts.append(ring)
        # the adjustable slip-knot tie — top of the ring, opposite the seat
        kx, ky, kz = ring_point(90, R, top_z)
        knot = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=1, radius=0.05, location=(kx, ky, kz + 0.02))
        assign(knot, ring_mat)
        parts.append(knot)
        tail = add(bpy.ops.mesh.primitive_cylinder_add, vertices=8, radius=0.014, depth=0.18,
                   location=(kx, ky - 0.10, kz + 0.02))
        tail.rotation_euler = (math.radians(90), 0, 0)
        assign(tail, ring_mat)
        parts.append(tail)

    elif tier == 1:
        ring_mat = mat_cord("bracelet-cord1", (0.42, 0.31, 0.19))
        closure_mat = ring_mat
        minor = 0.042
        top_z = minor * SCALE_Z
        ring = build_ring(minor, ring_mat)
        parts.append(ring)
        bead_mat = mat_wood("bracelet-goldwood-bead", (0.72, 0.50, 0.15), rough=0.5, grain_scale=16)
        for ang in (-90 - 55, -90 + 55):
            bx, by, bz = ring_point(ang, R, top_z)
            bead = add(bpy.ops.mesh.primitive_cylinder_add, vertices=16, radius=0.075, depth=0.05,
                       location=(bx, by, bz + 0.02))
            bead.rotation_euler = (0, 0, math.radians(ang))
            assign(bead, bead_mat)
            parts.append(bead)
        kx, ky, kz = ring_point(90, R, top_z)
        knot = add(bpy.ops.mesh.primitive_ico_sphere_add, subdivisions=1, radius=0.045, location=(kx, ky, kz + 0.018))
        assign(knot, ring_mat)
        parts.append(knot)

    elif tier == 2:
        ring_mat = mat_shimmerscale("bracelet-shimmerscale")
        closure_mat = mat_sap("bracelet-sap-seat", (0.60, 0.33, 0.05))
        minor = 0.060
        top_z = minor * SCALE_Z
        ring = build_ring(minor, ring_mat)
        parts.append(ring)

    else:
        ring_mat = mat_nacre("bracelet-pearlshell")
        closure_mat = mat_nacre("bracelet-nacre-seat")
        minor = 0.058
        top_z = minor * SCALE_Z
        ring = build_ring(minor, ring_mat)
        parts.append(ring)
        # silver-thread (moonvine fibre) peeking from the inner edge of the pearlshell band —
        # ⚠ matte, non-metallic on purpose; see mat_silverthread's own note on the reflex risk
        thread = build_ring(0.016, mat_silverthread("bracelet-silverthread"), major=R - minor * 0.75)
        thread.location.z = -0.01
        parts.append(thread)

    for ang in SEAT_ANGLES[seats]:
        sx, sy, sz = ring_point(ang, R, top_z)
        parts += build_seat(sx, sy, sz, SEAT_R, tier, filled_tier0=True, closure_mat=closure_mat)

    return join_all(parts, active=parts[0])


def render_one(tier, seats):
    scene = fresh_scene()
    setup_light_and_cam(scene, ortho_scale=2.35, cam_loc=(0.20, -0.55, 3.4))
    obj = build_bracelet(tier, seats)
    path = os.path.join(OUT, f"bracelet-t{tier}-s{seats}.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"DONE {path}")


if __name__ == "__main__":
    for tier in (0, 1, 2, 3):
        seat_counts = (1,) if tier == 0 else (1, 2, 3)
        for seats in seat_counts:
            render_one(tier, seats)
