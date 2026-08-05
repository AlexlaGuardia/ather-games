/**
 * collar-raid oracle (#294). Run: `npx tsx src/app/shimmer/play3d/collar-raid.test.ts`
 * (repo convention — no vitest here; same as cast.test.ts / crucible-phases.test.ts.)
 *
 * These assert the CANON reads as behaviour, so a tuning pass cannot quietly break the moral
 * engine. The load-bearing ones: a raider has no HP and cannot be killed; the collar is the only
 * resource; the swagger drains the moment the spirit is freed; disarm is a window, not a win.
 */
import {
  RAID_TUNING, spawnRaider, stepRaid, strikeRaider, strikeCollar, raidTarget, raidSettled,
  type Raider, type RaidContext,
} from './collar-raid'
import { emptyBag, applyStatus, applyStatuses } from './statuses'

let pass = 0
const fails: string[] = []
const ok = (cond: boolean, label: string) => { cond ? pass++ : fails.push(label) }

const NOW = 1_000_000
const ctx = (over: Partial<RaidContext> = {}): RaidContext => ({
  playerX: 100, playerY: 100, quarries: [], statuses: emptyBag(), nowMs: NOW, ...over,
})

// ── 1. the moral engine, as a data structure ───────────────────────────────────────────────
const r0 = spawnRaider({ id: 'a', homeX: 0, homeY: 0 })
ok(!('hp' in r0), 'a raider has NO hp field — it cannot be killed, only disarmed of its collar')
ok(r0.collar !== null && r0.collar.integrity === RAID_TUNING.collarIntegrity, 'the collar is the only resource')
const free = spawnRaider({ id: 'b', homeX: 0, homeY: 0 }, false)
ok(free.collar === null, 'a free moglin spawns with no collar (Jimbo / the warren)')
ok(raidSettled([free]), 'a free moglin is never a fight')

// ── 2. breaking the collar: canon's deflate is IMMEDIATE and TOTAL ─────────────────────────
const bound: Raider = { ...r0, bound: { quarryId: 'q1', greyed: true }, mode: 'loom', collarProgress: 2 }
const half = strikeCollar(bound, 40)
ok(!half.broke && half.raider.collar?.integrity === 60, 'a partial strike leaves the collar intact')
ok(half.raider.mode === 'loom', '...and does not deflate him — there is no wounded state')
const done = strikeCollar(half.raider, 60)
ok(done.broke, 'integrity 0 breaks the collar')
ok(done.raider.mode === 'deflated', 'the swagger drains the MOMENT the spirit is freed')
ok(done.raider.collar === null && done.raider.bound === null, '...collar and bound spirit both gone at once')
ok(done.raider.collarProgress === 0 && done.raider.quarryId === null, '...and it drops what it was doing')
ok(done.freedQuarry === 'q1', 'the freed spirit is reported so the colour can come back')
// permanence — nothing in this module re-arms a deflated raider
const after = stepRaid([done.raider], 1, ctx({ quarries: [{ id: 'q2', x: 0, y: 0 }] }))
ok(after.raiders[0].mode === 'deflated', 'a deflated raider stays deflated even with a spirit at its feet')
ok(after.playerDamage === 0, '...and applies no pressure ever again')

// ── 3. borrowed power — every point of pressure comes from the bound spirit ────────────────
const near = ctx({ playerX: 3, playerY: 0 })
const unarmed = stepRaid([{ ...r0, x: 0, y: 0 }], 2, near)   // collared but nothing bound yet
ok(unarmed.raiders[0].mode === 'loom', 'a raider that sees the player looms')
ok(unarmed.playerDamage === 0, 'a raider with NO bound spirit deals no damage — the power is borrowed')
const armed = stepRaid([{ ...r0, x: 0, y: 0, bound: { quarryId: 'q1', greyed: true } }], 2, near)
ok(armed.playerDamage > 0, 'a raider WITH a bound spirit applies pressure')

// ── 4. ★ disarm is a WINDOW, not a win ────────────────────────────────────────────────────
const armedR: Raider = { ...r0, x: 0, y: 0, bound: { quarryId: 'q1', greyed: true } }
const disarmedBag = applyStatuses(emptyBag(), raidTarget('a'), ['rooted', 'disarmed'], 3, NOW)
const shackled = stepRaid([armedR], 2, ctx({ playerX: 3, playerY: 0, statuses: disarmedBag }))
ok(shackled.playerDamage === 0, 'a disarmed raider cannot spend its borrowed power')
ok(shackled.raiders[0].collar !== null, '...but KEEPS its collar — disarm does not end the fight')
ok(shackled.raiders[0].mode === 'loom', '...and keeps its nerve')
ok(shackled.raiders[0].x === 0 && shackled.raiders[0].y === 0, 'rooted means it cannot reposition')

// ── 5. the theft loop — the stake is a rescue, not the player's life ──────────────────────
const q = [{ id: 'wild1', x: 0.5, y: 0 }]
let raiders = [{ ...spawnRaider({ id: 'c', homeX: 0, homeY: 0 }) }]
let took: string[] = []
for (let t = 0; t < 12 && !took.length; t++) {      // player far away, nothing interrupts
  const s = stepRaid(raiders, 0.5, ctx({ quarries: q }))
  raiders = s.raiders; took = s.taken
}
ok(took.includes('wild1'), 'left alone, a raider collars a wild spirit — that is the loss state')
ok(raiders[0].bound?.quarryId === 'wild1', '...and the taken spirit becomes its borrowed power')
ok(raiders[0].bound?.greyed === true, '...collared means greyed (canon: the glow is extinguished)')

// interrupting by PRESENCE alone — walking at it pulls it off a spirit before any cast
let r2 = [spawnRaider({ id: 'd', homeX: 0, homeY: 0 })]
let progressed = false
for (let t = 0; t < 4; t++) {
  const s = stepRaid(r2, 0.5, ctx({ quarries: q }))
  r2 = s.raiders
  if (r2[0].collarProgress > 0) progressed = true
}
ok(progressed, 'a raider banks collar progress while undisturbed')
const interrupted = stepRaid(r2, 0.5, ctx({ quarries: q, playerX: 1, playerY: 0 }))
ok(interrupted.raiders[0].mode === 'loom', 'walking up pulls it off the spirit')
ok(interrupted.raiders[0].collarProgress === 0, '...and the collar work resets — it is never half-on')

// a disarmed raider cannot fit a collar either
const midWork: Raider = { ...spawnRaider({ id: 'e', homeX: 0, homeY: 0 }), x: 0.5, y: 0, collarProgress: 3.9 }
const cantFit = stepRaid([midWork], 0.5, ctx({
  quarries: q, statuses: applyStatus(emptyBag(), raidTarget('e'), 'disarmed', 3, NOW),
}))
ok(cantFit.taken.length === 0, 'a disarmed raider cannot fit a collar it cannot hold')

// ── 6. blinded loses you — Enlighten buys a disengage, it does not damage ─────────────────
const blindBag = applyStatus(emptyBag(), raidTarget('a'), 'blinded', 3, NOW)
const blind = stepRaid([{ ...armedR, mode: 'loom' }], 1, ctx({ playerX: 3, playerY: 0, statuses: blindBag, quarries: q }))
ok(blind.raiders[0].mode !== 'loom', 'a blinded raider loses the player')
ok(blind.playerDamage === 0, '...so it stops applying pressure')

// ── 7. strikeRaider only touches its target ───────────────────────────────────────────────
const pair = [spawnRaider({ id: 'x', homeX: 0, homeY: 0 }), spawnRaider({ id: 'y', homeX: 5, homeY: 5 })]
const struck = strikeRaider(pair, 'x', 100)
ok(struck.raiders[0].mode === 'deflated', 'the struck raider deflates')
ok(struck.raiders[1].collar?.integrity === RAID_TUNING.collarIntegrity, 'the other is untouched')
ok(!raidSettled(struck.raiders), 'the raid is not settled while one collar stands')
ok(raidSettled(strikeRaider(struck.raiders, 'y', 100).raiders), 'breaking the last collar settles the raid')

// ── 8. purity — the same inputs must give the same outputs ────────────────────────────────
const inA = [{ ...armedR }]
const c = ctx({ playerX: 3, playerY: 0 })
ok(JSON.stringify(stepRaid(inA, 0.5, c)) === JSON.stringify(stepRaid(inA, 0.5, c)), 'stepRaid is pure')
ok(inA[0].x === armedR.x && inA[0].pushCd === armedR.pushCd, 'stepRaid does not mutate its input')

console.log(`\ncollar-raid: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
console.log('✅ the collar is the fight\n')
