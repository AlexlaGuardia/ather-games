// ── THE COOKING ROOM + THE SMOKEHOUSE, PLAYED (2026-11-17, play / Jin 30bbef32) ───────────────────────────────────
// The hearth ROASTS (canon 09-15) and the Smokehouse sells farmed meat by the bundle (RULED 11-17). A keeper roasts two
// Shimmerscale and a Drifthorn Cut from the room's store at the cooking room's hearth, is refused a meal on the plot,
// eats a Roast Rinn mid-fight in the Wilds (hurt to 30: heals 40), is refused at full health, then buys a bundle of
// Tuskroot at Rune Hold's Smokehouse for Marks. SETUP (stated): a cooking room standing at (-100, 100) with 1 Drifthorn
// Cut in its store; bag slot 8 holds 2 Shimmerscale; 20k Marks. Hooks: movement, reading, __ather.eat (the click's own
// handler) and combat().keeper.hp (the hurt).
//   npx tsx scripts/cooking-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { gunzipSync } from 'zlib'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { SMOKEHOUSE_STOCK, healOf } from '../src/app/shimmer/open/ather/cooking'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/cooking')
mkdirSync(out, { recursive: true })
const ROOM: Room = { id: 'cooking-check', kind: 'cooking', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [{ id: 'drifthorn_cut', n: 1 }] }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument((room: Room) => {
  if (sessionStorage.getItem('cc')) return; sessionStorage.setItem('cc', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('ather:trade:trial-ledger', JSON.stringify({ marks: 20_000, scale: 2, deeds: 0, active: null, owned: { core: 0, trim: 0, rune: 0 } }))
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }; slots[8] = { id: 'shimmerscale', n: 2 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] }))
}, ROOM)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const slotOf = async (id: string) => (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(s => s?.id === id)
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
const res: Record<string, unknown> = { url }
// 1. the hearth: roast 2 Shimmerscale from the bag, the Drifthorn Cut from the store
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
const b = benchOf(ROOM)
await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.4); await sleep(2000); await shot('cc-0-hearth')
await p.keyboard.press('e'); await sleep(900)
res.hearth = await p.evaluate(() => !!document.querySelector('[data-panel="bench"] [data-job="roast-roast_rinn"]'))
for (let k = 0; k < 2; k++) { await click('[data-job="roast-roast_rinn"] button'); await sleep(500) }
await click('[data-job="roast-roast_drifthorn"] button'); await sleep(500)
res.afterRoast = await bag(); res.store = ((await read('open.works.v1'))?.rooms?.[0]?.store ?? []).length; await shot('cc-1-roasted')
await p.keyboard.press('Escape'); await sleep(500)
// 2. hold the Roast Rinn: refused on the plot
const slot = await slotOf('roast_rinn'); res.rinnSlot = slot
await p.keyboard.press(String(slot + 1)); await sleep(500)
await p.evaluate(() => (window as any).__ather.eat()); await sleep(400)
res.plotEat = (await bag()).roast_rinn
// 3. the Wilds: hurt to 30, eat (+40), then refused at full health
await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__ather?.combat, { timeout: 240000 }); await sleep(5000)
await p.mouse.click(550, 380); await sleep(600)
await p.keyboard.press(String(slot + 1)); await sleep(500)
// the hurt reaches the page on the combat layer's HUD tick (every 0.08 s of frame time; swiftshader frames are slow): poll
await p.evaluate(() => { const a = (window as any).__ather, c = a.combat(); c.hollows.length = 0; c.keeper.hp = 30; c.keeper.sinceHurt = 0 })
await poll(async () => await p.evaluate(() => (window as any).__ather.hp()) <= 31, 30000)
res.hurt = await p.evaluate(() => (window as any).__ather.hp())
await p.evaluate(() => { (window as any).__ather.combat().keeper.sinceHurt = 0; (window as any).__ather.eat() })
await poll(async () => await p.evaluate(() => (window as any).__ather.combat().keeper.hp) > 31, 30000)
res.healed = await p.evaluate(() => (window as any).__ather.combat().keeper.hp); res.afterEat = (await bag()).roast_rinn ?? 0
await shot('cc-2-ate')
await p.evaluate(() => { const k = (window as any).__ather.combat().keeper; k.hp = k.maxHp })
await poll(async () => await p.evaluate(() => (window as any).__ather.hp()) >= 100, 30000)
await p.evaluate(() => (window as any).__ather.eat()); await sleep(400)
res.fullEat = (await bag()).roast_rinn ?? 0
// 4. Rune Hold's Smokehouse: a bundle of Tuskroot for Marks
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const door = doorsCached(R, 'rune-hold').find(d => d.key.startsWith('front:smokehouse'))!
res.doorKey = door?.key
await p.goto(`${url}/shimmer/open/continent?hour=14`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2000)
await p.keyboard.press('KeyW'); await sleep(500)
const at = shopDoorPoint(door.b), fx = Math.cos(door.b.yaw), fz = Math.sin(door.b.yaw), yaw = Math.atan2(fx, fz)
await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), at.x, at.z); await sleep(6000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.1), at.x + fx * 5, at.z + fz * 5, yaw); await sleep(5000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 1, at.z + fz * 1, yaw)
res.reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === door.key)
await p.keyboard.press('KeyE')
res.shop = await poll(async () => !!(await p.$('[data-panel="shop-panel"] [data-shop="smokehouse"]')), 15000); await shot('cc-3-smokehouse')
await click('[data-bundle="tuskroot_cut"] button'); await sleep(700)
res.afterBuy = { marks: (await read('ather:trade:trial-ledger'))?.marks, bag: await bag() }; await shot('cc-4-bought')
res.errs = errs
console.log(JSON.stringify(res))
const r = res.afterRoast as Record<string, number>, u = res.afterBuy as { marks: number; bag: Record<string, number> }, T = SMOKEHOUSE_STOCK.find(x => x.id === 'tuskroot_cut')!
const pass = res.hearth === true && r.roast_rinn === 2 && !r.shimmerscale && r.roast_drifthorn === 1 && res.store === 0
  && res.plotEat === 2 && (res.hurt as number) <= 31 && Math.abs((res.healed as number) - (30 + healOf('roast_rinn'))) <= 1 && res.afterEat === 1 && res.fullEat === 1
  && res.reach === true && res.shop === true && u.marks === 20_000 - T.price && u.bag.tuskroot_cut === T.n && errs.length === 0
console.log(pass ? 'PASS: roasted 2 rinn + a Drifthorn Cut from the store → refused on the plot → ate mid-fight (+40) → refused when whole → a Tuskroot bundle at Rune Hold\'s Smokehouse' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
