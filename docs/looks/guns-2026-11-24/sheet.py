# builds sheet.jpg (and, with --ref <private dir>, the gitignored sheet-with-ref.jpg) from scripts/m149-gun-shots.mts output
import sys, os
from PIL import Image, ImageDraw, ImageFont
src, ref = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n)
W = 1920; rows = []
def row(cells, h, title=None):   # cells: (file, caption, crop)
    ims = []
    for f, cap, crop in cells:
        i = Image.open(f if f.startswith('/') else f'{src}/{f}').convert('RGB')
        if crop: i = i.crop(crop)
        ims.append((i, cap))
    w = W // len(ims); r = Image.new('RGB', (W, h + 30 + (34 if title else 0)), '#f4f2ec'); d = ImageDraw.Draw(r); y = 34 if title else 0
    if title: d.text((12, 6), title, font=F(20), fill='#222')
    for k, (i, cap) in enumerate(ims):
        s = min((w - 8) / i.width, h / i.height); i = i.resize((int(i.width * s), int(i.height * s)), Image.LANCZOS)
        r.paste(i, (k * w + (w - i.width) // 2, y)); d.text((k * w + 10, y + h + 5), cap, font=F(15), fill='#444')
    rows.append(r)
P = (0, 180, 390, 844); DK = (240, 140, 1040, 740)
def build(out, withref):
    rows.clear()
    if withref: row([(ref + '/family.jpg', 'the locked refs (PRIVATE)', (0, 60, 2400, 1800))], 900, 'REF')
    row([('side.png', 'Backbone + holo 3,238 tris / Charred Rifle + ring 3,920 / Lance + prism 3,482 (6 to 8 draws each)', None), ('sights.png', 'holo 1x, prism 3x, the Charred Rifle ring: each its own part', None)], 600, 'M149 s1: the new guns, side on. OFF in the game (owner preview: /shimmer/dev/guns, New model)')
    row([(f'{g}-34.png', c, (0, 20, 1000, 440)) for g, c in [('backbone', 'Backbone'), ('charred-rifle', 'Charred Rifle'), ('lance', 'Lance')]], 260)
    row([('desk-bb-today-hip.png', 'TODAY', DK), ('desk-bb-holo-hip.png', 'NEW, holo', DK), ('desk-bb-prism-hip.png', 'NEW, prism', DK)], 470, 'In hand, desktop: Backbone (Alex\'s saved hands)')
    row([('desk-charred-today-hip.png', 'Charred TODAY', DK), ('desk-charred-ring-hip.png', 'Charred NEW (Backbone hands: it has no tune yet)', DK), ('desk-lance-today-hip.png', 'Lance TODAY', DK), ('desk-lance-prism-hip.png', 'Lance NEW (same)', DK)], 360)
    row([('desk-bb-today-aim.png', 'TODAY: the 2x ring (view zoom not drawn on this page)', DK), ('desk-bb-holo-aim.png', 'NEW holo 1x', DK), ('desk-bb-prism-aim.png', 'NEW prism 3x: zoom inside the lens', DK), ('desk-charred-ring-aim.png', 'NEW Charred ring 1x', DK)], 360, 'Aiming, desktop')
    row([('phone-bb-today-aim.png', 'TODAY', P), ('phone-bb-holo-aim.png', 'holo', P), ('phone-bb-prism-aim.png', 'prism on Backbone', P), ('phone-lance-prism-aim.png', 'prism on Lance', P), ('phone-charred-ring-aim.png', 'Charred ring', P)], 620, 'Aiming, 390x844')
    row([('phone-bb-today-hip.png', 'Backbone TODAY', P), ('phone-bb-holo-hip.png', 'Backbone NEW', P), ('phone-charred-ring-hip.png', 'Charred NEW', P), ('phone-lance-prism-hip.png', 'Lance NEW', P)], 560, 'In hand, 390x844')
    row([('today-third.png', 'TODAY', None), ('backbone-third.png', 'Backbone', None), ('charred-rifle-third.png', 'Charred Rifle', None), ('lance-third.png', 'Lance', None)], 470, 'Third person, in the keeper\'s hands (the two-handed hold is this bench\'s pose)')
    if os.path.exists(f'{src}/ather-phone-prism.png'): row([('ather-phone-holo.png', 'holo', None), ('ather-phone-prism.png', 'prism', None)], 700, 'In the Wilds, dev server, 390x844 (preview hook, not in the live game)')
    o = Image.new('RGB', (W, sum(r.height for r in rows) + 10 * len(rows)), '#f4f2ec'); y = 0
    for r in rows: o.paste(r, (0, y)); y += r.height + 10
    o.save(out, quality=86)
here = os.path.dirname(os.path.abspath(__file__))
build(here + '/sheet.jpg', False)
if ref: build(here + '/sheet-with-ref.jpg', True)
