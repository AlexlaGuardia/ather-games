// BETA M83 s3: the Nyx continent as a builder map (pure). Run: npx tsx src/app/shimmer/world/nyx-builder.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NYX_VOID_Y, nyxN, nyxOrigin, nyxAligned, nyxBrushTile, nyxTiles, sampleNyxTile, applyNyxLayer, nyxTileName, parseNyxTile, type NyxMeta } from './nyx-builder'
import { applyBrush, mergeEdits, cleanTile, type Edits } from '../open/ather/wilds-edits'
import { tileOf } from '../open/ather/wilds-world'
import { cleanLayer } from './builder'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

// the REAL export lines up with the 1 km grid (a re-export that breaks this must fail here, not silently shift every edit)
const real = JSON.parse(readFileSync(join(process.cwd(), 'public/open/continent.json'), 'utf8')) as NyxMeta
ok(nyxAligned(real) && nyxN(real) === 201, `the continent export (${real.nx}x${real.nz}, ${real.cell} m) lines up: tile edges on region vertices, 201 verts a tile`)
ok(cleanTile({ [String(201 * 201 - 1)]: 5 }) !== null, "a Nyx tile's last vertex survives the game's cleanTile")
ok(Object.keys(cleanLayer({ tiles: { [nyxTileName(-3, 2)]: { 7: 3 } } }).tiles).join() === 'nyx_-3_2', "a Nyx layer (negative tile names) passes the builder's cleaner")
ok(JSON.stringify(parseNyxTile('nyx_-3_2')) === '{"tx":-3,"ty":2}' && parseNyxTile('first-wilds') === null && parseNyxTile('glade') === null, 'tile names round-trip; Wilds / Glade names are not Nyx tiles')

// a small fake region with the real grid's offsets (half-sizes 1335 / 915 m = an odd 5 m off a 1 km line, like 5835 / 3915)
const m: NyxMeta = { cell: 5, nx: 535, nz: 367, sizeX: 2670, sizeZ: 1830 }
ok(nyxAligned(m), 'fake region aligned')
const h = new Float32Array(m.nx * m.nz)
for (let j = 0; j < m.nz; j++) for (let i = 0; i < m.nx; i++) h[j * m.nx + i] = i < 100 ? -5 : 3 + 0.01 * i + 0.02 * j   // sea on the west
const rx = (i: number) => -m.sizeX / 2 + i * m.cell, rz = (j: number) => -m.sizeZ / 2 + j * m.cell
const tiles = nyxTiles(m, h)
ok(tiles.length === 3 * 3 && tiles.every(t => t.land >= 0 && t.land <= 1), `the fake region is cut into ${tiles.length} tiles (want 3 x 3)`)
ok(tiles.find(t => t.tx === -1)!.land < tiles.find(t => t.tx === 1)!.land, 'the sea-side tile has less land')
// tile vertex (a, b) IS region vertex (i0 + a, j0 + b) at the same world point; tileOf agrees with the tile's centre
const T = nyxBrushTile(m, 0, 0), S = sampleNyxTile(m, h, 0, 0), { i0, j0 } = nyxOrigin(m, 0, 0)
ok(T.nx === 201 && T.sizeX === 1000 && T.ox === 0 && T.oz === 0, 'tile (0,0) is a 1 km, 201-vertex tile centred on the origin')
ok(rx(i0) === T.ox - T.sizeX / 2 && rz(j0) === T.oz - T.sizeZ / 2, `tile (0,0) vertex (0,0) = region vertex (${i0},${j0}) at the same world point`)
ok(S.h[5 * 201 + 7] === h[(j0 + 5) * m.nx + i0 + 7] && !S.voidV, 'an inside tile samples region vertices exactly, no void')
ok(JSON.stringify(tileOf(T.ox + 499, T.oz - 499)) === '{"tx":0,"ty":0}', "wilds-world's tileOf finds the same tile")
const E = sampleNyxTile(m, h, 1, 0)   // east edge: past the region is void
ok(!!E.voidV && E.h[200] === Math.fround(NYX_VOID_Y) && E.voidV[200] === 1 && E.voidV[0] === 0 && E.voided[199] === 1, 'tile past the region edge: off-region vertices void (NYX_VOID_Y), inside ones ground')
{ const o = nyxOrigin(m, 1, 0), last = m.nx - 1 - o.i0   // the region's last column is ground, one past it is void (no wrap into the next row)
  ok(E.voidV![last] === 0 && E.voidV![last + 1] === 1 && E.h[last] === h[o.j0 * m.nx + m.nx - 1], `the edge is exact: tile column ${last} = the region's last, ${last + 1} void`) }

// sculpt with the Wilds brush on the virtual tiles, then apply the layer to the region: the region equals the editor's ground
const bases = new Map([[nyxTileName(0, 0), S], [nyxTileName(1, 0), E]])
const bt = [T, nyxBrushTile(m, 1, 0)]
const edits: Edits = {}
const heightAt = (x: number, z: number) => {
  const { tx, ty } = tileOf(x, z), B = bases.get(nyxTileName(tx, ty)); if (!B) return NaN
  const fx = (x - tx * 1000 + 500) / 5, fz = (z - ty * 1000 + 500) / 5
  const a = Math.round(fx), b = Math.round(fz), k = b * 201 + a
  if (B.voidV?.[k]) return NaN
  return B.h[k] + ((edits[nyxTileName(tx, ty)]?.[k]) ?? 0) / 10
}
// a hill right on the seam between tile 0 and tile 1 (x = 500)
for (let n = 0; n < 6; n++) mergeEdits(edits, applyBrush(heightAt, bt, edits, { kind: 'raise', x: 500, z: 0, r: 20, s: 1 }))
const nE = Object.keys(edits).sort()
ok(nE.join() === 'nyx_0_0,nyx_1_0', `a stroke on the seam edits both tiles (${nE.join()})`)
const seamA = edits.nyx_0_0?.[String(100 * 201 + 200)], seamB = edits.nyx_1_0?.[String(100 * 201 + 0)]
ok(seamA !== undefined && seamA === seamB, `the shared seam vertex has one value on both sides (${seamA} / ${seamB} dm)`)
const h2 = Float32Array.from(h), moved = applyNyxLayer(m, h2, edits as Record<string, Record<string, number>>)
ok(moved > 0, `applyNyxLayer moved ${moved} region vertices`)
let worst = 0
for (const [name, Ed] of Object.entries(edits)) {
  const t = parseNyxTile(name)!, o = nyxOrigin(m, t.tx, t.ty)
  for (const k of Object.keys(Ed)) { const a = Number(k) % 201, b = Math.floor(Number(k) / 201), r = (o.j0 + b) * m.nx + o.i0 + a; worst = Math.max(worst, Math.abs(h2[r] - (h[r] + Ed[k] / 10))) }
}
ok(worst < 1e-4, `after apply, every edited region vertex = base + delta (worst ${worst.toExponential(1)} m)`)
const seamR = (j0 + 100) * m.nx + i0 + 200
ok(Math.abs(h2[seamR] - (h[seamR] + (seamA ?? 0) / 10)) < 1e-4, 'the seam vertex is lifted ONCE, not twice')
ok(applyNyxLayer(m, Float32Array.from(h), { glade: { 5: 30 }, 'first-wilds': { 5: 30 } }) === 0 && applyNyxLayer(m, Float32Array.from(h), null) === 0, 'non-Nyx tiles and an empty layer move nothing')
ok(applyNyxLayer(m, Float32Array.from(h), { nyx_9_9: { 5: 30 } }) === 0, 'a tile off the region moves nothing (no out-of-range write)')
ok(applyNyxLayer({ ...m, sizeX: 2672 }, Float32Array.from(h), edits as Record<string, Record<string, number>>) === 0, 'a misaligned region refuses the layer instead of shifting it')

console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
