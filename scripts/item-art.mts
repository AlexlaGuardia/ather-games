// The item-art checklist — which items have art, which are waiting on Alex, and which are lying.
//
// Run: npx tsx scripts/item-art.mts            (report to stdout + write ITEM-ART.md)
//      npx tsx scripts/item-art.mts --sheet    (also render item-art.png, every icon as it ships)
//
// ── ★ WHY THIS IS DERIVED AND NOT A HAND-KEPT LIST (2026-08-12, Alex asked for a checklist) ──────
// A markdown list of "items still needing art" is correct on the day it is written and wrong the
// first time somebody adds a block. It cannot know a new item appeared, it cannot know an old one
// got drawn, and — the failure that actually costs a session — it cannot know that an item it lists
// as DONE renders as nothing. Every stale-doc lesson in PATTERNS.md is this shape: a note asserting
// a state that the code stopped agreeing with, still being believed because nobody re-checks a box
// already ticked.
//
// So the checklist is generated from the same three tables the game reads, and it classifies by
// CALLING the shipped icon path rather than by describing it. If this says an item is drawn, the
// bag is drawing it.
//
// ★ IT REPORTS, IT DOES NOT GATE — deliberately, and the first run is why. It found two items
// (`pure_spike`, `moonkoi_rinstick`) wired into ITEM_ICONS with all-zero frames: the tier-3
// prospecting and rinning tools, listed as drawn in the item editor and drawing nothing. That is a
// real find and it is also ART, which is Alex's and cannot be fixed by whoever is running a build.
// Failing the build on it would put the repo permanently red and this script permanently unread —
// the outcome the paragraph above is written to avoid. `--strict` exits non-zero for the day
// somebody wants it in CI; the default job here is to be looked at.
//
// The in-game consequence is already handled where it belongs: `flatIcon` treats an all-zero frame
// as no art, so a blank-wired item falls through to the honest "not drawn yet" chip instead of
// rendering an invisible sprite. The lie only survives in the editor's list, which is what this
// report exists to say out loud.

import { readFileSync, writeFileSync } from 'node:fs'
import { ALL_BLOCKS, materialForItem } from '../src/app/shimmer/voxel/registry'
import { RECIPES } from '../src/app/shimmer/voxel/recipes'
import { TOOL_DEFS } from '../src/app/shimmer/engine/tools'
import { ITEM_ICONS, ITEM_PALETTES, SEED_PALETTES, PALETTE_COLLISIONS } from '../src/app/shimmer/sprites/items'
import { iconSourceFor, iconPixelsFor, flatIcon } from '../src/app/shimmer/voxel3d/tex/item-icon'
import { WORLD_ITEMS, FROM_FARMING, FROM_RINNING, FROM_FELLING } from '../src/app/shimmer/voxel3d/obtainable'

type Status = 'derived' | 'cross' | 'flora' | 'painted' | 'missing' | 'blank'
interface Row { id: string; status: Status; from: string[] }

/**
 * ── ★ THE ONE CHECK THAT WOULD HAVE CAUGHT BOTH SPRITE BUGS (2026-08-12) ────────────────────────
 * Every sprite literal declares its size and then supplies digits, and `px` reconciles the two by
 * silently ignoring the disagreement: too few digits leaves the tail zeroed, too many are dropped.
 * Nothing downstream can tell — consumers derive the edge from `sqrt(buffer.length)`, which reports
 * the DECLARED size no matter what was actually written.
 *
 * Both faults found today are that one disagreement wearing different clothes: 65 literals gave 256
 * digits to a 32×32 declaration (16×16 art, rendered as an 8-row scramble), and two gave 992 (rows
 * one column short, rendered skewed). Neither is visible in the data, in a type, or in a test — only
 * in the arithmetic between the two arguments and the string.
 *
 * So the guard is arithmetic, and it runs on the source text rather than the parsed module: by the
 * time a literal is a Uint8Array the evidence is gone.
 */
function raggedLiterals(): string[] {
  const file = new URL('../src/app/shimmer/sprites/items.ts', import.meta.url)
  const text = readFileSync(file, 'utf8')
  // `S` is the file's own size constant; read it rather than assuming 32, or this check quietly
  // stops meaning anything the day the file is retargeted.
  const S = Number(/^const\s+S\s*=\s*(\d+)/m.exec(text)?.[1] ?? 0)
  const bad: string[] = []
  const re = /const\s+([A-Z0-9_]+)\s*=\s*px\(\s*([A-Za-z0-9]+)\s*,\s*([A-Za-z0-9]+)\s*,\s*`([^`]*)`\s*\)/g
  for (const m of text.matchAll(re)) {
    const dim = (t: string) => (t === 'S' ? S : Number(t))
    const want = dim(m[2]) * dim(m[3])
    const got = m[4].replace(/[^0-9a-fA-F]/g, '').length
    if (want && got !== want) bad.push(`${m[1]}: declares ${m[2]}×${m[3]} (${want} digits) but has ${got}`)
  }
  return bad
}

// ── The reachable item universe ────────────────────────────────────────────────────────────────
// Everything a keeper can end up holding, gathered from the tables that can actually produce one.
// `from` is kept per item because "where does this even come from" is the first question asked
// about anything on the missing list, and answering it from memory is how the wrong thing gets
// drawn first.
const sources = new Map<string, Set<string>>()
const note = (id: string, where: string) => {
  if (!sources.has(id)) sources.set(id, new Set())
  sources.get(id)!.add(where)
}

for (const b of ALL_BLOCKS) {
  for (const d of b.drops) note(d.itemId, `drop: ${b.name}`)
}
for (const r of RECIPES) {
  note(r.output.itemId, 'crafted')
  for (const i of r.input) note(i.itemId, 'ingredient')
}
for (const t of Object.values(TOOL_DEFS)) note(t.id, `tool: ${t.skillId} t${t.tier}`)

// ── ★★★ AND THE THREE TABLES ABOVE ARE A HAND-ENUMERATED SOURCE LIST (2026-08-26) ──────────────
// Which is the exact shape `voxel3d/obtainable.ts` was written to end, and its header numbers five
// prior instances. This is the sixth, and it is the funniest one: the checklist whose entire purpose
// is to stop a stale hand-kept list asserting what art exists was keeping a stale hand-kept list of
// what a keeper can hold. Blocks, recipes and tools were the ways to obtain something on the day
// this file was written; FARMING, RINNING and FELLING all shipped afterwards and none of them told
// it. `WORLD_ITEMS` is the one derivation that hears about all of them.
//
// ⚠ THE MISS WAS NOT COSMETIC. `shimmerwheat_grain` renders as a SOLID MAGENTA BLOB — 171 of 171
// pixels the no-palette sentinel — and it is provably obtainable: `crops.ts` yields it and
// `obtainable.test.ts` asserts it by name. It was outside this file's universe, so the sweep below
// could not see it, so the worst-looking item in the game was the one item the report was blind to.
// An instrument that cannot see its subject reports nothing wrong.
//
// Union, never replacement: the loops above carry PROVENANCE ("drop: Deadfall", "tool: farming t1")
// that `WORLD_ITEMS` flattens away, and "where does this even come from" is the first question asked
// about anything on the missing list. So the buckets answer first and the set backstops them.
for (const id of FROM_FARMING) note(id, 'crop yield')
for (const id of FROM_RINNING) note(id, 'rinning catch')
for (const id of FROM_FELLING) note(id, 'felling drop')
for (const id of WORLD_ITEMS) note(id, 'in world')

// ── Classify by calling the shipped path, never by restating its rules ─────────────────────────
const rows: Row[] = [...sources.entries()]
  .map(([id, from]): Row => {
    // ★ ASK THE SHIPPED CHAIN, never a local copy of its order. This used to re-state the
    // fallback here and drifted the same day: flora icons rendered in game while this file still
    // called grass unpainted.
    const src = iconSourceFor(id)
    if (src === 'block') return { id, status: 'derived', from: [...from] }
    // ⚠ 'cross' JOINED THE CHAIN ON 2026-08-23 AND THIS LINE IS WHY THE HEADER ABOVE IS NOT ENOUGH.
    // Asking the shipped chain stops the ORDER drifting; it does nothing about a new ARM. Without
    // this the four saplings fall past every branch and land in `missing` — the checklist would have
    // called for hand art for an icon that already ships, which is the same lie as calling grass
    // unpainted, arriving by the other door. Widening a union leaves its consumers stale and quiet.
    if (src === 'cross') return { id, status: 'cross', from: [...from] }
    if (src === 'flora') return { id, status: 'flora', from: [...from] }
    if (src === 'painted') return { id, status: 'painted', from: [...from] }
    // `flatIcon` refuses a blank frame too, so ask ITEM_ICONS separately to tell "nobody drew it"
    // from "somebody wired an empty one" — they need different answers.
    if (ITEM_ICONS[id]) return { id, status: 'blank', from: [...from] }
    return { id, status: 'missing', from: [...from] }
  })
  .sort((a, b) => a.id.localeCompare(b.id))

const of = (s: Status) => rows.filter(r => r.status === s)
const blank = of('blank')

// ── The document ───────────────────────────────────────────────────────────────────────────────
const bar = (n: number) => `${n}`.padStart(3)
const lines: string[] = [
  '# Item Art — checklist',
  '',
  '> GENERATED by `npx tsx scripts/item-art.mts`. Do not hand-edit — it is rebuilt from the block',
  '> registry, the recipe table and the tool table, and it classifies each item by calling the same',
  '> icon path the game calls. A hand-kept version of this file would be wrong within a week.',
  '',
  `Items reachable in voxel3d: **${rows.length}**`,
  '',
  '| status | count | meaning |',
  '|---|---|---|',
  `| 🟦 derived | ${of('derived').length} | wears its own block's faces. Never needs hand art. |`,
  `| 🌿 cross | ${of('cross').length} | the world draws it as crossed quads, not a cube — the icon projects the same cross. Never needs hand art. |`,
  `| 🌱 flora | ${of('flora').length} | drawn by the world's own ground-cover generator. Never needs hand art. |`,
  `| 🟩 painted | ${of('painted').length} | hand-painted flat sprite in \`sprites/items.ts\`. |`,
  `| ⬜ missing | ${of('missing').length} | **needs art** — draws the plain chip today. |`,
  `| 🟥 blank | ${blank.length} | wired to an all-zero frame. Reads as done, renders nothing. |`,
  '',
]

if (blank.length) {
  lines.push(
    '## 🟥 Wired but blank — needs art, and the wiring says otherwise',
    '',
    'These have an entry in `ITEM_ICONS` pointing at an all-zero frame, so the item editor lists them',
    'as drawn. In game they fall through to the plain chip (`flatIcon` refuses a blank frame), so the',
    'bag is honest and only the editor is not. Draw them like anything on the list below.',
    '',
  )
  for (const r of blank) lines.push(`- [ ] \`${r.id}\` — ${r.from.join(', ')}`)
  lines.push('')
}

lines.push(
  '## ⬜ Needs art (Alex)',
  '',
  'Paint at `/shimmer/dev?mode=item` (32×32, palette-indexed). Each is one flat sprite; there is no',
  'view-angle call to make — these are held objects, not world props.',
  '',
)
for (const r of of('missing')) lines.push(`- [ ] \`${r.id}\` — ${r.from.join(', ')}`)

if (of('flora').length) {
  lines.push('', '## 🌱 Drawn by the flora generator — nothing to draw', '')
  lines.push('Ground cover has no block face, but the world draws it procedurally, so the icon comes')
  lines.push('from the same fill (`voxel3d/tex/flora-tex.ts`). Hand-painting one would create a second')
  lines.push('source of truth for what a tuft looks like.', '')
  for (const r of of('flora')) lines.push(`- \`${r.id}\``)
}

lines.push('', '## 🟩 Painted — already shipping', '')
for (const r of of('painted')) lines.push(`- [x] \`${r.id}\``)

lines.push(
  '',
  '## 🟦 Derived from block art — nothing to draw',
  '',
  'These wear the faces of the block they place. Drawing a flat icon for one would create a second',
  'source of truth for what that block looks like, and the two drift the first time a tile is retuned.',
  '',
)
for (const r of of('derived')) lines.push(`- \`${r.id}\``)

// A painted item with no palette of its own wears the generic 8-colour `ITEM_PALETTE`. That is a
// legitimate choice for plain things and a silent flattener for anything meant to read by colour:
// the four elemental crystals share one shape and were clearly drawn to be palette-swapped, so
// without their own entries `violet_crystal` and `water_crystal` both render as plain white
// diamonds and the element is unreadable. Shape is fixed; colour is the next art decision.
const generic = of('painted').filter(r => !(r.id in ITEM_PALETTES) && !(r.id in SEED_PALETTES))
if (generic.length) {
  lines.push(
    '',
    '## 🎨 Painted, but wearing the generic palette',
    '',
    'These render through the shared 8-colour `ITEM_PALETTE` because they have no entry in',
    '`ITEM_PALETTES`. Fine for plain objects; it flattens anything meant to read by colour. Add an',
    'entry to give one its own colours.',
    '',
  )
  for (const r of generic) lines.push(`- [ ] \`${r.id}\``)
}

if (PALETTE_COLLISIONS.length) {
  lines.push(
    '',
    '## ⚠ Palette collisions — a look call, not a bug',
    '',
    'These appear in both `SEED_PALETTES` and `ITEM_PALETTES` with different colours. The game shows',
    'the `SEED_PALETTES` entry (see `paletteForItem`). Ruling which is correct is Alex\'s call; until',
    'then a palette edit to one of these in the item editor will visibly not stick.',
    '',
  )
  for (const id of PALETTE_COLLISIONS) lines.push(`- \`${id}\``)
}

lines.push('')
writeFileSync(new URL('../ITEM-ART.md', import.meta.url), lines.join('\n'))

console.log(`\nitem art — ${rows.length} reachable items`)
console.log(`  🟦 derived ${bar(of('derived').length)}   (block faces, nothing to draw)`)
console.log(`  🌿 cross   ${bar(of('cross').length)}   (crossed quads, nothing to draw)`)
console.log(`  🟩 painted ${bar(of('painted').length)}   (flat sprite shipping)`)
console.log(`  ⬜ missing ${bar(of('missing').length)}   (plain chip — needs Alex)`)
console.log(`  🟥 blank   ${bar(blank.length)}   (wired to an empty frame)`)
if (of('missing').length) {
  console.log('\n  needs art:')
  for (const r of of('missing')) console.log(`    ${r.id.padEnd(24)} ${r.from.join(', ')}`)
}
console.log('\nwrote ITEM-ART.md')

// ── Optional contact sheet, rendered through the shipped rasterisers ───────────────────────────
if (process.argv.includes('--sheet')) {
  const sharp = (await import('sharp')).default
  const S = 48, PAD = 6, COLS = 8, BG = [24, 24, 27]
  // ⚠ EVERY STATUS THAT SHIPS A PICTURE, or the sheet cannot see the thing it exists to show. This
  // omitted 'cross' for as long as it took to write the line above it — the contact sheet would have
  // been blind to precisely the four icons that had just changed.
  const drawn = rows.filter(r => r.status === 'derived' || r.status === 'painted' || r.status === 'flora' || r.status === 'cross')
  const H = Math.ceil(drawn.length / COLS) * (S + PAD) + PAD
  const W = COLS * (S + PAD) + PAD
  const sheet = Buffer.alloc(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    sheet[i * 4] = BG[0]; sheet[i * 4 + 1] = BG[1]; sheet[i * 4 + 2] = BG[2]; sheet[i * 4 + 3] = 255
  }
  drawn.forEach((r, i) => {
    const px = iconPixelsFor(r.id, S)!
    const ox = PAD + (i % COLS) * (S + PAD), oy = PAD + Math.floor(i / COLS) * (S + PAD)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const s = (y * S + x) * 4
      if (px[s + 3] === 0) continue                       // transparent sprite pixel keeps the backdrop
      const d = ((oy + y) * W + ox + x) * 4
      sheet[d] = px[s]; sheet[d + 1] = px[s + 1]; sheet[d + 2] = px[s + 2]
    }
  })
  const out = new URL('../item-art.png', import.meta.url).pathname
  await sharp(sheet, { raw: { width: W, height: H, channels: 4 } }).png().toFile(out)
  console.log(`wrote ${out} (${drawn.length} icons)`)
}

// ── ★ THE SENTINEL SWEEP — "PAINTED" IS NOT THE SAME CLAIM AS "LOOKS LIKE ANYTHING" (2026-08-26) ─
// Everything above classifies by asking which ARM of the chain answers for an item. That is the
// right question for *is there art* and it is silent about *is the art wearing real colours*, so 28
// items sat in the 🟩 painted column — "flat sprite shipping" — while `shimmerwheat_grain` rendered
// as a SOLID MAGENTA BLOB, 171 of 171 pixels.
//
// `#d544c8` is slot 0 of the default `ITEM_PALETTE`: a deliberate screaming pink meaning *no palette
// was ever chosen for this item*. `flatIconPixels` maps pixel index 1 → `palette[0]`, so any sprite
// that uses index 1 without its own `ITEM_PALETTES` entry paints that index in the sentinel and
// ships. This is the SECOND COHORT of the bug `sprites/items.ts` records under 2026-08-12 — that
// round fixed 13 items which HAD a hand-tuned palette and were not reading it, by routing every
// surface through `paletteForItem`. It could not fix, and did not look for, items with no palette to
// read. Those kept shipping, and nothing ever said so out loud.
//
// ⚠ THE REPORT IS WHY IT SURVIVED. A checklist calling all 28 "shipping" is an instrument failing
// toward *nothing to see here* — the cheap direction, the one nobody investigates. The colours
// themselves are Alex's call and this does not guess at them; it only refuses to keep calling them
// done. Derived by rendering the SHIPPED pixels and looking for the sentinel, never a list of ids,
// so an item recoloured tomorrow leaves this list without anyone editing it.
const SENTINEL = [0xd5, 0x44, 0xc8] as const
const screaming = of('painted')
  .map(r => {
    const px = iconPixelsFor(r.id)
    if (!px) return null
    let cov = 0, hit = 0
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue
      cov++
      if (px[i] === SENTINEL[0] && px[i + 1] === SENTINEL[1] && px[i + 2] === SENTINEL[2]) hit++
    }
    return hit > 0 ? { id: r.id, hit, cov, pct: Math.round((100 * hit) / cov) } : null
  })
  .filter((v): v is { id: string; hit: number; cov: number; pct: number } => v !== null)
  .sort((a, b) => b.pct - a.pct)

if (screaming.length) {
  console.log(`\n⚠ ${screaming.length} "painted" item(s) render the #d544c8 no-palette sentinel:`)
  for (const r of screaming) {
    console.log(`    ${String(r.pct).padStart(3)}%  ${r.id.padEnd(22)} ${r.hit}/${r.cov}px`)
  }
  console.log('  These are listed as shipping and are wearing the default palette\'s slot 0 — the')
  console.log('  magenta that means nobody chose colours. Give each an ITEM_PALETTES entry (Alex).')
}

if (blank.length) {
  console.log(`\n⚠ ${blank.length} item(s) wired to a blank frame: ${blank.map(r => r.id).join(', ')}`)
  console.log('  The editor lists them as drawn; the game shows the plain chip. Draw or unwire.')
}

// ★ THIS one exits non-zero even without --strict, and the asymmetry is the point. Missing art is a
// person's pending work and gating on it would keep the repo red for weeks. A literal whose digits
// disagree with its declared size is not pending anything — it is art that is already silently
// rendering wrong, it is fixable by whoever introduced it, and it is invisible by every other means.
const ragged = raggedLiterals()
if (ragged.length) {
  console.error(`\n✖ ${ragged.length} sprite literal(s) disagree with their declared size:`)
  for (const r of ragged) console.error(`    ${r}`)
  console.error('  These render scrambled or skewed. Fix the data — do not teach the renderer to guess.')
  process.exit(1)
}
console.log('✓ all sprite literals match their declared size')

if (blank.length && process.argv.includes('--strict')) process.exit(1)
