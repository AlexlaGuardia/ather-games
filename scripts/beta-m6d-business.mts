// ── BETA M6d: DEEDS ARE TOLD, AS A FRESH KEEPER (reframed 2026-11-17 per Alex: prices stay, the first deed is a mid-game goal) ──
// A brand-new keeper (fresh profile, born through the real BE BORN tap, NO seeded Marks, NO tune) reaches a continent town and
// must be TOLD deeds exist: the journal (real J key) carries 'A place of your own' (business/deed-pointer.ts, lark's line).
// Then at the cheapest deed's door the real E opens the deed card, which shows the price against the purse ('You have N').
// Hooks are used for MOVEMENT (__drive.tp / footTp) and READING only; never to grant Marks or items. Buying stays out of
// scope (market-check.mts proves the buy on tune Marks).
//   PASS = journal line present after reaching town + deed card shows price and 'You have N' + 0 page errors.
//   npx tsx scripts/beta-m6d-business.mts [--url https://ather.games] [--out /tmp/m6d]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { allOffers } from '../src/app/shimmer/open/business/market'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m6d')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
// the cheapest deed on the whole continent (ties: the first); its door is where E reaches
const offers = allOffers(R).sort((a, b) => a.price - b.price)
const o = offers[0], at = shopDoorPoint(o.b)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()
const p = await ctx.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, unknown> = { url, cheapest: `${o.name} (${o.lot.id}) ${o.price}`, offers: offers.length }
const text = () => p.evaluate(() => (document.body?.innerText ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 900)).catch(() => '?')
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; console.log(JSON.stringify(res, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
const tapText = async (re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 60) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  await p.mouse.click(box.x, box.y); return true
}
// 1 · born through the real tap
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
res.born = await tapText(/^BE BORN/); await sleep(6000)
if (!res.born) await done(false, 'FAIL: BE BORN tap not found')
// 2 · to the continent (movement only: a straight load of its page, same profile) and out of the start card
await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2000)
await p.keyboard.press('KeyW'); await sleep(500)
res.purseAtArrival = await p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? 'null')?.marks ?? null)
// 3 · to the deed's door (hook = movement), then the real E
const b = o.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), o.lot.door.x, o.lot.door.z); await sleep(6000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(5000)
res.reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === o.lot.id)
if (!res.reach) await done(false, 'FAIL: the deed door is not in reach')
// 3b · TOLD: the journal (real J) now carries the deeds line
await sleep(1500)
await p.keyboard.press('KeyJ'); await sleep(1200)
res.journal = await text(); await p.screenshot({ path: `${out}/journal.png` })
res.told = /A place of your own/.test(String(res.journal))
await p.keyboard.press('KeyJ'); await sleep(800)
// 4 · the deed card through the real E: price against the purse
await p.keyboard.press('KeyE')
res.cardOpen = await poll(async () => !!(await p.$('[data-panel="deed-card"]')), 15000)
await p.screenshot({ path: `${out}/deed-card.png` })
if (!res.cardOpen) await done(false, 'FAIL: E did not open the deed card')
res.card = await text()
const purse = await p.evaluate(() => Number(document.querySelector('[data-panel="deed-card"] [data-marks]')?.textContent?.replace(/[^0-9]/g, '')))
res.purse = purse; res.price = o.price
const card = String(res.card)
res.priceVsPurse = purse >= o.price ? /Buy for/.test(card) : new RegExp(`You have ${Math.floor(purse)}`).test(card) && card.includes(String(o.price))
const pass = !!res.told && !!res.priceVsPurse && errs.length === 0
await done(pass, pass ? 'PASS' : `FAIL: told=${res.told} priceVsPurse=${res.priceVsPurse} pageErrors=${errs.length}`)
