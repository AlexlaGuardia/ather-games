# M202: the Noctyx line: NOCTARC, NOCTARA, NOCTORE, NOCTIX (2026-11-26)
All four forms in one slice (Alex 11-26, "batch the sign-offs"). Each one is her OWN creature, read from her LOCKED art. Owner preview:
`?form=storm|mana|earth|water` on a bloomed Noctyx.

**`line-sheet.jpg`** is the one sheet for Alex. Each row shows art | model three-quarter | front | face, for the base Noctyx and all four
forms. Under the rows is the whole line side by side at true relative size (base 0.45 m, forms at the dial 1.4). The forms' art cells are
the locked stage2 pictures. The base's art cell is the game's public `bat.png`, because the locked base ref stays local.
Note: `public/spirits/forms/bat_*.png` are NOT the locked art (they are older, different pictures).

## Each form, and what her art gives her body
- **Noctarc (Storm, #3, `003-noctarc.png`)**: pale sky-blue and fluffy, with the biggest ears of the line (1.24x wide), a soft crown and a cheek
  ruff, a violet crystal on her brow, a round belly on short legs and blue eyes. Her wings are SMALL and sit low at her hips (0.74x, dropped
  0.105), the way the art holds them out like a skirt. Lightning veins are thin pale strokes on her belly and face. They read faintly; a
  later glow slice can make them stronger.
- **Noctara (Mana, #38, `038-noctara.png`)**: a charcoal head drawn up into a faceted hood with a point and ridges, glowing violet eyes (a violet pupil,
  not black) and the widest wings of the line, held open (1.36x). She has a violet egg of a belly with a gold flowing pattern on it, slim dark
  legs and a thin tail that curls off her rump to her left. The pattern is an infusion marking (0d6d577): rings and a wave, not a sigil.
- **Noctore (Earth, #39, `039-noctore.png`)**: brown and stocky, the widest body of the line, with a heavy brow, two small horns and a green gem on
  her brow. She has a moss collar of twelve tufts, a glowing amber heart on her belly, broad ears with orange insides, orange cape wings, big
  feet and amber eyes.
- **Noctix (Water, #40, `040-noctix.png`)**: teal and round, her body pebbled with raised bubbles plus two swirl rings, a water-drop gem on her
  crown, wide teal wings, an open smiling mouth (a pink patch under the base's mouth stroke), small feet and dark shining eyes.

The body-plan check is in `spirit-forms.test`. A flier's front width is mostly her wing span, so each form's profile is her width plus her front
depth and back depth, in eight height bands. All five profiles, base included, must differ pairwise by at least 0.06 glb units. Dropping
Noctara's glb in as Noctix turns the check red (and the height and coat checks with it).

## Where the art is silent (listed for Alex)
1. Every art shows her hovering or standing. All four keep the base's flier clips: the hop walk, run = FLY, sit, sleep as lie, glide and hang.
2. Backs: the coats run round plainly. Noctara's hood ridges and Noctix's bubbles are front-weighted.
3. Noctara's tail is sculpted as a thin curl. Her art's wisp is smoky and is not modelled as smoke.
4. Glow (M204, effects only): Noctarc's crackle, Noctara's gold glow, Noctore's heart light and Noctix's splash.
Player-facing text: none added.

## Size + rig
All four are sculpted in the base Noctyx's number space with her tools (`tools/noct.py`). It patches the base `sculpt.py` module per form: its
wing sheet, ear leaf and eye builder, with each form's own trunk, head, ears, wings, feet and features. They are not her body. Each draws the
base's glb scale x the dial 1.4 (0.63 m a glb unit). Standing heights (idle mean, glb units): Noctarc 1.051, Noctara 1.042, Noctore 1.0,
Noctix 0.978 (`NOCT_GLB_TALL`). Skeleton: `tools/rig_noct.py` is the base's 32-bone flier plan, fitted to each form's landmarks (wing ribs,
ear tip, wing root, lid colours). Each form has her own `NOCT*_RIG` (the flier numbers; Noctara's tail makes her glbLen 0.53).
`npx tsx tools/three-check.mts <glb>`: every game clip and blend PASSES for all four. One raw-clip miss: Noctarc's HANG (not a game clip) dips
9 mm, because her low wings droop past her feet's perch. Max edge stretch is 7 to 11 at the wing root for the big wings (base 6.6). Metrics
are in `*-metrics.json`.

## Rebuild
```
cd tools
uv run --no-project --with numpy,scipy,trimesh,networkx python noct.py <form> <form>.glb
uv run --no-project --with numpy,scipy,trimesh,networkx python rig_noct.py <form> <form>.glb <form>-rigged.glb <form>-metrics.json
LOOK_EM=r,g,b LOOK_HULL=r,g,b /opt/blender/blender -b -P look.py -- <glb> <prefix>
/opt/blender/blender -b -P lineup.py -- line 1400 460 <glb>:<scale> ...    ;  python sheet.py <render dir> line-sheet.jpg
```
