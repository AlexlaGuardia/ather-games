// BETA M134 s2: BUY METAL ON NYX -> FIT -> SWAP + BACK (wear kept) -> REPAIR ALL (cost shown first) -> RELOAD, on prod at 390x844,
// ONE FRESH context (never a real save).
// No live Nyx supplier zone exists (placement is Alex's), so, like m205-market-check, the owner publishes a FIXTURE (live + ONE zone
// tagged Supplier / 'trade-co') and ALWAYS rolls it back (live JSON identical, draft identical).
// SETUP (stated, not played): the fresh keeper's purse seeded to 5,000 Marks (the lot prices are 900 + 720; a new keeper starts with
// 1,500); a raised Smithy + a Starwillow Pruner (no edge) + Forestry 10 seeded before the Ather page; the edges' WEAR is set by hand
// (wearing itself = s1's proven path: m134-smithy-check prunes real trees). Real E + real clicks for everything else:
//   1. Nyx: E at the supplier -> panel lists Venium + Eurleen -> buy both lots: Marks down by both prices, 6 + 6 in the bag
//   2. Ather: E at the Smithy -> Edges -> Fit Venium (3 spent) -> Venium worn to 10 -> Fit Eurleen (a new one, 3 spent; Venium kept
//      at 10) -> Eurleen worn to 20 -> Fit Venium again (free, back at 10; Eurleen kept at 20)
//   3. Repair all -> the total shows FIRST and nothing is charged -> Repair -> charged exactly that, both edges full
//   4. reload -> all kept; 0 page errors.
//   OWNER_KEY=... npx tsx scripts/m134-s2-check.mts [--url https://ather.games] [--out docs/looks/m134-s2-2026-11-27]
// ★ Publish + rollback write version files under world/builder/nyx/ (tracked): commit them after a run.
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { EDGE, FIT_METAL, repairCost } from '../src/app/shimmer/open/ather/edges'
import { SUPPLIER_KINDS } from '../src/app/shimmer/open/business/suppliers'
import { NEW_LEDGER } from '../src/app/shimmer/open/trade'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m134-s2-2026-11-27')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const LOTS = Object.fromEntries(SUPPLIER_KINDS['trade-co'].lots.map(l => [l.id, l])) as Record<string, { n: number; price: number }>
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await op.goto(`${url}/shimmer/open/glade-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
type Snap = { draft: Record<string, unknown>; live: Record<string, unknown>; index: { live: number | null; versions: { v: number }[] } }
const bget = () => op.evaluate(async () => { for (let i = 0; i < 6; i++) { const r = await fetch('/shimmer/save-builder?map=nyx', { cache: 'no-store' }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 1500)) } return null }) as Promise<Snap | null>
const bpost = (body: Record<string, unknown>) => op.evaluate(async (b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'nyx', ...b }) }); return r.ok ? r.json() : { status: r.status, text: await r.text() } }, body) as Promise<(Snap & { status?: number }) | null>
const pubText = async () => { const r = await fetch(`${url}/shimmer/open/nyx-edits`, { cache: 'no-store' }); if (!r.ok) throw new Error(`nyx-edits ${r.status}`); return JSON.stringify(await r.json()) }

// the ONE fresh keeper context (no owner key), 390x844
const ctx = await br.createBrowserContext(), kp = await ctx.newPage()
await kp.setViewport({ width: 390, height: 844 })
kp.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await kp.evaluateOnNewDocument('window.__name = (f) => f')
await kp.evaluateOnNewDocument((ledger: string) => {
  if (localStorage.getItem('m134s2-seeded')) return; localStorage.setItem('m134s2-seeded', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('ather:trade:trial-ledger', ledger)
}, JSON.stringify({ ...NEW_LEDGER, marks: 5000 }))
const bag = async () => { const inv = await kp.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')) as { slots: ({ id: string; n: number } | null)[] } | null; const r: Record<string, number> = {}; for (const s of inv?.slots ?? []) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const purse = () => kp.evaluate(() => Number(document.querySelector('[data-purse]')?.getAttribute('data-purse') ?? NaN)) as Promise<number>
const clickSel = async (sel: string) => { const b = await kp.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await kp.mouse.click(b.x, b.y); return true }
const Dv = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as any).__drive?.[f]?.(...x), fn, a)

// ── 1. Nyx: the fixture supplier, buy both metal lots ──
const start = await bget()
ok(!!start, 'owner: the nyx builder draft answers')
if (!start) process.exit(1)
const startDraft = JSON.stringify(start.draft), liveText0 = await pubText(), liveV0 = start.index.live
let published = false
try {
  await kp.goto(`${url}/shimmer/open/continent?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await kp.waitForFunction(() => !!(window as any).__drive?.ground, { timeout: 240000 }); await sleep(3000)
  await dismissStartCard(kp)
  const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as { places: { id: string; x: number; z: number }[] }
  const p0 = meta.places[0]
  const s = await kp.evaluate((px: number, pz: number) => {
    const G = (window as any).__drive.ground
    for (let r = 250; r <= 900; r += 25) for (let a = 0; a < 24; a++) {
      const x = Math.round(px + r * Math.cos(a * Math.PI / 12)), z = Math.round(pz + r * Math.sin(a * Math.PI / 12))
      const hs: number[] = []; for (let dx = -8; dx <= 16; dx += 4) for (let dz = -8; dz <= 14; dz += 4) hs.push(G(x + dx, z + dz))
      if (hs.every(h => Number.isFinite(h) && h > 1.5) && Math.max(...hs) - Math.min(...hs) < 1.2) return { x, z }
    }
    return null
  }, p0.x, p0.z) as { x: number; z: number } | null
  ok(!!s, `nyx: flat dry land near ${p0.id} (${s?.x}, ${s?.z})`)
  if (!s) throw new Error('no land')
  const Z = { id: 'zc-m134s2', x0: s.x, z0: s.z, x1: s.x + 8, z1: s.z + 6, h: 0, prev: {}, tag: { kind: 'supplier', ref: 'trade-co', name: 'Ather Trading Co.', front: 'n' } }
  const D = { x: (Z.x0 + Z.x1) / 2, z: Z.z0 - 0.6 }
  const liveL = JSON.parse(liveText0) as { zones?: unknown[] }
  const d = await bpost({ action: 'draft', layer: { ...liveL, zones: [...(liveL.zones ?? []), Z] } })
  ok(!!d && !d.status, `owner: nyx draft = live + 1 Supplier zone (${d?.status ?? 'ok'})`)
  const pub = await bpost({ action: 'publish', note: 'check: m134-s2-check' }); published = !!pub && !pub.status
  ok(published, `nyx: fixture PUBLISH ok (${pub?.status ?? 'ok'})`)
  await kp.reload({ waitUntil: 'load', timeout: 240000 })
  await kp.waitForFunction(() => !!(window as any).__drive?.ground, { timeout: 240000 }); await sleep(3000)
  await dismissStartCard(kp)
  await kp.keyboard.press('KeyE'); await sleep(1500)   // out of the courser
  const at = async (x: number, z: number, yaw: number, pitch: number) => { await Dv('footTp', x, z, yaw, pitch); await sleep(2500) }
  await at(D.x, D.z - 3, Math.PI, -0.1)
  let reach: { kind?: string; sells?: string } | null = null
  for (let t = 0; t < 4 && !reach?.sells; t++) { await at(D.x, D.z - 1.6, Math.PI, -0.25 - t * 0.1); reach = await kp.evaluate(() => (window as any).__nyxZones?.reach() ?? null) }
  ok(reach?.sells === 'trade-co', `nyx: on foot, the crosshair finds the supplier (${JSON.stringify(reach)})`)
  await kp.keyboard.press('KeyE'); await sleep(1500)
  const txt = await kp.evaluate(() => document.querySelector('[data-panel="supplier-panel"]')?.textContent ?? '') as string
  ok(txt.includes('Venium') && txt.includes('Eurleen') && !!(await kp.$('[data-buy="venium"]')) && !!(await kp.$('[data-buy="eurleen"]')), 'nyx: E opens the supplier panel; Venium + Eurleen lots listed')
  await kp.screenshot({ path: `${out}/a-supplier-metal.png` })
  const m0 = await purse(), b0 = await bag()
  await clickSel('[data-buy="venium"] button'); await sleep(800)
  await clickSel('[data-buy="eurleen"] button'); await sleep(1200)
  const m1 = await purse(), b1 = await bag()
  ok(m0 === 5000 && m0 - m1 === LOTS.venium.price + LOTS.eurleen.price, `nyx: Marks down by both lots (${m0} -> ${m1})`)
  ok((b1.venium ?? 0) - (b0.venium ?? 0) === LOTS.venium.n && (b1.eurleen ?? 0) - (b0.eurleen ?? 0) === LOTS.eurleen.n, `nyx: ${LOTS.venium.n} Venium + ${LOTS.eurleen.n} Eurleen in the bag (${b1.venium}, ${b1.eurleen})`)
  await kp.screenshot({ path: `${out}/b-bought.png` })
} catch (e) { ok(false, `nyx threw: ${String(e).slice(0, 300)}`) }
finally {
  try {
    if (published) { const r = await bpost({ action: 'rollback', v: liveV0 ?? 1 }); ok(!!r && !r.status, `cleanup: rolled the fixture publish back to v${liveV0 ?? 1}`) }
    await bpost({ action: 'draft', layer: start.draft })
    const end = await bget()
    ok(!!end && JSON.stringify(end.draft) === startDraft, 'nyx: the draft is back exactly')
    ok(await pubText() === liveText0, 'nyx: the live layer is back exactly (JSON identical)')
  } catch (e) { ok(false, `RESTORE FAILED: ${String(e)} - roll back from the editor's history by hand`) }
}

// ── 2-4. Ather: the Smithy ──
const smith: Room = { id: 'smith-m134s2', kind: 'smith', x: -100, z: 100, q: 0, placedAt: 0, doneAt: 0, store: [] }
try {
  await kp.evaluate((rooms: Room[]) => {
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms, chests: [], pieces: [] }))
    localStorage.setItem('open.skills.v1', JSON.stringify([{ id: 'forestry', level: 10, xp: 0 }, { id: 'prospecting', level: 4, xp: 0 }]))
    localStorage.setItem('open.tools.v1', JSON.stringify({ forestry: { toolId: 'starwillow_blade', usesRemaining: 200, speedBonus: 0.8, xpBonus: 1.35 } }))
  }, [smith])
  const load = async () => {
    await kp.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
    await kp.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
    await dismissStartCard(kp)
  }
  const tools = async () => (await kp.evaluate(() => JSON.parse(localStorage.getItem('open.tools.v1') ?? '{}'))).forestry as { edge?: { on: string | null; left: Record<string, number> } }
  const wearTo = async (m: string, n: number) => { await kp.evaluate((mm: string, k: number) => { const t = JSON.parse(localStorage.getItem('open.tools.v1') ?? '{}'); t.forestry.edge.left[mm] = k; localStorage.setItem('open.tools.v1', JSON.stringify(t)); window.dispatchEvent(new Event('open:tools')) }, m, n); await sleep(600) }
  const openEdges = async () => {
    const b = benchOf(smith); await kp.evaluate((x, z) => (window as any).__ather.tp(x, z - 1.2, 0), b.x, b.z); await sleep(1500)
    await aimAt(kp, b.x, b.z, 0.6); await kp.keyboard.press('e'); await sleep(1000)
    await clickSel('[data-bench-tab="edges"]'); await sleep(500)
    return kp.evaluate(() => !!document.querySelector('[data-panel="bench"] [data-edges]'))
  }
  const fit = async (m: string) => { await clickSel(`[data-edge-family="forestry"] [data-edge-metal="${m}"] button`); await sleep(800) }
  const onNow = () => kp.evaluate(() => document.querySelector('[data-edge-family="forestry"]')?.getAttribute('data-edge-on') ?? null)
  await load()
  ok(await openEdges(), 'smithy: E at the bench -> Edges tab open')
  const g0 = await bag()
  await fit('venium')
  let t = await tools(), g = await bag()
  ok(t?.edge?.on === 'venium' && t.edge.left.venium === EDGE.venium.uses && g0.venium - g.venium === FIT_METAL, `fit Venium: on, full, ${FIT_METAL} of the bought Venium spent (${g0.venium} -> ${g.venium})`)
  await wearTo('venium', 10)
  await fit('eurleen'); t = await tools(); const g2 = await bag()
  ok(t?.edge?.on === 'eurleen' && t.edge.left.eurleen === EDGE.eurleen.uses && t.edge.left.venium === 10 && g0.eurleen - g2.eurleen === FIT_METAL, `swap to Eurleen: a new edge (${FIT_METAL} spent), the Venium edge kept at 10 (${JSON.stringify(t?.edge)})`)
  await kp.screenshot({ path: `${out}/c-swapped-eurleen.png` })
  await wearTo('eurleen', 20)
  await fit('venium'); t = await tools(); const g3 = await bag()
  ok(t?.edge?.on === 'venium' && t.edge.left.venium === 10 && t.edge.left.eurleen === 20 && g3.venium === g2.venium && g3.eurleen === g2.eurleen, `swap back to Venium: free, both wears kept (${JSON.stringify(t?.edge)})`)
  ok(await onNow() === 'venium', 'panel: Venium shown on')
  // 3. Repair all: the total first
  const want = { venium: repairCost('venium', 10), eurleen: repairCost('eurleen', 20) }
  const costAttr = await kp.evaluate(() => document.querySelector('[data-repair-all]')?.getAttribute('data-repair-cost') ?? null)
  ok(costAttr === `${want.venium} Venium + ${want.eurleen} Eurleen`, `repair all offered for ${costAttr}`)
  await clickSel('[data-repair-ask] button'); await sleep(500)
  const ask = await kp.evaluate(() => document.querySelector('[data-repair-total]')?.textContent ?? '')
  const g4 = await bag(), t4 = await tools()
  ok(ask.includes(`${want.venium} Venium + ${want.eurleen} Eurleen`) && g4.venium === g3.venium && g4.eurleen === g3.eurleen && t4?.edge?.left.venium === 10, `repair all: the total shows FIRST ("${ask}"), nothing charged yet`)
  await kp.screenshot({ path: `${out}/d-repair-all-cost.png` })
  await clickSel('[data-repair-confirm] button'); await sleep(900)
  const g5 = await bag(), t5 = await tools()
  ok(g3.venium - g5.venium === want.venium && g3.eurleen - g5.eurleen === want.eurleen, `repair all: charged exactly the total (V ${g3.venium}->${g5.venium}, E ${g3.eurleen}->${g5.eurleen})`)
  ok(t5?.edge?.on === 'venium' && t5.edge.left.venium === EDGE.venium.uses && t5.edge.left.eurleen === EDGE.eurleen.uses, `repair all: both edges full (${JSON.stringify(t5?.edge)})`)
  ok(!(await kp.$('[data-repair-all]')), 'repair all: nothing left to repair, the row is gone')
  await kp.screenshot({ path: `${out}/e-repaired.png` })
  await kp.keyboard.press('Escape'); await sleep(500)
  // 4. reload keeps all
  await load()
  const t6 = await tools(), g6 = await bag()
  ok(t6?.edge?.on === 'venium' && t6.edge.left.venium === EDGE.venium.uses && t6.edge.left.eurleen === EDGE.eurleen.uses && g6.venium === g5.venium && g6.eurleen === g5.eurleen, `reload keeps the edges + the bag (${JSON.stringify(t6?.edge)}, V ${g6.venium} E ${g6.eurleen})`)
  await openEdges()
  await kp.screenshot({ path: `${out}/f-reload.png` })
} catch (e) { ok(false, `ather threw: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`)
await br.close()
console.log(`shots: ${out}`)
console.log(fails ? `\nM134 s2 FAIL (${fails})` : '\nM134 s2 ALL PASS')
process.exit(fails ? 1 : 0)
