// Run: npx tsx src/app/shimmer/open/ather/relief.test.ts
// THE WILDS' RELIEF (relief.ts + wilds.ts parseWilds, BETA M16). On the real tiles: the land gains relief that HIDES far
// ground from the arrival point, seams between tiles stay closed, saved tree/crystal ids never move, nothing dips under the
// water line, the arrival + path ground stays as it was, and a round no longer passes through a crest (combat.ts throughGround).
// Numbers absolute on purpose (measured 11-18 with HILL 16 m / 110 m, RIDGE 6 m: arrival occlusion 74-88 % at 80-230 m, raw 24-43 %).
import { readFileSync } from 'node:fs'
import { parseWilds, type WildsMeta, type Wilds } from './wilds'
import { reliefRaw, reliefMask, relieve, ARRIVAL } from './relief'
import { GREG_WAYMARK } from './waymarks'
import { throughGround } from './combat'
import { MAX_WALK_GRADIENT } from '../terrain-world'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const load = (name: string, relief = true, clear?: (x: number, z: number) => boolean): Wilds => {
  const meta = JSON.parse(readFileSync(`public/open/wilds/${name}.json`, 'utf8')) as WildsMeta
  const b = readFileSync(`public/open/wilds/${name}.bin`), bio = readFileSync(`public/open/wilds/${name}.biome`)
  return parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), undefined, clear, relief)
}
const W = load('first-wilds'), R0 = load('first-wilds', false)

// 1. the arrival literal is Greg's waymark (relief.ts keeps a copy to avoid an import cycle)
ok(ARRIVAL.x === GREG_WAYMARK.x && ARRIVAL.z === GREG_WAYMARK.z && GREG_WAYMARK.tile === 'first-wilds', 'ARRIVAL = GREG_WAYMARK')

// 2. it HIDES: from the arrival, eye 1.7 m to a head 1.6 m, at 80-230 m
const occluded = (at: (x: number, z: number) => number, ax: number, az: number, bx: number, bz: number) => {
  const ay = at(ax, az) + 1.7, by = at(bx, bz) + 1.6, L = Math.hypot(bx - ax, bz - az)
  for (let s = 2; s < L - 2; s += 2) { const t = s / L; if (at(ax + (bx - ax) * t, az + (bz - az) * t) > ay + (by - ay) * t) return true }
  return false
}
const share = (Wx: Wilds) => {
  let n = 0, o = 0
  for (const d of [80, 120, 170, 230]) for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2, x = ARRIVAL.x + Math.cos(a) * d, z = ARRIVAL.z + Math.sin(a) * d
    if (Math.abs(x) > 480 || Math.abs(z) > 480 || Wx.biomeAt(x, z) === 0) continue
    n++; if (occluded(Wx.heightAt, ARRIVAL.x, ARRIVAL.z, x, z)) o++
  }
  return o / n
}
const sRaw = share(R0), sRel = share(W)
ok(sRaw < 0.5, `raw land is open from the arrival (${(sRaw * 100).toFixed(0)} % hidden)`)
ok(sRel > 0.7, `relieved land hides most far ground from the arrival (${(sRel * 100).toFixed(0)} % hidden, want > 70)`)
ok(sRel < 0.97, `...but not all of it (${(sRel * 100).toFixed(0)} %): a fight still finds you`)

// 3. walkable: almost all dry land stays under the walk gradient (only outcrop flanks are climb country)
{
  let steep = 0, tot = 0
  for (let z = -470; z < 470; z += 3) for (let x = -470; x < 470; x += 3) {
    if (W.biomeAt(x, z) === 0) continue
    tot++; if (Math.hypot(W.heightAt(x + 0.5, z) - W.heightAt(x - 0.5, z), W.heightAt(x, z + 0.5) - W.heightAt(x, z - 0.5)) > MAX_WALK_GRADIENT) steep++
  }
  ok(steep / tot < 0.01, `steep (climb-only) ground under 1 % of dry land (${((steep / tot) * 100).toFixed(2)} %)`)
  ok(steep > 0, 'outcrops exist (some climb country)')
}

// 4. the arrival is untouched ground, and so is everything under the water line
let flat = 0, under = 0
for (let k = 0; k < 64; k++) { const a = k * 0.3, d = (k % 8) * 2.0; const x = ARRIVAL.x + Math.cos(a) * d, z = ARRIVAL.z + Math.sin(a) * d; if (Math.abs(W.heightAt(x, z) - R0.heightAt(x, z)) > 1e-4) flat++ }
ok(flat === 0, `the arrival (14 m: the 22 m flat disc less a grid cell diagonal) keeps its raw height (${flat} moved)`)
for (let k = 0; k < W.h.length; k++) { if (R0.h[k] <= W.meta.waterY + 1.5 && Math.abs(W.h[k] - R0.h[k]) > 1e-4) under++ }
ok(under === 0, `shore and sea floor (raw <= water + 1.5 m) untouched (${under} moved)`)
let dug = 0
for (let k = 0; k < W.h.length; k++) if (R0.h[k] > W.meta.waterY + 1 && W.h[k] < W.meta.waterY + 1 - 1e-4) dug++
ok(dug === 0, `relief never digs dry land under the water line (${dug})`)

// 5. saved ids never move: every relieved tree keeps the raw tree's id AND spot (relief only removes a few off outcrop flanks)
{
  const rawById = new Map(R0.trees.map(t => [t.id, t]))
  const moved = W.trees.filter(t => { const r = rawById.get(t.id); return !r || Math.abs(r.x - t.x) > 1e-6 || Math.abs(r.z - t.z) > 1e-6 }).length
  ok(moved === 0, `tree ids keep their spots (${moved} differ)`)
  ok(W.trees.length <= R0.trees.length && R0.trees.length - W.trees.length < 50, `only a few trees drop off outcrops (${R0.trees.length} -> ${W.trees.length})`)
  ok(W.trees.every(t => Math.abs(t.y - W.heightAt(t.x, t.z)) < 1e-6), 'trees stand on the relieved ground')
  const rawC = new Map(R0.crystals.map(c => [c.id, c]))
  // rock-cell crystals (`:c<n>`) are the raw tile's, spot for spot; outcrop crystals (`:o<i>_<j>`, Alex 11-18) come ON TOP
  const cell = W.crystals.filter(c => /:c\d+$/.test(c.id)), outc = W.crystals.filter(c => /:o-?\d+_-?\d+$/.test(c.id))
  ok(cell.length === R0.crystals.length && cell.every(c => rawC.get(c.id)?.x === c.x && rawC.get(c.id)?.z === c.z), 'rock-cell crystal ids keep their spots')
  ok(cell.length + outc.length === W.crystals.length, `every crystal is a rock-cell one or an outcrop one (${W.crystals.length - cell.length - outc.length} other)`)
  ok(outc.length >= 20, `outcrops carry crystals on this tile (${outc.length}; raw rock cells gave ${R0.crystals.length})`)
  ok(R0.crystals.every(c => !/:o/.test(c.id)), 'the raw (no-relief) parse adds no outcrop crystals')
  ok(new Set(W.crystals.map(c => c.id)).size === W.crystals.length, 'crystal ids unique')
  ok(outc.every(c => Math.abs(c.y - W.heightAt(c.x, c.z)) < 1e-6), 'outcrop crystals sit on the relieved ground')
}

// 6. SEAMS: first-wilds (tile 0,0) and w1_0 (tile 1,0) agree on their shared column, raw and relieved
{
  const E = load('w1_0'), nx = W.meta.nx, nz = W.meta.nz
  let rawGap = 0, gap = 0
  for (let j = 0; j < nz; j++) { rawGap = Math.max(rawGap, Math.abs(R0.h[j * nx + nx - 1] - load('w1_0', false).h[j * nx])); gap = Math.max(gap, Math.abs(W.h[j * nx + nx - 1] - E.h[j * nx])) }
  ok(rawGap < 1e-4, `raw tiles share their edge (${rawGap.toFixed(4)} m): the premise of the next line`)
  ok(gap < 1e-4, `relieved tiles still share their edge (max gap ${gap.toFixed(4)} m)`)
}

// 7. the path mask: a clear() strip stays raw, and the fade is soft (no cliff at its edge)
{
  const strip = (x: number, z: number) => Math.abs(z - 100) < 6
  const P = load('first-wilds', true, strip)
  let onPath = 0
  for (let x = -400; x <= 400; x += 4) if (Math.abs(P.heightAt(x, 100) - R0.heightAt(x, 100)) > 1e-4 && R0.heightAt(x, 100) > W.meta.waterY + 7) onPath++
  ok(onPath === 0, `the path strip keeps its raw height (${onPath} moved)`)
  ok(reliefMask(0, 100 + 6 + 8, 20, 0, strip) < reliefMask(0, 100 + 6 + 40, 20, 0, strip) + 1e-9, 'the mask ramps up away from the path')
}

// 8. pure + deterministic
ok(reliefRaw(123.4, -567.8) === reliefRaw(123.4, -567.8) && relieve(10, 10, 20, 0) === relieve(10, 10, 20, 0), 'deterministic')

// 9. a round through a crest stops: throughGround on the real land, both sides
{
  const T = { heightAt: W.heightAt, walkable: () => true }
  // find a hidden pair from the arrival and fire along it in ONE 30 m-plus step: the end point is above ground, the crest is not
  let found = false, blocked = false, clearShot = false
  for (let k = 0; k < 72 && !(found && clearShot); k++) {
    const a = (k / 72) * Math.PI * 2, x = ARRIVAL.x + Math.cos(a) * 120, z = ARRIVAL.z + Math.sin(a) * 120
    const ay = W.heightAt(ARRIVAL.x, ARRIVAL.z) + 1.7, by = W.heightAt(x, z) + 1.6
    if (occluded(W.heightAt, ARRIVAL.x, ARRIVAL.z, x, z)) { if (!found) { found = true; blocked = throughGround(T, ARRIVAL.x, ay, ARRIVAL.z, x, by, z) } }
    else if (!clearShot) clearShot = !throughGround(T, ARRIVAL.x, ay, ARRIVAL.z, x, by, z)
  }
  ok(found && blocked, 'a shot across a crest is stopped by the ground (the old end-point test would let it through)')
  ok(clearShot, 'a shot with a clear line still flies')
}

console.log(`relief: ${pass}/${fails.length}`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
