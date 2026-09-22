#!/usr/bin/env bash
# The HERO PROPS, and the recipes that make each one — run this, never blender by hand.
#
# Sibling of `bake-bushes.sh`, and the same argument for existing: the dials that make a prop THIS
# prop belong in a file, not in somebody's shell history, or the next re-bake quietly produces a
# different object and the one a human approved is gone.
#
# ── ★ THE BUDGET INVERTS HERE, AND THAT IS THE WHOLE POINT OF THE PROPS LANE ──────────────────
# A bush is capped at 360 leaf triangles because `CAP.fruit` is 3000 and a dense meadow measured
# 261k triangles of a 397k frame. A station is PLACED BY HAND — `blockDef(MAT.CAULDRON).placeable`,
# dropped from an item, never generated — so its worst case is dozens, not thousands, and one
# `InstancedMesh` per material caps it at `MAX_PER_MAT` 4096 besides. At 30 cauldrons on screen a
# 900-triangle pot costs 27k. So props spend triangles where bushes cannot, and `DECIMATE_TRIS` is
# deliberately NOT inherited here. Do not copy the bush's 360 out of habit.
#
# ── ★ PREVIEWS ARE SCRATCH, THE GLB IS A SOURCE ───────────────────────────────────────────────
# `PREVIEW_OUT` defaults to `scripts/.scratch/props`, NOT next to the glb. A bake writes previews
# every run and an untracked file under `public/` fails `coord build` for every lane on this tree
# — it blocked hub's deploy the first time this script's python ran. Commit the glb; never the png.
#
# ── ★ WHY `models/stations/` AND NOT `models/props/` ──────────────────────────────────────────
# `public/models/props/` belongs to a DIFFERENT, live pipeline: `world/prop-models.tsx` fetches
# those glbs at runtime with `useGLTF`, by id, for play3d's StructureMarkers — Meshy-produced,
# Draco-compressed, keyed off `PROP_MODELS`. Seven of the eight July files there are wired in
# (only `vault_door.glb` is a genuine orphan). Dropping a bake-to-module glb into that folder
# invites someone to add a `PROP_MODELS` row for it and load an untextured 900-triangle lathe
# into a scene that expects a finished Meshy asset. Two pipelines, two namespaces; this one is a
# sibling of `models/flora/`, which is the other bake-to-module lane.
#
#   ./scripts/models/bake-props.sh          # the glb, the previews, and the TS module
set -euo pipefail
cd "$(dirname "$0")/../.."
BLENDER=${BLENDER:-/opt/blender/blender}
OUT=public/models/stations

echo "── cauldron: a thrown clay pot, wide at the hearth band, mass low"
NAME=cauldron SEED=3 SEGMENTS=24 WOBBLE=0.016 LEAN=0.008 FEET=0 OUT=$OUT \
  "$BLENDER" -b -P scripts/models/cauldron.py | grep -E 'bounds|worst wall|TRIS|WROTE'

echo "── baking to a synchronous module"
npx tsx scripts/bake-flora-model.mts $OUT/cauldron.glb \
  --out src/app/shimmer/voxel3d/models/cauldron.ts --name cauldron --via "npm run bake:props"
