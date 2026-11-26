// ── BETA M205 s1 (+ M115): AN ATHER TRADING CO. SUPPLIER ZONE ON NYX OPENS A BUY PANEL (world-M205, 2026-11-26) ──
// No live Nyx zone exists yet (placement is Alex's), so the check brings a FIXTURE and removes it: owner writes the Nyx draft =
// live + ONE zone tagged Supplier / 'trade-co' / name 'Ather Trading Co.' (front N) and PUBLISHES. Then, per viewport
// (390x844 TOUCH: the E pill 'buy'; 1280x800 desktop: the E key), a FRESH keeper (no owner key) on foot at the zone's E point:
//   the crosshair finds it (a supplier with a kind) -> E opens the supplier panel titled with the zone's own name -> buy Rootbulb +
//   Capgrain -> the purse drops by both prices, both lots in the bag (open.inv.v1).
// Then the 390 keeper (owner cookie added for the garden, a cooking room seeded) roasts 1 Rootbulb at the hearth -> Roast Rootbulb.
// ALWAYS: roll the Nyx publish back to the start version (live JSON identical) and the draft back exactly. 0 page errors.
// ★ Publish + rollback write version files under world/builder/nyx/ (tracked): commit them after a run.
//   OWNER_KEY=... npx tsx scripts/m205-market-check.mts [--url https://ather.games] [--out docs/looks/m205-2026-11-26]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m205-2026-11-26')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const PRICES = { rootbulb: 200, capgrain: 250 }, LOT = 10
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

async function freshKeeper(touch: boolean) {
  const ctx = await br.createBrowserContext(), kp = await ctx.newPage()
  await kp.setViewport(touch ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 800 })
  kp.on('pageerror', e => errs.push(`${touch ? 390 : 1280}: ` + String(e).slice(0, 200)))
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
  await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await kp.goto(`${url}/shimmer/open/continent?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await kp.waitForFunction(() => !!(window as any).__drive?.ground, { timeout: 240000 }); await sleep(3000)
  return { ctx, kp }
}
const bagOf = async (kp: Page) => { const inv = await kp.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')) as { slots: ({ id: string; n: number } | null)[] } | null; const r: Record<string, number> = {}; for (const s of inv?.slots ?? []) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const purse = (kp: Page) => kp.evaluate(() => Number(document.querySelector('[data-purse]')?.getAttribute('data-purse') ?? NaN)) as Promise<number>
const clickSel = async (kp: Page, sel: string) => { const b = await kp.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await kp.mouse.click(b.x, b.y); return true }

const start = await bget()
ok(!!start, 'owner: the nyx builder draft answers')
if (!start) process.exit(1)
const startDraft = JSON.stringify(start.draft), liveText0 = await pubText(), liveV0 = start.index.live
let published = false
let cookPage: { ctx: Awaited<ReturnType<typeof br.createBrowserContext>>; kp: Page } | null = null
try {
  // flat dry land near the first place (zone-wilds-nyx-check's finder)
  const probe = await freshKeeper(false)
  const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as { places: { id: string; x: number; z: number }[] }
  const p0 = meta.places[0]
  const s = await probe.kp.evaluate((px: number, pz: number) => {
    const G = (window as any).__drive.ground
    for (let r = 250; r <= 900; r += 25) for (let a = 0; a < 24; a++) {
      const x = Math.round(px + r * Math.cos(a * Math.PI / 12)), z = Math.round(pz + r * Math.sin(a * Math.PI / 12))
      const hs: number[] = []; for (let dx = -8; dx <= 16; dx += 4) for (let dz = -8; dz <= 14; dz += 4) hs.push(G(x + dx, z + dz))
      if (hs.every(h => Number.isFinite(h) && h > 1.5) && Math.max(...hs) - Math.min(...hs) < 1.2) return { x, z }
    }
    return null
  }, p0.x, p0.z) as { x: number; z: number } | null
  await probe.ctx.close()
  ok(!!s, `nyx: flat dry land found near ${p0.id} (${s?.x}, ${s?.z})`)
  if (!s) throw new Error('no land')
  const Z = { id: 'zc-m205', x0: s.x, z0: s.z, x1: s.x + 8, z1: s.z + 6, h: 0, prev: {}, tag: { kind: 'supplier', ref: 'trade-co', name: 'Ather Trading Co.', front: 'n' } }
  const D = { x: (Z.x0 + Z.x1) / 2, z: Z.z0 - 0.6 }
  const liveL = JSON.parse(liveText0) as { zones?: unknown[] }
  const d = await bpost({ action: 'draft', layer: { ...liveL, zones: [...(liveL.zones ?? []), Z] } })
  ok(!!d && !d.status, `owner: the nyx draft = live + 1 Supplier zone (trade-co) (${d?.status ?? 'ok'})`)
  const pub = await bpost({ action: 'publish', note: 'check: m205-market-check' }); published = !!pub && !pub.status
  ok(published, `nyx: PUBLISH ok (${pub?.status ?? 'ok'})`)

  for (const touch of [true, false]) {
    const tag = touch ? '390' : 'desk'
    const { ctx, kp } = await freshKeeper(touch)
    const Dv = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as any).__drive?.[f]?.(...x), fn, a)
    if (touch) { const coarse = await kp.evaluate(() => matchMedia('(pointer: coarse)').matches); ok(coarse, `${tag}: the page sees a touch screen`) }
    // on foot (E gets out of the courser; on a phone the pill does the same)
    await kp.keyboard.press('KeyE'); await sleep(1500)
    const at = async (x: number, z: number, yaw: number, pitch: number) => { await Dv('footTp', x, z, yaw, pitch); await sleep(2500) }
    await at(D.x, D.z - 3, Math.PI, -0.1)
    ok((await Dv('foot') as { mode: string }).mode === 'foot', `${tag}: a fresh keeper (no owner key) is on foot on the continent`)
    const ds = await kp.evaluate(() => (window as any).__nyxZones?.doors() ?? []) as { x: number; z: number; u: { kind: string; sells?: string } }[]
    ok(ds.length === 1 && Math.abs(ds[0].x - D.x) < 1e-6 && Math.abs(ds[0].z - D.z) < 1e-6 && ds[0].u.sells === 'trade-co', `${tag}: ONE E point, a supplier selling trade-co (${JSON.stringify(ds.map(q => q.u))})`)
    let reach: { kind?: string; sells?: string } | null = null
    for (let t = 0; t < 4 && !reach?.sells; t++) { await at(D.x, D.z - 1.6, Math.PI, -0.25 - t * 0.1); reach = await kp.evaluate(() => (window as any).__nyxZones?.reach() ?? null) }
    ok(reach?.kind === 'supplier' && reach.sells === 'trade-co', `${tag}: the crosshair finds the market's E point (${JSON.stringify(reach)})`)
    if (touch) {
      ok(await kp.evaluate(() => !!document.querySelector('[data-touch="buy"]')), `${tag}: the E pill reads 'buy'`)
      await kp.screenshot({ path: `${out}/${tag}-a-reach.png` })
      await clickSel(kp, '[data-touch="buy"]')
    } else await kp.keyboard.press('KeyE')
    await sleep(1500)
    const title = await kp.evaluate(() => document.querySelector('[data-panel="supplier-panel"]')?.textContent ?? '') as string
    ok(title.includes('Ather Trading Co.') && title.includes('Rootbulb') && title.includes('Capgrain'), `${tag}: E opens the supplier panel, titled with the zone's name, Rootbulb + Capgrain listed`)
    await kp.screenshot({ path: `${out}/${tag}-b-panel.png` })
    const m0 = await purse(kp), b0 = await bagOf(kp)
    await clickSel(kp, '[data-buy="rootbulb"] button'); await sleep(700)
    await clickSel(kp, '[data-buy="capgrain"] button'); await sleep(1000)
    const m1 = await purse(kp), b1 = await bagOf(kp)
    ok(Number.isFinite(m0) && m0 - m1 === PRICES.rootbulb + PRICES.capgrain, `${tag}: Marks went down by both lots (${m0} -> ${m1})`)
    ok((b1.rootbulb ?? 0) - (b0.rootbulb ?? 0) === LOT && (b1.capgrain ?? 0) - (b0.capgrain ?? 0) === LOT, `${tag}: both lots in the bag (rootbulb ${b1.rootbulb ?? 0}, capgrain ${b1.capgrain ?? 0})`)
    await kp.screenshot({ path: `${out}/${tag}-c-bought.png` })
    if (touch) cookPage = { ctx, kp }; else await ctx.close()
  }
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
finally {
  try {
    if (published) { const r = await bpost({ action: 'rollback', v: liveV0 ?? 1 }); ok(!!r && !r.status, `cleanup: rolled the check's publish back to v${liveV0 ?? 1}`) }
    await bpost({ action: 'draft', layer: start.draft })
    const end = await bget()
    ok(!!end && JSON.stringify(end.draft) === startDraft, 'nyx: the draft is back exactly as it was')
    ok(await pubText() === liveText0, 'nyx: the live layer is back exactly (JSON identical)')
  } catch (e) { ok(false, `RESTORE FAILED: ${String(e)} - roll back from the editor's history by hand`) }
}

// ── the bought Rootbulb roasts at the hearth (the 390 keeper's own bag; a cooking room seeded into the garden) ──
if (cookPage) {
  const { kp } = cookPage
  try {
    const COOK: Room = { id: 'm205-cook', kind: 'cooking', x: -100, z: 112, q: 0, placedAt: 1, doneAt: 2, store: [] }
    await kp.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
    await kp.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
    await kp.evaluate((room: unknown) => localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] })), COOK)
    await kp.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 }); await kp.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
    const b = benchOf(COOK)
    await kp.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.4); await sleep(2000)
    await aimAt(kp, b.x, b.z, 0.6); await kp.keyboard.press('e'); await sleep(1200)
    ok(await kp.evaluate(() => !!document.querySelector('[data-panel="bench"] [data-job="roast-roast_rootbulb"]')), 'cook: the hearth lists Roast: Rootbulb')
    await clickSel(kp, '[data-job-pick="roast-roast_rootbulb"]'); await sleep(300)
    await clickSel(kp, '[data-src-item="rootbulb"] [data-move="all"]'); await sleep(400)
    await clickSel(kp, '[data-qty="1"]'); await sleep(200)
    await kp.screenshot({ path: `${out}/390-d-hearth.png` })
    await clickSel(kp, '[data-act="focus"] button')
    const outOf = async () => { const w = await kp.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? 'null')) as { rooms: Room[] }; let n = 0; for (const s of (w?.rooms?.find(r => r.id === COOK.id)?.out ?? []) as ({ id: string; n: number } | null)[]) if (s?.id === 'roast_rootbulb') n += s.n; return n }
    let roasted = 0; const t0 = Date.now(); while (Date.now() - t0 < 120000) { roasted = await outOf(); if (roasted >= 1) break; await sleep(500) }
    ok(roasted >= 1, `cook: a bought Rootbulb roasted -> Roast Rootbulb (${roasted})`)
    await kp.screenshot({ path: `${out}/390-e-roasted.png` })
  } catch (e) { ok(false, `cook threw: ${String(e).slice(0, 300)}`) }
  await cookPage.ctx.close()
}
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`)
await br.close()
console.log(`shots: ${out}`)
console.log(fails ? `\nM205 FAIL (${fails})` : '\nM205 ALL PASS')
process.exit(fails ? 1 : 0)
