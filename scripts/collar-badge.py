"""Stamp the collar indicator onto a spirit's world portrait.

Alex, 2026-08-27: "for now the collared spirits can have a small icon at the top right of the
portrait that indicates it's collared."

★ WHY A BADGE AND NOT A RE-RENDER. Canon's collared read is a whole treatment — `moglins.md:88`
locks `collared-spirit-canon.png` as "a forged-iron band + lock at the neck, the spirit's glow
extinguished, body drained grey, eyes downcast", and says it is "reusable for ANY collared spirit —
swap the source spirit, same edit". That is the right answer eventually and it costs an API pass per
species. A badge is the placeholder that gets the SIGNAL on screen now: canon calls the collar "the
villain signal in any frame", and a patrol currently drags a purple box, so any legible collar beats
the box. The drained-body treatment stays on the queue rather than being faked with a grey filter.

★ BAKED INTO THE TEXTURE, NOT ADDED AS A CHILD SPRITE. Alex profiled the world at 84% GPU-bound and
`spirit-portrait-body.ts` shares one material per species precisely to stop per-body allocation; a
badge sprite parented to each resident would put the draw call straight back. One extra texture per
species is bounded, a draw per collared body is not.

⚠ THE GLYPH IS BUILD VOCABULARY, NOT CHARACTER ART. It is an iron ring and a lock drawn from
primitives — an indicator, the same class of thing as a cooldown gauge. Character art off the locked
refs is Alex's, and nothing here touches a creature.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

WORLD = Path('public/spirits/world')
SPECIES = ['fox', 'owl', 'turtle', 'axolotl', 'bat', 'firefly', 'frog', 'rabbit', 'water-bear', 'hummingbird']

IRON_DARK = (34, 36, 42, 255)
IRON = (86, 92, 104, 255)
IRON_LIT = (150, 158, 172, 255)


def badge(size: int) -> Image.Image:
    """A forged-iron band with a lock, drawn to survive being 12 pixels wide.

    ⚠ THE FIRST VERSION OF THIS WAS DESIGNED AT 256px AND DIED AT SHIP SIZE. It had a thin ring, an
    inner highlight arc and an outlined lock body with a keyhole — all legible on a contact sheet and
    all gone by 34px, which is roughly what a resident measures in a world shot. At 24px it was a
    speck. Canon calls the collar "the villain signal in any frame"; a signal you cannot see fails its
    only job, and checking it at authoring size is what hid that.

    So this is drawn to a small-size budget instead: ONE bold silhouette, ONE bright rim, no interior
    line work. Detail below about three pixels is not detail, it is noise that averages to grey.
    """
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # A solid dark disc carries the shape at any size; the bright rim is what separates it from a
    # dark creature (Noctyx) and from the dark sky behind a distant one.
    d.ellipse([0, 0, S - 1, S - 1], fill=IRON_DARK)
    d.ellipse([0, 0, S - 1, S - 1], outline=IRON_LIT, width=max(2, int(S * 0.09)))
    # The lock, as a filled silhouette in the LIGHT tone — a bright mark on a dark disc reads much
    # further out than a dark mark with a bright outline, which is what the first version tried.
    bw, bh = int(S * 0.42), int(S * 0.34)
    bx, by = (S - bw) // 2, int(S * 0.46)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=int(S * 0.07), fill=IRON_LIT)
    # the shackle: a thick arc above the body, same light tone, no outline
    d.arc([bx + int(bw * 0.16), by - int(bh * 0.95), bx + bw - int(bw * 0.16), by + int(bh * 0.15)],
          start=180, end=360, fill=IRON_LIT, width=max(3, int(S * 0.085)))
    return im.resize((size, size), Image.LANCZOS)


def stamp(src: Path, dest: Path) -> tuple[int, int]:
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    # 30% of the SHORT side, so a wide portrait (Dewbear is 256x178) and a tall one get the same
    # apparent badge rather than one scaled to whichever dimension happened to be larger.
    size = max(22, int(min(w, h) * 0.26))
    margin = max(2, int(min(w, h) * 0.03))
    b = badge(size)
    im.alpha_composite(b, (w - size - margin, margin))
    im.save(dest, quality=90, method=6)
    return im.size


if __name__ == '__main__':
    only = sys.argv[1:] or SPECIES
    missing = [s for s in only if not (WORLD / f'{s}.webp').exists()]
    if missing:
        print(f'✗ no world portrait for: {", ".join(missing)} — run scripts/spirit-cutout.py first')
        sys.exit(1)
    for s in only:
        size = stamp(WORLD / f'{s}.webp', WORLD / f'{s}-collared.webp')
        print(f'  {s:<12} collared  {size[0]}x{size[1]}')
    print(f'{len(only)} collared portraits')
