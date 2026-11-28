"""M244 sheet 3: the line sheet (OUR renders only) and the private side-by-side against the locked art.
    python3 sheet.py <frames dir>      (frames: <name>-three-0.png etc. from render_awake.py; see README)
line-sheet.jpg: Vulnore, then the four, three-quarter idle + run, each rendered with ortho scale 2.6 x 1.8 / dial (same size rule).
The private sheet pairs each form's locked art (athernyx assets/stage3, read only) with our render; it is written into athernyx."""
import sys, os
from PIL import Image, ImageDraw
D = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ['vulnore', 'orethar', 'vulnoraya', 'vulnoris', 'vulnorun']
def col(n):
    a = Image.open(f'{D}/{n}-three-0.png').convert('RGB'); b = Image.open(f'{D}/{n}-run-0.png').convert('RGB')
    c = Image.new('RGB', (a.width, a.height + b.height), 'white'); c.paste(a, (0, 0)); c.paste(b, (0, a.height)); return c
cols = [col(n) for n in NAMES]; w, h = cols[0].size
s = Image.new('RGB', (w * len(cols), h + 30), (238, 234, 226)); d = ImageDraw.Draw(s)
for i, (n, c) in enumerate(zip(NAMES, cols)): s.paste(c, (i * w, 30)); d.text((i * w + 10, 8), n, fill=(40, 30, 20))
s.save(os.path.join(HERE, '../line-sheet.jpg'), quality=88)
ART = dict(orethar='009-orethar', vulnoraya='010-vulnoraya', vulnoris='011-vulnoris', vulnorun='012-vulnorun')
rows = []
for n, f in ART.items():
    a = Image.open(f'/root/athernyx/assets/stage3/{f}.png').convert('RGB').resize((h // 2 * 1, h // 2)); r = Image.open(f'{D}/{n}-three-0.png').convert('RGB').resize((int(w * (h // 2) / (h // 2)), h // 2))
    row = Image.new('RGB', (a.width + r.width, h // 2), 'white'); row.paste(a, (0, 0)); row.paste(r, (a.width, 0)); rows.append(row)
p = Image.new('RGB', (max(r.width for r in rows) * 2, rows[0].height * 2), 'white')
for i, r in enumerate(rows): p.paste(r, ((i % 2) * r.width, (i // 2) * r.height))
os.makedirs('/root/athernyx/assets/stage3/sheets', exist_ok=True); p.save('/root/athernyx/assets/stage3/sheets/m244-vulnore-awakened-vs-locked.jpg', quality=85)
print('ok', s.size, p.size)
