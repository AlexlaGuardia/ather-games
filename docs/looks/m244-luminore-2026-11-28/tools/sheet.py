"""M244 sheet 7 (sheet 6's sheet.py, Luminore's names): the line sheet (OUR renders only), the gallery icons, and the private side-by-side against the locked art.
    python3 sheet.py <frames dir>      (frames: <name>-three-0.png / <name>-run-0.png from render_lum.py, ortho 4.2 / dial = true relative size)
line-sheet.jpg: the Luminore egg (dial 1.5), then the four, three-quarter idle over run. Icons: the idle frame cropped square to 160 px into
public/open/spirits/<name>-icon.png. The private sheet (locked art vs our render) is written into athernyx, never this public repo."""
import sys, os
from PIL import Image, ImageDraw, ImageChops
D = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__)); PUB = os.path.join(HERE, '../../../../public/open/spirits')
NAMES = ['luminore', 'orebrak', 'lumoraya', 'lumorvex', 'lumorun']
def col(n):
    a = Image.open(f'{D}/{n}-three-0.png').convert('RGB'); b = Image.open(f'{D}/{n}-run-0.png').convert('RGB')
    c = Image.new('RGB', (a.width, a.height + b.height), 'white'); c.paste(a, (0, 0)); c.paste(b, (0, a.height)); return c
cols = [col(n) for n in NAMES]; w, h = cols[0].size
s = Image.new('RGB', (w * len(cols), h + 30), (238, 234, 226)); d = ImageDraw.Draw(s)
for i, (n, c) in enumerate(zip(NAMES, cols)): s.paste(c, (i * w, 30)); d.text((i * w + 10, 8), n, fill=(40, 30, 20))
s.save(os.path.join(HERE, '../line-sheet.jpg'), quality=88)
for n in NAMES[1:]:
    a = Image.open(f'{D}/{n}-three-0.png').convert('RGB'); bg = Image.new('RGB', a.size, a.getpixel((2, 2))); x0, y0, x1, y1 = ImageChops.difference(a, bg).point(lambda v: 255 if v > 12 else 0).getbbox()
    cx, cy, r = (x0 + x1) // 2, (y0 + y1) // 2, max(x1 - x0, y1 - y0) // 2 + 8; a.crop((cx - r, cy - r, cx + r, cy + r)).resize((160, 160), Image.LANCZOS).save(f'{PUB}/{n}-icon.png')
ART = dict(orebrak='029-orebrak', lumoraya='030-lumoraya', lumorvex='031-lumorvex', lumorun='032-lumorun')
rows = []
for n, f in ART.items():
    a = Image.open(f'/root/athernyx/assets/stage3/{f}.png').convert('RGB').resize((h // 2, h // 2)); r = Image.open(f'{D}/{n}-three-0.png').convert('RGB').resize((w // 2 * 1, h // 2))
    row = Image.new('RGB', (a.width + r.width, h // 2), 'white'); row.paste(a, (0, 0)); row.paste(r, (a.width, 0)); rows.append(row)
p = Image.new('RGB', (rows[0].width * 2, rows[0].height * 2), 'white')
for i, r in enumerate(rows): p.paste(r, ((i % 2) * r.width, (i // 2) * r.height))
os.makedirs('/root/athernyx/assets/stage3/sheets', exist_ok=True); p.save('/root/athernyx/assets/stage3/sheets/m244-luminore-awakened-vs-locked.jpg', quality=85)
print('ok', s.size, p.size)
