"""line-sheet.jpg: one row a spirit (base Dewbear, then Cragbear / Lumebear / Voltbear / Tidebear): locked art | model three-quarter |
model front | model face, in the game's toon recipe (look.py renders); under them the whole line at TRUE relative size (lineup.py).
    python sheet.py <render dir> <out.jpg>"""
import sys
from PIL import Image, ImageDraw
D, OUT = sys.argv[1], sys.argv[2]; S = 300
ROWS = [('Dewbear (base)', '/root/athernyx/assets/baseforms/dewbear_final_01.png', 'dew'), ('Cragbear (Earth)', '/root/athernyx/assets/stage2/009-cragbear.png', 'crag'),
        ('Lumebear (Mana)', '/root/athernyx/assets/stage2/017-lumebear.png', 'lume'), ('Voltbear (Storm)', '/root/athernyx/assets/stage2/018-voltbear.png', 'volt'),
        ('Tidebear (Water)', '/root/athernyx/assets/stage2/019-tidebear.png', 'tide')]
lf, lt = Image.open(f'{D}/line_front.png'), Image.open(f'{D}/line_tq.png'); W = 4 * S; lh = int(lf.height * W / lf.width)
sheet = Image.new('RGB', (W, len(ROWS) * (S + 24) + 2 * (lh + 24)), (24, 28, 32)); d = ImageDraw.Draw(sheet); y = 0
for name, art, k in ROWS:
    d.text((8, y + 6), name + '   art | model three-quarter | front | face', fill=(235, 235, 225)); y += 24
    for i, im in enumerate([Image.open(art).convert('RGB')] + [Image.open(f'{D}/{k}_{v}.png').convert('RGB') for v in ('tq', 'front', 'face')]):
        w, h = im.size; c = min(w, h); im = im.crop(((w - c) // 2, (h - c) // 2, (w + c) // 2, (h + c) // 2)).resize((S, S)); sheet.paste(im, (i * S, y))
    y += S
for lbl, im in (('the line at true relative size, front (base, Cragbear, Lumebear, Voltbear, Tidebear)', lf), ('three-quarter', lt)):
    d.text((8, y + 6), lbl, fill=(235, 235, 225)); y += 24; sheet.paste(im.convert('RGB').resize((W, lh)), (0, y)); y += lh
sheet.save(OUT, quality=88); print(OUT, sheet.size)
