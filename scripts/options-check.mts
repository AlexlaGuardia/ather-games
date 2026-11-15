// ── Check for the open world's Options (2026-11-15, play lane) ─────────────────────────────────────────────────
// The Esc that frees the mouse must NOT open Options; the next Esc does. O toggles it; the pack's gear opens it; a
// slider writes the setting; the Controls tab lists the keys. Continent + Ather.   npx tsx scripts/options-check.mts [--url] [--out]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 180000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: Record<string, unknown> = {}
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
// a born keeper: an unborn one meets the birth ritual first (birth-gate.tsx), which rightly takes the screen and the keys
await p.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star') } catch {} })
// ⚠ swiftshader runs these pages at 2-3 fps: POLL for each state, never trust a fixed sleep (they flaked both halves)
const until = async (f: () => Promise<boolean>, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(150) } return false }
const isOpen = () => p.evaluate(() => !!document.querySelector('[data-panel="options"]'))
const locked = () => p.evaluate(() => !!document.pointerLockElement)
for (const where of ['continent', 'ather'] as const) {
  const r: Record<string, unknown> = {}
  await p.goto(`${url}/shimmer/open/${where}?hour=13`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(where === 'continent' ? '!!window.__drive' : '!!window.__ather?.state', { timeout: 180000 })
  await sleep(3000)
  if (where === 'continent') {
    // stand on foot in the gun shop: away from any town's Co. board (an open board rightly keeps O and Esc for itself)
    await p.keyboard.press('KeyW'); await sleep(1500)
    const shop = await p.evaluate('window.__range && window.__range.shop()') as any
    await p.evaluate(`window.__drive.footTp(${shop.line.x - shop.down.x * 3}, ${shop.line.z - shop.down.z * 3}, 0, 0)`)
    r.boardOpen = await until(() => p.evaluate(() => !document.querySelector('[data-panel="board"]')), 4000).then(x => !x)
    await sleep(1500)
  }
  const cv = await p.$('canvas:not([data-map])'); const bb = await cv!.boundingBox()
  await p.mouse.click(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2)
  r.lockedFirst = await until(locked); await sleep(1500)   // a player does not Esc within ms of clicking in; freeing it that fast races the page's own click-to-lock
  // ⚠ headless Chrome does not release pointer lock on a SYNTHETIC Esc (a real one does: the browser exits the lock and
  // delivers the key in the same beat). Emulate that order, which is the case the grace window exists for.
  await p.evaluate(() => document.exitPointerLock()); await p.keyboard.press('Escape')
  await until(async () => !(await locked())); await sleep(1500)   // give a wrong open time to show
  r.escFreesOnly = !(await locked()) && !(await isOpen())
  await p.keyboard.press('Escape')
  r.secondEscOpens = await until(isOpen)
  await p.keyboard.press('Escape'); r.escCloses = await until(async () => !(await isOpen()))
  await p.keyboard.press('KeyO'); r.oOpens = await until(isOpen)
  if (where === 'continent') {
    // Video tab, drag FOV: the slider writes the setting
    await p.evaluate(() => { const t = [...document.querySelectorAll('[data-panel="options"] button')].find(b => b.textContent === 'Video') as HTMLButtonElement; t?.click() })
    await until(() => p.evaluate(() => !!document.querySelector('[data-panel="options"] input[type=range]')))
    await p.evaluate(() => { const i = document.querySelector('[data-panel="options"] input[type=range]') as HTMLInputElement; if (!i) return; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; set.call(i, '90'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })) }); await sleep(400)
    r.fovSaved = await p.evaluate(() => JSON.parse(localStorage.getItem('open.settings.v1') ?? '{}').fov)
    await p.screenshot({ path: `${out}/options-1-video.png` })
    await p.evaluate(() => { const t = [...document.querySelectorAll('[data-panel="options"] button')].find(b => b.textContent === 'Controls') as HTMLButtonElement; t?.click() })
    await until(() => p.evaluate(() => !!document.querySelector('[data-keys]')))
    r.keysListed = await p.evaluate(() => document.querySelectorAll('[data-keys] > div').length)
    await p.screenshot({ path: `${out}/options-2-controls.png` })
    await p.evaluate(() => { const b = [...document.querySelectorAll('[data-panel="options"] button')].find(x => x.textContent?.includes('Reset')) as HTMLButtonElement; b?.click() }); await sleep(300)
  }
  await p.keyboard.press('KeyO'); r.oCloses = await until(async () => !(await isOpen()))
  // the pack's gear
  await p.keyboard.press('KeyI'); await until(() => p.evaluate(() => !!document.querySelector('[data-pack-options]')))
  await p.click('[data-pack-options]')
  r.gearOpens = (await until(isOpen)) && !(await p.evaluate(() => !!document.querySelector('[data-panel^="pack-"]')))
  await p.keyboard.press('Escape'); await sleep(500)
  res[where] = r
}
res.errors = errs.slice(0, 5)
console.log(JSON.stringify(res, null, 1))
await b.close()
