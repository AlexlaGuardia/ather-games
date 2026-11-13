"""Derive a first-pass HEIGHTMAP for the open world from the painted Athernyx map.

Source: /root/athernyx/assets/maps/drafts/map-draft-03.png (canon's working reference map, geography.md).
Ruling: the drivable open map is the waking continent (CANON_GAPS, 2026-11-13). Scale is BUILD:
1 source px = 10 m (the continent compresses to ~11.7 x 7.8 km; canon's weeks-long journeys are the books').

This reads the painting, it does not author places: coast, mountains and forest come from what is painted.
Labels, icons and stars are painted over the land, so they are masked and filled from their neighbours first.

Run: python3 tools/worldmap/derive_height.py [out_dir]
Writes: height.npy (float32 metres), land.png (mask), preview.png (shaded relief beside the source).
"""
import sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SRC = '/root/athernyx/assets/maps/drafts/map-draft-03.png'
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
M_PER_PX = 10.0

img = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32) / 255
H, W, _ = img.shape
r, g, b = img[..., 0], img[..., 1], img[..., 2]
lum = 0.3 * r + 0.59 * g + 0.11 * b
mx, mn = img.max(-1), img.min(-1)
sat = (mx - mn) / np.maximum(mx, 1e-3)

# ── 1. overlay mask: the labels, icons, stars, red dots, compass painted ON the map ──
black = mx < 0.16
yellow = (r > 0.75) & (g > 0.55) & (b < 0.35) & (sat > 0.5)
red = (r > 0.6) & (g < 0.3) & (b < 0.3)
white = mn > 0.86
overlay = nd.binary_dilation(black | yellow | red | white, iterations=3)

# fill overlay pixels from the nearest clean pixel (the paint underneath is lost; its neighbour is a fair guess)
idx = nd.distance_transform_edt(overlay, return_distances=False, return_indices=True)
clean = img[idx[0], idx[1]]
r, g, b = clean[..., 0], clean[..., 1], clean[..., 2]
lum = 0.3 * r + 0.59 * g + 0.11 * b

# ── 2. land vs sea: the sea is the blue-teal; land is warmer ──
sea = (b > r + 0.04) & (b >= g - 0.06)
sea = nd.binary_opening(sea, iterations=2)
# ⚠ NOT binary_fill_holes: the painted rivers, the delta and the inland water ARE the map (bridges, fords,
# the Shellback's country). Pass 1 filled them and lost every river. Keep any blue the painting has.
water = (b > r + 0.02) & (b >= g - 0.08)
land = ~(sea | water)
land = nd.binary_closing(land, iterations=1)
lab, n = nd.label(land)
sizes = nd.sum(land, lab, range(1, n + 1))
land = np.isin(lab, 1 + np.flatnonzero(sizes > 60))     # drop specks; keep islands

# ── 3. mountains: hachured relief = high local contrast + brown/grey (low green dominance) ──
mean = nd.uniform_filter(lum, 9)
var = nd.uniform_filter(lum * lum, 9) - mean * mean
texture = np.sqrt(np.maximum(var, 0))
brownish = np.clip((r - g + 0.06) * 6, 0, 1)                 # r ≥ g → brown/rock
greyish = np.clip(1 - sat * 3, 0, 1)
# pass 1 read the forest's painted texture as relief: demand real brown/grey before texture counts
mountain = np.clip(texture * 9 - 0.08, 0, 1) * np.clip(brownish * 0.9 + greyish * 0.5 - 0.12, 0, 1)
mountain = nd.gaussian_filter(mountain * land, 4)
mountain = np.clip(mountain / max(np.percentile(mountain[land], 99.5), 1e-3), 0, 1)

# forest (dark green) reads a little higher and rougher than open grassland
forest = np.clip((0.42 - lum) * 4, 0, 1) * np.clip((g - r) * 8, 0, 1) * land
forest = nd.gaussian_filter(forest, 8)          # broad and soft: woods are rolling ground, not lumps

# ── 4. height ──
coast = nd.distance_transform_edt(land) * M_PER_PX                # metres inland
base = np.clip(coast / 1500, 0, 1) ** 0.8 * 45                    # land rises gently away from the sea
height = base + forest * 10 + mountain ** 1.6 * 440               # the Spine tops out ~460 m
height = nd.gaussian_filter(height, 1.5)
bank = nd.distance_transform_edt(land) * M_PER_PX
height = np.where(land, np.minimum(height, 1.5 + bank * 0.5), height)    # valleys run down to the water (pass 2's 0.12 flattened the Spine)
seaDepth = -np.clip(nd.distance_transform_edt(~land) * M_PER_PX / 40, 0, 60)
height = np.where(land, np.maximum(height, 1.0), seaDepth).astype(np.float32)
np.save(f'{OUT}/height.npy', height)
Image.fromarray((land * 255).astype(np.uint8)).save(f'{OUT}/land.png')

# ── 5. preview: shaded relief, hypsometric tint, beside the source ──
gy, gx = np.gradient(height, M_PER_PX)
az, alt = np.radians(315), np.radians(40)
slope = np.arctan(np.hypot(gx, gy) * 2.2)
aspect = np.arctan2(-gx, gy)
shade = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
t = np.clip(height / 460, 0, 1)[..., None]
lowc, midc, hic = np.array([0.42, 0.6, 0.32]), np.array([0.55, 0.5, 0.36]), np.array([0.93, 0.92, 0.9])
tint = np.where(t < 0.35, lowc + (midc - lowc) * (t / 0.35), midc + (hic - midc) * ((t - 0.35) / 0.65))
seac = np.array([0.18, 0.42, 0.55]) + np.clip(height, -60, 0)[..., None] / 60 * 0.12
rgb = np.where(land[..., None], tint * (0.35 + 0.75 * shade[..., None]), seac)
rel = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
rel.save(f'{OUT}/relief.png')                                    # the terrain alone, source-sized (the atlas layer)
src = Image.open(SRC).convert('RGB')
both = Image.new('RGB', (W * 2 + 20, H + 40), (14, 16, 22))
both.paste(src, (0, 40)); both.paste(rel, (W + 20, 40))
d = ImageDraw.Draw(both)
d.text((10, 12), 'painted map (canon reference)', fill=(220, 220, 220))
d.text((W + 30, 12), f'derived terrain  ·  {W*M_PER_PX/1000:.1f} x {H*M_PER_PX/1000:.1f} km  ·  peak {height.max():.0f} m  ·  land {land.mean()*100:.0f}%', fill=(220, 220, 220))
both.save(f'{OUT}/preview.png')
print(f'height {height.min():.0f}..{height.max():.0f} m  land {land.mean()*100:.1f}%  overlay {overlay.mean()*100:.1f}%  islands {n}')
