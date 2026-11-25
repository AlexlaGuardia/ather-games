// ── M153 s1c-2: GREG'S HOME, THE FIVE LOTS AND YARROW'S CRATE IN PLACE MODE ──
//   default = READ ONLY, for prod (owner, on the box): every POST to save-builder is answered in the page, nothing is written. The game
//     half asserts every house is drawn exactly where the layer (nothing moved = the code) puts it.
//   --loop = move, undo, X, refuse, publish, a fresh keeper's view and bumps (phone + desktop); --loop --rollback = roll back. A THROWAWAY
//     COPY on localhost only. Between the two: glade-fennel-check [--phone] --url .. talks to Fennel at his moved door.
//   OWNER_KEY=.. npx tsx scripts/glade-places-check.mts [--url ..] [--loop [--rollback]]
import { SCENERY } from '../src/app/shimmer/open/ather/scenery'
import puppeteer, { type Page } from 'puppeteer-core'
import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { parseGladeLayer } from '../src/app/shimmer/open/ather/glade-layer'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/glade-places-check'), LOOP = process.argv.includes('--loop')
if (LOOP) { const u = new URL(url); if (u.hostname !== 'localhost' || /^32[0]\d$/.test(u.port)) { console.error('--loop publishes: a throwaway copy on localhost only'); process.exit(2) } }
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY ?? ''
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = [], posts: string[] = [], sent: any[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const AT = { x: -100, z: 120 }   // Greg's garden
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
import { gladePeople, GLADE_GATE } from '../src/app/shimmer/open/ather/glade-cluster'
import { gladePlaces, placeDoor, placeSolids, placeY } from '../src/app/shimmer/open/ather/glade-places'
import { gladeLayerGround } from '../src/app/shimmer/open/ather/glade-layer'
import { setGladeBlueprint } from '../src/app/shimmer/open/ather/glade-lots'
import { GLADE_LOTS } from '../src/app/shimmer/open/ather/moonwell-glade'
import { gladeShapeOf } from '../src/app/shimmer/open/ather/glade-people-check'
import { parseHouse } from '../src/app/shimmer/open/ather/plot-blueprint'
const GO: Record<string, { x: number; z: number; r: number }> = { home: { x: -45, z: 80, r: 1 }, fennel: { x: -100, z: 140, r: 0 }, jars: { x: -72, z: 108, r: 0 } }
for (const l of GLADE_LOTS) { const j = await fetch(`${url}/shimmer/open/house-blueprints?id=glade-${l.id}`).then(r => (r.ok ? r.json() : null)).catch(() => null), bp = j ? parseHouse(j) : null; if (bp) setGladeBlueprint(l.id, bp) }
const CODE = JSON.stringify(gladePlaces())
const game = async (phone: boolean) => {
  const g = await (await br.createBrowserContext()).newPage(); g.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
  await g.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 800 }); await g.evaluateOnNewDocument('window.__name = (f) => f')
  await g.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await g.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await g.waitForFunction(() => typeof (window as W).__ather?.travel === 'function', { timeout: 240000 })
  for (let i = 0; i < 40 && !(await g.evaluate(() => (window as W).__ather?.zone?.() === 'glade')); i++) { await g.evaluate(() => (window as W).__ather.travel({ kind: 'glade' })); await sleep(4000) }
  await g.waitForFunction(() => (window as W).__glade?.blueprints?.().length === 5, { timeout: 60000 }).catch(() => {}); await sleep(6000)
  return g
}
/** what a fresh keeper's page draws against the resolver for the layer the site serves; `bump` = walk into these */
const same = async (phone: boolean, label: string, bump: string[] = []) => {
  const l = parseGladeLayer(await (await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' })).json()); setGladePeople(l.props)
  const land = gladeLayerGround(l.edits), want = gladePlaces(), g = await game(phone), got = await g.evaluate(() => (window as W).__glade.houses()) as { id: string; x: number; y: number; z: number; yaw: number }[]
  const off = want.filter(w => { const h = got.find(q => q.id === w.place); return !h || Math.hypot(h.x - w.x, h.z - w.z) > 0.01 || Math.abs(Math.atan2(Math.sin(h.yaw - w.yaw), Math.cos(h.yaw - w.yaw))) > 0.01 })
  ok(got.length === 7 && off.length === 0, `${label}: the seven are drawn on their spots${off.length ? ' NOT ' + off.map(o => o.place) : ''} (${want.filter(w => w.moved).map(w => w.place).join() || 'none'} moved)`)
  const hm = got.find(h => h.id === 'home')!; ok(Math.abs(hm.y - placeY('home', land)) < 0.02, `${label}: the home's floor ${hm.y.toFixed(2)}`)
  const fen = (await g.evaluate(() => (window as W).__glade.folk) as any[]).find(f => f.id === 'moonwell:fennel'), d = placeDoor('fennel')
  ok(!!fen && Math.hypot(fen.x - d.x, fen.z - d.z) < 0.02, `${label}: Fennel stands at his door (${fen?.x.toFixed(1)}, ${fen?.z.toFixed(1)})`)
  const solid = gladeShapeOf(l).solids
  for (const id of bump) {
    const p = want.find(w => w.place === id)!, bs = placeSolids(p.place, land), R = Math.max(p.w, p.d) / 2 + 3
    // a straight line in, from a side that starts free: the keeper must stop before a wall, not stand past it
    let best: { x: number; z: number; tx: number; tz: number } | null = null
    for (let k = 0; k < 16 && !best; k++) { const a = k * Math.PI / 8, x = p.x + Math.cos(a) * R, z = p.z + Math.sin(a) * R; if (!solid(x - 1, 0, z - 1, x + 1, 5, z + 1).length && Math.abs(land(x, z) - placeY(p.place, land)) < 0.3) { let blocked = 0; for (let t = 0; t < 1; t += 0.02) { const qx = x + (p.x - x) * t, qz = z + (p.z - z) * t; if (bs.some(b => b.y0 < 3 && b.x0 < qx && b.x1 > qx && b.z0 < qz && b.z1 > qz)) { blocked = t; break } } if (blocked > 0) best = { x, z, tx: p.x, tz: p.z } } }
    if (!best) { ok(false, `${label}: no free line into ${id}`); continue }
    await g.evaluate((b: any) => (window as W).__ather.gladeAt(b.x, b.z, Math.atan2(-(b.tx - b.x), -(b.tz - b.z))), best); await sleep(4000)
    const at0 = await g.evaluate(() => { const s = (window as W).__ather.state(); return { x: s.px, z: s.pz } }) as any
    await g.keyboard.down('KeyW'); let last = at0, still = 0
    for (let i = 0; i < 30 && still < 4; i++) { await sleep(1000); const s = await g.evaluate(() => { const q = (window as W).__ather.state(); return { x: q.px, z: q.pz } }) as any; still = Math.hypot(s.x - last.x, s.z - last.z) < 0.02 && i > 3 ? still + 1 : 0; last = s }
    await g.keyboard.up('KeyW')
    const walked = Math.hypot(last.x - at0.x, last.z - at0.z), inside = bs.some(b => b.y0 < 3 && b.x0 < last.x && b.x1 > last.x && b.z0 < last.z && b.z1 > last.z), left = Math.hypot(last.x - p.x, last.z - p.z)
    ok(walked > 0.5 && !inside && still >= 4 && left > 0.4, `${label}: ${id} is bumped (walked ${walked.toFixed(1)} m, stopped ${left.toFixed(1)} m from its middle)`)
    await g.screenshot({ path: `${out}/${label.replace(/\W+/g, '-')}-${id}.png` })
  }
  await g.screenshot({ path: `${out}/${label.replace(/\W+/g, '-')}.png` }); await g.close()
}
try {
  const o = await enter(), before = await store(o), h0 = hashes(before)
  console.log(`  before ${JSON.stringify(h0)}`)
  if (process.argv.includes('--rollback')) {
    if (!LOOP) throw new Error('--rollback needs --loop')
    await openFly(o); await o.evaluate((v: number) => (window as W).__terrain.rollback(v), before.v - 1); const s = await store(o)
    ok(!(s.live.props ?? []).some((p: any) => p.k.startsWith('spot:')) && !(s.draft.props ?? []).some((p: any) => p.k.startsWith('spot:')), 'roll back: no house is moved, live and draft')
    if (process.env.LIVE0) ok(hash(s.live) === process.env.LIVE0, `roll back: live is byte-identical (${hash(s.live)})`)
    await same(true, 'rolled back phone'); setGladePeople([]); ok(JSON.stringify(gladePlaces()) === CODE, 'the code spots')
  } else {
    await same(true, 'before phone'); setGladePeople([])
    await openFly(o); await key(o, 'KeyP')
    const base = (await props(o)).length, L0 = parseGladeLayer(before.draft), land = gladeLayerGround(L0.edits)
    // straight down on a spot of the house that nothing covers: its pad's corner, or the crate / the drum itself
    const select = async (id: string) => {
      setGladePeople(await props(o)); const p = gladePlaces().find(q => q.place === id)!, c = id === 'home' || id === 'jars' ? { x: p.x + (id === 'home' ? 1.5 : 0), z: p.z } : { x: p.x + Math.cos(p.yaw) * (p.w / 2 - 0.4) - Math.sin(p.yaw) * (p.d / 2 - 0.4), z: p.z - Math.sin(p.yaw) * (p.w / 2 - 0.4) - Math.cos(p.yaw) * (p.d / 2 - 0.4) }
      await o.evaluate((x: number, y: number, z: number, d: number, h: number) => (window as W).__builderFly.setCam({ x, z: z + d, y: y + h, yaw: 0, pitch: -Math.atan2(h, d), top: false }), c.x, placeY(p.place, land) + (id === 'home' ? 1.2 : id === 'jars' ? 0.5 : 0.1), c.z, id === 'jars' ? 0.6 : 4, id === 'jars' ? 1.5 : 5); await sleep(1800); await key(o, 'KeyM'); return (await P(o)).moving }
    await lock(o)
    const move = async (id: string, to: { x: number; z: number; r: number }) => { const sel = await select(id); for (let i = 0; i < to.r; i++) await key(o, 'KeyR'); if (id === 'fennel') await o.screenshot({ path: `${out}/fly-ghost.png` }); await o.evaluate((a: number, b: number) => (window as W).__terrain.place.put(a, b), to.x, to.z); await sleep(900); return sel }
    const sels: string[] = []; for (const id of Object.keys(GO)) sels.push(await move(id, GO[id]))
    let ps = await props(o)
    ok(sels.join() === 'hhome,hfennel,hjars' && ps.length === base + 3 && Object.entries(GO).every(([w, p]) => ps.some(q => q.id === 'h' + w && q.x === p.x && q.z === p.z)), `1. each is selected under the crosshair and moved (${sels})`)
    await o.evaluate(() => (window as W).__builderFly.setCam({ x: -90, z: 175, y: 30, yaw: 0, pitch: -0.6, top: false })); await sleep(2500); await o.screenshot({ path: `${out}/fly-moved.png` })
    await o.evaluate(() => (window as W).__terrain.undo()); await sleep(800); ok((await props(o)).length === base + 2, '2. one undo takes one move back'); await o.evaluate(() => (window as W).__terrain.redo()); await sleep(800)
    { const id = await select('fennel'); await key(o, 'KeyM'); await select('fennel'); await key(o, 'KeyX'); const q = await props(o); setGladePeople(q); ok(id === 'hfennel' && !q.some(p => p.id === 'hfennel') && gladePlaces().length === 7 && !gladePlaces().find(p => p.place === 'fennel')!.moved, "3. X = back to the code's spot, never gone"); await o.evaluate(() => (window as W).__terrain.undo()); await sleep(800); ok((await props(o)).some(p => p.id === 'hfennel'), '3. undo') }
    const publishNo = async (why: RegExp, n: string) => { const r = await o.evaluate(() => (window as W).__terrain.publish('no')); await sleep(1500); const st = await o.evaluate(() => (window as W).__terrain.status()); ok(r === false && why.test(st), `4. ${n} refused: ${st}`) }
    const refuse = async (id: string, to: { x: number; z: number }, why: RegExp, n: string) => { await move(id, { ...to, r: 0 }); await publishNo(why, n); await o.evaluate(() => (window as W).__terrain.undo()); await sleep(900) }
    await refuse('sax', { x: 350, z: 350 }, /Sax's house is in the void/, 'void')
    await refuse('home', { x: -122.5, z: 110.5 }, /Greg's home is in the Moonwell/, 'the pool')
    await refuse('mallow', { x: GLADE_GATE.x, z: GLADE_GATE.z }, /Mallow's house is in (the gate|the void|the water)|Mallow's house is on a slope/, 'the gate')
    await refuse('home', { x: -55.75, z: 93.5 }, /Greg's home stands in Hazel's house/, 'a house')
    { const p = gladePeople().find(q => q.who === 'greg')!; await refuse('home', { x: p.x, z: p.z }, /Gregory is inside something solid/, 'a person in a house') }
    if (LOOP) {   // through the stored draft: a piece in a wall, a fence ring, painted slope
      const FENCE = SCENERY.find(q => q.k.endsWith(':fence'))!.k, post = (L: any) => o.evaluate(async (l: any) => { await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'glade', action: 'draft', layer: l }) }) }, L)
      await o.evaluate(() => (window as W).__terrain.save?.()); const keep = await props(o), draft = { ...before.draft, props: keep }
      setGladePeople(keep); const w = placeSolids('fennel', land)[0], ring: any[] = []; let n = 1
      for (let s = -5; s <= 5; s++) for (const [x, z, q] of [[s, -5, 0], [s, 5, 0], [-5, s, 1], [5, s, 1]]) ring.push({ id: `pq${(n++).toString(36)}`, k: FENCE, x: GO.home.x + x, z: GO.home.z + z, q, s: 2 })
      for (const [n2, add, why] of [['a piece', [{ id: 'pq1', k: FENCE, x: (w.x0 + w.x1) / 2, z: (w.z0 + w.z1) / 2, q: 0, s: 1 }], /Fennel's house stands in a solid piece/], ['a shut door', ring, /Greg's home has a door nobody can reach on foot/]] as const) { await post({ ...draft, props: [...keep, ...add] }); await openFly(o); await publishNo(why, n2) }
      await post(draft); await openFly(o)
      const s = await store(o); ok(s.v === before.v && hash(s.live) === h0.live, '4. live unchanged by the refusals')
      await o.evaluate(() => (window as W).__terrain.publish('houses')); await sleep(1500); const s2 = await store(o)
      ok(s2.v === before.v + 1 && (s2.live.props ?? []).filter((p: any) => p.k.startsWith('spot:')).length === 3, `5. Publish: v${s2.v} (${await o.evaluate(() => (window as W).__terrain.status())})`)
      console.log(`LIVE0=${h0.live}`)
      await same(false, 'published desktop', ['home', 'fennel', 'jars']); await same(true, 'published phone', ['home'])
    } else { ok(!posts.includes('publish'), `5. nothing was published (${posts.join()})`); const h1 = hashes(await store(o)); ok(JSON.stringify(h1) === JSON.stringify(h0), `5. live + draft as they were ${JSON.stringify(h1)}`) }
  }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 400)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
