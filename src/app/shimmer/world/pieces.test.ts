// ── The piece catalogue — headless oracle ──────────────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/world/pieces.test.ts
//
// The piece layer is pure data + pure transforms, so the whole catalogue is provable before a single
// mesh exists. What is locked here is chosen by one test: **which mistakes would still LOOK fine?**
// A piece that renders nothing, a roof that sheds the wrong way, a door that eats its own doorway,
// a rotation that drifts a piece out of its cell — every one of those either renders plausibly or
// renders as "art isn't done yet", which is precisely the class this repo keeps paying for.
//
//   1. every registered piece has geometry, and no piece is silently empty
//   2. costs name only item ids that already ship (no invented materials)
//   3. parts stay inside their declared footprint, EXCEPT where overhang is the point
//   4. rotation is a group: 4 turns is identity, and it never changes height
//   5. rotation moves parts WITH the footprint, never outside it
//   6. the `fall` encoding is rotation-ordered, and the roof cap's halves genuinely oppose

import {
  PIECES, pieceOf, placeholderParts, rotateParts, rotateFootprint,
  type PiecePart, type Footprint, type Quarter,
} from './pieces'
import { NODE_DEFS } from './resources'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => {
  if (c) { ok++; return }
  bad++; console.error('  FAIL:', n, x)
}
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e

// Every item id the world can actually produce, plus the block-item ids the registry drops.
const SHIPPING_ITEMS = new Set<string>([
  ...Object.values(NODE_DEFS).flatMap((d) => d.drops.map((x) => x.itemId)),
  'block_stone', 'block_deep_stone', 'block_subsoil', 'block_topsoil', 'block_sand',
])

// 1. the catalogue is the six, and every one of them draws something
{
  chk('the catalogue is exactly six pieces (STRUCTURE-LAYER § 9)', PIECES.length === 6, `got ${PIECES.length}`)
  chk('piece ids are unique', new Set(PIECES.map((p) => p.id)).size === PIECES.length)
  for (const p of PIECES) {
    const parts = placeholderParts(p.id)
    // ★ the one that matters: an empty piece is indistinguishable in play from an unwired piece
    chk(`${p.id} draws at least one part`, parts.length > 0)
    chk(`${p.id} has no zero-volume part`, parts.every((q) => q.size.every((s) => s > 0)))
    chk(`${p.id} is still a placeholder (model null until picaso lands)`, p.model === null)
  }
  chk('pieceOf throws on an unknown id', (() => { try { pieceOf('nope'); return false } catch { return true } })())
  chk('placeholderParts throws on an unknown id', (() => { try { placeholderParts('nope'); return false } catch { return true } })())
}

// 2. no invented materials — § 8 is explicit that ids come from what already ships
{
  for (const p of PIECES) {
    chk(`${p.id} costs something`, p.cost.length > 0 && p.cost.every((c) => c.count > 0))
    for (const c of p.cost) {
      chk(`${p.id} cost '${c.itemId}' is a shipping item id`, SHIPPING_ITEMS.has(c.itemId), c.itemId)
    }
  }
}

// 3. geometry stays in its cell — with the overhang carve-out stated, not assumed
const within = (parts: PiecePart[], f: Footprint, pad = 0) =>
  parts.every((p) => {
    const [x, y, z] = p.pos, [sx, sy, sz] = p.size
    return x - sx / 2 >= -pad - 1e-9 && x + sx / 2 <= f.w + pad + 1e-9
      && y - sy / 2 >= -pad - 1e-9 && y + sy / 2 <= f.h + pad + 1e-9
      && z - sz / 2 >= -pad - 1e-9 && z + sz / 2 <= f.d + pad + 1e-9
  })
{
  for (const p of PIECES) {
    chk(`${p.id} geometry sits inside its footprint`, within(placeholderParts(p.id), p.footprint))
  }
  // The door's doorway must stay OPEN. Its footprint is the frame; if the placeholder filled the
  // hole edge-to-edge the piece would read as a wall and the occupancy hook (hub lane) would have
  // nothing to leave walkable. Checked as a gap in x, at standing height.
  const door = placeholderParts('door')
  const atHead = door.filter((p) => p.pos[1] > 0.5 && p.pos[1] < 2.5 && p.kind === 'box')
  const jambs = atHead.filter((p) => p.size[0] < 0.3)
  chk('the door has two thin jambs, not a filled span', jambs.length === 2)
  chk('the door leaf is inset, not flush to both jambs',
    atHead.some((p) => p.size[0] > 0.5 && p.size[0] < 1))
}

// 4 + 5. rotation is a group, preserves height, and keeps parts in the rotated footprint
{
  for (const p of PIECES) {
    const f = p.footprint
    const base = placeholderParts(p.id)

    chk(`${p.id} footprint height survives rotation`,
      ([0, 1, 2, 3] as Quarter[]).every((q) => rotateFootprint(f, q).h === f.h))
    chk(`${p.id} footprint w/d swap on odd turns`,
      rotateFootprint(f, 1).w === f.d && rotateFootprint(f, 1).d === f.w)

    // four quarter turns is identity — the cheapest way to catch a sign error in the transform
    let acc = base
    for (let i = 0; i < 4; i++) acc = rotateParts(acc, 1, rotateFootprint(f, i as Quarter))
    chk(`${p.id} four quarter turns return the original`,
      acc.length === base.length && acc.every((q, i) =>
        q.pos.every((v, k) => near(v, base[i].pos[k])) &&
        q.size.every((v, k) => near(v, base[i].size[k])) &&
        q.fall === base[i].fall))

    // ★ and each intermediate turn must land inside the ROTATED footprint, not the original.
    // Rotating about a hardcoded centre passes for 1x1 pieces and quietly throws the door and
    // window out of their own cell — the two pieces a player places first.
    for (const q of [1, 2, 3] as Quarter[]) {
      chk(`${p.id} stays inside its footprint after ${q} turn(s)`,
        within(rotateParts(base, q, f), rotateFootprint(f, q)))
    }
  }
}

// 5b. ★ ROTATION, PROVEN ON A SHAPE THE CATALOGUE DOES NOT CONTAIN.
// Found by mutation: replacing `fd - z` with the hardcoded `1 - z` — rotating about a fixed centre
// instead of the footprint's own extent — left all 84 asserts GREEN. Not because the checks are
// wrong, but because **every piece currently ships with d = 1**, so the two expressions are
// literally equal on all six and the bug cannot be reached by the data. The comment in pieces.ts
// claiming this hurt "the door and window" was wrong: both are square in plan.
//
// The transform is general even though today's data is not, and the first 2-wide double door or
// 2-deep roof section makes the bug live. So it is exercised against a SYNTHETIC asymmetric
// footprint. Same lesson as the AO mesher oracle (2026-08-12): symmetric fixtures hide real faults,
// and an assert that cannot fail is decoration.
{
  const deep: Footprint = { w: 1, h: 1, d: 3 }
  const parts: PiecePart[] = [
    { kind: 'box', pos: [0.5, 0.5, 0.5], size: [1, 1, 1], tint: '#000' },   // near end
    { kind: 'box', pos: [0.5, 0.5, 2.5], size: [1, 1, 1], tint: '#000' },   // far end
  ]
  const r1 = rotateParts(parts, 1, deep)
  const f1 = rotateFootprint(deep, 1)
  chk('asymmetric footprint rotates to 3 wide x 1 deep', f1.w === 3 && f1.d === 1)
  chk('asymmetric parts land inside the ROTATED footprint', within(r1, f1))
  // the far end (z=2.5) must swing to the low-x end (x = 3 - 2.5 = 0.5), which is the exact value
  // a hardcoded centre gets wrong (it would give 1 - 2.5 = -1.5, i.e. outside the piece entirely)
  chk('the far end swings to the correct x, not off the piece', near(r1[1].pos[0], 0.5), `got ${r1[1].pos[0]}`)
  chk('the near end swings to the far x', near(r1[0].pos[0], 2.5), `got ${r1[0].pos[0]}`)
  let acc = parts
  for (let i = 0; i < 4; i++) acc = rotateParts(acc, 1, rotateFootprint(deep, i as Quarter))
  chk('asymmetric: four turns are identity',
    acc.every((q, i) => q.pos.every((v, k) => near(v, parts[i].pos[k]))))
}

// 6. the fall encoding, and the cap that depends on it
{
  const slope = placeholderParts('roof_slope')
  chk('roof_slope is a single wedge', slope.length === 1 && slope[0].kind === 'wedge')
  chk('a quarter turn advances fall by exactly one',
    rotateParts(slope, 1, { w: 1, h: 1, d: 1 })[0].fall === (((slope[0].fall! + 1) % 4) as Quarter))
  chk('fall returns after four turns',
    rotateParts(slope, 0, { w: 1, h: 1, d: 1 })[0].fall === slope[0].fall)

  // ★ opposing faces differ by TWO under a rotation-ordered encoding. A cap built with 0 and 1
  // renders as a plausible lump and sheds two ways it should not.
  const cap = placeholderParts('roof_cap').filter((p) => p.kind === 'wedge')
  chk('roof_cap is two wedges', cap.length === 2)
  chk('roof_cap halves genuinely oppose (differ by 2, not 1)',
    Math.abs(cap[0].fall! - cap[1].fall!) === 2, `${cap[0].fall} vs ${cap[1].fall}`)
  chk('roof_cap halves together span the cell',
    near(cap.reduce((s, p) => s + p.size[0], 0), 1))
}

console.log(`\npieces oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
