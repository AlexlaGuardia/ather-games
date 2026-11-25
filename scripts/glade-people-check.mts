// ── M153 s1c-1: PEOPLE AND THE NEWBORN SPOT IN PLACE MODE ──
//   default = READ ONLY, for prod (owner, on the box): every POST to save-builder is answered in the page, nothing is written.
//   --loop = move, refuse, publish, a fresh keeper's view (phone + desktop), and (with --rollback) roll back, against a THROWAWAY COPY on
//     localhost only. --loop leaves the moves live so m146-first-steps-check / --loop --rollback can follow; run in that order.
//   OWNER_KEY=.. npx tsx scripts/glade-people-check.mts [--url ..] [--loop [--rollback]]
import { SCENERY } from '../src/app/shimmer/open/ather/scenery'
import puppeteer, { type Page } from 'puppeteer-core'
import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { parseGladeLayer } from '../src/app/shimmer/open/ather/glade-layer'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/glade-people-check'), LOOP = process.argv.includes('--loop')
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
const F = { x: AT.x + 1, z: AT.z + 11 }, R = { x: AT.x - 5, z: AT.z + 11 }, SH = { x: -104, z: 174 }   // s1a+: a fence, a rock, the shore
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
import { gladePeople, gladeNewbornSpot } from '../src/app/shimmer/open/ather/glade-cluster'
const GO: Record<string, { x: number; z: number }> = { greg: { x: -80, z: 104 }, bonn: { x: -100, z: 300 }, yarrow: { x: -300, z: 310 }, newborn: { x: -76, z: 110 } }
const CODE = gladePeople(), FENCE = SCENERY.find(q => q.k.endsWith(':fence'))!.k
const game = async (phone: boolean) => {
  const g = await (await br.createBrowserContext()).newPage(); g.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
  await g.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 800 }); await g.evaluateOnNewDocument('window.__name = (f) => f')
  await g.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await g.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await g.waitForFunction(() => typeof (window as W).__ather?.travel === 'function', { timeout: 240000 })
  for (let i = 0; i < 40 && !(await g.evaluate(() => (window as W).__ather?.zone?.() === 'glade')); i++) { await g.evaluate(() => (window as W).__ather.travel({ kind: 'glade' })); await sleep(4000) }
  await sleep(8000)
  const r = await g.evaluate(() => { const w = (window as W), s = w.__ather.state(); return { keepers: w.__glade.keepers, folk: w.__glade.folk, greg: w.__glade.greg, live: w.__greg, at: { x: s.px, z: s.pz } } }) as any
  return { g, r }
}
/** what the game draws against what the resolver says for the layer it serves */
const same = async (phone: boolean, label: string) => {
  const l = parseGladeLayer(await (await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' })).json()); setGladePeople(l.props)
  const { g, r } = await game(phone), want = gladePeople(), nb = gladeNewbornSpot(), got = [...r.keepers, ...r.folk]
  const miss = want.filter(w => w.who !== 'newborn' && w.who !== 'greg' && w.who !== (w.moved ? '' : 'fennel')).filter(w => !got.some((k: any) => k.id.split(':').pop() === w.who && Math.hypot(k.x - w.x, k.z - w.z) < 0.02)), gw = want[0]
  ok(miss.length === 0, `${label}: everyone stands on their spot${miss.length ? ' NOT ' + miss.map(m => m.who) : ''}`)
  ok(Math.hypot(r.live.x - gw.x, r.live.z - gw.z) < 0.05 && r.live.pose === 'sit', `${label}: Greg sits at ${gw.x.toFixed(1)}, ${gw.z.toFixed(1)} (drawn ${r.live.x.toFixed(1)}, ${r.live.z.toFixed(1)})`)
  ok(Math.hypot(r.at.x - nb.x, r.at.z - nb.z) < 1, `${label}: the arrival is the newborn spot (${r.at.x.toFixed(1)}, ${r.at.z.toFixed(1)})`)
  await g.screenshot({ path: `${out}/${label.replace(/\W+/g, '-')}.png` }); await g.close()
}
try {
  const o = await enter()
  const before = await store(o), h0 = hashes(before)
  console.log(`  before ${JSON.stringify(h0)}`)
  if (process.argv.includes('--rollback')) {
    if (!LOOP) throw new Error('--rollback needs --loop')
    await openFly(o); await o.evaluate((v: number) => (window as W).__terrain.rollback(v), before.v - 1); const s = await store(o)
    ok(!(s.live.props ?? []).some((p: any) => p.k.startsWith('who:')) && !(s.draft.props ?? []).some((p: any) => p.k.startsWith('who:')), 'roll back: nobody is moved, live and draft')
    if (process.env.LIVE0) ok(hash(s.live) === process.env.LIVE0, `roll back: live is byte-identical (${hash(s.live)})`)
    await same(true, 'rolled back phone'); setGladePeople([]); ok(JSON.stringify(gladePeople()) === JSON.stringify(CODE), 'the code spots')
  } else if (process.argv.includes('--trap')) {   // solid + reach, live: a trunk on Hazel, then a ring of fences round her; the draft is put back
    if (!LOOP) throw new Error('--trap needs --loop')
    const saved = before.draft, ring: any[] = []; let n = 1
    for (let s = -3; s <= 3; s++) for (const [x, z, q] of [[s, -4, 0], [s, 4, 0], [-4, s, 1], [4, s, 1]]) ring.push({ id: `pq${(n++).toString(36)}`, k: 'filler:fence', x: -80 + x, z: 100 + z, q, s: 2 })
    const who = { id: 'whazel', k: 'who:hazel', x: -80, z: 100, q: 0, s: 1 }
    for (const [label, add, why] of [['trunk', [{ id: 'pq1', k: 'node:goldwood', x: -80, z: 100, q: 0, s: 1 }], /Hazel is inside something solid/], ['ring', ring.map(r => ({ ...r, k: FENCE })), /Hazel cannot be reached on foot from the newborn spot/]] as const) {
      await o.evaluate(async (L: any) => { await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'glade', action: 'draft', layer: L }) }) }, { ...saved, props: [...add, who] })
      await openFly(o); const r = await o.evaluate(() => (window as W).__terrain.publish('no')); await sleep(1500); const st = await o.evaluate(() => (window as W).__terrain.status()); ok(r === false && why.test(st), `5. ${label}, refused: ${st}`)
    }
    await o.evaluate(async (L: any) => { await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'glade', action: 'draft', layer: L }) }) }, saved)
    const s = await store(o); ok(s.v === before.v && hash(s.live) === h0.live, 'live unchanged')
  } else {
    await same(true, 'before phone')
    setGladePeople([])
    await openFly(o); await key(o, 'KeyP')
    const fx = await o.evaluate(() => (window as W).__builderFly.fixed()) as { folk: string[] }
    ok(fx.folk.length === 10 && fx.folk.includes('newborn'), `1. nine people and the newborn spot are drawn (${fx.folk.length})`)
    const base = (await props(o)).length
    const select = async (who: string, at: { x: number; z: number }) => { await o.evaluate((x: number, z: number) => { const T = (window as W).__terrain, c = T.origin(); (window as W).__builderFly.setCam({ x, z: z + 6, y: T.heightAt(x - c.x, z - c.z) + 6, yaw: 0, pitch: -Math.atan2(5.35, 6), top: false }) }, at.x, at.z); await sleep(1800); await key(o, 'KeyM'); return (await P(o)).moving }
    await lock(o)
    const move = async (who: string, to: { x: number; z: number }, r = 0) => { setGladePeople(await props(o)); const c = gladePeople().find(p => p.who === who)!, sel = await select(who, c); for (let i = 0; i < r; i++) await key(o, 'KeyR'); await o.evaluate((a: number, b: number) => (window as W).__terrain.place.put(a, b), to.x, to.z); await sleep(900); return sel }
    const sels: string[] = []; for (const w of ['greg', 'bonn', 'yarrow', 'newborn']) sels.push(await move(w, GO[w], w === 'greg' ? 1 : 0))
    let ps = await props(o); ok(sels.join() === 'wgreg,wbonn,wyarrow,wnewborn' && ps.length === base + 4 && Object.entries(GO).every(([w, p]) => ps.some(q => q.id === 'w' + w && q.x === p.x && q.z === p.z)), `2. each is selected under the crosshair and moved (${sels})`)
    ok(!ps.find(p => p.id === 'wnewborn').turned, '2. the newborn spot moved, not turned')
    await o.screenshot({ path: `${out}/fly-moved.png` })
    await o.evaluate(() => (window as W).__terrain.undo()); await sleep(800); ok((await props(o)).length === base + 3, '3. one undo takes one move back'); await o.evaluate(() => (window as W).__terrain.redo()); await sleep(800)
    await select('newborn', GO.newborn); await key(o, 'KeyR'); await o.evaluate((a: number, b: number) => (window as W).__terrain.place.put(a, b), GO.newborn.x, GO.newborn.z); await sleep(900); ok((await props(o)).find(p => p.id === 'wnewborn').turned === true, '3. R turns the newborn spot')
    await o.evaluate(() => (window as W).__terrain.undo()); await sleep(800)
    ps = await props(o); ok(ps.length === base + 4 && !ps.find(p => p.id === 'wnewborn').turned, '3. undo: not turned')
    await select('bonn', GO.bonn); await key(o, 'KeyX'); ok(!(await props(o)).some(p => p.id === 'wbonn') && (await o.evaluate(() => (window as W).__builderFly.fixed().folk.length)) === 10, '4. X = back to the code spot, never gone'); await o.evaluate(() => (window as W).__terrain.undo()); await sleep(800)
    // refusals
    const refuse = async (who: string, to: { x: number; z: number }, why: RegExp, pre?: () => Promise<void>) => { await move(who, to); if (pre) await pre(); const r = await o.evaluate(() => (window as W).__terrain.publish('no')); await sleep(1500); const st = await o.evaluate(() => (window as W).__terrain.status()); ok(r === false && why.test(st), `5. refused: ${st}`); await o.evaluate(() => (window as W).__terrain.undo()); await sleep(800) }
    await refuse('bonn', { x: 350, z: 350 }, /Bonn is in the void/); await refuse('yarrow', { x: -118, z: 110 }, /Yarrow is in the water/)
    await refuse('newborn', { x: 350, z: 350 }, /Newborn spot is in the void/)
    if (LOOP) { const s = await store(o); ok(s.v === before.v && hash(s.live) === h0.live, '5. live unchanged by the refusals') }
    if (!LOOP) { ok(!posts.includes('publish'), `6. nothing was published (${posts.join()})`); const h1 = hashes(await store(o)); ok(JSON.stringify(h1) === JSON.stringify(h0), `6. live + draft as they were ${JSON.stringify(h1)}`) }
    else {
      await o.evaluate(() => (window as W).__terrain.publish('people')); const s2 = await store(o)
      ok(s2.v === before.v + 1 && (s2.live.props ?? []).filter((p: any) => p.k.startsWith('who:')).length === 4, `6. Publish: v${s2.v} (${await o.evaluate(() => (window as W).__terrain.status())})`)
      await same(true, 'published phone'); await same(false, 'published desktop')
      console.log(`LIVE0=${h0.live}`)
    }
  }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 400)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
