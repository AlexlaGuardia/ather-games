// Check: THE VOID LOOK PASS (Alex 11-23 05:5x: "the voids look like stone pits ingame.. can we make the base texture like a
// mat black with glimmers of purple and then a layer of thinning black fog to give it a deep look"). In the real page at the
// 390x844 phone size: born keeper, into the Wilds by the fold map's own `travel` hook, `tp` to just outside a void's lip
// looking across it (positions are plumbing, as voids-check). Then:
//   1. (after) the page carries the new void look: window.__voidLook names it and a haze is mounted on this tile
//   2. (after) the void reads near-black on screen: the share of near-black pixels in the frame (before = the stone grey)
//   3. frames counted over 5 s looking at the void, so before (prod, the stone pit) and after compare on the same box
//   4. 0 page errors
// npx tsx scripts/void-look-check.mts [--url U] [--out DIR] [--tag before|after]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'
import { makeVoids, VOID_HALF, VOID_FADE, type IndexLike } from '../src/app/shimmer/open/ather/wilds-voids'
import { withGlade, type Network } from '../src/app/shimmer/open/ather/network'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/void-look'), TAG = flag('--tag', 'after')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const index = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as IndexLike & { tiles: { name: string; tx: number; ty: number }[] }
const V = makeVoids(index, withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network))
const GX = GREG_WAYMARK.x, GZ = GREG_WAYMARK.z
const neck = V.crossings.filter(c => c.kind === 'neck').sort((a, b) => Math.hypot(a.x - GX, a.z - GZ) - Math.hypot(b.x - GX, b.z - GZ))[0]
const across = neck.axis === 'v' ? { x: 1, z: 0 } : { x: 0, z: 1 }, along = neck.axis === 'v' ? { x: 0, z: 1 } : { x: 1, z: 0 }
let edge: { x: number; z: number } | null = null
for (const d of [50, 60, 70, 80, 40, 90]) for (const sg of [1, -1]) {
  const x = neck.x + along.x * d * sg, z = neck.z + along.z * d * sg
  if (!edge && V.weight(x, z) > 0.99 && V.weight(x - across.x * 14, z - across.z * 14) > 0.9) edge = { x, z }
}
ok(!!edge, `a full-void stretch of border beside the neck at (${neck.x}, ${neck.z})`)
if (!edge) process.exit(1)
const tileOf = (x: number, z: number) => index.tiles.find(t => t.tx === Math.floor((x + 500) / 1000) && t.ty === Math.floor((z + 500) / 1000))!
const yawTo = (dx: number, dz: number) => Math.atan2(-dx, -dz)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const p: Page = await (await br.createBrowserContext()).newPage()
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
await p.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 })
await sleep(3000)
const poll = async (f: () => Promise<boolean>, ms = 30000) => { for (let t = 0; t < ms; t += 700) { if (await f().catch(() => false)) return true; await sleep(700) } return false }
const A = (f: string, ...a: unknown[]) => p.evaluate((f, a) => (window as any).__ather[f](...a), f, a)
const T = tileOf(neck.x, neck.z)
for (let i = 0; i < 12 && (await A('zone')) !== 'wilds'; i++) {
  await A('travel', { kind: 'waymark', w: { id: 'void-look', tile: T.name, x: neck.x - T.tx * 1000 - across.x * 30, y: 0, z: neck.z - T.ty * 1000 - across.z * 30, biome: 2, made: 0 } })
  await poll(async () => (await A('zone')) === 'wilds', 15000)
}
ok((await A('zone')) === 'wilds', 'in the Wilds')
if ((await A('zone')) !== 'wilds') { await br.close(); console.log('void-look-check: FAIL (never reached the Wilds)'); process.exit(1) }
await sleep(6000)
await p.mouse.click(195, 420); await sleep(800)   // TAP TO START (the intro card)
const R = VOID_HALF + VOID_FADE + 4
await A('tp', edge.x - across.x * R, edge.z - across.z * R, yawTo(across.x, across.z))
await poll(async () => (await p.evaluate(() => (window as any).__groundPending?.() ?? 0)) === 0, 120000)
// a deep void spot the page itself names (void-look's probe: a cell whose 20 m neighbourhood is all void), the nearest; then
// walk out from it on the real ground (8 headings) to the nearest standable land and stand 8 m back from the lip, facing it.
// --at x,z,yaw reuses a spot (the before run on prod has no probe: pass it the after run's AT line).
const sx = edge.x - across.x * R, sz = edge.z - across.z * R
const atArg = flag('--at', '')
let spot: { x: number; z: number; yaw: number } | null = atArg ? (([x, z, yaw]) => ({ x, z, yaw }))(atArg.split(',').map(Number)) : null
if (!spot) {
  spot = await p.evaluate((sx: number, sz: number) => {
    const L = (window as any).__voidLook as { deep: Record<string, [number, number][]> } | undefined
    const g = (window as any).__ather.ground as (x: number, z: number) => number
    const all = Object.values(L?.deep ?? {}).flat().sort((a, b) => Math.hypot(a[0] - sx, a[1] - sz) - Math.hypot(b[0] - sx, b[1] - sz))
    for (const [dx, dz] of all.slice(0, 6)) {
      let best: { x: number; z: number; yaw: number; d: number } | null = null
      for (let k = 0; k < 8; k++) {
        const ux = Math.cos(k * Math.PI / 4), uz = Math.sin(k * Math.PI / 4)
        for (let d = 8; d < 60; d += 2) {
          const x = dx + ux * d, z = dz + uz * d
          if (g(x, z) > 2.5 && g(x + ux * 6, z + uz * 6) > 2.5 && Number.isFinite(g(x + ux * 8, z + uz * 8))) {
            if (!best || d < best.d) best = { x: x + ux * 8, z: z + uz * 8, yaw: Math.atan2(ux, uz), d }   // yaw faces back (-u): atan2(-(-ux), -(-uz))
            break
          }
        }
      }
      if (best) return { x: best.x, z: best.z, yaw: best.yaw }
    }
    return null
  }, sx, sz)
}
ok(!!spot, `a deep void spot and the land beside it: AT=${spot ? [spot.x.toFixed(1), spot.z.toFixed(1), spot.yaw.toFixed(3)].join(',') : 'none'}`)
const YAW = spot?.yaw ?? 0
if (spot) await A('tp', spot.x, spot.z, YAW)
await poll(async () => (await p.evaluate(() => (window as any).__groundPending?.() ?? 0)) === 0, 120000)
await sleep(3000)
// M91 idle cam: after 25 s with no input the view drifts and rewrites `look`; an input hands the view back, THEN aim it
const aim = async () => { await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F24' }))); await sleep(400); await A('look', YAW, -0.38); await sleep(2500) }
await aim()
const file = `${out}/voids-2026-11-23-${TAG}.png`
await p.screenshot({ path: file })

// 1. the marker
const look = await p.evaluate(() => (window as any).__voidLook ?? null) as { v: string; tiles: Record<string, number> } | null
console.log(`   __voidLook = ${JSON.stringify(look)}`)
if (TAG === 'after') ok(!!look && look.v.startsWith('matte-glimmer-fog') && (look.tiles[T.name] ?? 0) > 0, `1. the new void look is mounted on ${T.name} (${look?.v ?? 'none'}, ${look?.tiles?.[T.name] ?? 0} haze cells)`)

// 2. the near-black share of the frame (the stone pit was #4a5870, luminance ~85)
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const png = { data, width: info.width, height: info.height }
let dark = 0, n = 0
for (let y = Math.floor(png.height * 0.3); y < png.height; y += 2) for (let x = 0; x < png.width; x += 2) {
  const o = (y * png.width + x) * 3, L = 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2]
  n++; if (L < 32) dark++
}
const share = dark / n
console.log(`   ${TAG}: near-black share of the lower frame ${(share * 100).toFixed(1)}%`)
if (TAG === 'after') ok(share > 0.05, `2. the void reads near-black on screen (${(share * 100).toFixed(1)}% of the lower frame under luminance 32)`)

// 3. frames over 5 s looking at the void
await aim()
const fps = await p.evaluate(`new Promise(res => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(n / 5) } requestAnimationFrame(f) })`) as number
console.log(`   ${TAG}: ${fps.toFixed(2)} fps = ${(1000 / fps).toFixed(0)} ms/frame looking at the void (390x844)`)
ok(errs.length === 0, `4. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
