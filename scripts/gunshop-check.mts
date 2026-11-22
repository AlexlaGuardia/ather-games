// M81 s3a (11-22): the keeper has Kael's arms; Ashfeld racks 4 guns (no Lance) and deals the open lens for the Charred Rifle, bought here.
// THE GUN SHOP (BETA M14a): a fresh keeper walks to a town's gun shop door, E opens the panel, buys the Spitter (Marks drop by its price,
// the loadout holds it, the Character tab offers it), and a second buy is refused.
//   npx tsx scripts/gunshop-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { SIGIL_PRICE, SIGHT_PRICES } from '../src/app/shimmer/open/business/gun-shop'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/gunshop')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const door = doorsCached(R, 'ashfeld').find(d => d.key === 'front:gunshop:ashfeld')
if (!door) { console.log('FAIL: no gun shop door in Ashfeld'); process.exit(1) }
const PRICE = (await import('../src/app/shimmer/open/business/gun-shop')).GUN_PRICES.spitter
const at = shopDoorPoint(door.b)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()
const p = await ctx.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, unknown> = { url, door: door.key }
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
// 1 · a fresh keeper (the Star birth rune seeded), 1500 Marks, then the continent
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.evaluate(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
// M81 s3a: Kael's chest opened (the Charred Rifle + the Repeater), so Ashfeld's sight for the Charred Rifle can be bought
await p.evaluate(() => localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['charred-rifle', 'repeater'], primary: 'charred-rifle', secondary: 'repeater', kael: true,
  vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' })))
await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2000)
await p.keyboard.press('KeyW'); await sleep(500)
// 2 · to the gun shop door (movement hooks), then the real E
const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door.at.x, door.at.z); await sleep(6000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(5000)
res.reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:gunshop:ashfeld')
if (!res.reach) await done(false, 'FAIL: the gun shop door is not in reach')
await p.keyboard.press('KeyE')
res.panel = await poll(async () => !!(await p.$('[data-panel="gun-shop"]')), 15000)
await p.screenshot({ path: `${out}/gunshop.png` })
if (!res.panel) await done(false, 'FAIL: E did not open the gun shop')
res.title = await p.evaluate(() => (document.querySelector('[data-panel="gun-shop"]')?.textContent ?? '').slice(0, 60))
res.rows = await p.evaluate(() => [...document.querySelectorAll('[data-panel="gun-shop"] [data-gun]')].map(e => (e as HTMLElement).dataset.gun))
const purse = () => p.evaluate(() => { const m = (document.querySelector('[data-panel="gun-shop"]')?.textContent ?? '').match(/Purse · ([\d,]+) Marks/); return m ? Number(m[1].replace(/,/g, '')) : -1 })
const loadout = () => p.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.endsWith('open.loadout.v1')) return JSON.parse(localStorage.getItem(k)!) } return null })
res.marksBefore = await purse()
res.buy = await p.evaluate(() => { const bt = document.querySelector<HTMLButtonElement>('[data-panel="gun-shop"] [data-buy="spitter"] button'); if (!bt || bt.disabled) return false; bt.click(); return true })
await sleep(1000)
res.marksAfter = await purse()
const lo = await loadout(); res.guns = lo?.guns
res.msg = await p.evaluate(() => document.querySelector('[data-panel="gun-shop"] [data-shop-msg]')?.textContent ?? '')
// a second buy is refused: the button now reads Yours and is disabled
res.again = await p.evaluate(() => { const bt = document.querySelector<HTMLButtonElement>('[data-panel="gun-shop"] [data-buy="spitter"] button'); return { disabled: !!bt?.disabled, text: bt?.textContent } })
// M93 s2: the Unattuned sigil row under the guns: buying it takes SIGIL_PRICE and puts one in the bag
const bagCount = (id: string) => p.evaluate((id) => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.endsWith('open.inv.v1')) return ((JSON.parse(localStorage.getItem(k)!).slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, x) => t + (x?.id === id ? x.n : 0), 0) } return 0 }, id)
res.sigilRow = await p.evaluate(() => !!document.querySelector('[data-panel="gun-shop"] [data-buy="sigil_blank"] button'))
res.sigilsBefore = await bagCount('sigil_blank')
res.sigilBuy = await p.evaluate(() => { const bt = document.querySelector<HTMLButtonElement>('[data-panel="gun-shop"] [data-buy="sigil_blank"] button'); if (!bt || bt.disabled) return false; bt.click(); return true })
await sleep(1000)
res.marksAfterSigil = await purse(); res.sigilsAfter = await bagCount('sigil_blank')
await p.evaluate(() => document.querySelector('[data-panel="gun-shop"] [data-buy="sigil_blank"]')?.scrollIntoView({ block: 'center' })); await sleep(300)
await p.screenshot({ path: `${out}/gunshop-sigil.png` })
// M81 s3a: Ashfeld deals the open lens for the Charred Rifle: bought, it joins that gun's owned sights
res.sightRows = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-panel="gun-shop"] [data-sight-row]')].map(e => e.dataset.sightRow))
res.sightBuy = await p.evaluate(() => { const bt = document.querySelector<HTMLButtonElement>('[data-panel="gun-shop"] [data-buy="sight:charred-rifle:lens"] button'); if (!bt || bt.disabled) return false; bt.click(); return true })
await sleep(1000)
res.marksAfterSight = await purse()
res.charredOwned = (await loadout())?.fit?.['charred-rifle']?.owned ?? null
res.sightAgain = await p.evaluate(() => document.querySelector('[data-panel="gun-shop"] [data-buy="sight:charred-rifle:lens"] button')?.textContent ?? null)
await p.evaluate(() => document.querySelector('[data-panel="gun-shop"] [data-sight-row]')?.scrollIntoView({ block: 'center' })); await sleep(300)
await p.screenshot({ path: `${out}/gunshop-sights.png` })
// 3 · P: the Character tab offers the Spitter in a slot
await p.keyboard.press('Escape'); await sleep(500)
await p.keyboard.press('KeyP'); await sleep(1500)
const slotOpened = await p.evaluate(() => { for (const s of ['secondary', 'primary']) { const bt = document.querySelector<HTMLElement>(`[data-slot-id="${s}"] > button`); if (bt) { bt.click(); if (document.querySelector('[data-option="spitter"]')) return s; } } return null })
res.slotOpened = slotOpened; await sleep(500)
res.optionShown = !!(await p.$('[data-option="spitter"]'))
await p.screenshot({ path: `${out}/character.png` })
// the map marks (informational): the gun shop doors of uncovered towns
await p.keyboard.press('Escape'); await sleep(300); await p.keyboard.press('KeyM'); await sleep(1500)
res.mapMarks = await p.evaluate(() => document.querySelector('[data-map="base"]')?.getAttribute('data-shop-marks') ?? null)
const pass = !!res.reach && !!res.panel && res.title && /The gun shop/.test(String(res.title)) && (res.rows as string[]).length === 4 && !(res.rows as string[]).includes('charred-rifle') && !(res.rows as string[]).includes('lance')   // M81 s3a: Ashfeld's racks (gun-shop GUNSHOP_STOCK)
  && res.marksBefore === 1500 && res.buy === true && res.marksAfter === 1500 - PRICE && Array.isArray(res.guns) && (res.guns as string[]).includes('spitter')
  && (res.again as any).disabled === true && !!res.optionShown && errs.length === 0
  && JSON.stringify(res.sightRows) === JSON.stringify(['charred-rifle:lens']) && res.sightBuy === true && res.marksAfterSight === 1500 - PRICE - SIGIL_PRICE - SIGHT_PRICES.lens
  && Array.isArray(res.charredOwned) && (res.charredOwned as string[]).includes('lens') && res.sightAgain === 'Yours'
  && res.sigilRow === true && res.sigilBuy === true && res.marksAfterSigil === 1500 - PRICE - SIGIL_PRICE && (res.sigilsAfter as number) === (res.sigilsBefore as number) + 1
await done(pass, pass ? 'PASS' : 'FAIL')
