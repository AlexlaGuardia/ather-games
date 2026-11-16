// Check: walk up to Rune Hold's mine on the continent, open its deed, buy it, and see it survive a reload.
// npx tsx scripts/market-check.mts   (URL= to point elsewhere). Writes /tmp/market-<n>.png
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { marketFor } from '../src/app/shimmer/open/business/market'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const o = marketFor(R, 'rune-hold').find(x => x.kind === 'mine')!
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
await p.setViewport({ width: 960, height: 600 })
let fails = 0, shot = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
const stand = async () => {
  const b = o.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), o.lot.door.x, o.lot.door.z); await wait(6000)
  // back off the door 6 m and face the house: the whole front, board and all, in view
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.12), o.lot.door.x + fx * 4, o.lot.door.z + fz * 4, yaw); await wait(5000)
  await p.screenshot({ path: `/tmp/market-${++shot}.png` })
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), o.lot.door.x, o.lot.door.z, yaw)
}
console.log(`target: ${o.name} (${o.lot.id}) ${o.price} Marks`)
await p.goto(`${URL}/shimmer/open/continent?hour=12&tune=1`, { waitUntil: 'load', timeout: 240000 })
await p.evaluate(() => { localStorage.removeItem('open.tycoon.v1') }); await p.reload({ waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await wait(2000)
await p.keyboard.press('KeyW'); await wait(500)        // past the start card
await stand()
ok(await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === o.lot.id), 'the mine is in reach at its door')
const offers = await p.evaluate(() => (window as any).__market.offers().map((x: any) => x.id))
ok(offers.includes(o.lot.id), `Rune Hold's market is dressed (${offers.length} offers near)`)
await p.keyboard.press('BracketRight'); await wait(800)
await p.keyboard.press('KeyE')
ok(await poll(async () => !!(await p.$('[data-panel="deed-card"]')), 15000), 'E opens the deed card')
await p.screenshot({ path: `/tmp/market-${++shot}.png` })
const before = await p.evaluate(() => Number(document.querySelector('[data-panel="deed-card"] [data-marks]')?.textContent?.replace(/[^0-9]/g, '')))
const dis = await p.evaluate(() => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-panel="deed-card"] button')].find(b => /^Buy/.test(b.textContent ?? '')); b?.click(); return b ? b.disabled : null })
ok(dis === false, 'the Buy button is live with the tune Marks'); await wait(1500)
const owned = await p.evaluate(() => (window as any).__tycoon.t.owned.map((x: any) => x.lotId))
ok(owned.includes(o.lot.id), 'bought: the tycoon owns it')
const after = await p.evaluate(() => Number(document.querySelector('[data-panel="deed-card"] [data-marks]')?.textContent?.replace(/[^0-9]/g, '')))
ok(before - after === o.price, `paid ${before - after} (price ${o.price})`)
await p.keyboard.press('Escape'); await wait(500)
await p.evaluate(() => document.querySelector<HTMLElement>('[data-panel="deed-card"] button[aria-label]')?.click()); await wait(500)
await stand()
await p.reload({ waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__tycoon?.t, { timeout: 240000 })
ok((await p.evaluate(() => (window as any).__tycoon.t.owned.map((x: any) => x.lotId))).includes(o.lot.id), 'still owned after a reload')
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{}').marks)
ok(saved >= after && saved - after <= 400, `the purse kept the spend (${saved}; a minute or two of the mine's 40/min may land between buy and reload)`)
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `market-check: ${fails} FAIL` : 'market-check: PASS')
process.exit(fails ? 1 : 0)
