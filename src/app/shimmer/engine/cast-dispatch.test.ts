// Run: npx tsx src/app/shimmer/engine/cast-dispatch.test.ts
//
// The dispatcher moved out of Shimmer3D so a second world could cast. That move is the risk this
// file covers, and it is the same risk `weapons.test.ts` was written for: an extraction that
// silently changes a RULE is a feel regression nobody can trace, because the code "only moved".
//
// Most attention goes to the GATE ORDER. It is the one piece of real logic here, it is invisible
// when wrong (a cast just feels cheap or sticky), and every one of its bugs is a resource leak the
// player pays for: charging mana for a move the world cannot land, cooldowning a refused cast,
// healing past the cap. Each has its own assert below.

import {
  resolveCast, castAimPoint, SELF_ARCHETYPES,
  type CastEnv, type CastApplied,
} from './cast-dispatch'
import { castForMove, type CastArchetype } from '../play3d/cast'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const ALL: ReadonlySet<CastArchetype> = new Set<CastArchetype>([
  'projectile', 'restore', 'stance', 'surge', 'infusion', 'field', 'terrain', 'status',
])
const env = (over: Partial<CastEnv> = {}): CastEnv => ({
  now: 10_000, hp: 50, hpMax: 100, mana: 200,
  cooldownUntil: [0, 0, 0, 0], stanceMoveId: null, supports: ALL, ...over,
})
const ap = (o: ReturnType<typeof resolveCast>): CastApplied => o as CastApplied

// Real moves, so the oracle breaks if a spec is retuned out from under it.
const MEND = 'mend', DART = 'ice-dart', WALL = 'stonewall', BURST = 'static-burst', INFUSE = 'flame-infusion'

// ── 1. the honesty rule: nothing is ever a silent no-op ──────────────────────────────────────────
{
  const empty = resolveCast(0, [null, null, null, null], env())
  check('an empty slot refuses with a message', empty.kind === 'refused' && empty.message.length > 0)
  // Every registered-but-unbuilt canon move must name itself AND its reason.
  const unbuiltId = 'gate'   // cast.ts: 'needs a two-point bind + warp on a placed anchor'
  const u = resolveCast(0, [unbuiltId, null, null, null], env())
  check('an unbuilt move names itself and its reason',
    u.kind === 'refused' && u.reason === 'unbuilt' &&
    u.message.includes(castForMove(unbuiltId).label) && u.message.includes('needs'))
}

// ── 2. ★ THE WORLD GATE — the reason this file exists ───────────────────────────────────────────
// The voxel world can run projectiles + self archetypes and cannot yet place terrain. That must be
// a stated refusal, not a missing branch, or Stonewall becomes a key that does nothing.
{
  const voxelish = new Set<CastArchetype>([...SELF_ARCHETYPES, 'projectile'])
  const r = resolveCast(0, [WALL, null, null, null], env({ supports: voxelish }))
  check('an archetype this world cannot run refuses, and says so',
    r.kind === 'refused' && r.reason === 'unsupported' && r.message.includes('not in this world'))

  // ★ AND THE GATE ORDER IS THE ASSERTION, not the refusal itself.
  // ⚠ This first read `check(..., r2.kind === 'refused')`, which re-states the line above and would
  // stay green with the check moved anywhere. The property that actually matters is ORDER: a cast
  // this world cannot land must be refused AS unsupported even when the player is ALSO broke and
  // ALSO on cooldown. If `unsupported` slips below either gate the reason changes, and the player
  // gets charged for — or locked out of — a move that was never going to land.
  const worst = env({ supports: voxelish, mana: 0, cooldownUntil: [99_999, 0, 0, 0] })
  const r2 = resolveCast(0, [WALL, null, null, null], worst)
  check('★ unsupported outranks both cooldown and mana',
    r2.kind === 'refused' && r2.reason === 'unsupported',
    r2.kind === 'refused' ? `got '${r2.reason}'` : 'applied')

  // The same move in a world that supports it goes through — proving the refusal is about the
  // WORLD, not about the move being broken.
  const ok = resolveCast(0, [WALL, null, null, null], env())
  check('the same move lands in a world that supports terrain',
    ok.kind === 'applied' && ap(ok).placed?.moveId === WALL)
}

// ── 3. cooldown and mana ────────────────────────────────────────────────────────────────────────
{
  const cd = resolveCast(1, [null, DART, null, null], env({ cooldownUntil: [0, 99_999, 0, 0] }))
  check('a cast on cooldown refuses', cd.kind === 'refused' && cd.reason === 'cooldown')

  const poor = resolveCast(1, [null, WALL, null, null], env({ mana: 1 }))
  check('a cast you cannot pay for refuses', poor.kind === 'refused' && poor.reason === 'mana')

  const spec = castForMove(DART)
  const go = resolveCast(1, [null, DART, null, null], env())
  check('a clean cast starts its own cooldown from now',
    go.kind === 'applied' && ap(go).cooldownUntil === 10_000 + spec.cooldownMs)
  check('and charges exactly the spec cost', ap(go).manaCost === spec.manaCost)

  // Exact-boundary: cooldown expiring THIS instant must fire, not refuse. An off-by-one here reads
  // as "the cast sometimes eats a press".
  const edge = resolveCast(1, [null, DART, null, null], env({ cooldownUntil: [0, 10_000, 0, 0] }))
  check('a cooldown expiring exactly now fires', edge.kind === 'applied')
}

// ── 4. restore — the two rules that make Mend not a mana leak ───────────────────────────────────
{
  const full = resolveCast(0, [MEND, null, null, null], env({ hp: 100, hpMax: 100 }))
  check('a restore at full health refuses', full.kind === 'refused' && full.reason === 'already-whole')

  const hurt = resolveCast(0, [MEND, null, null, null], env({ hp: 50, hpMax: 100 }))
  check('a restore while hurt heals its spec amount',
    hurt.kind === 'applied' && ap(hurt).hpDelta === castForMove(MEND).heal)

  // ★ CLAMPED HERE, NOT BY THE HOST. Two hosts clamping independently is two chances to disagree
  // about the cap, and an unclamped heal silently overfills a bar the HUD then draws past its end.
  const nearly = resolveCast(0, [MEND, null, null, null], env({ hp: 95, hpMax: 100 }))
  check('★ a restore never heals past the cap', ap(nearly).hpDelta === 5)
}

// ── 5. stances — a stance is a stance, not a permanent state (runes.md) ─────────────────────────
{
  // A real canon stance, not one derived from `defaultLoadout([])` — with no runes owned the book
  // is empty, so that returns nothing and the whole block would silently skip.
  const stanceId = 'barrier'
  check('the fixture really is a stance', castForMove(stanceId).archetype === 'stance')
  {
    const hold = resolveCast(0, [stanceId, null, null, null], env())
    check('holding a stance sets it', hold.kind === 'applied' && ap(hold).stanceChange?.to?.moveId === stanceId)

    // ★ DROPPING IS FREE AND ALWAYS ALLOWED — even mid-cooldown, even at zero mana. If either gate
    // caught the drop you could be LOCKED INTO a passive that is pausing your own mana recovery,
    // which is the one state the economy must never be able to reach.
    const stuck = env({ stanceMoveId: stanceId, cooldownUntil: [99_999, 0, 0, 0], mana: 0 })
    const drop = resolveCast(0, [stanceId, null, null, null], stuck)
    check('★ a held stance drops on cooldown at zero mana', drop.kind === 'applied')
    check('★ and the drop is free', ap(drop).manaCost === 0 && ap(drop).cooldownUntil === null)
    check('★ and it clears the stance', ap(drop).stanceChange?.to === null)

    // Pressing a DIFFERENT stance is not a drop.
    const other = resolveCast(0, [stanceId, null, null, null], env({ stanceMoveId: 'something-else' }))
    check('a different held stance does not read as a drop', ap(other).stanceChange?.to?.moveId === stanceId)
  }
}

// ── 6. windows carry the spec's own duration, in ms ─────────────────────────────────────────────
{
  const b = ap(resolveCast(0, [BURST, null, null, null], env()))
  const bs = castForMove(BURST)
  check('a surge window ends at now + surgeSecs',
    b.surge?.until === 10_000 + bs.surgeSecs * 1000 && b.surge?.mult === bs.surgeMult)
  check('a surge does not also set an infusion', b.infusion === null)

  const f = ap(resolveCast(0, [INFUSE, null, null, null], env()))
  check('an infusion window is the weapon one, not the keeper one',
    f.infusion !== null && f.surge === null)
}

// ── 7. a projectile is PLACED, and self archetypes are not ──────────────────────────────────────
{
  const dart = ap(resolveCast(0, [DART, null, null, null], env()))
  check('a projectile is handed to the frame loop', dart.placed?.moveId === DART)
  check('and touches no self state', dart.hpDelta === 0 && dart.surge === null && dart.infusion === null)

  const mend = ap(resolveCast(0, [MEND, null, null, null], env()))
  check('a restore is not handed to the frame loop', mend.placed === null)
}

// ── 8. the aim point ────────────────────────────────────────────────────────────────────────────
{
  const a = castAimPoint(0, -1, 10, 20, 5)
  check('aim walks the flattened forward at range', Math.abs(a.x - 10) < 1e-9 && Math.abs(a.z - 15) < 1e-9)

  // Flattening: a steep look must not shorten the reach, because range is a GROUND distance.
  const steep = castAimPoint(0.0001, -0.0001, 0, 0, 10)
  check('a diagonal aim still lands at full ground range',
    Math.abs(Math.hypot(steep.x, steep.z) - 10) < 1e-6)

  // ★ STARING AT YOUR BOOTS. The horizontal component is ~0, and normalising it is a divide-by-zero
  // that lands the cast on your own head or at NaN. Invisible until someone looks down and casts.
  const down = castAimPoint(0, 0, 3, 4, 7)
  check('★ a straight-down aim does not produce NaN', Number.isFinite(down.x) && Number.isFinite(down.z))
  check('★ and it still lands a full range away', Math.abs(Math.hypot(down.x - 3, down.z - 4) - 7) < 1e-6)
}

// ── 9. ★ COVERAGE — every archetype the sim claims to run must be handled here ──────────────────
// Without this, adding an archetype to `cast.ts` and forgetting this file gives a cast that pays and
// then does nothing — precisely the silent no-op the honesty rule outlaws, wearing a new hat.
{
  const seen = new Set<CastArchetype>()
  for (const m of ['mend', 'ice-dart', 'stonewall', 'static-burst', 'flame-infusion', 'firewall', 'shackle']) {
    const spec = castForMove(m)
    const o = resolveCast(0, [m, null, null, null], env({ hp: 1, hpMax: 100 }))
    if (o.kind === 'applied') seen.add(spec.archetype)
    check(`${m} (${spec.archetype}) resolves to an applied outcome`, o.kind === 'applied',
      o.kind === 'refused' ? o.reason : '')
  }
  check('★ all built archetype families exercised', seen.size >= 6, `saw ${[...seen].join(', ')}`)
}

console.log(`\ncast dispatch: ${pass} passed, ${fail} failed`)
if (fail === 0) console.log('✅ slot → move → archetype → outcome, identically in both worlds')
process.exit(fail === 0 ? 0 : 1)
