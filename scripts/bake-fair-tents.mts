// bake-fair-tents.mts — BETA M233 s1: THE THISTLEDOWN FAIR'S CONTEST TENTS for a season (Alex 11-27: "a few of these
// tents spread out each season with contests of clash dash or smash"; RULED Magii b4f51aa: one troupe, several tents, one
// contest each). Runs AFTER scripts/bake-wilds-network.mts (and bake-path-profiles): it reads network-s<N>.json, keeps every
// byte of it, and adds `tents` (network.ts pickTents, season-seeded): the first big top stays where it stood, the rest of
// TENT_PLAN (per-contest counts + each Clash tent's difficulty) pitch along the paths at least TENT_SPACING apart. Same ground test as the first big top (flat dry meadow, r 28 m).
//
//   npx tsx scripts/bake-fair-tents.mts [--season 1] [--dry]
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pickTents, TENT_PLAN, type Network } from '../src/app/shimmer/open/ather/network'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../public/open/wilds')
const argv = process.argv.slice(2)
const SEASON = Number(argv[argv.indexOf('--season') + 1]) || 1
const DRY = argv.includes('--dry')
const W = { water: 0, meadow: 2 }
const G = 20

// the tiles on the same 20 m grid the network bake routes on
const index = JSON.parse(readFileSync(join(DIR, 'tiles.json'), 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }
const tiles = new Map<string, { tx: number; ty: number; nx: number; nz: number; cell: number; h: Float32Array; b: Uint8Array }>()
for (const t of index.tiles) {
  const meta = JSON.parse(readFileSync(join(DIR, `${t.name}.json`), 'utf8'))
  const dm = new Int16Array(new Uint8Array(readFileSync(join(DIR, `${t.name}.bin`))).buffer)
  const h = new Float32Array(dm.length); for (let k = 0; k < dm.length; k++) h[k] = dm[k] / 10
  tiles.set(`${t.tx},${t.ty}`, { tx: t.tx, ty: t.ty, nx: meta.nx, nz: meta.nz, cell: meta.cell, h, b: new Uint8Array(readFileSync(join(DIR, `${t.name}.biome`))) })
}
function sample(x: number, z: number): { h: number; b: number } | null {
  const t = tiles.get(`${Math.floor((x + 500) / 1000)},${Math.floor((z + 500) / 1000)}`); if (!t) return null
  const lx = x - t.tx * 1000 + 500, lz = z - t.ty * 1000 + 500
  const i = Math.min(t.nx - 2, Math.max(0, Math.floor(lx / t.cell))), j = Math.min(t.nz - 2, Math.max(0, Math.floor(lz / t.cell)))
  return { h: t.h[j * t.nx + i], b: t.b[j * (t.nx - 1) + i] }
}
const txs = index.tiles.map(t => t.tx), tys = index.tiles.map(t => t.ty)
const X0 = Math.min(...txs) * 1000 - 500, Z0 = Math.min(...tys) * 1000 - 500
const GW = ((Math.max(...txs) - Math.min(...txs) + 1) * 1000) / G, GH = ((Math.max(...tys) - Math.min(...tys) + 1) * 1000) / G
const H = new Float32Array(GW * GH), B = new Uint8Array(GW * GH).fill(255)
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const s = sample(X0 + (i + 0.5) * G, Z0 + (j + 0.5) * G); if (s) { H[j * GW + i] = s.h; B[j * GW + i] = s.b } }
const inG = (i: number, j: number) => i >= 0 && j >= 0 && i < GW && j < GH
const dry = (i: number, j: number) => inG(i, j) && B[j * GW + i] !== 255 && B[j * GW + i] !== W.water
function slopeAt(i: number, j: number): number {
  let m = 0; const h = H[j * GW + i]
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (dry(i + di, j + dj)) m = Math.max(m, Math.abs(H[(j + dj) * GW + i + di] - h) / G)
  return m
}
function siteOk(x: number, z: number, r = 28): boolean {
  const i = Math.floor((x - X0) / G), j = Math.floor((z - Z0) / G), k = Math.ceil(r / G)
  for (let dj = -k; dj <= k; dj++) for (let di = -k; di <= k; di++) {
    if (di * di + dj * dj > k * k) continue
    const a = i + di, c = j + dj
    if (!dry(a, c) || B[c * GW + a] !== W.meadow || slopeAt(a, c) > 0.12) return false
  }
  return true
}

const file = join(DIR, `network-s${SEASON}.json`)
const raw = readFileSync(file, 'utf8')
const net = JSON.parse(raw) as Network
const tents = pickTents(net, siteOk)
console.log(`season ${SEASON}: ${tents.length} tents`)
for (const t of tents) console.log(`  ${(t.contest + (t.level ? ' ' + t.level : '')).padEnd(16)} (${t.x}, ${t.z}) on ${t.path}`)
if (tents.length < TENT_PLAN.length) { console.error(`FAIL: ${tents.length} of ${TENT_PLAN.length} tents placed; nothing written`); process.exit(1) }
const out = JSON.stringify({ ...net, tents })
if (!DRY) { writeFileSync(file, out); console.log(`wrote ${file} (${raw.length} -> ${out.length} bytes)`) }
