// M47 slice 2 check (glade-floors-check): a BLUEPRINT with an upper floor draws and collides it.
//   A test blueprint (6x5 ground room, a 4x3 room on floor 2) is stood on Hazel's lot through the dev hook __glade.setBlueprint
//   (visual + solids only, nothing saved; Alex's authored glade-<lot>.json are untouched).
//   1. the scene stands the blueprint with 2 levels (__bpStacks)
//   2. __ather.tp onto its upper slab (y = a storey up + 0.8 drop): the keeper stands at ground + 5.0 m (M50), not on the ground
//   3. M47 close-out: the blueprint carries a LIFT SHAFT at cell (2,2): its slab is drawn open there (__bpStacks holes) and a keeper
//      dropped over the shaft falls THROUGH to the ground floor, while beside it (step 2) the slab holds
//   4. 0 page errors
//   npx tsx scripts/glade-floors-check.mts [--url http://localhost:3201]
import puppeteer from 'puppeteer-core'
import { placeBlueprint, parseHouse } from '../src/app/shimmer/open/ather/plot-blueprint'
import { lotPad } from '../src/app/shimmer/open/ather/glade-lots'
import { lotAt } from '../src/app/shimmer/open/ather/moonwell-glade'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const room = (i0: number, j0: number, i1: number, j1: number) => {
  const w: Record<string, { mat: string; kind?: string }> = {}
  for (let i = i0; i < i1; i++) { w[`h,${i},${j0}`] = { mat: 'goldwood' }; w[`h,${i},${j1}`] = { mat: 'goldwood' } }
  for (let j = j0; j < j1; j++) { w[`v,${i0},${j}`] = { mat: 'goldwood' }; w[`v,${i1},${j}`] = { mat: 'goldwood' } }
  w[`h,${i0 + 1},${j0}`] = { mat: 'goldwood', kind: 'door' }
  return w
}
const bp = { v: 1, id: 'glade-hazel', name: 'Test house', w: 6, d: 5, walls: room(0, 0, 6, 5), floors: {}, roof: 'gable', saved: 0, upper: [{ walls: room(1, 1, 5, 4), floors: {} }], lifts: [{ i: 2, j: 2, top: 1 }] }
const parsed = parseHouse(bp)!
const lot = lotAt('hazel')!, pl = placeBlueprint(parsed, lotPad('hazel', 0))
const c = pl.toWorld(3, 2.5)   // the middle of the upper room
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(process.argv.includes('--phone') ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 680 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__glade, { timeout: 180000 }); await p.waitForFunction(() => (window as any).__glade.blueprints().includes('hazel'), { timeout: 60000 }).catch(() => {}); await sleep(1500)   // the lot's own fetch lands first, then ours stands over it
  const set = await p.evaluate((j: unknown) => (window as any).__glade.setBlueprint('hazel', j), bp as unknown)
  ok(set === true, `test blueprint stood on hazel's lot (${lot.id}), upper floor present`)
  await sleep(2500)
  const stack = await p.evaluate(() => (window as any).__bpStacks?.['glade-hazel'] ?? null) as { levels: number; holes?: number[] } | null
  ok(stack?.levels === 2, `1. the scene draws the blueprint with ${stack?.levels ?? 'no'} levels (want 2)`)
  // ground reference: the lot's floor
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), pl.toWorld(3, -3).x, pl.toWorld(3, -3).z); await sleep(2500)
  const g = await p.evaluate(() => (window as any).__ather.state()) as { py: number }
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, 0, y), c.x, c.z, g.py + 5.0 + 0.8); await sleep(1500)
  let last = 1e9, st: any = null
  for (let n = 0; n < 40; n++) { st = await p.evaluate(() => (window as any).__ather.state()); if (Math.abs(st.py - last) < 0.005) break; last = st.py; await sleep(1000) }
  ok(Math.abs(st.py - (g.py + 5.0)) < 0.25, `2. standing on the blueprint's upper slab: feet ${st.py.toFixed(2)} vs ${(g.py + 5.0).toFixed(2)} (ground ${g.py.toFixed(2)} + one storey)`)
  ok(JSON.stringify(stack?.holes) === '[1]', `3a. the upper slab is drawn with the shaft open (holes per upper level ${JSON.stringify(stack?.holes)}, want [1])`)
  const sh = pl.toWorld(2.5, 2.5)
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, 0, y), sh.x, sh.z, g.py + 5.0 + 0.8); await sleep(1500)
  last = 1e9
  for (let n = 0; n < 40; n++) { st = await p.evaluate(() => (window as any).__ather.state()); if (Math.abs(st.py - last) < 0.005) break; last = st.py; await sleep(1000) }
  ok(st.py < g.py + 1.0, `3b. dropped over the shaft, the keeper falls through to the ground floor: feet ${st.py.toFixed(2)} (ground ${g.py.toFixed(2)}, slab ${(g.py + 5.0).toFixed(2)})`)
  if (process.argv.includes('--shot')) { const eye = pl.toWorld(4.4, 3.6), dx = sh.x - eye.x, dz = sh.z - eye.z   // on the slab beside the shaft, looking down into it
    await p.evaluate((x: number, z: number, y: number, yaw: number) => { const g = (window as any).__ather; g.tp(x, z, yaw, y); g.look(yaw, -0.75); for (const el of document.querySelectorAll('div')) { const t = el.textContent ?? ''; const hit = (u: string) => u.includes('Click to play') || u.includes('TAP TO START') || u.includes('Tap to start'); if (hit(t) && t.length < 900 && ![...el.children].some(c => hit(c.textContent ?? '') && c.tagName === 'DIV')) (el as HTMLElement).style.display = 'none' } }, eye.x, eye.z, g.py + 5.8, Math.atan2(-dx, -dz)); await sleep(4000); await p.screenshot({ path: flag('--shot', '/tmp/bp-shaft.png') }); console.log('shot', flag('--shot', '')) }
  ok(errs.length === 0, `4. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
