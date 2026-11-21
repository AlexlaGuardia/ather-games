// THE CORKHOUSE (BETA M57 s4): a keeper carrying bottles walks to Rune Hold's Corkhouse door (by the shipyard), E opens it, sells
// all of one kind and one of another (real clicks): the purse rises by exactly corkhouse.ts's prices, the bottles leave the bag, and
// with nothing left the counter says so. SETUP (stated): bag seeded with 3 Health Draught (D) + 1 Starlight Tincture (A).
//   --phone: 390x844 touch: "Tap to drive", the near chip instead of E, taps on the counter, the panel shot + a fit check.
//   npx tsx scripts/corkhouse-check.mts [--url https://ather.games] [--out dir] [--phone]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { corkPrice } from '../src/app/shimmer/open/business/corkhouse'
import { potionId } from '../src/app/shimmer/open/ather/alchemy-set'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/corkhouse'), PHONE = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const door = doorsCached(R, 'rune-hold').find(d => d.key === 'front:corkhouse'), yard = doorsCached(R, 'rune-hold').find(d => d.key === 'front:shipyard')
if (!door || !yard) { console.log('FAIL: no Corkhouse / shipyard door in Rune Hold'); process.exit(1) }
console.log(`corkhouse door at ${door.at.x.toFixed(1)},${door.at.z.toFixed(1)}, ${Math.hypot(door.b.x - yard.b.x, door.b.z - yard.b.z).toFixed(1)} m from the shipyard`)
const HEALTH = potionId('health', 'D'), TINCT = potionId('wisdom', 'A')
const at = shopDoorPoint(door.b)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1000, height: 640 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
  const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await p.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  const purse = () => p.evaluate(() => { const m = (document.querySelector('[data-shop="corkhouse"] [data-purse]')?.textContent ?? '').match(/([\d,]+) Marks/); return m ? Number(m[1].replace(/,/g, '')) : -1 })
  const click = async (sel: string) => { const b = await p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; if (PHONE) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y); return true }
  // 1 · a keeper with bottles, then the continent
  await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
  await p.evaluate((h: string, t: string) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[8] = { id: h, n: 3 }; slots[9] = { id: t, n: 1 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  }, HEALTH, TINCT)
  await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2000)
  if (PHONE) {   // the touch start: "Tap to drive" (beta-audit-continent)
    const t = await p.evaluate(() => { const e = [...document.querySelectorAll<HTMLElement>('button, div, span')].find(x => /^Tap to drive$/.test((x.innerText ?? '').trim())); const r = e?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })
    if (t) { await p.touchscreen.tap(t.x, t.y); await sleep(2500) }
  } else { await p.keyboard.press('KeyW'); await sleep(500) }
  // 2 · to the door (movement hooks), then the real E
  const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door.at.x, door.at.z); await sleep(6000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(5000)
  ok(await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:corkhouse'), '1. the Corkhouse door is in reach')
  if (PHONE) {
    ok(await poll(async () => !!(await p.$('[data-touch-near]')), 10000), `2. phone: the near chip shows at the door (${await p.evaluate(() => (document.querySelector('[data-touch-near]') as HTMLElement | null)?.innerText ?? 'none')})`)
    await click('[data-touch-near]')
  } else await p.keyboard.press('KeyE')
  ok(await poll(async () => !!(await p.$('[data-shop="corkhouse"]')), 15000), '2. E (phone: the chip) opens the Corkhouse')
  const title = await p.evaluate(() => (document.querySelector('[data-panel="shop-panel"]')?.textContent ?? '').slice(0, 40))
  ok(/The Corkhouse/.test(title), `2. it says The Corkhouse (${title})`)
  const rows = await p.evaluate(() => [...document.querySelectorAll('[data-cork-row]')].map(e => (e as HTMLElement).dataset.corkRow))
  ok(JSON.stringify(rows) === JSON.stringify([TINCT, HEALTH]), `2. one row per bottle, best price first (${JSON.stringify(rows)})`)
  await sleep(500); await p.screenshot({ path: `${out}/corkhouse${PHONE ? '-phone' : ''}.png` })
  if (PHONE) {
    const fit = await p.evaluate(() => { const e = document.querySelector('[data-panel="shop-panel"]') as HTMLElement | null, r = e?.getBoundingClientRect(); return r ? { l: r.left, r: r.right, w: window.innerWidth, scroll: document.documentElement.scrollWidth } : null })
    ok(!!fit && fit.l >= 0 && fit.r <= fit.w + 1 && fit.scroll <= fit.w + 1, `2. phone: the counter fits 390 wide (${JSON.stringify(fit)})`)
  }
  // 3 · sell all the Health Draughts, then the one Tincture (real clicks)
  const m0 = await purse()
  ok(await click(`[data-cork-row="${HEALTH}"] [data-act="cork-sell-all"] button`), '3. clicked "All" on the Health Draughts')
  ok(await poll(async () => (await purse()) === m0 + 3 * corkPrice(HEALTH)!, 8000), `3. purse ${m0} -> ${await purse()} (+${3 * corkPrice(HEALTH)!})`)
  ok(!(await bag())[HEALTH], '3. the Health Draughts left the bag')
  ok(await click(`[data-cork-row="${TINCT}"] [data-act="cork-sell-one"] button`), '3. clicked "Sell 1" on the Tincture')
  ok(await poll(async () => (await purse()) === m0 + 3 * corkPrice(HEALTH)! + corkPrice(TINCT)!, 8000) && !(await bag())[TINCT], `3. +${corkPrice(TINCT)} for the Tincture, gone from the bag`)
  ok(await poll(async () => !!(await p.$('[data-cork-empty]')), 5000), '4. nothing left: the counter says to brew some')
  ok(errs.length === 0, `5. page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
