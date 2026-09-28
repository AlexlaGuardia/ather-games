/**
 * GREG'S OFFER — the starter choice per birth rune (2026-09-28).
 * Run: `npx tsx src/app/shimmer/play3d/starter-choices.test.ts`
 */
import { STARTER_ROLES, floorCandidates, floorWordFor, starterChoices } from './vessels'
import { KEEPER_MOVES } from './keeper-moves'
import { ELEMENTS, runesOf } from './birth/runes.data'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const births = ELEMENTS.flatMap(e => runesOf(e.id).map(r => r.id))

// every word that can be a starter carries a role — a new one-letter tactical without one goes red here
for (const b of births) for (const m of floorCandidates('bracelet', b))
  ok(!!m.role, `${m.id} can be ${b}'s starter, so it needs a role`)
// and nothing that can never be a starter carries one (the label means "Greg can offer this")
const starters = new Set(births.flatMap(b => floorCandidates('bracelet', b).map(m => m.id)))
for (const m of KEEPER_MOVES) if (m.role) ok(starters.has(m.id), `${m.id} has a role but no birth can start with it`)

const gaps: string[] = []
for (const b of births) {
  const c = starterChoices('bracelet', b)
  ok(c.length === STARTER_ROLES.length, `★ ${b}: Greg offers three (got ${c.length})`)
  ok(new Set(c.map(x => x.move.id)).size === c.length, `${b}: no word offered twice`)
  ok(c.every(x => x.role === null || x.move.role === x.role), `${b}: a role slot holds a word OF that role`)
  const pool = floorCandidates('bracelet', b)
  for (const r of STARTER_ROLES) {
    const has = pool.some(m => m.role === r)
    ok(has === c.some(x => x.role === r), `★ ${b}: ${r} offered iff the lane has one`)
    if (!has) gaps.push(`${b}:${r}`)
  }
  // the old automatic pick is still one of the offers, so an existing save's floor word stays a valid choice
  const auto = floorWordFor('bracelet', b)
  ok(!auto || pool.some(m => m.id === auto), `${b}: today's floor word is in the pool`)
}
console.log(`role gaps (lane has no word of that role): ${gaps.join(' ')}`)
console.log(`starter-choices: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗', f)
if (fails.length) process.exit(1)
