// ── Prod check for the streamed Wilds (2026-11-15, hub) ───────────────────────────────────────────────────
// Lands at Greg's waymark, then walks (teleports in short hops) across tile seams into the neighbours: the keeper
// must stay in the Wilds, standing on real ground (never the fall home), and the minimap must keep drawing.
//   npx tsx scripts/stream-check.mts [--url] [--out]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 120000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await b.newPage()
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))   // a fresh profile is born first (birth-gate.tsx); seed a rune so the ritual does not take the screen
await p.setViewport({ width: 1100, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
// arrive at Greg's waymark by the page's own ?waymark= (11-21 sweep: a travel() sent before the Wilds index lands only
// toasts 'still loading', so the zone never turned 'wilds' and the wait timed out; same race rinning-check fixed 11-20)
await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(3000)
const where = () => p.evaluate(() => { const A = (window as any).__ather, s = A.state(); return { zone: A.zone(), x: Math.round(s.px), z: Math.round(s.pz), y: +s.py.toFixed(1) } })
const hop = async (x: number, z: number) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, -Math.PI / 2), x, z); await sleep(3500); return where() }
const path: [number, number][] = [[-300, 300], [-470, 300], [-530, 300], [-700, 300], [-700, 470], [-700, 540], [-1000, 600]]
const trail: unknown[] = []
for (const [x, z] of path) trail.push(await hop(x, z))
try { await p.screenshot({ path: `${out}/stream-1.png` }) } catch { /* slow */ }
console.log(JSON.stringify({ trail, errs }))
const pass = trail.every((t: any, k) => t.zone === 'wilds' && Math.hypot(t.x - path[k][0], t.z - path[k][1]) < 8 && t.y > -5) && errs.length === 0
console.log(pass ? 'PASS' : 'FAIL'); await b.close(); process.exit(pass ? 0 : 1)
