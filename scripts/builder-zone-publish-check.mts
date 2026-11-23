// -- CREATIVE MODE: PUBLISH A ZONE'S BUILD INTO THE GAME (BETA M84 s3, world lane, 11-23) --
// Owner, desktop 1280x900, GLADE DRAFT: make a zone (real drag), Build, set a WALL (wide goldwood panel) + a BENCH (real clicks), Save.
//   A. before Publish: the public glade-edits is unchanged; a FRESH keeper (no owner key, 390x844) in the Glade sees NO zone part and
//      walks straight through the wall's spot (the control walk).
//   B. Fly (Creative mode) draws the zone's 2 parts (scene().parts) and nothing else but terrain.
//   C. PUBLISH. A fresh keeper (390x844): the game draws the 2 parts at the zone's spot (world = zone corner + local); the same walk
//      is now STOPPED by the wall; E at the bench and a swing take nothing (bag + works unchanged) and the parts still stand.
//   D. ALWAYS: roll the publish back (the live layer JSON is back exactly), put the Glade draft back exactly. 0 page errors.
// ★ Publish + rollback write version files under world/builder/glade/ (tracked): commit them after a run (coord build refuses dirty data).
//   OWNER_KEY=... npx tsx scripts/builder-zone-publish-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type BrowserContext } from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { GLADE_SIZE } from '../src/app/shimmer/world/glade-builder'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/builder-zone-publish-check')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.evaluateOnNewDocument('window.__name = (f) => f')
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await op.goto(`${url}/shimmer/open/glade-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
type ZJ = { id: string; x0: number; z0: number; x1: number; z1: number; build?: { id: string; item: string; x: number; z: number; q: number }[] }
type Snap = { draft: Record<string, unknown>; live: Record<string, unknown>; index: { live: number | null; versions: { v: number; from?: number }[] } }
const bget = () => op.evaluate(async () => { for (let i = 0; i < 6; i++) { const r = await fetch('/shimmer/save-builder?map=glade', { cache: 'no-store' }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 1500)) } return null }) as Promise<Snap | null>
const bpost = (body: Record<string, unknown>) => op.evaluate(async (b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'glade', ...b }) }); return r.ok ? r.json() : null }, body) as Promise<Snap | null>
const pubText = async () => { const r = await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' }); if (!r.ok) throw new Error(`glade-edits ${r.status}`); return JSON.stringify(await r.json()) }
const start = await bget()
ok(!!start, 'owner: the Glade builder draft answers')
if (!start) { await br.close(); process.exit(1) }
const startDraft = JSON.stringify(start.draft), liveText0 = await pubText(), liveV0 = start.index.live
let published = false

async function openEditor(): Promise<Page> {
  const p = await owner.newPage(); await p.setViewport({ width: 1280, height: 900 })
  p.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  p.on('dialog', d => d.accept())
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const r = await p.goto(`${url}/shimmer/dev?mode=creative&map=glade`, { waitUntil: 'load', timeout: 240000 })
  ok(r?.status() === 200, `?mode=creative answers ${r?.status()}`)
  await p.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "glade"', { timeout: 240000, polling: 500 })
  return p
}
// the zone: Greg's garden (tile-local 100,-114 .. 124,-90 = world -112,98 .. -88,122), as builder-zone-build-check
const A = { x: 100, z: -114 }, Bc = { x: 124, z: -90 }
const W = 24, PAD = 1
const toPx = async (p: Page, q: { x: number; z: number }) => {
  const rc = await p.$eval('[data-testid="terrain-canvas"]', el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height } })
  return { x: rc.l + (q.x + GLADE_SIZE / 2) / GLADE_SIZE * rc.w, y: rc.t + (q.z + GLADE_SIZE / 2) / GLADE_SIZE * rc.h }
}
const planPx = async (p: Page, lx: number, lz: number) => {
  const b = await p.$eval('[data-testid="zb-plan"]', el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height } })
  return { x: b.l + (lx + PAD) / (W + 2 * PAD) * b.w, y: b.t + (lz + PAD) / (W + 2 * PAD) * b.h }
}
const clickPlan = async (p: Page, lx: number, lz: number) => { const q = await planPx(p, lx, lz); await p.mouse.move(q.x - 3, q.y - 3); await p.mouse.move(q.x, q.y); await sleep(80); await p.mouse.click(q.x, q.y); await sleep(250) }
const count = (p: Page) => p.$eval('[data-testid="zone-build"]', e => Number(e.getAttribute('data-parts')))
const WALL = { x: 12, z: 8 }, BENCH = { x: 12, z: 18 }

/** a FRESH keeper (own context, no owner cookie, phone viewport) in the Glade; returns its page + helpers */
async function keeper(tag: string): Promise<{ ctx: BrowserContext; kp: Page; A: (fn: string, ...a: unknown[]) => Promise<unknown> }> {
  const ctx = await br.createBrowserContext(), kp = await ctx.newPage(); await kp.setViewport({ width: 390, height: 844 })
  kp.on('pageerror', e => errs.push(`game ${tag}: ` + String(e).slice(0, 200)))
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
  await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  const Af = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
  await kp.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await kp.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  if ((await Af('zone')) !== 'glade') await Af('travel', { kind: 'glade' })
  for (let i = 0; i < 60 && (await Af('zone')) !== 'glade'; i++) await sleep(1000)
  ok((await Af('zone')) === 'glade', `${tag}: a fresh keeper is in the Glade`)
  await sleep(3500)   // the layer fetch lands
  return { ctx, kp, A: Af }
}
/** stand 3 m south of the wall's centre facing it (yaw 0 = -z), hold W (up to 20 s); the z where the keeper ends */
async function walkAtWall(k: { kp: Page; A: (fn: string, ...a: unknown[]) => Promise<unknown> }, wx: number, wz: number): Promise<number> {
  await k.A('gladeAt', wx, wz + 3, 0); await sleep(2000)
  await k.A('look', 0, -0.1)
  // held until the keeper is 1.5 m past the wall's line, or 20 s (swiftshader frames are slow: the walk is slow too, 11-23 run 1)
  await k.kp.keyboard.down('KeyW')
  for (let t = 0; t < 40; t++) { await sleep(500); if (((await k.A('state')) as { pz: number }).pz < wz - 1.5) break }
  await k.kp.keyboard.up('KeyW'); await sleep(500)
  return ((await k.A('state')) as { pz: number }).pz
}
const zp = (kp: Page) => kp.evaluate(() => ((window as any).__zoneParts?.() ?? null)) as Promise<{ key: string; item: string; x: number; z: number; q: number; y: number }[] | null>

try {
  // ── make the zone + 2 parts on the draft (real drag, real clicks), Save ──
  let p = await openEditor()
  const z0 = ((await p.evaluate('window.__terrain.zones()')) as ZJ[]).length
  ok(z0 === 0, 'the Glade draft has no zone yet')
  await p.keyboard.press('9')
  const pa = await toPx(p, A), pb = await toPx(p, Bc)
  await p.mouse.move(pa.x, pa.y); await p.mouse.down()
  for (let i = 1; i <= 8; i++) { await p.mouse.move(pa.x + (pb.x - pa.x) * i / 8, pa.y + (pb.y - pa.y) * i / 8); await sleep(40) }
  await p.mouse.up(); await sleep(400)
  await p.click('[data-testid="zone-kind-other"]'); await sleep(150)
  await p.click('[data-testid="zone-build-open"]'); await sleep(300)
  await p.click('[data-testid="zb-part-goldwood_panel_wide"]'); await clickPlan(p, WALL.x, WALL.z)
  await p.click('[data-testid="zb-part-goldwood_bench"]'); await clickPlan(p, BENCH.x, BENCH.z)
  ok(await count(p) === 2, 'owner: a zone with 2 parts (a wide wall panel + a bench) on the Glade draft')
  await p.click('[data-testid="zb-done"]'); await sleep(200)
  ok(await p.evaluate('window.__terrain.save()') === true, 'Save writes the draft')
  const zone = ((await p.evaluate('window.__terrain.zones()')) as ZJ[])[0]
  const wall = zone.build!.find(b => b.item === 'goldwood_panel_wide')!, bench = zone.build!.find(b => b.item === 'goldwood_bench')!
  const WW = { x: zone.x0 + wall.x, z: zone.z0 + wall.z }, BW = { x: zone.x0 + bench.x, z: zone.z0 + bench.z }
  console.log(`  zone ${zone.x0},${zone.z0} .. ${zone.x1},${zone.z1}; wall at world ${WW.x}, ${WW.z} (q ${wall.q}); bench at ${BW.x}, ${BW.z}`)

  // ── A: before Publish ──
  ok(await pubText() === liveText0, 'before Publish: the public Glade layer is unchanged (draft only)')
  {
    const k = await keeper('before publish')
    const parts = await zp(k.kp)
    ok(Array.isArray(parts) && parts.length === 0, `before publish: the game draws no zone part (${parts?.length})`)
    const endZ = await walkAtWall(k, WW.x, WW.z)
    ok(endZ < WW.z - 1.4, `control: with nothing published the walk passes the wall's spot (from z ${(WW.z + 3).toFixed(1)} to ${endZ.toFixed(2)})`)
    await k.ctx.close()
  }

  // ── B: Fly shows the build ──
  await p.click('[data-testid="view-fly"]')
  await p.waitForFunction('typeof window.__builderFly?.scene === "function" && window.__builderFly.scene().tiles > 0', { timeout: 120000, polling: 500 })
  await sleep(3000)
  await p.evaluate((x: number, z: number) => (window as any).__builderFly.setCam({ x: x + 6, y: 20, z: z + 14, yaw: 0.4, pitch: -0.7 }), WW.x, WW.z).catch(() => {})
  await sleep(1500)
  const sc = await p.evaluate('window.__builderFly.scene()') as { tiles: number; sea: number; other: string[]; parts: number; partMeshes: number }
  ok(sc.parts === 2 && sc.partMeshes >= 2 && sc.other.length === 0, `Fly (Creative mode) draws the zone's build: ${sc.parts} parts, ${sc.partMeshes} meshes, other ${JSON.stringify(sc.other)}`)
  await p.screenshot({ path: `${out}/fly-build.png` })

  // ── C: Publish, the game ──
  const pubOk = await p.evaluate(`window.__terrain.publish('check: builder-zone-publish-check')`); published = pubOk === true
  ok(published, `PUBLISH ok (${pubOk})`)
  const liveJ = JSON.parse(await pubText()) as { zones?: ZJ[] & { tag?: unknown }[] }
  ok(liveJ.zones?.length === 1 && liveJ.zones[0].build?.length === 2 && !!(liveJ.zones[0] as { tag?: { kind: string } }).tag, 'the public Glade layer now carries the zone, its 2 parts and its tag')
  await p.close()
  {
    const k = await keeper('after publish')
    const parts = await zp(k.kp) ?? []
    const pw = parts.find(q => q.item === 'goldwood_panel_wide'), pbn = parts.find(q => q.item === 'goldwood_bench')
    ok(parts.length === 2 && !!pw && !!pbn && Math.abs(pw.x - WW.x) < 1e-6 && Math.abs(pw.z - WW.z) < 1e-6 && Math.abs(pbn.x - BW.x) < 1e-6 && Math.abs(pbn.z - BW.z) < 1e-6,
      `a fresh keeper's game draws the 2 parts at the zone's spot (${parts.map(q => `${q.item}@${q.x.toFixed(1)},${q.z.toFixed(1)} y${q.y.toFixed(2)}`).join(' ')})`)
    const gy = await k.A('ground', WW.x, WW.z) as number
    ok(!!pw && Math.abs(pw.y - gy) < 0.05, `the wall stands on the ground (${pw?.y.toFixed(2)} vs ground ${gy?.toFixed?.(2)})`)
    const endZ = await walkAtWall(k, WW.x, WW.z)
    ok(endZ > WW.z + 0.15 && endZ < WW.z + 1.2, `COLLISION: the same walk now stops at the wall (z ${endZ.toFixed(2)}, wall face ${(WW.z + 0.15).toFixed(2)})`)
    await k.A('look', 0.6, -0.35); await sleep(1200)
    await k.kp.screenshot({ path: `${out}/game-wall.png` })
    // E at the bench + a swing: nothing is taken, nothing breaks
    const w0 = JSON.stringify(await k.A('works'))
    await k.A('gladeAt', BW.x, BW.z + 1.4, 0); await sleep(1800); await k.A('look', 0, -0.5)
    await k.kp.keyboard.press('KeyE'); await sleep(800)
    await k.kp.keyboard.press('Escape'); await sleep(300)
    await k.kp.mouse.click(195, 420); await sleep(900)
    await k.kp.keyboard.press('Escape'); await sleep(300)
    const w1 = JSON.stringify(await k.A('works')), after = await zp(k.kp) ?? []
    ok(w1 === w0, `E + a swing at the bench take nothing into the keeper's build (${w1})`)
    ok(after.length === 2 && after.some(q => q.item === 'goldwood_bench'), 'the published parts still stand (not picked up, not broken)')
    await k.kp.screenshot({ path: `${out}/game-bench.png` })
    await k.ctx.close()
  }
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
finally {
  try {
    if (published) {
      const r = await bpost({ action: 'rollback', v: liveV0 ?? 1 })
      ok(!!r, `cleanup: rolled the check's publish back to v${liveV0 ?? 1}`)
    }
    await bpost({ action: 'draft', layer: start.draft })
    const end = await bget()
    ok(!!end && JSON.stringify(end.draft) === startDraft, 'the Glade draft is back exactly as it was')
    ok(await pubText() === liveText0, 'the live Glade layer is back exactly (JSON identical)')
  } catch (e) { ok(false, `RESTORE FAILED: ${String(e)} - roll back from the editor's history by hand`) }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`)
  await br.close()
  console.log(`shots: ${out}`)
  console.log(fails ? `\n${fails} FAILED` : '\nPASS')
  process.exit(fails ? 1 : 0)
}
