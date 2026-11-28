# M244 sheet 9: Luminix's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Named, the Luminara line' ('Luminix (Water): Lumixok · Marisse (Virtuoso, pure) · Lumixis · Lumixeth')
+ 'Luminore and Luminix lose their flight': the second form is the waiting egg, **the awakening is the break-out**. Art LOCKED athernyx
assets/stage3/045-048 (PRIVATE, read for shape + colour, never copied here). Gallery rows #079-#082, not in PUBLIC_FORMS. `line-sheet.jpg` =
OUR renders only (the Luminix egg + the four at true relative size, three-quarter idle over run). Private comparison against the locked art:
/root/athernyx/assets/stage3/sheets/m244-luminix-awakened-vs-locked.jpg.

Built exactly like sheet 7 (Luminore, ../m244-luminore-2026-11-28): each is the LIVE Luminix egg's sculpt (m202-luminara-line
tools/sculpt_luminix.py, imported, never edited: the teal water body paler down the front, the crown fin, the swirls and bubbles, dark teal
eyes, the pale belly lamp) re-shaped by name in `tools/sculpt_lumix.py` into what broke out of the shell: up on two LEGS with two ARMS, the
plate seams + hatch line gone. Rigged by `tools/rig_lumix.py` (sheet 7's ground biped rig). Glow = her own body: no lantern, no sigil, no lure.

Sheet 7's doubts, fixed where cheap:
- **hands**: a fist with three finger stubs (Lumixok, Lumixis), or a flat flipper (Marisse, Lumixeth, as in the art).
- **the shell stays put**: what lies on the ground (shell halves / Lumixok's wave) rides a GROUND bone (child of the root at y = 0) that folds
  to 0.02 in walk + run, so it is not dragged along with her; it lies where she hatched in idle / sit / lie. (It does not stay behind in the
  WORLD when she walks off: it is gone while she moves and back when she stops. A true world-placed shell is a game-side prop, not a glb.)
- **height**: dials 1.95-2.1 (Luminore's four were 1.75-1.8 and read ~0.86 m next to the keeper).

| form | dial | silhouette | motif (aura) |
|---|---|---|---|
| Lumixok (Champion) | 2.1 | broad armoured brute: shell pauldrons with spikes, knee guards, a rim round her lamp, big clawed hands, wide stance, a ROARING fanged mouth, angry brows, flat crown fin + ear fins | a curling WAVE rising behind her (lip + foam), spray flying round her (chest) |
| Marisse (Virtuoso, pure) | 1.95 | soft and round, smiling, flippers out (one waving), her body dotted with clear lights | bubbles rising round her (head), the two shell halves at her feet |
| Lumixis (Ace) | 2.0 | the lean dart racer: slim body, long legs + arms, clawed fingers, a longer snout, big swept crown fin + ear fins, a finned TAIL, a sly grin | a splash kicked up behind her heels (on the root: stays in every clip) |
| Lumixeth (Enigma) | 1.95 | round and calm, small smile, little flippers | 18 long TENDRILS falling from her crown to the ground, curling at the tips (head) |

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_lumix.py <form> ../<form>.glb && $P rig_lumix.py <form>; cp ../<form>-rigged.glb ../../../../public/open/spirits/
/opt/blender/blender -b -P render_lum.py -- <rigged.glb> <dir>/<form>-three.png idle:0 three <4.2/dial> <1.05/dial>   (run:.3 -> -run.png)
python3 sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
## Known (for Alex)
The wave / spray / splash / tendrils are rigid on their bones (no flow, no sway); the shell / wave pops away while she moves (scaled into the
ground bone); Lumixis's splash reads a little like spiky grass at gallery size; Marisse's "clear lights" are small bright dots (unlit, not
emissive) on top of the egg's bubbles. Player-facing text: none (gallery rows show canon names only).
