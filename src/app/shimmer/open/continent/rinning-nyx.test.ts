// Rinning on the waking continent (rinning-nyx.ts). Run: npx tsx src/app/shimmer/open/continent/rinning-nyx.test.ts
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { NYX_RINN, rollNyxRinn, nyxWaterAt, nyxIsWater, NYX_WATER_Y, type NyxWater } from './rinning-nyx'
import { PATTERNS, RINN_XP } from '../shared/reel'
import { itemDef } from '../shared/inventory'
import { RINN } from '../ather/rinning'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
let seed = 5; const rng = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296 }

// ★ the catch is canon's: every name is in world/rinn.md, none is a protected or never-eaten rinn
const canon = readFileSync('/root/athernyx/CANON/world/rinn.md', 'utf8')
for (const n of NYX_RINN) ok(canon.includes(`**${n.name}**`) || canon.includes(`**${n.name.replace(/s$/, '')}`), `canon: ${n.name} is not in world/rinn.md`)
for (const banned of ['Wavebacks', 'Shellmound', 'Veilrays', 'Crestfloaters']) ok(!NYX_RINN.some(n => n.name === banned), `canon: ${banned} is on the catch table (canon forbids taking it)`)
ok(NYX_RINN.length >= 10, `catch: ${NYX_RINN.length} rinn (the seat's note: start ~10)`)
ok(new Set(NYX_RINN.map(n => n.id)).size === NYX_RINN.length, 'catch: duplicate id')
ok(NYX_RINN.every(n => PATTERNS.includes(n.pattern) && n.xp === RINN_XP[n.tier]), 'catch: a bad pattern or an XP off the shared table')
// an id shared with the Ather must be the same creature (only clickclaw is): the dreaming cousins stay the Ather's
const shared = NYX_RINN.filter(n => RINN.some(a => a.id === n.id)).map(n => n.id)
ok(shared.join() === 'clickclaw', `catch: ids shared with the Ather: ${shared} (only clickclaw is one creature on both shores)`)
for (const t of [1, 2, 3, 4]) ok(NYX_RINN.some(n => n.tier === t), `catch: no tier ${t}`)
// every bag row exists, named from the table
for (const n of NYX_RINN) ok(itemDef(n.id).name === n.name || n.id === 'clickclaw', `bag: ${n.id} has no row`)

// what a level hooks, per water
const roll = (level: number, w: NyxWater, k = 3000) => { const c: Record<string, number> = {}; for (let i = 0; i < k; i++) { const x = rollNyxRinn(level, w, rng); c[x.id] = (c[x.id] ?? 0) + 1 } return c }
ok(Object.keys(roll(10, 'river')).join() === 'bluescale', 'river: something other than Bluescale bites in a river (canon has no other freshwater rinn yet)')
ok(Object.keys(roll(1, 'coast')).every(id => NYX_RINN.find(n => n.id === id)!.tier === 1), 'level 1: hooked above tier 1')
const open10 = roll(10, 'open'), coast10 = roll(10, 'coast')
const rare = (c: Record<string, number>) => Object.entries(c).filter(([id]) => NYX_RINN.find(n => n.id === id)!.tier >= 3).reduce((a, [, v]) => a + v, 0)
ok(rare(open10) > rare(coast10), 'open water does not tip toward the rarer rinn')
ok(Object.keys(coast10).length >= 8, `coast: only ${Object.keys(coast10).length} kinds bite at level 10 (want variety)`)
ok(!Object.keys(coast10).some(id => ['stormrunner', 'razormouth', 'ironside'].includes(id)), 'coast: an open-water hunter bites off the beach')

// the water reader, on the real continent: all three kinds of water exist within a cast of some shore
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const seen: Record<string, number> = {}
for (let i = 0; i < 60000; i++) {
  const x = (rng() - 0.5) * meta.sizeX, z = (rng() - 0.5) * meta.sizeZ
  if (!nyxIsWater(R, x, z)) continue
  // a castable spot: land within 12 m
  let shore = false
  for (let a = 0; a < 8 && !shore; a++) if (R.heightAt(x + Math.cos(a * 0.785) * 12, z + Math.sin(a * 0.785) * 12) > NYX_WATER_Y + 0.2) shore = true
  if (shore) { const w = nyxWaterAt(R, x, z); seen[w] = (seen[w] ?? 0) + 1 }
}
ok(!!seen.river && !!seen.coast, `water: castable shore found only ${JSON.stringify(seen)} (want rivers and coast)`)
console.log('  castable water by kind:', JSON.stringify(seen))

if (fails.length) { console.error(`rinning-nyx: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`rinning-nyx: ${pass}/0`)
