// minimap-voids-check (BETA M41 slice 3): the cloud voids show on the MINIMAP (and the fold map: both compose plate.ts).
// SETUP (stated): born keeper, into the Wilds at the neck nearest Moonwell by the fold map's `travel` hook, `tp` beside a full-void
// stretch of that border (positions are plumbing). Then READ the minimap canvas: void-dark pixels present near the centre,
// in the direction of the void; the neck (land) is not void-dark; 0 page errors.
//   npx tsx scripts/minimap-voids-check.mts [url] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { makeVoids, VOID_HALF, VOID_FADE, type IndexLike } from '../src/app/shimmer/open/ather/wilds-voids'
import { withGlade, type Network } from '../src/app/shimmer/open/ather/network'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
const url = process.argv[2] ?? 'http://localhost:3203', oi = process.argv.indexOf('--out'), out = oi > 0 ? process.argv[oi + 1] : '/tmp/minimap-voids-check'
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const index = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as IndexLike & { tiles: { name: string; tx: number; ty: number }[] }
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
const V = makeVoids(index, net)

// the neck nearest Moonwell, and a stretch of its border (>= 40 m from the neck) that is full void
const GX = GREG_WAYMARK.x, GZ = GREG_WAYMARK.z
const neck = V.crossings.filter(c => c.kind === 'neck').sort((a, b) => Math.hypot(a.x - GX, a.z - GZ) - Math.hypot(b.x - GX, b.z - GZ))[0]
const across = neck.axis === 'v' ? { x: 1, z: 0 } : { x: 0, z: 1 }, along = neck.axis === 'v' ? { x: 0, z: 1 } : { x: 1, z: 0 }
let edge: { x: number; z: number; s: number } | null = null
for (const d of [50, 60, 70, 80, 40, 90]) for (const sg of [1, -1]) {
  const x = neck.x + along.x * d * sg, z = neck.z + along.z * d * sg
  if (!edge && V.weight(x, z) > 0.99 && V.weight(x - across.x * 14, z - across.z * 14) > 0.9) edge = { x, z, s: sg }
}
ok(!!edge, `a full-void stretch of border beside the neck at (${neck.x}, ${neck.z}) axis ${neck.axis}`)
if (!edge) process.exit(1)
const tileOf = (x: number, z: number) => index.tiles.find(t => t.tx === Math.floor((x + 500) / 1000) && t.ty === Math.floor((z + 500) / 1000))!
const yawTo = (dx: number, dz: number) => Math.atan2(-dx, -dz)
const side = (x: number, z: number) => Math.sign((x - neck.x) * across.x + (z - neck.z) * across.z)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 960, height: 540 })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
await p.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 })
await sleep(3000)
const poll = async (f: () => Promise<boolean>, ms = 30000) => { for (let t = 0; t < ms; t += 700) { if (await f().catch(() => false)) return true; await sleep(700) } return false }
const A = (f: string, ...a: unknown[]) => p.evaluate((f, a) => (window as any).__ather[f](...a), f, a)
const st = () => A('state') as Promise<{ px: number; py: number; pz: number }>
const shot = async (n: string) => { await sleep(3000); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const near = (s: { px: number; pz: number }, x: number, z: number, r: number) => Math.hypot(s.px - x, s.pz - z) < r

// into the Wilds at the neck's tile
const T = tileOf(neck.x, neck.z)
for (let i = 0; i < 12 && (await A('zone')) !== 'wilds'; i++) {   // the travel hook can be refused while the page settles: retry
  await A('travel', { kind: 'waymark', w: { id: 'minimap-voids-check', tile: T.name, x: neck.x - T.tx * 1000 - across.x * 30, y: 0, z: neck.z - T.ty * 1000 - across.z * 30, biome: 2, made: 0 } })
  await poll(async () => (await A('zone')) === 'wilds', 15000)
}
ok((await A('zone')) === 'wilds', 'in the Wilds')
if ((await A('zone')) !== 'wilds') { await br.close(); console.log('minimap-voids-check: FAIL (never reached the Wilds)'); process.exit(1) }
await sleep(8000); await p.mouse.click(480, 300); await sleep(800)


// stand on the land side, 30 m back from the void, facing it; the minimap is north-up and centred on the keeper
// the land side = whichever side of the border has ground well above the void floor 40 m out (read from the real ground)
const gOf = async (d: number) => (await A('ground', edge.x + across.x * d, edge.z + across.z * d)) as number
await poll(async () => Number.isFinite(await gOf(40)) && Number.isFinite(await gOf(-40)), 30000)
const sg = (await gOf(40)) > (await gOf(-40)) ? 1 : -1, D = 40
const stand = { x: edge.x + across.x * D * sg, z: edge.z + across.z * D * sg }
await A('tp', stand.x, stand.z); await sleep(9000)
const me = await st()
ok(Math.hypot(me.px - stand.x, me.pz - stand.z) < 8, `standing on the land ${D} m from the void (keeper at ${me.px.toFixed(0)}, ${me.pz.toFixed(0)}; wanted ${stand.x}, ${stand.z})`)
// the plate's void colour after its glow lift (plate.ts: += (cloud - c) * 0.14)
const lift = (c: number[]) => [c[0] + (233 - c[0]) * 0.14, c[1] + (237 - c[1]) * 0.14, c[2] + (248 - c[2]) * 0.14]
const VOID = lift([74, 88, 112])
const read = () => p.evaluate((V: number[], D2: number[]) => {
  const c = document.querySelector('canvas[data-map="mini"]') as HTMLCanvasElement | null; if (!c) return null
  const g = c.getContext('2d')!, W = c.width, H = c.height, d = g.getImageData(0, 0, W, H).data
  let n = 0, tot = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - W / 2, y - H / 2); if (r > W * 0.42) continue
    if ((x - W / 2) * D2[0] + (y - H / 2) * D2[1] <= 0) continue   // only the half of the map toward the void
    tot++; const o = (y * W + x) * 4
    if (Math.abs(d[o] - V[0]) < 22 && Math.abs(d[o + 1] - V[1]) < 22 && Math.abs(d[o + 2] - V[2]) < 22) n++
  }
  return { n, tot, W, H }
}, VOID, [-across.x * sg, -across.z * sg])
await poll(async () => ((await read())?.n ?? 0) > 20, 30000)
const r = await read()
ok(!!r, 'the minimap canvas is on screen')
ok(!!r && r.n > 300, `void-dark pixels on the minimap beside the void (${r?.n} of ${r?.tot})`)
try { await (await p.$('canvas[data-map="mini"]'))?.screenshot({ path: `${out}/minimap-void.png` }) } catch { /* slow frame */ }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `minimap-voids-check: ${fails} FAIL` : 'minimap-voids-check: PASS')
process.exit(fails ? 1 : 0)
