"""line-sheet.jpg: one row a spirit (base Athowl, then Mystowl / Voltowl / Cragowl / Tideowl): locked art | model three-quarter |
model front | model face, in the game's toon recipe with her game tints (look.py renders, out/r_<k>_*.png); under them the whole line
at TRUE relative size with NO tint (lineup.py: vertex colours only).
    python sheet.py <render dir> <out.jpg>"""
import sys
from PIL import Image, ImageDraw
D, OUT = sys.argv[1], sys.argv[2]; S = 300
P = '/root/ather-games/public/spirits/'; L = '/root/athernyx/assets/stage2/'   # forms: the LOCKED art; base: the game's public copy
ROWS = [('Athowl (base)', P + 'owl.png', 'base'), ('Mystowl (Mana)', L + '004-mystowl.png', 'mys'), ('Voltowl (Storm)', L + '023-voltowl.png', 'vol'),
        ('Cragowl (Earth)', L + '024-cragowl.png', 'crag'), ('Tideowl (Water)', L + '025-tideowl.png', 'tide')]
ZOOM = {'tq': (55, 15, 245, 205), 'front': (55, 15, 245, 205), 'face': (0, 0, 300, 300)}
def trim(im, bg_rows=6):
    """crop the lineup to the band that holds the spirits (rows that differ from the plain ground row)"""
    import numpy as np; a = np.asarray(im.convert('RGB')).astype(int); ref = a[a.shape[0] // 2 + 60]; d = np.abs(a - ref[None]).sum(2).max(1) > 60
    ys = np.where(d[:a.shape[0] // 2 + 40])[0]; ys = ys[ys > 40] if len(ys[ys > 40]) else ys; return im.crop((0, max(0, ys.min() - 14), im.width, min(im.height, ys.max() + 14)))
lf, lt = trim(Image.open(f'{D}/r_line_front.png')), trim(Image.open(f'{D}/r_line_tq.png')); W = 4 * S
lfh, lth = int(lf.height * W / lf.width), int(lt.height * W / lt.width)
sheet = Image.new('RGB', (W, len(ROWS) * (S + 24) + lfh + lth + 48), (24, 28, 32)); d = ImageDraw.Draw(sheet); y = 0
for name, art, k in ROWS:
    d.text((8, y + 6), name + '   art | model three-quarter | front | full (game tints)', fill=(235, 235, 225)); y += 24
    ims = [Image.open(art).convert('RGB')] + [Image.open(f'{D}/r_{k}_{v}.png').convert('RGB').crop(ZOOM[v]) for v in ('tq', 'front', 'face')]
    for i, im in enumerate(ims):
        w, h = im.size; c = min(w, h); im = im.crop(((w - c) // 2, (h - c) // 2, (w + c) // 2, (h + c) // 2)).resize((S, S)); sheet.paste(im, (i * S, y))
    y += S
for lbl, im, h in (('the line at TRUE relative size, NO tint, front (base 0.50 m; Mystowl, Voltowl, Cragowl, Tideowl at the dial 1.4)', lf, lfh), ('three-quarter', lt, lth)):
    d.text((8, y + 6), lbl, fill=(235, 235, 225)); y += 24; sheet.paste(im.convert('RGB').resize((W, h)), (0, y)); y += h
sheet.save(OUT, quality=88); print(OUT, sheet.size)
