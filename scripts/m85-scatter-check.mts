// ── BETA M85 s2: THE SCATTER BRUSH ON THE WILDS (World Builder, owner, desktop) ── (built on m85-scenery-check.mts, s1)
// READ ONLY against prod (ather.games is Alex's live save): every POST to save-builder is answered IN THE PAGE from a mock store (draft
// = what the editor saved, live = the draft at Publish), and a reload reads that mock draft back. So:
//   owner (1280x900): Fly on the Wilds, P then K = the scatter brush; wheel radius 3 -> 4, '.' density 0.5 -> 1, REAL right-clicks at
//     the crosshair paint ~200 pieces (4 dabs), Shift + right erases one disc (only scattered pieces inside it go), Save, RELOAD keeps
//     them, Publish. Draw calls in Fly with the scattered batches shown vs hidden (renderer.info).
//   keeper (fresh, no owner key, 390x844): the SCRATCH world = the real live Wilds layer + the published pieces, this tab only; the game
//     draws every scattered piece on the ground, none registers a box, a walk goes straight through the patch; draw calls shown vs hidden.
//   the real store (draft + live + versions) is hashed before and after: unchanged.
//   OWNER_KEY=... npx tsx scripts/m85-scenery-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m85-scatter-check')
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
// where: beside Greg's waymark (the zone check's flat spot), world metres
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }).tiles
const g = tiles.find(t => t.name === 'first-wilds')!
const B = { x: g.tx * 1000 - 300 + 10, z: g.ty * 1000 + 300 - 8 }
const SPOTS = [{ x: B.x - 6, z: B.z }, { x: B.x + 3, z: B.z }, { x: B.x + 12, z: B.z }, { x: B.x + 21, z: B.z }]
let mockDraft: any = null, mockLive: any = null, real: any = null
const store = (o: Page) => o.evaluate(async () => { const b = await (await fetch('/shimmer/save-builder?map=wilds', { cache: 'no-store', headers: { 'x-m85-real': '1' } })).json(); return b }) as Promise<any>
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
    if (mockDraft && !r.headers()['x-m85-real']) { r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...real, draft: mockDraft, draftAt: Date.now() }) }); return }
    r.continue()
  })
}
const T = (o: Page) => o.evaluate(() => { const t = (window as W).__terrain; return { props: t.props(), place: t.place } }) as Promise<{ props: any[]; place: any }>
const key = async (o: Page, c: string) => { await o.keyboard.press(c as any); await sleep(700) }
const lock = async (o: Page) => { const b = (await (await o.$('[data-testid="fly-frame"]'))!.boundingBox())!; for (let i = 0; i < 4 && !(await o.evaluate(() => (window as W).__builderFly.locked())); i++) { await o.mouse.click(b.x + b.width / 2, b.y + b.height / 2 - 60); await sleep(1500) } }
const choose = async (o: Page, k: string) => { await key(o, 'KeyE'); await o.click(`[data-testid="place-item-${k}"]`); await sleep(400); await key(o, 'KeyE'); await sleep(1200); await lock(o) }
const aim = async (o: Page, x: number, z: number) => { await o.evaluate((a: number, b: number) => { const t = (window as W).__terrain, h = t.heightAt(a, b); (window as W).__builderFly.setCam({ x: a, z: b + 10, y: (Number.isFinite(h) ? h : 5) + 7, yaw: 0, pitch: -0.6, top: false }) }, x, z); await sleep(1500) }
const wheel = (o: Page, dy: number) => o.evaluate((d: number) => document.querySelector('[data-testid="fly-frame"] canvas')!.dispatchEvent(new WheelEvent('wheel', { deltaY: d, bubbles: true, cancelable: true })), dy)
async function openFly(o: Page) {
  await o.goto(`${url}/shimmer/dev?mode=terrain&map=wilds`, { waitUntil: 'load', timeout: 240000 })
  await o.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "wilds"', { timeout: 240000, polling: 500 })
  await o.click('[data-testid="view-fly"]')
  await o.waitForFunction('typeof window.__builderFly?.drawnAt === "function" && window.__builderFly.scene().tiles > 0', { timeout: 180000, polling: 500 })
  await aim(o, B.x, B.z); await sleep(3000)
}

const devtools = () => { const t = new EventTarget() as any, w = window as any; w.__THREE_DEVTOOLS__ = t; w.__scenes = []; w.__gls = []; t.addEventListener('observe', (e: any) => { const d = e.detail; if (d?.isScene) w.__scenes.push(d); else if (d?.info) w.__gls.push(d) }) }
/** draw calls per frame (renderer.info, median of 10 frames) and the scattered batches' own share, counted EXACTLY: each scattered
 *  InstancedMesh (only `s` ids) counts its onBeforeRender, one per draw it issues (a shadow or second pass shows as more than one) */
const calls = (p: Page) => p.evaluate(async () => {
  const w = window as any, gl = w.__gls[w.__gls.length - 1]; if (!gl) return null
  const scat: any[] = []; for (const s of w.__scenes) s.traverse((o: any) => { const ids = o.userData?.scenery; if (o.isInstancedMesh && Array.isArray(ids) && ids.length && ids.every((i: string) => i[0] === 's')) scat.push(o) })
  const proto = gl.render; let c = 0, own = 0
  const prev = scat.map(o => o.onBeforeRender); scat.forEach((o, i) => { o.onBeforeRender = function (...a: any[]) { own++; return prev[i].apply(o, a) } })
  gl.render = function (...a: any[]) { const r = proto.apply(gl, a); c += gl.info.render.calls; return r }
  const got: number[] = [], mine: number[] = []
  for (let i = 0; i < 10; i++) { c = 0; own = 0; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); got.push(c); mine.push(own) }
  gl.render = proto; scat.forEach((o, i) => { o.onBeforeRender = prev[i] })
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]
  return { total: med(got), scatter: med(mine), batches: scat.length, pieces: scat.reduce((n, o) => n + o.count, 0) }
}) as Promise<{ total: number; scatter: number; batches: number; pieces: number } | null>
const scatOf = (ps: any[]) => ps.filter(p => typeof p.id === 'string' && p.id[0] === 's')
try {
  const owner = await br.createBrowserContext(), o = await owner.newPage()
  o.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f'); await o.evaluateOnNewDocument(devtools)
  await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  real = await store(o); const h0 = hashes(real), base: any[] = real.draft.props ?? []
  console.log(`  real store before ${JSON.stringify(h0)}, draft props ${base.length} (scattered ${scatOf(base).length}), live props ${(real.live.props ?? []).length}`)
  await o.setRequestInterception(true); intercept(o)
  await openFly(o)
  await key(o, 'KeyP'); ok((await T(o)).place.on, '1. P opens Scenery mode')
  await key(o, 'KeyK'); ok((await T(o)).place.scat === true && !!(await o.$('[data-testid="scatter-hud"]')), '1. K turns on the scatter brush (its HUD + mix chips)')
  await lock(o)
  for (let i = 0; i < 2; i++) { await wheel(o, -100); await sleep(300) }
  await key(o, 'Period')
  let pl = (await T(o)).place
  ok(pl.radius === 4 && pl.density === 1 && pl.kinds.length >= 4, `1. dials: wheel radius 3 -> ${pl.radius} m, '.' density 0.5 -> ${pl.density}/m², mix ${pl.kinds.join(', ')}`)
  await o.screenshot({ path: `${out}/a-brush-ring.png` }).catch(() => {})
  // PAINT: a real right-click at the crosshair, at each spot
  const centres: { x: number; z: number }[] = []
  for (const s of SPOTS) {
    await aim(o, s.x, s.z); await lock(o)
    let c: any = null; for (let i = 0; i < 10 && !c; i++) { c = await o.evaluate(() => (window as W).__builderFly.centre()); if (!c) await sleep(500) }
    centres.push(c)
    await o.mouse.down({ button: 'right' }); await sleep(400); await o.mouse.up({ button: 'right' }); await sleep(900)
  }
  let ps = scatOf((await T(o)).props.filter(p => !base.some(b => b.id === p.id)))
  ok(ps.length >= 180 && ps.length <= 220, `2. four right-clicks painted ${ps.length} scattered pieces (target 4 x ${Math.round(Math.PI * 16)})`)
  const within = ps.every(p => centres.some(c => c && Math.hypot(p.x - c.x, p.z - c.z) <= 4.001))
  ok(within, '2. every piece landed inside a dab\'s disc')
  ok(new Set(ps.map(p => p.k)).size >= 3 && new Set(ps.map(p => p.q)).size > ps.length * 0.8 && new Set(ps.map(p => p.s)).size > 10 && ps.every(p => p.solid === undefined), `2. a mix of ${new Set(ps.map(p => p.k)).size} kinds, random turns + sizes, none solid`)
  const fd = await o.evaluate(() => (window as W).__scenery?.()) as { items: any[]; meshes: number; drawn: number }
  ok(!!fd && fd.items.filter(i => ps.some(p => p.id === i.id)).length === ps.length, `2. the editor draws them all on the draft ground (${fd?.meshes} instanced meshes for ${fd?.drawn} pieces)`)
  await aim(o, B.x + 7, B.z + 14); await sleep(2500); await o.screenshot({ path: `${out}/b-painted.png` }).catch(() => {})
  const fc = await calls(o)
  ok(!!fc && fc.batches <= 8 && fc.pieces >= ps.length && fc.scatter > 0 && fc.scatter <= 2 * fc.batches, `2. Fly: the ${fc?.pieces} scattered pieces cost ${fc?.scatter} draw calls a frame (${fc?.batches} batches) of ${fc?.total} in all`)
  // ERASE: Shift + right at the second spot
  await aim(o, SPOTS[1].x, SPOTS[1].z); await lock(o)
  const ec = await o.evaluate(() => (window as W).__builderFly.centre()) as { x: number; z: number }
  const before = (await T(o)).props
  await o.keyboard.down('Shift'); await o.mouse.down({ button: 'right' }); await sleep(400); await o.mouse.up({ button: 'right' }); await o.keyboard.up('Shift'); await sleep(900)
  const afterE = (await T(o)).props, gone = before.filter(p => !afterE.some(q => q.id === p.id))
  ok(gone.length > 20 && gone.every(p => p.id[0] === 's' && Math.hypot(p.x - ec.x, p.z - ec.z) <= 4.001), `3. Shift + right erased ${gone.length}, every one scattered and inside r 4 of (${ec.x.toFixed(1)}, ${ec.z.toFixed(1)})`)
  ok(!afterE.some(p => p.id[0] === 's' && Math.hypot(p.x - ec.x, p.z - ec.z) <= 3.99) && base.every(b => afterE.some(p => p.id === b.id)), '3. nothing scattered left inside the disc; every piece that was there before stays')
  ps = scatOf(afterE.filter(p => !base.some(b => b.id === p.id)))
  await aim(o, B.x + 7, B.z + 14); await sleep(2500); await o.screenshot({ path: `${out}/c-erased.png` }).catch(() => {})
  // save, reload
  await o.evaluate(() => (window as W).__terrain.save()); await sleep(1500)
  ok(posts.includes('draft') && scatOf(mockDraft?.props ?? []).length === scatOf(base).length + ps.length, `4. Save sends the draft with ${scatOf(mockDraft?.props ?? []).length} scattered pieces`)
  await openFly(o)
  const back = scatOf((await T(o)).props.filter(p => !base.some(b => b.id === p.id)))
  ok(back.length === ps.length && JSON.stringify([...back].sort((a, b) => a.id < b.id ? -1 : 1)) === JSON.stringify([...ps].sort((a, b) => a.id < b.id ? -1 : 1)), `4. RELOAD: the draft keeps all ${back.length}, exactly`)
  await o.evaluate(() => (window as W).__terrain.publish('m85-scatter-check')); await sleep(1500)
  ok(posts.includes('publish') && scatOf(mockLive?.props ?? []).length === scatOf(base).length + ps.length, `5. Publish carries them (${scatOf(mockLive?.props ?? []).length}) to the scratch live layer`)
  const after = await store(o); const h1 = hashes(after)
  ok(JSON.stringify(h0) === JSON.stringify(h1), `5. the REAL store is untouched (${JSON.stringify(h1)})`)
  await owner.close()

  // the keeper
  const liveTxt = await (await fetch(`${url}/shimmer/open/wilds-edits`, { cache: 'no-store' } as any)).text()
  const scratch = JSON.stringify({ ...JSON.parse(liveTxt), props: mockLive.props })
  const ctx = await br.createBrowserContext(), kp = await ctx.newPage(); await kp.setViewport({ width: 390, height: 844 })
  kp.on('pageerror', e => errs.push('keeper: ' + String(e).slice(0, 200)))
  await kp.setRequestInterception(true)
  kp.on('request', r => { if (r.method() === 'GET' && r.url().includes('/shimmer/open/wilds-edits')) r.respond({ status: 200, contentType: 'application/json', body: scratch }); else r.continue() })
  await kp.evaluateOnNewDocument('window.__name = (f) => f'); await kp.evaluateOnNewDocument(devtools)
  await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await kp.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  const A = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as W).__ather?.[f]?.(...x), fn, a)
  await kp.waitForFunction(() => (window as W).__ather?.wildsLoaded?.().length > 0, { timeout: 240000, polling: 1000 }); await sleep(2000)
  const greg = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 0, made: 0 }
  for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: greg }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  ok((await A('zone')) === 'wilds', '6. a fresh keeper (390x844, no owner key) is in the Wilds')
  await sleep(4000)
  let sc: any = null
  for (let i = 0; i < 20; i++) { sc = await kp.evaluate(() => (window as W).__wildsScenery?.() ?? null); if (sc?.items?.length) break; await sleep(1000) }
  const mine = (sc?.items ?? []).filter((i: any) => ps.some(p => p.id === i.id))
  ok(mine.length === ps.length && mine.every((i: any) => Number.isFinite(i.y)), `6. the game draws all ${mine.length} of ${ps.length} scattered pieces on the ground`)
  const sb = (sc?.boxes ?? []).filter((b: any) => ps.some(p => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1))
  ok(sb.length === 0, `6. no collision box over any scattered piece (${sb.length})`)
  const pos = async () => { const s = await A('state') as { px: number; pz: number }; return { x: s.px, z: s.pz } }
  // stand west of the patch looking east along it (yaw: the game's), walk through
  const yawE = -Math.PI / 2
  await A('tp', SPOTS[0].x - 8, SPOTS[0].z, yawE); await sleep(1500); await A('look', yawE, -0.25); await sleep(3000)
  await kp.screenshot({ path: `${out}/d-keeper-sees.png` })
  const kc = await calls(kp)
  ok(!!kc && kc.batches > 0 && kc.batches <= 8 && kc.scatter > 0 && kc.scatter <= 2 * kc.batches, `7. keeper: the ${kc?.pieces} scattered pieces cost ${kc?.scatter} draw calls a frame (${kc?.batches} batches) of ${kc?.total} in all`)
  // walk: from 1.5 m short of the patch's first piece on this row (the slow swiftshader frame rate walks a few metres a minute)
  const row = ps.filter(p => Math.abs(p.z - SPOTS[0].z) < 1.5).sort((a, b) => a.x - b.x), first = row[0] ?? ps[0], goal = first.x + 2
  await A('tp', first.x - 1.5, first.z, yawE); await sleep(1500); await A('look', yawE, -0.25); await sleep(1500)
  const p0 = await pos()
  await kp.keyboard.down('KeyW')
  for (let t = 0; t < 80; t++) { await sleep(500); if ((await pos()).x > goal) break }
  await kp.keyboard.up('KeyW'); await sleep(500)
  const pE = await pos(), passed = row.filter(p => p.x > p0.x && p.x < pE.x).length
  ok(pE.x > goal && Math.abs(pE.z - p0.z) < 1, `7. the walk goes straight through the patch: (${p0.x.toFixed(1)}, ${p0.z.toFixed(1)}) -> (${pE.x.toFixed(1)}, ${pE.z.toFixed(1)}), past ${passed} pieces on its row`)
  await kp.screenshot({ path: `${out}/e-keeper-in-patch.png` })
  await ctx.close()
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `\n${fails} FAILED` : '\nPASS'); process.exit(fails ? 1 : 0)
