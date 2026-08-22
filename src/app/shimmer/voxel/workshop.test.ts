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

import { RECIPES, recipeDef, type RecipeDef } from './recipes'
import {
  RUN_MS, stationKey, milledYield, runsReady, runProgress, isSpent,
  jobCost, loadJob, collect, salvage, stationRecipes, maxRuns, MAX_RUNS,
  STATIONS, STATION_ITEMS, STATION_MAT, worksOn, paysBonus, payingStations,
  type Workshop,
} from './workshop'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const T0 = 1_700_000_000_000        // a fixed epoch; nothing here may depend on the real clock
const KEY = stationKey(10, 64, -3)
const BENCH = STATIONS.crafting_table
const MILL = STATIONS.sawmill
const CUTTER = STATIONS.stonecutter
const load = (recipeId: string, runs: number, at = T0): Workshop =>
  loadJob({}, KEY, recipeId, runs, at)

// ── the milled yield ──────────────────────────────────────────────────────────
console.log('milled yield')
{
  check('no recipe pays LESS at a station than in the hand',
    RECIPES.every(r => Object.values(STATIONS).every(st => milledYield(r, st) >= r.output.count)),
    RECIPES.filter(r => Object.values(STATIONS).some(st => milledYield(r, st) < r.output.count)).map(r => r.id).join(', '))

  check('a row with no bonus falls back to the hand yield',
    milledYield(recipeDef('chest')!, BENCH) === recipeDef('chest')!.output.count)

  // Guarding a RULING, not arithmetic — see the `milled` doc comment. Assembly is not extraction:
  // a bench does not conjure a third plank out of two, anywhere, ever.
  // ⚠ WAS PINNED TO `planking`, WHICH WAS CUT ON 2026-08-22 AND TOOK THIS ASSERT DOWN WITH IT.
  // One id standing in for a rule is a guard that dies when the exemplar does — so the rule is now
  // asserted over EVERY assembly row (a recipe that declares no `milled`), which is what it always
  // meant. It also gets stronger as the table grows instead of weaker.
  const assembly = RECIPES.filter(r => r.milled === undefined)
  check('assembly rows are non-empty, so this is not passing by being blind', assembly.length > 0)
  const bonused = assembly.filter(r =>
    Object.values(STATIONS).some(st => milledYield(r, st) !== r.output.count))
  check('NO assembly row gets a station bonus anywhere (assembly is not extraction)',
    bonused.length === 0,
    `a bench does not conjure a third plank out of two, anywhere, ever — ${bonused.map(r => r.id).join(', ')}`)

  const logRefines = RECIPES.filter(r => r.input.some(i => i.itemId.endsWith('_log')))
  check('every log-refine DOES pay better milled', logRefines.length > 0 &&
    logRefines.every(r => milledYield(r, MILL) > r.output.count),
    logRefines.filter(r => milledYield(r, MILL) <= r.output.count).map(r => r.id).join(', '))
}

// ── ★ THE DERIVATIONS SURVIVE AS ORACLES (2026-08-15) ─────────────────────────
// `RecipeDef.family` replaced two string tests that used to BE the mechanism (`endsWith('_log')`
// and `=== 'rubble'`). Those tests were right about every case they could see; what killed them is
// that masonry grew inputs they cannot see (cut stone, spring crust, sand). So they move here.
//
// ★ THIS IS THE WHOLE MITIGATION FOR MOVING FROM A DERIVED RULE TO A HAND-WRITTEN FIELD. A tag is
// a thing someone forgets, and forgetting it is SILENT — the recipe simply never appears at its
// specialist, which looks like a design decision. Every case still mechanically derivable is
// therefore asserted, so the field can only be forgotten where nothing could have known better.
console.log('family tags')
{
  const untagged = (pred: (r: RecipeDef) => boolean, want: string) =>
    RECIPES.filter(r => pred(r) && r.family !== want).map(r => r.id)

  const logs = untagged(r => r.input.some(i => i.itemId.endsWith('_log')), 'wood')
  check('every recipe consuming a log is tagged wood', logs.length === 0,
    `${logs.join(', ')} — a fifth tree species needs family: 'wood' on its row`)

  const stone = untagged(r => r.input.some(i => i.itemId === 'rubble'), 'stone')
  check('every recipe consuming rubble is tagged stone', stone.length === 0, stone.join(', '))

  // A family nobody claims is a tag that does nothing — either a station is missing or the tag is.
  const claimed = new Set(Object.values(STATIONS).flatMap(s => [s.accepts, s.pays]))
  const orphan = [...new Set(RECIPES.map(r => r.family).filter(Boolean))].filter(f => !claimed.has(f as never))
  check('every family a recipe declares is some station\'s speciality', orphan.length === 0,
    `${orphan.join(', ')} — tagged rows that no station will ever run`)

  // And the reverse: a station specialising in a family no recipe carries is furniture with a panel.
  const empty = Object.values(STATIONS).filter(s => s.accepts !== 'any' && stationRecipes(s.id).length === 0)
  check('no station specialises in an empty family', empty.length === 0, empty.map(s => s.id).join(', '))
}

// ── ★ THE BONUS IS A STATION × RECIPE PAIR, NOT A PROPERTY OF THE ROW ─────────
// This is the pass the stonecutter forced (2026-08-15) and the one to argue with before "tidying"
// `milledYield` back to a single argument. Under the old one-argument form, `cut_stone` declaring a
// bonus meant EVERY station paid it — so the bench would silently match a purpose-built cutter, the
// quarry dial would be erased for players who never build one, and the cutter would be a slower
// bench. None of that throws, and none of it shows up as anything but "stone feels cheap now".
console.log('who pays the bonus')
{
  const stone = recipeDef('cut_stone')!
  const planks = recipeDef('goldwood_planks')!

  check('the cutter pays the stone bonus', milledYield(stone, CUTTER) === 3)
  check('★ the BENCH does not — a carpenter\'s bench shatters rock like anyone else',
    milledYield(stone, BENCH) === stone.output.count,
    `bench paid ${milledYield(stone, BENCH)} for stone`)
  check('and the mill will not even take stone', !worksOn(MILL, stone))

  check('the bench keeps its wood bonus (unchanged behaviour, now written down)',
    milledYield(planks, BENCH) === 6 && milledYield(planks, MILL) === 6)
  check('the cutter pays nothing on wood', milledYield(planks, CUTTER) === planks.output.count)

  // ★ `pays` MUST BE A SUBSET OF `accepts`. A station that pays a bonus on work it refuses to take
  // is incoherent — the number could never be earned, and the panel would advertise it anyway.
  check('every station only pays on work it will actually accept',
    Object.values(STATIONS).every(st => RECIPES.every(r => !paysBonus(st, r) || worksOn(st, r))),
    Object.values(STATIONS).filter(st => RECIPES.some(r => paysBonus(st, r) && !worksOn(st, r))).map(s => s.id).join(', '))

  // The hand panel's honesty depends on this: a row with a bonus must be able to name where.
  check('every bonus-bearing recipe names at least one station that pays it',
    RECIPES.filter(r => r.milled !== undefined).every(r => payingStations(r).length > 0),
    RECIPES.filter(r => r.milled !== undefined && payingStations(r).length === 0).map(r => r.id).join(', '))
  // Same de-pinning as above: every assembly row names nowhere, not just one chosen id.
  check('an assembly row names nowhere',
    RECIPES.filter(r => r.milled === undefined).every(r => payingStations(r).length === 0))
}

// ── ★ STONE STILL RUNS AT A LOSS, AT EVERY STATION ────────────────────────────
// The dial the old `milled === undefined` assert was really defending, stated as the property
// rather than as the absence of a field. `cut_stone` may now declare a bonus; what it may never do
// is let stone break even, because a net-loss stone economy against a net-gain wood one IS the
// building grammar (`recipes.test.ts` §7).
console.log('the quarry dial')
{
  const stone = recipeDef('cut_stone')!
  const rubblePerRun = stone.input.find(i => i.itemId === 'rubble')!.count
  for (const st of Object.values(STATIONS)) {
    if (!worksOn(st, stone)) continue
    check(`stone still loses material at ${st.id}`, milledYield(stone, st) < rubblePerRun,
      `${milledYield(stone, st)} out of ${rubblePerRun} rubble — a station may narrow the loss, never erase it`)
  }

  // ★★ AND THE GENERAL FORM, WHICH IS THE ONE THAT SCALES: MASONRY NEVER MULTIPLIES. The rule above
  // guards one row; this guards the palette. Every stone recipe must hand back at most as many
  // blocks as it consumed, at every station that will run it — break even at best, never profit.
  //
  // This is `recipes.test.ts` §7's asymmetry stated where a station can violate it: WOOD multiplies
  // (one log becomes four planks, because a tree is renewable and timber should feel it) and STONE
  // does not (you went to a quarry). A masonry row that pays 4 for 3 would not throw, would not
  // look wrong in the table, and would quietly make stone the cheap material — inverting the whole
  // building grammar as a side effect of somebody being generous with a brick.
  const masonry = RECIPES.filter(r => r.family === 'stone')
  check('there is a masonry palette to check at all', masonry.length >= 4, `${masonry.length} rows`)
  let mult = ''
  for (const r of masonry) {
    const inBlocks = r.input.reduce((n, i) => n + i.count, 0)
    for (const st of Object.values(STATIONS)) {
      if (!worksOn(st, r)) continue
      if (milledYield(r, st) > inBlocks) mult = `${r.id} pays ${milledYield(r, st)} for ${inBlocks} at ${st.id}`
    }
  }
  check('★ masonry never multiplies — stone breaks even at best, anywhere', mult === '', mult)

  // ...and the other half of the asymmetry, so "stone never multiplies" cannot be satisfied by
  // quietly flattening wood to match it.
  const woodGain = RECIPES.filter(r => r.family === 'wood')
    .some(r => r.output.count > r.input.reduce((n, i) => n + i.count, 0))
  check('wood still DOES multiply — the asymmetry is the economy', woodGain)
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

// ── ★ the stations differ, and the DIFFERENCE is the design ───────────────────
// A station strictly better than the bench retires the bench. These asserts are what stop a
// specialist drifting into a plain upgrade the next time someone tunes it.
//
// ★ WRITTEN OVER `STATIONS`, NOT OVER TWO NAMED IDS (2026-08-15). The sawmill's versions of these
// named the mill by hand, so the stonecutter arrived with none of them — the third station would
// have shipped without the one check that keeps the bench alive. Station four gets them free.
console.log('station kinds')
{
  const bench = stationRecipes('crafting_table')
  const specialists = Object.values(STATIONS).filter(s => s.id !== 'crafting_table')

  check('there is more than one specialist to reason about', specialists.length >= 2)

  for (const st of specialists) {
    const rows = stationRecipes(st.id)
    // ★ THE ONE THAT KEEPS THE BENCH ALIVE. Any single advantage would make a specialist a straight
    // upgrade; being narrower is what it pays for that advantage.
    check(`${st.id} is NARROWER than the bench`, rows.length < bench.length,
      `bench=${bench.length} ${st.id}=${rows.length}`)
    // ...and a station that accepts NOTHING is furniture with a panel.
    check(`${st.id} has something to work on at all`, rows.length > 0)
    // A SUBSET, never a divergent list — a recipe a specialist runs must be one the bench runs too,
    // or the two tables have drifted into separate hand-kept lists.
    check(`everything ${st.id} runs, the bench runs`, rows.every(m => bench.some(b => b.id === m.id)))
    // Every row it offers is genuinely inside its speciality.
    check(`${st.id} only offers its own speciality`, rows.every(r => worksOn(st, r)))
  }

  check('the sawmill is faster than the bench', MILL.runMs < BENCH.runMs)

  // ★ AND THE CUTTER IS SLOWER, WHICH IS THE POINT — it sells material, not time. If this ever
  // flips, the family has one axis again and the third station is the second one wearing grey.
  check('the stonecutter is SLOWER than the bench, deliberately', CUTTER.runMs > BENCH.runMs)

  // ★★ EXACT THROUGHPUT PARITY ON STONE, CHOSEN AND NOT STUMBLED INTO. 3 per 18s and 2 per 12s are
  // the same stone per second, so the cutter genuinely offers no dominant answer — it makes rubble
  // go further, never arrive faster. Cross-multiplied so it is an integer compare and not a float
  // one. If a tuning pass moves either number, this fails and the choice becomes visible.
  {
    const stone = recipeDef('cut_stone')!
    check('the cutter and the bench make stone at the SAME rate — only the rubble differs',
      milledYield(stone, CUTTER) * BENCH.runMs === milledYield(stone, BENCH) * CUTTER.runMs,
      `cutter ${milledYield(stone, CUTTER)}/${CUTTER.runMs}ms vs bench ${milledYield(stone, BENCH)}/${BENCH.runMs}ms`)
    check('...and the cutter is the one that wastes less rubble',
      milledYield(stone, CUTTER) > milledYield(stone, BENCH))
  }

  // Named explicitly: these are the jobs the bench must keep, or a plot only ever wants a specialist.
  for (const id of ['mana_lantern', 'clay_pot', 'chest']) {
    check(`the bench alone keeps ${id}`,
      bench.some(r => r.id === id) && specialists.every(st => !stationRecipes(st.id).some(r => r.id === id)))
  }
  // The two specialities do not overlap: wood work and stone work are different plots of ground.
  check('no recipe is claimed by both specialists',
    !stationRecipes('sawmill').some(r => stationRecipes('stonecutter').some(s => s.id === r.id)))

  // Every station id must resolve, or a placed block opens a panel with no rate.
  check('every station id has a definition',
    [...STATION_ITEMS].every(id => !!STATIONS[id as keyof typeof STATIONS]))
  check('every station is craftable from the recipe table',
    [...STATION_ITEMS].every(id => RECIPES.some(r => r.output.itemId === id)),
    [...STATION_ITEMS].filter(id => !RECIPES.some(r => r.output.itemId === id)).join(', '))

  // ★ EVERY STATION NEEDS A BLOCK, or it is an item you can craft, place, and then not open. The
  // `stationOf` map is the single definition four call sites ask; a station missing from it is a
  // dead click with nothing in the console.
  check('every station has a material that maps back to it',
    Object.keys(STATIONS).every(id => Object.values(STATION_MAT).includes(id as never)),
    Object.keys(STATIONS).filter(id => !Object.values(STATION_MAT).includes(id as never)).join(', '))
  check('no material maps to a station that does not exist',
    Object.values(STATION_MAT).every(id => !!STATIONS[id]))
}

// ── the rate is per-station, and it is never read off the job ─────────────────
console.log('per-station rate')
{
  const MILL_MS = MILL.runMs
  const job = load('goldwood_planks', 4)[KEY]

  check('the same job pays faster at the mill than at the bench',
    runsReady(job, T0 + 3 * MILL_MS, MILL_MS) === 3 && runsReady(job, T0 + 3 * MILL_MS, RUN_MS) === 1)

  // ★ The job carries no rate of its own — that is what lets STATIONS be tuned for benches already
  // standing in the world. If a `runMs` ever appears on StationJob, this is the assert to argue with.
  check('a job stores no rate of its own',
    !Object.keys(job).includes('runMs') && !Object.keys(job).includes('rate'))

  // Collect at the mill advances by the MILL's run, not the bench's — the collect-clock property
  // restated per-station, because getting this wrong would silently pay bench progress at a mill.
  const c = collect(load('goldwood_planks', 5), KEY, T0 + Math.floor(1.5 * MILL_MS), MILL)
  check('a mill collect advances by the MILL run length',
    c.shop[KEY].since === T0 + MILL_MS, `since=${c.shop[KEY].since - T0} want=${MILL_MS}`)

  // ★ THE SAME PROPERTY FOR THE SLOW STATION, because "faster" and "slower" are different bugs.
  // A cutter collected against the bench's 12s would hand over runs it has not finished.
  const stoneJob = load('cut_stone', 4)[KEY]
  check('a cutter run is not paid at the bench\'s pace',
    runsReady(stoneJob, T0 + BENCH.runMs, CUTTER.runMs) === 0 &&
    runsReady(stoneJob, T0 + CUTTER.runMs, CUTTER.runMs) === 1)
}

// ── how much the bag can queue ────────────────────────────────────────────────
console.log('queue size')
{
  const r = recipeDef('goldwood_planks')!            // 1 log per run
  const stone = recipeDef('cut_stone')!              // 4 rubble per run (re-granulated 2026-08-15)
  const bag = (items: Record<string, number>) => (id: string) => items[id] ?? 0

  check('an empty bag queues nothing', maxRuns(r, bag({})) === 0)
  check('one log queues one run', maxRuns(r, bag({ goldwood_log: 1 })) === 1)
  // Written against the recipe's own input count rather than a literal, so a re-granulation is a
  // balance decision rather than a test edit. The 2→4 change on 2026-08-15 broke the literal form.
  const perRun = stone.input[0].count
  check('a multi-unit input divides down', maxRuns(stone, bag({ rubble: perRun * 3 + 1 })) === 3)
  check('not enough for a single run is zero, never a fraction',
    maxRuns(stone, bag({ rubble: perRun - 1 })) === 0)
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

  check('nothing is ready immediately', runsReady(job, T0, RUN_MS) === 0)
  check('one run lands exactly on RUN_MS', runsReady(job, T0 + RUN_MS, RUN_MS) === 1)
  check('a run is not paid a millisecond early', runsReady(job, T0 + RUN_MS - 1, RUN_MS) === 0)
  check('runs accumulate', runsReady(job, T0 + 3 * RUN_MS, RUN_MS) === 3)

  // A station left overnight must not manufacture runs nobody paid input for.
  check('ready is capped at the runs owed', runsReady(job, T0 + 500 * RUN_MS, RUN_MS) === 5)

  // A clock that stepped backwards (or a hand-edited save) must not underflow the collect maths.
  check('a future stamp reads as zero, never negative', runsReady(job, T0 - 60_000, RUN_MS) === 0)
  check('progress on a future stamp is zero', runProgress(job, T0 - 60_000, RUN_MS) === 0)

  check('progress is halfway at half a run', Math.abs(runProgress(job, T0 + RUN_MS / 2, RUN_MS) - 0.5) < 1e-9)
  check('progress resets across a run boundary',
    Math.abs(runProgress(job, T0 + RUN_MS + RUN_MS / 4, RUN_MS) - 0.25) < 1e-9)
  check('a finished job reads as full progress, not mid-run',
    runProgress(job, T0 + 5 * RUN_MS, RUN_MS) === 1 && runProgress(job, T0 + 9 * RUN_MS, RUN_MS) === 1)
}

// ── ★ the collect clock — the assert this file exists for ─────────────────────
console.log('the collect clock')
{
  const r = recipeDef('goldwood_planks')!
  // Collect 1.5 runs in: one run is owed, and HALF of the next is already in the machine.
  const midway = T0 + Math.floor(1.5 * RUN_MS)
  const first = collect(load('goldwood_planks', 5), KEY, midway, BENCH)
  check('a mid-run collect pays only the finished run',
    first.payout?.count === milledYield(r, BENCH), String(first.payout?.count))
  check('and leaves the rest owed', first.shop[KEY].runs === 4)

  // ★★ THE ONE THAT MATTERS. `since` moved by exactly one RUN_MS, so the run that was half done is
  // still half done. Under the wrong version (`since = now`) that half-run restarts, and the second
  // run would not land until midway + RUN_MS.
  check('the in-flight run keeps its progress across a collect',
    first.shop[KEY].since === T0 + RUN_MS, `since=${first.shop[KEY].since - T0}`)
  check('so the next run lands on the ORIGINAL schedule, not the collect time',
    runsReady(first.shop[KEY], T0 + 2 * RUN_MS, RUN_MS) === 1)
  check('and the half-run is not silently re-charged',
    runProgress(first.shop[KEY], midway, RUN_MS) === 0.5)

  // The same property stated as the thing a player would actually notice: collecting constantly
  // must produce exactly as much as never collecting at all.
  //
  // ⚠ THE STRIDE MUST NOT DIVIDE `RUN_MS`, and this assert was VACUOUS until it did not. Written
  // first with a 1000ms stride, every collect landed exactly on a run boundary — the one moment
  // `since + done × RUN_MS` and `since = now` produce the identical answer — so it stayed green
  // under the very mutation it was written to catch. A player checks his workshop at whatever
  // moment he walks past it, so the oracle has to as well.
  const STRIDE = 1777
  const patient = collect(load('goldwood_planks', 8), KEY, T0 + 8 * RUN_MS, BENCH)
  let anxious = load('goldwood_planks', 8)
  let got = 0
  for (let ms = STRIDE; ms <= 8 * RUN_MS; ms += STRIDE) {
    const c = collect(anxious, KEY, T0 + ms, BENCH)
    anxious = c.shop
    got += c.payout?.count ?? 0
  }
  got += collect(anxious, KEY, T0 + 8 * RUN_MS, BENCH).payout?.count ?? 0   // the tail the stride overshot
  check('checking on the workshop every second costs nothing',
    got === patient.payout!.count, `anxious=${got} patient=${patient.payout!.count}`)

  check('collecting an unfinished job pays nothing and does not reset it', (() => {
    const s = load('goldwood_planks', 3)
    const c = collect(s, KEY, T0 + RUN_MS / 2, BENCH)
    return c.payout === null && c.shop[KEY].since === T0 && c.shop[KEY].runs === 3
  })())

  check('a fully drained station leaves no record behind', (() => {
    const c = collect(load('goldwood_planks', 2), KEY, T0 + 2 * RUN_MS, BENCH)
    return c.shop[KEY] === undefined
  })())

  check('collecting an empty station is a no-op, not a throw',
    collect({}, KEY, T0, BENCH).payout === null)

  check('an unknown recipe id pays nothing rather than crashing an old save', (() => {
    const s: Workshop = { [KEY]: { recipeId: 'sawdust_pudding', runs: 4, since: T0 } }
    return collect(s, KEY, T0 + 9 * RUN_MS, BENCH).payout === null
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

  const drained = collect(load('goldwood_planks', 2), KEY, T0 + 2 * RUN_MS, BENCH).shop
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
  const untouched = salvage(load('goldwood_planks', 5), KEY, T0, BENCH)
  check('smashing an untouched station refunds the whole input',
    untouched.drops.length === 1 &&
    untouched.drops[0].itemId === 'goldwood_log' && untouched.drops[0].count === 5)
  check('and clears the record', untouched.shop[KEY] === undefined)

  // Half done: two runs paid at the milled rate, three logs handed back.
  const half = salvage(load('goldwood_planks', 5), KEY, T0 + 2 * RUN_MS, BENCH)
  const planks = half.drops.find(d => d.itemId === 'goldwood_plank')
  const logs = half.drops.find(d => d.itemId === 'goldwood_log')
  check('a part-done station pays finished runs at the milled rate',
    planks?.count === 2 * milledYield(r, BENCH), String(planks?.count))
  check('and refunds only the runs it never started', logs?.count === 3, String(logs?.count))

  // ★ THE EXPLOIT CHECK. If salvage paid milled output for runs that never happened, "load it and
  // smash it" would be an instant, better-than-hand refinery with no wait at all.
  check('load-and-smash cannot beat the mill',
    untouched.drops.every(d => d.itemId !== r.output.itemId))

  // ⚠ The run IN FLIGHT refunds as input rather than part-paying: there is no half a plank, and
  // rounding it either way is a lie in one direction.
  const inflight = salvage(load('goldwood_planks', 4), KEY, T0 + Math.floor(1.5 * RUN_MS), BENCH)
  check('the in-flight run comes back as input, not as a rounded payout',
    inflight.drops.find(d => d.itemId === 'goldwood_log')?.count === 3 &&
    inflight.drops.find(d => d.itemId === 'goldwood_plank')?.count === milledYield(r, BENCH))

  // Nothing is created or destroyed: whatever the station holds, salvage hands back input-equivalent
  // value for the unstarted part and output for the done part, for EVERY station recipe.
  let conserved = true, offender = ''
  for (const rec of stationRecipes()) {
    for (const runs of [1, 3, 12]) {
      for (const at of [0, 1, runs - 1, runs]) {
        const s = salvage(load(rec.id, runs), KEY, T0 + at * RUN_MS, BENCH)
        const out = s.drops.find(d => d.itemId === rec.output.itemId)?.count ?? 0
        const doneRuns = out / milledYield(rec, BENCH)
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

  check('salvaging an empty station is a no-op', salvage({}, KEY, T0, BENCH).drops.length === 0)
}

console.log(`\nworkshop: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
