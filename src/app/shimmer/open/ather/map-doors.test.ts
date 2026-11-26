// map-doors.ts (BETA M181): Rune Hold's door on the fold map waits for today's unlock moments; nothing else opens it.
// Also reads the page + FoldMap source so the wiring cannot silently drop off. Run: npx tsx src/app/shimmer/open/ather/map-doors.test.ts
import { readFileSync } from 'fs'
import { runeHoldOpen, mapDoors } from './map-doors'
import { newChain, migrate, readInvite, tick } from '../shared/opening-chain'
const LANDING = { id: 'rune-hold', name: 'Rune Hold', x: 255, z: 53 }
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

const fresh = newChain()
// a newborn: First Steps on (the page masks the errand to 'none'), the note unread
ok(!runeHoldOpen({ errand: 'none', chain: fresh, cityDoors: 0 }), 'newborn: no Rune Hold')
// First Steps done, Greg not yet talked to, the note unread
ok(!runeHoldOpen({ errand: 'greg', chain: fresh, cityDoors: 0 }), 'errand at greg + note unread: still no Rune Hold')
// the note read WHILE First Steps holds: The Dig waits, so does the door
ok(!runeHoldOpen({ errand: 'none', chain: readInvite(fresh, true), cityDoors: 0 }), 'note read while held: no Rune Hold yet')
// the errand sends the keeper through Rune Hold
for (const s of ['smith', 'temple', 'done'] as const) ok(runeHoldOpen({ errand: s, chain: fresh, cityDoors: 0 }), `errand ${s}: Rune Hold`)
// The Dig starts (note read after First Steps), the yard, the repair
ok(runeHoldOpen({ errand: 'greg', chain: readInvite(fresh), cityDoors: 0 }), 'The Dig on: Rune Hold')
ok(runeHoldOpen({ errand: 'greg', chain: tick(readInvite(fresh, true), { packLying: false, now: 0 }).chain, cityDoors: 0 }), 'held read, then First Steps ends: The Dig + Rune Hold')
for (const step of ['yard', 'repair'] as const) ok(runeHoldOpen({ errand: 'greg', chain: { ...fresh, step }, cityDoors: 0 }), `chain ${step}: Rune Hold`)
// old saves: Kael's chest open = past; an old keeper who visited a city
ok(runeHoldOpen({ errand: 'greg', chain: migrate({ kaelChestOpen: true }), cityDoors: 0 }), 'old save past the chain: Rune Hold')
ok(runeHoldOpen({ errand: 'greg', chain: fresh, cityDoors: 1 }), 'holds a city door: Rune Hold')

const city = { id: 'ashfeld', name: 'Ashfeld', x: 0, z: 0 }
ok(mapDoors([LANDING, city], false).length === 0, 'locked: no doors at all')
ok(mapDoors([LANDING, city], true).map(p => p.id).join() === 'rune-hold,ashfeld', 'open: every unlocked door, in order')

// wiring: the page hands FoldMap the gated doors; FoldMap drops "open from the start" when the list has no Rune Hold
const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
ok(/pitstops=\{mapDoors\(pitstops, runeHoldOpen\(\{ errand: errandStage, chain, cityDoors: pitstops\.length - 1 \}\)\)\}/.test(page), 'page passes the gated doors to FoldMap')
ok(/hasPlot=\{gardenOpen\(loadTut\(\)\)\}/.test(page), 'garden stop still waits for the fold (M156)')
const panels = readFileSync(new URL('./panels.tsx', import.meta.url), 'utf8')
ok(/const holdOpen = pitstops\.some\(p => p\.id === LANDING\.id\)/.test(panels), 'FoldMap knows whether Rune Hold is listed')
ok(/\{holdOpen && <> \{LANDING\.name\}&apos;s is open from the start\.<\/>\}/.test(panels), 'the "open from the start" line only with the door')

console.log(`map-doors: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
