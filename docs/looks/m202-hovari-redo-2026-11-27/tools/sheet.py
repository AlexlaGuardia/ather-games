"""M202 Hovari REDO line sheet (11-27): one row a form, OLD vs NEW. Cells: old at game distance | new at game distance | new front | side |
rear | three-quarter | face (look.py renders, game tints). Under them the whole line at TRUE relative size, NO tint: old strip, then new.
    python sheet.py <old render dir> <new render dir> <out.jpg> [--ref]   (--ref adds the locked art column: that copy stays gitignored)"""
import sys
from PIL import Image, ImageDraw
OLD, NEW, OUT = sys.argv[1:4]; REF = '--ref' in sys.argv; S = 220
L = '/root/athernyx/assets/stage2/'; P = '/root/ather-games/public/spirits/'
ROWS = [('Hovari (base, unchanged)', P + 'hummingbird.png', 'base'), ('Voltari (Storm)', L + '005-voltari.png', 'volt'), ('Lumari (Mana)', L + '035-lumari.png', 'lum'),
        ('Obsidari (Earth)', L + '036-obsidari.png', 'obs'), ('Tidari (Water)', L + '037-tidari.png', 'tid')]
ZOOM = {'front': (60, 20, 240, 200), 'side': (60, 20, 240, 200), 'rear': (60, 20, 240, 200), 'tq': (60, 20, 240, 200), 'face': (0, 0, 300, 300)}
def game(f): im = Image.open(f).convert('RGB'); return im.crop((195 - 55, 430 - 55, 195 + 55, 430 + 55))   # the game camera at 390x844, cropped round her (upscaled, not re-rendered)
def trim(im):
    import numpy as np; a = np.asarray(im.convert('RGB')).astype(int); ref = a[a.shape[0] // 2 + 60]; d = np.abs(a - ref[None]).sum(2).max(1) > 60
    ys = np.where(d[:a.shape[0] // 2 + 40])[0]; ys = ys[ys > 40] if len(ys[ys > 40]) else ys; return im.crop((0, max(0, ys.min() - 14), im.width, min(im.height, ys.max() + 14)))
cols = (['art'] if REF else []) + ['old (game cam)', 'NEW (game cam)', 'new front', 'new side', 'new rear', 'new 3/4', 'new face']; W = len(cols) * S
strips = [(lbl, (Image.open(f'{D}/r_line_{v}.png'))) for lbl, D, v in (('OLD line, true relative size, no tint, front (base Hovari 0.30 m, forms at dial 1.4)', OLD, 'front'), ('NEW line, true relative size, no tint, front (same base, same scale: forms at dial 1.5)', NEW, 'front'), ('NEW line, three-quarter', NEW, 'tq'))]
sh = sum(int(im.height * W / im.width) + 24 for _, im in strips)
sheet = Image.new('RGB', (W, len(ROWS) * (S + 24) + sh), (24, 28, 32)); d = ImageDraw.Draw(sheet); y = 0
for name, art, k in ROWS:
    d.text((8, y + 6), name + '   ' + ' | '.join(cols), fill=(235, 235, 225)); y += 24
    ims = ([Image.open(art).convert('RGB')] if REF else []) + [game(f'{OLD}/r_{k}_game.png'), game(f'{NEW}/r_{k}_game.png')] + [Image.open(f'{NEW}/r_{k}_{v}.png').convert('RGB').crop(ZOOM[v]) for v in ('front', 'side', 'rear', 'tq', 'face')]
    for i, im in enumerate(ims):
        w, h = im.size; c = min(w, h); im = im.crop(((w - c) // 2, (h - c) // 2, (w + c) // 2, (h + c) // 2)).resize((S, S)); sheet.paste(im, (i * S, y))
    y += S
for lbl, im in strips:
    h = int(im.height * W / im.width); d.text((8, y + 6), lbl, fill=(235, 235, 225)); y += 24; sheet.paste(im.convert('RGB').resize((W, h)), (0, y)); y += h
sheet.save(OUT, quality=88); print(OUT, sheet.size)
