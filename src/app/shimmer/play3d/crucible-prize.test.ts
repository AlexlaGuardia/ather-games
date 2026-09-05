// The Crucible's prize — the WON road's door. Run: npx tsx src/app/shimmer/play3d/crucible-prize.test.ts
//
// ⚠⚠ THIS FILE EXISTS BECAUSE OF WHAT IT FOUND. `crucible-phases.ts` was 42/0 green and imported by
// NOTHING for weeks — 185 lines of match clock, canon-accurate, tested, and never run — while three
// other files carried comments citing it as done. A module test says a module is correct. It says
// nothing about whether anything calls it, and "tested" reads as "handled" to every later reader.
// So the last block here asserts the WIRING, not just the rule.

import { readFileSync } from 'node:fs'
import { stepPrize, resetPrize, EMPTY_PRIZE, type PrizeState } from './crucible-prize'
import { crucibleAt, LEVEL_WINDOWS, MATCH_END_SEC, VAULT_END_SEC, TUNING } from './crucible-phases'
import { noComments } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. THE VAULT PAYS, THE KILL DOES NOT ────────────────────────────────────────────────────
// Mutation: `pay = throneCleared && !prev.paid` (drop the phase test) → fires.
{
  let st: PrizeState = resetPrize()
  const a = stepPrize(st, 'running', true, true)      // the Three fall, on the Throne, in a match
  st = a.next
  ok(!a.pay, 'clearing the Three pays NOTHING at the kill — the Vault is the prize room')
  ok(st.throneCleared, 'but it arms the prize')
  const b = stepPrize(st, 'vault', true, true)
  ok(b.pay, 'and the Vault pays it')
}

// ── 2. ★★★ REACHING THE VAULT IS NOT DESERVING IT ───────────────────────────────────────────
// The clock reaches 'vault' from elapsed seconds alone, so a keeper who hid the whole match walks
// into the room. They get nothing. This is the assert that keeps the two ideas apart.
// Mutation: `pay = matchPhase === 'vault' && !prev.paid` (drop throneCleared) → fires.
{
  const st = resetPrize()
  const hid = stepPrize(st, 'vault', false, false)
  ok(!hid.pay, 'a keeper who never fought the Throne is not paid for standing in the Vault')
  ok(!hid.next.throneCleared, 'and nothing armed')
}

// ── 3. ⚠⚠ THE DEV DOOR IS SHUT — the whole point of the change ──────────────────────────────
// The T range-console summons the same encounter in a practice zone. Clearing it there earns
// nothing, or the game's top reward is a keypress away.
// Mutation: drop `viaMatch` from the arming condition → fires.
{
  let st = resetPrize()
  st = stepPrize(st, 'running', true, false).next     // cleared, but summoned by the console
  ok(!st.throneCleared, 'the Three cleared OUTSIDE a match do not arm the prize')
  ok(!stepPrize(st, 'vault', true, false).pay, 'and no Vault window pays for a console clear')
}

// ── 4. PAID EXACTLY ONCE — a Vault window is ~120s of frames ────────────────────────────────
// Mutation: drop `!prev.paid` → this counts 7200 payouts instead of 1.
{
  let st = stepPrize(resetPrize(), 'running', true, true).next
  let paid = 0
  for (let f = 0; f < 7200; f++) { const r = stepPrize(st, 'vault', true, true); st = r.next; if (r.pay) paid++ }
  ok(paid === 1, `the Vault pays once, not once a frame (${paid} over 7200 frames)`)
}

// ── 5. A NEW MATCH RE-ARMS, AND IT IS NOT THE KEEPER'S LEDGER ───────────────────────────────
{
  const spent: PrizeState = { throneCleared: true, paid: true }
  ok(!resetPrize().throneCleared && !resetPrize().paid, 'a new match starts unarmed and unpaid')
  ok(spent.paid, 'and resetting returns a NEW object — the old state is not mutated')
  ok(EMPTY_PRIZE.throneCleared === false && EMPTY_PRIZE.paid === false, 'the empty state is empty')
}

// ── 6. THE RULE READS THE CLOCK'S OWN PHASES, walked over a real match ──────────────────────
// ★ Not a hand-written timeline: it steps `crucibleAt` across the whole match second by second, so
// if the clock's shape ever changes this walks the NEW shape rather than a stale copy of the old.
{
  let st = resetPrize()
  let paid = 0, paidAt = -1, sawThrone = false
  for (let sec = 0; sec <= VAULT_END_SEC + 30; sec++) {
    const c = crucibleAt(sec)
    // fight the Three the moment the Throne opens
    const onThrone = c.activeLevel?.guards === true
    if (onThrone) sawThrone = true
    const r = stepPrize(st, c.matchPhase, sawThrone, sawThrone)
    st = r.next
    if (r.pay) { paid++; paidAt = sec }
  }
  ok(sawThrone, 'the walked match actually opens a floor holding the guards (control: the window is not empty)')
  ok(paid === 1, `paid exactly once across a full match (${paid})`)
  ok(paidAt >= MATCH_END_SEC && paidAt <= VAULT_END_SEC,
     `and paid inside the Vault window — ${paidAt}s, between ${MATCH_END_SEC} and ${VAULT_END_SEC}`)
}

// ── 7. ⚠⚠⚠ THE WIRING — the assert whose ABSENCE let a whole module sit dead ────────────────
// `crucible-phases.ts` was correct, tested and unreachable. A module oracle cannot see that. These
// ask the HOST whether anything actually calls this machinery.
// Mutation: remove the `crucibleAt(` call from Shimmer3D → the first assert fires.
{
  const host = noComments(readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8'))
  ok(/crucibleAt\(/.test(host), '★ the match clock is CALLED by the host — not merely tested')
  ok(/stepPrize\(/.test(host), '★ and so is the prize rule')
  ok(/matchStart\.current/.test(host), 'the host holds a match start — one number, the clock derives the rest')

  // ⛔ THE OLD DOOR IS GONE, not merely superseded. A second payout path would make the guard-kill
  // pay again and nothing else would report it.
  const payouts = (host.match(/clearTrial\('puppet-guards'/g) ?? []).length
  ok(payouts === 1, `exactly ONE payout site in the host (${payouts}) — the kill no longer pays`)
  const i = host.indexOf("clearTrial('puppet-guards'")
  ok(i > 0 && /stepPrize|step\.pay/.test(host.slice(Math.max(0, i - 400), i)),
     'and that site sits inside the Vault branch, not the guard-clear branch')

  // The guards must be summonable BY THE MATCH, or the Throne is still a console toggle.
  ok(/cfg\?\.guards \|\| throneOpen/.test(host), 'the Throne window summons the Three, alongside the dev console')
  ok(/guards === true/.test(host), 'and "which floor holds them" is read off the level DATA, not an id string')

  // ⛔ PRESSURE IS DELIBERATELY UNWIRED — an unavoidable death timer until there is a floor to climb
  // to. Asserted so switching it on is a DECISION someone makes, not a line that slips in.
  ok(!/pressureDps/.test(host),
     '⛔ pressure stays unwired until the floors exist — it is only escapable by climbing')
  ok(TUNING.pressureDps > 0, 'though the clock still carries the number, ready (control)')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the Vault pays, and only the Throne earns it — ${pass} passed`)
