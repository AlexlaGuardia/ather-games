// ── M168 s2: WATER LILIES IN PLACE MODE ──
//   default = READ ONLY (owner, on the box): every POST to save-builder is answered in the page, so nothing is written. The real draft may
//     change under it (Alex edits it): its hash is not asked, only that his placed pieces load.
//   --loop = publish for real and look as a fresh keeper, phone + desktop: A THROWAWAY COPY on localhost only.
//   OWNER_KEY=.. npx tsx scripts/m168-lily-check.mts [--url ..] [--out dir] [--loop --url http://localhost:3291]
import puppeteer, { type Page } from 'puppeteer-core'
import { MOONWELL } from '../src/app/shimmer/open/ather/moonwell'
import { POOL_Y } from '../src/app/shimmer/open/ather/moonwell-water'
import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { parseGladeLayer, gladeLayerGround, gladeWaterAt } from '../src/app/shimmer/open/ather/glade-layer'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m168-lily-check'), LOOP = process.argv.includes('--loop')
if (LOOP) { const u = new URL(url); if (u.hostname !== 'localhost' || /^32[0]\d$/.test(u.port)) { console.error('--loop publishes: a throwaway copy on localhost only'); process.exit(2) } }
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY ?? ''
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = [], posts: string[] = [], sent: any[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const AT = { x: -100, z: 130 }
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
type W = any
const props = (o: Page) => o.evaluate(() => (window as W).__terrain.props()) as Promise<any[]>
const P = (o: Page) => o.evaluate(() => (window as W).__terrain.place) as Promise<any>
const store = async (o: Page) => o.evaluate(async () => { const b = await (await fetch('/shimmer/save-builder?map=glade', { cache: 'no-store' })).json(); return { draft: b.draft, live: b.live, v: b.index.live, n: b.index.versions.length, state: b.state, draftAt: b.draftAt } }) as Promise<any>
const hashes = (s: any) => ({ draft: hash(s.draft), live: hash(s.live), v: s.v, n: s.n, at: s.draftAt })
async function enter(): Promise<Page> {
  const o = await (await br.createBrowserContext()).newPage(); o.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
  if (!LOOP) {
    await o.setRequestInterception(true)
    o.on('request', r => {
      if (r.method() === 'POST' && r.url().includes('save-builder')) { const b = JSON.parse(r.postData() ?? '{}'); posts.push(b.action); sent.push(b); r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, map: 'glade', draft: b.layer, draftAt: Date.now(), live: b.layer, index: { map: 'glade', live: 0, versions: [] }, state: 'unpublished changes' }) }) }
      else r.continue()
    })
  }
  await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  return o
}
async function openFly(o: Page) {
  await o.goto(`${url}/shimmer/dev?mode=terrain&map=glade`, { waitUntil: 'load', timeout: 240000 })
  await o.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "glade"', { timeout: 240000, polling: 500 })
  await o.click('[data-testid="view-fly"]')
  await o.waitForFunction('typeof window.__builderFly?.drawnAt === "function" && window.__builderFly.scene().tiles > 0', { timeout: 120000, polling: 500 })
  await o.evaluate((a: { x: number; z: number }) => { (window as W).__builderFly.setCam({ x: a.x, y: 9, z: a.z + 12, yaw: 0, pitch: -0.45, top: false }) }, AT)
  await sleep(4000)
}
const aim = async (o: Page, x: number, z: number, dz = 12, pitch = -0.5) => { await o.evaluate((a: number, b: number, d: number, pt: number) => { const T = (window as W).__terrain, c = T.origin(); (window as W).__builderFly.setCam({ x: a, z: b + d, y: T.heightAt(a - c.x, b - c.z) + 8, yaw: 0, pitch: pt, top: false }) }, x, z, dz, pitch); await sleep(1800) }
const middle = async (o: Page) => { const b = (await (await o.$('[data-testid="fly-frame"]'))!.boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
const click = async (o: Page, button: 'left' | 'right') => { await o.evaluate((bt: number) => { const c = document.querySelector('[data-testid="fly-frame"] canvas')!; c.dispatchEvent(new PointerEvent('pointerdown', { button: bt, bubbles: true, cancelable: true, pointerId: 1 })); window.dispatchEvent(new PointerEvent('pointerup', { button: bt, pointerId: 1 })) }, button === 'left' ? 0 : 2); await sleep(1500) }
const lock = async (o: Page) => { const m = await middle(o); for (let i = 0; i < 4 && !(await o.evaluate(() => (window as W).__builderFly.locked())); i++) { await o.mouse.click(m.x, m.y - 60); await sleep(1500) } }
const key = async (o: Page, c: string) => { await o.keyboard.press(c as any); await sleep(700) }
const choose = async (o: Page, k: string) => { await key(o, 'KeyE'); await o.click(`[data-testid="place-item-${k}"]`); await sleep(400); await key(o, 'KeyE'); await sleep(1600); await lock(o) }
const game = async (ph: boolean) => {
  const g = await (await br.createBrowserContext()).newPage(); g.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
  await g.setViewport(ph ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 800 }); await g.evaluateOnNewDocument('window.__name = (f) => f')
  await g.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await g.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await g.waitForFunction(() => typeof (window as W).__ather?.travel === 'function', { timeout: 240000 })
  for (let i = 0; i < 40 && !(await g.evaluate(() => (window as W).__ather?.zone?.() === 'glade')); i++) { await g.evaluate(() => (window as W).__ather.travel({ kind: 'glade' })); await sleep(4000) }
  await sleep(8000); return g
}
const until = async (f: () => Promise<unknown>, ms = 30000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const scen = (o: Page) => o.evaluate(() => (window as W).__scenery?.()?.items ?? []) as Promise<any[]>
try {
  const o = await enter(), before = await store(o), base: any[] = before.draft.props ?? []
  const writes: string[] = []; o.on('request', r => { if (r.method() !== 'GET' && !r.url().includes('save-builder') && !/\/cdn-cgi\/rum|posthog\.com/.test(r.url()))   // page analytics write nothing of the game writes.push(`${r.method()} ${r.url().slice(0, 90)}`) })
  await openFly(o); await key(o, 'KeyP'); await lock(o)
  const got = await props(o), drawn0 = await scen(o)
  ok(got.length >= base.length && base.every(b => JSON.stringify(got.find(p => p.id === b.id)) === JSON.stringify(b)), `1. the saved draft loads unchanged: ${base.length} pieces, ${drawn0.length} drawn`)
  const standing = base.filter(b => /^(filler|tree|bush|crystal|prop|piece|node|room):/.test(b.k)); ok(standing.every(b => drawn0.some(d => d.id === b.id)), `1. every placed piece of it is drawn (${standing.length})`)
  const layer = parseGladeLayer(before.draft), land = gladeLayerGround(layer.edits), W0 = gladeWaterAt(layer)
  const put = async (x: number, z: number) => { const n = (await props(o)).length; await o.evaluate((a: number, b: number) => (window as W).__terrain.place.put(a, b), x, z); await sleep(900); const q = await props(o); return q.length > n ? q[q.length - 1] : null }
  const status = () => o.evaluate(() => (window as W).__terrain.status()) as Promise<string>
  const yOf = async (id: string) => { const i = (await scen(o)).find(q => q.id === id); return i ? i.y : null }
  for (let i = 0; i < 6 && (await P(o)).snap !== 0; i++) await key(o, 'KeyG')
  await aim(o, MOONWELL.x, MOONWELL.z, 12, -0.5)
  const ids: string[] = []
  await choose(o, 'filler:lily-pads')
  ok((await put(AT.x, AT.z)) === null && /only on water/.test(await status()), `2. dry ground refuses it ("${await status()}")`)
  for (const [x, z] of [[0, 0], [2.6, 1.2], [-2.4, 1.8]]) { const p = await put(MOONWELL.x + x, MOONWELL.z + z); if (p) ids.push(p.id) }
  await choose(o, 'filler:water-lily')
  for (const [x, z] of [[0.6, 2.6], [-1.2, 3.2], [1.6, -1.4]]) { const p = await put(MOONWELL.x + x, MOONWELL.z + z); if (p) ids.push(p.id) }
  const it = (await scen(o)).filter(i => ids.includes(i.id))
  ok(ids.length === 6 && it.length === 6 && it.every(i => Math.abs(i.y - POOL_Y) < 1e-6 && land(i.x, i.z) < POOL_Y), `2. six lie on the Moonwell's sheet (${POOL_Y.toFixed(2)}, the bed ${land(MOONWELL.x, MOONWELL.z).toFixed(2)} under them)`)
  // the real right click: the crosshair takes the water's surface, not the bed behind it
  { await aim(o, MOONWELL.x + 3, MOONWELL.z + 3, 10, -0.6); const n = (await props(o)).length; await click(o, 'right'); const q = (await props(o)).slice(n)[0]
    const want = await o.evaluate((py: number) => { const c = (window as W).__builderFly.cam(), t = (c.y - py) / Math.sin(-c.pitch); return { x: c.x - Math.sin(c.yaw) * Math.cos(c.pitch) * t, z: c.z - Math.cos(c.yaw) * Math.cos(c.pitch) * t } }, POOL_Y)
    ok(q && Math.hypot(q.x - want.x, q.z - want.z) < 0.05, `2. a right click puts it where the crosshair meets the water (${q && [q.x, q.z].map((v: number) => v.toFixed(2))} want ${[want.x, want.z].map(v => v.toFixed(2))})`); if (q) ids.push(q.id)
    await sleep(800); ok((await P(o)).target === q?.id, `2. the crosshair takes it (${(await P(o)).target})`)
    await key(o, 'KeyB'); ok((await props(o)).find(p => p.id === q.id)?.solid === undefined, '2. B does nothing to it: never solid') }
  await o.screenshot({ path: `${out}/fly-pool.png` as `${string}.png` })
  // a bank-hugging one: the middle wet, the rim dry
  { let x = MOONWELL.x; while (W0(x + 0.1, MOONWELL.z) !== null) x += 0.1; ok((await put(x, MOONWELL.z)) === null, '2. half over the shore: refused') }
  // painted water: follows the level, gone when dried, back on undo
  const c = await o.evaluate(() => (window as W).__terrain.origin()) as { x: number; z: number }, g = land(AT.x, AT.z)
  const water = async (lv: number | null) => { await o.evaluate((x: number, z: number, l: number | null) => (window as W).__terrain.water(x, z, 16, l), AT.x - c.x, AT.z - c.z, lv); await sleep(1500) }
  await water(Math.round((g + 0.8) * 10) / 10); const q = await put(AT.x, AT.z); const y1 = q ? await yOf(q.id) : null
  ok(q && y1 !== null && Math.abs(y1 - (Math.round((g + 0.8) * 10) / 10 - 0.05)) < 1e-6, `3. on painted water, at its drawn surface (${y1?.toFixed(2)})`)
  await water(Math.round((g + 1.6) * 10) / 10); const y2 = await yOf(q.id); ok(y2 !== null && Math.abs(y2 - y1! - 0.8) < 1e-6, `3. the water up 0.8: it goes with it (${y2?.toFixed(2)})`)
  await aim(o, AT.x, AT.z, 9, -0.5); await o.screenshot({ path: `${out}/fly-painted.png` as `${string}.png` })
  await water(null); const hud = await o.evaluate(() => document.querySelector('[data-testid="place-hud"]')?.textContent ?? '')
  ok((await yOf(q.id)) === null && (await props(o)).some(p => p.id === q.id) && /1 not drawn: no water/.test(hud), '3. dried: not drawn, kept in the list, the line says so')
  await o.evaluate(() => (window as W).__terrain.undo()); await sleep(1500); ok((await yOf(q.id)) === y2, '3. undo: the water is back and so is it')
  await o.setViewport({ width: 390, height: 844 }); await sleep(2500); await aim(o, MOONWELL.x, MOONWELL.z, 9, -0.6); await o.screenshot({ path: `${out}/fly-390.png` as `${string}.png` }); await o.setViewport({ width: 1280, height: 900 }); await sleep(1500)
  if (!LOOP) { ok(!posts.includes('publish'), `4. nothing was published (answered in the page: ${posts.join() || 'none'})`); ok(writes.length === 0, `4. no other request that writes (${writes})`) }
  else {
    // the painted water goes again (it floods a house's door): its lily stays in the list, and the game does not draw it either
    await water(null)
    ok((await yOf(q.id)) === null && (await props(o)).some(p => p.id === q.id), 'L. the water undone: its lily kept, not drawn')
    await o.evaluate(() => (window as W).__terrain.publish('m168b')); const s2 = await store(o); ok(s2.v === before.v + 1, `L. Publish: v${s2.v} (${await status()})`)
    const fly = (await scen(o)).filter(i => ids.includes(i.id))
    for (const ph of [true, false]) {
      const g = await game(ph), tag = ph ? 'phone' : 'desk'; await until(async () => (await scen(g)).length > 0)
      ok(!(await scen(g)).some(i => i.id === q.id), `L. ${tag}: the lily whose water went is not drawn`)
      const gi = (await scen(g)).filter(i => ids.includes(i.id)); ok(gi.length === ids.length && gi.every(a => Math.abs(a.y - fly.find(f => f.id === a.id)!.y) < 1e-6), `L. ${tag}: every lily lies as in Fly (${gi.length})`)
      const sc = await g.evaluate(() => { const s = (window as W).__scenery(); return { meshes: s.meshes, drawn: s.drawn } }); console.log(`  ${tag}: scenery ${sc.meshes} draw calls, ${sc.drawn} instances`)
      await g.evaluate((x: number, z: number) => { const a = (window as W).__ather; a.gladeAt(x, z, 0); a.look?.(0, -0.35) }, MOONWELL.x, MOONWELL.z + 7); await sleep(9000); if (ph) { await g.touchscreen.tap(195, 400); await sleep(1500) }
      await g.screenshot({ path: `${out}/game-pool-${tag}.png` as `${string}.png` })
      if (!ph) {   // wade through: nothing stops the keeper
        await g.mouse.click(640, 400); await sleep(800); const z0 = await g.evaluate(() => (window as W).__ather.state().pz); await g.keyboard.down('KeyW')
        const thru = await until(async () => (await g.evaluate(() => (window as W).__ather.state().pz)) < MOONWELL.z - 1.5, 120000); await g.keyboard.up('KeyW'); ok(thru, `L. the keeper wades through them (${z0.toFixed(1)} to ${(await g.evaluate(() => (window as W).__ather.state().pz)).toFixed(1)}, pads at ${MOONWELL.z})`) }
      await g.evaluate((x: number, z: number) => { const a = (window as W).__ather; a.gladeAt(x, z, 0); a.look?.(0, -0.3) }, AT.x, AT.z + 6); await sleep(7000); await g.screenshot({ path: `${out}/game-painted-${tag}.png` as `${string}.png` }); await g.close()
    }
    await o.evaluate((v: number) => (window as W).__terrain.rollback(v), before.v); ok(hash((await store(o)).live) === hash(before.live), 'L. roll back: live is what it was')
  }
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
await br.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
