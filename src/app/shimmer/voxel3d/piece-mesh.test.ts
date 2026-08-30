// The piece mesher's contract. Run: npx tsx src/app/shimmer/voxel3d/piece-mesh.test.ts
//
// ★★★ THE PROPERTY THIS EXISTS FOR: **a piece added to the catalogue must not silently become a
// post.** `buildGeometry` switches on the base shape and its `default` arm draws the BEAM — a thin
// 0.26-wide upright. So a fifteenth piece added to `PIECES` with no arm here renders as a little
// stick, throws nothing, logs nothing, and looks deliberate. The file's own header already records
// this failure once (all 72 material variants went to `default` before `basePieceId` landed), and
// nothing stopped it happening again to a NEW piece. Found on 2026-08-30 adding the bench.
//
// ⚠ IT READS THE SOURCE, so it proves it found the switch before judging it — a textual reader that
// matches nothing reports "all good" and is indistinguishable from a clean sweep.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PIECES, basePieceId, ALL_PIECES } from '../voxel/pieces'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const src = readFileSync(join(__dirname, 'piece-mesh.ts'), 'utf8')
// Comments stripped first: this file's own prose names pieces, and a reader that counts a mention
// in a comment as an implementation is the documenting-a-marker bug (canon gate, 08-22).
const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

// ── 1. ★★★ EVERY PIECE HAS ITS OWN GEOMETRY ARM ───────────────────────────────────────────────
{
  const arms = new Set([...code.matchAll(/case '([a-z_]+)':/g)].map(m => m[1]))
  ok(arms.size >= 10,
    `★★★ BLIND CHECK: found ${arms.size} geometry arms — a handful means this reader lost the switch and its verdict is worthless`)
  ok(PIECES.length >= 15, `★★ BLIND CHECK: ${PIECES.length} pieces in the catalogue`)

  const postAsAPiece = PIECES.filter(p => !arms.has(p.id) && p.id !== 'beam')
  ok(postAsAPiece.length === 0,
    `★★★ every piece draws itself rather than falling to the beam's post (${postAsAPiece.map(p => p.id).join(', ') || 'all covered'})`)

  // ⚠ AND THE VARIANTS RESOLVE THROUGH `basePieceId`, NOT BY SPLITTING THE ID. `half_slab` contains
  // an underscore, so string surgery reads it as the `half` piece in a `slab` material.
  const unresolved = ALL_PIECES.filter(p => !arms.has(basePieceId(p.id)) && basePieceId(p.id) !== 'beam')
  ok(unresolved.length === 0,
    `★★★ and all ${ALL_PIECES.length} material variants resolve to a real arm (${unresolved.slice(0, 4).map(p => p.id).join(', ') || 'all covered'})`)
  ok(/basePieceId\(def\.id\)/.test(code),
    '★★ the switch keys on basePieceId — switching on the raw id sends every variant to the default arm')
}

// ── 2. ★★ A PIECE THE EYE CAN TELL APART HAS ITS OWN TINT ─────────────────────────────────────
// `TINT[def.id] ?? 0x999999` — a missing entry is a flat grey, which reads as a placeholder and is
// the same silent-fallback shape one property over.
{
  const tinted = new Set([...code.matchAll(/^\s{2}([a-z_]+):\s*0x[0-9a-f]{6},/gm)].map(m => m[1]))
  ok(tinted.size >= 8, `★★ BLIND CHECK: found ${tinted.size} tints`)
  const untinted = PIECES.filter(p => !tinted.has(p.id))
  ok(untinted.length === 0,
    `★★ every piece has a tint rather than the grey fallback (${untinted.map(p => p.id).join(', ') || 'all tinted'})`)
}

// ── 3. ★★ THE BENCH IS THE KEEPER'S, AND IT IS HALF-HEIGHT BECAUSE THAT IS WHAT A SEAT IS ─────
{
  const bench = PIECES.find(p => p.id === 'bench')
  ok(!!bench, '★★ the bench is in the catalogue')
  ok(bench?.halfHeight === true,
    '★★★ half-height — it occupies the lower half of its cell and collides at +0.5, so a keeper steps UP onto it rather than being stopped by it')
  ok((bench?.cost.length ?? 0) > 0, '★ and it costs something — a free piece is not craftable, it is scenery')
  ok((bench?.variants?.length ?? 0) >= 2, '★ with material variants, like every other piece')
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ no piece is silently a post — ${pass} passed`)
