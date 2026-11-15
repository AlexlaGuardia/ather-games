"""Export THE WILDS for the whole continent, in 1 km tiles that MEET (Alex 11-15: "stream the wilds").

export_wilds.py makes one tile in isolation: its relief noise is seeded per tile and every filter runs on the tile's
own crop, so two neighbouring tiles would not agree at their shared edge. This runs the same recipe ONCE over the
whole continent at 4 m (one relief field, one woods field, one filter pass), then cuts it into tiles that share their
edge vertices exactly. Same land, same rules (world/ather.md 09-07: the Ather is the continent's ground in its other
state; no roads, no places, no mortal names).

The grid is anchored so the original tile stays a tile: source px x0 = 770 + 100·tx, y0 = 420 + 100·ty. Tile (0,0)
keeps the name `first-wilds` (waymarks, fog and node ids saved against it stay valid); the rest are `w<tx>_<ty>`.
Tiles with almost no land are skipped. Off the painted map's edge the source is padded as sea.

Run:  python3 tools/worldmap/export_wilds_all.py tools/worldmap/out/height.npy
Then: npx tsx tools/worldmap/index_wilds.ts    (places every tile's nodes into public/open/wilds/tiles.json)
"""
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as nd

H_SRC = sys.argv[1]
PAINTING = '/root/athernyx/assets/maps/drafts/map-draft-03.png'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../public/open/wilds')
M_PX, CELL = 10.0, 4.0
UP = M_PX / CELL                     # 2.5 vertices per source px
TILE_PX = 100                        # 1 km
AX, AY = 770, 420                    # the anchor: first-wilds' source origin
WATER_Y = 0.0
WATER, SHORE, MEADOW, WOODS, ROCK = 0, 1, 2, 3, 4
MIN_LAND = 0.02

src = np.load(H_SRC).astype(np.float64)
SH, SW = src.shape
# tile index range that covers the map
tx0, tx1 = -((AX + TILE_PX - 1) // TILE_PX), (SW - AX + TILE_PX - 1) // TILE_PX - 1
ty0, ty1 = -((AY + TILE_PX - 1) // TILE_PX), (SH - AY + TILE_PX - 1) // TILE_PX - 1
# pad the source so every tile (plus a filter margin) lies inside it; sea beyond the painted edge
PAD = 8
left, top = -(AX + tx0 * TILE_PX) + PAD, -(AY + ty0 * TILE_PX) + PAD
right = (AX + (tx1 + 1) * TILE_PX) - SW + PAD + 1
bottom = (AY + (ty1 + 1) * TILE_PX) - SH + PAD + 1
srcP = np.pad(src, ((top, bottom), (left, right)), constant_values=-5.0)
img = np.asarray(Image.open(PAINTING).convert('RGB')).astype(np.float32) / 255

# ── the woods field, from the painting (the same recipe as export_wilds.py, on the whole map) ──────────────────
r, g, b = img[..., 0], img[..., 1], img[..., 2]
mx, mn = img.max(-1), img.min(-1)
sat = (mx - mn) / np.maximum(mx, 1e-3)
overlay = nd.binary_dilation((mx < 0.16) | ((r > 0.75) & (g > 0.55) & (b < 0.35) & (sat > 0.5))
                             | ((r > 0.6) & (g < 0.3) & (b < 0.3)) | (mn > 0.86), iterations=3)
idx = nd.distance_transform_edt(overlay, return_distances=False, return_indices=True)
img = img[idx[0], idx[1]]
r, g, b = img[..., 0], img[..., 1], img[..., 2]
lum = 0.3 * r + 0.59 * g + 0.11 * b
L, G = nd.gaussian_filter(lum, 4), nd.gaussian_filter(g - r, 4)
woodsSrc = np.clip((0.31 - L) * 12, 0, 1) * (G > 0)
woodsP = np.pad(woodsSrc, ((top, bottom), (left, right)), constant_values=0.0)

# ── the whole land at 4 m, once ─────────────────────────────────────────────────────────────────────────────────
crop = nd.gaussian_filter(srcP, 0.8)
# zoom so that output vertex k sits exactly on source px k/UP (grid_mode=False maps corners; we size it so it is exact)
n_z, n_x = int(round((srcP.shape[0] - 1) * UP)) + 1, int(round((srcP.shape[1] - 1) * UP)) + 1
zi, xi = np.linspace(0, srcP.shape[0] - 1, n_z), np.linspace(0, srcP.shape[1] - 1, n_x)
h = nd.map_coordinates(crop, np.meshgrid(zi, xi, indexing='ij'), order=3)
woods = np.clip(nd.map_coordinates(woodsP, np.meshgrid(zi, xi, indexing='ij'), order=1), 0, 1)
rng = np.random.default_rng(11)
det = (nd.gaussian_filter(rng.standard_normal(h.shape), 6) * 22
       + nd.gaussian_filter(rng.standard_normal(h.shape), 2) * 3.0)
land = h > 0.5
lift = np.clip(h / 4, 0, 1)
h = np.where(land, h + det * lift * (1 + woods * 0.6), h)
h = np.where(land, np.maximum(h, 0.4), np.minimum(h, -1.2))
h = nd.gaussian_filter(h, 0.6)
hc = (h[:-1, :-1] + h[1:, :-1] + h[:-1, 1:] + h[1:, 1:]) / 4
gx = (h[:-1, 1:] - h[:-1, :-1]) / CELL
gz = (h[1:, :-1] - h[:-1, :-1]) / CELL
slope = np.hypot(gx, gz)
wc = (woods[:-1, :-1] + woods[1:, 1:]) / 2
biome = np.full(hc.shape, MEADOW, np.uint8)
biome[wc > 0.35] = WOODS
biome[(slope > 0.7) | (hc > 160)] = ROCK
biome[hc < 1.6] = SHORE
biome[hc < WATER_Y] = WATER

# ── cut ───────────────────────────────────────────────────────────────────────────────────────────────────────
os.makedirs(OUT, exist_ok=True)
NV = int(TILE_PX * UP) + 1           # 251 vertices a side
tiles = []
for ty in range(ty0, ty1 + 1):
    for tx in range(tx0, tx1 + 1):
        x0, y0 = AX + tx * TILE_PX, AY + ty * TILE_PX
        i0, j0 = int(round((x0 + left) * UP)), int(round((y0 + top) * UP))
        th, tb = h[j0:j0 + NV, i0:i0 + NV], biome[j0:j0 + NV - 1, i0:i0 + NV - 1]
        if th.shape != (NV, NV):
            continue
        landShare = float((tb != WATER).mean())
        if landShare < MIN_LAND:
            continue
        name = 'first-wilds' if (tx, ty) == (0, 0) else f'w{tx}_{ty}'
        np.clip(np.round(th * 10), -32768, 32767).astype('<i2').tofile(f'{OUT}/{name}.bin')
        tb.astype(np.uint8).tofile(f'{OUT}/{name}.biome')
        counts = {k: int((tb == v).sum()) for k, v in dict(water=WATER, shore=SHORE, meadow=MEADOW, woods=WOODS, rock=ROCK).items()}
        meta = dict(name=name, cell=CELL, nx=NV, nz=NV, sizeX=(NV - 1) * CELL, sizeZ=(NV - 1) * CELL, waterY=WATER_Y,
                    source=dict(x0=x0, y0=y0, x1=x0 + TILE_PX, y1=y0 + TILE_PX, mPerPx=M_PX), biomes=counts, tx=tx, ty=ty,
                    note='Ather state of the continent, cut from one continent-wide pass (export_wilds_all.py); tiles meet.')
        json.dump(meta, open(f'{OUT}/{name}.json', 'w'), indent=1)
        tiles.append(dict(name=name, tx=tx, ty=ty, land=round(landShare, 3)))
json.dump(dict(v=1, tileM=TILE_PX * M_PX, anchor=dict(x0=AX, y0=AY), tiles=tiles), open(f'{OUT}/tiles.json', 'w'), indent=1)
print(f'{len(tiles)} tiles written (tx {tx0}..{tx1}, ty {ty0}..{ty1}), h {h.min():.1f}..{h.max():.1f}')
