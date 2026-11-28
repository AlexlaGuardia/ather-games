"""M244 Vulnix v2: the before / after sheet (OUR renders only) + the private side-by-side against the locked art.
    python3 v2_sheet.py <frames dir>     frames: <name>-v1-0.png (three-quarter idle) / <name>-v2-0.png / <name>-v2-1.png (run), render_awake.py
v2-before-after.jpg: top row = v1 (11-28 night), bottom two = v2 idle + run, same camera + ortho scale for both (true relative size).
The private sheet (art | v2) is written into athernyx assets/stage3/sheets/m244-vulnix-v2-vs-locked.jpg (art read only, never copied here)."""
import sys, os
from PIL import Image, ImageDraw, ImageChops
D = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ["vulnitar", "marelle", "vulnisk", "vulnixeth"]
im = lambda n, t, k: Image.open(f'{D}/{n}-{t}-{k}.png').convert('RGB')
w, h = im(NAMES[0], 'v1', 0).size
s = Image.new('RGB', (w * len(NAMES), h * 3 + 30), (238, 234, 226)); d = ImageDraw.Draw(s)
for i, n in enumerate(NAMES):
    for r, (t, k) in enumerate((('v1', 0), ('v2', 0), ('v2', 1))): s.paste(im(n, t, k), (i * w, 30 + r * h))
    d.text((i * w + 10, 8), f'{n}   top: v1 (before)   middle: v2 idle   bottom: v2 run', fill=(40, 30, 20))
s.save(os.path.join(HERE, '../v2-before-after.jpg'), quality=86)
PUB = os.path.join(HERE, '../../../../public/open/spirits')
for n in NAMES:   # the gallery icons from the v2 three-quarter idle (as the Luminel sheet makes them)
    a = im(n, 'v2', 0); bg = Image.new('RGB', a.size, a.getpixel((2, 2))); x0, y0, x1, y1 = ImageChops.difference(a, bg).point(lambda v: 255 if v > 12 else 0).getbbox()
    cx, cy, r = (x0 + x1) // 2, (y0 + y1) // 2, max(x1 - x0, y1 - y0) // 2 + 8; a.crop((cx - r, cy - r, cx + r, cy + r)).resize((160, 160), Image.LANCZOS).save(f'{PUB}/{n}-icon.png')
ART = dict(vulnitar="013-vulnitar", marelle="014-marelle", vulnisk="015-vulnisk", vulnixeth="016-vulnixeth")
rows = []
for n, f in ART.items():
    a = Image.open(f'/root/athernyx/assets/stage3/{f}.png').convert('RGB').resize((h, h)); b = im(n, 'v1', 0); c = im(n, 'v2', 0)
    row = Image.new('RGB', (h + 2 * w, h), 'white'); row.paste(a, (0, 0)); row.paste(b, (h, 0)); row.paste(c, (h + w, 0)); rows.append(row)
p = Image.new('RGB', (rows[0].width * 2, h * 2), 'white')
for i, r in enumerate(rows): p.paste(r, ((i % 2) * r.width, (i // 2) * h))
os.makedirs('/root/athernyx/assets/stage3/sheets', exist_ok=True); p.save('/root/athernyx/assets/stage3/sheets/m244-vulnix-v2-vs-locked.jpg', quality=82)
print('ok', s.size, p.size)
