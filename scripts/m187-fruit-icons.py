# M187: paints the fruit icons JSON (scripts/m187-fruit-icons.mts) to public/open/load/fruit-<id>.png, x4 nearest.
import json, sys
from PIL import Image
S, K = 32, 4
for fid, d in json.load(sys.stdin).items():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    for i, v in enumerate(d['px']):
        if v:
            h = d['pal'][v - 1]
            im.putpixel((i % S, i // S), (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255))
    bb = im.getbbox()
    im = im.crop(bb).resize(((bb[2] - bb[0]) * K, (bb[3] - bb[1]) * K), Image.NEAREST)
    im.save(f'public/open/load/fruit-{fid}.png', optimize=True)
    print('wrote', fid, im.size)
