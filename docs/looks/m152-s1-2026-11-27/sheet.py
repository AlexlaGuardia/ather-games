# M152 s1: builds sheet.jpg from scripts/m152-twins-shots.mts output.   python3 sheet.py <shots dir> [out.jpg]
import sys, os
from PIL import Image, ImageDraw, ImageFont
src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sheet.jpg')
F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n)
W = 1920; rows = []
def row(cells, h, title=None):   # cells: (file, caption, crop)
    ims = []
    for f, cap, crop in cells:
        i = Image.open(f'{src}/{f}').convert('RGB')
        if crop: i = i.crop(crop)
        ims.append((i, cap))
    w = W // len(ims); r = Image.new('RGB', (W, h + 30 + (34 if title else 0)), '#f4f2ec'); d = ImageDraw.Draw(r); y = 34 if title else 0
    if title: d.text((12, 6), title, font=F(20), fill='#222')
    for k, (i, cap) in enumerate(ims):
        s = min((w - 8) / i.width, h / i.height); i = i.resize((int(i.width * s), int(i.height * s)), Image.LANCZOS)
        r.paste(i, (k * w + (w - i.width) // 2, y)); d.text((k * w + 10, y + h + 5), cap, font=F(15), fill='#444')
    rows.append(r)
P = (0, 200, 390, 844)
row([('side-1000.png', 'LEFT gun (rune 1, fires first) | RIGHT gun (rune 2); below: the Roar as drawn today, same scale', None), ('top-1000.png', 'from above, as held side by side | the Roar', None)], 520,
    'M152 s1: the DB2 Twins, a matched pair of sawn-off sidearms. OFF in the game (owner bench: /shimmer/dev/gun-kit?twins=side|top|34|core|hip|ads)')
row([('34-1000.png', 'three-quarter: two barrels each, short slotted shroud, sawn bronze band, no sights', None), ('core-700.png', 'from below: ONE core in two halves, split faces toward each other; example letters Stone (L) + Lightning (R), unlit', None)], 520)
row([('hip-1280.png', 'at the hip, desktop 1280x760', None), ('ads-1280.png', 'PROPOSED aim pose: both up side by side, forward, canted in, barrels under the mark, slight zoom', None)], 520, 'First person (no hands yet: the two-handed rig is a later slice)')
row([('hip-390.png', 'hip, 390x844', P), ('ads-390.png', 'aim, 390x844', P)], 560, 'Phone')
H = sum(r.height for r in rows); sheet = Image.new('RGB', (W, H), '#f4f2ec'); y = 0
for r in rows: sheet.paste(r, (0, y)); y += r.height
sheet.save(out, quality=86); print(out, sheet.size)
