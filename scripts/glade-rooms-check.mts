// ── M153 s1c-3: THE FOUR GARDEN ROOMS IN PLACE MODE ──
//   default = READ ONLY, for prod (owner, on the box): every POST to save-builder is answered in the page, nothing is written. Asserts the
//     palette lists the four and the Glade a fresh keeper sees has exactly the rooms the served layer holds.
//   --loop = place, move, undo, X, turn, refuse, publish, a fresh keeper's view, walk on / bump / off (phone + desktop); --loop --rollback.
//     A THROWAWAY COPY on localhost only.
//   OWNER_KEY=.. npx tsx scripts/glade-rooms-check.mts [--url ..] [--loop [--rollback]]
import { GLADE_ROOMS, isRoom, type Prop } from '../src/app/shimmer/world/builder-props'
import { BENCH_IN, fromRect, inRect, padGround, padLevel, roomPad } from '../src/app/shimmer/open/ather/glade-pads'
import { SCENERY_BY, sceneryPlaced } from '../src/app/shimmer/open/ather/scenery'
import puppeteer, { type Page } from 'puppeteer-core'
import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { parseGladeLayer } from '../src/app/shimmer/open/ather/glade-layer'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/glade-rooms-check'), LOOP = process.argv.includes('--loop')
if (LOOP) { const u = new URL(url); if (u.hostname !== 'localhost' || /^32[0]\d$/.test(u.port)) { console.error('--loop publishes: a throwaway copy on localhost only'); process.exit(2) } }
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY ?? ''
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = [], posts: string[] = [], sent: any[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const AT = { x: -100, z: 120 }
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
import { setGladePeople } from '../src/app/shimmer/open/ather/glade-people'
import { gladePeople } from '../src/app/shimmer/open/ather/glade-cluster'
import { gladePlaces } from '../src/app/shimmer/open/ather/glade-places'
import { gladeLayerGround } from '../src/app/shimmer/open/ather/glade-layer'
import { setGladeBlueprint } from '../src/app/shimmer/open/ather/glade-lots'
import { GLADE_LOTS } from '../src/app/shimmer/open/ather/moonwell-glade'
import { placeProblems } from '../src/app/shimmer/open/ather/glade-people-check'
import { parseHouse } from '../src/app/shimmer/open/ather/plot-blueprint'
for (const l of GLADE_LOTS) { const j = await fetch(`${url}/shimmer/open/house-blueprints?id=glade-${l.id}`).then(r => (r.ok ? r.json() : null)).catch(() => null), bp = j ? parseHouse(j) : null; if (bp) setGladeBlueprint(l.id, bp) }
const game = async (phone: boolean) => {
  const g = await (await br.createBrowserContext()).newPage(); g.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
  await g.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 800 }); await g.evaluateOnNewDocument('window.__name = (f) => f')
  await g.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await g.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await g.waitForFunction(() => typeof (window as W).__ather?.travel === 'function', { timeout: 240000 })
  for (let i = 0; i < 40 && !(await g.evaluate(() => (window as W).__ather?.zone?.() === 'glade')); i++) { await g.evaluate(() => (window as W).__ather.travel({ kind: 'glade' })); await sleep(4000) }
  await g.waitForFunction(() => (window as W).__glade?.blueprints?.().length === 5, { timeout: 60000 }).catch(() => {}); await sleep(6000)
  return g
}

const layerNow = async () => parseGladeLayer(await (await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' })).json())
/** a fresh keeper's Glade against the served layer; `walk` = onto its floor, into its bench, back off */
const same = async (phone: boolean, label: string, walk: string[] = []) => {
  const l = await layerNow(); setGladePeople(l.props)
  const land = gladeLayerGround(l.edits), want = sceneryPlaced(l.props ?? [], padGround(l.props, land), land).filter(isRoom), g = await game(phone)
  const items = (await g.evaluate(() => (window as W).__scenery?.().items ?? [])) as any[], got = items.filter(isRoom)
  ok(got.length === want.length && want.every(w => got.some(q => q.id === w.id && q.x === w.x && q.z === w.z && q.q === w.q && Math.abs(q.y - w.y) < 0.02)), `${label}: ${got.length} room(s) drawn, each on its spot and level (${got.map(q => q.k).join() || 'none'})`)
  for (const k of walk) {
    const p = want.find(w => w.k === k)!, r = roomPad(p)!, D = r.d / 2, s = fromRect(r, 0, -D - 2), t = fromRect(r, 0, D - BENCH_IN)
    await g.evaluate((b: any) => (window as W).__ather.gladeAt(b.x, b.z, Math.atan2(-(b.tx - b.x), -(b.tz - b.z))), { x: s.x, z: s.z, tx: t.x, tz: t.z }); await sleep(4500)
    const pos = () => g.evaluate(() => { const q = (window as W).__ather.state(); return { x: q.px, y: q.py, z: q.pz } }) as Promise<any>
    const go = async (c: string, stop: (q: any) => boolean) => { let last = await pos(), still = 0; await g.keyboard.down(c as any); for (let i = 0; i < 45 && still < 4; i++) { await sleep(1000); const q = await pos(); still = i > 3 && Math.hypot(q.x - last.x, q.z - last.z) < 0.02 ? still + 1 : 0; last = q; if (stop(q)) break } await g.keyboard.up(c as any); return last }
    const a = await pos(), b = await go('KeyW', () => false), v = (q: any) => { const c = Math.cos(r.yaw), sn = Math.sin(r.yaw); return (q.x - r.x) * sn + (q.z - r.z) * c }
    ok(!inRect(r, a.x, a.z) && inRect(r, b.x, b.z) && v(b) > 0 && v(b) < D - BENCH_IN - 0.35, `${label}: walked onto ${k} and its ${k === 'room:cooking' ? 'hearth' : 'bench'} stops the keeper (${v(a).toFixed(1)} -> ${v(b).toFixed(1)}, bench at ${(D - BENCH_IN).toFixed(1)})`)
    ok(typeof b.y !== 'number' || Math.abs(b.y - p.y) < 2.2, `${label}: at ${b.y?.toFixed?.(2)}, the floor at ${p.y.toFixed(2)} (land ${land(b.x, b.z).toFixed(2)})`)
    ok(!(await g.evaluate(() => /Press E|Carpentry|Stonery|Rinnshop|Cooking room/.test(document.body.innerText))), `${label}: nothing to open at it`)
    await g.screenshot({ path: `${out}/${label.replace(/\W+/g, '-')}-${k.slice(5)}.png` })
    const c = await go('KeyS', q => !inRect(r, q.x, q.z, 0.3)); ok(!inRect(r, c.x, c.z), `${label}: and back off it (${v(c).toFixed(1)})`)
  }
  await g.screenshot({ path: `${out}/${label.replace(/\W+/g, '-')}.png` }); await g.close()
}
try {
  const o = await enter(), before = await store(o), h0 = hashes(before); console.log(`  before ${JSON.stringify(h0)}`)
  if (process.argv.includes('--rollback')) {
    if (!LOOP) throw new Error('--rollback needs --loop')
    await openFly(o); await o.evaluate((v: number) => (window as W).__terrain.rollback(v), before.v - 1); const s = await store(o)
    ok(![...(s.live.props ?? []), ...(s.draft.props ?? [])].some(isRoom), 'roll back: no room, live and draft')
    ok(!!process.env.LIVE0 && hash(s.live) === process.env.LIVE0, `roll back: live is byte-identical (${hash(s.live)})`)
    await same(true, 'rolled back phone')
  } else {
    await same(true, 'before phone')
    await openFly(o); await key(o, 'KeyP'); await lock(o)
    const L0 = parseGladeLayer(before.draft), base0 = L0.props ?? [], land = gladeLayerGround(L0.edits); setGladePeople(base0)
    // where four can stand, by the same rules Publish asks; the first on uneven ground (a plinth)
    const nb = gladePeople().find(p => p.who === 'newborn')!, spots: Prop[] = []
    for (let x = -150; x <= -60 && spots.length < 4; x += 5) for (let z = 110; z <= 165 && spots.length < 4; z += 5) {
      const k = GLADE_ROOMS[spots.length], v = padLevel({ x, z, yaw: 0, w: 8, d: 7 }, land), c: Prop = { id: `pz${spots.length}`, k: `room:${k}`, x, z, q: 0, s: 1 }
      if (!(v.top - v.low < 0.45) || (!spots.length && v.top - v.low < 0.12) || spots.some(s => Math.hypot(s.x - x, s.z - z) < 14)) continue
      const front = fromRect({ x, z, yaw: 0, w: 8, d: 7 }, 0, -6); if (Math.abs(land(front.x, front.z) - v.top) > 0.45) continue
      if (!placeProblems({ ...L0, props: [...base0, ...spots, c] }, gladePlaces(), nb).length) spots.push(c)
    }
    ok(spots.length === 4, `spots ${spots.map(s => `${s.k} ${s.x},${s.z}`).join(' | ')}`)
    await key(o, 'KeyE'); const inv = await o.$$eval('[data-testid^="place-item-room:"]', a => a.map(e => `${e.getAttribute('data-testid')!.slice(11)} ${e.textContent}`)); await o.screenshot({ path: `${out}/palette.png` }); await key(o, 'KeyE')
    ok(inv.length === 4 && GLADE_ROOMS.every(r => inv.some(t => t.startsWith(`room:${r} `) && t.includes(SCENERY_BY.get(`room:${r}`)!.label))), `1. the palette lists the four (${inv.join(' | ')})`)
    const n0 = (await props(o)).length, put = (x: number, z: number) => o.evaluate((a: number, b: number) => (window as W).__terrain.place.put(a, b), x, z)
    const last = async () => (await props(o)).at(-1)
    for (let i = 0; i < 8 && (await P(o)).turn !== 90; i++) await key(o, 'KeyT')
    // the first through the crosshair and the right button, a turn, its wheel and toggle (neither does anything)
    await choose(o, spots[0].k); await aim(o, spots[0].x, spots[0].z); await sleep(1500); await o.screenshot({ path: `${out}/fly-ghost.png` })
    await key(o, 'KeyB'); await click(o, 'right'); let c = await last()
    ok((await props(o)).length === n0 + 1 && c.k === spots[0].k && c.s === 1 && !('solid' in c), `2. right places it at (${c.x}, ${c.z}), true size, no toggle`)
    await aim(o, c.x, c.z, 12, -0.55); await sleep(2500); const tg = (await P(o)).target; ok(tg === c.id, `2. the crosshair finds it (${tg})`)
    await key(o, 'KeyM'); await key(o, 'KeyR'); await key(o, 'KeyR'); await put(spots[0].x, spots[0].z); await sleep(900); c = (await props(o)).find(p => p.id === c.id)
    ok(c.x === spots[0].x && c.z === spots[0].z && c.q === 2, '3. M moves it, R turns it (180)')
    await o.evaluate(() => (window as W).__terrain.undo()); await sleep(900); ok((await props(o)).find(p => p.id === c.id)?.q === 0, '3. one undo takes the move and the turn back'); await o.evaluate(() => (window as W).__terrain.undo()); await sleep(900); ok((await props(o)).length === n0, '3. one more takes the room away')
    for (const s of spots) { await choose(o, s.k); for (let i = 0; i < 4 && (await P(o)).hand.q !== 0; i++) await key(o, 'KeyR'); await put(s.x, s.z); await sleep(900) }
    ok((await props(o)).filter(isRoom).length === 4 && await Promise.all(spots.map(async s => (await props(o)).some(p => p.k === s.k && p.x === s.x && p.z === s.z && p.q === 0))).then(a => a.every(Boolean)), '4. all four placed')
    await o.evaluate((x: number, z: number) => (window as W).__builderFly.setCam({ x, z: z + 45, y: 28, yaw: 0, pitch: -0.55, top: false }), (Math.min(...spots.map(s => s.x)) + Math.max(...spots.map(s => s.x))) / 2, (Math.min(...spots.map(s => s.z)) + Math.max(...spots.map(s => s.z))) / 2); await sleep(3000); await o.screenshot({ path: `${out}/fly-four.png` })
    const one = (await props(o)).find(p => p.k === 'room:rinnshop')!; await aim(o, one.x, one.z, 12, -0.55); await sleep(1500); await key(o, 'KeyX'); ok(!(await props(o)).some(p => p.id === one.id), '5. X deletes it'); await o.evaluate(() => (window as W).__terrain.undo()); await sleep(900); ok((await props(o)).some(p => p.id === one.id), '5. undo brings it back')
    const refuse = async (x: number, z: number, why: RegExp, n: string) => {
      await aim(o, one.x, one.z, 12, -0.55); await sleep(1200); await key(o, 'KeyM'); ok((await P(o)).moving === one.id, `6. ${n}: in hand`); await put(x, z); await sleep(900)
      const r = await o.evaluate(() => (window as W).__terrain.publish('no')); await sleep(1500); const st = await o.evaluate(() => (window as W).__terrain.status()); ok(r === false && why.test(st), `6. ${n} refused: ${st}`)
      await o.evaluate(() => (window as W).__terrain.undo()); await sleep(900)
    }
    await refuse(-122.5, 110.5, /Rinnshop is in the Moonwell/, 'the pool'); await refuse(spots[0].x + 3, spots[0].z, /stands in (Rinnshop|Carpentry room)/, 'another room'); await refuse(350, 350, /Rinnshop is in the void/, 'the void')
    if (LOOP) {
      const s = await store(o); ok(s.v === before.v && hash(s.live) === h0.live, '7. live unchanged: players see nothing yet')
      await o.evaluate(() => (window as W).__terrain.publish('rooms')); await sleep(1500); const s2 = await store(o)
      ok(s2.v === before.v + 1 && (s2.live.props ?? []).filter(isRoom).length === 4, `7. Publish: v${s2.v} (${await o.evaluate(() => (window as W).__terrain.status())})`)
      console.log(`LIVE0=${h0.live}`)
      await same(false, 'published desktop', ['room:carpentry', 'room:cooking']); await same(true, 'published phone', ['room:carpentry', 'room:stonemason', 'room:rinnshop'])
    } else { ok(!posts.includes('publish'), `7. nothing was published (${posts.join()})`); const h1 = hashes(await store(o)); ok(JSON.stringify(h1) === JSON.stringify(h0), `7. live + draft as they were ${JSON.stringify(h1)}`) }
  }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 400)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
