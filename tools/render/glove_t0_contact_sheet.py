#!/usr/bin/env python3
"""Stitch the 8 turntable frames ($OUT/turntable/glove-{pose}-{view}.png) into one 2x4 contact
sheet: rows = pose (fist, open), columns = view (back, palm, thumb-side, 3q-behind). Runs OUTSIDE
Blender (plain python3 + Pillow), after glove_t0_hand.py has rendered the frames.

Usage: RENDER_OUT=/tmp/glove_hand python3 tools/render/glove_t0_contact_sheet.py
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
sheet_h = len(POSES) * (h + LABEL_H + PAD) + PAD
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

out_path = os.path.join(OUT, "glove-t0-turntable.png")
sheet.save(out_path)
print(f"CONTACT SHEET {out_path} ({sheet_w}x{sheet_h})")
