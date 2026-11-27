"""python sheet_snout.py <render dir> <out.jpg>: M174 Lepara snout rework sheet. Row 1 = OLD bill, row 2 = NEW snout (front | three-quarter | side | face | phone 390x844 at 4.8 m), row 3 = clip stills of the new rig.
Renders: blender look.py on ../m174-base-four-2026-11-26/lepara.glb (prefix old) and ../lepara.glb (prefix lep); stills.py (prefix lc)."""
import sys
from PIL import Image, ImageDraw, ImageFont
R, OUT = sys.argv[1], sys.argv[2]; F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n); W = 2040; BG = (24, 28, 30)
im = lambda k: Image.open(f'{R}/{k}.png').convert('RGB')
def row(pre, label):
    g = im(pre + '_game'); gh = 420; gw = int(g.width * gh / g.height); g = g.resize((gw, gh)); tw = (W - gw) // 4; r = Image.new('RGB', (W, gh), BG); d = ImageDraw.Draw(r)
    for i, k in enumerate(('front', 'tq', 'side', 'face')): r.paste(im(f'{pre}_{k}').resize((tw, tw)), (i * tw, (gh - tw) // 2))
    r.paste(g, (W - gw, 0)); d.text((10, 8), label, font=F(24), fill=(255, 214, 120)); d.text((W - gw + 6, 8), 'phone, 4.8 m', font=F(16), fill=(255, 255, 255)); return r
ks = ['idle0', 'idle1', 'idle2', 'walk0', 'walk1', 'run0', 'sit0', 'sit1', 'lie0']; lab = ['idle', 'idle: wave', 'idle: thump', 'walk: hop', 'walk: hop (air)', 'run: bound', 'sit: grooming', 'sit: ears washed', 'lie: asleep']
cw = W // len(ks); r3 = Image.new('RGB', (W, cw), BG); d3 = ImageDraw.Draw(r3)
for j, k in enumerate(ks): r3.paste(im('lc_' + k).resize((cw, cw)), (j * cw, 0)); d3.text((j * cw + 6, 6), lab[j], font=F(16), fill=(255, 255, 255))
hd = Image.new('RGB', (W, 50), BG); ImageDraw.Draw(hd).text((12, 10), 'M174 Lepara (#008) snout rework: bill gone, soft round muzzle pads + twitchy rabbit nose (its own bone). Body, colours, size, rig kept.', font=F(22), fill=(255, 255, 255))
rows = [hd, row('old', 'BEFORE: bill'), row('lep', 'AFTER: snout'), r3]; S = Image.new('RGB', (W, sum(r.height for r in rows)), BG); y = 0
for r in rows: S.paste(r, (0, y)); y += r.height
S.save(OUT, quality=88); print(OUT, S.size)
