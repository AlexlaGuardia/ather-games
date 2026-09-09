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
    build_woven_ring,
)

OUT = os.environ.get("RENDER_OUT", "/tmp/vessel_frames")
os.makedirs(OUT, exist_ok=True)

R = 0.82          # ring major radius
SCALE_Z = 0.34    # flatten the torus — reads as a flat braid-band icon, matches the glove's flat read
SEAT_R = 0.086


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
    seat_angles = SEAT_ANGLES[seats]

    if tier == 0:
        # "a plain wrapped cord" — ONE strand, no interleave, but still gapped at the seat so
        # the seat is an interruption in the cord, not a patch glued over an unbroken loop.
        ring_mat = mat_cord("bracelet-cord0", (0.55, 0.53, 0.50))  # greyed with age
        closure_mat = None
        strand_r = 0.022
        top_z = strand_r * SCALE_Z
        parts += build_woven_ring(R, strand_r, seat_angles, ring_mat, seat_r=SEAT_R, n_strands=1,
                                   name_prefix="bracelet-t0")
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
        # a real two-strand braid — "warm golden discs strung on plain cord" still reads: the
        # beads thread ONTO the woven cord, they don't replace the weave.
        ring_mat = mat_cord("bracelet-cord1", (0.42, 0.31, 0.19))
        closure_mat = ring_mat
        strand_r = 0.021
        top_z = strand_r * SCALE_Z
        parts += build_woven_ring(R, strand_r, seat_angles, ring_mat, seat_r=SEAT_R, n_strands=2,
                                   name_prefix="bracelet-t1")
        bead_mat = mat_wood("bracelet-goldwood-bead", (0.72, 0.50, 0.15), rough=0.5, grain_scale=16)
        # ⚠ THESE ARE DECORATION AND MUST NEVER BE COUNTABLE AS SEATS (fixed 2026-09-09, play lane).
        # They were radius 0.075 against a seat's SEAT_R 0.086 — same disc, same axis, same size,
        # differing only in colour. On a ONE-seat bracelet that renders three seat-shaped discs, and
        # the single job this silhouette has is "a player reads how loaded a keeper is from across
        # the square". A decoration indistinguishable from a seat does not merely fail to help, it
        # reports a fill level the vessel does not have — the same defect as the panel's hardcoded
        # three seats, in geometry instead of in a map. Kept (the tier IS the material, and goldwood
        # is what says tier 1) but sized so they cannot be mistaken for a seat at panel scale.
        bead_r = SEAT_R * 0.42
        for ang in (-90 - 55, -90 + 55):
            bx, by, bz = ring_point(ang, R, top_z)
            bead = add(bpy.ops.mesh.primitive_cylinder_add, vertices=16, radius=bead_r, depth=0.05,
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
        strand_r = 0.030
        top_z = strand_r * SCALE_Z
        parts += build_woven_ring(R, strand_r, seat_angles, ring_mat, seat_r=SEAT_R, n_strands=2,
                                   name_prefix="bracelet-t2")

    else:
        ring_mat = mat_nacre("bracelet-pearlshell")
        closure_mat = mat_nacre("bracelet-nacre-seat")
        strand_r = 0.029
        top_z = strand_r * SCALE_Z
        parts += build_woven_ring(R, strand_r, seat_angles, ring_mat, seat_r=SEAT_R, n_strands=2,
                                   name_prefix="bracelet-t3")
        # silver-thread (moonvine fibre) peeking from the inner edge of the pearlshell band —
        # ⚠ matte, non-metallic on purpose; see mat_silverthread's own note on the reflex risk
        thread = build_ring(0.016, mat_silverthread("bracelet-silverthread"), major=R - strand_r * 2.2)
        thread.location.z = -0.01
        parts.append(thread)

    for ang in seat_angles:
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
