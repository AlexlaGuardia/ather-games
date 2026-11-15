"""Social share card (public/og-ather.png, 1200x630; renamed from og.png so platform caches refetch) from the landing key art (Jin hub, 2026-11-15).
Fonts are the site's own (Cormorant Garamond variable + Chakra Petch, OFL), copied from the Next build's media.
Usage: python3 tools/art/build_og.py   (needs tools/art/landing/hero-1.png, the gen_landing.py source)"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
W, H = 1200, 630
GOLD, INK, TEXT = (212, 168, 67), (5, 6, 14), (236, 232, 222)

src = Image.open(os.path.join(HERE, "landing", "hero-1.png")).convert("RGB")
s = W / src.width * 1.12                              # a touch of zoom so the island fills the right half
im = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
x0 = im.width - W - round(im.width * 0.02); y0 = round((im.height - H) * 0.35)
im = im.crop((x0, y0, x0 + W, y0 + H))

# left fade for the title, bottom fade to the page ink
shade = Image.new("L", (W, H))
px = shade.load()
for x in range(W):
    a = max(0.0, 1 - x / (W * 0.62)) ** 1.4 * 0.72
    for y in range(H):
        b = max(0.0, (y - H * 0.55) / (H * 0.45)) ** 1.6 * 0.6
        px[x, y] = round(255 * min(1, a + b))
im = Image.composite(Image.new("RGB", (W, H), INK), im, shade)

title = ImageFont.truetype(os.path.join(HERE, "fonts", "cormorant-garamond-latin.woff2"), 168)
try: title.set_variation_by_axes([600])
except Exception: pass
small = ImageFont.truetype(os.path.join(HERE, "fonts", "chakra-petch-semibold.woff2"), 24)
body = ImageFont.truetype(os.path.join(HERE, "fonts", "chakra-petch-semibold.woff2"), 30)

def spaced(d, xy, text, font, fill, track):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill); x += d.textlength(ch, font=font) + track

glow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
L = 72
for d, fill in ((g, (5, 6, 14, 170)),):
    spaced(d, (L, 168), "AN OPEN-WORLD SANDBOX", small, fill, 6)
    d.text((L, 196), "Ather", font=title, fill=fill)
    d.text((L, 410), "Walk it, build on it, play it with friends.", font=body, fill=fill)
glow = glow.filter(ImageFilter.GaussianBlur(10))
im = Image.alpha_composite(im.convert("RGBA"), glow)
d = ImageDraw.Draw(im)
spaced(d, (L, 168), "AN OPEN-WORLD SANDBOX", small, GOLD, 6)
d.text((L, 196), "Ather", font=title, fill=TEXT)
d.text((L, 410), "Walk it, build on it, play it with friends.", font=body, fill=(220, 216, 206))
spaced(d, (L, 548), "ATHER.GAMES", small, GOLD, 5)
out = os.path.join(ROOT, "public", "og-ather.png")
im.convert("RGB").save(out, optimize=True)
print(out, os.path.getsize(out))
