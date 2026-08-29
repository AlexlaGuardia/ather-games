// The burrow-town pool's oracle. Run: npx tsx src/app/shimmer/voxel/burrowtown.test.ts
//
// ★ THE PROPERTY: **the free town must not be expressible as a greyed one.** Canon's guardrail is
// *"never grey a free Moglin's home"*, and Gloview, the Warren and the Snagbarrows all run this one
// generator. A guardrail that lives in someone's memory is one refactor from being gone; these asserts
// are the version that fails loudly.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DOWNBARROW, DOWNBARROW_CFG, overlayFor, type BurrowKind, type Doctrine,
} from './burrowtown'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const KINDS: BurrowKind[] = ['green', 'homes', 'dell', 'lane', 'mouth', 'bank']

// ── 1. ★★ THE ASSEMBLER'S HARD REQUIREMENT: BOTH EXTENTS ODD ──────────────────────────────────
// `jigsaw` hangs its sockets on a piece's centre column. An even extent has no centre, so the socket
// lands half a block off and every piece downstream of it inherits the offset.
{
  ok(DOWNBARROW.length >= 6, `★★ BLIND CHECK: ${DOWNBARROW.length} pieces in the pool — under 6 and the asserts below are vacuous`)
  const even = DOWNBARROW.filter(p => p.w % 2 === 0 || p.d % 2 === 0)
  ok(even.length === 0, `★★★ every extent is odd on both axes (${even.map(p => `${p.id} ${p.w}x${p.d}`).join(', ') || 'all odd'})`)
  ok(DOWNBARROW.every(p => p.weight > 0), '★ every piece can actually be rolled — a zero weight is a piece that exists and never appears')
}

// ── 2. ★★★ A TOWN ALWAYS HAS A GREEN, AND A HEART CAN ACTUALLY START ──────────────────────────
// The doctrine's heart is worn INTO the green. A town without one has nowhere to put the ring, and
// the Snagbarrows' whole set piece has no floor.
{
  const hearts = DOWNBARROW.filter(p => p.heart)
  ok(hearts.length >= 2,
    `★★★ there is a heart POOL, not a single fixed heart (${hearts.length}) — a fixed start made every one-piece ruin identical, and that reasoning still holds`)
  ok(hearts.every(p => p.kind === 'green'), '★★ every heart is a green')
  ok(hearts.every(p => !p.terminal),
    '★★★ no heart is a terminator — a terminal piece is only ever placed to CLOSE a branch, so a terminal heart could never start a town')
  ok(DOWNBARROW.some(p => p.terminal),
    '★★ and the pool has terminators at all — without one, a branch at maxDepth has nothing to close it')
}

// ── 3. ★★★ THE GUARDRAIL, MADE STRUCTURAL — a free town cannot come out greyed ────────────────
{
  for (const k of KINDS) {
    const o = overlayFor(k, 'free')
    ok(o.grey === 0 && o.lid === 0 && !o.rows && !o.holdRing && !o.irons,
      `★★★ '${k}' under FREE carries no doctrine at all (grey ${o.grey}, lid ${o.lid}, rows ${o.rows}, ring ${o.holdRing}, irons ${o.irons})`)
  }
}

// ── 4. ★★★ A RING IS A DOCTRINE, NOT A DEFAULT — and Hemlock has none ─────────────────────────
// *"A pit in every hold flattens three distinct villains into one."* The industry facet gets a swept
// sorting yard; only sport/status gets a ring.
{
  for (const k of KINDS) {
    const ind = overlayFor(k, 'industry')
    ok(!ind.holdRing && !ind.rows,
      `★★★ '${k}' under INDUSTRY has no ring and no rows — Hemlock is "an order", not a spectacle`)
  }
  const sportGreen = overlayFor('green', 'sport')
  ok(sportGreen.holdRing && sportGreen.rows,
    '★★★ under SPORT the green carries both the ring and the audience rows')
  for (const k of KINDS.filter(x => x !== 'green')) {
    const o = overlayFor(k, 'sport')
    ok(!o.holdRing && !o.rows,
      `★★ and nothing but the green does (${k} ring ${o.holdRing}, rows ${o.rows}) — the ring is worn into the old common green, not scattered`)
  }
}

// ── 5. ★★ THE GREY IS DEEPEST AT THE HEART ────────────────────────────────────────────────────
// *"drab-warm at the edges guttering to grey at the heart; greyest where the count is thickest."*
{
  for (const d of ['sport', 'industry'] as Doctrine[]) {
    const green = overlayFor('green', d).grey
    const others = KINDS.filter(k => k !== 'green').map(k => overlayFor(k, d).grey)
    ok(others.every(g => g < green),
      `★★★ under ${d} the green is the grey sink (${green} vs ${others.join(', ')}) — the player reads the hold's shape by walking toward the grey`)
    ok(green <= 1 && Math.min(...others) >= 0, '★ and every grey stays in 0..1')
  }
}

// ── 6. ★★ THE OVERLAY KEYS ON KIND, NOT ON ID ─────────────────────────────────────────────────
// A hand-kept id list goes stale the day somebody adds `green_wide`, and does it silently. Both greens
// must already agree — which is the observable consequence of keying on kind.
{
  const greens = DOWNBARROW.filter(p => p.kind === 'green')
  ok(greens.length >= 2, `★ BLIND CHECK: ${greens.length} green variants — one variant cannot demonstrate this`)
  const o = greens.map(g => JSON.stringify(overlayFor(g.kind, 'sport')))
  ok(new Set(o).size === 1,
    '★★★ every green variant gets the same overlay — a second green joins by BEING a green, not by being remembered')
  const src = readFileSync(join(__dirname, 'burrowtown.ts'), 'utf8')
  ok(src.length > 3000, '★★ BLIND CHECK: the module was actually read')
  ok(!/overlayFor[\s\S]{0,900}green_round/.test(src),
    '★★ and `overlayFor` names no piece id — keying on an id is the stale-list failure wearing a switch statement')
}

// ── 7. ⚠⚠ `ring` IS TAKEN BY ITS OWN OPPOSITE, SO THE IDENTIFIER MUST STAY QUALIFIED ───────────
// `plot-ring.ts` is *"THE HOME PLOT'S RING: your own spirits, about your own fold"* — the FREE version
// of this exact image. Canon's word for the collared floor is `ring`; the build cannot spend it twice.
{
  const src = readFileSync(join(__dirname, 'burrowtown.ts'), 'utf8')
  const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
  ok(/holdRing/.test(code), '★★ the collared floor is `holdRing`')
  ok(!/\bring\b\s*:/.test(code) && !/\bring\b\s*=/.test(code),
    '★★★ and nothing here declares a bare `ring` — third vocabulary collision in one day; grep before you build on a word')
  ok(!/\barena\b/.test(code),
    '★★ nor an `arena` — that identifier is the combat system\'s and means the inverse relationship')
}

// ── 8. ★ THE CONFIG CAN ACTUALLY REACH THE RULED SCALE ────────────────────────────────────────
// Alex's ≥150x200, granted at stronghold scale. ⚠ This is a REACHABILITY check, not a tuning claim —
// every number in that config is unswept and says so.
{
  const c = DOWNBARROW_CFG
  ok(c.envelope * 2 >= 200, `★★ the envelope admits a 200-block span (${c.envelope * 2})`)
  const biggest = Math.max(...DOWNBARROW.map(p => Math.max(p.w, p.d)))
  ok(c.envelope > biggest * 2,
    `★ and is comfortably larger than the largest piece (${c.envelope} vs ${biggest}) — an envelope near one piece's size cannot branch`)
  // ⚠⚠ SPAN IS NOT COVERAGE, AND THE FIRST VERSION OF THIS ASSERT CONFUSED THEM. It demanded the
  // budget cover a quarter of 150x200 by area and went red at 24% — but a burrow-town is a branching
  // cluster with hill, gorse and bramble between its masses, not a solid fill. A real village does
  // not cover a quarter of its own extent in buildings, so the assert was measuring a property nobody
  // wants. ★ What actually governs span is the CHAIN: each hop advances roughly one piece extent, so
  // reach ≈ maxDepth x typical extent, and the diameter is twice that. `maxPieces` bounds mass and
  // per-column cost; it does not decide how far the town gets.
  const typical = DOWNBARROW.reduce((s, p) => s + (p.w + p.d) / 2, 0) / DOWNBARROW.length
  const reach = c.maxDepth * typical
  ok(reach * 2 >= 150,
    `★★★ the chain can span the ruled footprint (maxDepth ${c.maxDepth} x ~${typical.toFixed(0)} = ${reach.toFixed(0)} out, ${(reach * 2).toFixed(0)} across, target >=150)`)
  ok(reach <= c.envelope,
    `★★ and the envelope does not clip the chain before it gets there (reach ${reach.toFixed(0)} vs envelope ${c.envelope}) — a chain that outruns its envelope is rejected at the edge, so the town silently stops short`)
  ok(c.maxPieces * typical * typical > 5000,
    `★ with enough mass in it to read as a town rather than a hamlet (~${Math.round(c.maxPieces * typical * typical)} sq blocks built)`)
  ok(c.sizeBias < 1,
    '★★★ sizeBias biases LARGE — a ruin should usually be a stump, a stronghold should usually be a country')
  ok(c.maxPieces <= 32,
    `★★ and the budget stays bounded (${c.maxPieces}) — every COLUMN re-derives the whole assembly, so this is a per-frame cost, not just a size`)
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ the free town cannot come out greyed — ${pass} passed`)
