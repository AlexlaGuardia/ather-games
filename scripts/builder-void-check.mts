// ── WORLD BUILDER: THE VOID BRUSH (BETA M104, world lane, 11-23) ──────────────────────────────────────────────────────────────
// Alex 11-23: "an eraser to remove the lines that are marked for it.. a few areas that the voids dont make too much sense".
// The voids are generated (wilds-voids makeVoids); the builder's void brush stores erase/paint cells in the Wilds DRAFT layer
// (`voids`, void-edits.ts), applied over makeVoids everywhere voids are read. End to end:
//   A. a generated void strip P near the first tile (pure field, the same files the game reads), and a neck whose paint seals a
//      region (the pure guard, world/void-guard.ts)
//   B. owner opens ?mode=builder (the Wilds): P is void in the draft field, the tile view pixel there is void-dark
//   C. ERASE across P (the hook = the brush's own path): the draft field says ground at P, the tile re-parses and its pixel is not
//      void-dark, the ground at P stands at the rim (not the pit), the overview's void pixels in that tile drop; Save: LIVE UNCHANGED
//   D. (prod) PUBLISH: the public wilds-edits carries the voids; a fresh keeper walks across where the void was: never falls, ends on
//      the far side; the game's ground at P is the rim
//   E. PAINT over the sealing neck, Publish: REFUSED, the status names the zone, live unchanged (nothing written)
//   F. ALWAYS: roll back to the version live at the start (live byte-for-byte as it was), the draft put back; the Glade's + Nyx's
//      drafts and live layers never changed. Brush disabled on the Glade with its note. 0 page errors.
// ★ AFTER a prod run: the new files under world/builder/wilds/ (class 'data') must be committed (M94).
// SETUP: OWNER_KEY from .env or env (BOX; take the browser lock).
//   npx tsx scripts/builder-void-check.mts [--url https://ather.games] [--out dir] [--local]   (--local: no publish, no keeper)
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { makeVoids, type IndexLike } from '../src/app/shimmer/open/ather/wilds-voids'
import { paintVoids } from '../src/app/shimmer/open/ather/void-edits'
import { voidGuard } from '../src/app/shimmer/world/void-guard'
import { withGlade, type Network } from '../src/app/shimmer/open/ather/network'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/builder-void-check'), LOCAL = process.argv.includes('--local')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── A. the pure picks ──
const index = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as IndexLike & { tiles: { name: string; tx: number; ty: number }[] }
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
const V0 = makeVoids(index, net)
const raw = new Int16Array(readFileSync('public/open/wilds/first-wilds.bin').buffer.slice(0))
const n = Math.round(Math.sqrt(raw.length)), rawAt = (x: number, z: number) => raw[Math.round((z + 500) / (1000 / (n - 1))) * n + Math.round((x + 500) / (1000 / (n - 1)))] / 10
let P: { x: number; z: number; ax: number; az: number } | null = null
for (let z = -420; z <= 420 && !P; z += 6) for (let x = -420; x <= 420 && !P; x += 6) {
  if (V0.weight(x, z) < 1 || V0.crossingNear(x, z, 150)) continue
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const a = { x: x - ax * 34, z: z - az * 34 }, b = { x: x + ax * 34, z: z + az * 34 }
    if (V0.weight(a.x, a.z) === 0 && V0.weight(b.x, b.z) === 0 && !V0.protectedAt(a.x, a.z) && Math.min(rawAt(a.x, a.z), rawAt(b.x, b.z), rawAt(x, z)) > 8
      && Math.abs(rawAt(a.x, a.z) - rawAt(b.x, b.z)) < 6 && V0.regionAt(a.x, a.z) !== V0.regionAt(b.x, b.z)) { P = { x, z, ax, az }; break }
  }
}
ok(!!P, `A. a generated void strip on first-wilds: ${P ? `(${P.x}, ${P.z}) across ${P.ax ? 'x' : 'z'}` : 'none'}`)
const ways = new Map<number, number>(); for (const c of V0.crossings) for (const r of [c.a, c.b]) ways.set(r, (ways.get(r) ?? 0) + 1)
let seal: { x: number; z: number; zone: string } | null = null
for (const c of V0.crossings.filter(c => c.kind === 'neck' && (ways.get(c.a) === 1 || ways.get(c.b) === 1)).slice(0, 12)) {
  if (voidGuard(index, net, paintVoids(undefined, c.x, c.z, 28, 1))) { seal = { x: c.x, z: c.z, zone: V0.regions[ways.get(c.a) === 1 ? c.a : c.b].zone }; break }
}
ok(!!seal, `A. a neck whose paint seals a region: ${seal ? `(${seal.x}, ${seal.z}) -> ${seal.zone}` : 'none'}`)
if (!P || !seal) process.exit(1)

type Maps = Record<string, Record<string, number>>
type LayerJ = { tiles?: Maps; water?: Maps; falls?: Maps; voids?: Record<string, number> }
interface Snap { draft: LayerJ; draftAt: number | null; live: LayerJ; index: { live: number | null; versions: { v: number; note: string; from?: number }[] }; state: string }
const pubRaw = async (m: string) => { const r = await fetch(`${url}/shimmer/open/${m}-edits`, { cache: 'no-store' }); if (!r.ok) throw new Error(`${m}-edits ${r.status}`); return r.text() }

const br: Browser = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.evaluateOnNewDocument('window.__name = (f) => f')
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await op.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
const bget = (map: string) => op.evaluate(async (m: string) => {
  for (let i = 0; i < 6; i++) { const r = await fetch(`/shimmer/save-builder?map=${m}`, { cache: 'no-store' }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 1500)) }
  return null }, map) as Promise<Snap | null>
const bpost = (body: Record<string, unknown>) => op.evaluate(async (b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'wilds', ...b }) }); return { status: r.status, j: await r.json() } }, body) as Promise<{ status: number; j: Snap & { error?: string } }>
const start = await bget('wilds'), gladeStart = await bget('glade'), nyxStart = await bget('nyx')
ok(!!start && !!gladeStart && !!nyxStart, `owner: GET save-builder answers (wilds live v${start?.index.live ?? '-'}, ${start?.index.versions.length ?? '?'} versions)`)
if (!start || !gladeStart || !nyxStart) { await br.close(); process.exit(1) }
const liveRaw0 = { wilds: await pubRaw('wilds'), glade: await pubRaw('glade'), nyx: await pubRaw('nyx') }
const liveV0 = start.index.live
let published = false

let ed: Page | null = null
async function openEditor(qs = '') {
  const p = await owner.newPage(); await p.setViewport({ width: 1280, height: 900 })
  p.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/shimmer/dev?mode=builder${qs}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction('window.__terrain?.ready === true', { timeout: 240000, polling: 500 })
  return p
}
const T = (p: Page, f: string, ...a: unknown[]) => p.evaluate((f, a) => { const t = (window as any).__terrain; const v = t[f]; return typeof v === 'function' ? v(...a) : v }, f, a) as Promise<any>
const tilePx = (p: Page, x: number, z: number) => p.evaluate((x: number, z: number) => {
  const c = [...document.querySelectorAll('canvas')].find(c => c.width === c.height && c.width > 200 && c.width < 300) as HTMLCanvasElement | undefined; if (!c) return null
  const t = (window as any).__terrain, o = t.origin(), i = Math.round((x - o.x + 500) / (1000 / (c.width - 1))), j = Math.round((z - o.z + 500) / (1000 / (c.width - 1)))
  const d = c.getContext('2d')!.getImageData(i - 1, j - 1, 3, 3).data; let r = 0, g = 0, b = 0; for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2] } return [r / 9, g / 9, b / 9] }, x, z) as Promise<number[] | null>
const ovVoidPx = (p: Page) => p.evaluate(() => {   // void (NONE) pixels in the open tile's overview box
  const o = (window as any).__overview; if (!o) return -1
  const cs = [...document.querySelectorAll('[data-testid="overview-wrap"] canvas')] as HTMLCanvasElement[], c = cs[0]; if (!c) return -1
  const ctx = c.getContext('2d')!, d = ctx.getImageData(0, 0, c.width, c.height).data
  const t = (window as any).__terrain, name = t.tile, names: string[] = o.names(); if (!names.includes(name)) return -1
  // the open tile is lit amber; count NONE-coloured pixels across the whole canvas (only the open tile changes between reads)
  let nn = 0; for (let k = 0; k < d.length; k += 4) if (d[k] < 40 && d[k + 1] < 40 && d[k + 2] < 50 && d[k + 3] > 0) nn++
  return nn })
const lum = (c: number[] | null) => c ? 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] : -1

try {
  // ── B. the draft field before ──
  ed = await openEditor()
  ok((await T(ed, 'tile')) === 'first-wilds', `B. the builder opens the Wilds on first-wilds (${await T(ed, 'tile')})`)
  const o = await T(ed, 'origin'), lx = P.x - o.x, lz = P.z - o.z
  const before = await T(ed, 'voidAt', lx, lz), pxB = await tilePx(ed, P.x, P.z), hB = await T(ed, 'heightAt', lx, lz), hRim = await T(ed, 'heightAt', lx - P.ax * 34, lz - P.az * 34)
  await sleep(4000); const ovB = await ovVoidPx(ed)
  ok(!!before && before.isVoid && before.w >= 0.99, `B. P is void in the draft field (w ${before?.w?.toFixed(2)}), ground ${hB?.toFixed(1)} m vs rim ${hRim?.toFixed(1)} m; tile pixel lum ${lum(pxB).toFixed(0)}`)
  await ed.screenshot({ path: `${out}/1-before.png` })

  // ── C. ERASE across P ──
  const rev0 = await T(ed, 'voidRev')
  ok(await T(ed, 'voidStroke', lx, lz, 40, -1), 'C. erase stroke (r 40) across P')
  await ed.waitForFunction((r: number) => (window as any).__terrain.voidRev > r && (window as any).__terrain.ready, { timeout: 120000, polling: 300 }, rev0)
  await sleep(1500)
  const after = await T(ed, 'voidAt', lx, lz), pxA = await tilePx(ed, P.x, P.z), hA = await T(ed, 'heightAt', lx, lz)
  ok(!!after && !after.isVoid && after.w === 0, `C. the draft field says ground at P (w ${after?.w})`)
  ok(Math.abs(hA - hRim) < 6 && hA > hB + 15, `C. the re-parsed tile: ground at P ${hA?.toFixed(1)} m stands at the rim (${hRim?.toFixed(1)} m), not the pit (${hB?.toFixed(1)} m)`)
  ok(lum(pxA) > lum(pxB) + 25, `C. tile view: P is no longer void-dark (lum ${lum(pxB).toFixed(0)} -> ${lum(pxA).toFixed(0)})`)
  await sleep(3000); const ovA = await ovVoidPx(ed)
  ok(ovB > 0 && ovA < ovB, `C. overview: void pixels ${ovB} -> ${ovA}`)
  await ed.screenshot({ path: `${out}/2-erased.png` })
  ok(await T(ed, 'save'), 'C. Save')
  const s1 = await bget('wilds')
  ok(!!s1?.draft.voids && Object.keys(s1.draft.voids).length === await T(ed, 'voidCells'), `C. the draft on disk carries ${Object.keys(s1?.draft.voids ?? {}).length} void cells`)
  ok((await pubRaw('wilds')) === liveRaw0.wilds, 'C. LIVE UNCHANGED after Save (players see nothing until Publish)')

  // ── D. PUBLISH + a keeper walks across ──
  if (!LOCAL) {
    ok(await T(ed, 'publish', 'check: builder-void-check erase'), 'D. Publish')
    published = true
    const L = JSON.parse(await pubRaw('wilds')) as LayerJ
    ok(!!L.voids && Object.keys(L.voids).length === Object.keys(s1!.draft.voids!).length, `D. the public wilds-edits carries the voids (${Object.keys(L.voids ?? {}).length} cells)`)
    const kc = await br.createBrowserContext(), kp = await kc.newPage(); await kp.setViewport({ width: 1100, height: 760 })
    kp.on('pageerror', e => errs.push('keeper: ' + String(e).slice(0, 200)))
    await kp.evaluateOnNewDocument('window.__name = (f) => f')
    await kp.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
    await kp.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 })
    await kp.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 })
    await sleep(3000)
    const A = (f: string, ...a: unknown[]) => kp.evaluate((f, a) => (window as any).__ather[f](...a), f, a) as Promise<any>
    const poll = async (f: () => Promise<boolean>, ms = 30000) => { for (let t = 0; t < ms; t += 700) { if (await f().catch(() => false)) return true; await sleep(700) } return false }
    for (let i = 0; i < 12 && (await A('zone')) !== 'wilds'; i++) {
      await A('travel', { kind: 'waymark', w: { id: 'void-brush', tile: 'first-wilds', x: P.x - P.ax * 34, y: 0, z: P.z - P.az * 34, biome: 2, made: 0 } })
      await poll(async () => (await A('zone')) === 'wilds', 15000)
    }
    ok((await A('zone')) === 'wilds', 'D. a fresh keeper in the Wilds')
    await sleep(6000)
    await kp.mouse.click(550, 380); await sleep(800)
    const yaw = Math.atan2(-P.ax, -P.az)
    await A('tp', P.x - P.ax * 30, P.z - P.az * 30, yaw)
    await poll(async () => (await kp.evaluate(() => (window as any).__groundPending?.() ?? 0)) === 0, 120000)
    await sleep(2500)
    const gP = await A('ground', P.x, P.z) as number, gRim = await A('ground', P.x - P.ax * 30, P.z - P.az * 30) as number
    ok(Math.abs(gP - gRim) < 6, `D. the game's ground at P ${gP.toFixed(1)} m = the rim's ${gRim.toFixed(1)} m (no pit)`)
    await kp.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F24' }))); await A('look', yaw, -0.2)
    await kp.keyboard.down('KeyW')
    let fell = false, crossed = false, last = { x: 0, z: 0 }
    const t0 = Date.now()
    while (Date.now() - t0 < 60000) {
      const s = await kp.evaluate(() => { const st = (window as any).__ather.state(); return { x: st.px, z: st.pz, f: !!(window as any).__ather.falling?.() } })
      last = s; if (s.f) fell = true
      const along = (s.x - P.x) * P.ax + (s.z - P.z) * P.az
      if (along > 26) { crossed = true; break }
      await sleep(120)
    }
    await kp.keyboard.up('KeyW')
    await kp.screenshot({ path: `${out}/3-keeper-crossed.png` })
    ok(!fell && crossed, `D. the keeper walked across where the void was: fell ${fell}, ended at (${last.x.toFixed(1)}, ${last.z.toFixed(1)}), ${((last.x - P.x) * P.ax + (last.z - P.z) * P.az).toFixed(1)} m past P`)
    await kc.close()
  }

  // ── E. PAINT a seal: Publish refused, naming the zone ──
  const liveMid = await pubRaw('wilds'), idxMid = (await bget('wilds'))!.index
  const rev1 = await T(ed, 'voidRev')
  ok(await T(ed, 'voidStroke', seal.x - o.x, seal.z - o.z, 28, 1), `E. paint over the neck at (${seal.x}, ${seal.z})`)
  await ed.waitForFunction((r: number) => (window as any).__terrain.voidRev > r, { timeout: 120000, polling: 300 }, rev1)
  const okPub = await T(ed, 'publish', 'check: builder-void-check seal')
  await sleep(500)
  const st = await T(ed, 'status')
  ok(!okPub && /Publish refused/.test(st) && st.includes(seal.zone), `E. Publish REFUSED naming the zone: "${st}"`)
  const idxAfter = (await bget('wilds'))!.index
  ok((await pubRaw('wilds')) === liveMid && idxAfter.versions.length === idxMid.versions.length, 'E. nothing written: live + history unchanged')
  await ed.screenshot({ path: `${out}/4-refused.png` })

  // the Glade: brush disabled, one-line note
  const gp = await openEditor('&map=glade')
  const g = await gp.evaluate(() => ({ dis: (document.querySelector('[data-testid="brush-void"]') as HTMLButtonElement | null)?.disabled, note: document.querySelector('[data-testid="void-note"]')?.textContent ?? '' }))
  ok(g.dis === true && /no cloud voids/.test(g.note), `the Glade: void brush disabled, note "${g.note}"`)
  await gp.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally {
  // ── F. put everything back ──
  if (published && liveV0 !== null) {
    const r = await bpost({ action: 'rollback', v: liveV0 })
    ok(r.status === 200, `F. rolled back to v${liveV0} (now v${r.j.index?.live})`)
  }
  const r2 = await bpost({ action: 'draft', layer: start.draft })
  ok(r2.status === 200, 'F. the Wilds draft put back')
  const end = { wilds: await pubRaw('wilds'), glade: await pubRaw('glade'), nyx: await pubRaw('nyx') }
  ok(end.wilds === liveRaw0.wilds, `F. Wilds live layer byte-for-byte as at the start (${end.wilds.length} bytes)`)
  ok(end.glade === liveRaw0.glade && end.nyx === liveRaw0.nyx, 'F. Glade + Nyx live layers unchanged')
  const ge = await bget('glade'), ne = await bget('nyx'), we = await bget('wilds')
  ok(JSON.stringify(ge?.draft) === JSON.stringify(gladeStart.draft) && JSON.stringify(ne?.draft) === JSON.stringify(nyxStart.draft), 'F. Glade + Nyx drafts unchanged')
  ok(JSON.stringify(we?.draft) === JSON.stringify(start.draft), 'F. Wilds draft as at the start')
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
  await br.close()
  console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
  process.exit(fails ? 1 : 0)
}
