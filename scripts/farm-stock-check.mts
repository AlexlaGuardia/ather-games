// ── FARM: STOCK FROM THE BAG (2026-11-22, world / Jin; Alex: "the stock from pack button hasnt been working") ─────────────
// give() fills the HOTBAR first, so a keeper's seeds and crops sit there; the farm's button skipped the hotbar and said
// nothing. This check builds the Farm (as farm-check), then with farm goods in the HOTBAR and the BAG presses
// "Stock from the bag": the store rises by exactly those goods, the pack drops by them (logs/tools stay), and after a
// RELOAD the store still holds them and the panel shows them. --phone runs it at 390x844 touch. 0 page errors.
// SETUP (stated): bag = 20 goldwood logs (build costs 18), hotbar slots 2-3 = 5 Violetbloom seed + 3 Goldleaf crop,
// bag slot 10 = 2 Rootvine seed. A fresh anonymous browser: never a real keeper's save.
//   npx tsx scripts/farm-stock-check.mts [--url http://localhost:3201] [--out dir] [--phone]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { TABLE, ROOMS, benchOf, footprint, type Room } from '../src/app/shimmer/open/ather/rooms'
import { seedId, cropId } from '../src/app/shimmer/open/ather/farming'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/farm-stock'), phone = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 700 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument((SEED_V: string, CROP_G: string, SEED_R: string) => {
  if (sessionStorage.getItem('farm')) return; sessionStorage.setItem('farm', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: SEED_V, n: 5 }; slots[3] = { id: CROP_G, n: 3 }; slots[8] = { id: 'goldwood_log', n: 20 }; slots[10] = { id: SEED_R, n: 2 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })); localStorage.removeItem('open.works.v1'); localStorage.removeItem('open.farm.v1')
}, seedId('violetbloom'), cropId('goldleaf'), seedId('rootvine'))
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const store = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.works.v1'))?.rooms?.[0]?.store ?? []) as { id: string; n: number }[]) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const farmSave = () => read('open.farm.v1') as Promise<{ farm: { beds: ({ crop: string; grade: string } | null)[]; charge: number }; starter: boolean }>
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to start|Tap to drive/i.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500) }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); await sleep(350); return !!b }
const attr = (sel: string, a: string) => p.evaluate((s, n) => document.querySelector(s)?.getAttribute(n) ?? null, sel, a)
const skew = (ms: number) => p.evaluate(m => (window as any).__farm.skew(m), ms)
const res: Record<string, unknown> = { url }
const step = (n: string) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${n}`)

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
const w0 = await read('open.works.v1')
if (!w0?.rooms?.length) { await shot('stock-0-noroom'); console.log(JSON.stringify({ ...res, works: w0, errs }, null, 1)); console.log('FAIL: the Farm was never placed (pick/build/land step)'); await br.close(); process.exit(1) }
const room: Room = w0.rooms[0]
res.room = { kind: room?.kind, x: room?.x, z: room?.z }
res.logsAfter = (await bag()).goldwood_log ?? 0
res.starter = { flag: (await farmSave())?.starter, store: await store() }
await tp(room.x, room.z + 14, 0); 
await sleep(Math.max(0, room.doneAt - Date.now()) + 3000)
step('2. in, E at the s')
// 2. in, E at the standing spot
const b = benchOf(room)
await tp(b.x, b.z - 1.2, 0)
await aimAt(p, b.x, b.z, 0.6)
await p.keyboard.press('e'); await sleep(900)
res.panel = await p.evaluate(() => !!document.querySelector('[data-panel="farm"]'))
res.beds = await p.evaluate(() => document.querySelectorAll('[data-bed]').length)
const SV = seedId('violetbloom'), CG = cropId('goldleaf'), SR = seedId('rootvine')
const bag0 = await bag(), st0 = await store()
res.before = { bag: { sv: bag0[SV] ?? 0, cg: bag0[CG] ?? 0, sr: bag0[SR] ?? 0, logs: bag0.goldwood_log ?? 0, repeater: bag0.repeater ?? 0 }, store: { sv: st0[SV] ?? 0, cg: st0[CG] ?? 0, sr: st0[SR] ?? 0 } }
await shot('stock-1-before')
step('3. stock from the bag')
res.button = await click('[data-act="stock-room"] button'); await sleep(800)
const bag1 = await bag(), st1 = await store()
res.after = { bag: { sv: bag1[SV] ?? 0, cg: bag1[CG] ?? 0, sr: bag1[SR] ?? 0, logs: bag1.goldwood_log ?? 0, repeater: bag1.repeater ?? 0 }, store: { sv: st1[SV] ?? 0, cg: st1[CG] ?? 0, sr: st1[SR] ?? 0 } }
await shot('stock-2-after')
step('4. reload')
await p.reload({ waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
const st2 = await store()
res.reloaded = { sv: st2[SV] ?? 0, cg: st2[CG] ?? 0, sr: st2[SR] ?? 0 }
await tp(b.x, b.z - 1.2, 0); await aimAt(p, b.x, b.z, 0.6)
await p.keyboard.press('e'); await sleep(900)
res.panelSlots = await p.evaluate(() => document.querySelectorAll('[data-room-store="farm"] [data-room-slot]').length)
await shot('stock-3-reloaded')
res.overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
res.errs = errs
console.log(JSON.stringify(res, null, 1))
const a = res.after as any, bf = res.before as any, rl = res.reloaded as any
const pass = res.panel === true && res.button === true && bf.bag.sv === 5 && bf.bag.cg === 3 && bf.bag.sr === 2
  && a.store.sv === bf.store.sv + 5 && a.store.cg === bf.store.cg + 3 && a.store.sr === bf.store.sr + 2
  && a.bag.sv === 0 && a.bag.cg === 0 && a.bag.sr === 0 && a.bag.logs === bf.bag.logs && a.bag.repeater === bf.bag.repeater
  && rl.sv === a.store.sv && rl.cg === a.store.cg && rl.sr === a.store.sr && (res.panelSlots as number) >= 6 && res.overflow === false && errs.length === 0
console.log(pass ? `PASS${phone ? ' (phone 390x844)' : ''}: Farm built → hotbar + bag farm goods (5 Violetbloom seed, 3 Goldleaf, 2 Rootvine seed) → Stock from the bag moved all 10 into the store, pack dropped by them, logs stayed → reload: store kept them, panel shows ${res.panelSlots} stacks → 0 page errors` : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
