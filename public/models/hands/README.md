# Tier-0 casting glove — real-time hand mesh — DRAFT 4 (2026-09-16, play lane)

`glove-t0.glb` · objects `glove_fist` + `glove_open` · metres · origin at the WRIST centre ·
fingers −Z, back of hand +Y, thumb −X, sleeve +Z · vertex colours in `Col` (the rig replaces
the material with Lambert + vertex colours) · 1,802 / 1,744 tris.

- **Producer:** `tools/render/glove_t0_hand.py` (headless bpy, Blender 4.2). Review renders go
  to `tools/render/out/hands-draft4/` (gitignored) — never under `public/`.
  `RENDER_OUT=tools/render/out/hands-draft4 /opt/blender/blender -b -P tools/render/glove_t0_hand.py`
- **Ref:** `athernyx/CANON/design-briefs/refs/vessel-glove-t0-1.png` — the plump quilted work
  glove, strap across the hand, folded hem at the wrist. Card: `shimmer-casting-vessels.md`.

## Draft 4 — what changed and why

Alex, in-game on draft 3: *"the arm is looking like a hammer with the fingers all disfigured."*
Two causes, both fixed here:

1. **The file's frame was rotated 90°.** Drafts 1–3 built in the rig's frame (fingers −Z) and
   exported raw; Blender's glTF exporter maps Z-up → Y-up, so the file's fingers pointed along
   −Y. In-game the glove hung perpendicular off the end of the stick forearm box (which
   `hands.ts` never hid): a head on a handle. The producer now rotates the finished meshes +90°
   about X before export and the box forearm hides with the other stick parts.
2. **Tubes on a brick cannot read as a hand.** The palm was a beveled box, the fingers four
   swept cylinders, the fist curled its tips INTO the block. Now the hand is one skinned body —
   a vertex tree (sleeve → wrist → heel → knuckle row → four fingers, thumb as its own body rooted
   inside the palm) through the Skin modifier with per-joint radius pairs (wide/flat palm, round
   digits) and one subdivision. The palm is a padded loaf, the fingers are plump and touch at the
   base like the ref's, the fist is a single rounded mass, the sleeve is narrower than the hand.

Extras: folded hem just past the wrist (a shade darker), dark wrap across the hand where the
ref's strap crosses, the crude cloudy seat on the knuckle arc, centred. Past the hem the tree
wears a plain undyed sleeve colour (`SLEEVE`) — that is the keeper's tunic, not the glove.

## Open
- Alex judges in-game: fist at rest, open on a cast. Shape wrong → numbers in the producer.
- The card's family form is **open-fingered, back-of-hand** (`shimmer-casting-vessels.md` L132)
  while the ref tile is a closed glove the card itself calls "not shippable". This mesh follows
  the tile + Alex's draft-2 approval. If the fingers should be bare, that is a rebuild of the
  digits' colour + a back-of-hand panel, not a retune.
