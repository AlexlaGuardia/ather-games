// THE COURSER LOTS (BETA M14 whole coursers; makes + models RULED 11-18): at Rune Hold's courser lot (Ashcombe) the real E opens
// the lot with the Dray + the Tally; the Dray is bought (Marks drop by its price, the fleet owns it, still driving the Darter);
// back in the courser, G opens the garage, the Dray is picked, and the live drive feel CHANGES (top speed) and the garage names it;
// the map carries the lot's mark. The purse is seeded at the current LEDGER_SCALE (a fresh 1500 cannot afford a courser).
//   npx tsx scripts/courserlot-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { MODELS } from '../src/app/shimmer/open/business/courser-lot'
import { LEDGER_SCALE } from '../src/app/shimmer/open/economy/prices'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/courserlot')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const KEY = 'front:courserlot:rune-hold', door = doorsCached(R, 'rune-hold').find(d => d.key === KEY)
if (!door) { console.log('FAIL: no courser lot door in Rune Hold'); process.exit(1) }
const DRAY = MODELS.find(m => m.id === 'dray')!
const SEED = 100_000, at = shopDoorPoint(door.b)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, unknown> = { url, door: KEY }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; console.log(JSON.stringify(res, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
const ledger = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{}'))
const fleet = () => p.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.endsWith('open.fleet.v1')) return JSON.parse(localStorage.getItem(k)!) } return null })
const top = () => p.evaluate(() => (window as any).__drive.tune().top as number)
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.evaluate((m, sc) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:trade:trial-ledger', JSON.stringify({ marks: m, scale: sc, deeds: 0, active: null, owned: { core: 0, trim: 0, rune: 0 } })) }, SEED, LEDGER_SCALE)
await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2000)
res.topDarter = await top()
await p.keyboard.press('KeyW'); await sleep(500)
const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door.at.x, door.at.z); await sleep(6000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(5000)
res.reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:courserlot:rune-hold')
if (!res.reach) await done(false, 'FAIL: the courser lot door is not in reach')
await p.keyboard.press('KeyE')
res.panel = await poll(async () => !!(await p.$('[data-panel="courser-lot"]')), 15000)
await p.screenshot({ path: `${out}/lot.png` })
if (!res.panel) await done(false, 'FAIL: E did not open the courser lot')
res.make = await p.evaluate(() => (document.querySelector('[data-panel="courser-lot"] [data-make]') as HTMLElement | null)?.dataset.make)
res.models = await p.evaluate(() => [...document.querySelectorAll('[data-panel="courser-lot"] [data-model]')].map(e => (e as HTMLElement).dataset.model))
res.buy = await p.evaluate(() => { const bt = document.querySelector<HTMLButtonElement>('[data-panel="courser-lot"] [data-buy="dray"] button'); if (!bt || bt.disabled) return false; bt.click(); return true })
await sleep(1000)
res.marksAfter = (await ledger()).marks
res.fleetAfterBuy = await fleet()
res.again = await p.evaluate(() => !!document.querySelector<HTMLButtonElement>('[data-panel="courser-lot"] [data-buy="dray"] button')?.disabled)
await p.evaluate(() => document.querySelector<HTMLElement>('[data-panel="courser-lot"] button[aria-label]')?.click()); await sleep(800)
// back in the courser: park it beside the keeper (tp moves the CAR, the keeper stays on foot), E gets in (M80), G = the garage
await p.evaluate((x, z) => (window as any).__drive.tp(x, z, 0, 0), at.x + fx * 3.5, at.z + fz * 3.5); await sleep(2500)
// M80 (11-22): E is the car now, and the door the crosshair is on keeps E (M60), so turn from the lot's door to the courser
await p.evaluate((cx: number, cz: number) => { const w = window as any, f = w.__drive.foot(); w.__drive.footTp(f.px, f.pz, Math.atan2(-(cx - f.px), -(cz - f.pz)), -0.1) }, at.x + fx * 3.5, at.z + fz * 3.5); await sleep(1200)
res.beforeE = await p.evaluate(() => { const w = window as any, f = w.__drive.foot(), c = w.__drive.state(); return { dist: Math.hypot(c.x - f.px, c.z - f.pz), dy: c.y - f.py, door: w.__market?.reach?.() ?? null, lotOpen: !!document.querySelector('[data-panel="courser-lot"]') } })
await p.keyboard.press('KeyE'); await sleep(2500)
res.onFootAfterF = await p.evaluate(() => { const f = (window as any).__drive.foot; return typeof f === 'function' ? f() : f })
await p.keyboard.press('KeyG'); await sleep(1500)
res.garagePanel = !!(await p.$('[data-panel="garage"]'))
res.garage = await poll(async () => !!(await p.$('[data-panel="garage"] [data-courser="dray"]')), 15000)
await p.evaluate(() => document.querySelector<HTMLElement>('[data-panel="garage"] [data-courser="dray"]')?.click()); await sleep(1500)
res.garageTitle = await p.evaluate(() => (document.querySelector('[data-panel="garage"]')?.textContent ?? '').slice(0, 40))
res.fleetAfterPick = await fleet()
res.topDray = await top()
await p.screenshot({ path: `${out}/dray.png` })
await p.keyboard.press('KeyG'); await sleep(300); await p.keyboard.press('KeyM'); await sleep(1500)
res.mapMarks = await p.evaluate(() => document.querySelector('[data-map="base"]')?.getAttribute('data-shop-marks') ?? null)
const fa = res.fleetAfterBuy as { owned: string[]; active: string } | null, fp = res.fleetAfterPick as typeof fa
const pass = !!res.reach && !!res.panel && res.make === 'ashcombe' && (res.models as string[]).join() === 'dray,tally' && res.buy === true
  && res.marksAfter === SEED - DRAY.price && !!fa && fa.owned.includes('dray') && fa.active === 'darter' && res.again === true
  && !!res.garage && /Dray/.test(String(res.garageTitle)) && fp?.active === 'dray'
  && (res.topDray as number) < (res.topDarter as number) - 2 && String(res.mapMarks ?? '').includes(KEY) && errs.length === 0
await done(pass, pass ? 'PASS' : 'FAIL')
