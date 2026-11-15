// ── Prod check for the raw spread + tuning mode (2026-11-15, hub) ──────────────────────────────────────────
// ?tune=1: [ clears every node, ] skips game days; proves the grey comes back over game time and that the clock
// survives a reload (the skew is kept). Fresh profile.   npx tsx scripts/spread-check.mts [--url]
import puppeteer from 'puppeteer-core'
const url = (() => { const i = process.argv.indexOf('--url'); return i > 0 ? process.argv[i + 1] : 'https://ather.games' })()
const b = await puppeteer.launch({ protocolTimeout: 120000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await b.newPage()
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))   // a fresh profile is born first (birth-gate.tsx); seed a rune so the ritual does not take the screen; await p.setViewport({ width: 1100, height: 680 })
const go = async () => {
  await p.goto(`${url}/shimmer/open/ather?tune=1&hour=13`, { waitUntil: 'load', timeout: 120000 })
  await p.waitForFunction(() => !!(window as any).__ather?.spread?.(), { timeout: 120000, polling: 500 })
}
await go()
const grey = () => p.evaluate(() => { const A = (window as any).__ather, s = A.spread(); return { clean: s.clean.length, at: s.at } })
const res: Record<string, unknown> = { start: await grey() }
await p.keyboard.press('BracketLeft'); await sleep(800)
res.cleared = await grey()
const curve: number[] = []
for (let w = 0; w < 8; w++) { await p.keyboard.down('Shift'); await p.keyboard.press('BracketRight'); await p.keyboard.up('Shift'); await sleep(250); curve.push((await grey()).clean) }
res.cleanEvery5Days = curve
const before = await grey()
await go()
res.afterReload = await grey()
const msg = await p.evaluate(() => [...document.querySelectorAll('[data-hud="messages"] > div')].map(d => d.textContent))
res.messages = msg
console.log(JSON.stringify(res))
const c0 = (res.cleared as any).clean
const pass = c0 > 20 && curve[curve.length - 1] < c0 && (res.afterReload as any).clean <= before.clean && (res.afterReload as any).at >= before.at
console.log(pass ? 'PASS' : 'FAIL'); await b.close(); process.exit(pass ? 0 : 1)
