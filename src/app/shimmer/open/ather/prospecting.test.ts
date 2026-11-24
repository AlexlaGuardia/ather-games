// Prospecting in the Wilds (prospecting.ts + the crystals wilds.ts places). Run: npx tsx src/app/shimmer/open/ather/prospecting.test.ts
// Reads every streamed tile off disk with its zone layer, so the placement guards judge the real continent.
import { readFileSync, existsSync } from 'fs'
import { parseWilds, type WildsMeta } from './wilds'
import { crystalFor, mine, mineCheck, isMined, _resetProspecting, CRYSTAL_KINDS, CRYSTAL_ITEM, BLANKSTONE, TIER, XP, RESPAWN_MS, ELEMENTS, type CrystalKind } from './prospecting'
import { _resetForestry, _setOpenLevel, openLevel, type Zone } from './forestry'
import { itemDef } from '../shared/inventory'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
let seed = 3; const rng = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296 }

// ── the zone map (Alex 11-16) ─────────────────────────────────────────────────────────────────────────────────
const kindsIn = (zone: Zone, biome: number) => { const s = new Set<CrystalKind>(); for (let r = 0; r < 1; r += 0.001) { const c = crystalFor(zone, biome, r); if (c) s.add(c.kind) } return s }
const ROCK = 4, SHORE = 1, MEADOW = 2, WOODS = 3
ok([...kindsIn('meadows', ROCK)].sort().join() === 'raw,violet', `meadows: ${[...kindsIn('meadows', ROCK)]}`)
ok([...kindsIn('springs', ROCK)].sort().join() === 'pure,raw,water', `springs: ${[...kindsIn('springs', ROCK)]}`)
ok(kindsIn('springs', SHORE).has('water'), 'springs: no water crystals on the shore stones (Alex: yes)')
ok([...kindsIn('arid', ROCK)].sort().join() === 'pure,raw,storm', `the Scald: ${[...kindsIn('arid', ROCK)]}`)
ok([...kindsIn('caverns', ROCK)].sort().join() === 'ather,earth,pure,raw', `caverns: ${[...kindsIn('caverns', ROCK)]}`)
ok([...kindsIn('trails', ROCK)].sort().join() === 'ather,egg,pure,raw', `trails: ${[...kindsIn('trails', ROCK)]}`)
ok(kindsIn('thicket', ROCK).size === 0, 'the Thicket grows stone')
ok(['meadows', 'arid', 'caverns', 'trails'].every(z => kindsIn(z as Zone, MEADOW).size === 0 && kindsIn(z as Zone, WOODS).size === 0), 'crystals off the crag (meadow or woods ground)')
ok(crystalFor('trails', ROCK, 0.5)!.p < crystalFor('caverns', ROCK, 0.5)!.p, 'trails: not sparser than the caverns (the egg hunt is sparse)')

// ── on the real continent: every streamed tile, with its zones ───────────────────────────────────────────────
const D = 'public/open/wilds/'
const index = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; nodes: { i: number; j: number; zone?: Zone }[] }[] }
const byZone: Record<string, Record<string, number>> = {}
let total = 0, tiles = 0, maxTile = 0, wet = 0
for (const t of index.tiles) {
  if (!existsSync(D + t.name + '.bin')) continue
  const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta
  const b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome')
  const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
  const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone)
  tiles++; total += W.crystals.length; maxTile = Math.max(maxTile, W.crystals.length)
  for (const c of W.crystals) {
    const zone = zm.get(`${Math.min(4, Math.floor((c.x + 500) / 200))},${Math.min(4, Math.floor((c.z + 500) / 200))}`) ?? 'meadows'
    ;(byZone[zone] ??= {})[c.kind] = (byZone[zone][c.kind] ?? 0) + 1
    if (c.y < meta.waterY + 0.4) wet++
  }
  ok(new Set(W.crystals.map(c => c.id)).size === W.crystals.length, `${t.name}: duplicate crystal ids`)
}
console.log(`  ${total} crystals on ${tiles} tiles (max ${maxTile} on one)`)
for (const [z, k] of Object.entries(byZone)) console.log(`  ${z.padEnd(8)} ${JSON.stringify(k)}`)
ok(total > 1500 && maxTile < 400, `density: ${total} crystals, ${maxTile} on the busiest tile (want plenty, never a carpet)`)
ok(!byZone.thicket, 'the Thicket has crystals on the real map')
ok((byZone.springs?.water ?? 0) >= 20, `the springs: only ${byZone.springs?.water ?? 0} water crystals on the real map`)
ok((byZone.caverns?.ather ?? 0) + (byZone.trails?.ather ?? 0) >= 3, 'the Ather Crystal: fewer than 3 on the whole continent')
ok(Object.entries(byZone).every(([z, k]) => !k.ather || z === 'caverns' || z === 'trails'), 'the Ather Crystal grows outside the caverns and the Trails')
ok((byZone.trails?.egg ?? 0) > 0, 'the Trails hide no eggs')
ok(wet === 0, `${wet} crystals under the water line`)

// ── working a node ───────────────────────────────────────────────────────────────────────────────────────────
_resetForestry(); _resetProspecting()
const T0 = 1_000_000
ok(openLevel('prospecting') === 1 && mineCheck('raw', 'a', T0).ok, 'level 1 cannot work raw mana')
ok(CRYSTAL_KINDS.every(k => mineCheck(k, 'b', T0).ok), 'M136: level 1 is refused a crystal (the level gates are dropped)')
const r1 = mine('raw', 'n1', rng, T0)
ok(r1.ok && r1.drops.some(d => d.id === BLANKSTONE && d.n >= 1) && r1.drops.some(d => d.id === 'raw_mana_shard' && d.n >= 1 && d.n <= 3), 'raw: no blankstone, or shards off 1–3')
ok(r1.ok && r1.xp === XP[1], 'raw: XP is not canon\'s 20')
ok(isMined('n1', T0 + 1) && !isMined('n1', T0 + RESPAWN_MS[1] + 1), 'raw: does not grow back on canon\'s 2 min')
ok(!mine('raw', 'n1', rng, T0 + 1000).ok, 'a fractured node gave twice')
ok(mine('violet', 'n2', rng, T0).ok, 'M136: a level 1 keeper could not work an element node')
_setOpenLevel('prospecting', 10)
const found = new Set<string>()
for (let i = 0; i < 200; i++) { const r = mine('egg', `e${i}`, rng, T0); if (r.ok) found.add(r.found) }
ok(ELEMENTS.every(e => found.has(e)) && !found.has('egg'), `the egg: hatched ${[...found]} (want all four elements, never 'egg')`)
const a = mine('ather', 'ath', rng, T0)
ok(a.ok && a.drops.some(d => d.id === 'ather_crystal') && a.xp === 400 && !mineCheck('ather', 'ath', T0 + RESPAWN_MS[4] - 1000).ok, 'ather: wrong drop, XP or its 45 min')
// every drop has a bag row with a name and an icon on disk
for (const id of [BLANKSTONE, ...Object.values(CRYSTAL_ITEM)]) {
  const d = itemDef(id)
  ok(d.name !== id.replace(/_/g, ' ') && !!d.icon && existsSync('public' + d.icon), `bag: ${id} has no row or no icon`)
}
ok(CRYSTAL_KINDS.every(k => TIER[k] >= 1), 'a kind without a tier')
// found UNIQUE Keepstones (canon 5a20b8f): a rare dig from a crystal node, never from raw; ather is the likeliest
{
  const { KEEPSTONE_FIND, KEEPSTONES } = require('./furniture') as typeof import('./furniture')
  const low = () => 0.0001   // every roll comes in under the find chance
  _resetProspecting()
  const k = mine('ather', 'ks-a', low, T0 + 1e9)
  ok(k.ok && k.drops.some(d => d.id === 'keepstone_ather'), 'keepstone: a lucky ather dig found no Ather Keepstone')
  _resetProspecting()
  const r = mine('raw', 'ks-r', low, T0 + 1e9)
  ok(r.ok && !r.drops.some(d => d.id in KEEPSTONES), 'keepstone: a raw node gave a Keepstone')
  const high = () => 0.9999
  _resetProspecting()
  const n = mine('ather', 'ks-n', high, T0 + 1e9)
  ok(n.ok && !n.drops.some(d => d.id in KEEPSTONES), 'keepstone: an unlucky dig found one anyway')
  ok(Object.values(KEEPSTONE_FIND).every(c => c > 0 && c <= 0.1) && KEEPSTONE_FIND.ather_crystal > KEEPSTONE_FIND.violet_crystal, 'keepstone: find chances off (a find, not a farm; rarer crystal = likelier)')
  ok(Object.keys(KEEPSTONE_FIND).every(c => Object.values(KEEPSTONES).some(v => v.crystal === c)), 'keepstone: a crystal can be found set but has no Keepstone item')
}

if (fails.length) { console.error(`prospecting: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`prospecting: ${pass}/0`)
