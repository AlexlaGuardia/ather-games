// BETA M83: the builder's whole-map overview (pure). Run: npx tsx src/app/shimmer/dev/editors/builder-overview.test.ts
import { overviewLayout, tileAtPixel, tileBox, overviewHeights, overviewRGBA, NO_TILE, type OvTile, type OvSource } from './builder-overview'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

// an L of three tiles with a hole at (1, 1): (0,0) (1,0) (0,1); tx may be negative
const tiles: OvTile[] = [{ name: 'a', tx: -1, ty: 2 }, { name: 'b', tx: 0, ty: 2 }, { name: 'c', tx: -1, ty: 3 }]
const P = 8, L = overviewLayout(tiles, P)
ok(L.tx0 === -1 && L.ty0 === 2 && L.cols === 2 && L.rows === 2 && L.w === 16 && L.h === 16, `layout spans the tiles (${JSON.stringify(L)})`)
ok(tileAtPixel(L, tiles, 0, 0)?.name === 'a' && tileAtPixel(L, tiles, 7.9, 7.9)?.name === 'a', 'pixel in the first block = its tile')
ok(tileAtPixel(L, tiles, 8, 0)?.name === 'b' && tileAtPixel(L, tiles, 0, 8)?.name === 'c', 'tx goes right, ty goes down')
ok(tileAtPixel(L, tiles, 12, 12) === undefined, 'the hole has no tile')
ok(tileAtPixel(L, tiles, -1, 3) === undefined && tileAtPixel(L, tiles, 16, 3) === undefined, 'off the image = nothing')
const bx = tileBox(L, tiles[1]); ok(bx.x === 0.5 && bx.y === 0 && bx.w === 0.5 && bx.h === 0.5, 'tileBox: b is the top-right quarter')
ok(overviewLayout([], P).w === 0, 'no tiles: empty layout')

// sources: a = flat 10 m, b = a ramp in i (the pixel reads its centre vertex), c = void left half
const N = 41
const src = (t: OvTile): OvSource | null => t.name === 'a' ? { nx: N, nz: N, at: () => 10 } : t.name === 'b' ? { nx: N, nz: N, at: i => i } : { nx: N, nz: N, at: i => i < 20 ? NaN : 5 }
const none = () => undefined
const { H, edited, drawn } = overviewHeights(L, tiles, src, none)
ok(drawn === 3, `3 tiles drawn (${drawn})`)
ok(H[0] === 10 && H[7 * 16 + 7] === 10, 'tile a reads 10 everywhere')
const bRow = [...Array(8)].map((_, p) => H[8 + p])
ok(bRow.every((v, p) => p === 0 || v > bRow[p - 1]) && bRow[0] < 5 && bRow[7] > 35, `tile b ramps left to right (${bRow.join(',')})`)
ok(Number.isNaN(H[8 * 16]) && H[8 * 16 + 7] === 5, 'tile c: void on its left, ground on its right')
ok(H[12 * 16 + 12] === NO_TILE, 'the hole is NO_TILE (open sea)')
ok(edited.every(v => v === 0), 'no edits, nothing tinted')
// a source that answers null (not loaded yet) is skipped, not drawn as ground
ok(overviewHeights(L, tiles, t => t.name === 'b' ? null : src(t), none).drawn === 2, 'a tile with no source yet is skipped')

// edits: one vertex +8 m in tile a, at a vertex that is NOT a pixel centre: the pixel still rises, by the block mean
const kOff = 1 * N + 1   // vertex (1, 1): pixel (0, 0), whose centre vertex is (3, 3)
const ed = overviewHeights(L, tiles, src, n => n === 'a' ? { [kOff]: 80 } : undefined)
const block = Math.ceil(N / P) ** 2   // ~ vertices in pixel (0, 0)
ok(ed.H[0] > 10 && ed.H[0] < 10 + 8, `an edit between samples still raises its pixel by the block mean (${ed.H[0].toFixed(3)}; one vertex of ~${block})`)
ok(ed.edited[0] === 1 && ed.edited[1] === 0 && ed.edited.reduce((a, b) => a + b, 0) === 1, 'only that pixel is tinted')
// a whole tile raised by +2 m -> every pixel of it is exactly 12
const all: Record<string, number> = {}; for (let k = 0; k < N * N; k++) all[k] = 20
const up = overviewHeights(L, tiles, src, n => n === 'a' ? all : undefined)
ok([0, 7, 7 * 16, 7 * 16 + 7].every(o => Math.abs(up.H[o] - 12) < 1e-5), 'a uniform +2 m edit = +2 m on every pixel (the mean is exact)')
ok(up.H[8] === H[8], 'edits stay on their own tile')
// junk keys are ignored, not thrown
ok(overviewHeights(L, tiles, src, () => ({ x: 5, '-3': 5, [N * N + 4]: 5 })).edited.every(v => v === 0), 'junk / out-of-range keys are ignored')

// colours: sea hole, void dark, land on the ramp, tint warms
const rgba = overviewRGBA(L, H, edited, 0)
const px = (o: number) => [rgba[o * 4], rgba[o * 4 + 1], rgba[o * 4 + 2]]
const sea = px(12 * 16 + 12), vd = px(8 * 16), land = px(0)
ok(sea[2] > sea[0] && sea[2] > 80, `the hole is sea blue (${sea})`)
ok(vd.every(v => v < 40), `a void is dark (${vd})`)
ok(land[1] > 60 && !(land[2] > land[1]), `land is on the ramp (${land})`)
ok(rgba.length === 16 * 16 * 4 && [...Array(256)].every((_, o) => rgba[o * 4 + 3] === 255), 'every pixel opaque')
const t1 = overviewRGBA(L, ed.H, ed.edited, 0), t0 = overviewRGBA(L, ed.H, ed.edited, 0, false)
ok(t1[0] > t0[0], `the edit tint warms the pixel (r ${t0[0]} -> ${t1[0]})`)

console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
