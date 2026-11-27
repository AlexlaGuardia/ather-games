# M216 s2b: Alex's ONE sheet from the bench shots (scripts/m216-bench-sync-check.mts): every torso, scarf and belt, front + side.
# Run from the repo root: python3 docs/looks/m216-s2b-2026-11-27/compose_sheet.py
from PIL import Image, ImageDraw, ImageFont
import os
D = 'docs/looks/m216-s2b-2026-11-27'
ROWS = [('Torso', 'torso', ['A male', 'A female', 'B male', 'B female', 'C male', 'C female']),
        ('Scarf (on A male)', 'scarf', ['A male', 'A female', 'B male', 'B female', 'C male', 'C female']),
        ('Belt (on A male)', 'belt', ['Level buckle', 'Ring buckle', 'Tied end', 'Sagging', 'Sagging two-strap'])]
W, H, PAD, LBL = 180, 300, 8, 22
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
except Exception: font = ImageFont.load_default()
cols = 12
sheet = Image.new('RGB', (PAD + cols * (W + PAD), PAD + len(ROWS) * (H + LBL * 2 + PAD)), '#f6efe0')
dr = ImageDraw.Draw(sheet)
for r, (title, key, labels) in enumerate(ROWS):
    y0 = PAD + r * (H + LBL * 2 + PAD)
    dr.text((PAD, y0), title + '  (front | side)', fill='#2a2230', font=font)
    for i, lab in enumerate(labels):
        for v, view in enumerate(['front', 'side']):
            f = f'{D}/{key}-{i}-{view}.png'
            x = PAD + (i * 2 + v) * (W + PAD)
            if os.path.exists(f):
                im = Image.open(f).convert('RGB'); im.thumbnail((W, H)); sheet.paste(im, (x + (W - im.width) // 2, y0 + LBL))
            if v == 0: dr.text((x, y0 + LBL + H + 2), lab, fill='#2a2230', font=font)
sheet.save(f'{D}/sheet-bodies.png'); print('wrote', f'{D}/sheet-bodies.png', sheet.size)
