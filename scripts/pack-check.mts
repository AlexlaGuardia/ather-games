// ── Check for the pack: Journal / Bag / Character (2026-11-15, play lane) ──────────────────────────────────────
// Opens the pack on the continent and the Ather, walks the three tabs with the header arrows, opens a journal line,
// sets it active, swaps a primary in the character tab. Screenshots to --out.   npx tsx scripts/pack-check.mts [--url] [--out]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 180000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: Record<string, unknown> = {}
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`${url}/shimmer/open/continent?hour=13`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction('!!window.__drive && !!window.__range', { timeout: 180000 })
await sleep(3000); await p.keyboard.press('KeyW'); await sleep(2000)
// stand in the gun shop so its journal line points somewhere close (the beacon + trail show)
const shop = await p.evaluate('window.__range.shop()') as any
await p.evaluate(`window.__drive.footTp(${shop.line.x + shop.down.x * -4}, ${shop.line.z + shop.down.z * -4}, ${Math.atan2(shop.down.x, shop.down.z)}, -0.1)`); await sleep(2500)
const panel = () => p.evaluate(() => document.querySelector('[data-panel^="pack-"]')?.getAttribute('data-panel') ?? null)
await p.keyboard.press('KeyJ'); await sleep(900)
res.openJ = await panel()
res.lines = await p.evaluate(() => [...document.querySelectorAll('[data-entry]')].map(e => e.getAttribute('data-entry')))
await p.click('[data-entry="gun-shop"] button'); await sleep(500)
const setActive = await p.$$('[data-entry="gun-shop"] button')
for (const btn of setActive) { const t = await btn.evaluate(e => e.textContent); if (t?.includes('Set active')) { await btn.click(); break } }
await sleep(600)
res.activeMark = await p.evaluate(() => document.querySelector('[data-entry="gun-shop"]')?.textContent?.includes('✦') ?? false)
await p.screenshot({ path: `${out}/pack-1-journal.png` })
await p.click('[data-pack-go="bag"]'); await sleep(700); res.right = await panel()
await p.screenshot({ path: `${out}/pack-2-bag.png` })
await p.click('[data-pack-go="character"]'); await sleep(700); res.right2 = await panel()
await p.click('[data-slot-id="primary"] > button'); await sleep(500)
res.primaryOptions = await p.evaluate(() => [...document.querySelectorAll('[data-slot-id="primary"] [data-option]')].map(e => e.getAttribute('data-option')))
await p.click('[data-slot-id="primary"] [data-option="lance"]'); await sleep(500)
res.primaryNow = await p.evaluate(() => JSON.parse(localStorage.getItem('open.loadout.v1') ?? '{}').primary)
await p.click('[data-slot-id="tactical"] > button'); await sleep(400)
await p.screenshot({ path: `${out}/pack-3-character.png` })
await p.keyboard.press('ArrowRight'); await sleep(600); res.arrowWraps = await panel()
await p.keyboard.press('Escape'); await sleep(600); res.closed = (await panel()) === null
await sleep(1500); await p.screenshot({ path: `${out}/pack-4-guide.png` })
// the Ather: same pack, and its own journal line (the nearest infected node)
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction('!!window.__ather?.state', { timeout: 180000 }); await sleep(2500)
await p.keyboard.press('KeyP'); await sleep(900); res.atherP = await panel()
await p.keyboard.press('KeyJ'); await sleep(900); res.atherJ = await panel()
res.atherLines = await p.evaluate(() => [...document.querySelectorAll('[data-entry]')].map(e => e.getAttribute('data-entry')))
await p.screenshot({ path: `${out}/pack-5-ather-journal.png` })
res.errors = errs.slice(0, 5)
console.log(JSON.stringify(res, null, 1))
await b.close()
