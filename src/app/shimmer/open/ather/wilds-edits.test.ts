// BETA M62 (engine from M38): the Wilds edit layer. Run: npx tsx src/app/shimmer/open/ather/wilds-edits.test.ts
import { readFileSync } from 'node:fs'
import { parseWilds, type WildsMeta } from './wilds'
import { applyBrush, mergeEdits, cleanTile, cleanEdits, cleanWater, cleanWaters, falloff, EditHistory, paintWater, foldWater, ponds, waterDrops, EDIT_MAX_DM, type Edits, type BrushTile, type WaterMap } from './wilds-edits'
import { terrainWorld, MAX_WALK_GRADIENT } from '../terrain-world'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

const DIR = new URL('../../../../../public/open/wilds/', import.meta.url).pathname
const meta = JSON.parse(readFileSync(DIR + 'first-wilds.json', 'utf8')) as WildsMeta
const binBuf = readFileSync(DIR + 'first-wilds.bin'), bio = new Uint8Array(readFileSync(DIR + 'first-wilds.biome'))
const dm = new Int16Array(binBuf.buffer.slice(binBuf.byteOffset, binBuf.byteOffset + binBuf.byteLength))
const base = parseWilds(meta, dm, bio)
const tile: BrushTile = { name: meta.name, ox: 0, oz: 0, nx: meta.nx, nz: meta.nz, cell: meta.cell, sizeX: meta.sizeX, sizeZ: meta.sizeZ }

// a dry spot near the middle
let px = 0, pz = 0
for (let t = 0; t < 400; t += 4) { if (base.heightAt(t, t) > meta.waterY + 2) { px = t; pz = t; break } }
ok(base.heightAt(px, pz) > meta.waterY + 2, `fixture: dry land at (${px}, ${pz}) h ${base.heightAt(px, pz).toFixed(1)}`)

// the brush: raise lifts the middle most, nothing past the rim; lower undoes; values clamped
ok(falloff(0, 5) === 1 && falloff(5, 5) === 0 && falloff(2.5, 5) > 0.4 && falloff(2.5, 5) < 0.6, 'falloff: 1 at the centre, 0 at the rim')
const edits: Edits = {}
let W = base
for (let n = 0; n < 12; n++) { const d = applyBrush(W.heightAt, [tile], edits, { kind: 'raise', x: px, z: pz, r: 8, s: 1 }); mergeEdits(edits, d); W = parseWilds(meta, dm, bio, undefined, undefined, true, undefined, undefined, edits[meta.name]) }
const rise = W.heightAt(px, pz) - base.heightAt(px, pz), rim = W.heightAt(px + 9, pz) - base.heightAt(px + 9, pz)
ok(rise > 9 && rise < 12.5, `12 raises at strength 1 lift the centre ~12 m (${rise.toFixed(2)})`)
ok(Math.abs(rim) < 0.01, `nothing moves past the rim (${rim.toFixed(3)})`)
// the raised mound is too steep to walk up: the walker's own rule (terrain-world MAX_WALK_GRADIENT)
const g = (W.heightAt(px + 4.5, pz) - W.heightAt(px + 3.5, pz))
ok(Math.abs(g) > MAX_WALK_GRADIENT, `its flank is steeper than the walk limit (|${g.toFixed(2)}| > ${MAX_WALK_GRADIENT})`)
const tw = terrainWorld(W.shape)
ok(typeof tw.bodyFree === 'function', 'the walker world builds on the edited shape')

// ids never move: the same trees and crystals by id (heights may follow the ground)
const baseIds = new Set(base.trees.map(t => t.id)), editIds = W.trees.map(t => t.id)
ok(editIds.every(id => baseIds.has(id)), `every tree id on the edited tile existed before (${editIds.length}/${base.trees.length})`)
ok(base.trees.length - editIds.length < 40, `only trees on the new steep flank drop out (${base.trees.length - editIds.length})`)
const far = base.trees.find(t => Math.hypot(t.x - px, t.z - pz) > 30)!, farE = W.trees.find(t => t.id === far.id)
ok(!!farE && farE.y === far.y, 'a tree away from the brush is untouched')

// no tree floats: every tree stands on the EDITED ground
ok(W.trees.every(t => Math.abs(t.y - W.heightAt(t.x, t.z)) < 0.01), 'every tree stands on the edited ground (none float)')
ok(W.crystals.every(c => Math.abs(c.y - W.heightAt(c.x, c.z)) < 0.01), 'every crystal sits on the edited ground')

// lower back, flatten, smooth: all change the ground the right way
{ const e2: Edits = JSON.parse(JSON.stringify(edits)); let X = W
  for (let n = 0; n < 12; n++) { mergeEdits(e2, applyBrush(X.heightAt, [tile], e2, { kind: 'lower', x: px, z: pz, r: 8, s: 1 })); X = parseWilds(meta, dm, bio, undefined, undefined, true, undefined, undefined, e2[meta.name]) }
  ok(Math.abs(X.heightAt(px, pz) - base.heightAt(px, pz)) < 0.3, `12 lowers undo 12 raises (${(X.heightAt(px, pz) - base.heightAt(px, pz)).toFixed(2)})`)
  ok(Object.keys(e2[meta.name] ?? {}).length < Object.keys(edits[meta.name]).length, 'vertices back at 0 drop out of the file (sparse)') }
{ const e3: Edits = JSON.parse(JSON.stringify(edits)); let X = W; const tgt = base.heightAt(px, pz)
  for (let n = 0; n < 20; n++) { mergeEdits(e3, applyBrush(X.heightAt, [tile], e3, { kind: 'flatten', x: px, z: pz, r: 8, s: 1, target: tgt })); X = parseWilds(meta, dm, bio, undefined, undefined, true, undefined, undefined, e3[meta.name]) }
  ok(Math.abs(X.heightAt(px, pz) - tgt) < 1, `flatten pulls the centre to its target (${X.heightAt(px, pz).toFixed(2)} vs ${tgt.toFixed(2)})`) }
{ const e4: Edits = JSON.parse(JSON.stringify(edits)); let X = W; const peak0 = W.heightAt(px, pz)
  for (let n = 0; n < 6; n++) { mergeEdits(e4, applyBrush(X.heightAt, [tile], e4, { kind: 'smooth', x: px, z: pz, r: 10, s: 1 })); X = parseWilds(meta, dm, bio, undefined, undefined, true, undefined, undefined, e4[meta.name]) }
  ok(X.heightAt(px, pz) < peak0 - 0.5, `smooth softens the peak (${peak0.toFixed(2)} -> ${X.heightAt(px, pz).toFixed(2)})`) }

// undo / redo: one step per stroke, a stroke that crosses onto a new tile still undoes whole, redo after a new stroke is gone
{ const e: Edits = {}, H = new EditHistory()
  const strokeOn = (x: number) => { H.begin(e, [meta.name]); for (let n = 0; n < 3; n++) { const d = applyBrush(base.heightAt, [tile], e, { kind: 'raise', x, z: pz, r: 8, s: 1 }); for (const t of Object.keys(d)) H.touch(e, t); mergeEdits(e, d) } H.commit() }
  strokeOn(px); const after1 = JSON.stringify(e); strokeOn(px + 40); const after2 = JSON.stringify(e)
  ok(after1 !== after2 && H.canUndo && !H.canRedo, 'two strokes recorded')
  const und = H.undo(e); ok(JSON.stringify(e) === after1, 'undo puts back the ground before the 2nd stroke')
  { const e5: Edits = { a: { '1': 2 } }, H5 = new EditHistory(); H5.begin(e5, ['a', 'b', 'c']); e5.a['1'] = 7; H5.commit(); ok(JSON.stringify(H5.undo(e5)) === '["a"]' && JSON.stringify(und) === JSON.stringify([meta.name]), 'undo reports only the tiles it changed (untouched snapshot tiles stay clean)') }
  H.undo(e); ok(JSON.stringify(e) === '{}' && !H.canUndo, 'undo again: no edits left, the tile drops out')
  H.redo(e); ok(JSON.stringify(e) === after1, 'redo replays the 1st stroke')
  strokeOn(px - 40); ok(!H.canRedo, 'a new stroke clears the redo')
  // a neighbour tile the stroke reached only part-way through (touch) is restored by the same undo
  const e2: Edits = { other: { '3': 5 } }, H2 = new EditHistory(); H2.begin(e2, [meta.name]); H2.touch(e2, 'other'); e2.other['3'] = 50; e2[meta.name] = { '1': 9 }; H2.commit()
  H2.undo(e2); ok(JSON.stringify(e2) === '{"other":{"3":5}}', 'undo restores a touched neighbour too') }
// the file round trip: what the editor saves is what the game parses (edits survive a re-parse, byte for byte)
{ const file = JSON.parse(JSON.stringify({ v: 1, tiles: edits })), back = cleanEdits(file)
  ok(JSON.stringify(back) === JSON.stringify(edits), 'cleanEdits(file) === the edits that were saved')
  const A = parseWilds(meta, dm, bio, undefined, undefined, true, undefined, undefined, back[meta.name])
  ok(A.heightAt(px, pz) === W.heightAt(px, pz) && A.h.every((v, i) => v === W.h[i]), 're-parse from the file = the same ground')
  ok(JSON.stringify(cleanEdits({ tiles: { '../x': { '1': 3 }, ok: { '1': 0 } } })) === '{}', 'bad tile names and all-zero tiles are dropped') }
// flatten with a light strength moves less than with a full one
{ const tgt = base.heightAt(px, pz) - 6, one = (s: number) => { const e: Edits = {}; mergeEdits(e, applyBrush(base.heightAt, [tile], e, { kind: 'flatten', x: px, z: pz, r: 8, s, target: tgt })); return Math.abs(e[meta.name][String(Math.round((pz + 500) / 4) * 251 + Math.round((px + 500) / 4))] ?? 0) }
  ok(one(0.2) < one(1) && one(0.2) > 0, `flatten scales with strength (${one(0.2)} < ${one(1)} dm)`) }

// ── WATER (slice 2): carve a bowl, paint water at the rim's height = a lake at that level; outside the bowl it stays dry ──
{ const e: Edits = {}; let X = base; const rim = base.heightAt(px, pz)
  for (let n = 0; n < 6; n++) { mergeEdits(e, applyBrush(X.heightAt, [tile], e, { kind: 'lower', x: px, z: pz, r: 12, s: 1 })); X = parseWilds(meta, dm, bio, undefined, undefined, true, undefined, undefined, e[meta.name]) }
  const wm: Record<string, WaterMap> = {}
  foldWater(wm, paintWater([tile], px, pz, 20, rim), false)
  const cellsPainted = Object.keys(wm[meta.name]).length
  ok(cellsPainted > 60 && Object.values(wm[meta.name]).every(v => v === Math.round(rim * 10)), `paint: ${cellsPainted} cells inside r=20 hold the level ${rim.toFixed(1)} m`)
  const L = parseWilds(meta, dm, bio, undefined, undefined, true, undefined, undefined, e[meta.name], wm[meta.name])
  const wet = L.ponds ?? []
  ok(wet.length > 10 && wet.length < cellsPainted, `only the carved bowl fills (${wet.length} wet of ${cellsPainted} painted)`)
  ok(wet.every(c => Math.abs(c.y - rim) < 0.051), 'every wet cell sits at the painted level')
  const centreWet = wet.some(c => Math.abs(-500 + (c.i + 0.5) * 4 - px) < 4 && Math.abs(-500 + (c.j + 0.5) * 4 - pz) < 4)
  ok(centreWet, 'the bowl centre is wet')
  const inside = (x: number, y: number, z: number) => L.shape.water(x, y, z, x, y, z).some(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= b.y0 && y <= b.y1)
  ok(inside(px, rim - 0.5, pz), 'the walker is IN water half a metre under the level at the centre (it swims)')
  ok(!inside(px, rim + 0.5, pz), '...and not above the level')
  ok(!inside(px + 18, base.heightAt(px + 18, pz) + 0.3, pz) || base.heightAt(px + 18, pz) < rim, 'a painted cell the ground stands above is dry')
  ok((L.pondBoxes?.length ?? 0) < wet.length, `runs merge into fewer swim boxes (${L.pondBoxes?.length} boxes for ${wet.length} cells)`)
  ok(L.h.every((v, i) => v === X.h[i]), 'water never moves the ground')
  // dry it back out
  foldWater(wm, paintWater([tile], px, pz, 30, null), true)
  ok(!wm[meta.name], 'Dry over the whole pond removes the tile from the water file')
  // two levels side by side: the higher pond's cells next to the lower ones are drops (slice 3 reads this)
  const two: Record<string, WaterMap> = {}
  foldWater(two, paintWater([tile], px - 6, pz, 6, rim + 3), false); foldWater(two, paintWater([tile], px + 6, pz, 6, rim), false)
  const P2 = ponds(meta, X.h, two[meta.name]), drops = waterDrops(meta, P2.cells)
  ok(drops.length > 0 && drops.every(d => d.from.y - d.to.y > 2.9), `two levels touching give drops (${drops.length}, each ~3 m)`)
  ok(waterDrops(meta, ponds(meta, X.h, wm[meta.name] ?? {}).cells).length === 0, 'one level = no drops')
  // a level of exactly 0.0 m is kept (stored as 0.1), never read as a removal
  const z0: Record<string, WaterMap> = {}; foldWater(z0, paintWater([tile], px, pz, 4, 0), false)
  ok(Object.values(z0[meta.name] ?? {}).every(v => v === 1) && Object.keys(z0[meta.name] ?? {}).length > 0, 'a 0.0 m level paints (as 0.1 m), it does not erase') }
// the wire for water
ok(cleanWater({ '5': 99999 })!['5'] === 4000 && cleanWater({ '62500': 3 }) === null && cleanWater({ x: 1 }) === null, 'water: clamped, out-of-range cells and junk refused')
ok(JSON.stringify(cleanWaters({ water: { a: { '3': 12 }, '../b': { '1': 1 } } })) === '{"a":{"3":12}}', 'cleanWaters keeps good tiles only')

// the wire
ok(cleanTile({ '5': 9999 })!['5'] === EDIT_MAX_DM, 'a delta past the clamp is clamped')
ok(cleanTile({ '-1': 3 }) === null && cleanTile({ 'x': 3 }) === null && cleanTile({ '5': 'a' }) === null && cleanTile([1]) === null, 'junk on the wire is refused')
ok(JSON.stringify(cleanTile({ '7': 0, '8': 2.4 })) === '{"8":2}', 'zeros dropped, values rounded to whole dm')
const json = JSON.stringify({ v: 1, tiles: edits }).length
ok(json < 40000, `a 12-stroke mound costs ${json} bytes in the file`)

console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
