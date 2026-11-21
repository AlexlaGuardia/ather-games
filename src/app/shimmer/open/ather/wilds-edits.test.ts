// BETA M62 (engine from M38): the Wilds edit layer. Run: npx tsx src/app/shimmer/open/ather/wilds-edits.test.ts
import { readFileSync } from 'node:fs'
import { parseWilds, type WildsMeta } from './wilds'
import { applyBrush, mergeEdits, cleanTile, cleanEdits, falloff, EditHistory, EDIT_MAX_DM, type Edits, type BrushTile } from './wilds-edits'
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

// the wire
ok(cleanTile({ '5': 9999 })!['5'] === EDIT_MAX_DM, 'a delta past the clamp is clamped')
ok(cleanTile({ '-1': 3 }) === null && cleanTile({ 'x': 3 }) === null && cleanTile({ '5': 'a' }) === null && cleanTile([1]) === null, 'junk on the wire is refused')
ok(JSON.stringify(cleanTile({ '7': 0, '8': 2.4 })) === '{"8":2}', 'zeros dropped, values rounded to whole dm')
const json = JSON.stringify({ v: 1, tiles: edits }).length
ok(json < 40000, `a 12-stroke mound costs ${json} bytes in the file`)

console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
