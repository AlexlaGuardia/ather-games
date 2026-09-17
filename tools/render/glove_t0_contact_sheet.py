#!/usr/bin/env python3
"""Stitch the 8 turntable frames ($OUT/turntable/glove-{pose}-{view}.png) into a 2x4 contact
sheet, PLUS a 9th full-width row for $OUT/turntable/player-pov.png (the coordinator's review
shot: the hand at its exact in-game rest transform, seen through the game's own 75deg-vertical
camera). Runs OUTSIDE Blender (plain python3 + Pillow), after glove_t0_hand.py has rendered.

Usage: RENDER_OUT=tools/render/out/hands-draft2 python3 tools/render/glove_t0_contact_sheet.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.environ.get("RENDER_OUT", "/tmp/glove_hand")
TT_DIR = os.path.join(OUT, "turntable")
POSES = ["fist", "open"]
VIEWS = ["back", "palm", "thumb-side", "3q-behind"]
LABEL_H = 28
PAD = 4

frames = []
w = h = None
for pose in POSES:
    for view in VIEWS:
        p = os.path.join(TT_DIR, f"glove-{pose}-{view}.png")
        img = Image.open(p).convert("RGB")
        w, h = img.size
        frames.append((pose, view, img))

sheet_w = len(VIEWS) * (w + PAD) + PAD
grid_h = len(POSES) * (h + LABEL_H + PAD) + PAD

pov_path = os.path.join(TT_DIR, "player-pov.png")
pov_img = Image.open(pov_path).convert("RGB") if os.path.exists(pov_path) else None
pov_h = 0
if pov_img is not None:
    pov_w_target = sheet_w - 2 * PAD
    scale = pov_w_target / pov_img.width
    pov_img = pov_img.resize((pov_w_target, int(pov_img.height * scale)))
    pov_h = pov_img.height + LABEL_H + PAD

sheet_h = grid_h + pov_h
sheet = Image.new("RGB", (sheet_w, sheet_h), (60, 60, 60))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
except Exception:
    font = ImageFont.load_default()

for i, (pose, view, img) in enumerate(frames):
    row = i // len(VIEWS)
    col = i % len(VIEWS)
    x = PAD + col * (w + PAD)
    y = PAD + row * (h + LABEL_H + PAD)
    sheet.paste(img, (x, y))
    label = f"{pose} / {view}"
    draw.text((x + 4, y + h + 4), label, fill=(230, 230, 230), font=font)

if pov_img is not None:
    x = PAD
    y = grid_h
    sheet.paste(pov_img, (x, y))
    draw.text((x + 4, y + pov_img.height + 4),
              "9th frame — PLAYER POV: origin cam, -Z fwd, 75deg vertical fov, "
              "hand at rig's rest transform (open pose)",
              fill=(230, 230, 230), font=font)

out_path = os.path.join(OUT, "glove-t0-turntable.png")
sheet.save(out_path)
print(f"CONTACT SHEET {out_path} ({sheet_w}x{sheet_h})")
