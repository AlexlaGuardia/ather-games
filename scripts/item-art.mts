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

type Status = 'derived' | 'flora' | 'painted' | 'missing' | 'blank'
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

// ── Classify by calling the shipped path, never by restating its rules ─────────────────────────
const rows: Row[] = [...sources.entries()]
  .map(([id, from]): Row => {
    // ★ ASK THE SHIPPED CHAIN, never a local copy of its order. This used to re-state the
    // fallback here and drifted the same day: flora icons rendered in game while this file still
    // called grass unpainted.
    const src = iconSourceFor(id)
    if (src === 'block') return { id, status: 'derived', from: [...from] }
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
  const drawn = rows.filter(r => r.status === 'derived' || r.status === 'painted' || r.status === 'flora')
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
