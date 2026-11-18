// THE COURSER YARD (BETA M14): a keeper walks to Ashfeld's courser yard door, the real E opens the yard, its racks hold the three part
// ladders (Core / Trim / Rune, three tiers each), Core I is bought (Marks drop by trade.ts' price, the garage now owns it), tier II
// waits on deeds, and the map carries the yard's mark. The purse is seeded (a fresh 1500 cannot afford a part: prices are trade.ts').
//   npx tsx scripts/courseryard-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { TIER_PRICE } from '../src/app/shimmer/open/trade'
import { LEDGER_SCALE } from '../src/app/shimmer/open/economy/prices'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/courseryard')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const KEY = 'front:courseryard:ashfeld', door = doorsCached(R, 'ashfeld').find(d => d.key === KEY)
if (!door) { console.log('FAIL: no courser yard door in Ashfeld'); process.exit(1) }
const SEED = 100_000, at = shopDoorPoint(door.b)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, unknown> = { url, door: KEY }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; console.log(JSON.stringify(res, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
const ledger = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{}'))
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
// seeded at the CURRENT scale: an older scale is a pre-ladder purse and migrateLedger multiplies it up (trade.ts)
await p.evaluate((m, sc) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:trade:trial-ledger', JSON.stringify({ marks: m, scale: sc, deeds: 0, active: null, owned: { core: 0, trim: 0, rune: 0 } })) }, SEED, LEDGER_SCALE)
await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2000)
await p.keyboard.press('KeyW'); await sleep(500)
const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door.at.x, door.at.z); await sleep(6000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(5000)
res.reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:courseryard:ashfeld')
if (!res.reach) await done(false, 'FAIL: the courser yard door is not in reach')
await p.keyboard.press('KeyE')
res.panel = await poll(async () => !!(await p.$('[data-panel="courser-yard"]')), 15000)
await p.screenshot({ path: `${out}/yard.png` })
if (!res.panel) await done(false, 'FAIL: E did not open the courser yard')
res.title = await p.evaluate(() => (document.querySelector('[data-panel="courser-yard"]')?.textContent ?? '').slice(0, 40))
res.parts = await p.evaluate(() => [...document.querySelectorAll('[data-panel="courser-yard"] [data-part]')].map(e => `${(e as HTMLElement).dataset.part}:${(e as HTMLElement).dataset.state}`))
res.marksBefore = (await ledger()).marks
res.buy = await p.evaluate(() => { const bt = document.querySelector<HTMLButtonElement>('[data-part="core-1"] button'); if (!bt || bt.disabled) return false; bt.click(); return true })
await sleep(1000)
const l = await ledger(); res.marksAfter = l.marks; res.owned = l.owned
res.core1 = await p.evaluate(() => (document.querySelector('[data-part="core-1"]') as HTMLElement | null)?.dataset.state)
res.core2 = await p.evaluate(() => (document.querySelector('[data-part="core-2"]') as HTMLElement | null)?.dataset.state)
await p.screenshot({ path: `${out}/yard-bought.png` })
await p.keyboard.press('Escape'); await sleep(300); await p.keyboard.press('KeyM'); await sleep(1500)
res.mapMarks = await p.evaluate(() => document.querySelector('[data-map="base"]')?.getAttribute('data-shop-marks') ?? null)
const parts = res.parts as string[]
const pass = !!res.reach && !!res.panel && /The courser yard/.test(String(res.title)) && parts.length === 9
  && parts.filter(x => /-1:buy$/.test(x)).length === 3 && res.marksBefore === SEED && res.buy === true && res.marksAfter === SEED - TIER_PRICE[1]
  && (res.owned as any)?.core === 1 && res.core1 === 'owned' && res.core2 === 'later' && String(res.mapMarks ?? '').includes(KEY) && errs.length === 0
await done(pass, pass ? 'PASS' : 'FAIL')
