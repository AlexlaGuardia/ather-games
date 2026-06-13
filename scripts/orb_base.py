#!/usr/bin/env python3
"""Generate a clean pixel-circle orb base to shade over in Aseprite.

Outputs a transparent PNG with: a 1px dark outline ring + a flat mid fill, using
a distance test so the silhouette is round with no hand-drawn jaggies. Open it in
Aseprite, lock this as the base layer, and paint shading + highlight on layers
above — never re-draw the edge.

Usage: orb_base.py out.png [size] [--fill RRGGBB] [--outline RRGGBB] [--preview N]
"""
import sys, math
from PIL import Image

def gen(size, fill, outline):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = img.load()
    c = size / 2.0
    r = size / 2.0 - 0.5            # inset half a pixel = clean edge
    disk = set()
    for y in range(size):
        for x in range(size):
            # sample the pixel centre; <= r is inside the disk
            if math.hypot(x + 0.5 - c, y + 0.5 - c) <= r:
                disk.add((x, y))
    for (x, y) in disk:
        # outline = a disk pixel with at least one 4-neighbour outside the disk
        edge = any((x+dx, y+dy) not in disk for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)))
        px[x, y] = outline if edge else fill
    return img

def hexrgb(s, a=255):
    s = s.lstrip('#')
    return (int(s[0:2],16), int(s[2:4],16), int(s[4:6],16), a)

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    out = sys.argv[1]
    size = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 64
    fill = hexrgb(sys.argv[sys.argv.index('--fill')+1]) if '--fill' in sys.argv else (60, 60, 72, 255)
    outline = hexrgb(sys.argv[sys.argv.index('--outline')+1]) if '--outline' in sys.argv else (20, 18, 28, 255)
    img = gen(size, fill, outline)
    img.save(out)
    msg = f'{out}  ({size}x{size})'
    if '--preview' in sys.argv:
        n = int(sys.argv[sys.argv.index('--preview')+1])
        p = out.rsplit('.',1)[0] + f'_x{n}.png'
        img.resize((size*n, size*n), Image.NEAREST).save(p)
        msg += f'  + preview {p}'
    print(msg)

if __name__ == '__main__':
    main()
