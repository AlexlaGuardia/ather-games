// BETA M83 s2a: the Glade as a builder map (pure). Run: npx tsx src/app/shimmer/world/glade-builder.test.ts
import { GLADE_BRUSH_TILE, GLADE_N, GLADE_CELL, GLADE_SIZE, GLADE_VOID_Y, GLADE_LAYER_TILE, gladeVertex, sampleGladeBase, gladeDeltaAt } from './glade-builder'
import { gladeZoneGround } from '../open/ather/glade-cluster'
import { applyBrush, mergeEdits, cleanTile, type Edits } from '../open/ather/wilds-edits'
import { cleanLayer } from './builder'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

ok(GLADE_N === 251 && GLADE_CELL === 4 && GLADE_SIZE === 1000, 'the Glade tile is a Wilds-shaped grid (251 verts, 4 m, 1 km)')
ok(cleanTile({ [String(GLADE_N * GLADE_N - 1)]: 5 }) !== null, "the Glade's last vertex survives the game's cleanTile (same vertex budget)")
ok(Object.keys(cleanLayer({ tiles: { [GLADE_LAYER_TILE]: { 7: 3 } } }).tiles).join() === 'glade', "a Glade layer passes the builder's cleaner")

// the tile holds ALL of the Glade's ground, with ground on it (not a mis-centred empty square)
const B = sampleGladeBase(gladeZoneGround)
let ground = 0, edge = 0
for (let j = 0; j < GLADE_N; j++) for (let i = 0; i < GLADE_N; i++) {
  if (B.voidV[j * GLADE_N + i]) continue
  ground++; if (i === 0 || j === 0 || i === GLADE_N - 1 || j === GLADE_N - 1) edge++
}
ok(ground > 40000, `the tile samples the Glade's ground (${ground} ground vertices)`)
ok(edge === 0, 'no ground on the tile border: the Glade fits inside it with room')
let outside = 0
for (let x = -1400; x <= 1400; x += 8) for (let z = -1400; z <= 1400; z += 8) {
  const inTile = Math.abs(x - GLADE_BRUSH_TILE.ox) <= GLADE_SIZE / 2 && Math.abs(z - GLADE_BRUSH_TILE.oz) <= GLADE_SIZE / 2
  if (!inTile && Number.isFinite(gladeZoneGround(x, z))) outside++
}
ok(outside === 0, 'no Glade ground anywhere outside the tile (sampled to 1.4 km)')
ok([...B.h].every(Number.isFinite), 'base heights are finite everywhere (void = GLADE_VOID_Y)')
const gv = gladeVertex(60, 200), gk = 200 * GLADE_N + 60
ok(B.voidV[gk] ? B.h[gk] === GLADE_VOID_Y : Math.abs(B.h[gk] - gladeZoneGround(gv.x, gv.z)) < 1e-4, 'a vertex holds the function at its world spot')
let cellsOk = true
for (let j = 0; j < GLADE_N - 1 && cellsOk; j += 7) for (let i = 0; i < GLADE_N - 1; i += 7) {
  const any = B.voidV[j * GLADE_N + i] | B.voidV[j * GLADE_N + i + 1] | B.voidV[(j + 1) * GLADE_N + i] | B.voidV[(j + 1) * GLADE_N + i + 1]
  if (B.voided[j * (GLADE_N - 1) + i] !== any) { cellsOk = false; break }
}
ok(cellsOk, 'a cell is voided when any corner is void')

// the brush on the Glade: a raise on Greg's garden edits only ground vertices; the delta reads back exactly at a vertex
const H = (x: number, z: number) => {   // the editor's rule: no ground = NaN, so the brush skips it
  const fx = (x - GLADE_BRUSH_TILE.ox + GLADE_SIZE / 2) / GLADE_CELL, fz = (z - GLADE_BRUSH_TILE.oz + GLADE_SIZE / 2) / GLADE_CELL
  const k = Math.round(fz) * GLADE_N + Math.round(fx)
  return B.voidV[k] ? NaN : gladeZoneGround(x, z)
}
const greg = { x: -100, z: 110 }
ok(Number.isFinite(gladeZoneGround(greg.x, greg.z)), "Greg's garden (-100, 110) is ground")
const E: Edits = {}
mergeEdits(E, applyBrush(H, [GLADE_BRUSH_TILE], E, { kind: 'raise', x: greg.x, z: greg.z, r: 16, s: 2 }))
const keys = Object.keys(E[GLADE_LAYER_TILE] ?? {})
ok(keys.length > 20, `a raise on Greg's garden edits the Glade tile (${keys.length} vertices)`)
ok(keys.every(k => !B.voidV[+k]), 'the brush never edits a no-ground vertex')
const edgeStroke: Edits = {}
mergeEdits(edgeStroke, applyBrush(H, [GLADE_BRUSH_TILE], edgeStroke, { kind: 'raise', x: 500, z: -600, r: 30, s: 2 }))
ok(!edgeStroke[GLADE_LAYER_TILE], 'a stroke out in the void edits nothing (you sculpt the land the Glade has)')
const k0 = keys.map(Number).sort((a, b) => (E.glade[String(b)] ?? 0) - (E.glade[String(a)] ?? 0))[0]
const v0 = gladeVertex(k0 % GLADE_N, Math.floor(k0 / GLADE_N))
ok(Math.abs(gladeDeltaAt(E.glade, v0.x, v0.z) - E.glade[String(k0)] / 10) < 1e-9, 'gladeDeltaAt is exact at a vertex')
const mid = gladeDeltaAt(E.glade, v0.x + GLADE_CELL / 2, v0.z)
const a = (E.glade[String(k0)] ?? 0) / 10, b = (E.glade[String(k0 + 1)] ?? 0) / 10
ok(Math.abs(mid - (a + b) / 2) < 1e-9, 'gladeDeltaAt is bilinear between vertices')
ok(gladeDeltaAt(E.glade, 5000, 5000) === 0 && gladeDeltaAt(null, greg.x, greg.z) === 0, 'off the tile or no layer = no delta')

console.log(fails ? `\n${fails} FAILED` : '\nall pass'); process.exit(fails ? 1 : 0)
