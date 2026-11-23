// Check: VOID v2 (Alex 11-23 06:4x: "the only way it works is at the bottom of a pit ... have the void mist/fog tall enough for the
// player to fall inside and disappear into so they feel like they fell off the map"). In the real page at the 390x844 phone size:
// born keeper, into the Wilds by the fold map's `travel` hook, next to the nearest cooled neck (positions are plumbing, as
// void-look-check). A deep void spot the page names (window.__voidLook.deep); the rim = the first land with no void weight walking
// out from it (the pure field), stood 1 m back. Then:
//   1. (after) the pit floor sits the dial depth below the rim (ground at the deep spot vs ground at the rim stand)
//   2. (after) from the rim, looking down, the frame between the HUD bands (25-62% of its height) is mostly dark mist
//   3. shots: rim (looking down), side (looking across the pit), top (camera pinned 70 m up, looking straight down)
//   4. frames over 5 s at the rim view (before/after on one box; SwiftShader numbers, not a phone)
//   5. (after) THE FALL: stand on the neck (the last crossing), set down at the rim, hold W: the keeper descends (y over time), the
//      void veil closes to black, then the keeper is set down at the neck (voidFall's existing rule)
//   6. 0 page errors
// npx tsx scripts/void-fall-check.mts [--url U] [--out DIR] [--tag before|after] [--at deepX,deepZ]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'
import { makeVoids, VOID_DEPTH, type IndexLike } from '../src/app/shimmer/open/ather/wilds-voids'
import { withGlade, type Network } from '../src/app/shimmer/open/ather/network'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/void-fall'), TAG = flag('--tag', 'after'), AFTER = TAG === 'after'
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const index = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as IndexLike & { tiles: { name: string; tx: number; ty: number }[] }
const V = makeVoids(index, withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network))
const GX = GREG_WAYMARK.x, GZ = GREG_WAYMARK.z
const neck = V.crossings.filter(c => c.kind === 'neck').sort((a, b) => Math.hypot(a.x - GX, a.z - GZ) - Math.hypot(b.x - GX, b.z - GZ))[0]
const across = neck.axis === 'v' ? { x: 1, z: 0 } : { x: 0, z: 1 }
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
const settle = () => poll(async () => (await p.evaluate(() => (window as any).__groundPending?.() ?? 0)) === 0, 120000)
const T = tileOf(neck.x, neck.z)
for (let i = 0; i < 12 && (await A('zone')) !== 'wilds'; i++) {
  await A('travel', { kind: 'waymark', w: { id: 'void-fall', tile: T.name, x: neck.x - T.tx * 1000 - across.x * 30, y: 0, z: neck.z - T.ty * 1000 - across.z * 30, biome: 2, made: 0 } })
  await poll(async () => (await A('zone')) === 'wilds', 15000)
}
ok((await A('zone')) === 'wilds', 'in the Wilds')
if ((await A('zone')) !== 'wilds') { await br.close(); console.log('void-fall-check: FAIL (never reached the Wilds)'); process.exit(1) }
await sleep(6000)
await p.mouse.click(195, 420); await sleep(800)   // TAP TO START (the intro card)
await A('tp', neck.x - across.x * 30, neck.z - across.z * 30, yawTo(across.x, across.z))
await settle()

// the deep spot: the page's own (or --at), nearest the neck; the rim stand: walk out on the pure field to no weight, 3 m on
const atArg = flag('--at', '')
let deep: [number, number] | null = atArg ? atArg.split(',').map(Number) as [number, number] : null
if (!deep) {
  const all = await p.evaluate(() => Object.values(((window as any).__voidLook?.deep ?? {}) as Record<string, [number, number][]>).flat()) as [number, number][]
  deep = all.sort((a, b) => Math.hypot(a[0] - neck.x, a[1] - neck.z) - Math.hypot(b[0] - neck.x, b[1] - neck.z))[0] ?? null
}
ok(!!deep, `a deep void spot: AT=${deep ? deep.map(v => v.toFixed(1)).join(',') : 'none'}`)
if (!deep) { await br.close(); process.exit(1) }
let stand: { x: number; z: number; ux: number; uz: number; d: number } | null = null
for (let k = 0; k < 16; k++) {
  const ux = Math.cos(k * Math.PI / 8), uz = Math.sin(k * Math.PI / 8)
  for (let d = 4; d < 60; d += 1) {
    const x = deep[0] + ux * d, z = deep[1] + uz * d
    if (V.weight(x, z) === 0 && V.weight(x + ux * 4, z + uz * 4) === 0 && !V.protectedAt(x, z) && !V.crossingNear(x, z, 30)) { if (!stand || d < stand.d) stand = { x: x + ux, z: z + uz, ux, uz, d }; break }
  }
}
ok(!!stand, `the rim beside it: ${stand ? `(${stand.x.toFixed(1)}, ${stand.z.toFixed(1)}), ${stand.d} m out` : 'none'}`)
if (!stand) { await br.close(); process.exit(1) }
const YAW = yawTo(-stand.ux, -stand.uz)   // facing back into the pit
await A('tp', stand.x, stand.z, YAW); await settle(); await sleep(2500)

// 1. depth
const rimY = await A('ground', stand.x, stand.z) as number, floorY = await A('ground', deep[0], deep[1]) as number
console.log(`   ${TAG}: rim ${rimY.toFixed(2)} m, pit floor ${floorY.toFixed(2)} m -> ${(rimY - floorY).toFixed(2)} m deep (dial VOID_DEPTH ${VOID_DEPTH})`)
if (AFTER) ok(rimY - floorY >= VOID_DEPTH * 0.8, `1. the pit floor sits ~the dial depth below the rim (${(rimY - floorY).toFixed(1)} m, dial ${VOID_DEPTH})`)

// M91 idle cam: an input hands the view back, THEN aim it
const aim = async (pitch: number) => { await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F24' }))); await sleep(400); await A('look', YAW, pitch); await sleep(2500) }
const darkShare = async (file: string, from: number, to = 1) => {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let dark = 0, n = 0
  for (let y = Math.floor(info.height * from); y < Math.floor(info.height * to); y += 2) for (let x = 0; x < info.width; x += 2) {
    const o = (y * info.width + x) * 3; n++; if (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2] < 32) dark++
  }
  return dark / n
}
// 2 + 3. rim (looking down into it), side (across it)
await aim(-0.75)
const rim = `${out}/voids-v2-2026-11-23-rim-${TAG}.png`; await p.screenshot({ path: rim })
const rimDark = await darkShare(rim, 0.25, 0.62)
console.log(`   ${TAG}: rim view, near-black share of the view under the HUD band ${(rimDark * 100).toFixed(1)}%`)
if (AFTER) ok(rimDark > 0.5, `2. from the rim, looking down, the view is mostly dark mist (${(rimDark * 100).toFixed(1)}% near-black)`)
// 4. frames at the rim view
const fps = await p.evaluate(`new Promise(res => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(n / 5) } requestAnimationFrame(f) })`) as number
console.log(`   ${TAG}: ${fps.toFixed(2)} fps = ${(1000 / fps).toFixed(0)} ms/frame at the rim view (390x844, SwiftShader)`)
await aim(-0.12)
const side = `${out}/voids-v2-2026-11-23-side-${TAG}.png`; await p.screenshot({ path: side })
console.log(`   ${TAG}: side view, near-black share under the HUD band ${((await darkShare(side, 0.25, 0.62)) * 100).toFixed(1)}%`)
// top: pinned 70 m over the pit's edge, straight down
await A('tp', (stand.x + deep[0]) / 2, (stand.z + deep[1]) / 2, YAW, rimY + 70); await A('pin', true)
await aim(-1.5)
const top = `${out}/voids-v2-2026-11-23-top-${TAG}.png`; await p.screenshot({ path: top })
await A('pin', false)
ok(true, `3. shots: ${rim} ${side} ${top}`)

// 5. THE FALL: the neck first (so it is the last crossing), then the rim, hold W into the pit
await A('tp', neck.x, neck.z, YAW); await settle(); await sleep(1500)
await A('tp', stand.x, stand.z, YAW); await sleep(1200)
await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F24' }))); await A('look', YAW, -0.3)
await p.keyboard.down('KeyW')
const trace: { t: number; y: number; x: number; z: number; f: boolean; dark: number }[] = []
const t0 = Date.now()
let sawFall = false, maxDark = 0, droppedBy = 0, respawned = false
while (Date.now() - t0 < 30000) {   // a dev server runs ~2 fps: give the walk time
  const s = await p.evaluate(() => { const st = (window as any).__ather.state(); const v = document.querySelector('[data-veil="void"]') as HTMLElement | null
    return { y: st.py, x: st.px, z: st.pz, f: !!(window as any).__ather.falling?.(), dark: v ? Number(v.style.opacity || 0) : 0 } })
  trace.push({ t: (Date.now() - t0) / 1000, ...s })
  if (trace.length === 20) console.log(`   (2 s in: x ${s.x.toFixed(1)} z ${s.z.toFixed(1)}, from ${stand.x.toFixed(1)}, ${stand.z.toFixed(1)})`)
  if (s.f) { sawFall = true; droppedBy = Math.max(droppedBy, rimY - s.y) }
  maxDark = Math.max(maxDark, s.dark)
  if (sawFall && Math.hypot(s.x - neck.x, s.z - neck.z) < 4 && !s.f) { respawned = true; break }
  if (!AFTER && Math.hypot(s.x - neck.x, s.z - neck.z) < 4 && trace.length > 2) { respawned = true; break }
  await sleep(100)
}
await p.keyboard.up('KeyW')
console.log(`   ${TAG}: fall trace (t s: y m, falling, veil) ${trace.filter((_, i) => i % 2 === 0).map(s => `${s.t.toFixed(1)}:${s.y.toFixed(1)}${s.f ? 'F' : ''}/${s.dark.toFixed(2)}`).join(' ')}`)
const fallen = trace.filter(s => s.f), ys = fallen.map(s => s.y)
const descends = ys.length >= 3 && ys[ys.length - 1] < ys[0] - 4
if (AFTER) {
  ok(sawFall && descends, `5a. walked over the lip, the keeper FALLS: y ${ys.length ? ys[0].toFixed(1) : '-'} -> ${ys.length ? ys[ys.length - 1].toFixed(1) : '-'} over ${fallen.length} samples (${droppedBy.toFixed(1)} m under the rim)`)
  ok(maxDark >= 0.99, `5b. the view goes black before the cost (veil max ${maxDark.toFixed(2)})`)
  ok(respawned, `5c. then set down at the last crossing (neck ${neck.x}, ${neck.z})${respawned ? '' : ': never came back'}`)
} else console.log(`   before: respawned at the neck ${respawned}, sawFall ${sawFall}`)
ok(errs.length === 0, `6. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
