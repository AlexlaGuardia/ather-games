// BETA M182: GREG'S EIGHT DEWBEARS AT HIS PLOT (RULED athernyx bcdceeb). A fresh keeper (never Alex's save) at the Glade, on a
// phone (390x844) and a desktop: Blue drawn at the bench (dew-blue), 7 young ones with 7 distinct tints, none dew-blue, each
// smaller than Blue; they move about on their own, and crowd the keeper who walks into the garden; 0 page errors. Then the
// frame cost: draw calls + mean frame time at the garden with them and with ?dewbears=0.
//   npx tsx scripts/m182-dewbears-check.mts [outdir]   (URL= to point elsewhere)
import puppeteer from 'puppeteer-core'
import { gregSpot } from '../src/app/shimmer/open/ather/moonwell-glade'
import { gardenCentre, YOUNG_TINTS, CROWD_R, GARDEN } from '../src/app/shimmer/open/ather/glade-dewbears'
import { BLUE_COLOR } from '../src/app/shimmer/open/ather/blue-look'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games', out = process.argv[2]
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
type Y = { x: number; z: number; mode: string; clip: string; h: number; tint: string | null }
const S = gregSpot(), G = gardenCentre(S)
const cost: Record<string, { calls: number; ms: number }> = {}, loop: Record<string, number> = {}

async function run(tag: string, w: number, h: number, phone: boolean, q = '') {
  const p = await br.newPage(), errs: string[] = []
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ather:shimmer:birthRune', 'star'); if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.removeItem('open.inv.v1'); localStorage.removeItem('open.loadout.v1'); localStorage.removeItem('open.errand.v1') } } catch { /* no storage */ } })
  await p.setViewport(phone ? { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: w, height: h })
  await p.goto(`${URL}/shimmer/open/ather${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 }); await wait(2000)
  for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'glade'; i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await wait(4000) }
  const t0 = Date.now(); while (Date.now() - t0 < 120000 && !(await p.evaluate(() => !!(window as any).__greg))) await wait(500)
  if (phone) { await p.touchscreen.tap(195, 530); await wait(800); await p.touchscreen.tap(195, 530); await wait(800) }   // the 'tap to start' card
  // stand 12 m out from the garden, on the green side, looking in (past CROWD_LEAVE: they are home, not crowding)
  const tp = (x: number, z: number) => p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), x, z, S.yaw)   // facing the garden (walker forward = -sin/-cos yaw)
  const ax = Math.sin(S.yaw), az = Math.cos(S.yaw)
  await tp(G.x + ax * 12, G.z + az * 12); await wait(5000)
  const home = async () => { const t = Date.now(); while (Date.now() - t < 90000) { const ys: Y[] | null = await p.evaluate(() => (window as any).__dewbears?.young?.() ?? null); if (ys?.length === 7 && ys.every(y => y.mode !== 'crowd' && Math.hypot(y.x - G.x, y.z - G.z) < GARDEN.r + 0.5)) return true; await wait(1000) } return false }
  const atHome = q.includes('dewbears=0') ? true : await home()
  // a string, not a function: tsx wraps named inner functions in __name(), which the page does not have
  const frame = () => p.evaluate(`new Promise(res => { const ts = []; const f = t => { ts.push(t); if (ts.length < 90) requestAnimationFrame(f); else res({ calls: window.__ather?.calls?.() ?? -1, ms: (ts[ts.length - 1] - ts[0]) / (ts.length - 1) }) }; requestAnimationFrame(f) })`) as Promise<{ calls: number; ms: number }>
  cost[tag] = await frame()
  console.log(`${tag}: ${cost[tag].calls} draw calls, ${cost[tag].ms.toFixed(1)} ms/frame (swiftshader)`)
  if (q.includes('dewbears=0')) { ok(!(await p.evaluate(() => !!(window as any).__dewbears)), `${tag}: ?dewbears=0 draws none`); ok(errs.length === 0, `${tag}: 0 page errors ${errs.join(' | ')}`); await p.close(); return }
  const ready = await (async () => { const t = Date.now(); while (Date.now() - t < 60000) { if (await p.evaluate(() => ((window as any).__dewbears?.young?.() ?? []).length === 7 && (window as any).__dewbears.young()[0].tint)) return true; await wait(500) } return false })()
  ok(ready, `${tag}: the young Dewbears are drawn`)
  if (!ready) { await p.close(); return }
  const a: Y[] = await p.evaluate(() => (window as any).__dewbears.young())
  const blue = await p.evaluate(() => (window as any).__dewbears.blue())
  const stats = await p.evaluate(() => (window as any).__dewbears.stats())
  loop[tag] = stats.ms
  ok(blue.drawn && blue.deep === BLUE_COLOR_DEEP, `${tag}: Blue drawn at the bench, dew-blue ${blue.deep} (h ${blue.h.toFixed(3)})`)
  ok(a.length + (blue.drawn ? 1 : 0) === 8, `${tag}: eight Dewbears in Greg's garden (7 young + Blue)`)
  ok(new Set(a.map(y => y.tint)).size === 7 && a.every(y => YOUNG_TINTS.includes(y.tint as typeof YOUNG_TINTS[number])), `${tag}: 7 distinct tints ${a.map(y => y.tint).join(' ')}`)
  ok(a.every(y => y.tint !== blue.deep), `${tag}: none of the seven is Blue's dew-blue`)
  ok(a.every(y => y.h > 0 && y.h < blue.h), `${tag}: every young one smaller than Blue (${a[0].h.toFixed(3)} < ${blue.h.toFixed(3)})`)
  ok(atHome && a.every(y => Math.hypot(y.x - G.x, y.z - G.z) < GARDEN.r + 0.5), `${tag}: all seven home in the garden (a keeper 12 m off)`)
  ok(stats.drawn === 7 && stats.animated >= 1, `${tag}: drawn ${stats.drawn}, animated ${stats.animated}, hull ${stats.hull}; their loop ${stats.ms.toFixed(2)} ms/frame`)
  if (out) await p.screenshot({ path: `${out}/${tag}-garden.png` as `${string}.png` })
  await wait(4000)
  const b: Y[] = await p.evaluate(() => (window as any).__dewbears.young())
  const moved = a.filter((y, i) => Math.hypot(y.x - b[i].x, y.z - b[i].z) > 0.2).length
  ok(moved >= 2, `${tag}: they wander on their own (${moved}/7 moved in 4 s; modes ${b.map(y => y.mode).join(',')})`)
  // walk into the garden: they crowd
  await tp(G.x, G.z)
  let near = 0, c: Y[] = []
  for (const t = Date.now(); Date.now() - t < 60000 && near < 4; await wait(1000)) {
    const k = await p.evaluate(() => (window as any).__ather.state?.() ?? null), kx = k?.x ?? G.x, kz = k?.z ?? G.z
    c = await p.evaluate(() => (window as any).__dewbears.young()); near = c.filter(y => Math.hypot(y.x - kx, y.z - kz) < CROWD_R + 0.6).length
  }
  ok(near >= 4 && c.filter(y => y.mode === 'crowd').length >= 4, `${tag}: they crowd the keeper (${near}/7 within ${(CROWD_R + 0.6).toFixed(2)} m)`)
  if (out) await p.screenshot({ path: `${out}/${tag}-crowd.png` as `${string}.png` })
  ok(errs.length === 0, `${tag}: 0 page errors ${errs.join(' | ')}`)
  await p.close()
}
const BLUE_COLOR_DEEP = BLUE_COLOR.deep
await run('phone', 390, 844, true)
await run('desktop', 1400, 900, false)
await run('desktop-without', 1400, 900, false, '?dewbears=0')
const d = cost.desktop, n = cost['desktop-without']
if (d && n) console.log(`FRAME COST (desktop, swiftshader): with ${d.calls} calls / ${d.ms.toFixed(1)} ms, without ${n.calls} calls / ${n.ms.toFixed(1)} ms: +${d.calls - n.calls} calls, +${(d.ms - n.ms).toFixed(1)} ms; the seven's own update loop ${loop.desktop?.toFixed(2)} ms/frame desktop, ${loop.phone?.toFixed(2)} ms phone`)
ok(!!d && !!n && d.calls - n.calls <= 21 && d.calls - n.calls >= 7, `the seven cost 7..21 draw calls (${d && n ? d.calls - n.calls : '?'})`)
console.log(fails ? `m182-dewbears-check: ${fails} FAILED` : 'm182-dewbears-check: ALL PASS')
await br.close(); process.exit(fails ? 1 : 0)
