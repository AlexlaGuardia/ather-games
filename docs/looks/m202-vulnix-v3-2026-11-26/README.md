# M202 v3: VULNIX, shorter bubbling tail + floppy ears (2026-11-26)
Alex on v2 (73bddcab), word for word: "lets go a bit shorter on the tail like its turning into bubbles and maybe flop the ears".
Everything else is v2 (see `../m202-vulnix-v2-2026-11-26/README.md`): long level trunk, current ridges, bubble domes, withers
curl, swept cheeks, webbed toes, Vulnyx head, deep teal, size dial 1.4.

## What changed
- **Tail, shorter:** the wave now flows out level and rises to its crest, then STOPS (v2 went on over the crest and broke
  forward into a curl). Tongues cut from nine to eight, shorter, set along the shorter brush.
- **The end breaks up into bubbles:** five foam spheres bulge out of the tip (part of the body), then a trail of eight loose
  bubbles (own spheres, r 27 mm down to 8 mm, each further from the last) follows the line the v2 curl took: up, over, forward
  and down. Clear teal with a pale glint on top. The sculpt asserts every loose bubble keeps an 8 mm gap from the body and
  from each other.
- **Ears flop (a lop):** each ear rises up and out for a fifth of its height, arches outward over a tight fold (r 8 cm,
  2.35 rad) and hangs down beside her head. Built as a warp of the v2 ear (`unbend` in `tools/sculpt_vulnix.py`), so its
  shape and pink inside are kept; the pink now faces her cheek, the coat side shows.

## Rig
`tools/rig_vulnix.py`: the tail bones run the shorter wave and on into the bubbles (tail4 carries the whole trail); the ear
bones run root -> top of the fold, every vertex of the flopped ear on its bone (so the run's ear pin-back and the idle flick
swing the whole flap). Rump sits (5.6 mm), lie stretch p99 2.56 max 7.42, weights_bad 0: `vulnix-metrics.json`,
`poses.jpg` (sit / lie / run). Game check: `npx tsx docs/looks/m202-vulnix-v3-2026-11-26/tools/three-check.mts
public/open/spirits/vulnix-rigged.glb 1.4` all PASS. glb 681 KB.

## Shots
`side-by-side.jpg`: the locked art | prod v2 still | prod v3 still (390x844, owner `?form=water`, build 76a58247); below, the
line at true relative size (idle frame 0) with Vulnix v2 and v3 side by side. `vulnix-390.png` = the v3 prod still, now
framed whole: `scripts/m202-forms-check.mts` aims at the middle of her drawn body (world bbox of her skinned verts) for
Vulnix only (`MID_AIM`); the other four forms keep the root aim their stills were judged on.
Prod check (`--forms water`, owner, this box): ALL PASS, 0.933 m standing (look h 0.977), player sees base, 0 errors.

## Rebuild
```
uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python tools/sculpt_vulnix.py vulnix.glb
/opt/blender/blender -b -P tools/rig_vulnix.py -- vulnix.glb vulnix-rigged.glb vulnix-metrics.json
```
