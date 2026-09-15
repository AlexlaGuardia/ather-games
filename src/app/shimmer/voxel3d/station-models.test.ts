// The modelled stations — the contract, and the WIRING. Run: npx tsx src/app/shimmer/voxel3d/station-models.test.ts
import { readFileSync } from 'node:fs'
import { codeOnly } from '../testing/guard'
import { MAT, MODELLED_MATS, isModelled } from '../voxel/depth'
import { blockDef } from '../voxel/registry'
import { stationOf } from '../voxel/workshop'
import { alchemyStationOf } from './alchemy-chain'
import { TILE_MATERIALS } from './tex/tiles'
import { STATION_MODELS, modelOf, modelFits, CUBE } from './station-models'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── §1 the set: every station is modelled, and only stations are ─────────────────────────────
{
  const stationMats = [...MODELLED_MATS]
  // Decor that took a model — not stations, and the list is deliberate (a lantern, 09-15).
  const DECOR = new Set<number>([MAT.MANA_LANTERN])
  ok(stationMats.every(m => stationOf(m) !== null || alchemyStationOf(m) !== null || DECOR.has(m)), '§1 every modelled id is a station or named decor')
  ok([...DECOR].every(m => isModelled(m) && (m in STATION_MODELS)), '§1 the named decor is modelled AND has a model (a cube lantern would be a regression)')
  const allStations = new Set<number>()
  for (const m of TILE_MATERIALS) if (stationOf(m) || alchemyStationOf(m)) allStations.add(m)
  const missing = [...allStations].filter(m => !isModelled(m))
  ok(missing.length === 0, `§1 ★ every station is modelled — missing: ${missing.map(m => blockDef(m)?.name).join(', ') || 'none'}`)
  ok(stationMats.every(m => TILE_MATERIALS.includes(m)), '§1 every modelled id has tile art to wear')
  ok(!isModelled(MAT.STONE) && !isModelled(MAT.CHEST), '§1 a wall and a chest are not modelled')
  // The glow contract: a lit block's model glows where its tile does, and a dead part is told so.
  const lantern = modelOf(MAT.MANA_LANTERN)
  ok(lantern.parts.some(p => p.glow === undefined && p.side === undefined) && lantern.parts.filter(p => p.glow === 0).length >= 2,
    '§1 the lantern: the head wears its own glowing tile, the post and cap are told glow: 0')
  const host = codeOnly(readFileSync(new URL('./station-mesh.ts', import.meta.url), 'utf8'))
  ok(host.includes("createPieceMaterial(tiles, { emissive: true }, light)") && host.includes("p.glow ?? (EMISSIVE[p.side ?? mat] ?? 0)"),
    '§1 ★ the renderer runs the EMISSIVE program and defaults a part\'s glow to the worn block\'s own')
}

// ── §2 the contract: every model fits its cell, every tile it names exists ───────────────────
{
  for (const m of MODELLED_MATS) {
    const model = modelOf(m)
    const fit = modelFits(model)
    ok(fit.ok, `§2 ${blockDef(m)?.name}: every box inside the cell (bad parts: ${fit.bad.join(',')})`)
    ok(model.parts.length >= 1, `§2 ${blockDef(m)?.name}: at least one box`)
    ok(model.parts.every(p => (p.top === undefined || TILE_MATERIALS.includes(p.top)) && (p.side === undefined || TILE_MATERIALS.includes(p.side))),
      `§2 ${blockDef(m)?.name}: every named tile exists`)
  }
  ok(modelFits(CUBE).ok && modelFits({ parts: [{ box: [1, 1, 1, 0.3, 0.5, 0] }], note: '' }).ok === false, '§2 the fit check bites on a leaked box')
  ok(modelOf(MAT.STONE) === CUBE, '§2 an unmodelled id is the cube, never nothing')
  const unmodelled = [...MODELLED_MATS].filter(m => !(m in STATION_MODELS))
  console.log(`   (still a cube: ${unmodelled.map(m => blockDef(m)?.name).join(', ') || 'none'})`)
}

// ── §3 the wiring: the mesher steps aside, the renderer steps in, both invalidations reach it ─
{
  const greedy = codeOnly(readFileSync(new URL('../voxel/greedy.ts', import.meta.url), 'utf8'))
  ok(greedy.includes('&& !isModelled(m) ? 1 : 0'), '§3 ★ the mesher emits no cube faces for a modelled cell')
  ok(greedy.includes('isPlant(m) || isModelled(m)) ? 0'), '§3 ★ and neighbours draw their faces against it')
  const host = codeOnly(readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8'))
  ok(host.includes('createStationRenderer(tiles, lightUniforms)'), '§3 the renderer is built on the world tiles + light')
  ok(host.split('stations?.invalidate(').length - 1 >= 2, '§3 ★ both column-change sites invalidate it (edit + edits-arrive)')
  ok(host.includes('stations?.invalidateAll()'), '§3 and the space switch clears it (the "0,0" key collision)')
  ok(host.includes('stations?.sync(list.map(c => ({ ...c, ySpan: H })), voxel)'), '§3 ★ it syncs on the flora beat')
  ok(host.includes('stations?.setCartoon(cartoon)'), '§3 the cartoon dials reach it')
  ok(host.includes('<primitive object={stations.group} />'), '§3 ★ and its group is in the scene')
}

console.log(`station-models: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
