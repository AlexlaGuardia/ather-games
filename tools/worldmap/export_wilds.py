"""Export one tile of THE WILDS: the continent's land in the Ather's state, for walking (no roads, no places).

Canon: the Ather and Athernyx are the same land in two states (world/ather.md, RULED 2026-09-07). The Wilds' ground
IS the continent's ground, so this reads the SAME height.npy the driving regions read. What it leaves out is what
canon says is not shared: roads, towns, and any mortal name. Settlements are convergent, never mirrored.

Differences from export_region.py, all deliberate:
- no road beds, no network, no places: the Ather was never paved
- a finer cell (4 m vs 5 m) and more relief detail: a keeper on foot reads small ground a courser never feels
- a BIOME byte per cell, read from the painting's own colour (woods = the dark green it paints) + height + slope.
  Biomes are what the Wilds are FOR (gathering, waymarks, what Moglins send home), so they ship with the land.

Run: python3 tools/worldmap/export_wilds.py <height.npy> <name> x0 y0 x1 y1      (source px; 1 px = 10 m)
Writes: public/open/wilds/<name>.bin   int16 decimetres, row-major, z rows of nx
        public/open/wilds/<name>.biome uint8, one per CELL (nx-1 by nz-1), same order
        public/open/wilds/<name>.json  meta
"""
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as nd

H_SRC, NAME = sys.argv[1], sys.argv[2]
X0, Y0, X1, Y1 = map(int, sys.argv[3:7])
PAINTING = '/root/athernyx/assets/maps/drafts/map-draft-03.png'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../public/open/wilds')
M_PX, CELL = 10.0, 4.0
UP = M_PX / CELL
WATER_Y = 0.0                          # height.npy: land >= 1 m, sea and rivers below 0

# biome ids — the page and the tests read these numbers (open/ather/wilds.ts BIOME)
WATER, SHORE, MEADOW, WOODS, ROCK = 0, 1, 2, 3, 4

src = np.load(H_SRC)
pad = 4                                 # crop a margin so the filters have neighbours at the edge
crop = src[Y0 - pad:Y1 + 1 + pad, X0 - pad:X1 + 1 + pad].astype(np.float64)
crop = nd.gaussian_filter(crop, 0.8)
h = nd.zoom(crop, UP, order=3)
cut = int(round(pad * UP))
n_x, n_z = int(round((X1 - X0) * UP)) + 1, int(round((Y1 - Y0) * UP)) + 1
h = h[cut:cut + n_z, cut:cut + n_x]
nz, nx = h.shape

# ── the painting, for biome + woods roughness ─────────────────────────────────────────────────────────────────
img = np.asarray(Image.open(PAINTING).convert('RGB')).astype(np.float32) / 255
r, g, b = img[..., 0], img[..., 1], img[..., 2]
mx, mn = img.max(-1), img.min(-1)
sat = (mx - mn) / np.maximum(mx, 1e-3)
overlay = nd.binary_dilation((mx < 0.16) | ((r > 0.75) & (g > 0.55) & (b < 0.35) & (sat > 0.5))
                             | ((r > 0.6) & (g < 0.3) & (b < 0.3)) | (mn > 0.86), iterations=3)
idx = nd.distance_transform_edt(overlay, return_distances=False, return_indices=True)
img = img[idx[0], idx[1]]               # labels and icons filled from the paint around them
r, g, b = img[..., 0], img[..., 1], img[..., 2]
lum = 0.3 * r + 0.59 * g + 0.11 * b
# Woods and grassland paint nearly the same olive pixel for pixel; what separates them is the painted canopy's
# darkness over an AREA. Measured 11-14: Deep Woods smoothed lum 0.20-0.23, grassland 0.33-0.58 (derive_height's
# per-pixel test found 8 woods cells in a tile that is a third forest).
L, G = nd.gaussian_filter(lum, 4), nd.gaussian_filter(g - r, 4)
woodsSrc = np.clip((0.31 - L) * 12, 0, 1) * (G > 0)
woodsSrc = woodsSrc[Y0 - pad:Y1 + 1 + pad, X0 - pad:X1 + 1 + pad]
woods = np.clip(nd.zoom(woodsSrc, UP, order=1)[cut:cut + nz, cut:cut + nx], 0, 1)

# ── relief detail: the Ather is made ground, so small rises and hollows everywhere a walker can read ───────────
rng = np.random.default_rng(11)
det = (nd.gaussian_filter(rng.standard_normal(h.shape), 6) * 22      # long swells, ±~2.5 m
       + nd.gaussian_filter(rng.standard_normal(h.shape), 2) * 3.0)  # knolls, ±~0.8 m
land = h > 0.5
lift = np.clip(h / 4, 0, 1)                                          # fades out toward the water's edge
h = np.where(land, h + det * lift * (1 + woods * 0.6), h)
h = np.where(land, np.maximum(h, 0.4), np.minimum(h, -1.2))          # a real bank: water is never ankle-deep mush
h = nd.gaussian_filter(h, 0.6)

# ── biome per cell (centre of the cell's four corners) ────────────────────────────────────────────────────────
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

os.makedirs(OUT, exist_ok=True)
dm = np.clip(np.round(h * 10), -32768, 32767).astype('<i2')
dm.tofile(f'{OUT}/{NAME}.bin')
biome.tofile(f'{OUT}/{NAME}.biome')
counts = {k: int((biome == v).sum()) for k, v in dict(water=WATER, shore=SHORE, meadow=MEADOW, woods=WOODS, rock=ROCK).items()}
meta = dict(name=NAME, cell=CELL, nx=nx, nz=nz, sizeX=(nx - 1) * CELL, sizeZ=(nz - 1) * CELL, waterY=WATER_Y,
            source=dict(x0=X0, y0=Y0, x1=X1, y1=Y1, mPerPx=M_PX), biomes=counts,
            note='Ather state of the continent tile; no roads, no places (world/ather.md 09-07).')
json.dump(meta, open(f'{OUT}/{NAME}.json', 'w'), indent=1)
print(f'{NAME}: {nx}x{nz} verts, {meta["sizeX"]:.0f}x{meta["sizeZ"]:.0f} m, h {h.min():.1f}..{h.max():.1f}, biomes {counts}')
