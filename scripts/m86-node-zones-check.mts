// ── BETA M86: NODE ZONES ON THE WILDS (World Builder p4, owner desktop + a fresh keeper 390x844) ── (built on m85-scatter-check.mts)
// READ ONLY against prod (ather.games is Alex's live save): every POST to save-builder is answered IN THE PAGE from a mock store (draft
// = what the editor saved, live = the draft at Publish), a reload reads that mock draft back, and the keeper tabs get the SCRATCH layer.
//   keeper BEFORE (fresh, 390x844): the real live layer; the trees + crystals the game holds round Greg's waymark (__wildsNodes probe)
//     -> the busiest tree row near the waymark (the path goes across it) and a spot on land for the crystal bed.
//   owner (1280x900): Builder on the Wilds, top-down; brush 'Nodes', 'No nodes', radius 8, a REAL mouse drag across the tree row;
//     'Crystal bed', thickness 4, radius 16, a REAL click on the spot; Save, RELOAD keeps the cells, Publish carries them.
//   keeper AFTER (fresh): real live layer + the published `nodes`: no tree / crystal / stone on the path, more crystals in the bed,
//     every node outside the painted cells the same id at the same spot; 0 page errors. The real store hashed before/after: unchanged.
//   OWNER_KEY=... npx tsx scripts/m86-node-zones-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m86-2026-11-27')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
type W = any
type N = { id: string; x: number; z: number; kind: string }
const errs: string[] = [], posts: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: string }[] }[] }).tiles
const g = tiles.find(t => t.name === 'first-wilds')!
const G = { x: g.tx * 1000 - 300, z: g.ty * 1000 + 300 }, R = 320
const NZ = 8, cellKey = (x: number, z: number) => `${Math.floor(x / NZ)}_${Math.floor(z / NZ)}`
let mockDraft: any = null, mockLive: any = null, real: any = null
const store = (o: Page) => o.evaluate(async () => (await fetch('/shimmer/save-builder?map=wilds', { cache: 'no-store', headers: { 'x-m86-real': '1' } })).json()) as Promise<any>
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
    if (mockDraft && !r.headers()['x-m86-real']) { r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...real, draft: mockDraft, draftAt: Date.now() }) }); return }
    r.continue()
  })
}
const liveTxt = await (await fetch(`${url}/shimmer/open/wilds-edits`, { cache: 'no-store' } as any)).text()

/** a fresh keeper on `layer` (the Wilds edit layer JSON), at Greg's waymark: the nodes the game holds within R, and two shots */
async function keeper(layer: string, tag: string, look?: { x: number; z: number }): Promise<{ trees: N[]; crystals: N[] }> {
  const ctx = await br.createBrowserContext(), kp = await ctx.newPage(); await kp.setViewport({ width: 390, height: 844 })
  kp.on('pageerror', e => errs.push(`keeper ${tag}: ` + String(e).slice(0, 200)))
  await kp.setRequestInterception(true)
  kp.on('request', r => { if (r.method() === 'GET' && r.url().includes('/shimmer/open/wilds-edits')) r.respond({ status: 200, contentType: 'application/json', body: layer }); else r.continue() })
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
  await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await kp.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await dismissStartCard(kp)
  const A = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as W).__ather?.[f]?.(...x), fn, a)
  await kp.waitForFunction(() => (window as W).__ather?.wildsLoaded?.().length > 0, { timeout: 240000, polling: 1000 }); await sleep(2000)
  const greg = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 0, made: 0 }
  for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: greg }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  ok((await A('zone')) === 'wilds', `${tag}: a fresh keeper (390x844, no owner key) is in the Wilds`)
  await sleep(4000)
  let n: any = null
  for (let i = 0; i < 30; i++) { n = await kp.evaluate((x: number, z: number, r: number) => (window as W).__wildsNodes?.(x, z, r) ?? null, G.x, G.z, R); if (n?.trees?.length) break; await sleep(1000) }
  if (look) {
    const yawE = -Math.PI / 2
    await A('tp', look.x - 14, look.z, yawE); await sleep(2500); await dismissStartCard(kp); await A('look', yawE, -0.35); await sleep(4000)
    await kp.screenshot({ path: `${out}/${tag}-path.png` }).catch(() => {})
  }
  await ctx.close()
  return n ?? { trees: [], crystals: [] }
}

try {
  // ── BEFORE: what the game holds round the waymark today ──
  const b0 = await keeper(liveTxt, 'a-before')
  ok(b0.trees.length > 20, `before: ${b0.trees.length} trees + ${b0.crystals.length} crystals within ${R} m of Greg's waymark`)
  // the busiest 16 m-wide tree row, 120 m long, within R of the waymark and inside Greg's tile (the editor's top-down view is that tile)
  const TX = g.tx * 1000, TZ = g.ty * 1000
  let row = { z: G.z, n: -1, x0: G.x - 60, x1: G.x + 60 }
  for (let cx = Math.max(TX - 420, G.x - R + 60); cx <= Math.min(TX + 420, G.x + R - 60); cx += 20) for (let z = Math.max(TZ - 480, G.z - R + 10); z <= Math.min(TZ + 480, G.z + R - 10); z += 4) {
    const k = b0.trees.filter(t => Math.abs(t.z - z) < 8 && Math.abs(t.x - cx) < 60).length; if (k > row.n) row = { z, n: k, x0: cx - 60, x1: cx + 60 }
  }
  // the crystal bed: on a tree's spot (so on dry land) well off the row, inside the tile
  const mid = (row.x0 + row.x1) / 2
  // ... in a zone that grows crystals at all (the Thicket is stoneless, as today: a bed there adds nothing)
  const zoneOfPt = (x: number, z: number) => g.nodes.find(q => q.i === Math.floor((x - TX + 500) / 200) && q.j === Math.floor((z - TZ + 500) / 200))?.zone ?? 'meadows'
  const bedAt = b0.trees.filter(t => zoneOfPt(t.x, t.z) !== 'thicket' && zoneOfPt(t.x + 20, t.z + 20) !== 'thicket' && zoneOfPt(t.x - 20, t.z - 20) !== 'thicket' && Math.abs(t.z - row.z) > 40 && Math.abs(t.x - TX) < 470 && Math.abs(t.z - TZ) < 470 && Math.abs(t.x - mid) < 400).sort((a, b) => Math.hypot(a.x - mid, a.z - row.z) - Math.hypot(b.x - mid, b.z - row.z))[0] ?? { x: G.x, z: G.z + 60 }
  console.log(`  path row z ${row.z.toFixed(0)} (${row.n} trees on it), crystal bed at (${bedAt.x.toFixed(1)}, ${bedAt.z.toFixed(1)})`)

  // ── the owner paints ──
  const owner = await br.createBrowserContext(), o = await owner.newPage()
  o.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
  await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  real = await store(o); const h0 = hashes(real)
  console.log(`  real store before ${JSON.stringify(h0)}, draft nodes ${Object.keys(real.draft.nodes ?? {}).length}, live nodes ${Object.keys(real.live.nodes ?? {}).length}`)
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
  ok(!!(await o.$('[data-testid="nodes-panel"]')), '1. the Nodes brush opens its panel (No nodes / Dense forest / Crystal bed / Default)')
  await o.click('[data-testid="nodes-none"]'); await sleep(300)
  await o.keyboard.press('BracketLeft'); await sleep(200); await o.keyboard.press('BracketLeft'); await sleep(400)   // radius 16 -> 8
  // a REAL drag across the row, west to east
  const a = px(row.x0, row.z), b = px(row.x1, row.z)
  await o.mouse.move(a.x, a.y); await o.mouse.down()
  for (let k = 1; k <= 40; k++) { await o.mouse.move(a.x + (b.x - a.x) * k / 40, a.y); await sleep(40) }
  await o.mouse.up(); await sleep(800)
  // the crystal bed: thickness 4, radius 16, one REAL click
  await o.click('[data-testid="nodes-crystal"]'); await sleep(300); await o.click('[data-testid="nodes-d4"]'); await sleep(300)
  await o.keyboard.press('BracketRight'); await sleep(200); await o.keyboard.press('BracketRight'); await sleep(400)   // 8 -> 16
  const c = px(bedAt.x, bedAt.z); await o.mouse.click(c.x, c.y); await sleep(800)
  const cells = await o.evaluate(() => (window as W).__terrain.nodeCells()) as Record<string, number>
  const none = Object.keys(cells).filter(k => cells[k] === 1), bed = Object.keys(cells).filter(k => cells[k] === 24)
  ok(none.length >= 20 && bed.length >= 8 && Object.keys(cells).length === none.length + bed.length, `2. the drag painted ${none.length} no-node cells, the click ${bed.length} crystal-bed cells (thickness 4)`)
  ok(none.includes(cellKey((row.x0 + row.x1) / 2, row.z)) && bed.includes(cellKey(bedAt.x, bedAt.z)), '2. the cells sit under the drag and the click')
  await o.screenshot({ path: `${out}/b-editor-zones.png` }).catch(() => {})
  await o.evaluate(() => (window as W).__terrain.save()); await sleep(1500)
  ok(posts.includes('draft') && JSON.stringify(mockDraft?.nodes) === JSON.stringify(cells), `3. Save sends the draft with ${Object.keys(mockDraft?.nodes ?? {}).length} node-zone cells`)
  await openEd()
  const back = await o.evaluate(() => (window as W).__terrain.nodeCells()) as Record<string, number>
  ok(JSON.stringify(Object.entries(back).sort()) === JSON.stringify(Object.entries(cells).sort()), `3. RELOAD: the draft keeps all ${Object.keys(back).length} cells, exactly`)
  await o.evaluate(() => (window as W).__terrain.publish('m86-node-zones-check')); await sleep(1500)
  ok(posts.includes('publish') && JSON.stringify(Object.entries(mockLive?.nodes ?? {}).sort()) === JSON.stringify(Object.entries(cells).sort()), '4. Publish carries them to the scratch live layer')
  const after = await store(o); const h1 = hashes(after)
  ok(JSON.stringify(h0) === JSON.stringify(h1), `4. the REAL store is untouched (${JSON.stringify(h1)})`)
  await owner.close()

  // ── AFTER: a fresh keeper on the scratch layer ──
  const scratch = JSON.stringify({ ...JSON.parse(liveTxt), nodes: mockLive.nodes })
  const b1 = await keeper(scratch, 'c-after', { x: row.x0, z: row.z })
  const Z = mockLive.nodes as Record<string, number>, zoneAt = (n: N) => Z[cellKey(n.x, n.z)]
  const all0 = [...b0.trees, ...b0.crystals], all1 = [...b1.trees, ...b1.crystals]
  const onPath0 = all0.filter(n => zoneAt(n) === 1), onPath1 = all1.filter(n => zoneAt(n) === 1)
  ok(onPath0.length > 5 && onPath1.length === 0, `5. the path held ${onPath0.length} nodes before, ${onPath1.length} now`)
  const bed0 = b0.crystals.filter(n => zoneAt(n) === 24), bed1 = b1.crystals.filter(n => zoneAt(n) === 24)
  ok(bed1.length > bed0.length && bed1.filter(n => /:zc-?\d+_-?\d+_\d$/.test(n.id)).length === bed1.length - bed0.length, `5. the crystal bed holds ${bed1.length} crystals (was ${bed0.length}), the new ones in their own ids (${bed1.find(n => n.id.includes(':zc'))?.id}), kinds ${[...new Set(bed1.map(n => n.kind))].join(', ')}`)
  const sig = (n: N) => `${n.id}@${n.x.toFixed(3)},${n.z.toFixed(3)}:${n.kind}`
  const out0 = new Set(all0.filter(n => !zoneAt(n)).map(sig)), out1 = new Set(all1.filter(n => !zoneAt(n)).map(sig))
  const diff = [...out0].filter(s => !out1.has(s)).length + [...out1].filter(s => !out0.has(s)).length
  ok(out0.size > 50 && diff === 0, `5. all ${out0.size} nodes outside the painted cells: same ids, same spots (${diff} differ)`)
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `\n${fails} FAILED` : '\nPASS'); process.exit(fails ? 1 : 0)
