"""python sheet.py <render dir> <out.jpg>: the Croakling LINE sheet (one sheet for Alex). Per form one row: front | three-quarter | side | face |
phone 390x844 at 4.8 m (look.py, prefix = the form's name); then the old base + the four forms at TRUE relative size, side and three-quarter
(lineup.py -> lineup_side.png, lineup_tq.png). Ref-free (the repo is public; the locked art is athernyx assets/stage2 008/026/027/028)."""
import sys
from PIL import Image, ImageDraw, ImageFont
R, OUT = sys.argv[1], sys.argv[2]; F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n); W = 2040; BG = (24, 28, 30)
im = lambda k: Image.open(f'{R}/{k}.png').convert('RGB')
FORMS = [('croakrill', 'CROAKRILL (Water): taller + upright, gill fronds, long webbed toes, dark spots, cyan orb'),
         ('croakara', 'CROAKARA (Mana): wide + squat on splayed legs, huge lilac-ringed eyes, gold flowing infusion markings, violet bud orb'),
         ('croakore', 'CROAKORE (Earth): a warty toad, the heaviest (dial 1.5), moss crown + shoulders, slit-pupil orange eyes, amber orb'),
         ('croakarc', 'CROAKARC (Storm): a SKINK, no lure (ledger), long curling tail, pointed crest, dorsal spines, lightning veins, violet brow gem')]
rows = []; hd = Image.new('RGB', (W, 56), BG)
ImageDraw.Draw(hd).text((12, 12), 'M202 Croakling line, OWNER PREVIEW (?form=water|mana|earth|storm): each form her own creature, built on the base Croakling (M174, not yet OK\'d)', font=F(22), fill=(255, 255, 255)); rows.append(hd)
for n, lab in FORMS:
    g = im(f'{n}_game'); gh = 420; gw = int(g.width * gh / g.height); g = g.resize((gw, gh)); tw = min((W - gw) // 4, gh); r = Image.new('RGB', (W, gh + 34), BG); d = ImageDraw.Draw(r)
    d.text((12, 6), lab, font=F(19), fill=(255, 214, 120))
    for i, (k, l) in enumerate((('front', 'front'), ('tq', 'three-quarter'), ('side', 'side'), ('face', 'face'))): r.paste(im(f'{n}_{k}').resize((tw, tw)), (i * tw, 34 + (gh - tw) // 2)); d.text((i * tw + 8, 40), l, font=F(16), fill=(255, 255, 255))
    r.paste(g, (W - gw, 34)); d.text((W - gw + 6, 40), 'phone, 4.8 m', font=F(15), fill=(255, 255, 255)); rows.append(r)
for k, l in (('lineup_side', 'TRUE SIZE, side: old base Croakling | Croakrill | Croakara | Croakore | Croakarc'), ('lineup_tq', 'TRUE SIZE, three-quarter: the same five')):
    L = im(k); L = L.resize((W, int(L.height * W / L.width))); r = Image.new('RGB', (W, L.height + 34), BG); r.paste(L, (0, 34)); ImageDraw.Draw(r).text((12, 6), l, font=F(19), fill=(255, 214, 120)); rows.append(r)
S = Image.new('RGB', (W, sum(r.height for r in rows)), BG); y = 0
for r in rows: S.paste(r, (0, y)); y += r.height
S.save(OUT, quality=86); print(OUT, S.size)
