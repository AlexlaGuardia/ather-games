// Run: npx tsx src/app/shimmer/open/ather/station-sound.test.ts
// M99: a bench's working phrase repeats only while it crafts, positional, a sting when a run lands, silent idle / far / unvoted.
import { stationSounds, pickVoice, pickFromPool, MAX_RUN, STATION_VOICE, PHRASE_MS, HEAR_M, type BenchSnap } from './station-sound'
import registry from '../shared/sounds.json'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const at = { x: 10, y: 3, z: 0 }
const carp = (working: boolean, made = false, x = 10): BenchSnap => ({ id: 'c1', kind: 'carpentry', working, made, at: { ...at, x } })
const none = () => false, all = () => true

// candidates: the first yay plays; none voted = the first is asked (and stays silent in sfx.play)
ok(pickVoice(['a', 'b'], id => id === 'b') === 'b', 'the first YAY candidate is the one played')
ok(pickVoice(['a', 'b'], none) === 'a', 'nothing voted: the first candidate is asked')
ok(pickVoice([], all) === null, 'no candidates: nothing')
const rows = registry as { id: string; area: string; status: string; source: string }[]
const ids = Object.values(STATION_VOICE).flatMap(v => [...v!.work, ...v!.done])
ok(ids.length === 6 && ids.every(i => rows.some(r => r.id === i && r.area === 'stations' && r.source === 'synth')), 'every bench candidate is a stations row in the registry')
ok(!STATION_VOICE.farm && !STATION_VOICE.cooking, 'only carpentry + masonry have a working voice (M99 scope)')

// the beat: starts at once, repeats every PHRASE_MS, stops the tick it stops working, restarts at once
{
  const due = new Map<string, number>(), ear = { x: 0, z: 0 }
  const plays: number[] = []
  for (let t = 0; t <= 9000; t += 1000) if (stationSounds(due, [carp(true)], t, ear, none).some(s => s.id === 'work-carp-saw')) plays.push(t)
  ok(plays.join() === [0, 3000, 6000, 9000].join(), `working: a phrase at once, then every ${PHRASE_MS} ms (got ${plays})`)
  ok(stationSounds(due, [carp(false)], 10000, ear, none).length === 0 && !due.has('c1'), 'stopped (idle / blocked / nobody at it): silent, slot dropped')
  ok(stationSounds(due, [carp(true)], 10500, ear, none).length === 1, 'starting again plays at once')
  const out = stationSounds(new Map(), [carp(true)], 0, ear, none)[0]
  ok(out.at.x === 10 && out.at.y === 3 && out.at.z === 0, 'the phrase is positional at the bench')
}
// a long stall (hidden tab) resets the beat: one phrase, not a burst
{
  const due = new Map<string, number>()
  stationSounds(due, [carp(true)], 0, null, none)
  ok(stationSounds(due, [carp(true)], 60000, null, none).length === 1, 'after a stall: one phrase')
  ok(stationSounds(due, [carp(true)], 61000, null, none).length === 0 && due.get('c1') === 63000, 'and the beat restarts from now')
}
// the sting: a run landed (also when the station then goes idle), voiced by the bench kind
{
  const s = stationSounds(new Map(), [carp(false, true)], 0, null, none)
  ok(s.length === 1 && s[0].id === 'work-done-wood', 'a run landed and the bench went idle: the wood sting alone')
  const m = stationSounds(new Map(), [{ id: 'm', kind: 'stonemason', working: true, made: true, at }], 0, null, none).map(x => x.id).sort()
  ok(m.join() === 'work-done-stone,work-mason-chisel', 'masonry: stone sting + chisel phrase')
  ok(stationSounds(new Map(), [{ id: 'f', kind: 'farm', working: true, made: true, at }], 0, null, all).length === 0, 'a farm makes no bench sound')
}
// distance: beyond HEAR_M nothing plays, but the beat keeps time (walking in lands on the beat, not a restart)
{
  const due = new Map<string, number>(), far = carp(true, true, HEAR_M + 11)
  ok(stationSounds(due, [far], 0, { x: 10, z: 0 }, none).length === 0, `farther than ${HEAR_M} m: silent (no phrase, no sting)`)
  ok(due.get('c1') === PHRASE_MS, 'but its beat is kept')
  ok(stationSounds(new Map(), [carp(true, false, HEAR_M - 1)], 0, { x: 0, z: 0 }, none).length === 1, 'just inside: heard')
}
// a room taken down loses its slot
{ const due = new Map<string, number>([['gone', 5]]); stationSounds(due, [], 0, null, none); ok(!due.has('gone'), 'a removed room is forgotten') }

// the pool (Alex yay'd both loops, hub 11-23): random among ALL yay'd, never the same one 3 times running
{
  const ids = ['a', 'b', 'c'], yayAB = (i: string) => i !== 'c'
  const h: string[] = [], seq: string[] = []
  for (let k = 0; k < 6; k++) seq.push(pickFromPool(ids, yayAB, h, () => 0)!)   // rnd 0 always wants 'a'
  ok(seq.join('') === 'aabaab', `a rigged pick is forced off after ${MAX_RUN} in a row (got ${seq.join('')})`)
  const h2: string[] = [], seen = new Set<string>()
  for (let k = 0; k < 200; k++) seen.add(pickFromPool(ids, yayAB, h2)!)
  ok(seen.has('a') && seen.has('b') && !seen.has('c'), 'both yay phrases are heard, the proposed one never')
  let run = 1, maxRun = 1, prev = ''
  const h3: string[] = []
  for (let k = 0; k < 500; k++) { const x = pickFromPool(ids, yayAB, h3)!; run = x === prev ? run + 1 : 1; maxRun = Math.max(maxRun, run); prev = x }
  ok(maxRun <= MAX_RUN, `500 random beats: longest run ${maxRun} <= ${MAX_RUN}`)
  ok(pickFromPool(ids, i => i === 'b', [], () => 0) === 'b' && pickFromPool(ids, () => false, [], () => 0.9) === 'a', 'one yay: that one; none: the first (asked, silent)')
  const hist = new Map<string, string[]>(), due = new Map<string, number>(), got: string[] = []
  for (let t = 0; t <= 15000; t += 3000) got.push(...stationSounds(due, [carp(true)], t, null, all, hist, () => 0.99).map(s => s.id))
  ok(got.includes('work-carp-saw') && got.includes('work-carp-plane') && !got.some((x, i) => i >= 2 && x === got[i - 1] && x === got[i - 2]), `in the driver: both carpentry loops, no triple (${got.join(' ')})`)
  stationSounds(due, [], 16000, null, all, hist); ok(hist.size === 0, 'a removed room forgets its pool history')
}

console.log(`station-sound: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
