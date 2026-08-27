"""Cut the canon base portraits out of their painted ground, for the world billboards.

Run: python3 scripts/spirit-cutout.py [--sheet]

★ WHY A CUTOUT AND NOT THE OVAL THE GRIMOIRE USES. In a PANEL a framed oval reads as a portrait
card, which is what the grimoire wants. In the WORLD a frame reads as a menu element standing in
the grass, and canon's whole direction line for the Home Plot ring is "inhabited rather than as a
menu". A cutout has no frame, so it reads as a creature. Same art, opposite treatment, and the
frame is the entire difference.

★ THE SOURCES HAVE NO ALPHA — they are paintings on a soft gradient ground, so the silhouette has
to be recovered. Region-growing from the border follows a gradient where a single-seed threshold
cannot, and the subject's hard edge stops it.

⚠ TOLERANCE IS PER-SPECIES AND MUST BE, because one global value silently eats pale subjects.
At tol 6 the Athowl is perfect and the Manalotl loses its whole BODY — a pale pink creature on a
warm ground, where only the darker gill-frills survive (85k subject px against ~400k for the
others). It does not error; it returns a confident, wrong, well-formed cutout. So: descend from
the highest tolerance and take the first that still keeps a plausible subject. Highest-that-works
gives the cleanest edge; the area floor is what stops it eating a body.
"""
import sys, json
from collections import deque
from pathlib import Path
from PIL import Image

ATHERNYX = Path('/root/athernyx')
OUT = Path('public/spirits/world')
EDGE = 256
AREA_FLOOR = 0.12          # a subject smaller than this is a fill that walked into the creature

def cut(path: Path, tol: int):
    im = Image.open(path).convert('RGBA'); w, h = im.size; px = im.load()
    seen = bytearray(w * h); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x]: q.append((x, y)); seen[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x]: q.append((x, y)); seen[y * w + x] = 1
    while q:
        x, y = q.popleft(); r, g, b, _ = px[x, y]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h: continue
            i = ny * w + nx
            if seen[i]: continue
            r2, g2, b2, _ = px[nx, ny]
            if abs(r2 - r) + abs(g2 - g) + abs(b2 - b) < tol:
                seen[i] = 1; q.append((nx, ny))
    # ★ largest connected blob only: the paintings carry loose light-motes that survive the fill
    # as free-floating specks and would orbit the creature in-world.
    solid = [not seen[i] for i in range(w * h)]
    comp = [-1] * (w * h); best = (0, -1); cid = 0
    for s in range(w * h):
        if not solid[s] or comp[s] >= 0: continue
        n = 0; dq = deque([s]); comp[s] = cid
        while dq:
            p = dq.popleft(); n += 1
            py, pxx = divmod(p, w)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = pxx + dx, py + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h: continue
                i = ny * w + nx
                if solid[i] and comp[i] < 0: comp[i] = cid; dq.append(i)
        if n > best[0]: best = (n, cid)
        cid += 1
    for y in range(h):
        for x in range(w):
            if comp[y * w + x] != best[1]: px[x, y] = (0, 0, 0, 0)
    return im, best[0] / (w * h)

# ── ★ THE VULNYX'S PAINTED GROUND-SHADOW (Alex flagged 2026-08-27) ────────────────────────────
# `cut()` keeps the largest connected blob to drop free-floating light-motes, and the Vulnyx source
# paints its contact shadow TOUCHING the paws with no gap — so the shadow is the same blob as the
# fox and survives every tolerance in the ladder. Confirmed NOT a tolerance problem: walking the
# ladder to 20 barely dents it (43.8%→42.8% subject) and 24 blows through the TAIL instead (24.6%,
# same cliff shape as the Athowl/Lepara failures this file's header warns about) — the shadow's own
# outer edge resists the fill almost as hard as the fox's, so there is no tolerance that clears one
# without breaking the other.
# ★ THE FIX IS GEOMETRIC, NOT COLOR. Per-row opaque-pixel WIDTH is flat (even falling, as legs
# taper toward the paws) right up until the shadow starts — then it flares outward for good, wider
# than any real limb gets. That knee is sharp and reproducible: find the row with the smallest
# width seen so far, then look for a sustained (not one noisy row) jump past it. Below that row,
# anything OUTSIDE the reference row's own x-span is shadow spilling sideways — including all of
# the far right, which is how the shadow reaches past the tail. FEATHER tapers the cut alpha near
# the window's edges instead of a hard vertical wall, so what is left reads as a soft contact
# shadow under the paws rather than a rectangle bitten out of a blob.
# ⚠ SCOPED TO fox ALONE. Moglin and jimbo show the same flare (checked while building this) but
# nobody asked for those yet and a shared knob is a shared risk — touch them in their own pass.
def trim_contact_shadow(im: Image.Image, flare_ratio: float = 1.12, persist: int = 3, pad: int = 10, feather: int = 10) -> Image.Image:
    w, h = im.size
    px = im.load()
    def row_extent(y: int):
        minx = maxx = None
        for x in range(w):
            if px[x, y][3] > 0:
                if minx is None: minx = x
                maxx = x
        return minx, maxx
    start = h * 3 // 5   # the shadow is a ground-contact feature — only look near the bottom
    widths = {y: row_extent(y) for y in range(start, h)}
    min_w, ref_y = None, None
    for y in range(start, h):
        mn, mx = widths[y]
        if mn is None: continue
        wd = mx - mn + 1
        if min_w is None or wd < min_w:
            min_w, ref_y = wd, y
            continue
        if wd > min_w * flare_ratio:
            hit = 0
            for k in range(persist):
                mn2, mx2 = widths.get(y + k, (None, None))
                if mn2 is not None and (mx2 - mn2 + 1) > min_w * flare_ratio: hit += 1
            if hit == persist:
                break   # ref_y stays at the row that set min_w — that is the pre-flare reference
    else:
        return im   # scanned the whole bottom with no sustained flare — nothing to trim
    lo, hi = widths[ref_y]
    lo, hi = max(0, lo - pad), min(w - 1, hi + pad)
    out = im.copy(); opx = out.load()
    for y in range(ref_y + 1, h):
        for x in range(w):
            r, g, b, a = opx[x, y]
            if a == 0: continue
            d = lo - x if x < lo else (x - hi if x > hi else 0)
            if d > 0:
                opx[x, y] = (r, g, b, int(a * max(0.0, 1 - d / feather)))
    return out

# ── ★ THE FOLK, AS PLACEHOLDERS (Alex, 2026-08-26) ────────────────────────────────────────────
# A patrol Moglin is a brown box today. These are 🔒 LOCKED canon refs, so a locked painting beats
# a pill even when it is not the RIGHT read yet.
# ⚠ AND THE MOGLIN ONE IS NOT THE RIGHT READ, WHICH IS WORTH WRITING DOWN RATHER THAN QUIETLY
# SHIPPING: `moglin-canon.png` is the shy, content, arms-folded BASE — which in canon is the
# DEFLATED state, the payoff after you free his spirit. The Thornlord swagger a patrol should wear
# is "sub-type renders in progress" and has no locked ref. So every patrol currently looks
# already-defeated, which inverts the beat the whole line is built on. Placeholder, on purpose,
# with the gap named. `folk-portraits.md` in GBOARD carries the ask.
FOLK = {
    'moglin':   'moglin-canon.png',       # base/deflated read — NOT the swagger a patrol wants
    'jimbo':    'jimbo-canon.png',        # the free Moglin — fits the reformed-Moglin NPCs exactly
    'hemlock':  'hemlock-canon.png',      # the collector-baron, for when he appears
}
FOLK_DIR = ATHERNYX / 'assets/folk-refs'

manifest = json.loads((ATHERNYX / 'CANON/design-briefs/spirits.json').read_text())
ref_dir = Path(manifest['_meta']['ref_dir'])
SPECIES = {'Vulnyx':'fox','Athowl':'owl','Shellmere':'turtle','Manalotl':'axolotl','Noctyx':'bat',
           'Luminara':'firefly','Croakling':'frog','Lepara':'rabbit','Dewbear':'water-bear','Hovari':'hummingbird'}

OUT.mkdir(parents=True, exist_ok=True)
rows, report = [], []
for s in manifest['spirits']:
    code = SPECIES[s['name']]
    src = (ref_dir / s['ref']).resolve()
    # ★★ PICK THE KNEE, NOT A THRESHOLD (and the threshold version shipped two broken cutouts).
    # A bare area floor accepted an Athowl with a bite out of its head and a Lepara that was ears
    # and no body — both cleared 12% comfortably and both were wrong. The floor cannot tell "a
    # small creature" from "a large creature the fill ate half of", because it only sees one
    # number and the answer is in how that number MOVES.
    # As tolerance rises the fill removes more, so subject area falls gently — until it breaks
    # through the silhouette, where it falls off a cliff. So: measure the whole ladder, and take
    # the highest tolerance whose area is still within RETAIN of the next-lower one. Cleanest edge
    # that has not started eating the creature. ⚠ Verified by LOOKING at a contact sheet, which is
    # the only instrument that caught the two failures in the first place.
    # ⚠ WALK THE LADDER FROM THE HIGH END. My first attempt at this walked upward from tol 2 and
    # picked 2 for seven of ten — at tol 2 the fill barely spreads, so nothing is removed, "subject"
    # reads 98% of the image, and every step up looks like a cliff. It detected the wrong knee: the
    # plateau is in the MIDDLE, not at the start. Rising tolerance removes more background (area
    # falls gently) until it breaks the silhouette (area falls off a cliff), so the answer is the
    # HIGHEST tolerance that costs little against the next lower one.
    # Lepara is the worked example: 8→15k, 7→78k, 6→191k, 5→358k, 4→366k. Only 5→4 is flat, so 5.
    RETAIN = 0.90
    ladder = {tol: cut(src, tol) for tol in (3, 4, 5, 6, 7, 8)}
    tols = sorted(ladder, reverse=True)
    chosen = None
    for t in tols[:-1]:
        if ladder[t][1] >= ladder[t - 1][1] * RETAIN:
            chosen = (t,) + ladder[t]; break
    if chosen is None:
        lo = tols[-1]; chosen = (lo,) + ladder[lo]
    tol, im, frac = chosen
    if frac < AREA_FLOOR:
        print(f'✗ {s["name"]}: best subject is only {frac:.1%} — hand-cut this one'); continue
    im = im.crop(im.getbbox())
    if code == 'fox':
        im = trim_contact_shadow(im).crop(im.getbbox())
    r = EDGE / max(im.size)
    im = im.resize((max(1, round(im.size[0] * r)), max(1, round(im.size[1] * r))), Image.LANCZOS)
    im.save(OUT / f'{code}.webp', quality=88, method=6)
    report.append({'name': s['name'], 'code': code, 'tol': tol, 'subject': round(frac, 3), 'size': im.size})
    rows.append((s['name'], code, im))
    print(f'  {s["name"]:<10} {code:<12} tol={tol}  subject={frac:.1%}  {im.size[0]}x{im.size[1]}')

for code, fname in FOLK.items():
    src = FOLK_DIR / fname
    if not src.exists():
        print(f'✗ {code}: {src} is missing — canon ref moved?'); continue
    RETAIN = 0.90
    ladder = {tol: cut(src, tol) for tol in (3, 4, 5, 6, 7, 8)}
    tols = sorted(ladder, reverse=True)
    chosen = None
    for t in tols[:-1]:
        if ladder[t][1] >= ladder[t - 1][1] * RETAIN: chosen = (t,) + ladder[t]; break
    if chosen is None:
        lo = tols[-1]; chosen = (lo,) + ladder[lo]
    tol, im, frac = chosen
    if frac < AREA_FLOOR:
        print(f'✗ {code}: best subject is only {frac:.1%} — hand-cut this one'); continue
    im = im.crop(im.getbbox())
    r = EDGE / max(im.size)
    im = im.resize((max(1, round(im.size[0] * r)), max(1, round(im.size[1] * r))), Image.LANCZOS)
    im.save(OUT / f'{code}.webp', quality=88, method=6)
    rows.append((code, code, im))
    print(f'  {code:<10} {"(folk)":<12} tol={tol}  subject={frac:.1%}  {im.size[0]}x{im.size[1]}')

if '--sheet' in sys.argv:
    pad, cw = 12, EDGE
    cols = 5; rowsN = (len(rows) + cols - 1) // cols
    sheet = Image.new('RGBA', (cw * cols + pad * (cols + 1), (EDGE + 30) * rowsN + pad * (rowsN + 1)), (26, 28, 34, 255))
    for i, (name, code, im) in enumerate(rows):
        cx = pad + (i % 5) * (cw + pad); cy = pad + (i // 5) * (EDGE + 30 + pad)
        sheet.alpha_composite(im, (cx + (cw - im.size[0]) // 2, cy + (EDGE - im.size[1])))
    sheet.convert('RGB').save('/tmp/claude-0/-root/4d58cbe7-3e98-4ded-9d7b-fd5c8546ba1b/scratchpad/cut-sheet.png')
    print('contact sheet → scratchpad/cut-sheet.png')
print(json.dumps(report))
