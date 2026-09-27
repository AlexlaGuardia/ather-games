// townsfolk.test.ts — the week is canon's table, everyone stands on open ground, walkers keep to the streets, the
// Spirit Corner stays quiet and the way to the Station is busy, and no role is ever named.
// Run: npx tsx src/app/shimmer/play3d/townsfolk.test.ts
import { RUNE_HOLD } from '../world/tilemap'
import { STATION } from './station-field'
import { PASSAGE } from './passage-hall'
import { WEEK } from './passage'
import { REGULARS_WEEK, regularsOn, keepers, walkers, walkerAt, isHome } from './townsfolk'
import { FRONTS } from './rune-hold-look'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }
const gridOf = { 'rune-hold': RUNE_HOLD, 'travelers-station': STATION.grid, 'the-passage': PASSAGE.grid } as const
const openAt = (zone: keyof typeof gridOf, x: number, z: number) => { const v = gridOf[zone][Math.round(z)]?.[Math.round(x)]; return v !== undefined && v >= 0 && (v & 0xff) !== 103 && (v & 0xff) !== 14 }

// ── canon's week, as ruled ──
for (const d of WEEK) ok(REGULARS_WEEK[d].mabry === 'table', `${d}: Mabry holds the table`)
ok(WEEK.every(d => Object.values(REGULARS_WEEK[d]).includes('table')), 'the table is never empty, any day')
ok(Object.values(REGULARS_WEEK.Floday).every(w => w === 'table'), 'Floday is the full table')
ok(REGULARS_WEEK.Coomday.dorik === 'forge' && REGULARS_WEEK["E'xday"].dorik === 'forge' && REGULARS_WEEK.Niteday.dorik === 'forge', 'Dorik is at the forge Coomday, E\'xday, Niteday')
ok(isHome('dorik', 'Solday') && !isHome('dorik', 'Coomday'), 'Dorik is home on Solday only')
ok(REGULARS_WEEK["E'xday"].renna === 'passage' && REGULARS_WEEK["E'xday"].brenn === 'board', "E'xday: Renna works the Passage crowd, Brenn reads the Board")

// ── everyone stands on open ground; only regulars carry names ──
const everyone = [...keepers(), ...WEEK.flatMap(d => regularsOn(d))]
for (const f of everyone) ok(openAt(f.zone, f.x, f.z), `${f.id} stands on open ground in ${f.zone} (${f.x.toFixed(1)},${f.z.toFixed(1)})`)
for (const f of keepers()) ok(f.name === null, `${f.id} is a role, never named`)
for (const d of WEEK) ok(regularsOn(d).every(f => !!f.name), `${d}: the regulars out carry their canon names`)
ok(regularsOn('Floday').length === 0, 'nobody is out on Floday (all four at the table)')

// ── walkers keep to open ground and the town's feel ──
const ws = walkers(RUNE_HOLD)
ok(ws.length >= 10, `a town's worth of walkers (${ws.length})`)
ok(ws.length <= 16, 'and never a crowd')
for (const w of ws) for (let t = 0; t < 120; t += 1.7) {
  const p = walkerAt(w, t)
  if (!openAt('rune-hold', p.x, p.z)) { ok(false, `${w.id} at t=${t} stands in a wall (${p.x},${p.z})`); break }
}
ok(true, 'walkers sampled')
const near = (f: string, r: number) => { const fr = FRONTS.find(x => x.id === f)!; return ws.filter(w => w.path.some(p => Math.hypot(p.x - fr.x, p.z - fr.z) < r)).length }
ok(near('station', 8) > near('spirit-corner', 8), `busier by the Station (${near('station', 8)}) than by the Spirit Corner (${near('spirit-corner', 8)})`)
ok(near('spirit-corner', 8) <= 2, 'the Spirit Corner stays quiet')

if (fails.length) { console.log(`❌ ${pass} passed, ${fails.length} FAILED\n`); fails.slice(0, 20).forEach(f => console.log('  · ' + f)); process.exit(1) }
console.log(`townsfolk: ${pass} passed, 0 failed · ${ws.length} walkers`)
