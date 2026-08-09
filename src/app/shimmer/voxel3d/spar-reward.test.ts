// Spar-payout oracle. Run: npx tsx src/app/shimmer/voxel3d/spar-reward.test.ts
//
// Two things are being held still here. The first is CANON: a spar takes nothing, so the payout
// must stay internal to the party forever — the shape assert below fails the day a row grows a
// `gold` or an `items` field, which is the exact edit that would look harmless in review.
// The second is the ECONOMY: a spar must never out-pay the fight it is practice for, and flight
// must never pay at all, because that is the one loop with no cost to gate it.

import { sparXp, applySparPayout, sparLedgerLines, SPAR_XP_FRAC, SPAR_LOSS_FRAC, SPAR_XP_MIN } from './spar-reward'
import { createSpirit, xpForLevel } from '../spirits/spirit'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const party = (levels: number[]) => levels.map((lv, i) => {
  const s = createSpirit('fox', `ally${i}`, 0, 0)
  s.level = lv
  return s
})
const foe = (lv: number) => { const s = createSpirit('rabbit', 'wild', 0, 0); s.level = lv; return s }

// ── the canon constraint ────────────────────────────────────────────────────────────────────
const rows = applySparPayout(party([10, 10]), [foe(10)], 'win')
ok(rows.length === 2, 'every ally that took the field is paid')
const FIELDS = ['name', 'xp', 'fromLevel', 'toLevel']
ok(Object.keys(rows[0]).every(k => FIELDS.includes(k)) && Object.keys(rows[0]).length === FIELDS.length,
  `a spar row pays XP and nothing else — found ${Object.keys(rows[0]).join(',')} (canon: a spar TAKES NOTHING, so it also GIVES no loot)`)

// ── flight pays nothing, at any level, win-shaped party or not ──────────────────────────────
ok(sparXp([10, 10], [10], 'fled') === 0, 'flight pays no xp')
ok(applySparPayout(party([10]), [foe(10)], 'fled').length === 0, 'flight writes no rows')
const fledSpirit = party([10])[0]
const beforeXp = fledSpirit.xp
applySparPayout([fledSpirit], [foe(10)], 'fled')
ok(fledSpirit.xp === beforeXp && fledSpirit.bond === 0, 'flight leaves the spirit untouched — no xp, no bond')

// ── the economy: ordered, bounded, and under the real fight ─────────────────────────────────
const win = sparXp([10, 10], [10], 'win')
const lose = sparXp([10, 10], [10], 'lose')
ok(win > lose && lose > 0, `a won spar out-pays a lost one and a lost one still teaches (win ${win}, lose ${lose})`)
ok(Math.abs(lose - Math.round(win * SPAR_LOSS_FRAC)) <= 1, 'the loss payout is the ruled fraction of the win')
// play3d's wild fight pays XP_FRAC 0.08 of the bar. A spar risks nothing but the walk home.
const PLAY3D_WILD_FRAC = 0.08
ok(SPAR_XP_FRAC < PLAY3D_WILD_FRAC, 'a spar pays less than the wild fight it is practice for')
ok(win < Math.round(xpForLevel(10) * PLAY3D_WILD_FRAC) + 1, `a won spar stays under one wild fight (${win})`)
// One level should take real repetition — a patch is quiet 10 min, but /mist finds several.
ok(xpForLevel(10) / Math.max(1, win) >= 15, `a level costs at least 15 spars (${Math.round(xpForLevel(10) / win)})`)

// ── the level relation is live, so the open difficulty curve has something to move ──────────
ok(sparXp([10], [20], 'win') > sparXp([10], [10], 'win'), 'punching up pays more')
ok(sparXp([20], [5], 'win') < sparXp([20], [20], 'win'), 'stomping something far below pays less')
ok(sparXp([1], [1], 'win') >= SPAR_XP_MIN, 'a level-1 spar never reads as nothing happened')

// ── degenerate inputs degrade, never throw ──────────────────────────────────────────────────
ok(sparXp([], [10], 'win') === 0, 'no allies = no payout')
ok(sparXp([10], [], 'win') === 0, 'no opponent = no payout')
ok(sparLedgerLines([]) === null, 'an empty ledger shows no banner')

// ── levelling shows its work ────────────────────────────────────────────────────────────────
const nearly = party([3])
nearly[0].xp = xpForLevel(3) - 1
const lvRows = applySparPayout(nearly, [foe(3)], 'win')
ok(lvRows[0].toLevel === 4 && lvRows[0].fromLevel === 3, 'a level crossed inside a spar is captured in the row')
ok(sparLedgerLines(lvRows)![0].includes('level 4'), 'the banner names the new level')
const flatRows = applySparPayout(party([10]), [foe(10)], 'win')
ok(!sparLedgerLines(flatRows)![0].includes('level'), 'a spar with no level-up does not claim one')

// ── bond moves, and only within canon bounds ────────────────────────────────────────────────
const bonded = party([10])
bonded[0].bond = 254
applySparPayout(bonded, [foe(10)], 'win')
ok(bonded[0].bond === 255, 'bond clamps at 255 rather than overflowing the save field')

console.log(fails.length ? `❌ spar-reward: ${pass} pass, ${fails.length} FAIL\n  ${fails.join('\n  ')}`
  : `✅ spar-reward: ${pass} asserts pass`)
process.exit(fails.length ? 1 : 0)
