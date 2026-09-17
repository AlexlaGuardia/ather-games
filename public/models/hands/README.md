# Tier-0 casting glove — real-time hand mesh — DRAFT 2

★ Coordinator moved draft 1's output out of `public/` (which must stay clean for builds) into
`tools/render/out/hands-draft1/`. This pass writes ONLY to `tools/render/out/hands-draft2/` —
nothing here has touched `public/` and it should not be copied there until approved.

- **Producer:** `tools/render/glove_t0_hand.py` (headless bpy, Blender 4.2, Cycles CPU).
  `RENDER_OUT=tools/render/out/hands-draft2 SAMPLES=32 RES=560 /opt/blender/blender -b -P tools/render/glove_t0_hand.py`
- **Contact sheet:** `tools/render/glove_t0_contact_sheet.py` (plain python3 + Pillow) — 2x4 grid
  of the 8 turntable frames, PLUS a 9th full-width row for the player-POV frame.
- **Output:** `glove-t0.glb`, `glove-t0-turntable.png` (9-frame review sheet),
  `turntable/player-pov.png` (the 9th frame on its own).

## Object names, tri counts — unchanged from draft 1

- `glove_fist` — 3,516 tris
- `glove_open` — 3,516 tris

(Both well under the 6,000 cap; topologically identical, only joint rotation differs.)

## Every dimension is a NUMBER from the coordinator's spec, not an adjective

| Part | Spec | Implementation |
|---|---|---|
| Palm length (wrist→knuckle) | 10cm | `PALM_LEN = 0.100` |
| Palm width, knuckle / wrist | 9cm / 7cm | `PALM_KNUCKLE_HALF_W=0.045`, `PALM_WRIST_HALF_W=0.035` |
| Palm thickness | 3.2cm | `PALM_THICK = 0.032` |
| Palm edge round | ≥1.2cm | `PALM_BEVEL = 0.012`, bevel segments=4 |
| Palm back dome | "slight" | a flattened ico-sphere bulge, `PALM_DOME_R=0.030`, height 0.006 |
| Finger lengths (idx/mid/ring/pinky) | 7.0/7.8/7.2/5.8cm | `FINGERS` table, exact |
| Finger diameter, base→tip | 2.0cm → 1.6cm | `FINGER_BASE_R=0.010`, `FINGER_TIP_R=0.008` |
| Finger segments | 3 each | `SEG_FRAC = (0.42, 0.32, 0.26)` |
| Knuckle spacing | 2.1cm centre-to-centre | `FINGER_SPACING = 0.021`, fingers at ±0.5×, ±1.5× |
| Open-pose splay | ≤8° from middle | per-finger azimuthal rotation about local Y (`rotate_y_deg`), index −6°, ring +5°, pinky +8° — a real measured angle, not an eyeballed offset |
| Thumb length / segments | 6cm, 2 segments | `THUMB_LEN=0.060`, `THUMB_FRAC=(0.55,0.45)` |
| Thumb diameter | 2.3cm | `THUMB_RB=0.0115` (tapers slightly to 0.0100 at the tip — see note below) |
| Thumb root | −X side, 3cm from wrist | `THUMB_Z=-0.030`; `THUMB_X` computed from the palm's own taper at that z, minus a hair, so the mesh overlaps the palm (no floating-thumb bug from draft 1) |
| Thumb angle, open | 45° "out" + 20° "forward" | one measured direction, `THUMB_OPEN_DIR`, applied straight (both segments) — see interpretation note |
| Fist joints (MCP/PIP/DIP) | 85° / 95° / 50° | `FIST_PHI = (85, 180, 230)` — this rig's cumulative-angle convention, so MCP=85, MCP+PIP=180, MCP+PIP+DIP=230, exactly the given values, not re-interpreted |
| Fist enclosure | fingertips touch palm, 3cm shaft enclosed | logged at build time: `FIST fingertip envelope: x[-0.032,0.032] y[-0.013,-0.009] z[-0.074,-0.065]` against a palm surface at y∈[-0.016,0.016] — fingertips sit right at the palm surface |
| Cuff | 8.5cm outer Ø, "1cm thick", 1.5cm tall | squat cylinder (NOT a torus — see the mushroom-cap fix below), `CUFF_OUTER_R=0.0425` = forearm radius (`0.0375`) + 0.5cm, `CUFF_TALL=0.015` — "1cm thick" read as the 1cm difference between the 8.5cm cuff and the 7.5cm forearm it sits on (self-consistent both ways) |
| Strap | 2cm wide × 0.4cm thick, dark brown, just distal of the cuff | squat cylinder, `STRAP_OUTER_R = FOREARM_R+0.004`, `STRAP_WIDE=0.020`, `STRAP_Z=0.014` (closer to the hand than `CUFF_Z=0.045`) |
| Seat | 1.2cm, 2cm distal of the strap | `SEAT_R=0.006`, `SEAT_Z = STRAP_Z - 0.020` |
| Forearm stub | 8cm, 7.5cm diameter | `FOREARM_LEN=0.080`, `FOREARM_R=0.0375` |

## The three named failures from draft 1 — what actually changed

1. **"Five thin tentacles on a flat slab"** → fingers are now 2.0cm base diameter (was 1.7cm),
   the palm has a real bevel (≥1.2cm, was ~0.4cm) and a back-dome instead of flat top/bottom
   faces, and the seam ridge — which in draft 1 was a hardcoded straight line, one of the real
   bugs that made it read as a diagram — still rides the exact curl each finger uses (carried
   over from draft 1's fix), now on visibly puffier geometry so it actually reads as a stitched
   oven-mitt finger rather than a rod with a scratch on it.
2. **"Fist is a jumble of pegs"** → fist geometry is now driven by the coordinator's own
   anatomical MCP/PIP/DIP numbers instead of eyeballed cumulative angles, and the finger splay
   is OFF in the fist (draft 1 had a lingering diagonal convergence factor that read as
   scattered rather than parallel-and-curled). `glove-fist-palm.png` now shows four bunched,
   parallel curled fingers — the read the spec asked for.
3. **"Cuff is a mushroom cap"** → the cuff was a torus (a donut) with a minor radius comparable
   to the forearm's own radius — inherently reads as a bulbous cap sitting on a stick. It is now
   a squat CYLINDER sized directly off the two diameters in the spec (8.5cm outer vs 7.5cm
   forearm), which is a ring, not a poof. It's also recoloured lit-cloth (was cloth-shadow, the
   same tone as the forearm underneath it) so it reads as a distinct band rather than blending
   into one shapeless mass — a real bug caught by looking, not by the spec.

## The 9th frame — player POV

`turntable/player-pov.png`, built exactly as specified: camera fixed at world origin, default
orientation (Blender's default camera looks down world −Z with +Y up — no rotation needed to hit
"looking down −Z"), `sensor_fit='VERTICAL'`, `angle_y = 75°`. The hand sits at
`(0.32, -0.20, -0.50)` with its local −Z (fingers) aimed along the given relative vector
`(-0.14, 0.27, -0.16)`.

**Two real bugs found by looking at this frame, both fixed:**

1. **First render: a big pale blob with tiny finger nubs, unreadable.** `to_track_quat('-Z','Y')`
   is degenerate here — the given aim direction is 79% world +Y (this rest pose has the forearm
   "rising steeply into frame," per `hands.ts`'s own comment on this exact transform), so asking
   the solver to ALSO keep local +Y close to world +Y left the roll about the aim axis almost
   unconstrained, and it happened to point the palm/cuff face-on at the lens. Fixed by building
   the basis directly: local +Y (back of hand) leans toward the CAMERA as much as the fixed aim
   direction allows, instead of toward world up — which is what the real rig's own `roll` value
   is FOR ("turn the back of the glove toward the lens"), just computed instead of hand-tuned.
   ⚠ This changed nothing about the visible silhouette, because the dominant shape at that angle
   (the forearm/cuff end, closest to camera and therefore biggest by perspective) is close to
   rotationally symmetric — rolling it around its own axis doesn't change its outline much. The
   actual fix that mattered was #2.
2. **Even after the roll fix, the FIST pose still read poorly** — a closed fist balls up small,
   and at this specific rest angle the near, large forearm/cuff crowds out the small far hand
   entirely. Switched the 9th frame to the OPEN pose (`POV_POSE=open` is now the default): the
   spread fingers and thumb give it enough silhouette area to read as "a gloved hand" at a
   glance. Both poses still ship in the `.glb`; this is a choice about which one makes the BEST
   static reference render at a fixed, foreshortened angle, not a change to either mesh.

Judge call after both fixes: it reads as a hand — five fingers, thumb, strap, cuff — holding
position in the lower-right, exactly the shape the note asked for. It is still a foreshortened,
partial view (the coordinator's own numbers put the forearm/cuff closest to the lens and
biggest by perspective) — the same framing `hands.ts` itself describes ("the forearm rises
steeply into the frame, foreshortened").

## Interpretation calls (spec didn't give an axis convention for these)

- **Thumb "45° out / 20° forward" (open pose):** read as an elevation (45°, off the palm plane
  toward the back-of-hand side) and an azimuth (20°, toward the fingers) applied as ONE direction
  to both thumb segments (the open thumb is straight — the spec gave one angle pair, not two).
- **Thumb "lies across the curled index+middle" (fist pose):** no angles were given for this one.
  First cut swung it toward the DORSAL side (+Y) and it landed buried near the back of the palm,
  invisible from the palm-view render — a real bug caught by looking, not a matter of taste.
  Fixed by swinging it toward the PALM-facing front (−Y) instead, which is what "across the
  curled fingers" has to mean if it's meant to be visible at all; `glove-fist-palm.png` now shows
  it clearly alongside the index finger.
- **Cuff wall "thickness":** read as the diameter difference between the cuff (8.5cm) and the
  forearm stub it sits on (7.5cm) — the two numbers are self-consistent under that reading
  (0.5cm proud all round = "1cm thicker" in diameter), so it isn't a free interpretation, just
  the one that made both given numbers agree.

## Fixed from draft 1, still true here (not re-litigated)

Real scale in metres, origin at the wrist centre, fingers along −Z, back of hand +Y, thumb on
−X — unchanged, and still matches `hands.ts`'s own local frame (read L1-60, L178-228 before
touching the rig side). One shared material (`glove_t0_cloth`, Metallic 0.0), vertex-colour only,
nothing external — verified again on this GLB (`images: None`, no buffer `uri`). No metal
anywhere. Seat is a flush cabochon (never a bezel/rim/socket, per the vessel family law).

## Not covered here (rig side / Jin's call, unchanged)

Whether/how the fist↔open swap is driven by `HandsState`, and how the loaded mesh gets parented
under `armPivot`/`arm`. This producer only guarantees the two named pose objects exist, at the
right scale/origin/axes, in one file — it does not touch `hands.ts`, `hands-pose.ts`, or any
GLTFLoader wiring, and nothing here has been copied into `public/`.
