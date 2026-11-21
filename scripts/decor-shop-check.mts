// ── DECOR FOR MARKS AT THE NYX-SIDE SHOPS, PLAYED (2026-11-17, play / Jin 2 95f19652) ───────────────────────────
// Alex 11-17: unique furniture pieces are sold for Marks by Nyx-side shops. A keeper walks to Rune Hold's Smithy, E,
// buys an Iron Lantern; walks to the Citadel's Grand Exchange, buys a Mana-cell Lamp; goes home to the Ather and the
// planning table's Furnish list offers both. SETUP (stated): the garden's trial purse (ather:trade:trial-ledger) holds
// 20,000 Marks. Hooks: movement (__drive.tp / footTp, __ather.tp) and reading only; E and every click are real inputs.
//   npx tsx scripts/decor-shop-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { cachedPlan } from '../src/app/shimmer/open/foot-solids'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { heldUse, placesFromHand } from '../src/app/shimmer/open/ather/held-use'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/decor')
mkdirSync(out, { recursive: true })
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const front = (town: string, id: string) => cachedPlan(R, meta.places.findIndex(p => p.id === town)).buildings.find(b => b.front === id)!
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1000, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('dc')) return; sessionStorage.setItem('dc', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('ather:trade:trial-ledger', JSON.stringify({ marks: 20_000, scale: 2, deeds: 0, active: null, owned: { core: 0, trim: 0, rune: 0 } }))
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
})
const res: Record<string, unknown> = { url }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
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
// 1. Rune Hold's Smithy: an Iron Lantern
res.smithy = await visit('rune-hold', 'smithy'); await shot('dc-1-smithy')
res.boughtLantern = await click('[data-decor-item="iron_lantern"] button'); await wait(700)
res.afterSmithy = { marks: (await read('ather:trade:trial-ledger'))?.marks, bag: await bag() }; await shot('dc-2-bought')
await p.keyboard.press('Escape'); await wait(600)
// 2. the Citadel's Grand Exchange: a Mana-cell Lamp
res.exchange = await visit('citadel', 'grand-exchange'); await shot('dc-3-exchange')
res.boughtLamp = await click('[data-decor-item="mana_cell_lamp"] button'); await wait(700)
res.afterExchange = { marks: (await read('ather:trade:trial-ledger'))?.marks, bag: await bag() }
// 3. home: both place from the hand on the plot. The planning table's Furnish list is gone since M45 (d030f8cd, 11-20:
// furniture places from the hand; m45-hand-check proves the ghost/E-set path in the browser), so the bought items must be
// pieces the held-item table places, read from the same pure table the page uses.
res.furnish = Object.keys((res.afterExchange as { bag: Record<string, number> }).bag).filter(id => placesFromHand(heldUse(id, 'plot'))).sort()
res.errs = errs
console.log(JSON.stringify(res))
const a = res.afterSmithy as { marks: number; bag: Record<string, number> }, b2 = res.afterExchange as typeof a
const L = FURNITURE.iron_lantern.sold!.price, M = FURNITURE.mana_cell_lamp.sold!.price
const pass = res.smithy === true && a.marks === 20_000 - L && a.bag.iron_lantern === 1
  && res.exchange === true && b2.marks === 20_000 - L - M && b2.bag.mana_cell_lamp === 1
  && JSON.stringify(res.furnish) === JSON.stringify(['iron_lantern', 'mana_cell_lamp']) && errs.length === 0
console.log(pass ? 'PASS: Iron Lantern at the Smithy + Mana-cell Lamp at the Grand Exchange for Marks → both place from the hand on the plot' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
