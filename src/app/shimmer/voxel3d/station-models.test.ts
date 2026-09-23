// The modelled stations — the contract, and the WIRING. Run: npx tsx src/app/shimmer/voxel3d/station-models.test.ts
import { readFileSync } from 'node:fs'
import { codeOnly } from '../testing/guard'
import { MAT, MODELLED_MATS, isModelled, TALL_STATIONS, isTallStation, isStationRack } from '../voxel/depth'
import { blockDef } from '../voxel/registry'
import { stationOf } from '../voxel/workshop'
import { alchemyStationOf } from './alchemy-chain'
import { TILE_MATERIALS } from './tex/tiles'
import { STATION_MODELS, modelOf, modelFits, modelConnected, CUBE } from './station-models'

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
    // ★ A MODEL HAS BOXES OR A SCULPT, AND `modelFits` ONLY SEES THE FIRST. It was `parts.length
    // >= 1` until the cauldron became a sculpt on 09-22, and that assert is what CAUGHT the
    // switch — the alternative was `modelFits` quietly returning ok over an empty list. The
    // sculpt's real vertices are measured against the cell in `station-sculpt.test.ts`; this line
    // only refuses a model with no shape at all.
    const sculptParts = model.sculpt?.parts ?? []
    ok(model.parts.length >= 1 || sculptParts.length >= 1, `§2 ${blockDef(m)?.name}: boxes or a sculpt, never neither`)
    ok(fit.boxes === model.parts.length, `§2 ${blockDef(m)?.name}: the fit check reports how much it actually read`)
    const named = [...model.parts, ...sculptParts]
    ok(named.every(p => (p.top === undefined || TILE_MATERIALS.includes(p.top)) && (p.side === undefined || TILE_MATERIALS.includes(p.side))),
      `§2 ${blockDef(m)?.name}: every named tile exists`)
  }
  ok(modelFits(CUBE).ok && modelFits({ parts: [{ box: [1, 1, 1, 0.3, 0.5, 0] }], note: '' }).ok === false, '§2 the fit check bites on a leaked box')
  // ★ AND IT SAYS SO WHEN IT READ NOTHING. An all-sculpt model has no boxes, so `ok` is vacuous —
  // the one thing a guard must never report as a pass without saying what it looked at.
  ok(modelFits({ parts: [], note: '', sculpt: { model: 'x', parts: [{ node: 'A' }] } }).boxes === 0,
    '§2 ★ the fit check reports boxes: 0 on an all-sculpt model rather than an unqualified ok')
  ok(modelOf(MAT.STONE) === CUBE, '§2 an unmodelled id is the cube, never nothing')
  const unmodelled = [...MODELLED_MATS].filter(m => !(m in STATION_MODELS))
  console.log(`   (still a cube: ${unmodelled.map(m => blockDef(m)?.name).join(', ') || 'none'})`)
}

// ── §3 the wiring: the mesher steps aside, the renderer steps in, both invalidations reach it ─
{
  const greedy = codeOnly(readFileSync(new URL('../voxel/greedy.ts', import.meta.url), 'utf8'))
  ok(greedy.includes('&& !isModelled(m) && !isStationRack(m) ? 1 : 0'), '§3 ★ the mesher emits no cube faces for a modelled cell, nor for a tall station\'s rack')
  ok(greedy.includes('isPlant(m) || isModelled(m) || isStationRack(m)) ? 0'), '§3 ★ and neighbours draw their faces against both')
  const host = codeOnly(readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8'))
  ok(host.includes('createStationRenderer(tiles, lightUniforms)'), '§3 the renderer is built on the world tiles + light')
  ok(host.split('stations?.invalidate(').length - 1 >= 2, '§3 ★ both column-change sites invalidate it (edit + edits-arrive)')
  ok(host.includes('stations?.invalidateAll()'), '§3 and the space switch clears it (the "0,0" key collision)')
  ok(host.includes('stations?.sync(list.map(c => ({ ...c, ySpan: H })), voxel)'), '§3 ★ it syncs on the flora beat')
  ok(host.includes('stations?.setCartoon(cartoon)'), '§3 the cartoon dials reach it')
  ok(host.includes('<primitive object={stations.group} />'), '§3 ★ and its group is in the scene')
}

// ── §6 every box model is ONE OBJECT, not parts standing near each other ─────────────────────
// ★ GBOARD (2026-09-22) recorded that *"nothing in the cell knows the parts are one object, so no
// guard here can ask whether a model is CONNECTED"*, after the bench's legs were left clear of its
// apron and every check stayed green. That is true of a SCULPT and false of a box model — a box is
// an AABB and this is a union-find over six numbers. Believing the general form of the sentence
// cost the sawmill's tool wall hanging in the air, and its log cradle floating FIVE MILLIMETRES
// above the bed, both green on every other check and both found the moment this ran.
{
  let boxModels = 0
  for (const [k, m] of Object.entries(STATION_MODELS)) {
    const r = modelConnected(m)
    if (r.boxes === 0) continue     // a sculpt has no boxes; `station-sculpt.test.ts` owns its mesh
    boxModels++
    ok(r.ok, `§6 ★ ${blockDef(Number(k))?.name ?? k} is ONE object (${r.boxes} boxes → ${r.groups} group${r.groups === 1 ? '' : 's'})`)
  }
  // ⚠ NOT VACUOUS. If every model became a sculpt this section would pass by looking at nothing.
  ok(boxModels > 0, `§6 ★ there are still box models to check (${boxModels}) — a silent zero here is a section measuring nothing`)
  // And the check can FAIL: two boxes a hair apart are two groups, touching faces are one.
  const apart = { parts: [{ box: [0.2, 0.2, 0.2, 0, 0.1, 0] as const }, { box: [0.2, 0.2, 0.2, 0, 0.35, 0] as const }], note: '' }
  ok(!modelConnected(apart).ok && modelConnected(apart).groups === 2,
    '§6 ★★ a 0.05 gap reads as TWO groups — this is what the sawmill\'s cradle did')
  const touching = { parts: [{ box: [0.2, 0.2, 0.2, 0, 0.1, 0] as const }, { box: [0.2, 0.2, 0.2, 0, 0.3, 0] as const }], note: '' }
  ok(modelConnected(touching).ok, '§6 ★ and exactly touching faces read as ONE — which is how a frame is authored')
  ok(modelConnected({ parts: [], note: '' }).boxes === 0,
    '§6 ★ an all-sculpt model reports boxes: 0 rather than an unqualified ok')
}

// ── §5 the two-tall stations: one fact, two files, asserted in BOTH directions ────────────────
// `TALL_STATIONS` (depth.ts) says which stations occupy two cells; `StationModel.tall` says which
// models may reach y = 2. They are halves of one fact, and either half alone is a shipped defect:
// a tall model on a short station draws a metre of geometry into a neighbour's airspace with
// nothing solid under it (a VISIBLE thing you walk through), and a tall station with a short model
// leaves a solid rack cell standing over nothing — the invisible wall `pieces.ts` warns of.
{
  for (const m of TALL_STATIONS) {
    ok(STATION_MODELS[m]?.tall === true, `§5 ★ tall station ${blockDef(m)?.name ?? m} has a tall MODEL`)
    ok(stationOf(m) !== null, `§5 ${blockDef(m)?.name ?? m} is a station at all (a rack over decor has no panel to open)`)
  }
  for (const [k, model] of Object.entries(STATION_MODELS)) {
    if (!model.tall) continue
    ok(isTallStation(Number(k)), `§5 ★ tall model ${blockDef(Number(k))?.name ?? k} is registered in TALL_STATIONS`)
  }
  // ★ AND THE CEILING IS PER-MODEL, NOT RELAXED FOR EVERYONE. The day `modelFits` stops reading
  // `tall` the short models go on passing and only this line notices — which is the whole reason
  // it asserts the REFUSAL rather than only the permission.
  const tallBox = { parts: [{ box: [0.2, 0.2, 0.2, 0, 1.5, 0] as const }], note: '' }
  ok(modelFits({ ...tallBox, tall: true }).ok, '§5 a box at y 1.5 fits a TALL model')
  ok(!modelFits(tallBox).ok, '§5 ★ and the same box is REFUSED on a short one')
  ok(!modelFits({ parts: [{ box: [0.2, 0.2, 0.2, 0, 2.0, 0] }], note: '', tall: true }).ok,
    '§5 ★ even a tall model is refused above y = 2 — it owns two cells, not the sky')
  // The rack is occupancy, not a station: nothing may model it, and it must not answer `stationOf`.
  ok(!isModelled(MAT.STATION_RACK), '§5 ★ the rack is NOT modelled — the station below draws through it')
  ok(!(MAT.STATION_RACK in STATION_MODELS), '§5 and it has no model of its own')
  ok(stationOf(MAT.STATION_RACK) === null, '§5 ★ a rack is not a station (right-clicking one opens storage, not recipes)')
  ok(isStationRack(MAT.STATION_RACK) && !isStationRack(MAT.SAWMILL), '§5 isStationRack names the rack and only the rack')
}

console.log(`station-models: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
