// M41 s1+2: cloud voids in the Wilds, in the real page. SETUP (stated): born keeper (birthRune), the Wilds entered by the fold map's
// own `travel` hook, then `tp` to a spot just outside a void's lip (positions are plumbing); every move after is the real W key.
//   1. a void edge: the ground drops away at the border (read from the real ground), a neck beside it is level land
//   2. walking into the void FALLS: with no crossing used yet the keeper is set down at the last waymark (Greg's stone)
//   3. walking ACROSS a crossing works: the keeper ends up in the next region, and is not thrown back
//   4. stepping into the void after that sets the keeper down at the crossing just used
//   5. 0 page errors
//   COORD_WIN=world npx tsx scripts/voids-check.mts http://localhost:3201 [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { makeVoids, VOID_HALF, VOID_FADE, type IndexLike } from '../src/app/shimmer/open/ather/wilds-voids'
import { withGlade, type Network } from '../src/app/shimmer/open/ather/network'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
const url = process.argv[2] ?? 'http://localhost:3201', oi = process.argv.indexOf('--out'), out = oi > 0 ? process.argv[oi + 1] : '/tmp/voids-check'
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
await A('travel', { kind: 'waymark', w: { id: 'voids-check', tile: T.name, x: neck.x - T.tx * 1000 - across.x * 30, y: 0, z: neck.z - T.ty * 1000 - across.z * 30, biome: 2, made: 0 } })
ok(await poll(async () => (await A('zone')) === 'wilds', 120000), 'in the Wilds')
await sleep(8000); await p.mouse.click(480, 300); await sleep(800)

// 1. the ground: a lip, then the deep at the border; the neck is land
const gEdge = (await A('ground', edge.x, edge.z)) as number, gLip = Math.max(...await Promise.all([30, 40, 50, 60].map(d => A('ground', edge.x - across.x * d, edge.z - across.z * d) as Promise<number>))), gNeck = (await A('ground', neck.x, neck.z)) as number
ok(gEdge < 1 && gNeck - gEdge > 3, `1. the crust is gone at the border (ground ${gEdge.toFixed(1)} m, the deep floor; neighbouring land reads up to ${gLip.toFixed(1)} m)`)
ok(gNeck - gEdge > 3, `1. the neck is land (${gNeck.toFixed(1)} m) beside the deep (${gEdge.toFixed(1)} m)`)

// 2. into the void with no crossing used: the last waymark (Greg's stone)
const startX = edge.x - across.x * (VOID_HALF + VOID_FADE + 3), startZ = edge.z - across.z * (VOID_HALF + VOID_FADE + 3)   // the -u side
await A('tp', startX, startZ, yawTo(across.x, across.z)); await A('look', yawTo(across.x, across.z), -0.55); await sleep(2500)
await shot('void-edge')
await A('look', yawTo(across.x, across.z), -0.15); await sleep(500)
await p.keyboard.down('KeyW')
const fell = await poll(async () => { const s = await st(); return near(s, GREG_WAYMARK.x, GREG_WAYMARK.z, 10) }, 200000)
await p.keyboard.up('KeyW')
ok(fell, `2. walking into the void falls: no crossing used, so the keeper is set down at the last waymark (${JSON.stringify(await st())})`)
await sleep(4000)

// 3. across the neck: from the -u side to the +u side on foot (u = the way across)
await p.mouse.click(480, 300)
const D = VOID_HALF + 8, R = VOID_HALF + VOID_FADE + 3
await A('tp', neck.x - across.x * D, neck.z - across.z * D, yawTo(across.x, across.z)); await A('look', yawTo(across.x, across.z), -0.1); await sleep(2000)
await shot('neck')
await p.keyboard.down('KeyW')
const crossed = await poll(async () => { const s = await st(); const d = Math.hypot(s.px - neck.x, s.pz - neck.z); return side(s.px, s.pz) === 1 && d > 10 && d < 60 }, 200000)
await p.keyboard.up('KeyW')
const sc = await st()
ok(crossed, `3. walking across the crossing works: the keeper ends on the far side (${sc.px.toFixed(1)}, ${sc.pz.toFixed(1)}; neck ${neck.x}, ${neck.z})`)

// 4. then into the void beside the neck, from the far side: set down at the crossing, not at Greg's stone
await A('tp', edge.x + across.x * R, edge.z + across.z * R, yawTo(-across.x, -across.z)); await A('look', yawTo(-across.x, -across.z), -0.15); await sleep(2000)
await p.keyboard.down('KeyW')
const back = await poll(async () => near(await st(), neck.x, neck.z, 9), 200000)
await p.keyboard.up('KeyW')
const s4 = await st()
ok(back && !near(s4, GREG_WAYMARK.x, GREG_WAYMARK.z, 30), `4. over the edge again: set down at the crossing just used (${s4.px.toFixed(1)}, ${s4.pz.toFixed(1)}; neck ${neck.x}, ${neck.z})`)
await shot('after-fall')
ok(errs.length === 0, `5. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
