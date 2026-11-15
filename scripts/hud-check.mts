// ── Prod check for the open world's ONE HUD + menu mouse (2026-11-15, hub) ─────────────────────────────────
// Desktop: the Ather plot, the Wilds, the continent; each must show the compass, the hearth hotbar and a minimap.
// Pointer lock: click the canvas (lock), open the fold map (must release), close it with its own key M (must relock).
// Phone: the Ather in the phone layout. Screenshots to --out.   npx tsx scripts/hud-check.mts [--url] [--out dir]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 120000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: Record<string, unknown> = {}
const parts = (p: any) => p.evaluate(() => ({
  compass: !!document.querySelector('[data-hud="compass"]'),
  minimap: !!document.querySelector('canvas[data-map="mini"]'),
  hotbar: document.querySelectorAll('[data-hud="hotbar"] .rounded-\\[11px\\]').length,
  hotbarTopLeft: (() => { const h = document.querySelector('[data-hud="hotbar"]'); if (!h) return false; const r = h.getBoundingClientRect(); return r.top < 40 && r.left < 40 })(),
  messages: [...document.querySelectorAll('[data-hud="messages"] > div')].map(d => d.textContent),
  tools: document.querySelectorAll('.w-14.h-14').length,
}))
// desktop
const p = await b.newPage()
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))   // a fresh profile is born first (birth-gate.tsx); seed a rune so the ritual does not take the screen; await p.setViewport({ width: 1280, height: 760 })
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 })
await sleep(2500)
res.plot = await parts(p)
// pointer lock round trip
const cv = await p.$('canvas:not([data-map])')
const bb = await cv!.boundingBox()
await p.mouse.click(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2)
await sleep(700)
const lock0 = await p.evaluate(() => !!document.pointerLockElement)
await p.keyboard.press('KeyM'); await sleep(700)
const lockOpen = await p.evaluate(() => !!document.pointerLockElement)
await p.keyboard.press('KeyM'); await sleep(900)
const lockClosed = await p.evaluate(() => !!document.pointerLockElement)
res.lock = { clickLocks: lock0, menuFrees: !lockOpen, closeRelocks: lockClosed }
await p.evaluate(() => document.exitPointerLock()); await sleep(400)
await p.screenshot({ path: `${out}/hud-1-plot.png` })
await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 90000 })
await sleep(4000)
await p.mouse.click(640, 380); await sleep(600)
await p.mouse.wheel({ deltaY: 120 }); await sleep(500)
res.wilds = await parts(p)
await p.evaluate(() => document.exitPointerLock()); await sleep(300)
await p.screenshot({ path: `${out}/hud-2-wilds.png` })
await p.goto(`${url}/shimmer/open/continent?hour=13`, { waitUntil: 'load', timeout: 120000 })
await sleep(6000); await p.keyboard.press('KeyW'); await sleep(5000)
res.continent = await parts(p)
await p.screenshot({ path: `${out}/hud-3-continent.png` })
await p.close()
// phone
const q = await b.newPage()
await q.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))   // a fresh profile is born first (birth-gate.tsx); seed a rune so the ritual does not take the screen
await q.emulate({ viewport: { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
await q.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 120000 })
await q.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 })
await sleep(2500); await q.touchscreen.tap(420, 200); await sleep(800)
await q.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
await q.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 90000 }); await sleep(4000)
res.phone = await parts(q)
await q.screenshot({ path: `${out}/hud-4-phone.png` })
console.log(JSON.stringify(res))
await b.close()
