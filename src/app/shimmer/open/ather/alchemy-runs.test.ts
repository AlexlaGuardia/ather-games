// alchemy-runs.ts. Run: npx tsx src/app/shimmer/open/ather/alchemy-runs.test.ts
import { startRun, collectRun, dropRun, adoptRuns, runFrac, runLeft } from './alchemy-runs'
import { ALC_POTIONS } from './alchemy-set'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const T = 1_000_000, ms = ALC_POTIONS.health.steps[1].ms
const have = { 'crop:goldleaf:B': 3, 'crop:dewdrop_vine:B': 2 }
const s = startRun({}, 'p1', 'health', 1, have, T)
ok(!!s && s.spend.length === 2 && s.runs.p1.ms === ms, 'a step starts and says what to spend')
ok(!!s && startRun(s.runs, 'p1', 'health', 1, have, T) === null, 'a busy piece takes no second run')
ok(startRun({}, 'p1', 'health', 1, { 'crop:goldleaf:B': 1 }, T) === null, 'a short bag cannot start')
ok(startRun({}, 'p1', 'nope', 0, have, T) === null && startRun({}, 'p1', 'health', 9, have, T) === null, 'unknown potion / step')
ok(!!s && runFrac(s.runs.p1, T + ms / 2) === 0.5 && runLeft(s.runs.p1, T + ms / 2) === ms / 2, 'half way is half way')
ok(!!s && collectRun(s.runs, 'p1', T + ms - 1) === null, 'not collected before it is done')
const c = s && collectRun(s.runs, 'p1', T + ms)
ok(!!c && c.got.id === 'alc:golden_mixture:B' && c.got.n === 1 && !c.runs.p1, 'done: a grade-B mixture, the piece free again')
const d = s && dropRun(s.runs, 'p1')
ok(!!d && d.back.length === 2 && !d.runs.p1, 'picking up a busy piece gives the inputs back')
ok(dropRun({}, 'x').back.length === 0, 'an idle piece gives nothing back')
const round = adoptRuns(JSON.parse(JSON.stringify(s!.runs)))
ok(round.p1?.potion === 'health' && round.p1.k === 1, 'a run survives a save + load')
ok(Object.keys(adoptRuns({ a: { potion: 'nope', k: 0, start: 1, ms: 1, spent: [] }, b: { potion: 'health', k: 99, start: 1, ms: 1, spent: [] }, c: null })).length === 0 && Object.keys(adoptRuns('junk')).length === 0, 'junk is dropped')

console.log(`alchemy-runs: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
