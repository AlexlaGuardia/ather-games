// The twenty entrances. Run: npx tsx src/app/shimmer/play3d/crucible-entrances.test.ts
//
// ⚠⚠ THE LOAD-BEARING ASSERT IN THIS FILE IS §4, AND IT IS THE REASON THE FILE EXISTS. Before this,
// the sixty spawned on a ring around the PLAYER at a fixed 12–16 tiles, so arena size could not
// change how crowded a floor felt. Any judgement about "how big should a Crucible floor be" made
// against that build would have been measuring nothing. §4 asserts that the spread SCALES with the
// map, which is the single property that makes the question answerable — and it is exactly the
// property a revert to a player-relative ring would silently destroy.

import { readFileSync } from 'node:fs'
import { noComments } from '../testing/guard'
import { entrancesFor, spawnFor, startingPositions, SIDES, PER_SIDE, WALL_INSET } from './crucible-entrances'
import { ENTRANCES, SQUAD_SIZE, ROSTER_SIZE } from './crucible-bots'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. THE SHAPE IS CANON'S — four sides, five each, three a point ──────────────────────────
// Mutation: PER_SIDE 5 -> 4 → fires. These come from `pyramid-zero.md` › Entry and are not ours.
{
  ok(SIDES === 4 && PER_SIDE === 5 && ENTRANCES === 20,
     `canon: four sides, five entry points each, twenty entrances (${SIDES}/${PER_SIDE}/${ENTRANCES})`)
  ok(SQUAD_SIZE === 3 && ROSTER_SIZE === 60, `three challengers an entrance, sixty in all (${SQUAD_SIZE}/${ROSTER_SIZE})`)
  const e = entrancesFor(60, 60)
  ok(e.length === ENTRANCES, `twenty entrances (${e.length})`)
  for (const s of [0, 1, 2, 3]) {
    ok(e.filter(x => x.side === s).length === PER_SIDE, `side ${s} carries five`)
  }
}

// ── 2. NOBODY SPAWNS IN A WALL, AT ANY SIZE THE EDITOR ALLOWS ───────────────────────────────
// `Shimmer3D`'s resize clamps 8..160, so those are the real bounds. The border ring is SOLID, and a
// challenger placed inside it is one the collision probe will never let move.
// Mutation: WALL_INSET 3 -> 0 → fires at the small sizes.
{
  // ⚠⚠ THIS BLOCK WAS CIRCULAR ON ITS FIRST WRITING AND PROVED IT: `spawnFor` CLAMPS its result to
  // `max(1, min(size-2, …))`, and the assert read that clamped output — so it was checking the clamp
  // against itself and `WALL_INSET = 0` passed 18/18. A guard keyed on the value it guards cannot
  // fail; the same shape that let `cover: 0` pass a warren sweep this morning.
  // ★ So it reads the UNCLAMPED entrance positions, where the inset actually has to do the work,
  // and keeps the clamped check beside it as the backstop it always was.
  let bad = 0, checked = 0, clamped = 0
  for (const size of [8, 12, 20, 30, 40, 60, 100, 140, 160]) {
    for (const e of entrancesFor(size, size)) {
      checked++
      if (e.x < 1 || e.z < 1 || e.x > size - 2 || e.z > size - 2) bad++
    }
    for (const p of startingPositions(size, size)) {
      if (p.x < 1 || p.z < 1 || p.x > size - 2 || p.z > size - 2) clamped++
    }
  }
  ok(checked > 150, `${checked} entrances checked across nine arena sizes`)
  ok(bad === 0, `★ every ENTRANCE clears the border on its own, before any clamp (${bad} did not)`)
  ok(clamped === 0, `and every spawned challenger ends up inside it too (${clamped} did not)`)
  // and the non-square case, since a floor need not be square
  const rect = startingPositions(140, 40)
  ok(rect.every(p => p.x >= 1 && p.x <= 138 && p.z >= 1 && p.z <= 38),
     'and on a wide rectangular floor, where the two axes disagree')
  ok(rect.length === ROSTER_SIZE, `all sixty are placed (${rect.length})`)
}

// ── 3. A SQUAD ARRIVES TOGETHER, AND THE TWENTY ARRIVE APART ────────────────────────────────
// Canon has three challengers per entrance; they should read as a unit standing at their own door,
// not as sixty strangers sprayed over a field.
// Mutation: give every squad the same entrance → the second assert fires.
{
  const pos = startingPositions(100, 100)
  const d = (a: {x:number;z:number}, b: {x:number;z:number}) => Math.hypot(a.x - b.x, a.z - b.z)
  let worstMate = 0
  for (let sq = 0; sq < ENTRANCES; sq++) {
    const trio = pos.slice(sq * SQUAD_SIZE, sq * SQUAD_SIZE + SQUAD_SIZE)
    for (const a of trio) for (const b of trio) worstMate = Math.max(worstMate, d(a, b))
  }
  ok(worstMate <= 6, `squadmates start within arm's reach of each other (worst ${worstMate.toFixed(1)} tiles)`)

  let closestRival = Infinity
  for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
    if (Math.floor(i / SQUAD_SIZE) === Math.floor(j / SQUAD_SIZE)) continue
    closestRival = Math.min(closestRival, d(pos[i]!, pos[j]!))
  }
  ok(closestRival > worstMate, `and rival squads start further apart than squadmates (${closestRival.toFixed(1)} vs ${worstMate.toFixed(1)})`)
}

// ── 4. ★★★ THE SPREAD SCALES WITH THE ARENA — the property the whole feature is for ─────────
// A bigger floor must put the sixty further apart. If it does not, "how big should this be" is not
// a question a keeper can answer by walking in, which is the only reason any of this was built.
// ⚠ THIS IS THE ASSERT THAT CATCHES A REVERT TO THE PLAYER-RELATIVE RING: that ring is a fixed
// 12–16 tiles at every size, so its spread is FLAT and this goes red immediately.
// Mutation: return a fixed ring (ignore cols/rows) → fires. Halve the growth → still fires.
{
  const spreadAt = (size: number) => {
    const pos = startingPositions(size, size)
    let sum = 0, n = 0
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      sum += Math.hypot(pos[i]!.x - pos[j]!.x, pos[i]!.z - pos[j]!.z); n++
    }
    return sum / n
  }
  // ⚠ THE FIRST VERSION OF THIS CHECKED ONLY RATIOS BETWEEN SIZES, and a PARTIAL revert — one term
  // still reading the map, one frozen — kept the ratios healthy enough to pass while the spread had
  // stopped tracking the arena. A ratio between two derived numbers can stay plausible while both
  // are wrong. ★ So it now measures spread AS A FRACTION OF THE ARENA and demands it hold steady:
  // any term that stops reading (cols, rows) drags that fraction down at the large sizes, whichever
  // term it was.
  // ★★ ASSERTED AS THE SHAPE THE SYSTEM ACTUALLY HAS, not a tolerance somebody picked. Measured,
  // spread/size RISES and converges — 0.31 at 8 tiles to 0.69 at 160 — because `WALL_INSET` is a
  // fixed 3 tiles and matters proportionally less as the floor grows. My first version demanded a
  // CONSTANT fraction, went red at drift 0.075, and the tempting fix was to widen the band to 0.10.
  // ⛔ That would have been the cheapest lie that turns a red green, and the threshold was not what
  // was wrong: a constant fraction was never the true behaviour.
  // ★ NON-DECREASING is the true behaviour AND the sharper discriminator. A frozen spread — the
  // player-relative ring — makes the fraction COLLAPSE instead (0.35 → 0.09 over the same range),
  // so the direction alone separates a spread that reads the map from one that does not.
  const sizes = [12, 20, 40, 80, 160]
  const frac = sizes.map(sz => spreadAt(sz) / sz)
  let falls = 0
  for (let i = 1; i < frac.length; i++) if (frac[i]! < frac[i - 1]! - 1e-9) falls++
  ok(falls === 0,
     `★ spread/arena never falls as the floor grows — it tracks the map (${frac.map(f => f.toFixed(2)).join(' → ')})`)
  ok(frac[frac.length - 1]! > 0.5,
     `and at a large floor the sixty are spread across most of it (${frac[frac.length - 1]!.toFixed(2)})`)
  const s40 = spreadAt(40), s160 = spreadAt(160)
  ok(s160 / s40 > 3.5, `quadrupling the arena quadruples the distance between them (${(s160 / s40).toFixed(1)}×)`)
}

// ── 5. DETERMINISM — same size, same twenty, forever ────────────────────────────────────────
// No rng anywhere in this file, deliberately: two clients computing different starting positions
// for the same match is the class of bug `crucible-fleet.ts`'s header exists to refuse.
{
  const a = JSON.stringify(startingPositions(140, 90))
  const b = JSON.stringify(startingPositions(140, 90))
  ok(a === b, 'the same arena places the sixty identically')
  ok(!/Math\.random/.test(entrancesFor.toString() + spawnFor.toString() + startingPositions.toString()),
     'and nothing here rolls dice — every client derives the same twenty')
}

// ── 6. ⚠⚠⚠ THE WIRING — the assert this whole session exists to have remembered ─────────────
// Three times today a module was correct, tested, and imported by NOTHING: `hollowPose` computing
// nine fields with two consumed, a bone rig whose only importer was its own test, and
// `crucible-phases.ts` — 185 lines, 42/0 green, unreached for weeks while three other files carried
// comments citing it as done. A module oracle proves a module correct. It cannot see whether the
// game calls it, and "tested" reads as "handled" to every later reader.
// Mutation: remove the `startingPositions(` call from Shimmer3D → the first assert fires.
{
  const host = noComments(readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8'))
  ok(/startingPositions\(/.test(host), '★ the host CALLS this — the sixty are actually placed, not merely placeable')
  ok(/m\.state\.alive = true/.test(host),
     '★ and they arrive ALREADY ALIVE, which is what stops `hunter-ai` asking for its player-relative ring')
  // ⛔ The ring must not also run. `hunter-ai`'s spawn block is inside `if (!state.alive)`, so a
  // member placed and woken here never reaches it — but only while the host sets `alive` BEFORE the
  // first `stepFleet`. Assert the order, since a later refactor could separate them.
  const place = host.indexOf('startingPositions(')
  const step = host.indexOf('stepFleet(')
  ok(place > 0 && step > 0 && place < step, 'and they are placed BEFORE the fleet first steps')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the sixty come in at twenty doors — ${pass} passed`)
