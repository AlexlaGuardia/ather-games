// ── Check for the Passage vessel counter (2026-11-15, play lane) ───────────────────────────────────────────────
// A Star-born keeper with the starting 60 Marks: walk to the counter, E opens it; the birth/lane items light, the rest
// grey; an off-lane buy asks first (tooltips on); a buy spends Marks and dear prices turn red; the bought bracelet shows
// in the Character tab; with tooltips off an off-lane buy goes straight through.   npx tsx scripts/vessel-check.mts [--url] [--out]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 180000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: Record<string, unknown> = {}
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`${url}/shimmer/open/continent?hour=13`, { waitUntil: 'domcontentloaded', timeout: 180000 })
await p.evaluate(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.loadout.v1'); localStorage.removeItem('open.settings.v1') })
await p.reload({ waitUntil: 'load', timeout: 180000 })
await p.waitForFunction('!!window.__drive && !!window.__range', { timeout: 180000 })
// ★ 11-18: a fresh keeper now arrives stopped in Ashfeld, where E from the seat opens the Co. board. A keeper walks to the
// counter, so GET OUT first (F, the real exit) and only then step to the counter; footTp alone left the seat's E live.
await sleep(3000); await p.mouse.click(640, 380).catch(() => {}); await sleep(500); await p.keyboard.press('KeyF'); await sleep(2500)
// the counter: the 'vessels' prop, from the cave via the range probe's shop (same cave) — stand 1.4 m off it
const counter = await p.evaluate(() => { const c = (window as any).__vesselCounter; return c ? c() : null }) as any
res.counterFound = !!counter
if (counter) {
  await p.evaluate(`window.__drive.footTp(${counter.x + 1.4}, ${counter.z}, ${Math.atan2(1.4, 0)}, -0.2)`); await sleep(2500)
  // 11-18: on a loaded box the counter's reach lags a few frames; wait for ITS OWN line before E, then give the panel time to open
  for (let t = Date.now(); Date.now() - t < 20000 && !(await p.evaluate(() => /E at the counter/i.test(document.body.innerText))); ) await sleep(400)
  await p.keyboard.press('KeyE')
  for (let t = Date.now(); Date.now() - t < 10000 && !(await p.$('[data-panel="vessel-shop"]')); ) await sleep(300)
}
const open = () => p.evaluate(() => !!document.querySelector('[data-panel="vessel-shop"]'))
res.opens = await open()
const fits = () => p.evaluate(() => [...document.querySelectorAll('[data-shelf]')].map(e => ({ k: e.getAttribute('data-shelf'), fit: e.getAttribute('data-fit'), dear: e.hasAttribute('data-dear') })))
const f0 = await fits()
res.items = f0.length
res.birth = f0.filter(f => f.fit === 'birth').map(f => f.k); res.lane = f0.filter(f => f.fit === 'lane').map(f => f.k); res.off = f0.filter(f => f.fit === 'off').length
await p.screenshot({ path: `${out}/vessel-1-shelf.png` })
// an off-lane buy asks first
const off = f0.find(f => f.fit === 'off')!.k
await p.click(`[data-shelf="${off}"]`); await sleep(600)
res.warnShown = await p.evaluate(() => !!document.querySelector('[data-warn]'))
await p.screenshot({ path: `${out}/vessel-2-warn.png` })
await p.evaluate(() => { const b = [...document.querySelectorAll('[data-warn] button')].find(x => x.textContent?.includes('Leave')) as HTMLButtonElement; b?.click() }); await sleep(400)
// buy a birth item: Marks drop, the rest go dear
await p.click(`[data-shelf="${(res.birth as string[])[0]}"]`); await sleep(800)
res.marksAfter = await p.evaluate(() => document.querySelector('[data-marks]')?.textContent)
const f1 = await fits()
res.dearAfter = f1.filter(f => f.dear).length
await p.screenshot({ path: `${out}/vessel-3-after-buy.png` })
res.owned = await p.evaluate(() => JSON.parse(localStorage.getItem('open.loadout.v1') ?? '{}').vessels?.map((v: any) => `${v.kind}:${v.word}`))
await p.keyboard.press('Escape'); await sleep(600)
res.closed = !(await open())
// the Character tab lists the new bracelet under Tactical
await p.keyboard.press('KeyP'); await sleep(800)
await p.click('[data-slot-id="tactical"] > button'); await sleep(500)
res.tacticalOptions = await p.evaluate(() => [...document.querySelectorAll('[data-slot-id="tactical"] [data-option]')].map(e => e.textContent))
await p.screenshot({ path: `${out}/vessel-4-character.png` })
// tooltips off (the pack's gear): an off-lane buy goes straight through, no warning
await p.click('[data-pack-options]'); await sleep(400); await p.waitForSelector('[data-setting="tooltips"]', { timeout: 10000 }); await p.click('[data-setting="tooltips"]')   // 11-15: Options ported from voxel, the toggle is data-setting now; await sleep(300)
res.tooltipsOff = await p.evaluate(() => JSON.parse(localStorage.getItem('open.settings.v1') ?? '{}').tooltips === false)
await p.keyboard.press('Escape'); await sleep(500)
await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('open.trade.v1') ?? 'null'); return l })
await p.keyboard.press('KeyE'); await sleep(900)
res.reopened = await open()
const glove = (await fits()).find(f => f.k === 'g-blank')
res.gloveDear = glove?.dear
res.errors = errs.slice(0, 5)
console.log(JSON.stringify(res, null, 1))
await b.close()
