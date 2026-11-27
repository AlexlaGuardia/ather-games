// ── BETA M237 s1 + s2: SETTLEMENTS IN THE WORLD BUILDER (owner desktop + fresh keepers 390x844 and 1280x900) ── (built on m86-node-zones-check)
// READ ONLY against prod (ather.games is Alex's live save): every POST to save-builder is answered IN THE PAGE from a mock store (draft
// = what the editor saved, live = the draft at Publish), a reload reads that mock draft back, and the keeper tabs get the SCRATCH layer.
//   keeper BEFORE (390): the live network as the game holds it (__atherNet): Bryonydell (s1-10) at its baked spot.
//   owner (1280x900): Builder on the Wilds, tool 'Settlements': the list's Bryonydell -> its tile; a REAL drag moves its marker
//     ~90 m; dropdowns: focus Shore, homes 3, tent Dash. A REAL click on empty ground ADDS one; dropdowns: focus Rock, homes 2,
//     tent Clash Difficult. Save; RELOAD keeps both; Publish carries them; the REAL store hashed before/after: unchanged.
//   keeper AFTER (fresh, 390 and 1280): the moved one at its new spot with Shore + 3 homes + the tent stored, the added one at its
//     spot with Rock + 2 homes; standing at each, the lots built = the home count's lots (settlementLots on the same merge);
//     RELOAD keeps it; 0 page errors.
// s2: homes 5 + tent Dash on the moved one: the editor's COUNTER (panel, marker, every list line) = homesCount on the same merge;
//   a fresh keeper builds exactly the counter's placed homes there, and a Dash tent stands BESIDE it (60-90 m, the baked Dash taken
//   over: the season's tent counts unchanged) whose door says 'E · the Thistledown Fair · Dash' and E opens the Dash panel.
// s3: PATHS + PADS follow them: on the scratch layer each fresh keeper's network joins the moved AND the added settlement to Greg's
//   stone (the nearest waymark a fresh keeper has) by a spur with no gap (steps <= 30 m) that meets another path's point; standing
//   there, the lots' ground is level on its pads (live ground under each footprint within 0.25 m of the pad) and the live ground meets
//   the spur (within 0.6 m); the Dash tent beside it stands on dry ground (raw tiles from prod, settlement-routes tentSiteOk).
//   OWNER_KEY=... npx tsx scripts/m237-settlements-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dismissStartCard } from './lib/start-card.mts'
import { applySettlementEdits, cleanSettlementEdits } from '../src/app/shimmer/open/ather/settlement-edits.ts'
import { settlementLots, homesCount } from '../src/app/shimmer/open/ather/settlement-lots.ts'
import { tentsOf, fairDoor, tentLabel, type Network, type Tent, type Path } from '../src/app/shimmer/open/ather/network.ts'
import { groundOf, tentSiteOk, SPUR_MIN, type TileData } from '../src/app/shimmer/open/ather/settlement-routes.ts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m237-s3-2026-11-27')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
type W = any
const errs: string[] = [], posts: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const MOVE = 's1-10'
let mockDraft: any = null, mockLive: any = null, real: any = null
const store = (o: Page) => o.evaluate(async () => (await fetch('/shimmer/save-builder?map=wilds', { cache: 'no-store', headers: { 'x-m237-real': '1' } })).json()) as Promise<any>
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
    if (mockDraft && !r.headers()['x-m237-real']) { r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...real, draft: mockDraft, draftAt: Date.now() }) }); return }
    r.continue()
  })
}
/** s3: prod's raw tiles round a point (settlement-routes groundOf) + their infected nodes */
const tindex = await (await fetch(`${url}/open/wilds/tiles.json`)).json() as { tiles: { name: string; tx: number; ty: number; nodes: { x: number; z: number }[] }[] }
async function tilesNear(x: number, z: number) {
  const ts = tindex.tiles.filter(t => Math.abs(t.tx * 1000 - x) < 800 && Math.abs(t.ty * 1000 - z) < 800)
  const data: TileData[] = await Promise.all(ts.map(async t => ({ tx: t.tx, ty: t.ty, meta: await (await fetch(`${url}/open/wilds/${t.name}.json`)).json(), dm: new Int16Array(await (await fetch(`${url}/open/wilds/${t.name}.bin`)).arrayBuffer()), bio: new Uint8Array(await (await fetch(`${url}/open/wilds/${t.name}.biome`)).arrayBuffer()) })))
  return { ground: groundOf(data), nodes: ts.flatMap(t => t.nodes.map(q => ({ x: q.x + t.tx * 1000, z: q.z + t.ty * 1000 }))) }
}
const liveTxt = await (await fetch(`${url}/shimmer/open/wilds-edits`, { cache: 'no-store' } as any)).text()
const bake = await (await fetch(`${url}/open/wilds/network-s1.json`, { cache: 'no-store' } as any)).json() as Network

type Lie = { pads: number; padDelta: number; spur: number; spurDelta: number }
type Seen = { net: { id: string; name: string; x: number; z: number; biome?: string; homes?: number; tent?: { contest: string; level?: string } }[]; lots: Record<string, number>; tents: Tent[]; prompt: string; panel: boolean; paths: Path[]; lie: Record<string, Lie> }
/** a fresh keeper on `layer`: the network the game holds, and (with `visit`) the lots built standing at each visited settlement */
async function keeper(layer: string, tag: string, vp: { width: number; height: number }, visit: string[] = [], reload = false, tentOf: string | null = null): Promise<Seen> {
  const ctx = await br.createBrowserContext(), kp = await ctx.newPage(); await kp.setViewport(vp)
  kp.on('pageerror', e => errs.push(`keeper ${tag}: ` + String(e).slice(0, 200)))
  await kp.setRequestInterception(true)
  kp.on('request', r => { if (r.method() === 'GET' && r.url().includes('/shimmer/open/wilds-edits')) r.respond({ status: 200, contentType: 'application/json', body: layer }); else r.continue() })
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
  await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  const A = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as W).__ather?.[f]?.(...x), fn, a)
  const boot = async () => {
    await kp.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await dismissStartCard(kp)
    await kp.waitForFunction(() => (window as W).__ather?.wildsLoaded?.().length > 0, { timeout: 240000, polling: 1000 }); await sleep(2000)
    const greg = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 0, made: 0 }
    for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: greg }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  }
  await boot()
  if (reload) { await boot(); ok(true, `${tag}: reloaded`) }
  ok((await A('zone')) === 'wilds', `${tag}: a fresh keeper (${vp.width}x${vp.height}, no owner key) is in the Wilds`)
  const net = await kp.evaluate(() => ((window as W).__atherNet?.()?.settlements ?? []).map((s: any) => ({ id: s.id, name: s.name, x: s.x, z: s.z, biome: s.biome, homes: s.homes, tent: s.tent }))) as Seen['net']
  const lots: Record<string, number> = {}, lie: Record<string, Lie> = {}
  for (const id of visit) {
    const s = net.find(q => q.id === id); if (!s) continue
    await A('tp', s.x, s.z + 40, Math.PI); await sleep(3000); await dismissStartCard(kp).catch(() => {})
    let b: any = null
    for (let i = 0; i < 40; i++) { b = await kp.evaluate((i2: string) => (window as W).__settlements?.built?.().find((q: any) => q.id === i2) ?? null, id); if (b) break; await sleep(1000) }
    lots[id] = b ? b.lots.length : -1
    // s3: the live ground under each lot's footprint vs its pad; along the spur, the live ground vs the path's own height
    for (let i = 0; i < 20 && !(await kp.evaluate((x: number, z: number) => (window as W).__spreadMap?.()?.loaded?.(x, z), s.x, s.z)); i++) await sleep(1000)
    lie[id] = await kp.evaluate((i2: string) => {
      const n = (window as W).__atherNet(), sm = (window as W).__spreadMap(), st = n.settlements.find((q: any) => q.id === i2)
      let padDelta = 0, spurDelta = 0, spur = 0
      for (const p of st?.pads ?? []) { const sn = Math.sin(p[2]), cs = Math.cos(p[2]); for (const a of [-6, 0, 6]) for (const b of [-3.5, 0, 3.5]) { const h = sm.height(p[0] + cs * a + sn * b, p[1] - sn * a + cs * b); if (h !== null) padDelta = Math.max(padDelta, Math.abs(h - p[3])) } }
      const sp = n.paths.find((p: any) => p.a === i2 && String(p.b).startsWith('~'))
      // a lot pad holds the ground within its reach (relief.ts padGround wins over the path there, the bake's rule): measure past it
      const padR = Math.hypot(13.5, 8.5) / 2 + 4.5 + 20
      for (const q of sp?.pts ?? []) if (sm.loaded(q[0], q[1]) && !(st?.pads ?? []).some((p: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < padR)) { const h = sm.height(q[0], q[1]); if (h !== null) { spur++; spurDelta = Math.max(spurDelta, Math.abs(h - q[2])) } }
      return { pads: st?.pads?.length ?? 0, padDelta, spur, spurDelta }
    }, id) as Lie
    await A('look', Math.PI, -0.25); await sleep(2500)
    await kp.screenshot({ path: `${out}/${tag}-${id}.png` }).catch(() => {})
    const sp = (await kp.evaluate((i2: string) => (window as W).__atherNet().paths.find((p: any) => p.a === i2 && String(p.b).startsWith('~'))?.pts ?? null, id)) as number[][] | null
    if (sp && sp.length > 4) {   // on the spur ~50 m out, looking back up it at the settlement
      const q = sp[Math.min(sp.length - 1, 3)], yaw = Math.atan2(-(s.x - q[0]), -(s.z - q[1]))
      await A('tp', q[0], q[1], yaw); await A('look', yaw, -0.2); await sleep(3000)
      await kp.screenshot({ path: `${out}/${tag}-${id}-path.png` }).catch(() => {})
    }
  }
  const tents = await kp.evaluate(() => (window as W).__atherNet?.()?.tents ?? []) as Tent[]
  const paths = await kp.evaluate(() => (window as W).__atherNet?.()?.paths ?? []) as Path[]
  let prompt = '', panel = false
  const t = tentOf ? tents.find(q => q.settlement === tentOf) : null
  if (t) {   // M237 s2: the Fair's tent beside it, the same door + sign-up panel as a baked one
    const s = net.find(q => q.id === tentOf)!
    const far = { x: s.x + (t.x - s.x) * 0.25, z: s.z + (t.z - s.z) * 0.25 }   // s3: from the settlement's edge, looking out at its tent
    const fy = Math.atan2(-(t.x - far.x), -(t.z - far.z))
    await A('tp', far.x, far.z, fy); await A('look', fy, -0.12); await sleep(5000)
    await kp.screenshot({ path: `${out}/${tag}-tent-beside.png` }).catch(() => {})
    const d = fairDoor(t), yaw = Math.atan2(-(t.x - d.x), -(t.z - d.z))
    await A('tp', d.x, d.z, yaw); await A('look', yaw, -0.05)
    for (let i = 0; i < 40 && !prompt.includes(`E · the Thistledown Fair · ${tentLabel(t)}`); i++) { await sleep(500); prompt = await kp.evaluate(() => document.body.innerText) }
    await kp.keyboard.press('KeyE'); await sleep(1500)
    for (let i = 0; i < 12 && !panel; i++) { panel = !!(await kp.$(`[data-panel="${t.contest}"]`)); if (!panel) await sleep(500) }
    await kp.screenshot({ path: `${out}/${tag}-tent-panel.png` }).catch(() => {})
  }
  await ctx.close()
  return { net, lots, tents, prompt, panel, paths, lie }
}

try {
  // ── BEFORE ──
  const b0 = await keeper(liveTxt, 'a-before', { width: 390, height: 844 })
  const m0 = b0.net.find(s => s.id === MOVE)
  ok(!!m0, `before: ${b0.net.length} settlements, ${MOVE} ${m0?.name} at (${m0?.x}, ${m0?.z}) biome ${m0?.biome}`)

  // ── the owner edits ──
  const owner = await br.createBrowserContext(), o = await owner.newPage()
  o.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
  await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  real = await store(o); const h0 = hashes(real)
  console.log(`  real store before ${JSON.stringify(h0)}, draft settlements ${(real.draft.settlements ?? []).length}, live ${(real.live.settlements ?? []).length}`)
  await o.setRequestInterception(true); intercept(o)
  const openEd = async () => {
    await o.goto(`${url}/shimmer/dev?mode=terrain&map=wilds`, { waitUntil: 'load', timeout: 240000 })
    await o.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "wilds" && !!window.__terrain?.origin() && window.__terrain?.settlements?.().length > 0', { timeout: 240000, polling: 500 })
    await sleep(1500)
  }
  await openEd()
  ok(!!(await o.$('[data-testid="brush-settle"]')), '1. the World Builder has a Settlements tool')
  await o.click('[data-testid="brush-settle"]'); await sleep(500)
  ok(!!(await o.$('[data-testid="settle-panel"]')), '1. it opens its panel')
  const listN = await o.$$eval('[data-testid="settle-list"] > div', d => d.length)
  ok(listN === b0.net.length, `1. the panel lists every settlement of the season (${listN})`)
  await o.click(`[data-testid="settle-go-${MOVE}"]`)
  await o.waitForFunction(`window.__terrain?.ready === true && (() => { const g = window.__terrain.origin(); const s = window.__terrain.settlements().find(q => q.id === '${MOVE}'); return g && s && Math.abs(s.x - g.x) <= 500 && Math.abs(s.z - g.z) <= 500 })()`, { timeout: 120000, polling: 500 })
  await sleep(2000)
  const org = await o.evaluate(() => (window as W).__terrain.origin()) as { x: number; z: number }
  const cv = (await (await o.$('[data-testid="terrain-canvas"]'))!.boundingBox())!
  const px = (x: number, z: number) => ({ x: cv.x + ((x - org.x + 500) / 1000) * cv.width, y: cv.y + ((z - org.z + 500) / 1000) * cv.height })
  const markers = await o.$$eval('[data-testid="settle-layer"] [data-settle]', g => g.map(e => e.getAttribute('data-settle')))
  ok(markers.includes(MOVE), `2. ${MOVE}'s marker is on its tile (markers here: ${markers.join(', ')})`)
  // a REAL drag of the marker, ~90 m toward the tile centre
  const dx = Math.sign(org.x - m0!.x) * 70 || 70, dz = Math.sign(org.z - m0!.z) * 55 || 55
  const to = { x: m0!.x + dx, z: m0!.z + dz }
  const a = px(m0!.x, m0!.z), b = px(to.x, to.z)
  await o.mouse.move(a.x, a.y); await o.mouse.down()
  for (let k = 1; k <= 20; k++) { await o.mouse.move(a.x + (b.x - a.x) * k / 20, a.y + (b.y - a.y) * k / 20); await sleep(30) }
  await o.mouse.up(); await sleep(700)
  let mv = (await o.evaluate(() => (window as W).__terrain.settlements()) as any[]).find(s => s.id === MOVE)
  ok(!!mv && Math.hypot(mv.x - to.x, mv.z - to.z) < 6 && (await o.evaluate(() => (window as W).__terrain.selSettle())) === MOVE, `2. the drag moved it to (${mv?.x}, ${mv?.z}) (aimed ${to.x}, ${to.z}) and selected it`)
  await o.select('[data-testid="settle-focus"]', 'shore'); await sleep(200)
  await o.select('[data-testid="settle-homes"]', '5'); await sleep(200)
  await o.select('[data-testid="settle-tent"]', 'dash'); await sleep(300)
  mv = (await o.evaluate(() => (window as W).__terrain.settlements()) as any[]).find(s => s.id === MOVE)
  ok(mv.biome === 'shore' && mv.homes === 5 && mv.tent?.contest === 'dash', `3. dropdowns: focus ${mv.biome}, homes ${mv.homes}, tent ${mv.tent?.contest}`)
  // s2: THE COUNTER (panel line + marker + every list line) = homesCount on the same merge
  const merged0 = applySettlementEdits({ ...bake, settlements: bake.settlements.filter(s => s.id !== 'moonwell-glade') }, cleanSettlementEdits({ settlements: await o.evaluate(() => (window as W).__terrain.settleEdits()) }))
  const hc = homesCount(merged0.settlements.find(s => s.id === MOVE)!, 1)
  const ctr = await o.$eval('[data-testid="settle-counter"]', e => ({ placed: +e.getAttribute('data-placed')!, set: +e.getAttribute('data-set')!, tent: e.getAttribute('data-tent'), txt: (e as HTMLElement).innerText }))
  ok(ctr.placed === hc.placed && ctr.set === 5 && ctr.tent === 'dash' && ctr.txt.includes(`Homes ${hc.placed}/5`), `s2 counter: the panel reads "${ctr.txt.replace(/\s+/g, ' ')}" (want Homes ${hc.placed}/5, tent dash)`)
  const mk = await o.$eval(`[data-testid="settle-count-${MOVE}"]`, e => e.textContent).catch(() => null)
  ok(mk === `Homes ${hc.placed}/5`, `s2 counter: its marker reads "${mk}"`)
  const lines = await o.$$eval('[data-testid^="settle-list-count-"]', d => d.map(e => e.textContent))
  ok(lines.length === listN && lines.every(l => /^Homes \d\/\d( auto)?$/.test(l ?? '')), `s2 counter: every list line shows it (${lines.length}/${listN}: ${lines.slice(0, 3).join(', ')} ...)`)
  ok(!!(await o.$(`[data-tent-of="${MOVE}"]`)), 's2: the editor draws the pitched Dash tent beside it')
  await o.screenshot({ path: `${out}/a-editor-counter.png` }).catch(() => {})
  // a REAL click on empty ground = ADD
  const addAt = { x: org.x + (org.x > to.x ? 260 : -260), z: org.z + (org.z > to.z ? 200 : -200) }
  const c = px(addAt.x, addAt.z); await o.mouse.click(c.x, c.y); await sleep(700)
  const selId = await o.evaluate(() => (window as W).__terrain.selSettle()) as string
  let ad = (await o.evaluate(() => (window as W).__terrain.settlements()) as any[]).find(s => s.id === selId)
  ok(/^s1-x-\d+$/.test(selId ?? '') && !!ad && Math.hypot(ad.x - addAt.x, ad.z - addAt.z) < 6, `4. a click ADDED ${ad?.name} (${selId}) at (${ad?.x}, ${ad?.z})`)
  await o.select('[data-testid="settle-focus"]', 'rock'); await sleep(200)
  await o.select('[data-testid="settle-homes"]', '2'); await sleep(200)
  await o.select('[data-testid="settle-tent"]', 'clash'); await sleep(300)
  await o.select('[data-testid="settle-level"]', 'difficult'); await sleep(300)
  ad = (await o.evaluate(() => (window as W).__terrain.settlements()) as any[]).find(s => s.id === selId)
  ok(ad.biome === 'rock' && ad.homes === 2 && ad.tent?.contest === 'clash' && ad.tent?.level === 'difficult', `4. dropdowns: focus ${ad.biome}, homes ${ad.homes}, tent ${ad.tent?.contest} ${ad.tent?.level}`)
  await o.screenshot({ path: `${out}/b-editor.png` }).catch(() => {})
  const edits = await o.evaluate(() => (window as W).__terrain.settleEdits()) as any[]
  await o.evaluate(() => (window as W).__terrain.save()); await sleep(1500)
  ok(posts.includes('draft') && JSON.stringify(mockDraft?.settlements) === JSON.stringify(edits), `5. Save sends the draft with ${mockDraft?.settlements?.length} settlement edits`)
  await openEd()
  const back = await o.evaluate(() => (window as W).__terrain.settleEdits()) as any[]
  ok(JSON.stringify(back) === JSON.stringify(edits), '5. RELOAD: the draft keeps both edits, exactly')
  await o.evaluate(() => (window as W).__terrain.publish('m237-settlements-check')); await sleep(1500)
  ok(posts.includes('publish') && JSON.stringify(mockLive?.settlements) === JSON.stringify(edits), '6. Publish carries them to the scratch live layer')
  const after = await store(o); const h1 = hashes(after)
  ok(JSON.stringify(h0) === JSON.stringify(h1), `6. the REAL store is untouched (${JSON.stringify(h1)})`)
  await owner.close()

  // ── AFTER: fresh keepers on the scratch layer ──
  const scratch = JSON.stringify({ ...JSON.parse(liveTxt), settlements: mockLive.settlements })
  const merged = applySettlementEdits({ ...bake, settlements: bake.settlements.filter(s => s.id !== 'moonwell-glade') }, cleanSettlementEdits({ settlements: mockLive.settlements }))
  const want = (id: string) => settlementLots(merged.settlements.find(s => s.id === id)!, 1).length
  for (const [tag, vp, reload] of [['c-after-390', { width: 390, height: 844 }, false], ['d-after-desk', { width: 1280, height: 900 }, true]] as const) {
    const k = await keeper(scratch, tag, vp, [MOVE, selId], reload, MOVE)
    const M = k.net.find(s => s.id === MOVE), D = k.net.find(s => s.id === selId)
    ok(!!M && M.x === mv.x && M.z === mv.z && M.biome === 'shore' && M.homes === 5 && M.tent?.contest === 'dash', `7. ${tag}: ${M?.name} stands at the new spot (${M?.x}, ${M?.z}), trade Shore, homes 5, tent Dash`)
    ok(!!D && D.x === ad.x && D.z === ad.z && D.biome === 'rock' && D.homes === 2 && D.tent?.level === 'difficult', `7. ${tag}: the added ${D?.name} at (${D?.x}, ${D?.z}), trade Rock, homes 2`)
    ok(k.net.length === b0.net.length + 1, `7. ${tag}: ${k.net.length} settlements (one added)`)
    ok(k.lots[MOVE] === want(MOVE) && k.lots[MOVE] === ctr.placed && k.lots[MOVE] > 0, `8. ${tag}: standing at ${M?.name}: ${k.lots[MOVE]} homes built = the counter's ${ctr.placed}/5`)
    const T = k.tents.find(t => t.settlement === MOVE), dT = T && M ? Math.hypot(T.x - M.x, T.z - M.z) : -1
    ok(!!T && T.contest === 'dash' && dT >= 59 && dT <= 91, `s2 ${tag}: a Dash tent stands beside ${M?.name} (${dT.toFixed(0)} m out at ${T?.x}, ${T?.z})`)
    const cnt = (ts: Tent[]) => JSON.stringify(ts.map(t => t.contest + (t.level ?? '')).sort())
    ok(cnt(k.tents) === cnt(tentsOf(bake)) && !k.tents.some(t => t.contest === 'dash' && !t.settlement), `s2 ${tag}: the baked Dash was taken over, the season's tents still ${k.tents.length} (${cnt(k.tents)})`)
    ok(k.prompt.includes('E · the Thistledown Fair · Dash'), `s2 ${tag}: its door says "E · the Thistledown Fair · Dash"`)
    ok(k.panel, `s2 ${tag}: E at its door opens the Dash panel`)
    ok(k.lots[selId] === want(selId) && want(selId) <= 2 && k.lots[selId] > 0, `8. ${tag}: standing at ${D?.name}: ${k.lots[selId]} homes built (want ${want(selId)}, cap 2)`)
    // ── s3: joined to Greg's stone by a continuous path; level pads; the ground meets the spur; the tent on dry ground ──
    const P = k.paths, par = P.map((_, i) => i), f = (i: number): number => (par[i] === i ? i : (par[i] = f(par[i])))
    const touch = (p: Path, q: Path) => [p.pts[0], p.pts[p.pts.length - 1]].some(e => q.pts.some(v => Math.hypot(v[0] - e[0], v[1] - e[1]) < 0.5))
    for (let i = 0; i < P.length; i++) for (let j = 0; j < P.length; j++) if (i !== j && (touch(P[i], P[j]) || [P[i].a, P[i].b].some(x => !String(x).startsWith('~') && (x === P[j].a || x === P[j].b)))) par[f(i)] = f(j)
    const comp = f(P.findIndex(p => p.a === 'greg' || p.b === 'greg'))
    for (const [id, S] of [[MOVE, M], [selId, D]] as const) {
      if (!S) continue
      const sp = P.find(p => p.a === id && String(p.b).startsWith('~')), i = sp ? P.indexOf(sp) : -1
      const near = Math.min(...P.filter((_, j) => f(j) === comp).flatMap(p => p.pts.map(q => Math.hypot(q[0] - S.x, q[1] - S.z))))
      let gap = 0; for (let j = 1; j < (sp?.pts.length ?? 0); j++) gap = Math.max(gap, Math.hypot(sp!.pts[j][0] - sp!.pts[j - 1][0], sp!.pts[j][1] - sp!.pts[j - 1][1]))
      ok((!!sp && f(i) === comp && Math.hypot(sp.pts[0][0] - S.x, sp.pts[0][1] - S.z) < 0.5 && gap <= 30) || (!sp && near < SPUR_MIN), `s3 ${tag}: ${S.name} joined to Greg's stone by a path (${sp ? `spur ${sp.pts.length} pts, worst step ${gap.toFixed(1)} m, meets ${sp.b}` : `none, ${near.toFixed(0)} m from one`})`)
      const L = k.lie[id]
      ok(!!L && L.pads === 5 && L.padDelta < 0.25, `s3 ${tag}: ${S.name}'s lots stand level on ${L?.pads} pads (live ground off a pad by at most ${L?.padDelta.toFixed(3)} m)`)
      ok(!sp || (!!L && (L.spur >= 3 || sp.pts.length <= 4) && L.spurDelta < 0.6), `s3 ${tag}: the ground meets ${S.name}'s path past its pads (${L?.spur} loaded points, worst ${L?.spurDelta.toFixed(2)} m)`)
    }
    if (T) { const g = await tilesNear(T.x, T.z); ok(tentSiteOk(g.ground, g.nodes)(T.x, T.z), `s3 ${tag}: the Dash tent at (${T.x}, ${T.z}) stands on dry ground, off the Hollows' wells`) }
  }
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `\n${fails} FAILED` : '\nPASS'); process.exit(fails ? 1 : 0)
