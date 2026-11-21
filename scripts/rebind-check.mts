// ── Check for open-world key rebinding (2026-11-15, play lane) ─────────────────────────────────────────────────
// Options › Controls: bind JUMP to F (it swaps with F's job), close; F now jumps, Space does not; reset puts it back.
//   npx tsx scripts/rebind-check.mts [--url] [--out]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 180000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const until = async (f: () => Promise<boolean>, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(120) } return false }
const res: Record<string, unknown> = {}
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'domcontentloaded', timeout: 180000 })
// a born keeper: an unborn one gets the birth gate (327ea639), which freezes the walker and keeps O for itself
await p.evaluate(() => { localStorage.removeItem('open.keymap.v1'); localStorage.setItem('ather:shimmer:birthRune', 'star') })
await p.reload({ waitUntil: 'load', timeout: 180000 })
await p.waitForFunction('!!window.__ather?.state', { timeout: 180000 }); await sleep(3000)
const cv = await p.$('canvas:not([data-map])'); const bb = await cv!.boundingBox()
await p.mouse.click(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2); await sleep(1500)
const air = () => p.evaluate(() => (window as any).__ather.state().airborne as boolean)
// the walker samples held keys per FRAME and swiftshader runs ~2-3 fps: a press must be HELD across frames
const hold = async (code: any) => { await p.keyboard.down(code); await sleep(900); await p.keyboard.up(code) }
const settle = () => until(async () => !(await air()), 8000)
// baseline: Space jumps
await settle(); { const w = until(air, 4000); await hold('Space'); res.spaceJumpsBefore = await w }; await settle()
// bind jump → F in Options › Controls
await p.keyboard.press('KeyO'); await until(() => p.evaluate(() => !!document.querySelector('[data-panel="options"]')))
await p.evaluate(() => { const t = [...document.querySelectorAll('[data-panel="options"] button')].find(b => b.textContent === 'Controls') as HTMLButtonElement; t?.click() })
await until(() => p.evaluate(() => !!document.querySelector('[data-bind="Space"]')))
await p.click('[data-bind="Space"]'); await sleep(300)
res.listening = await p.evaluate(() => document.querySelector('[data-bind="Space"]')?.textContent?.includes('press a key'))
await p.keyboard.press('KeyF'); await sleep(400)
res.saved = await p.evaluate(() => JSON.parse(localStorage.getItem('open.keymap.v1') ?? '{}').bound)
res.rowShowsF = await p.evaluate(() => document.querySelector('[data-bind="Space"]')?.textContent)
await p.screenshot({ path: `${out}/rebind-1-controls.png` })
await p.keyboard.press('KeyO'); await until(() => p.evaluate(() => !document.querySelector('[data-panel="options"]')))
await p.mouse.click(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2); await sleep(1200); await settle()
{ const w = until(air, 4000); await hold('KeyF'); res.fJumps = await w }; await settle()
{ const w = until(air, 3000); await hold('Space'); res.spaceStillJumps = await w }; await settle()
// reset
await p.evaluate(() => document.exitPointerLock()); await sleep(300)
await p.keyboard.press('KeyO'); await until(() => p.evaluate(() => !!document.querySelector('[data-panel="options"]')))
await p.evaluate(() => { const t = [...document.querySelectorAll('[data-panel="options"] button')].find(b => b.textContent === 'Controls') as HTMLButtonElement; t?.click() })
await until(() => p.evaluate(() => !!document.querySelector('[data-bindings]')))
await p.evaluate(() => { const b = [...document.querySelectorAll('[data-bindings] button')].find(x => x.textContent?.includes('Reset keys')) as HTMLButtonElement; b?.click() }); await sleep(300)
res.resetEmpty = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('open.keymap.v1') ?? '{"bound":{}}').bound).length === 0)
res.errors = errs.slice(0, 5)
console.log(JSON.stringify(res, null, 1))
await b.close()
