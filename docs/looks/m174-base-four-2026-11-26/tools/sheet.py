import sys
from PIL import Image, ImageDraw, ImageFont
R = sys.argv[1]; OUT = sys.argv[2]; REF = sys.argv[3] if len(sys.argv) > 3 else None
F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n)
W = 2040; im = lambda k: Image.open(f'{R}/{k}.png').convert('RGB')
tiles = ([Image.open(REF).convert('RGB')] if REF else []) + [im('lep_' + k) for k in ('front', 'tq', 'side', 'rear', 'face')]
tw = W // len(tiles); row1 = Image.new('RGB', (W, tw), (24, 28, 30)); [row1.paste(t.resize((tw, tw)), (i * tw, 0)) for i, t in enumerate(tiles)]
ks = ['idle0', 'idle1', 'idle2', 'walk0', 'walk1', 'run0', 'run1', 'sit0', 'sit1', 'lie0']; lab = ['idle', 'idle: wave', 'idle: thump', 'walk: hop (planted)', 'walk: hop (air)', 'run: bound', 'run: bound (air)', 'sit: grooming', 'sit: ears washed', 'lie: asleep']
g = Image.open(f'{R}/lep_game.png').convert('RGB'); gw = int(g.width * 600 / g.height); g = g.resize((gw, 600))
row2 = Image.new('RGB', (W, 600), (24, 28, 30)); d2 = ImageDraw.Draw(row2); cw = (W - gw - 10) // 5
for j, k in enumerate(ks): t = im('lc_' + k).resize((cw, 300)); row2.paste(t, ((j % 5) * cw, (j // 5) * 300)); d2.text(((j % 5) * cw + 8, (j // 5) * 300 + 6), lab[j], font=F(20), fill=(255, 255, 255))
row2.paste(g, (W - gw, 0)); d2.text((W - gw + 8, 6), 'phone 390x844, 4.8 m', font=F(18), fill=(255, 255, 255))
L = im('lineup'); row3 = Image.new('RGB', (W, L.height + 60), (24, 28, 30)); row3.paste(L, (0, 0)); d3 = ImageDraw.Draw(row3)
NM = [('#001 Vulnyx', '0.70 m'), ('#002 Manalotl', '0.90 m long'), ('#003 Dewbear', '0.50 m'), ('#004 Shellmere', 'not built (0.45)'), ('#005 Athowl', '0.50 m'), ('#006 Croakling', 'not built (0.40)'), ('#007 Luminara', 'not built (0.10)'), ('#008 Lepara', '0.48 m NEW'), ('#009 Hovari', '0.30 m long, hovers'), ('#010 Noctyx', '0.45 m')]
for i, (a, b) in enumerate(NM):
    x = 1020 + (i - 4.5) * 200; c = (255, 214, 120) if 'NEW' in b else (230, 230, 230)
    for s, y, f in ((a, L.height + 6, F(19)), (b, L.height + 32, F(16))): w = d3.textlength(s, font=f); d3.text((x - w / 2, y), s, font=f, fill=c)
hd = Image.new('RGB', (W, 50), (24, 28, 30)); dh = ImageDraw.Draw(hd)
dh.text((12, 10), 'M174 Lepara (#008), base form, rigged: ' + ('ref | ' if REF else '') + 'front | three-quarter | side | rear | face  ·  clips  ·  the ten base forms at true relative size (orthographic)', font=F(22), fill=(255, 255, 255))
S = Image.new('RGB', (W, 50 + row1.height + 600 + row3.height), (24, 28, 30)); y = 0
for r in (hd, row1, row2, row3): S.paste(r, (0, y)); y += r.height
S.save(OUT, quality=88); print(OUT, S.size)
