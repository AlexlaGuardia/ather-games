"""python sheet.py <render dir> <out.jpg>: the Lepara LINE sheet (one sheet for Alex). Per form one row: front | three-quarter | side | face |
phone 390x844 at 4.8 m (look.py, prefix = the form's name); then the old base + the four forms at TRUE relative size, side and three-quarter
(lineup.py -> lineup_side.png, lineup_tq.png). Ref-free (the repo is public; the locked art is athernyx assets/stage2 034/032/006/033)."""
import sys
from PIL import Image, ImageDraw, ImageFont
R, OUT = sys.argv[1], sys.argv[2]; F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n); W = 2040; BG = (24, 28, 30)
im = lambda k: Image.open(f'{R}/{k}.png').convert('RGB')
FORMS = [('lepaura', 'LEPAURA (Mana, the moon-hare): taller, plume tail, gold crescent on the brow, gold necklace + diamond, gold infusion ribbons'),
         ('leparc', 'LEPARC (Storm): silver-blue, cheek + ear-tip tufts, violet brow crystal, pale lightning veins, puff tail'),
         ('lepore', 'LEPORE (Earth, the heaviest, dial 1.5): barrel belly, leaf-stone pauldrons + bracers, amber brow + chest crystals, dark ear tips'),
         ('lepnix', 'LEPNIX (Water, the unicorn foal): four legs, horn, water-mane, plume tail, bubble rings, cyan chest drop; base head kept')]
rows = []; hd = Image.new('RGB', (W, 56), BG)
ImageDraw.Draw(hd).text((12, 12), 'M202 Lepara line, OWNER PREVIEW (?form=mana|storm|earth|water): each form her own creature, built on the base Lepara (M174 snout)', font=F(22), fill=(255, 255, 255)); rows.append(hd)
for n, lab in FORMS:
    g = im(f'{n}_game'); gh = 420; gw = int(g.width * gh / g.height); g = g.resize((gw, gh)); tw = min((W - gw) // 4, gh); r = Image.new('RGB', (W, gh + 34), BG); d = ImageDraw.Draw(r)
    d.text((12, 6), lab, font=F(19), fill=(255, 214, 120))
    for i, (k, l) in enumerate((('front', 'front'), ('tq', 'three-quarter'), ('side', 'side'), ('face', 'face'))): r.paste(im(f'{n}_{k}').resize((tw, tw)), (i * tw, 34 + (gh - tw) // 2)); d.text((i * tw + 8, 40), l, font=F(16), fill=(255, 255, 255))
    r.paste(g, (W - gw, 34)); d.text((W - gw + 6, 40), 'phone, 4.8 m', font=F(15), fill=(255, 255, 255)); rows.append(r)
for k, l in (('lineup_side', 'TRUE SIZE, side: base Lepara | Lepaura | Leparc | Lepore | Lepnix'), ('lineup_tq', 'TRUE SIZE, three-quarter: the same five')):
    L = im(k); L = L.resize((W, int(L.height * W / L.width))); r = Image.new('RGB', (W, L.height + 34), BG); r.paste(L, (0, 34)); ImageDraw.Draw(r).text((12, 6), l, font=F(19), fill=(255, 214, 120)); rows.append(r)
S = Image.new('RGB', (W, sum(r.height for r in rows)), BG); y = 0
for r in rows: S.paste(r, (0, y)); y += r.height
S.save(OUT, quality=86); print(OUT, S.size)
