// BETA M115 s2: THE SEASON CONTRACT on prod at 390x844, ONE FRESH context (never a real save).
// No live Nyx supplier zone exists (placement is Alex's), so, like m134-s2-check, the owner publishes a FIXTURE (live + ONE zone
// tagged Supplier / 'trade-co') and ALWAYS rolls it back (live JSON identical, draft identical).
// SETUP (stated): the fresh keeper's purse seeded to 5,000 Marks. Real E + real clicks:
//   1. Nyx: E at the supplier -> sign a Rootbulb season contract (two taps): Marks down by the contract price ONCE, the row shows
//      12 deliveries left, bulk now 20% off there
//   2. Ather: load -> no Rootbulb in the bank yet (a week has not passed)
//   3. the CLOCK: the saved contract's start moved back 7 days + 1 hour (a seeded save timestamp) -> reload -> ONE lot (10) in the
//      garden bank, landed = 10; reload again + a second tab -> still exactly 10; 0 page errors.
//   OWNER_KEY=... npx tsx scripts/m115-s2-check.mts [--url https://ather.games] [--out docs/looks/m115-s2-2026-11-27]
// ★ Publish + rollback write version files under world/builder/nyx/ (tracked): commit them after a run.
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { DELIVERIES, contractPrice, WEEK_MS } from '../src/app/shimmer/open/business/contracts'
import { SUPPLIER_KINDS } from '../src/app/shimmer/open/business/suppliers'
import { NEW_LEDGER } from '../src/app/shimmer/open/trade'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m115-s2-2026-11-27')
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
  if (localStorage.getItem('m115s2-seeded')) return; localStorage.setItem('m115s2-seeded', '1')
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
  const Z = { id: 'zc-m115s2', x0: s.x, z0: s.z, x1: s.x + 8, z1: s.z + 6, h: 0, prev: {}, tag: { kind: 'supplier', ref: 'trade-co', name: 'Ather Trading Co.', front: 'n' } }
  const D = { x: (Z.x0 + Z.x1) / 2, z: Z.z0 - 0.6 }
  const liveL = JSON.parse(liveText0) as { zones?: unknown[] }
  const d = await bpost({ action: 'draft', layer: { ...liveL, zones: [...(liveL.zones ?? []), Z] } })
  ok(!!d && !d.status, `owner: nyx draft = live + 1 Supplier zone (${d?.status ?? 'ok'})`)
  const pub = await bpost({ action: 'publish', note: 'check: m115-s2-check' }); published = !!pub && !pub.status
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
  const R = LOTS.rootbulb, price = contractPrice(R as any)
  ok(!!(await kp.$('[data-panel="supplier-panel"] [data-contract-buy="rootbulb"]')), 'nyx: E opens the supplier panel; a Rootbulb season contract offered')
  const m0 = await purse()
  await clickSel('[data-contract-buy="rootbulb"] button'); await sleep(600)
  ok(await purse() === m0 && !!(await kp.$('[data-contract-confirm="rootbulb"]')), 'nyx: first tap asks (Sign / Cancel), nothing charged')
  await kp.screenshot({ path: `${out}/a-contract-ask.png` })
  await clickSel('[data-contract-confirm="rootbulb"] button'); await sleep(1200)
  const m1 = await purse()
  ok(m0 === 5000 && m0 - m1 === price, `nyx: signed, Marks down by the contract price ONCE (${m0} -> ${m1}, price ${price})`)
  const row = await kp.evaluate(() => { const e = document.querySelector('[data-contract="rootbulb"]'); return e ? { left: e.getAttribute('data-contract-left'), text: e.textContent } : null })
  ok(row?.left === String(DELIVERIES) && /next in 7 days/.test(row?.text ?? ''), `nyx: the panel shows the contract (${JSON.stringify(row)})`)
  const bulk = await kp.evaluate(() => document.querySelector('[data-buy="rootbulb"]')?.getAttribute('data-price'))
  ok(Number(bulk) === Math.round(R.price * 0.8) && !!(await kp.$('[data-contract-perk]')), `nyx: bulk 20% off there while it runs (${R.price} -> ${bulk})`)
  ok(!(await kp.$('[data-contract-buy="rootbulb"]')), 'nyx: one per material: no second Rootbulb contract offered')
  const saved = await kp.evaluate(() => JSON.parse(localStorage.getItem('open.contracts.v1') ?? 'null'))
  ok(saved?.list?.length === 1 && saved.list[0].id === 'rootbulb' && saved.list[0].landed === 0, `save: open.contracts.v1 holds it (${JSON.stringify(saved)})`)
  await kp.screenshot({ path: `${out}/b-contract-signed.png` })
  await sleep(1500); ok(await purse() === m1, 'nyx: charged once (the purse holds after)')
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

// ── 2-3. Ather: the garden bank, then a week on ──
try {
  const bankN = (p: Page = kp) => p.evaluate(() => { const b = JSON.parse(localStorage.getItem('open.bank.v1') ?? 'null'); return (b?.stacks ?? []).reduce((a: number, s: { id: string; n: number }) => a + (s.id === 'rootbulb' ? s.n : 0), 0) }) as Promise<number>
  const landed = () => kp.evaluate(() => JSON.parse(localStorage.getItem('open.contracts.v1') ?? 'null')?.list?.[0]?.landed ?? null) as Promise<number | null>
  const load = async (p: Page = kp) => {
    await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(3000)
    await dismissStartCard(p)
  }
  await load()
  ok(await bankN() === 0 && await landed() === 0, 'ather: before a week, nothing has landed')
  await kp.evaluate((w: number) => { const k = 'open.contracts.v1', b = JSON.parse(localStorage.getItem(k)!); b.list[0].start -= w + 3600_000; localStorage.setItem(k, JSON.stringify(b)) }, WEEK_MS)
  await load()
  const say = await kp.evaluate(() => document.body.innerText.includes('Ather Trading Co. delivery'))
  ok(await bankN() === LOTS.rootbulb.n && await landed() === LOTS.rootbulb.n, `a week on (seeded start), reload: ONE lot in the garden bank (${await bankN()}, landed ${await landed()})`)
  ok(say, 'ather: the delivery line shows')
  await kp.screenshot({ path: `${out}/c-delivered.png` })
  await load()
  ok(await bankN() === LOTS.rootbulb.n, `reload again: still exactly ${LOTS.rootbulb.n}`)
  const p2 = await ctx.newPage(); await p2.setViewport({ width: 390, height: 844 }); p2.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await load(p2)
  ok(await bankN(p2) === LOTS.rootbulb.n && await landed() === LOTS.rootbulb.n, `a second tab: still exactly ${LOTS.rootbulb.n}`)
  await p2.close()
} catch (e) { ok(false, `ather threw: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`)
await br.close()
console.log(`shots: ${out}`)
console.log(fails ? `\nM115 s2 FAIL (${fails})` : '\nM115 s2 ALL PASS')
process.exit(fails ? 1 : 0)
