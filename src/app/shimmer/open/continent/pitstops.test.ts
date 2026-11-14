// Pitstop doors (gates.md › THE HALLWAY, 11-14). Run: npx tsx src/app/shimmer/open/continent/pitstops.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pitstopsUnlocked, allPitstops, visitNear, PITSTOP_KEY, VISIT_M } from './pitstops'

const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } }
const places = JSON.parse(readFileSync(join(process.cwd(), 'public/open/continent.json'), 'utf8')).places
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const all = allPitstops(places).map(p => p.id)
ok(all.includes('rune-hold'), 'Rune Hold is a pitstop (the 08-12 landing)')
ok(['veradyn', 'gale-haven', 'citadel'].every(c => all.includes(c)), 'every city keeps a pitstop')
ok(!all.includes('ashfeld') && !all.includes('millbrook'), 'settlements and villages keep none (the ruling says city)')
ok(pitstopsUnlocked(places).map(p => p.id).join() === 'rune-hold', 'a new keeper has Rune Hold only')
const v = places.find((p: { id: string }) => p.id === 'veradyn')
ok(visitNear(places, v.x + VISIT_M * 3, v.z) === null, 'passing far off does not unlock')
ok(visitNear(places, v.x + VISIT_M / 3, v.z)?.id === 'veradyn', 'standing in the city unlocks its door')
ok(visitNear(places, v.x + VISIT_M / 3, v.z) === null, 'a door unlocks once (one toast)')
ok(pitstopsUnlocked(places).some(p => p.id === 'veradyn'), 'the visited door is usable')
ok(JSON.parse(store[PITSTOP_KEY]).includes('veradyn'), 'the visit is stored under the shared key')

console.log(fails.length ? fails.map(f => '  ✗ ' + f).join('\n') : '', `\npitstops: ${pass} pass, ${fails.length} fail`)
process.exit(fails.length ? 1 : 0)
