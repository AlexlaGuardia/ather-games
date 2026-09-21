// Run: npx tsx src/app/shimmer/voxel3d/brewing.test.ts
// The brewing ledger against the 09-16 ruling: a hand counts, the host starts, skill follows the
// hand, more hands brew more, bottle only. And solo it IS the solo potion.
import { POTION_DEFS } from '../engine/alchemy'
import { roadOf, alchemyRecipe } from './alchemy-chain'
import {
  startBrewing, join, bring, step, light, pour, yieldFor, contributed,
  nextStep, nextStation, inReach, openFor, runningAt, beginStep, runProgress, settle, stepMs, brewMs,
  pourReady, brewProgress, abandonRefund, roadLine, brewingsFromSave, brewingKey, REACH_BLOCKS,
  type Brewings,
} from './brewing'
import { ALCHEMY_STATIONS, ROAD_STATION, ALCHEMY_RUN_MS } from './alchemy-chain'

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

// ── ★ THE PHYSICAL BREWING (2026-09-21): the pot holds it, any station in reach walks a step ────
{
  // A potion with a real road, the philter: still → bowl → pour.
  const pid = 'holding_philter'
  const road = roadOf(pid)
  ok(road.length === 2 && road[0] === 'distil' && road[1] === 'mix', 'the philter walks still → bowl (the word\'s default road)')
  const at = { space: 'plot', x: 10, y: 5, z: 10 }
  const b0 = startBrewing(pid, host, 1000, at)!
  ok(brewingKey(at) === 'plot:10,5,10', 'the key is the cauldron')
  ok(nextStep(b0) === 'distil' && nextStation(b0) === 'still', 'a fresh pot waits on the still')

  // reach: on the plot, the plot; elsewhere a radius of the pot
  ok(inReach(b0, 'plot', 900, -900), 'on the plot every station is in reach')
  ok(!inReach(b0, 'wilds', 10, 10), 'a station in another space is never in reach')
  const w0 = startBrewing(pid, host, 1000, { space: 'wilds', x: 0, y: 5, z: 0 })!
  ok(inReach(w0, 'wilds', REACH_BLOCKS, 0) && !inReach(w0, 'wilds', REACH_BLOCKS + 1, 0), `off the plot reach is ${REACH_BLOCKS} blocks, from both sides`)
  ok(!inReach(startBrewing(pid, host, 0)!, 'plot', 0, 0), 'a bare ledger (no `at`) reaches nothing')

  // openFor: the right station, in reach, not running, not lit — oldest first
  const later = startBrewing(pid, host, 2000, { space: 'plot', x: 20, y: 5, z: 20 })!
  const all: Brewings = { [brewingKey(at)]: b0, [brewingKey(later.at!)]: later, [brewingKey(w0.at!)]: w0 }
  const open = openFor(all, 'still', 'plot', 0, 0)
  ok(open.length === 2 && open[0] === b0 && open[1] === later, 'a plot still sees both plot pots, oldest first, not the Wilds one')
  ok(openFor(all, 'grinder', 'plot', 0, 0).length === 0, 'a mortar sees nothing — no pot waits on a grind')
  ok(openFor(all, 'mixer', 'plot', 0, 0).length === 0, 'the bowl sees nothing yet — the still comes first')
  ok(openFor(all, 'still', 'wilds', 5, 5).length === 1 && openFor(all, 'still', 'wilds', 5, 5)[0] === w0, 'a Wilds still near the Wilds pot sees only it')

  // beginStep: a station takes it; a second station cannot; the pot now hides from openFor
  const stillKey = '3,5,3'
  const r1 = beginStep(b0, stillKey, host.id, 5000)!
  ok(r1 !== null && r1.run?.station === stillKey && r1.run.step === 1 && r1.run.by === host.id, 'the still takes step 1 for the host')
  ok(beginStep(r1, '4,5,4', host.id, 5001) === null, 'a second still cannot take a step already running')
  ok(beginStep(b0, stillKey, 'nobody', 5000) === null, 'a hand not at the brewing cannot take a step')
  all[brewingKey(at)] = r1
  ok(openFor(all, 'still', 'plot', 0, 0).length === 1 && openFor(all, 'still', 'plot', 0, 0)[0] === later, 'a running pot is not open')
  ok(runningAt(all, stillKey) === r1 && runningAt(all, '9,9,9') === null, 'runningAt finds the pot by the station key')
  ok(stepMs(r1) === ALCHEMY_STATIONS.still.runMs, 'the step runs on the still\'s clock')
  ok(runProgress(r1, 5000) === 0 && runProgress(r1, 5000 + stepMs(r1) / 2) === 0.5 && runProgress(r1, 99999999) === 1, 'progress is 0..1 on that clock')

  // settle: not before the clock; once, on it; idempotent
  ok(settle(r1, 5000 + stepMs(r1) - 1) === r1, 'settle before the clock returns the same object')
  const s1 = settle(r1, 5000 + stepMs(r1))
  ok(s1 !== r1 && s1.stage === 1 && !s1.run && s1.hands[host.id].steps === 1, 'settle on the clock advances the stage, clears the run, pays the hand')
  ok(settle(s1, 99999999) === s1, 'settling a settled pot is a no-op')
  ok(nextStation(s1) === 'mixer', 'now it waits on the bowl')
  all[brewingKey(at)] = s1
  ok(openFor(all, 'mixer', 'plot', 0, 0).length === 1, 'and the bowl sees it')
  ok(light(s1, 6000) === null, 'the pot cannot be lit with a step still to walk')

  // the bowl, then the light, then the pour
  const r2 = beginStep(s1, '7,5,7', host.id, 7000)!
  ok(light(r2, 7000) === null, 'the pot cannot be lit while a step runs')
  const s2 = settle(r2, 7000 + stepMs(r2))
  ok(s2.stage === 2 && nextStep(s2) === null && nextStation(s2) === null, 'the road is walked')
  ok(beginStep(s2, '7,5,7', host.id, 8000) === null, 'no step to take on a walked road')
  ok(openFor({ a: s2 }, 'mixer', 'plot', 0, 0).length === 0 && openFor({ a: s2 }, 'still', 'plot', 0, 0).length === 0, 'a walked pot is open to no station')
  ok(pour(s2) === null && !pourReady(s2, 99999999), 'no pour before the light')
  const lit = light(s2, 9000)!
  ok(lit.lit && lit.litAt === 9000, 'lit, and it remembers when')
  ok(brewMs(lit) === ALCHEMY_STATIONS.cauldron.runMs, 'the pot runs on the cauldron\'s clock')
  ok(!pourReady(lit, 9000 + brewMs(lit) - 1) && pourReady(lit, 9000 + brewMs(lit)), 'the pour is ready on the clock, from both sides')
  ok(brewProgress(lit, 9000 + brewMs(lit) / 4) === 0.25, 'the pot\'s progress is on that clock')
  ok(openFor({ a: lit }, 'still', 'plot', 0, 0).length === 0, 'a lit pot is open to no station')
  const p = pour(lit)!
  ok(p.bottles[host.id] === POTION_DEFS[pid].resultCount, 'solo, the pour is the solo potion')
  ok(p.xp[host.id] === POTION_DEFS[pid].xpGrant, 'solo, the xp is the potion\'s whole grant')

  // a cordial ages in the pot
  const cordial = light({ ...startBrewing('dawn_cordial', host, 0, at)!, stage: roadOf('dawn_cordial').length }, 0)!
  ok(brewMs(cordial) === ALCHEMY_RUN_MS.age, 'a cordial ages — the slow clock')

  // refund: before the light the ingredients; after, nothing
  ok(abandonRefund(s2).length === POTION_DEFS[pid].recipe.length && abandonRefund(s2).every((r, i) => r.count === POTION_DEFS[pid].recipe[i].count), 'tipping out an unlit pot gives every ingredient back')
  ok(abandonRefund(lit).length === 0, 'a lit pot gives nothing back')

  // the line
  ok(roadLine(b0) === 'still → bowl → pour', `a fresh pot: ${roadLine(b0)}`)
  ok(roadLine(r1) === '⟳ still → bowl → pour', `running: ${roadLine(r1)}`)
  ok(roadLine(s1) === '✓ still → bowl → pour', `one walked: ${roadLine(s1)}`)
  ok(roadLine(lit) === '✓ still → ✓ bowl → ⟳ pour', `lit: ${roadLine(lit)}`)
  ok(roadLine(startBrewing('mana_draught', host, 0, at)!) === 'pour', 'a draught has no road — just the pour')

  // the save: round-trips, drops the malformed, re-derives the run's step from the stage
  const saved = JSON.parse(JSON.stringify({ [brewingKey(at)]: r1, [brewingKey(w0.at!)]: { ...lit, at: w0.at }, bad: { potionId: 'nope' }, wrongkey: { ...b0 }, [brewingKey(later.at!)]: { ...later, hands: {} } }))
  const back = brewingsFromSave(saved)
  ok(Object.keys(back).length === 2, `two of five entries survive the load (${Object.keys(back).join(', ')})`)
  ok(back[brewingKey(at)].run?.station === stillKey && back[brewingKey(at)].run?.since === 5000 && back[brewingKey(at)].run?.step === 1, 'a running pot comes back running')
  ok(back[brewingKey(w0.at!)].lit && back[brewingKey(w0.at!)].litAt === 9000 && back[brewingKey(w0.at!)].stage === 2, 'a lit pot comes back lit at its time')
  ok(Object.keys(brewingsFromSave(undefined)).length === 0 && Object.keys(brewingsFromSave('x')).length === 0, 'absent and malformed load empty')
  ok(brewingsFromSave({ [brewingKey(at)]: { ...b0, stage: 99 } })[brewingKey(at)].stage === road.length, 'a stage past the road is clamped to it')

  // every station's step name is the road station's — the line and the panel read the same table
  for (const st of Object.keys(ROAD_STATION) as (keyof typeof ROAD_STATION)[]) ok(ALCHEMY_STATIONS[ROAD_STATION[st]].step === st, `${st} runs at the ${ROAD_STATION[st]}`)
}

console.log(fails.length ? fails.map(f => `  ✗ ${f}`).join('\n') + `\nbrewing: ${pass} passed, ${fails.length} failed` : `brewing: ${pass} passed, 0 failed`)
if (fails.length) process.exit(1)
