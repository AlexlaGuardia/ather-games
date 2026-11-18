// ── THE ATHER'S EDGES ARE CLOUD, PLAYED (BETA M24, play / Jin 4 ccb58127, 11-18) ─────────────────────────────────────
// Alex 11-18: the world's border is a huge cloud pillow, the horizon gets a cloud border too; the PLOT KEEPS ITS FALL (his
// 08-15 floating island); in the Wilds 'let me walk to the edge and look out'. In the real page:
//   1. PLOT: the rim pillows + the horizon ring are mounted (one instanced draw for every puff)
//   2. PLOT: the fall is kept: walk off the rim -> the fold sets you down at the threshold (the pillows are not ground)
//   3. WILDS: reefs ride the sea round a sea tile, the cloud deck lies past the map, the horizon ring is up
//   4. WILDS: the map's edge is a wall: walking east into it for 4 s leaves the keeper inside the map (no walking off)
//   5. 0 page errors; look shots for Alex (plot rim, plot falling, the shore at noon + dusk, at the wall)
// SETUP (stated): born keeper (birthRune). Hooks: __ather tp/look/state/zone/travel/ground (movement, reading) and the
// __clouds counts (reading). Walking is the real W key.
//   npx tsx scripts/cloud-edge-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { islandRim } from '../src/app/shimmer/open/ather/edge-clouds'
import { THRESHOLD } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/cloud-edge')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
async function open(hour: number): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 960, height: 540 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  await p.goto(`${url}/shimmer/open/ather?hour=${hour}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 })
  await sleep(4000); await p.mouse.click(480, 300); await sleep(1000)
  return p
}
const poll = async (f: () => Promise<boolean>, ms = 30000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const A = (p: Page, f: string, ...a: unknown[]) => p.evaluate((f, a) => (window as any).__ather[f](...a), f, a)
const C = (p: Page) => p.evaluate(() => (window as any).__clouds ?? {}) as Promise<Record<string, number>>
const shot = async (p: Page, n: string) => { await sleep(5000); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const pos = (p: Page) => A(p, 'state') as Promise<{ px: number; py: number; pz: number }>

// ── 1 + 2: the plot ──
const p = await open(13)
ok(await poll(async () => (await C(p)).pillows > 200 && (await C(p)).ring === 1), `1. plot: rim pillows + horizon ring mounted (${JSON.stringify(await C(p))})`)
const rim = islandRim(), r = rim[Math.floor(rim.length * 0.45)], yaw = Math.atan2(-r.nx, -r.nz)
await A(p, 'tp', r.x - r.nx * 6, r.z - r.nz * 6, yaw); await A(p, 'look', yaw, -0.3); await shot(p, 'plot-rim')
await p.keyboard.down('KeyW')
const fell = await poll(async () => (await pos(p)).py < -3, 20000)
await shot(p, 'plot-falling')
await p.keyboard.up('KeyW')
ok(fell, '2. plot: walking off the rim FALLS (the pillows are not ground)')
ok(await poll(async () => { const s = await pos(p); return Math.hypot(s.px - THRESHOLD.x, s.pz - THRESHOLD.z) < 8 && s.py > -2 }, 40000), '2. ...and the fold sets the keeper down at the threshold')

// ── 3 + 4: the Wilds (the east coast: sea tile w3_0, the map ends at x = 3500) ──
await A(p, 'travel', { kind: 'waymark', w: { id: 'cloud-edge', tile: 'w3_0', x: -860, y: 0, z: 0, biome: 2, made: 0 } })
ok(await poll(async () => (await A(p, 'zone')) === 'wilds', 120000), '   in the Wilds')
await sleep(8000); await p.mouse.click(480, 300); await sleep(800)
let shore = 2140
for (let x = 3000; x > 2000; x -= 5) { if ((await A(p, 'ground', x, 0)) as number > 0.8) { shore = x; break } }
await A(p, 'tp', shore - 3, 0); await A(p, 'look', -Math.PI / 2, -0.03)
ok(await poll(async () => { const c = await C(p); return c.reefs > 0 && c.deck > 0 && c.ring === 1 }), `3. wilds, at the shore: reefs out on the sea tile, the deck past the map, the ring (${JSON.stringify(await C(p))})`)
await shot(p, 'wilds-shore-noon')
await A(p, 'tp', 3300, 0); await sleep(4000)
ok(await poll(async () => (await C(p)).reefs > 150, 15000), `3. wilds, out at sea: the reefs thicken toward the edge (${(await C(p)).reefs})`)
// ★ the map's edge where LAND meets it: w-3_2 (86% land) has no tile to its south, so the map ends at z = 2500
await A(p, 'travel', { kind: 'waymark', w: { id: 'cloud-edge-s', tile: 'w-3_2', x: 0, y: 0, z: 300, biome: 2, made: 0 } })
await sleep(10000); await p.mouse.click(480, 300); await sleep(800)
let ex = -3000
for (let x = -3450; x < -2550; x += 10) { const g = (await A(p, 'ground', x, 2470)) as number; if (g > 1.5 && (await A(p, 'ground', x, 2440)) as number > 1.5) { ex = x; break } }
// first prove the keys move the keeper here (else 'it did not cross' proves nothing): face NORTH, walk 3 s
await A(p, 'tp', ex, 2460, 0); await A(p, 'look', 0, 0); await sleep(2500); await p.mouse.click(480, 300); await sleep(500)
const w0 = (await pos(p)).pz
await p.keyboard.down('KeyW')
const walked = await poll(async () => w0 - (await pos(p)).pz > 3, 40000)   // this box runs 1-2 fps: poll the distance, never a fixed time
await p.keyboard.up('KeyW')
ok(walked, `4. wilds: the keeper walks on the land by the edge (north at x ${ex}: z ${w0.toFixed(1)} -> ${(await pos(p)).pz.toFixed(1)})`)
// then into the edge: face SOUTH from z 2492 and keep walking until the keeper has pressed right up to it (or 60 s)
await A(p, 'tp', ex, 2492, Math.PI); await A(p, 'look', Math.PI, -0.02); await sleep(2500)
await p.keyboard.down('KeyW')
let best = 0, last = -1, still = 0
for (let t = 0; t < 60000 && still < 8; t += 1000) { await sleep(1000); const z = (await pos(p)).pz; best = Math.max(best, z); still = Math.abs(z - last) < 0.02 ? still + 1 : 0; last = z }
await p.keyboard.up('KeyW')
const at = await pos(p)
ok(best > 2497 && at.pz <= 2500.5 && Number.isFinite(at.py), `4. wilds: the map's edge holds (walked south from z 2492 into it: reached ${best.toFixed(2)}, stopped at ${at.pz.toFixed(2)}, edge 2500)`)
await shot(p, 'wilds-wall')
await p.close()

// dusk, for the look call only
const d = await open(19)
await A(d, 'travel', { kind: 'waymark', w: { id: 'cloud-edge', tile: 'w3_0', x: -860, y: 0, z: 0, biome: 2, made: 0 } })
await poll(async () => (await A(d, 'zone')) === 'wilds', 120000); await sleep(8000); await d.mouse.click(480, 300)
await A(d, 'tp', shore - 3, 0); await A(d, 'look', -Math.PI / 2, -0.03); await shot(d, 'wilds-shore-dusk')

ok(errs.length === 0, `5. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(`shots in ${out}`)
console.log(fails ? `cloud-edge-check: ${fails} FAIL` : 'cloud-edge-check: PASS')
process.exit(fails ? 1 : 0)
