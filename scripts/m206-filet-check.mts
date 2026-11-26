// ── BETA M206 THE RINNSHOP'S FILET TAB: OWNER (2026-11-26, world-M206) ──────────────────────────────────────────────────
// Alex 11-26: the Rinnshop gets a Filet tab that prepares a caught rinn; three rinn filet into fillets for recipes and ONE
// rinn's scales grind at the Crusher. Jin's pick (cooking.ts FILET): Shimmerscale -> fillet + scales, Ribboneel -> fillet,
// Clickclaw -> meat. A fillet's use: it ROASTS at the hearth. The scales: Aqual Sauce = scales + Aqual at the Crusher.
// SETUP (stated): bag = 1 Shimmerscale, 1 Ribboneel, 1 Clickclaw, 1 Aqual; a raised Rinnshop at (-100, 100), a raised cooking
// room at (-100, 112), a Crusher Table at (-130, 102.5).
//  A. E at the Rinnshop bench, Filet tab: the three rinn listed; Filet each -> Shimmerscale Fillet + Shimmerscale Scales,
//     Ribboneel Fillet, Clickclaw Meat in the bag, the catches gone.
//  B. E at the Crusher: Aqual Sauce makeable; Make -> +1 Aqual Sauce, the scales + the Aqual spent.
//  C. E at the hearth: Roast each fillet; Focus; collect -> the three roasts in the bag. 390 wide, 0 page errors.
//   npx tsx scripts/m206-filet-check.mts [--url http://localhost:3202] [--out docs/looks/m206-2026-11-26]
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m206-2026-11-26')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const CRUSHER = { id: 'm206-crusher', item: 'alc_mortar', x: -130, z: 102.5, q: 0, placedAt: 1 }
const SHOP: Room = { id: 'm206-shop', kind: 'rinnshop', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [] }
const COOK: Room = { id: 'm206-cook', kind: 'cooking', x: -100, z: 112, q: 0, placedAt: 1, doneAt: 2, store: [] }
const FISH = ['shimmerscale', 'ribboneel', 'clickclaw']
const ROASTS: [string, string][] = [['shimmerscale_fillet', 'roast_shimmerscale_fillet'], ['ribboneel_fillet', 'roast_ribboneel_fillet'], ['clickclaw_meat', 'roast_clickclaw_meat']]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); process.exit(1) }
  await p.evaluateOnNewDocument((rooms: unknown, piece: unknown) => {
    if (sessionStorage.getItem('m206')) return; sessionStorage.setItem('m206', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null)
    const put: [string, number][] = [['waymark', 12], ['shimmerscale', 1], ['ribboneel', 1], ['clickclaw', 1], ['water_crystal', 1]]
    put.forEach(([id, n], k) => { slots[k] = { id, n } })
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms, chests: [], pieces: [piece] }))
  }, [SHOP, COOK], CRUSHER)
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
  const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
  const openBench = async (r: Room) => {
    const b = benchOf(r)
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.4); await sleep(2000)
    await aimAt(p, b.x, b.z, 0.6); await p.keyboard.press('e'); await sleep(1200)
    return p.evaluate(() => !!document.querySelector('[data-panel="bench"]'))
  }

  // ── A. the Filet tab
  ok(await openBench(SHOP), 'A the Rinnshop bench opens')
  const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-bench-tab]')].map(e => e.getAttribute('data-bench-tab')).join())
  ok(tabs.split(',').includes('filet'), `A the Rinnshop has a Filet tab (${tabs})`)
  await click('[data-bench-tab="filet"]'); await sleep(500)
  const listed = await p.evaluate(() => [...document.querySelectorAll('[data-bench-body="filet"] [data-filet-from]')].map(e => e.getAttribute('data-filet-from')).join())
  ok(listed === FISH.join(), `A Filet lists the three rinn (${listed})`)
  await shot('a-filet-tab')
  for (const id of FISH) { await click(`[data-filet-from="${id}"] button`); await sleep(600) }
  const a = await bag()
  ok(a.shimmerscale_fillet === 1 && a.shimmerscale_scales === 1 && a.ribboneel_fillet === 1 && a.clickclaw_meat === 1, `A fileted: fillet + scales, Ribboneel Fillet, Clickclaw Meat ${JSON.stringify({ sf: a.shimmerscale_fillet, sc: a.shimmerscale_scales, rf: a.ribboneel_fillet, cm: a.clickclaw_meat })}`)
  ok(!a.shimmerscale && !a.ribboneel && !a.clickclaw, 'A the three catches were spent')
  ok(await p.evaluate(() => document.querySelectorAll('[data-bench-body="filet"] [data-filet-from]').length === 0), 'A nothing left to filet')
  await shot('a-fileted')
  await p.keyboard.press('Escape'); await sleep(600)

  // ── B. the scales at the Crusher
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), CRUSHER.x, CRUSHER.z + 1.3); await sleep(2000)
  await aimAt(p, CRUSHER.x, CRUSHER.z, 0.5); await p.keyboard.press('e'); await sleep(1200)
  const can = await p.evaluate(() => document.querySelector('[data-panel="alchemy"] [data-infusion="water"]')?.getAttribute('data-can'))
  ok(can === '1', `B the Crusher can make Aqual Sauce from the scales (${can})`)
  await shot('b-crusher')
  await click('[data-infusion="water"] [data-act="infusion-make"] button'); await sleep(800)
  const b = await bag()
  ok(b.aqual_sauce === 1 && !b.shimmerscale_scales && !b.water_crystal, `B ground: +1 Aqual Sauce, the scales + Aqual spent (${JSON.stringify({ aq: b.aqual_sauce, sc: b.shimmerscale_scales, w: b.water_crystal })})`)
  await p.keyboard.press('Escape'); await sleep(600)

  // ── C. the fillets roast at the hearth
  ok(await openBench(COOK), 'C the hearth opens')
  const outOf = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.works.v1'))?.rooms?.find((x: Room) => x.id === COOK.id)?.out ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  for (const [f, dish] of ROASTS) {
    ok(await p.evaluate(j => !!document.querySelector(`[data-panel="bench"] [data-job="${j}"]`), `roast-${dish}`), `C the hearth lists Roast: ${dish}`)
    await click(`[data-job-pick="roast-${dish}"]`); await sleep(300)
    await click(`[data-src-item="${f}"] [data-move="all"]`); await sleep(400)
    await click('[data-qty="max"]'); await sleep(200)
    if (dish === ROASTS[0][1]) await shot('c-hearth')
    await click('[data-act="focus"] button')
    ok(await poll(async () => ((await outOf())[dish] ?? 0) === 1, 120000), `C the hearth roasted ${f} -> ${dish}`)
    await sleep(400)
  }
  await click('[data-act="collect-all"] button'); await sleep(800)
  const c = await bag()
  ok(ROASTS.every(([, d]) => c[d] === 1), `C collected the three roasts (${ROASTS.map(([, d]) => `${d}:${c[d] ?? 0}`).join(' ')})`)
  await shot('c-roasted')
  ok(errs.length === 0, `0 page errors (${errs.slice(0, 2).join(' | ')})`)
} finally { await br.close() }
console.log(fails ? `M206 FAIL (${fails})` : 'M206 ALL PASS')
process.exit(fails ? 1 : 0)
