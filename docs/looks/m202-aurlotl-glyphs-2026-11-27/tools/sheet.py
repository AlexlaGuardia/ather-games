"""python3 sheet.py <before dir> <after dir> <out dir> [locked art png] : the before/after sheet. Rows: sit (front), chest close, flank
close, brow close; columns before | after. With the locked art it also writes sheet-with-ref.jpg (gitignored: the art never enters
this public repo)."""
import sys
from PIL import Image, ImageDraw
B, A, OUT = sys.argv[1:4]; REF = sys.argv[4] if len(sys.argv) > 4 else None
ROWS = [('sit_face', (150, 80, 550, 480), 'sit'), ('u_chest', (60, 0, 560, 500), 'chest + shoulders'), ('u_flank', (120, 200, 620, 700), 'flank + upper arm'), ('u_brow', (150, 300, 600, 600), 'brow')]
C = 360; pad = 34
def tile(d, name, box):
    im = Image.open(f'{d}/{name}.png').convert('RGB'); x0, y0, x1, y1 = box; im = im.crop((x0, y0, min(x1, im.width), min(y1, im.height)))
    im.thumbnail((C, C)); t = Image.new('RGB', (C, C), (76, 102, 107)); t.paste(im, ((C - im.width) // 2, (C - im.height) // 2)); return t
def build(ref):
    cols = 3 if ref else 2; W = cols * C + (cols + 1) * 10; H = pad + len(ROWS) * (C + 10) + 10
    s = Image.new('RGB', (W, H), (24, 22, 32)); d = ImageDraw.Draw(s)
    heads = (['locked art (ref)'] if ref else []) + ['before: placeholder sigil + rings', 'after: glyph panels (infusion markings)']
    for i, h in enumerate(heads): d.text((10 + i * (C + 10) + 6, 10), h, fill=(235, 225, 200))
    for r, (name, box, lab) in enumerate(ROWS):
        y = pad + r * (C + 10); c0 = 0
        if ref:
            if r == 0: im = Image.open(ref).convert('RGB'); im.thumbnail((C, C)); s.paste(im, (10, y))
            c0 = 1
        for k, dd in enumerate((B, A)): s.paste(tile(dd, name, box), (10 + (c0 + k) * (C + 10), y))
        d.text((10 + c0 * (C + 10) + 6, y + 6), lab, fill=(255, 240, 200))
    return s
build(None).save(f'{OUT}/sheet.jpg', quality=88)
if REF: build(REF).save(f'{OUT}/sheet-with-ref.jpg', quality=88)
print('ok')
