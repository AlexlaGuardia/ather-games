// ── THE GARDEN BANK, PLAYED (2026-11-17, play / Jin 2 95f19652) ─────────────────────────────────────────────────
// A keeper makes a KEEPSTONE at the planning table (canon 5a20b8f), puts the bag away at the starter Keepstone, takes a
// stack back, sets the new Keepstone on the plot (the bank's cap grows by one), opens it, and picks it back up.
// SETUP (stated): BAG slots (not the hotbar) hold 40 goldwood logs + 10 blankstone + 2 raw mana shards + 4 mast; no works, no bank.
// Hooks used for MOVEMENT only (__ather.tp) and for READING (localStorage). Every E, click and the place are real inputs.
//   npx tsx scripts/plot-bank-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { STARTER_CHEST, TABLE, KEEPSTONE_RECIPE } from '../src/app/shimmer/open/ather/rooms'
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
  slots[8] = { id: 'goldwood_log', n: 40 }; slots[9] = { id: 'blankstone', n: 10 }; slots[10] = { id: 'mast', n: 4 }; slots[11] = { id: 'raw_mana_shard', n: 2 }
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
// 1. the table (reworked 11-18, 33501da3: a strip of icons, a card, Build lifts into the flying planner): the Keepstone icon →
// Build makes one (it lands in the hotbar's first free slot) and lifts you with it on the pointer; Back to keeper lands without
// setting it, so it stays in the bag
await tp(TABLE.x + 1.6, TABLE.z + 1.6, Math.PI / 4)
await p.keyboard.press('e'); await sleep(900)
res.tablePanel = await panel('planning-table')
await click('[data-pick="keepstone"]'); await sleep(600)
res.made = await click('[data-build-card="keepstone"] [data-act="build"] button'); await sleep(1500)
res.liftedToMake = await p.evaluate(() => (window as any).__build?.on() === true)
res.afterMake = await bag(); await shot('bank-0-table')
await click('[data-act="land"]'); await sleep(1200)
// 2. the starter Keepstone: stand at its front (yaw 0 looks −z), E, put the bag away
await tp(STARTER_CHEST.x, STARTER_CHEST.z + 1.3, 0); await shot('bank-1-keepstone')
await p.keyboard.press('e'); await sleep(900)
res.bankPanel = await panel('bank'); res.capBefore = await capShown(); res.starterPickup = await p.evaluate(() => !!document.querySelector('[data-act="pickup-keepstone"]'))
res.putAway = await click('[data-act="deposit-bag"] button'); await sleep(700)
res.afterPut = { bag: await bag(), bank: await bank() }; await shot('bank-3-put-away')
// take the logs back: click the goldwood stack in the bank
const logSlot = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-bank-slot]')].find(e => e.title.startsWith('Goldwood Log'))?.getAttribute('data-bank-slot'))
res.withdrew = logSlot != null && await click(`[data-bank-slot="${logSlot}"]`); await sleep(700)
res.afterTake = { bag: await bag(), bank: await bank() }
await p.keyboard.press('Escape'); await sleep(500)
// 3. set the new one: the Keepstone icon → Set (one is in the bag) → the planner flies over open ground → click sets it
await tp(TABLE.x + 1.6, TABLE.z + 1.6, Math.PI / 4)
await p.keyboard.press('e'); await sleep(900)
await click('[data-pick="keepstone"]'); await sleep(600)
res.set = await click('[data-build-card="keepstone"] [data-act="build"] button'); await sleep(1500)
await p.evaluate(() => (window as any).__build.to(-100, 112)); await sleep(2500)
const vp = p.viewport()!, mid = { x: vp.width / 2, y: vp.height / 2 }
await p.mouse.move(mid.x - 3, mid.y); await sleep(300); await p.mouse.move(mid.x, mid.y); await sleep(800); await shot('bank-4-ghost')
await p.mouse.click(mid.x, mid.y); await sleep(1500)
const placed = ((await read('open.works.v1'))?.chests ?? []) as { x: number; z: number }[]
res.chests = placed.length; res.keepstonesAfterSet = (await bag()).keepstone ?? 0
if (await p.evaluate(() => (window as any).__build?.on() === true)) { await click('[data-act="land"]'); await sleep(1200) }
// 4. open the NEW one where it was set: stand at its front (yaw 0 looks −z), E: the cap shows two Keepstones' worth
const k = placed[0] ?? { x: -100, z: 112 }
await tp(k.x, k.z + 1.3, 0); await sleep(1500); await shot('bank-5-placed')
await p.keyboard.press('e'); await sleep(900)
res.capAfter = await capShown(); await shot('bank-6-two')
// 5. pick it back up: it returns to the bag, the bank keeps everything
res.pickedUp = await click('[data-act="pickup-keepstone"] button'); await sleep(800)
res.chestsAfterPickup = (await read('open.works.v1'))?.chests?.length ?? -1; res.afterPickup = { bag: await bag(), bank: await bank() }
res.errs = errs
console.log(JSON.stringify(res))
const a = res.afterPut as { bag: Record<string, number>; bank: Record<string, number> }, t = res.afterTake as typeof a, u = res.afterPickup as typeof a
const pass = res.tablePanel === true && (res.afterMake as Record<string, number>).keepstone === 1 && (res.afterMake as Record<string, number>).blankstone === 10 - KEEPSTONE_RECIPE[0].n
  && res.bankPanel === true && res.capBefore === CHEST_SLOTS && res.starterPickup === false
  && a.bank.goldwood_log === 40 && a.bank.blankstone === 7 && a.bank.mast === 4 && !a.bag.goldwood_log && a.bag.bait === 10 && a.bag.keepstone === 1   // bag away, hotbar kept
  && t.bag.goldwood_log === 40 && !t.bank.goldwood_log
  && res.chests === 1 && res.keepstonesAfterSet === 0 && res.capAfter === 2 * CHEST_SLOTS
  && res.chestsAfterPickup === 0 && u.bag.keepstone === 1 && u.bank.blankstone === 7 && errs.length === 0
console.log(pass ? 'PASS: Keepstone made → bag put away at the starter (hotbar kept) → logs back → Keepstone set (cap 96) → picked back up, bank intact' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
