# M202 the Luminara line: LUMINEL, LUMINARC, LUMINORE, LUMINIX (2026-11-28). OWNER PREVIEW only (`?form=mana|storm|earth|water` on a bloomed Luminara).
**`line-sheet.jpg`** is the one sheet: per form front | three-quarter | side | face, then the base Luminara + the four at TRUE relative size (no tint).
Ref-free (the repo is public); locked art = athernyx assets/stage2 010 / 029 / 030 / 031; the PRIVATE art-vs-model sheet is athernyx
assets/stage2/sheets/m202-luminara-vs-locked.jpg.

## Built off the base, by name (base Luminara 3c589cdb, public since M226)
Every form = the base's own sculpt module (`m174-luminara-2026-11-27/tools/sculpt_luminara.py`, loaded fresh, never edited) re-shaped in
`tools/sculpt_<form>.py` (head / abdomen / thorax / arms / legs landmarks + field terms, colours, colour classes, wings, eye palette) plus her
own parts (`deco()`: crystals, infusion markings, lightning, moss, bubbles) on the UNLIT eyes part (living light: they glow), and the base's own
rig (`rig_luminara.py`, read and run by `tools/rig_lum.py`): 19 bones, the base's five hover clips (idle hover / walk drift / run dart / sit settled
/ lie asleep in the air), b_hover unkeyed, in the BASE's unit (0.3438 m per glb unit), so the game draws the base's h x her dial (1.5) and she
hangs at the base's hover x 1.5 (~1.35 m). Deco parts are skinned to the nearest body vertex. In game: `spirit-models.ts` `lumForm` off
`BASE_PREVIEW.firefly` (own glbLen, hover low/top, culling from her metrics; her own lamp emissive); NOT in spirit-public PUBLIC_FORMS.
- **Luminel** (Mana): an upright violet GEM of a body drawn to a point, diamond facets in two violets, a deeper violet hood, a brow crystal,
  violet antennae + knobs, broad rounded aqua wings with gold veins, a bigger lamp, gold flowing infusion markings on each flank (leaf loop +
  curl; infusion pattern only, no rune / sigil, Magii 0d6d577).
- **Luminarc** (Storm): icy pale blue with crackle seams, an angular head (pointed crown, temple points, brow plate), long BRANCHED lightning
  antennae (antler forks ride the antenna bones), an ice-crystal collar, white lightning forks over the body, long dangling legs, long narrow
  wings with white veins, an open happy mouth.
- **Luminore** (Earth): a round brown STONE pear (no waist), flecked darker with amber chips, tan face, round nose, a crown of amber crystals
  packed in moss, moss on the shoulders, short brown wing-case paddles (beat to keep her up), stubby feet, an amber lamp. No antennae.
- **Luminix** (Water): a round teal water drop, paler front, a wave fin on the crown + one behind, fins for wings, pointed fin-feet, pale
  water swirls + bubbles, bubbles in her pale lamp. No antennae.

## Numbers
| form | tris body / unlit / lamp | glb_long | LUM_GLB_TALL (idle body mean) | stretch p99 idle / run / lie |
|---|---|---|---|---|
| luminel | 14.0k / 4.5k / 560 | 0.717 | 0.98 | 1.70 / 1.90 / 3.32 |
| luminarc | 12.3k / 4.2k+ / 560 | 0.771 | 1.011 | 1.48 / 1.79 / 2.18 |
| luminore | 15.5k / 6.6k / 560 | 0.766 | 0.93 | 1.75 / 3.10 / 3.89 |
| luminix | 12.1k / 6.4k / 560 | 0.761 | 1.053 | 1.71 / 2.60 / 3.24 |
`npx tsx tools/three-check.mts <el>` PASS x4 (every clip + blend in the air, own culling holds her, lamp mounts).

## Rough / for Alex
1. Luminore + Luminix stand / sit on the ground in their art; here they keep the line's hover (fliers on the Hovari contract). Ground clips = a call.
2. The heavy round bodies stretch more in lie / run (base skin weights on a waistless body); Luminore lie p99 3.9.
3. Wings / fins / paddles keep the base wing builder's lace veins (opaque, not translucent). Luminel's chest reads pale (lamp glow + face cream).
4. Sparkles, light trails, loose bubbles in the air = effects, not modelled. Player-facing text: none added.

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_<form>.py ../<form>.glb && $P rig_lum.py <form>; cp ../<form>-rigged.glb ../../../../public/open/spirits/
npx tsx docs/looks/m202-luminara-line-2026-11-27/tools/three-check.mts <el>
(m174 tools) LOOK_H=.3438 blender -b -P look.py -- ../<form>.glb <dir>/<form> 300;  $P sheet.py <dir> ../line-sheet.jpg [<art dir> for the private sheet]
```

## v2 (2026-11-28): LUMINORE + LUMINIX are grounded wingless EGG forms
Alex 11-28: "luminore and luminix both lose their flight in these two evos.. let's get rid of the wings kind of like it turned into an egg form
before awakening". **`line-sheet-v2.jpg`** is the sheet now (PRIVATE vs-locked: athernyx assets/stage2/sheets/m202-luminara-vs-locked-v2.jpg).
- Sculpt (`sculpt_luminore.py` / `sculpt_luminix.py` + `lum_egg.py`): NO wings, no wing fins, no arms (the base eyes() builds wings through
  `S.wing`, now empty); head + abdomen one rounded EGG on two stubby feet; the shell cut into PLATES (dark seams, a spherical Voronoi colour
  class); a glowing HATCH LINE (unlit zigzag strip) round her back + sides with a gap over her lamp, where she will break out. Luminore keeps
  her amber crystal crown + moss (moss now on her upper plates), Luminix her crown wave fin + the small one behind (head fins), swirls, bubbles.
- Rig (`rig_lum_ground.py`, her own, not the base's hover rig): 10 bones (root, hips low in the egg, abd + lamp, chest, neck, head, two lids,
  two legs on the ROOT so a planted foot stays planted), feet on y = 0. Clips: idle (stands, breathes, rocks, looks round), walk (a WADDLE:
  rocks onto each foot, the other patters forward), run (a quick SCOOT, leaned in), sit (bottom down on the ground, feet out in front), lie
  (asleep tipped onto her side). Every frame solved onto the ground (root up by any dip, body held 0.012 glb over it). Base unit 0.3438.
- Game: `spirit-models.ts` `lumEgg`: no `hover`, no own `cull`, avatar not set down, clipV from metrics (walk 0.209 / run 0.378 m/s at 1:1),
  cadence 6.5 (past it her feet slide: she glides). Luminel + Luminarc unchanged (hover).
- Checks: `npx tsx tools/three-check-ground.mts <earth|water>` (game makeRigBody: every clip lowest -0.0..0.6 mm, every blend > -5 mm);
  spirit-forms.test egg block; prod `scripts/m202-forms-check.mts --species firefly` asserts GROUNDED (lowest body point over her ground).
| form | tris body / unlit / lamp | glb_long | LUM_GLB_TALL | stretch p99 idle / walk / run / sit / lie |
|---|---|---|---|---|
| luminore v2 | 20.3k / 5.2k / 560 | 0.780 | 0.936 | 1.60 / 1.77 / 2.07 / 1.84 / 2.03 |
| luminix v2 | 15.4k / 4.9k / 560 | 0.761 | 1.048 | 1.68 / 1.55 / 1.75 / 1.56 / 1.66 |
Rebuild: `$P sculpt_<form>.py ../<form>.glb && $P rig_lum_ground.py <form>; cp ../<form>-rigged.glb ../../../../public/open/spirits/`.
