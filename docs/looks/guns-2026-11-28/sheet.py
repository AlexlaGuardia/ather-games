# M150 family pass (11-28): the before/after sheet. python3 sheet.py BEFORE_DIR AFTER_DIR OUT.jpg (dirs from scripts/m150-family-pass-shots.mts)
import sys
from PIL import Image, ImageDraw, ImageFont
B, A, OUT = sys.argv[1:4]
F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n)
W = 2000
def fit(p, w, h):
    im = Image.open(p).convert('RGB'); im.thumbnail((w, h)); return im
rows = []
def row(title, items, h):
    rows.append((title, items, h))
row('All 8 bench guns, side on: BEFORE (left) / AFTER (right)', [(f'{B}/all-side.png', 'before'), (f'{A}/all-side.png', 'after')], 760)
for g, note in [('spitter', 'Spitter: shroud bronze -> iron, two rows of slots, solid stub stock -> skeleton tube stock (the card)'),
                ('twins', 'DB2 Twins: barrels side by side -> over and under, a bronze band on each, two rows of shroud slots (the card)')]:
    row(note, [(f'{B}/{g}-side.png', 'before, side'), (f'{A}/{g}-side.png', 'after, side')], 420)
    row(f'{g}: in hand on the bench, desk 1280', [(f'{B}/{g}-hand-desk.png', 'before'), (f'{A}/{g}-hand-desk.png', 'after')], 560)
    row(f'{g}: in hand on the bench, phone 390', [(f'{B}/{g}-hand-390.png', 'before'), (f'{A}/{g}-hand-390.png', 'after')], 760)
H = 90 + sum(h + 70 for _, _, h in rows)
sheet = Image.new('RGB', (W, H), '#e6e4dc'); d = ImageDraw.Draw(sheet)
d.text((30, 25), 'M150 family pass 2026-11-28: bench guns onto the locked family card (bench / owner only, off in the game)', fill='#222', font=F(30))
y = 90
for title, items, h in rows:
    d.text((30, y), title, fill='#333', font=F(24)); y += 36
    cw = (W - 30 * (len(items) + 1)) // len(items)
    for i, (p, lab) in enumerate(items):
        im = fit(p, cw, h - 10); x = 30 + i * (cw + 30)
        sheet.paste(im, (x + (cw - im.width) // 2, y)); d.text((x, y + h - 2), lab, fill='#555', font=F(20))
    y += h + 34
sheet.save(OUT, quality=82); print(OUT, sheet.size)
