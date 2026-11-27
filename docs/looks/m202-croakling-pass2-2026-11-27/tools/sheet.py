"""python sheet.py <render dir> <out.jpg>: M202 pass 2 sheet (Alex 11-27). Per form OLD | NEW, each side + three-quarter (look.py), the new
Croakarc's sprawl walk from above (poses.py), then the base Croakling + OLD and NEW forms at TRUE relative size, side and three-quarter
(lineup.py). Ref-free (the repo is public; the locked art is athernyx assets/stage2 008 / 028)."""
import sys
from PIL import Image, ImageDraw, ImageFont
R, OUT = sys.argv[1], sys.argv[2]; F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n); W = 2040; BG = (24, 28, 30); Y = (255, 214, 120)
im = lambda k: Image.open(f'{R}/{k}.png').convert('RGB')
def row(label, tiles, h=480):
    r = Image.new('RGB', (W, h + 34), BG); d = ImageDraw.Draw(r); d.text((12, 6), label, font=F(19), fill=Y); x = 0; tw = W // len(tiles)
    for k, l in tiles:
        t = im(k); t = t.resize((tw, int(t.height * tw / t.width))) if t.width / t.height > tw / h else t.resize((int(t.width * h / t.height), h)); r.paste(t, (x + (tw - t.width) // 2, 34 + (h - t.height) // 2)); d.text((x + 8, 40), l, font=F(16), fill=(255, 255, 255)); x += tw
    return r
rows = [Image.new('RGB', (W, 56), BG)]; ImageDraw.Draw(rows[0]).text((12, 12), "M202 Croakling line PASS 2 (Alex 11-27), OWNER PREVIEW: Croakrill + Croakarc, old vs new. Croakara + Croakore unchanged.", font=F(22), fill=(255, 255, 255))
rows.append(row('CROAKRILL (Water): fronds now soft flat ribbons, four a side, layered, drifting back and down; flowing ripple lines, glossy teal, full webs', [('rillold_side', 'OLD side'), ('rillold_tq', 'OLD three-quarter'), ('rill_side', 'NEW side'), ('rill_tq', 'NEW three-quarter')]))
rows.append(row('CROAKARC (Storm): now a SKINK: long low body slung between splayed legs, belly near the ground, head forward, long curling tail; glowing branching lightning (NEW shown zoomed out 0.6x)', [('arcold_side', 'OLD side'), ('arcold_tq', 'OLD three-quarter'), ('arcnew_side', 'NEW side'), ('arcnew_tq', 'NEW three-quarter')]))
rows.append(row('CROAKARC rig: a lizard SPRAWL walk from above (diagonal pairs, the spine swings in an S, tail sweeps), then scurry side, sit, lie (Blender importer, her own 24-bone rig)', [('poses/arc_walk_top_0', 'walk 0'), ('poses/arc_walk_top_1', 'walk 1/4'), ('poses/arc_walk_top_2', 'walk 1/2'), ('poses/arc_walk_top_3', 'walk 3/4')], 330))
rows.append(row('', [('poses/arc_run_side_1', 'scurry'), ('poses/arc_idle_tq_0', 'idle'), ('poses/arc_sit_tq_0', 'sit'), ('poses/arc_lie_tq_0', 'lie')], 330))
for k, l in (('lineup_1.5708', 'TRUE SIZE, side: base Croakling | Croakrill OLD | Croakrill NEW | Croakarc OLD | Croakarc NEW'), ('lineup_-0.6', 'TRUE SIZE, three-quarter: the same five')):
    L = im(k); L = L.resize((W, int(L.height * W / L.width))); r = Image.new('RGB', (W, L.height + 34), BG); r.paste(L, (0, 34)); ImageDraw.Draw(r).text((12, 6), l, font=F(19), fill=Y); rows.append(r)
S = Image.new('RGB', (W, sum(r.height for r in rows)), BG); y = 0
for r in rows: S.paste(r, (0, y)); y += r.height
S.save(OUT, quality=86); print(OUT, S.size)
