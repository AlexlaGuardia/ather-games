// ── ROADS SCULPTED INTO THE LAND (BETA M18, play / Jin ec72056f, 11-18) ────────────────────────────────────────────────
// Alex 11-18: "next we should try and sculpt the terrain around the roads in both the ather and nyx side".
// MODEL legs (the same code and data the page loads):
//   ATHER (first-wilds, the paths' baked heights + relief.ts sculpt): along-path grade p95 < 0.15, max <= 0.2 · the steepest
//     bank within 12 m of a path's edge p95 < 0.85, max under the walk gradient (no wall beside a path) · each is BETTER than
//     the M16 mask it replaces (the comparison is measured, not assumed)
//   NYX (continent.bin, cut and filled at export): along-road grade p95 < 0.12 and bank p95 < 0.7 off bridges, tunnels and
//     ferry landings (where the ground under a deck/bore/jetty is not the road)
// PAGE legs (prod or a devwin): the page's ground on a path IS the baked path height (the deployed build carries M18), and a
//   keeper set on a path in a cutting walks along it without climbing; 0 page errors.
//   npx tsx scripts/road-sculpt-check.mts [--url https://ather.games] [--model-only]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseWilds, type WildsMeta, type Wilds } from '../src/app/shimmer/open/ather/wilds'
import { clearing, roadField, type Network } from '../src/app/shimmer/open/ather/network'
import { makeRegion, drivable, type RegionMeta } from '../src/app/shimmer/open/region'
import { MAX_WALK_GRADIENT } from '../src/app/shimmer/open/terrain-world'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), modelOnly = process.argv.includes('--model-only')
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN }

type Road = { pts: [number, number][]; w: number }
function sections(at: (x: number, z: number) => number, roads: Road[], inside: (x: number, z: number) => boolean, bankReach: number) {
  const grades: number[] = [], banks: number[] = []
  for (const r of roads) {
    let prev: number | null = null
    for (let k = 1; k < r.pts.length; k++) {
      const [ax, az] = r.pts[k - 1], [bx, bz] = r.pts[k], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue
      const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux
      for (let s = 0; s < L; s += 6) {
        const x = ax + ux * s, z = az + uz * s
        if (!inside(x, z)) { prev = null; continue }
        const c = at(x, z); if (!Number.isFinite(c)) { prev = null; continue }
        if (prev !== null) grades.push(Math.abs(c - prev) / 6)
        prev = c
        for (const side of [-1, 1]) {
          let mx = 0
          for (let o = r.w / 2; o < r.w / 2 + bankReach; o += 1) { const g = Math.abs(at(x + nx * side * (o + 1), z + nz * side * (o + 1)) - at(x + nx * side * o, z + nz * side * o)); if (Number.isFinite(g)) mx = Math.max(mx, g) }
          banks.push(mx)
        }
      }
    }
  }
  return { grades, banks }
}

// ── ATHER model ──
const N = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const meta = JSON.parse(readFileSync('public/open/wilds/first-wilds.json', 'utf8')) as WildsMeta
const b = readFileSync('public/open/wilds/first-wilds.bin'), bio = new Uint8Array(readFileSync('public/open/wilds/first-wilds.biome'))
const dm = new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
const RF = roadField(N)
ok(!!RF, 'the network carries path heights (scripts/bake-path-profiles.mts)')
const S: Wilds = parseWilds(meta, dm, bio, undefined, clearing(N), true, RF), M16: Wilds = parseWilds(meta, dm, bio, undefined, clearing(N), true, null)
const paths: Road[] = N.paths.map(p => ({ pts: p.pts.map(q => [q[0], q[1]] as [number, number]), w: 3.2 }))
const inTile = (x: number, z: number) => Math.abs(x) < 480 && Math.abs(z) < 480
const a = sections(S.heightAt, paths, inTile, 12), a16 = sections(M16.heightAt, paths, inTile, 12)
ok(a.grades.length > 200, `Ather: ${a.grades.length} path samples on first-wilds`)
ok(pct(a.grades, 0.95) < 0.15 && pct(a.grades, 1) <= 0.2, `Ather: along-path grade p95 ${pct(a.grades, 0.95).toFixed(2)} (< 0.15), max ${pct(a.grades, 1).toFixed(2)} (<= 0.2) [M16: ${pct(a16.grades, 0.95).toFixed(2)} / ${pct(a16.grades, 1).toFixed(2)}]`)
ok(pct(a.banks, 0.95) < 0.85 && pct(a.banks, 1) < MAX_WALK_GRADIENT, `Ather: steepest bank within 12 m of the edge p95 ${pct(a.banks, 0.95).toFixed(2)} (< 0.85), max ${pct(a.banks, 1).toFixed(2)} (< walk ${MAX_WALK_GRADIENT}) [M16: ${pct(a16.banks, 0.95).toFixed(2)} / ${pct(a16.banks, 1).toFixed(2)}]`)
ok(pct(a.banks, 1) < pct(a16.banks, 1) && pct(a.grades, 1) < pct(a16.grades, 1), 'Ather: the sculpt beats the M16 mask on both the worst bank and the worst grade')

// ── NYX model ──
const cm = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta & { network: { bridges: { pts: number[][] }[]; tunnels?: unknown[]; ferries: { a: number[]; b: number[] }[] } }
const cr = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(cm, new Int16Array(cr.buffer, cr.byteOffset, cr.byteLength / 2))
const pts = (o: unknown): number[][] => { const out: number[][] = []; const walk = (v: unknown) => { if (Array.isArray(v)) { if (v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number') out.push(v as number[]); else v.forEach(walk) } else if (v && typeof v === 'object') Object.values(v).forEach(walk) }; walk(o); return out }
const avoid = [...cm.network.bridges.flatMap(x => pts(x)), ...pts(cm.network.tunnels ?? []), ...cm.network.ferries.flatMap(f => [f.a, f.b])]
const offStructures = (x: number, z: number) => !avoid.some(p => Math.hypot(p[0] - x, p[1] - z) < 60)
const nyxRoads: Road[] = drivable(R).map((e: any) => ({ pts: (e.xz ?? e.pts).map((q: number[]) => [q[0], q[1]] as [number, number]), w: e.width ?? 9 }))
const n = sections(R.heightAt, nyxRoads, offStructures, 12)
ok(n.grades.length > 3000, `Nyx: ${n.grades.length} road samples off bridges/tunnels/ferry landings`)
ok(pct(n.grades, 0.95) < 0.12, `Nyx: along-road grade p95 ${pct(n.grades, 0.95).toFixed(2)} (< 0.12)`)
ok(pct(n.banks, 0.95) < 0.7, `Nyx: steepest bank within 12 m of the edge p95 ${pct(n.banks, 0.95).toFixed(2)} (< 0.7)`)

// ── PAGE ──
if (!modelOnly) {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 800, height: 500 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(4000)
  await p.mouse.click(400, 250); await sleep(800)
  await p.waitForFunction(() => typeof (window as any).__ather?.ground === 'function', { timeout: 60000, polling: 250 })
  // the deepest cutting on first-wilds: where the sculpt sits furthest BELOW the M16 land on a path
  let best = { x: 0, z: 0, ux: 0, uz: 1, cut: 0 }
  for (const r of paths) for (let k = 1; k < r.pts.length; k++) {
    const [ax, az] = r.pts[k - 1], [bx, bz] = r.pts[k], L = Math.hypot(bx - ax, bz - az)
    if (L < 1) continue
    for (let s = 0; s < L; s += 4) { const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L; if (!inTile(x, z) || Math.abs(x + 300) + Math.abs(z - 300) < 80) continue; const cut = M16.heightAt(x + (az - bz) / L * 10, z + (bx - ax) / L * 10) - S.heightAt(x, z); if (cut > best.cut) best = { x, z, ux: (bx - ax) / L, uz: (bz - az) / L, cut } }
  }
  const onPath = await p.evaluate((x, z) => (window as any).__ather.ground(x, z), best.x, best.z) as number
  ok(Math.abs(onPath - S.heightAt(best.x, best.z)) < 0.05, `page ground on the path = the sculpted model (${onPath.toFixed(2)} vs ${S.heightAt(best.x, best.z).toFixed(2)}): M18 is deployed`)
  ok(Math.abs(onPath - M16.heightAt(best.x, best.z)) > 0.3 || best.cut > 1, `...and it is not the M16 land there (cutting ${best.cut.toFixed(1)} m deep beside it)`)
  // walk it: set the keeper on the path facing along it, hold W until 12 m covered (or 60 s), never a climb
  const yaw = Math.atan2(-best.ux, -best.uz)
  await p.evaluate((x, z, y) => (window as any).__ather.tp(x, z, y), best.x, best.z, yaw); await sleep(1500)
  await p.evaluate(() => (window as any).__ather.look((window as any).__ather.state().yaw, -0.1))
  const st = () => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px, z: s.pz, y: s.py, climb: !!(s.climbing || s.hanging || s.mantle) } }) as Promise<{ x: number; z: number; y: number; climb: boolean }>
  const s0 = await st()
  let climbed = false, far = 0, worstOff = 0
  await p.keyboard.down('KeyW')
  for (const t0 = Date.now(); Date.now() - t0 < 60000 && far < 12; await sleep(400)) {
    const s = await st(); far = Math.hypot(s.x - s0.x, s.z - s0.z); climbed = climbed || s.climb
    worstOff = Math.max(worstOff, Math.abs(s.y - S.heightAt(s.x, s.z)))
  }
  await p.keyboard.up('KeyW')
  ok(far >= 4, `the keeper walks along the cutting (${far.toFixed(1)} m)`)
  ok(!climbed && worstOff < 0.6, `...on the path's own ground, no climb (worst ${worstOff.toFixed(2)} m off the sculpted ground)`)
  ok(errs.length === 0, `0 page errors (${errs.slice(0, 2).join(' | ')})`)
  await br.close()
}
console.log(fails ? `FAIL ${fails}` : 'PASS: Ather paths sculpted (grade + banks beat M16, no wall beside a path), Nyx roads already cut in, the page stands on it, a keeper walks a cutting')
process.exit(fails ? 1 : 0)
