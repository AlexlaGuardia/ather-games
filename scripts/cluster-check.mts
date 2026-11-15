// ── Prod check for garden clusters in the open world (2026-11-15, hub) ─────────────────────────────────────
// Solo: nothing beyond the island is ground. ?cluster=preview: a stand-in friend in the opposite quarter — the walker
// stands on my lane, my bridge, the shared middle and the friend's island (teleports, then the walker must NOT fall).
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
res.soloOff = await standAt(-117, 117)   // where the middle would be: alone, there is no ground (the fall takes you home)
await load('&cluster=preview')
// ne quarter (D = 117): the middle is at (-117, 117); my lane runs from about (-38, 38) to (-77, 77); the bridge to (-89, 89); a friend's plot at (-234, 234)
res.lane = await standAt(-58, 58)
res.bridge = await standAt(-83, 83)
res.middle = await standAt(-117, 117)
try { await p.screenshot({ path: `${out}/cluster-1-middle.png` }) } catch { /* slow frame */ }
res.friend = await standAt(-234, 234)
await standAt(-48, 48)
await p.evaluate(() => (window as any).__ather.tp(-48, 48, Math.PI * 0.75)); await sleep(1500)
try { await p.screenshot({ path: `${out}/cluster-2-lane.png` }) } catch { /* slow frame */ }
await standAt(0, 10)
await p.keyboard.press('KeyC'); await sleep(900)
res.menu = await p.evaluate(() => !!document.querySelector('[data-panel="cluster"] button[aria-label="close"]'))
try { await p.screenshot({ path: `${out}/cluster-3-menu.png` }) } catch { /* slow frame */ }
console.log(JSON.stringify(res))
const onPlot = (r: any) => r.zone === 'plot'
const near = (r: any, x: number, z: number) => Math.hypot(r.x - x, r.z - z) < 6
const pass = !near(res.soloOff, -117, 117) && [['lane', -58, 58], ['bridge', -83, 83], ['middle', -117, 117], ['friend', -234, 234]].every(([k, x, z]) => onPlot(res[k as string]) && near(res[k as string], x as number, z as number)) && res.menu === true
console.log(pass ? 'PASS' : 'FAIL'); await b.close(); process.exit(pass ? 0 : 1)
