#!/usr/bin/env python3
"""Headless .aseprite -> .png converter (no Aseprite GUI / CLI needed).

Flattens all visible layers of the FIRST frame into a single RGBA PNG. Handles
RGBA (depth 32), grayscale (16), and indexed (8) colour with a palette chunk.
Enough for static sprites/icons (orbs, button art). Not a full reader — no
animation export, no blend modes beyond normal.

Usage: ase2png.py in.aseprite out.png [--scale N]
"""
import struct, zlib, sys, os

def u16(b, o): return struct.unpack_from('<H', b, o)[0]
def s16(b, o): return struct.unpack_from('<h', b, o)[0]
def u32(b, o): return struct.unpack_from('<I', b, o)[0]

def load_ase(path):
    with open(path, 'rb') as f:
        data = f.read()
    magic = u16(data, 4)
    if magic != 0xA5E0:
        raise ValueError(f'not an aseprite file (magic={magic:#x})')
    frames = u16(data, 6)
    W, H = u16(data, 8), u16(data, 10)
    depth = u16(data, 12)            # 32 rgba, 16 gray, 8 indexed
    transparent = data[28]
    palette = {}                     # index -> (r,g,b,a)
    canvas = bytearray(W * H * 4)    # RGBA, zeroed = transparent

    off = 128
    # We only flatten the first frame (static art).
    frame_bytes = u32(data, off)
    fmagic = u16(data, off + 4)
    if fmagic != 0xF1FA:
        raise ValueError('bad frame magic')
    nchunks = u32(data, off + 12)
    if nchunks == 0:
        nchunks = u16(data, off + 6)
    p = off + 16

    cels = []
    for _ in range(nchunks):
        csize = u32(data, p)
        ctype = u16(data, p + 4)
        body = data[p + 6: p + csize]
        if ctype in (0x2019,):       # palette
            psize = u32(body, 0)
            first = u32(body, 4)
            q = 20
            for i in range(psize):
                flags = u16(body, q)
                r, g, b, a = body[q+2], body[q+3], body[q+4], body[q+5]
                palette[first + i] = (r, g, b, a)
                q += 6
                if flags & 1:        # has name
                    nlen = u16(body, q); q += 2 + nlen
        elif ctype in (0x0004, 0x0011):  # old palette chunks
            pass
        elif ctype == 0x2005:        # cel
            layer = u16(body, 0)
            x, y = s16(body, 2), s16(body, 4)
            celtype = u16(body, 7)
            if celtype == 2:         # compressed image
                cw, ch = u16(body, 16), u16(body, 18)
                raw = zlib.decompress(body[20:])
                cels.append((layer, x, y, cw, ch, raw))
            elif celtype == 0:       # raw image
                cw, ch = u16(body, 16), u16(body, 18)
                cels.append((layer, x, y, cw, ch, body[20:]))
        p += csize

    def px(raw, i):
        if depth == 32:
            o = i * 4
            return raw[o], raw[o+1], raw[o+2], raw[o+3]
        if depth == 16:
            o = i * 2
            v, a = raw[o], raw[o+1]
            return v, v, v, a
        # indexed
        idx = raw[i]
        if idx == transparent:
            return 0, 0, 0, 0
        return palette.get(idx, (0, 0, 0, 0))

    # paint cels in order (lower layers first), normal alpha-over.
    for (_layer, x, y, cw, ch, raw) in cels:
        for j in range(ch):
            for i in range(cw):
                r, g, b, a = px(raw, j * cw + i)
                if a == 0:
                    continue
                cx, cy = x + i, y + j
                if 0 <= cx < W and 0 <= cy < H:
                    o = (cy * W + cx) * 4
                    if a == 255:
                        canvas[o:o+4] = bytes((r, g, b, a))
                    else:            # source-over composite
                        ba = canvas[o+3]
                        if ba == 0:
                            canvas[o:o+4] = bytes((r, g, b, a))
                        else:
                            na = a + ba * (255 - a) // 255
                            for k, sc in enumerate((r, g, b)):
                                bc = canvas[o+k]
                                canvas[o+k] = (sc * a + bc * ba * (255 - a) // 255) // max(na, 1)
                            canvas[o+3] = na
    return W, H, bytes(canvas)

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    scale = 1
    if '--scale' in sys.argv:
        scale = int(sys.argv[sys.argv.index('--scale') + 1])
    from PIL import Image
    W, H, rgba = load_ase(src)
    img = Image.frombytes('RGBA', (W, H), rgba)
    if scale > 1:
        img = img.resize((W * scale, H * scale), Image.NEAREST)
    img.save(dst)
    print(f'{os.path.basename(src)} -> {dst}  ({W}x{H}{"" if scale==1 else f", x{scale}"})')

if __name__ == '__main__':
    main()
