// ── THE GARDEN BANK, PLAYED (2026-11-17, play / Jin 2 95f19652) ─────────────────────────────────────────────────
// A keeper with a stuffed bag walks to the starter chest by the planning table, puts the bag away, takes a stack back,
// then plans a second chest at the table, sets it down, and the bank's cap grows by one chest.
// SETUP (stated): the bag holds 40 goldwood logs + 99 blankstone + 4 mast in BAG slots (not the hotbar), no works, no bank.
// Hooks used for MOVEMENT only (__ather.tp) and for READING (localStorage). Every E, click and the place are real inputs.
//   npx tsx scripts/plot-bank-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { STARTER_CHEST, CHEST_COST } from '../src/app/shimmer/open/ather/rooms'
import { CHEST_SLOTS } from '../src/app/shimmer/open/ather/garden-bank'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/bank')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('bank')) return; sessionStorage.setItem('bank', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }
  slots[8] = { id: 'goldwood_log', n: 40 }; slots[9] = { id: 'blankstone', n: 99 }; slots[10] = { id: 'mast', n: 4 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })); localStorage.removeItem('open.works.v1'); localStorage.removeItem('open.bank.v1')
})
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const bank = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.bank.v1'))?.stacks ?? []) as { id: string; n: number }[]) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f'); await shot('_f') }
const panel = (name: string) => p.evaluate(n => !!document.querySelector(`[data-panel="${n}"]`), name)
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const capShown = () => p.evaluate(() => Number(document.querySelector('[data-bank-cap]')?.getAttribute('data-bank-cap') ?? -1))
const res: Record<string, unknown> = { url }

await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
await hideCard()
// 1. the starter chest: stand in front of it (its front faces −z), E, put the bag away
await tp(STARTER_CHEST.x, STARTER_CHEST.z + 1.3, 0); await shot('bank-1-chest')   // yaw 0 looks −z: at the chest's front
await p.keyboard.press('e'); await sleep(900)
res.bankPanel = await panel('bank'); res.capBefore = await capShown(); await shot('bank-2-panel-empty')
res.putAway = await click('[data-act="deposit-bag"] button'); await sleep(700)
res.afterPut = { bag: await bag(), bank: await bank() }; await shot('bank-3-put-away')
// 2. take the logs back: click the goldwood stack in the bank
const logSlot = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-bank-slot]')].find(e => e.title.startsWith('Goldwood Log'))?.getAttribute('data-bank-slot'))
res.withdrew = logSlot != null && await click(`[data-bank-slot="${logSlot}"]`); await sleep(700)
res.afterTake = { bag: await bag(), bank: await bank() }
await p.keyboard.press('Escape'); await sleep(500)
// 3. a second chest: the table's chest card → Plan → stand on open ground → E
await tp(STARTER_CHEST.x - 3.2 + 1.6, STARTER_CHEST.z + 1.6, Math.PI / 4)
await p.keyboard.press('e'); await sleep(900)
res.tablePanel = await panel('planning-table')
res.plan = await click('[data-room="chest"] button'); await sleep(800)
await tp(-100, 112, 0); await sleep(600); await shot('bank-4-chest-ghost')
await p.keyboard.press('e'); await sleep(1000)
const works = await read('open.works.v1')
res.chests = works?.chests?.length ?? 0; res.logsAfterChest = (await bag()).goldwood_log ?? 0
await tp(-100, 113.5, 0); await shot('bank-5-chest-placed')
// 4. open the NEW chest (it stands ~1.8 m ahead of where it was set from): the cap shows two chests' worth
await tp(-100, 111.2, 0)
await p.keyboard.press('e'); await sleep(900)
res.capAfter = await capShown(); await shot('bank-6-two-chests')
res.errs = errs
console.log(JSON.stringify(res))
const a = res.afterPut as { bag: Record<string, number>; bank: Record<string, number> }, t = res.afterTake as typeof a
const pass = res.bankPanel === true && res.capBefore === CHEST_SLOTS
  && a.bank.goldwood_log === 40 && a.bank.blankstone === 99 && a.bank.mast === 4 && !a.bag.goldwood_log && a.bag.bait === 10   // bag away, hotbar kept
  && t.bag.goldwood_log === 40 && !t.bank.goldwood_log
  && res.chests === 1 && res.logsAfterChest === 40 - CHEST_COST[0].n && res.capAfter === 2 * CHEST_SLOTS && errs.length === 0
console.log(pass ? 'PASS: starter chest → bag put away (hotbar kept) → logs taken back → second chest planned + placed → cap 96' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
