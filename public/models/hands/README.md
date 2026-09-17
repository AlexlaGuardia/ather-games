# Tier-0 casting glove — real-time hand mesh — DRAFT 3

Draft 2 shipped to `public/` for Alex to judge in-game (palm/cuff/strap/POV frame approved).
This pass is the ONE remaining fix asked for before then — everything else is unchanged from
draft 2 (same numeric spec, same object names, same axis convention). Written ONLY to
`tools/render/out/hands-draft3/`; `public/` still holds draft 2's files, untouched by this pass.

- **Producer:** `tools/render/glove_t0_hand.py` (headless bpy, Blender 4.2, Cycles CPU).
  `RENDER_OUT=tools/render/out/hands-draft3 SAMPLES=32 RES=560 /opt/blender/blender -b -P tools/render/glove_t0_hand.py`
- **Contact sheet:** `tools/render/glove_t0_contact_sheet.py` (unchanged from draft 2) — 2x4
  grid + the player-pov row.
- **Output:** `glove-t0.glb`, `glove-t0-turntable.png` (9-frame review sheet),
  `turntable/player-pov.png`.

## Tri counts — DOWN, not up (the tube approach is cheaper, not more expensive)

- `glove_fist`: 2,260 tris
- `glove_open`: 2,260 tris

(Down from draft 2's 3,516 — replacing 3 separate beveled-capsule segments + 3 end-caps per
finger with ONE curve-swept tube + 1 end-cap actually removed geometry. There was no need to
lower bevel resolution to stay under 6,000 — there's ~3,700 tris of headroom left per mesh.)

## The fix: one continuous tube per finger/thumb, not a stack of capsules

Draft 2 built each phalanx as its own beveled cone with its own rounded cap, then butted the
next segment's own rounded base against it. Two independently-rounded ends meeting always shows
a waist/pinch at the joint, no matter how good the bend angle is — that's the "bamboo" read.

Fixed in `make_tapered_tube()`: each finger and the thumb is now a single Blender **curve**
(POLY spline, not Bezier — see the note below) run through the exact same joint points
`finger_chain()`/`thumb_chain()` already computed, with a per-point `radius` (2.0cm→1.6cm on the
fingers, matching the taper spec exactly) and ONE `bevel_depth`/`bevel_resolution` swept along
the whole path, then converted to a mesh. A curve's bevel is one continuous surface — a bend
reads as a bend, never a seam. Only ONE end-cap sphere is added, at the true fingertip, for the
"round tip (capsule end)" requirement — not one at every joint.

**POLY, not Bezier, and here's why:** a freshly-created Bezier point's handles default to
zero-length (coincident with the point itself) unless explicitly positioned — setting
`handle_left_type = 'VECTOR'` alone does NOT recompute the handle position via the data API (that
recompute only happens through the "Set Handle Type" operator in edit mode). Shipping that would
have produced a degenerate/undefined tangent at every joint. A POLY spline has no handles to get
wrong — it's a plain piecewise-linear path between the joint points, which is what we want
anyway: a knuckle is a crisp bend, not a smoothed-over curve, and the joint angles already come
straight from the coordinator's own MCP/PIP/DIP numbers, not from a curve fit.

The seam ridge is the same fix, one order simpler: `_seam_offset_points()` builds ONE offset
path (a point per joint, each pushed out along the finger's own local outward normal, with the
incoming/outgoing segment directions averaged at interior joints so the normal itself doesn't
kink) and that whole path goes through the same tube builder — so the seam is also one
continuous ridge, not three separately-aimed straight segments.

## The other fix: the back-dome bulged through to the palm side too

Not asked for by name in the numeric spec, but caught by looking at draft 2's palm-view
renders and named directly in this round's brief ("kill the oval 'pad' on the palm side — the
ref shows plain cloth"). Root cause: the dome sphere's centre/scale math in draft 2 solved for
"apex height = `PALM_Y_TOP + PALM_DOME_HEIGHT`" using the UNSCALED radius, then applied the Y
scale afterward — so the actual post-scale sphere spanned roughly `y ∈ [-0.021, +0.005]`, almost
entirely on the **palm** (−Y) side, and barely reached the back surface at all.

Fixed by pinning the geometry instead of solving for it: the dome's floor sits exactly at
`PALM_Y_TOP` (the back surface itself) and it only rises `PALM_DOME_HEIGHT` (6mm) above that —
its lowest point can never cross to −Y because the floor IS the surface, not a derived value.
Confirmed in `glove-{fist,open}-palm.png`: plain cloth, no bulge, exactly as the ref shows.

## Unchanged from draft 2 (not re-litigated)

Every dimension in the numeric spec table (palm 10×9/7×3.2cm, finger lengths/diameters/spacing,
thumb length/diameter/root/angles, fist MCP/PIP/DIP 85/95/50 → cumulative 85/180/230, cuff/strap/
seat/forearm sizes) — see draft 2's README for the full table, none of it moved. Object names
(`glove_fist`/`glove_open`), one shared material (`glove_t0_cloth`, Metallic 0.0, vertex-colour
only, no external files — re-verified: `images: None`, no buffer `uri`), real-scale metres,
origin at the wrist, axis convention (−Z fingers, +Y back of hand, −X thumb), the 9th player-POV
frame (same camera/hand transform, open pose — still reads clearly as a gloved hand holding
position in the corner of frame, now with smooth finger tubes instead of segmented ones).
