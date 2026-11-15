// ── Prod check for garden clusters in the open world (2026-11-15, hub) ─────────────────────────────────────
// Solo: nothing beyond the island is ground. ?cluster=preview: three stand-in friends — the walker stands on my gate's
// ramp, the crossroads, a street, the shared square and two friends' islands (teleports, then the walker must NOT fall).
// Updated 11-15 (world) for Alex's sketch: square middle, # streets, corner start + gate.
// C opens the Linked plots menu (hearth frame, red close). Screenshots to --out.   npx tsx scripts/cluster-check.mts
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 120000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: Record<string, unknown> = {}
const p = await b.newPage()
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))   // a fresh profile is born first (birth-gate.tsx); seed a rune so the ritual does not take the screen; await p.setViewport({ width: 1200, height: 740 })
const load = async (q: string) => { await p.goto(`${url}/shimmer/open/ather?hour=13${q}`, { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2500) }
const standAt = async (x: number, z: number) => {
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI * 0.75), x, z)
  await sleep(2500)
  return p.evaluate(() => { const s = (window as any).__ather.state(); return { zone: (window as any).__ather.zone(), x: Math.round(s.px), z: Math.round(s.pz), y: +s.py.toFixed(2) } })
}
await load('')
res.soloOff = await standAt(-130, 130)   // where the square would be: alone, there is no ground (the fall takes you home)
res.home = await standAt(-56, 56)        // the threshold: the start is the corner 3×3 now (Alex 11-15 sketch)
await load('&cluster=preview')
// Alex's sketch + the meadow (D = 130): I am NE of the square at (-130, 130). My path leaves my start corner along the
// diagonal past the gate (now off to the side at (-70, 54)) and meets the others in the middle of the square. Hills
// divide neighbours: (-130, 0) is the ridge between me and the preview's nw friend at (-260, 0).
res.path = await standAt(-80, 80)
res.hill = await standAt(-130, 0)
res.middle = await standAt(-130, 130)
try { await p.screenshot({ path: `${out}/cluster-1-middle.png` }) } catch { /* slow frame */ }
res.friend = await standAt(-260, 260)
res.friendNW = await standAt(-260, 0)
await standAt(-56, 56)
await p.evaluate(() => (window as any).__ather.tp(-56, 56, Math.PI * 0.75)); await sleep(1500)
try { await p.screenshot({ path: `${out}/cluster-2-gate.png` }) } catch { /* slow frame */ }
await p.keyboard.press('KeyC'); await sleep(900)
res.menu = await p.evaluate(() => !!document.querySelector('[data-panel="cluster"] button[aria-label="close"]'))
try { await p.screenshot({ path: `${out}/cluster-3-menu.png` }) } catch { /* slow frame */ }
console.log(JSON.stringify(res))
const onPlot = (r: any) => r.zone === 'plot'
const near = (r: any, x: number, z: number) => Math.hypot(r.x - x, r.z - z) < 6
const pass = !near(res.soloOff, -130, 130) && near(res.home, -56, 56) && (res.hill as any).y > 8 && [['path', -80, 80], ['hill', -130, 0], ['middle', -130, 130], ['friend', -260, 260], ['friendNW', -260, 0]].every(([k, x, z]) => onPlot(res[k as string]) && near(res[k as string], x as number, z as number)) && res.menu === true
console.log(pass ? 'PASS' : 'FAIL'); await b.close(); process.exit(pass ? 0 : 1)
