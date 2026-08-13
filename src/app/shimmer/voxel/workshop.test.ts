// Run: npx tsx src/app/shimmer/voxel/workshop.test.ts
//
// ★ THE ASSERT THIS FILE EXISTS FOR IS "COLLECTING DOES NOT COST YOU TIME".
//
// Everything else here is ordinary. The one that earns its place is the pair at *the collect clock*:
// `collect` must advance `since` by exactly `done × RUN_MS` and never to `now`, because the wrong
// version is invisible. It passes every "does the station pay out" test, it never throws, and the
// only symptom is that a workshop runs mysteriously slower than 12s a log for players who check on
// it — i.e. the attentive ones get punished and nobody can say why. A single-collect test cannot
// catch it (one collect at an exact boundary agrees under both), so the oracle collects MID-RUN and
// then measures when the next run lands.
//
// The other class worth stating: a station holds goods that are already out of the player's bag, so
// every path off it (collect, salvage, refusing to overwrite) is a place inventory can be silently
// destroyed or duplicated. `conservation` sweeps that.

import { RECIPES, recipeDef } from './recipes'
import {
  RUN_MS, stationKey, milledYield, runsReady, runProgress, isSpent,
  jobCost, loadJob, collect, salvage, stationRecipes, maxRuns, MAX_RUNS, type Workshop,
} from './workshop'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const T0 = 1_700_000_000_000        // a fixed epoch; nothing here may depend on the real clock
const KEY = stationKey(10, 64, -3)
const load = (recipeId: string, runs: number, at = T0): Workshop =>
  loadJob({}, KEY, recipeId, runs, at)

// ── the milled yield ──────────────────────────────────────────────────────────
console.log('milled yield')
{
  check('no recipe pays LESS at a station than in the hand',
    RECIPES.every(r => milledYield(r) >= r.output.count),
    RECIPES.filter(r => milledYield(r) < r.output.count).map(r => r.id).join(', '))

  check('a row with no bonus falls back to the hand yield',
    milledYield(recipeDef('chest')!) === recipeDef('chest')!.output.count)

  // These two are guarding RULINGS, not arithmetic — see the `milled` doc comment. If someone adds
  // a bonus here later it should be a deliberate act that turns this test red, not a tidy-up.
  check('cut_stone keeps its 2:1 loss at a station (the quarry-is-a-trip dial)',
    recipeDef('cut_stone')!.milled === undefined)
  check('planking gets no station bonus (assembly is not extraction)',
    recipeDef('planking')!.milled === undefined)

  const logRefines = RECIPES.filter(r => r.input.some(i => i.itemId.endsWith('_log')))
  check('every log-refine DOES pay better milled', logRefines.length > 0 &&
    logRefines.every(r => milledYield(r) > r.output.count),
    logRefines.filter(r => milledYield(r) <= r.output.count).map(r => r.id).join(', '))
}

// ── what a station will run ───────────────────────────────────────────────────
console.log('station recipes')
{
  const rows = stationRecipes()
  check('a station offers something at all', rows.length > 0)
  // The invariant `recipes.ts` refuses to give up: furniture never gates access.
  check('every station recipe is also hand-makeable', rows.every(r => r.station === 'hand'))
  check('nothing input-less sneaks in', rows.every(r => r.input.length > 0))
}

// ── how much the bag can queue ────────────────────────────────────────────────
console.log('queue size')
{
  const r = recipeDef('goldwood_planks')!            // 1 log per run
  const stone = recipeDef('cut_stone')!              // 2 rubble per run
  const bag = (items: Record<string, number>) => (id: string) => items[id] ?? 0

  check('an empty bag queues nothing', maxRuns(r, bag({})) === 0)
  check('one log queues one run', maxRuns(r, bag({ goldwood_log: 1 })) === 1)
  check('a multi-unit input divides down', maxRuns(stone, bag({ rubble: 7 })) === 3)
  check('not enough for a single run is zero, never a fraction',
    maxRuns(stone, bag({ rubble: 1 })) === 0)
  check('the cap holds against a console-fed bag',
    maxRuns(r, bag({ goldwood_log: 100_000 })) === MAX_RUNS)

  const lantern = recipeDef('mana_lantern')!         // two different inputs
  check('a multi-input recipe is limited by its SCARCEST input',
    maxRuns(lantern, bag({ raw_mana_shard: 9, goldwood_plank: 4 })) === 2)

  // The property that keeps the display and the spend path honest.
  let affordable = true
  for (const rec of stationRecipes()) {
    const have = bag(Object.fromEntries(rec.input.map(i => [i.itemId, i.count * 5])))
    const n = maxRuns(rec, have)
    if (!jobCost(rec, n).every(c => have(c.itemId) >= c.count)) affordable = false
  }
  check('whatever maxRuns promises, jobCost can actually be paid', affordable)
}

// ── the clock ─────────────────────────────────────────────────────────────────
console.log('the clock')
{
  const shop = load('goldwood_planks', 5)
  const job = shop[KEY]

  check('nothing is ready immediately', runsReady(job, T0) === 0)
  check('one run lands exactly on RUN_MS', runsReady(job, T0 + RUN_MS) === 1)
  check('a run is not paid a millisecond early', runsReady(job, T0 + RUN_MS - 1) === 0)
  check('runs accumulate', runsReady(job, T0 + 3 * RUN_MS) === 3)

  // A station left overnight must not manufacture runs nobody paid input for.
  check('ready is capped at the runs owed', runsReady(job, T0 + 500 * RUN_MS) === 5)

  // A clock that stepped backwards (or a hand-edited save) must not underflow the collect maths.
  check('a future stamp reads as zero, never negative', runsReady(job, T0 - 60_000) === 0)
  check('progress on a future stamp is zero', runProgress(job, T0 - 60_000) === 0)

  check('progress is halfway at half a run', Math.abs(runProgress(job, T0 + RUN_MS / 2) - 0.5) < 1e-9)
  check('progress resets across a run boundary',
    Math.abs(runProgress(job, T0 + RUN_MS + RUN_MS / 4) - 0.25) < 1e-9)
  check('a finished job reads as full progress, not mid-run',
    runProgress(job, T0 + 5 * RUN_MS) === 1 && runProgress(job, T0 + 9 * RUN_MS) === 1)
}

// ── ★ the collect clock — the assert this file exists for ─────────────────────
console.log('the collect clock')
{
  const r = recipeDef('goldwood_planks')!
  // Collect 1.5 runs in: one run is owed, and HALF of the next is already in the machine.
  const midway = T0 + Math.floor(1.5 * RUN_MS)
  const first = collect(load('goldwood_planks', 5), KEY, midway)
  check('a mid-run collect pays only the finished run',
    first.payout?.count === milledYield(r), String(first.payout?.count))
  check('and leaves the rest owed', first.shop[KEY].runs === 4)

  // ★★ THE ONE THAT MATTERS. `since` moved by exactly one RUN_MS, so the run that was half done is
  // still half done. Under the wrong version (`since = now`) that half-run restarts, and the second
  // run would not land until midway + RUN_MS.
  check('the in-flight run keeps its progress across a collect',
    first.shop[KEY].since === T0 + RUN_MS, `since=${first.shop[KEY].since - T0}`)
  check('so the next run lands on the ORIGINAL schedule, not the collect time',
    runsReady(first.shop[KEY], T0 + 2 * RUN_MS) === 1)
  check('and the half-run is not silently re-charged',
    runProgress(first.shop[KEY], midway) === 0.5)

  // The same property stated as the thing a player would actually notice: collecting constantly
  // must produce exactly as much as never collecting at all.
  //
  // ⚠ THE STRIDE MUST NOT DIVIDE `RUN_MS`, and this assert was VACUOUS until it did not. Written
  // first with a 1000ms stride, every collect landed exactly on a run boundary — the one moment
  // `since + done × RUN_MS` and `since = now` produce the identical answer — so it stayed green
  // under the very mutation it was written to catch. A player checks his workshop at whatever
  // moment he walks past it, so the oracle has to as well.
  const STRIDE = 1777
  const patient = collect(load('goldwood_planks', 8), KEY, T0 + 8 * RUN_MS)
  let anxious = load('goldwood_planks', 8)
  let got = 0
  for (let ms = STRIDE; ms <= 8 * RUN_MS; ms += STRIDE) {
    const c = collect(anxious, KEY, T0 + ms)
    anxious = c.shop
    got += c.payout?.count ?? 0
  }
  got += collect(anxious, KEY, T0 + 8 * RUN_MS).payout?.count ?? 0   // the tail the stride overshot
  check('checking on the workshop every second costs nothing',
    got === patient.payout!.count, `anxious=${got} patient=${patient.payout!.count}`)

  check('collecting an unfinished job pays nothing and does not reset it', (() => {
    const s = load('goldwood_planks', 3)
    const c = collect(s, KEY, T0 + RUN_MS / 2)
    return c.payout === null && c.shop[KEY].since === T0 && c.shop[KEY].runs === 3
  })())

  check('a fully drained station leaves no record behind', (() => {
    const c = collect(load('goldwood_planks', 2), KEY, T0 + 2 * RUN_MS)
    return c.shop[KEY] === undefined
  })())

  check('collecting an empty station is a no-op, not a throw',
    collect({}, KEY, T0).payout === null)

  check('an unknown recipe id pays nothing rather than crashing an old save', (() => {
    const s: Workshop = { [KEY]: { recipeId: 'sawdust_pudding', runs: 4, since: T0 } }
    return collect(s, KEY, T0 + 9 * RUN_MS).payout === null
  })())
}

// ── loading ───────────────────────────────────────────────────────────────────
console.log('loading')
{
  check('a job loads', load('goldwood_planks', 4)[KEY].runs === 4)
  check('zero runs is refused', Object.keys(load('goldwood_planks', 0)).length === 0)
  check('a negative run count is refused', Object.keys(load('goldwood_planks', -3)).length === 0)
  check('an unknown recipe is refused', Object.keys(load('nonsense_id', 4)).length === 0)

  // ★ The UI greys this button, but a grey is a display. If this write went through it would
  // destroy input the player already paid, and he would never see it happen.
  const live = load('goldwood_planks', 6)
  const stomp = loadJob(live, KEY, 'amber_sap', 2, T0 + RUN_MS)
  check('a live job cannot be overwritten',
    stomp[KEY].recipeId === 'goldwood_planks' && stomp[KEY].runs === 6)

  const drained = collect(load('goldwood_planks', 2), KEY, T0 + 2 * RUN_MS).shop
  check('but a spent station takes a new job',
    loadJob(drained, KEY, 'amber_sap', 3, T0)[KEY].recipeId === 'amber_sap')

  check('isSpent reads a drained job', isSpent({ recipeId: 'x', runs: 0, since: T0 }))

  check('two stations keep separate jobs', (() => {
    const other = stationKey(-40, 70, 12)
    const s = loadJob(load('goldwood_planks', 3), other, 'amber_sap', 2, T0)
    return s[KEY].recipeId === 'goldwood_planks' && s[other].recipeId === 'amber_sap'
  })())

  check('loading does not mutate the workshop it was handed', (() => {
    const before: Workshop = {}
    loadJob(before, KEY, 'goldwood_planks', 3, T0)
    return Object.keys(before).length === 0
  })())
}

// ── cost + salvage conservation ───────────────────────────────────────────────
console.log('conservation')
{
  const r = recipeDef('goldwood_planks')!
  check('cost scales with runs', jobCost(r, 7)[0].count === 7 * r.input[0].count)

  // Break it before it has done anything: you get your logs back, exactly.
  const untouched = salvage(load('goldwood_planks', 5), KEY, T0)
  check('smashing an untouched station refunds the whole input',
    untouched.drops.length === 1 &&
    untouched.drops[0].itemId === 'goldwood_log' && untouched.drops[0].count === 5)
  check('and clears the record', untouched.shop[KEY] === undefined)

  // Half done: two runs paid at the milled rate, three logs handed back.
  const half = salvage(load('goldwood_planks', 5), KEY, T0 + 2 * RUN_MS)
  const planks = half.drops.find(d => d.itemId === 'goldwood_plank')
  const logs = half.drops.find(d => d.itemId === 'goldwood_log')
  check('a part-done station pays finished runs at the milled rate',
    planks?.count === 2 * milledYield(r), String(planks?.count))
  check('and refunds only the runs it never started', logs?.count === 3, String(logs?.count))

  // ★ THE EXPLOIT CHECK. If salvage paid milled output for runs that never happened, "load it and
  // smash it" would be an instant, better-than-hand refinery with no wait at all.
  check('load-and-smash cannot beat the mill',
    untouched.drops.every(d => d.itemId !== r.output.itemId))

  // ⚠ The run IN FLIGHT refunds as input rather than part-paying: there is no half a plank, and
  // rounding it either way is a lie in one direction.
  const inflight = salvage(load('goldwood_planks', 4), KEY, T0 + Math.floor(1.5 * RUN_MS))
  check('the in-flight run comes back as input, not as a rounded payout',
    inflight.drops.find(d => d.itemId === 'goldwood_log')?.count === 3 &&
    inflight.drops.find(d => d.itemId === 'goldwood_plank')?.count === milledYield(r))

  // Nothing is created or destroyed: whatever the station holds, salvage hands back input-equivalent
  // value for the unstarted part and output for the done part, for EVERY station recipe.
  let conserved = true, offender = ''
  for (const rec of stationRecipes()) {
    for (const runs of [1, 3, 12]) {
      for (const at of [0, 1, runs - 1, runs]) {
        const s = salvage(load(rec.id, runs), KEY, T0 + at * RUN_MS)
        const out = s.drops.find(d => d.itemId === rec.output.itemId)?.count ?? 0
        const doneRuns = out / milledYield(rec)
        const backs = rec.input.map(i =>
          (s.drops.find(d => d.itemId === i.itemId)?.count ?? 0) / i.count)
        // Careful: a recipe whose input and output share an id would break this decomposition.
        // None do today, and `recipes.test.ts` would be the place to forbid it if one ever did.
        const ok = Number.isInteger(doneRuns) && backs.every(b => Number.isInteger(b) &&
          b + doneRuns === runs)
        if (!ok) { conserved = false; offender = `${rec.id} runs=${runs} at=${at}` }
      }
    }
  }
  check('every station recipe conserves runs across a salvage at any point', conserved, offender)

  check('salvaging an empty station is a no-op', salvage({}, KEY, T0).drops.length === 0)
}

console.log(`\nworkshop: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
