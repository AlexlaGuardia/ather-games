/**
 * THE STATUS TABLE + THE LOCK RULE (2026-09-28).
 * Run: `npx tsx src/app/shimmer/engine/statuses.test.ts`
 */
import { readFileSync } from 'node:fs'
import { STATUS_TABLE, STATUS_KINDS, HARD_IMMUNITY_SECS, SLOW_MULT, emptyBag, applyStatus, applyStatuses, hasStatus, hardImmune, pruneStatuses, foeMods, statusesOn } from './statuses'
import { KEEPER_MOVES } from '../play3d/keeper-moves'
import { castForMove } from '../play3d/cast'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

// A. the table is the registry: every status any move names is in it, and every row is whole
for (const m of KEEPER_MOVES) for (const k of castForMove(m.id).statuses) ok(k in STATUS_TABLE, `★ ${m.name} names '${k}', which the table has`)
for (const k of STATUS_KINDS) { const d = STATUS_TABLE[k]; ok(!!d.label && !!d.effect && typeof d.hard === 'boolean' && d.color > 0, `${k} has a label, an effect, a hard flag and a colour`) }
ok(STATUS_KINDS.length === 10, 'ten statuses (update this when the table grows, on purpose)')
ok(['rooted', 'disarmed', 'blinded', 'silenced'].every(k => STATUS_TABLE[k as never].hard) && ['slowed', 'staggered', 'revealed', 'burning', 'vulnerable', 'shieldBroken'].every(k => !STATUS_TABLE[k as never].hard), 'hard = takes an option away outright; the rest are soft')

// B. no stacking: a re-apply extends to the later expiry
let b = applyStatus(emptyBag(), 'x', 'slowed', 2, 0)
b = applyStatus(b, 'x', 'slowed', 2, 1000)
ok(hasStatus(b, 'x', 'slowed', 2900) && !hasStatus(b, 'x', 'slowed', 3100), 'soft: extends to the later expiry, never adds')

// C. ★ THE LOCK RULE: hard statuses share one window, then immunity
b = applyStatuses(emptyBag(), 'x', ['rooted', 'disarmed'], 2, 0)
ok(hasStatus(b, 'x', 'rooted', 1900) && hasStatus(b, 'x', 'disarmed', 1900), 'a two-kind cast lands whole (root + disarm)')
b = applyStatus(b, 'x', 'blinded', 5, 1500)                     // a second keeper chains a blind at 1.5s
ok(hasStatus(b, 'x', 'blinded', 1900) && !hasStatus(b, 'x', 'blinded', 2100), '★ a hard status inside the window is CAPPED at its end: it adds a kind, never time')
b = applyStatus(b, 'x', 'rooted', 5, 1900)
ok(!hasStatus(b, 'x', 'rooted', 2100), '★ re-rooting at the last moment does not extend the lock')
b = pruneStatuses(b, 2500)
ok(hardImmune(b, 'x', 2500), 'the window closed: immune, and prune kept the memory of it')
const b2 = applyStatus(b, 'x', 'rooted', 3, 3000)
ok(!hasStatus(b2, 'x', 'rooted', 3001), `★ immune for ${HARD_IMMUNITY_SECS}s after a hard window: the chain cannot restart`)
const b3 = applyStatus(b, 'x', 'slowed', 3, 3000)
ok(hasStatus(b3, 'x', 'slowed', 3001), 'soft statuses land during immunity')
const b4 = applyStatus(pruneStatuses(b, 5100), 'x', 'rooted', 3, 5100)
ok(hasStatus(b4, 'x', 'rooted', 5200), 'after the immunity, a hard status lands again')
const z = applyStatus(b, 'x', 'blinded', 1, 3000, { zone: true })
ok(hasStatus(z, 'x', 'blinded', 3500), '★ a lingering cloud ignores the lock rule: walking out is the counter, and a fog must not flicker')

// D. what a foe's brain reads
const mods = (k: string) => foeMods(applyStatus(emptyBag(), 'f', k as never, 2, 0), 'f', 100)
ok(mods('slowed').speedMult === SLOW_MULT, 'slowed → the slow multiplier')
ok(mods('staggered').speedMult === 0 && mods('rooted').speedMult === 0, 'staggered and rooted → a full stop')
ok(mods('blinded').blinded && mods('disarmed').disarmed, 'blinded / disarmed read through')
ok(statusesOn(applyStatuses(emptyBag(), 'f', ['slowed', 'rooted'], 2, 0), 'f', 100)[0] === 'rooted', 'the marker shows the hard status first')

// E. the hosts: every real-time foe in play3d takes statuses, and lingering clouds exist
const p3 = readFileSync('src/app/shimmer/play3d/Shimmer3D.tsx', 'utf8')
for (const id of ['`board:${i}`', "'hunter'", '`guard:${st.id}`', '`fleet:${mm.index}`', '`flood:${b.id}`']) ok(p3.includes(`fn(${id}`), `★ forEachFoe walks ${id}`)
ok(p3.includes('stepHold(hs, dt, posRef.current.x, posRef.current.z, posRef.current.y / STEP, undefined, (id) =>'), 'the Breach flooded read their statuses')
ok(p3.includes('stepFleet(fleet, bodies, bc, dt, RANGE_HUNTER, (i) => foeMods('), 'the Crucible fleet reads theirs')
ok(p3.includes("applyStatuses(bag, id, zn.kinds, 1, nowFrame, { zone: true })"), 'a cloud re-applies with the zone flag')
for (const id of ['fog-bank', 'hush', 'sandstorm-veil', 'dust-lung', 'pressure-drop', 'squall']) ok(castForMove(id).linger && castForMove(id).archetype === 'status', `${id} is a lingering cloud`)
ok(castForMove('ice-dart').statuses.includes('slowed') && castForMove('ice-dart').areaSecs > 0, 'Ice Dart slows what it hits')

console.log(`statuses: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
