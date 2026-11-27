// BETA M223 s1 (Alex 11-27; RULED athernyx e3c310e): VENIUM + EURLEEN SEAMS, painted in the World Builder, found in the Wilds.
//   1. OWNER desk (this box, OWNER_KEY): World Builder > Wilds > Nodes offers 'Venium seam' + 'Eurleen seam'; one REAL click each
//      (thickness 4) paints them; Save -> reload reads them back; Publish carries them to the live layer. ★ Every save-builder POST
//      is answered by the check (a scratch draft / live): the real store's hashes are read before and after and must not move.
//   2. a FRESH keeper (390x844, no owner key) on the SCRATCH layer (live + the painted seams), holding the Starwillow Spike:
//      the spike panel lists 'Venium:36:ok' + 'Eurleen:36:ok'; in the Wilds the page holds Venium + Eurleen nodes inside the
//      seams (none outside); aimed at one of each, the prompt names it, worked to the end it pays 1-2 of its metal (bag + ground)
//      and is growing back.
//   OWNER_KEY=... npx tsx scripts/m223-seam-check.mts [--url https://ather.games] [--out docs/looks/m223-2026-11-27]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { parseWilds, BIOME, type WildsMeta, type Wilds } from '../src/app/shimmer/open/ather/wilds'
import type { Zone } from '../src/app/shimmer/open/ather/forestry'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m223-2026-11-27')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
type W = any
const errs: string[] = [], posts: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

// ── the plan: two dry, gentle spots on Greg's tile near his waymark (where a fresh keeper lands), 60 m apart ──
const D = 'public/open/wilds/'
const tiles = (JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }[] }).tiles
const g = tiles.find(t => t.name === 'first-wilds')!
const meta = JSON.parse(readFileSync(D + g.name + '.json', 'utf8')) as WildsMeta, bin = readFileSync(D + g.name + '.bin')
const dm = new Int16Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)), bio = new Uint8Array(readFileSync(D + g.name + '.biome'))
const zm = new Map(g.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
const parse = (nz?: Record<string, number>): Wilds => parseWilds(meta, dm, bio, (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone, undefined, true, null, null, null, null, null, nz ?? null)
const W0 = parse(), TX = g.tx * 1000, TZ = g.ty * 1000
const dry = (x: number, z: number) => W0.biomeAt(x, z) !== BIOME.water && W0.heightAt(x, z) > meta.waterY + 2
const spots: { x: number; z: number }[] = []   // tile-local
for (let r = 40; r <= 200 && spots.length < 2; r += 20) for (let a = 0; a < 16 && spots.length < 2; a++) {
  const x = -300 + Math.cos(a * Math.PI / 8) * r, z = 300 + Math.sin(a * Math.PI / 8) * r
  let n = 0; for (let u = -16; u <= 16; u += 4) for (let v = -16; v <= 16; v += 4) if (dry(x + u, z + v) && Math.abs(W0.heightAt(x + u + 1, z + v) - W0.heightAt(x + u - 1, z + v)) < 1) n++
  if (n >= 75 && spots.every(s => Math.hypot(s.x - x, s.z - z) > 60)) spots.push({ x, z })
}
ok(spots.length === 2, `plan: two dry spots on ${g.name} near Greg's waymark (${spots.map(s => `${s.x.toFixed(0)},${s.z.toFixed(0)}`).join(' / ')})`)

let mockDraft: any = null, mockLive: any = null, real: any = null
const store = (o: Page) => o.evaluate(async () => (await fetch('/shimmer/save-builder?map=wilds', { cache: 'no-store', headers: { 'x-m223-real': '1' } })).json()) as Promise<any>
const hashes = (s: any) => ({ draft: hash(s.draft), live: hash(s.live), v: s.index.live, n: s.index.versions.length })
function intercept(o: Page) {
  o.on('request', (r: HTTPRequest) => {
    const u = r.url()
    if (!u.includes('/shimmer/save-builder')) { r.continue(); return }
    if (r.method() === 'POST') {
      const b = JSON.parse(r.postData() ?? '{}'); posts.push(b.action)
      if (b.action === 'draft') mockDraft = b.layer
      if (b.action === 'publish') mockLive = mockDraft
      r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...real, ok: true, map: 'wilds', draft: mockDraft ?? real.draft, draftAt: Date.now(), live: mockLive ?? real.live, state: 'unpublished changes' }) }); return
    }
    if (mockDraft && !r.headers()['x-m223-real']) { r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...real, draft: mockDraft, draftAt: Date.now() }) }); return }
    r.continue()
  })
}
const liveTxt = await (await fetch(`${url}/shimmer/open/wilds-edits`, { cache: 'no-store' } as any)).text()

const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const BAG = { v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }
const TOOLS = { prospecting: { toolId: 'starwillow_spike', usesRemaining: 120, speedBonus: 0.8, xpBonus: 1.2 } }
const metalHeld = (p: Page, id: string) => p.evaluate((id: string) => { try {
  const bag = (JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')?.slots ?? []).filter((s: any) => s?.id === id).reduce((a: number, s: any) => a + s.n, 0)
  const ground = Object.keys(localStorage).filter(k => k.startsWith('open.loot.v1')).flatMap(k => { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); return Array.isArray(v) ? v : v?.drops ?? [] }).filter((l: any) => l?.item === id).reduce((a: number, l: any) => a + l.n, 0)
  return bag + ground } catch { return -1 } }, id)

try {
  // ── 1. the owner paints the two seams ──
  const owner = await br.createBrowserContext(), o = await owner.newPage()
  o.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
  await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  real = await store(o); const h0 = hashes(real)
  console.log(`  real store before ${JSON.stringify(h0)}, live nodes ${Object.keys(real.live.nodes ?? {}).length}`)
  await o.setRequestInterception(true); intercept(o)
  const openEd = async () => {
    await o.goto(`${url}/shimmer/dev?mode=terrain&map=wilds`, { waitUntil: 'load', timeout: 240000 })
    await o.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "wilds" && window.__terrain?.tile === "first-wilds" && !!window.__terrain?.origin()', { timeout: 240000, polling: 500 })
    await sleep(1500)
  }
  await openEd()
  const org = await o.evaluate(() => (window as W).__terrain.origin()) as { x: number; z: number }
  const cv = (await (await o.$('[data-testid="terrain-canvas"]'))!.boundingBox())!
  const px = (x: number, z: number) => ({ x: cv.x + ((x - org.x + 500) / 1000) * cv.width, y: cv.y + ((z - org.z + 500) / 1000) * cv.height })
  await o.click('[data-testid="brush-nodes"]'); await sleep(500)
  const labels = await o.evaluate(() => [...document.querySelectorAll('[data-testid="nodes-kinds"] button')].map(b => b.textContent?.trim()))
  ok(labels.includes('Venium seam') && labels.includes('Eurleen seam'), `1a. the Nodes brush offers the seams (${labels.join(' / ')})`)
  const before = Object.keys(await o.evaluate(() => (window as W).__terrain.nodeCells())).length
  for (const [k, s] of [['venium', spots[0]], ['eurleen', spots[1]]] as const) {
    await o.click(`[data-testid="nodes-${k}"]`); await sleep(300); await o.click('[data-testid="nodes-d4"]'); await sleep(300)
    const c = px(TX + s.x, TZ + s.z); await o.mouse.click(c.x, c.y); await sleep(800)
  }
  await o.screenshot({ path: `${out}/a-owner-brush.png` }).catch(() => {})
  const cells = await o.evaluate(() => (window as W).__terrain.nodeCells()) as Record<string, number>
  const nv = Object.values(cells).filter(v => v === 34).length, ne = Object.values(cells).filter(v => v === 44).length
  ok(nv > 3 && ne > 3 && Object.keys(cells).length === before + nv + ne, `1b. one real click each painted ${nv} Venium + ${ne} Eurleen cells (thickness 4)`)
  await o.evaluate(() => (window as W).__terrain.save()); await sleep(1500)
  await openEd()
  const back = await o.evaluate(() => (window as W).__terrain.nodeCells()) as Record<string, number>
  ok(JSON.stringify(Object.entries(back).sort()) === JSON.stringify(Object.entries(cells).sort()), '1c. Save -> reload reads the seams back')
  await o.evaluate(() => (window as W).__terrain.publish('m223-seam-check')); await sleep(1500)
  ok(posts.includes('publish') && JSON.stringify(Object.entries(mockLive?.nodes ?? {}).sort()) === JSON.stringify(Object.entries(cells).sort()), '1d. Publish carries them to the scratch live layer')
  // (interception stays on: the store read carries x-m223-real, which the handler lets through to the real route)
  const h1 = hashes(await store(o))
  ok(JSON.stringify(h1) === JSON.stringify(h0), `1e. the REAL store did not move (${JSON.stringify(h1)})`)
  await owner.close()

  // ── 2. a fresh keeper on the scratch layer ──
  const nodes = mockLive.nodes as Record<string, number>
  const scratch = JSON.stringify({ ...JSON.parse(liveTxt), nodes })
  const W1 = parse(nodes), oldIds = new Set(W0.crystals.map(c => c.id))
  const plan = (kind: string) => W1.crystals.filter(c => c.kind === kind && !oldIds.has(c.id)).map(c => {
    for (let a = 0; a < 8; a++) {
      const sx = c.x + Math.cos(a * Math.PI / 4) * 4.5, sz = c.z + Math.sin(a * Math.PI / 4) * 4.5, sy = W1.heightAt(sx, sz)
      if (W1.biomeAt(sx, sz) === BIOME.water || sy < meta.waterY + 0.6 || Math.abs(sy - c.y) > 1.2) continue
      if (W1.trees.some(t => Math.hypot(t.x - sx, t.z - sz) < 2.5) || W1.crystals.some(o => o !== c && Math.hypot(o.x - sx, o.z - sz) < 2.5)) continue
      if (W1.crystals.some(o => o !== c && Math.hypot(o.x - sx, o.z - sz) < 5.5 && Math.abs(Math.atan2(o.z - sz, o.x - sx) - Math.atan2(c.z - sz, c.x - sx)) < 0.4)) continue
      if (W1.trees.some(t => Math.hypot(t.x - sx, t.z - sz) < 5.5 && Math.abs(Math.atan2(t.z - sz, t.x - sx) - Math.atan2(c.z - sz, c.x - sx)) < 0.4)) continue
      return { id: c.id, cx: c.x, cz: c.z, cy: c.y, s: c.s, sx, sz, sy }
    }
    return null
  }).filter(Boolean) as { id: string; cx: number; cz: number; cy: number; s: number; sx: number; sz: number; sy: number }[]
  const targets = { venium: plan('venium'), eurleen: plan('eurleen') }
  ok(targets.venium.length > 0 && targets.eurleen.length > 0, `2a. the scratch layer grows seam nodes with a clear stand (${targets.venium.length} Venium, ${targets.eurleen.length} Eurleen)`)

  const ctx = await br.createBrowserContext(), p = await ctx.newPage()
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  p.on('pageerror', e => errs.push('keeper: ' + String(e).slice(0, 200)))
  await p.setRequestInterception(true)
  p.on('request', r => { if (r.method() === 'GET' && r.url().includes('/shimmer/open/wilds-edits')) r.respond({ status: 200, contentType: 'application/json', body: scratch }); else r.continue() })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m223-seeded')) return
    sessionStorage.setItem('m223-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    localStorage.setItem('open.tools.v1', JSON.stringify(s.TOOLS))
    localStorage.setItem('open.inv.v1', JSON.stringify(s.BAG))
    for (const k of ['open.mined.v1', 'open.gather.v1']) localStorage.removeItem(k)
  }, { TUT, TOOLS, BAG } as any)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  for (let i = 0; i < 40; i++) { await sleep(2000); if (await p.$('[data-dial-btn="prospecting"]')) { await sleep(3000); break } }
  await dismissStartCard(p)
  // the spike panel
  const el = await p.$('[data-dial-btn="prospecting"]'); if (el) await el.tap()
  let rows: string[] = []
  for (let i = 0; i < 12 && !rows.length; i++) { await sleep(300); rows = await p.evaluate(() => [...document.querySelectorAll('[data-tool-panel] [data-node-row]')].map(r => { const x = (r as HTMLElement).dataset; return `${x.nodeRow}:${x.mana}:${x.verdict}` })) }
  ok(rows.includes('Venium:36:ok') && rows.includes('Eurleen:36:ok'), `2b. the Starwillow spike panel lists the seams (${rows.filter(r => /Venium|Eurleen|Ather/.test(r)).join(' / ')})`)
  await p.screenshot({ path: `${out}/b-spike-panel-390.png` }).catch(() => {})
  await p.keyboard.press('Escape'); await sleep(500)
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  await p.waitForFunction(() => !!(window as any).__ather?.mine, { timeout: 120000 })
  const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, x: unknown[]) => (window as W).__ather?.[f]?.(...x), fn, a)
  const frame = async () => { try { await p.screenshot() } catch { /* slow */ } }
  let travelled = false
  for (const kind of ['venium', 'eurleen'] as const) {
    let done = false
    for (const P of targets[kind].slice(0, 4)) {
      if (!travelled) {
        for (let i = 0; i < 8 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: { id: 'check', tile: g.name, x: P.sx, y: P.sy, z: P.sz, biome: 4, made: 0 } }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
        ok((await A('zone')) === 'wilds', '2c. the keeper is in the Wilds'); travelled = true; await sleep(8000)
        // the page's own world: seam nodes stand inside the seams only
        const S0 = spots[0], held = await p.evaluate((x: number, z: number) => (window as W).__wildsNodes?.(x, z, 400) ?? null, TX + S0.x, TZ + S0.z) as { crystals: { id: string; x: number; z: number; kind: string }[] } | null
        const met = (held?.crystals ?? []).filter(c => c.kind === 'venium' || c.kind === 'eurleen')
        const inSeam = (c: { x: number; z: number; kind: string }) => nodes[`${Math.floor(c.x / 8)}_${Math.floor(c.z / 8)}`] === (c.kind === 'venium' ? 34 : 44)
        ok(met.some(c => c.kind === 'venium') && met.some(c => c.kind === 'eurleen') && met.every(inSeam), `2d. the page holds ${met.filter(c => c.kind === 'venium').length} Venium + ${met.filter(c => c.kind === 'eurleen').length} Eurleen nodes, every one inside its seam`)
      }
      const wx = P.sx + TX, wz = P.sz + TZ, dx = P.cx + TX - wx, dz = P.cz + TZ - wz
      const yaw = Math.atan2(-dx, -dz), pitch = -Math.atan2(P.sy + 1.6 - (P.cy + 0.55 * P.s), Math.hypot(dx, dz))
      let aimed: { id: string; kind: string } | null = null
      for (let i = 0; i < 10 && aimed?.id !== P.id; i++) {
        await p.evaluate((a) => { const X = (window as any).__ather; X.tp(a.wx, a.wz, a.yaw); X.look(a.yaw, a.pitch) }, { wx, wz, yaw, pitch }); await sleep(2500)
        await p.evaluate((a) => (window as any).__ather.look(a.yaw, a.pitch), { yaw, pitch }); for (let j = 0; j < 3; j++) await frame()
        aimed = await A('crystal') as { id: string; kind: string } | null
      }
      if (aimed?.id !== P.id) { console.log(`  (could not aim at ${P.id}: ${JSON.stringify(aimed)}; next)`); continue }
      const name = kind === 'venium' ? 'Venium' : 'Eurleen'
      const prompt = await p.evaluate(() => document.body.innerText)
      ok(new RegExp(`${name} \\(36 mana\\)`).test(prompt), `2e. aimed at a ${name} node, the prompt says "${name} (36 mana)" (${(prompt.match(new RegExp(`[^\\n]*${name}[^\\n]*`)) ?? [''])[0].slice(0, 80)})`)
      await p.screenshot({ path: `${out}/c-${kind}-node-390.png` }).catch(() => {})
      const had = await metalHeld(p, kind), t0 = Date.now()
      await A('mine')
      for (let i = 0; i < 6; i++) await frame()
      for (let i = 0; i < 150 && await p.evaluate(() => !!(window as any).__ather.chan?.()); i++) await frame()
      await sleep(1500)
      const got = (await metalHeld(p, kind)) - had
      const spent = await p.evaluate((id) => Object.keys(JSON.parse(localStorage.getItem('open.mined.v1') ?? '{}')).includes(id), P.id)
      ok(spent && got >= 1 && got <= 3, `2f. the Starwillow spike worked the ${name}: +${got} ${kind} in the bag / at its feet (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
      const after = await p.evaluate(() => document.body.innerText)
      ok(new RegExp(`${name}, growing back`).test(after), `2g. the worked ${name} is growing back`)
      await p.screenshot({ path: `${out}/d-${kind}-worked-390.png` }).catch(() => {})
      done = true; break
    }
    ok(done, `2h. a ${kind} node was aimed at and worked`)
  }
  await ctx.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
