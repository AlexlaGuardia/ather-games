// ── THE WATER TAP, PLAYED (2026-11-18, play / Jin ec72056f) ──────────────────────────────────────────────────────
// Canon (mana-tech.md › The water tap; Magii 11-18 athernyx 2bfa6b2): bought Nyx-side, set in the fold, sips the fold's mana
// into tanks; the beds' only water. A keeper buys a Water Tap + a Water Tank at Rune Hold's Smithy for Marks (real E + clicks),
// goes home, builds the Farm at the planning table, sees NO water line and no Water buttons, sets the tap AND the tank from the
// table (Set → E), the farm's clock moves 3 minutes (2 water made: one tap, 1 per 90 s), plants a Goldleaf, waters it (one
// water spent, the bed reads Watered), and the bed is ready at 0.75 of Goldleaf's 5 minutes, not before. Capacity reads 12.
// SETUP (stated): trial purse 20,000 Marks; bag = 20 goldwood logs (the Farm costs 18). Hooks: movement (__drive.tp/footTp,
// __ather.tp, __build.to), the farm clock (__farm.skew, shared by the water), reading only. 0 page errors.
//   npx tsx scripts/water-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { cachedPlan } from '../src/app/shimmer/open/foot-solids'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { TABLE, benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
import { seedId } from '../src/app/shimmer/open/ather/farming'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/water')
mkdirSync(out, { recursive: true })
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const front = (town: string, id: string) => cachedPlan(R, meta.places.findIndex(p => p.id === town)).buildings.find(b => b.front === id)!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)), wait = sleep
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 700 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('wt')) return; sessionStorage.setItem('wt', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('ather:trade:trial-ledger', JSON.stringify({ marks: 20_000, scale: 2, deeds: 0, active: null, owned: { core: 0, trim: 0, rune: 0 } }))
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[8] = { id: 'goldwood_log', n: 20 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  for (const k of ['open.works.v1', 'open.farm.v1', 'open.water.v1']) localStorage.removeItem(k)
})
const res: Record<string, unknown> = { url }
const step = (n: string) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${n}`)
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f'); await shot('_f') }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); await sleep(350); return !!b }
const attr = (sel: string, a: string) => p.evaluate((s, n) => document.querySelector(s)?.getAttribute(n) ?? null, sel, a)
const skew = (ms: number) => p.evaluate(m => (window as any).__farm.skew(m), ms)

step('0. the Smithy')
await p.goto(`${url}/shimmer/open/continent?hour=14`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await wait(2000)
await p.keyboard.press('KeyW'); await wait(500)
const visit = async (town: string, id: string) => {
  const b = front(town, id), at = shopDoorPoint(b), fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), at.x, at.z); await wait(6000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.1), at.x + fx * 5, at.z + fz * 5, yaw); await wait(5000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 1, at.z + fz * 1, yaw)
  const reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === `front:${id}`)
  await p.keyboard.press('KeyE')
  const open = await poll(async () => !!(await p.$(`[data-panel="shop-panel"] [data-shop="${id}"][data-decor]`)), 15000)
  return reach && open
}
res.smithy = await visit('rune-hold', 'smithy'); await shot('wt-0-smithy')
res.stock = await p.evaluate(() => [...document.querySelectorAll('[data-decor-item]')].map(e => e.getAttribute('data-decor-item')))
res.boughtTap = await click('[data-decor-item="water_tap"] button'); await wait(700)
res.boughtTank = await click('[data-decor-item="water_tank"] button'); await wait(700)
res.afterSmithy = { marks: (await read('ather:trade:trial-ledger'))?.marks, bag: await bag() }

await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
step('1. build it at th')
// 1. build it at the table
await tp(TABLE.x + 1.6, TABLE.z + 1.6, Math.PI / 4)
await p.keyboard.press('e'); await sleep(900)
res.pickOnTable = await p.evaluate(() => !!document.querySelector('[data-pick="farm"]'))
res.build = (await click('[data-pick="farm"]')) && (await sleep(400), await click('[data-build-card="farm"] [data-act="build"] button')); await sleep(1200)
await p.evaluate(() => (window as any).__build.to(-100, 100)); await sleep(2500)
const mid = await p.evaluate(() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
await p.mouse.move(mid.x - 3, mid.y); await sleep(300); await p.mouse.move(mid.x, mid.y); await sleep(800)
await p.mouse.click(mid.x, mid.y); await sleep(1200); await click('[data-act="land"]'); await sleep(800)
const room: Room = (await read('open.works.v1')).rooms[0]
res.room = { kind: room?.kind, x: room?.x, z: room?.z }
res.logsAfter = (await bag()).goldwood_log ?? 0
await tp(room.x, room.z + 14, 0); await shot('wt-farm-scaffold')
await sleep(Math.max(0, room.doneAt - Date.now()) + 3000)
step('2. the Farm with no tap')
const b = benchOf(room)
await tp(b.x, b.z - 1.2, 0)
await aimAt(p, b.x, b.z, 0.6)
await p.keyboard.press('e'); await sleep(900)
res.noTap = { panel: await p.evaluate(() => !!document.querySelector('[data-panel="farm"]')), taps: await attr('[data-water]', 'data-taps'), waterButtons: await p.evaluate(() => document.querySelectorAll('[data-water-bed]').length) }
await click('[data-bed="5"] button'); await click(`[data-plant-seed="${seedId('ather_wheat')}"] button`)
// a planted bed with no tap: still no Water button
res.noTapPlanted = { phase: await attr('[data-bed="5"]', 'data-phase'), waterButtons: await p.evaluate(() => document.querySelectorAll('[data-water-bed]').length) }
await shot('wt-1-no-tap')
await p.keyboard.press('Escape'); await sleep(600)

step('3. set the tap and the tank')
// ★ 11-22 (sweep pass 6, sprites): since M45 (d030f8cd, 11-20) a piece is set FROM THE HAND: hold it on the hotbar, E sets
// it at the ghost; the planning table keeps rooms + plans only. The old flow clicked a table "Set" button that is gone, which
// left the table panel open, so every later E read as 'E at the bed opens the planning table' and nothing got planted.
for (const [item, x] of [['water_tap', -130], ['water_tank', -127.5]] as const) {
  await tp(x, 102.5, 0)
  const slot = (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(v => v?.id === item)
  await p.keyboard.press(`Digit${slot + 1}` as any); await sleep(900)
  res[`set_${item}`] = slot >= 0 && slot < 8 && await p.evaluate(() => !!document.querySelector('[data-placing]'))
  await p.keyboard.press('e'); await sleep(1000)
}
const pieces = ((await read('open.works.v1'))?.pieces ?? []) as { item: string }[]
res.placed = pieces.map(x => x.item).sort()
await tp(-128.5, 106, Math.PI / 8); await shot('wt-2-tap-and-tank')

step('4. fill, plant, water')
await tp(b.x, b.z - 1.2, 0); await aimAt(p, b.x, b.z, 0.6); await p.keyboard.press('e'); await sleep(900)
res.fresh = { water: await attr('[data-water]', 'data-water'), cap: await attr('[data-water]', 'data-water-cap'), taps: await attr('[data-water]', 'data-taps') }
await skew(180_000)
res.filled = await poll(async () => (await attr('[data-water]', 'data-water')) === '2', 10000) ? '2' : await attr('[data-water]', 'data-water')
await click('[data-bed="0"] button'); await click(`[data-plant-seed="${seedId('goldleaf')}"] button`)
res.waterButtonShown = !!(await p.$('[data-water-bed="0"]'))
res.watered = await click('[data-water-bed="0"] button'); await sleep(500)
res.after = { water: await attr('[data-water]', 'data-water'), mark: !!(await p.$('[data-watered="0"]')), saved: (await read('open.farm.v1'))?.farm?.beds?.[0]?.watered }
await shot('wt-3-watered')
// ready at 0.75 x 5 min = 225 s, not at 220 s
// (skew is computed from the bed's own plantedAt on the farm's clock: real seconds pass between steps, so a fixed skew drifts)
const age = async () => p.evaluate(() => { const w = window as any, f = JSON.parse(localStorage.getItem('open.farm.v1') ?? 'null'); const at = f?.farm?.beds?.[0]?.plantedAt; return typeof at === 'number' ? w.__farm.now() - at : NaN })
if (!Number.isFinite(await age())) { res.errs = errs; console.log(JSON.stringify(res)); console.log('FAIL: bed 0 was never planted'); await br.close(); process.exit(1) }
await skew(212_000 - await age()); await sleep(1300); res.at212 = await attr('[data-bed="0"]', 'data-phase')
// unwatered, Goldleaf would need 300 s: at 212 s the watered bed must still be growing, at 226 s ready
await skew(226_000 - await age()); res.at226 = await poll(async () => (await attr('[data-bed="0"]', 'data-phase')) === '3', 6000)

step('5. a farmer waters a growing bed')
// SETUP (stated): a rare-yield farmer (7 waterings an hour) is put straight into the village save, working this Farm (the
// recruit + assign flow is the folk/workshop checks' job). A Dewdrop Vine (10 min) is planted by click on bed 2; the farm's
// clock moves 9 min; the page's own village tick runs (__ather.villageTick). The farmer waters bed 2 from the tanks, once.
await click('[data-bed="1"] button'); await click(`[data-plant-seed="${seedId('dewdrop_vine')}"] button`)
const before = { water: Number(await attr('[data-water]', 'data-water')), bed1: (await read('open.farm.v1'))?.farm?.beds?.[1] }
await p.evaluate(rid => { const w = window as any; localStorage.setItem('open.village.v1', JSON.stringify({ v: 1, lastTick: w.__farm.now(), moglins: [{ id: 'chk-farmer', name: 'Pib', home: 'chk', grades: { craft: 1, yield: 5, trade: 1 }, dream: '', profession: 'farmer', recruitedAt: 0, room: rid, acc: 0 }] })) }, room.id)
await skew(9 * 60_000)
await p.evaluate(() => (window as any).__ather.villageTick()); await sleep(800)
const fs1 = (await read('open.farm.v1'))?.farm?.beds
res.farmer = { before, bed1: fs1?.[1], others: fs1?.filter((b: any, i: number) => i !== 1 && i !== 0 && b?.watered).length, water: await attr('[data-water]', 'data-water'), ready: await attr('[data-bed="1"]', 'data-phase') === '3' }
// (watered, Dewdrop's 10 min becomes 7.5, so at 9 min the bed is READY: the farmer's watering is what ripened it)
await shot('wt-5-farmer')
await p.setViewport({ width: 390, height: 800 }); await sleep(800); await shot('wt-4-phone')
res.phoneOverflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
res.errs = errs
console.log(JSON.stringify(res))
const T = FURNITURE.water_tap.sold!.price, K = FURNITURE.water_tank.sold!.price
const fm = res.farmer as any, a = res.afterSmithy as { marks: number; bag: Record<string, number> }, nt = res.noTap as any, np = res.noTapPlanted as any, fr = res.fresh as any, af = res.after as any
const pass = res.smithy === true && (res.stock as string[]).includes('water_tap') && (res.stock as string[]).includes('water_tank')
  && a.marks === 20_000 - T - K && a.bag.water_tap === 1 && a.bag.water_tank === 1
  && room?.kind === 'farm' && nt.panel === true && nt.taps === '0' && nt.waterButtons === 0 && np.phase === '0' && np.waterButtons === 0
  && JSON.stringify(res.placed) === JSON.stringify(['water_tank', 'water_tap'])
  && fr.water === '0' && fr.cap === '12' && fr.taps === '1' && res.filled === '2'
  && res.waterButtonShown === true && res.watered === true && af.water === '1' && af.mark === true && af.saved === true
  && ['0', '1', '2'].includes(res.at212 as string) && res.at226 === true && fm.before.bed1?.crop === 'dewdrop_vine' && fm.before.bed1?.watered === false && fm.bed1?.watered === true && fm.others === 0 && fm.ready === true
  && res.phoneOverflow === false && errs.length === 0
console.log(pass ? 'PASS: Water Tap + Water Tank bought at the Smithy for Marks → no tap, no water line on the Farm → both set from the hand (M45) → 2 water after 3 min (cap 12) → a Goldleaf watered (1 spent, Watered) → ready at 226 s, still growing at 212 s (0.75 of 300 s) → a farmer waters the growing Dewdrop from the tanks → 0 page errors' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
