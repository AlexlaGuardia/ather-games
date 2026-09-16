// Run: npx tsx src/app/shimmer/voxel3d/brewing.test.ts
// The brewing ledger against the 09-16 ruling: a hand counts, the host starts, skill follows the
// hand, more hands brew more, bottle only. And solo it IS the solo potion.
import { POTION_DEFS } from '../engine/alchemy'
import { roadOf, alchemyRecipe } from './alchemy-chain'
import { startBrewing, join, bring, step, light, pour, yieldFor, contributed } from './brewing'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const host = { id: 'alex', name: 'Alex' }, sun = { id: 'sun', name: 'Sunpetal-bringer' }, mill = { id: 'mill', name: 'Grinder' }, idle = { id: 'idle', name: 'Stood there' }

// ── solo: the ledger reduces to the solo potion exactly ─────────────────────────────────────────
for (const def of Object.values(POTION_DEFS)) {
  let b = startBrewing(def.id, host, 0)!
  ok(pour(b) === null, `${def.id}: no pour before the road is walked and the pot lit`)
  for (const _ of roadOf(def.id)) b = step(b, host.id)
  ok(light(b) !== null, `${def.id}: the host may light once the road is walked`)
  b = light(b)!
  const p = pour(b)!
  ok(p.bottles[host.id] === def.resultCount, `${def.id}: solo, the pour is the potion's own count (${p.bottles[host.id]} vs ${def.resultCount})`)
  ok(p.xp[host.id] === def.xpGrant, `${def.id}: solo, the XP is the potion's own (${p.xp[host.id]} vs ${def.xpGrant})`)
  ok(Object.keys(p.recipes).length === 0, `${def.id}: a brewing hands out no recipe`)
}

// ── the party: mana infusion, three stations, four at the pot ────────────────────────────────────
{
  const id = 'mana_infusion'
  const road = roadOf(id)
  ok(road.length === 3, 'the infusion walks three steps')
  let b = startBrewing(id, host, 0)!
  ok(light(b) === null, '★ the cauldron cannot be lit before the road is walked — it is always last')
  b = join(b, sun); b = join(b, mill); b = join(b, idle)
  b = bring(b, sun.id, 3)                 // brought Sunpetal and stood there
  b = step(b, mill.id); b = step(b, mill.id); b = step(b, mill.id)   // ground for three steps, brought nothing
  ok(step(b, mill.id) === b, 'a fourth step on a three-step road is refused')
  ok(step(b, 'nobody') === b, 'a hand not at the brewing cannot step')
  b = light(b)!
  const p = pour(b)!
  ok(p.bottles[sun.id] === 1 && p.bottles[mill.id] === 1, '★★ the one who brought and the one who ground BOTH leave with a bottle')
  ok(p.bottles[idle.id] === undefined && !contributed(b, b.hands[idle.id]), '★ standing there is not a contribution')
  ok(p.bottles[host.id] >= 1, 'the host leaves with a bottle too')
  const total = Object.values(p.bottles).reduce((n, x) => n + x, 0)
  ok(total === Math.max(3, Math.ceil(POTION_DEFS[id].resultCount * yieldFor(3))) && total > POTION_DEFS[id].resultCount, `three hands brew more than one, and never fewer than a bottle each (${total} bottles)`)
  const stepXp = road.reduce((n, _, i) => n + alchemyRecipe(`road:${id}:${i + 1}`)!.xp, 0)
  ok(p.xp[mill.id] === stepXp && p.xp[sun.id] === 0, '★★ skill follows the hand — every road step\'s XP to the grinder, none to the bringer')
  ok(p.xp[host.id] === alchemyRecipe(`finish:${id}`)!.xp, 'the pour\'s XP is the host\'s — they lit it')
  ok(Object.keys(p.recipes).length === 0, '★★ bottle only: nobody learns the recipe at a brewing')
}

// ── the curve ──────────────────────────────────────────────────────────────────────────────────
ok(yieldFor(1) === 1, 'one hand = the solo yield')
ok(yieldFor(2) > yieldFor(1) && yieldFor(4) > yieldFor(3), 'more hands brew more')
ok(yieldFor(4) - yieldFor(3) < yieldFor(2) - yieldFor(1), 'and it flattens')
ok(yieldFor(8) < 3, 'eight hands do not triple a pot')
ok(startBrewing('not_a_potion', host, 0) === null, 'an unknown potion starts nothing')

console.log(fails.length ? fails.map(f => `  ✗ ${f}`).join('\n') + `\nbrewing: ${pass} passed, ${fails.length} failed` : `brewing: ${pass} passed, 0 failed`)
if (fails.length) process.exit(1)
