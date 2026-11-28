import sys; from PIL import Image, ImageDraw, ImageFont
R, OUT, ART = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else None)
F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n); BG = (24, 28, 30)
FORMS = [('luminel', 'LUMINEL  Mana', '010-luminel'), ('luminarc', 'LUMINARC  Storm', '029-luminarc'), ('luminore', 'LUMINORE  Earth', '030-luminore'), ('luminix', 'LUMINIX  Water', '031-luminix')]
cell = 300; views = ['front', 'tq', 'side', 'face'] if not ART else ['front', 'tq']
cols = len(views) + (1 if ART else 0); W = cols * cell + 40; Hh = 70 + len(FORMS) * (cell + 40) + (0 if ART else cell + 80)
o = Image.new('RGB', (W, Hh), BG); d = ImageDraw.Draw(o)
d.text((20, 18), 'M202 the Luminara line: Luminel / Luminarc / Luminore / Luminix (owner preview)' + (' vs the LOCKED art (PRIVATE)' if ART else ''), fill=(235, 235, 225), font=F(24))
y = 70
for n, lab, a in FORMS:
    d.text((20, y), lab, fill=(240, 220, 160), font=F(20)); x = 20; y += 30
    if ART: o.paste(Image.open(f'{ART}/{a}.png').convert('RGB').resize((cell, cell)), (x, y)); x += cell
    for v in views: o.paste(Image.open(f'{R}/{n}_{v}.png').convert('RGB').resize((cell, cell)), (x, y)); x += cell
    y += cell + 10
if not ART:
    d.text((20, y), 'true relative size, no tint: base Luminara (0.30 m) then the four at the 1.5 dial', fill=(240, 220, 160), font=F(20)); y += 30; x = 20
    for n, s in [('luminara', 1 / 1.5)] + [(f[0], 1.0) for f in FORMS]:
        im = Image.open(f'{R}/{n}_front.png').convert('RGB'); k = int(cell * s); im = im.resize((k, k)); o.paste(im, (x, y + cell - k)); x += k + 6
o.save(OUT, quality=88); print(OUT, o.size)
