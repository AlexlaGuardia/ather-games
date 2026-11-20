// TRAVEL VEIL (BETA M44 1+2): plot -> Moonwell Glade -> a Wilds waymark -> plot. The veil must hold until the zone is ready
// (10 steady frames under 25 ms, cap 6 s) and no frame may exceed 50 ms in the first 2 s after it lifts.
//   npx tsx scripts/travel-veil-check.mts [origin] [shot.png]
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 1280, height: 720 })
const errors: string[] = []
p.on('pageerror', e => errors.push(String(e)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const w = window as any; w.__frames = []; let last = performance.now()
  const tick = (t: number) => { w.__frames.push([t, t - last]); last = t; requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
})
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
await p.goto(`${origin}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof (window as any).__ather?.travel === 'function' && (window as any).__ather.zone() === 'plot', { timeout: 240000 }); await sleep(3000)
const GLADE = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 0, made: 0 }
const OTHER = { id: 'veil-check', tile: 'first-wilds', x: -230, y: 0, z: 240, biome: 0, made: 0 }
const legs: [string, any, string][] = [['plot -> Moonwell Glade', { kind: 'waymark', w: GLADE }, 'wilds'], ['Glade -> Wilds waymark', { kind: 'waymark', w: OTHER }, 'wilds'], ['Wilds -> plot', { kind: 'home' }, 'plot']]
let worstAll = 0
for (const [name, dest, zone] of legs) {
  await p.evaluate(() => { (window as any).__veil = undefined })
  for (let i = 0; i < 40; i++) {   // the Wilds may still be loading: retry until the veil goes up
    await p.evaluate((d) => (window as any).__ather.travel(d), dest)
    await sleep(1500)
    if (await p.evaluate(() => !!(window as any).__veil)) break
  }
  await p.waitForFunction(() => { const v = (window as any).__veil; return v && v.readyAt > 0 }, { timeout: 60000 }).catch(() => {})
  const v = await p.evaluate(() => ({ ...(window as any).__veil, z: (window as any).__ather.zone() }))
  await p.evaluate(() => new Promise(r => setTimeout(r, 2100)))
  const dur = v.readyAt - v.swapAt, worst = await p.evaluate((a) => Math.max(0, ...(window as any).__frames.filter((f: number[]) => f[0] >= a && f[0] <= a + 2000).map((f: number[]) => f[1])), v.readyAt)
  worstAll = Math.max(worstAll, worst)
  console.log(`  ${name}: veil held ${Math.round(v.readyAt - v.upAt)} ms (${Math.round(dur)} ms after swap), steady ${v.frames}, worst frame in 2 s after lift ${Math.round(worst)} ms`)
  ok(v.z === zone, `${name}: arrived in ${zone}`)
  ok(dur >= 500 && (v.frames >= 10 || dur >= 5900), `${name}: veil held until the zone was ready (${Math.round(dur)} ms after swap)`)
  ok(worst <= 50, `${name}: no frame over 50 ms in 2 s after lift (worst ${Math.round(worst)} ms)`)
}
console.log(`WORST over all legs: ${Math.round(worstAll)} ms`)
ok(errors.length === 0, `0 page errors (${errors.slice(0, 2).join(' | ')})`)
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
