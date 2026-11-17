// Check: the canon storefronts' doors on the continent. Walk to each step stone, E, and see that shop's panel:
// the Bookstore (go in), a closed shop (the Kindled Mug), the Travelers Station (the Starforge ticket boards you).
// npx tsx scripts/shop-doors-check.mts   (URL= to point elsewhere). Writes /tmp/shop-<n>.png
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { cachedPlan } from '../src/app/shimmer/open/foot-solids'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const front = (town: string, id: string) => cachedPlan(R, meta.places.findIndex(p => p.id === town)).buildings.find(b => b.front === id)!
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
await p.goto(`${URL}/shimmer/open/continent?hour=19`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await wait(2000)
await p.keyboard.press('KeyW'); await wait(500)
const visit = async (town: string, id: string) => {
  const b = front(town, id), at = shopDoorPoint(b), fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), at.x, at.z); await wait(6000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.1), at.x + fx * 5, at.z + fz * 5, yaw); await wait(5000)
  await p.screenshot({ path: `/tmp/shop-${++shot}.png` })
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 1, at.z + fz * 1, yaw)
  ok(await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === `front:${id}`), `${id}: in reach at its step`)
  await p.keyboard.press('KeyE')
  ok(await poll(async () => !!(await p.$(`[data-panel="shop-panel"] [data-shop="${id}"]`)), 15000), `${id}: E opens its panel`)
  await p.screenshot({ path: `/tmp/shop-${++shot}.png` })
}
await visit('rune-hold', 'bookstore')
await p.evaluate(() => document.querySelector<HTMLElement>('[data-panel="shop-panel"] button[aria-label]')?.click()); await wait(800)
await visit('rune-hold', 'kindled-mug')
ok(!!(await p.$('[data-shop="kindled-mug"][data-closed]')), 'the Kindled Mug says closed for now')
await p.evaluate(() => document.querySelector<HTMLElement>('[data-panel="shop-panel"] button[aria-label]')?.click()); await wait(800)
await visit('citadel', 'enchant-temple')
ok(!!(await p.$('[data-shop="enchant-temple"][data-closed]')) && (await p.$$('[data-counter]')).length === 2, 'the Enchant Temple (Citadel): the twins\' two counters, closed for now')
await p.evaluate(() => document.querySelector<HTMLElement>('[data-panel="shop-panel"] button[aria-label]')?.click()); await wait(800)
await visit('rune-hold', 'station')
ok((await p.$$('[data-soon]')).length === 2 && !!(await p.$('[data-hero="starforge"]')) && !!(await p.$('[data-card="season-crucible"]')) && !!(await p.$('[data-card="expedition"]')), 'the Station: Alex\'s ship menu, the Starforge + Season Crucible + Season Expedition over Expedition')
const before = await p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{"marks":1500}').marks ?? 1500)
// Nolmir is shelved (back-room): unsigned, the line must say so and take nothing; as the owner (OWNER=1 with a cookie) it boards
const closed = await poll(async () => !!(await p.$('[data-starforge-closed]')), 10000)
await p.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>('[data-hero="starforge"] button')].find(b => /Ticket/.test(b.textContent ?? ''))?.click()); await wait(2500)
const after = await p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{"marks":1500}').marks ?? 1500)
ok(closed && before === after && p.url().includes('/shimmer/open/continent'), `public: the Starforge line says not running, no charge, no trip (${before} -> ${after})`)
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `shop-doors-check: ${fails} FAIL` : 'shop-doors-check: PASS')
process.exit(fails ? 1 : 0)
