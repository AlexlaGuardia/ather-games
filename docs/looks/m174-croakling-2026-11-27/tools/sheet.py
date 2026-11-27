"""python sheet.py <render dir> <out.jpg>: M174 Croakling sheet. Row 1 = front | three-quarter | side | face | phone 390x844 at 4.8 m; row 2 = clip stills;
row 3 = the ten base forms at true relative size (lineup.py). Renders: blender look.py on ../croakling.glb (prefix sm, LOOK_H .4015), stills.py (prefix sc), lineup.py (lineup.png)."""
import sys
from PIL import Image, ImageDraw, ImageFont
R, OUT = sys.argv[1], sys.argv[2]; F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n); W = 2040; BG = (24, 28, 30)
im = lambda k: Image.open(f'{R}/{k}.png').convert('RGB')
g = im('sm_game'); gh = 460; gw = int(g.width * gh / g.height); g = g.resize((gw, gh)); tw = (W - gw) // 4; r1 = Image.new('RGB', (W, gh), BG); d = ImageDraw.Draw(r1)
for i, (k, l) in enumerate((('front', 'front'), ('tq', 'three-quarter'), ('side', 'side'), ('face', 'face'))): r1.paste(im(f'sm_{k}').resize((tw, tw)), (i * tw, (gh - tw) // 2)); d.text((i * tw + 8, (gh - tw) // 2 + 6), l, font=F(18), fill=(255, 255, 255))
r1.paste(g, (W - gw, 0)); d.text((W - gw + 6, 8), 'phone, 4.8 m', font=F(16), fill=(255, 255, 255))
ks = ['idle0', 'idle1', 'idle2', 'walk0', 'walk1', 'run0', 'sit0', 'sit1', 'lie0']; lab = ['idle: lantern sways', 'idle: throat puff', 'idle: orb swings', 'walk: hop, planted', 'walk: hop, airborne', 'run: bound', 'sit: croak', 'sit: croak', 'lie: asleep, lure drooped']
cw = W // len(ks); r2 = Image.new('RGB', (W, cw), BG); d2 = ImageDraw.Draw(r2)
for j, k in enumerate(ks): r2.paste(im('sc_' + k).resize((cw, cw)), (j * cw, 0)); d2.text((j * cw + 6, 6), lab[j], font=F(16), fill=(255, 255, 255))
L = im('lineup'); L = L.resize((W, int(L.height * W / L.width))); r3 = Image.new('RGB', (W, L.height + 34), BG); r3.paste(L, (0, 34)); d3 = ImageDraw.Draw(r3)
d3.text((12, 6), 'the ten bases at true size (#001-#010; grey block = not built yet): vulnyx, manalotl, dewbear, shellmere, athowl, CROAKLING, luminara, lepara, hovari, noctyx', font=F(18), fill=(255, 214, 120))
hd = Image.new('RGB', (W, 50), BG); ImageDraw.Draw(hd).text((12, 10), 'M174 Croakling (frog, Water) base form, OWNER PREVIEW: 0.40 m to the top of the lure arch (0.32 m eye tops), 0.29 m long. 19 bones (lure = 3), 5 clips.', font=F(22), fill=(255, 255, 255))
rows = [hd, r1, r2, r3]; S = Image.new('RGB', (W, sum(r.height for r in rows)), BG); y = 0
for r in rows: S.paste(r, (0, y)); y += r.height
S.save(OUT, quality=88); print(OUT, S.size)
