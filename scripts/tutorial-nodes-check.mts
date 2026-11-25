// ── M153 s1b: TUTORIAL NODES IN THE GLADE ──
//   default = READ ONLY, for prod (owner, on the box): every POST to save-builder is answered in the page, and the keepers are served the live
//     layer with two nodes ADDED IN THE BROWSER (the GET intercepted), so the whole gather runs on the live build with nothing written;
//     live + draft hashed before and after.
//   --loop = for real (place, publish, keepers, roll back) against a THROWAWAY COPY on localhost only (never 3200..3205).
//   OWNER_KEY=.. npx tsx scripts/tutorial-nodes-check.mts [--url https://ather.games] [--out dir] [--loop --url http://localhost:3291]
import puppeteer, { type Page } from 'puppeteer-core'
import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { SCENERY } from '../src/app/shimmer/open/ather/scenery'
import { aimAt } from './lib/aim.mts'
import { fakeClock } from './lib/clock.mts'
import { collect, lootOf, sumOf } from './lib/loot.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/tutorial-nodes-check'), LOOP = process.argv.includes('--loop')
if (LOOP) { const u = new URL(url); if (u.hostname !== 'localhost' || /^32[0]\d$/.test(u.port)) { console.error('--loop publishes: a throwaway copy on localhost only'); process.exit(2) } }
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY ?? ''
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = [], posts: string[] = [], sent: any[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const AT = { x: -100, z: 120 }, TR = { x: -100, z: 116 }, CR = { x: -92, z: 120 }, H = 3_600_000   // Greg's garden
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

// ── a keeper ──
let nodes: any[] = [], skip = 0   // hours the keeper's clock is ahead
async function keeper(name: string): Promise<{ g: Page; load: () => Promise<Page> }> {
  const ctx = await br.createBrowserContext(); let g: Page | null = null
  // a NEW tab per load (same save): a tab is a clean start
  const load = async (): Promise<Page> => {
  const was = g; g = await ctx.newPage(); if (was) await was.close().catch(() => {})
  const p = g as Page; p.on('pageerror', e => errs.push(`${name}: ` + String(e).slice(0, 200)))
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    if (location.protocol === 'about:') return   // the blank page between two keepers has no storage
    if (!localStorage.getItem('chk')) { localStorage.setItem('chk', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'rinstick'] })) }
  })
  await p.evaluateOnNewDocument(fakeClock, skip * H)   // M164: every clock in the page moves, not Date.now alone
  if (!LOOP) {
    await p.setRequestInterception(true)
    p.on('request', async r => {
      if (r.method() === 'POST' && r.url().includes('save-builder')) { errs.push('a keeper posted to save-builder'); r.abort(); return }
      if (r.url().includes('/shimmer/open/glade-edits')) { const j = await (await fetch(`${url}/shimmer/open/glade-edits`)).json(); r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...j, props: [...(j.props ?? []), ...nodes] }) }) }
      else r.continue()
    })
  }
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await p.waitForFunction(() => typeof (window as W).__ather?.travel === 'function' && !!(window as W).__ather?.gather, { timeout: 240000 })
    for (let i = 0; i < 40 && !(await p.evaluate(() => (window as W).__ather?.zone?.() === 'glade')); i++) { await p.evaluate(() => (window as W).__ather.travel({ kind: 'glade' })); await sleep(4000) }
    await sleep(8000); await p.touchscreen.tap(195, 500); await sleep(1500)
  return p
  }
  return { g: await load(), load }
}
const A = <T,>(g: Page, f: string) => g.evaluate(`window.__ather.${f}`) as Promise<T>
const ls = (g: Page, k: string) => g.evaluate(q => JSON.parse(localStorage.getItem(q) ?? 'null'), k) as Promise<any>
const frame = (g: Page) => g.evaluate('new Promise(r => { let k = 3; (function t() { if (--k <= 0) r(0); else requestAnimationFrame(t) })() })')
const text = (g: Page) => g.evaluate(() => document.body.innerText)
const saw = async (g: Page, re: RegExp, n = 30) => { for (let i = 0; i < n; i++) { const m = (await text(g)).match(re); if (m) return m[0]; await frame(g); await sleep(200) } return '' }
const setMana = (g: Page, n: number) => g.evaluate(v => (window as W).__ather.setMana(v), n)
const ate = (g: Page) => g.evaluate(() => { const a = (window as W).__ather; return { t: a.aim(), c: a.crystal()?.id ?? null } }) as Promise<{ t: string | null; c: string | null }>
const tp = async (g: Page, x: number, z: number) => { await g.evaluate((a, b) => (window as W).__ather.tp(a, b, 0), x, z); await sleep(1500); await frame(g) }
const face = async (g: Page, at: { x: number; z: number }, want: 't' | 'c', h: number) => { await tp(g, at.x, at.z + 5); for (let i = 0; i < 12; i++) { await aimAt(g, at.x, at.z, h); await frame(g); const a = await ate(g); if (a[want]) return a[want]!; await sleep(500) } return '' }
const E = async (g: Page) => { await g.keyboard.press('KeyE'); await frame(g); await frame(g) }
const workOut = async (g: Page, max = 200) => { for (let i = 0; i < max && await A(g, 'chan()'); i++) { await frame(g); await sleep(60) } await frame(g) }
const shot = async (g: Page, f: string) => { await g.screenshot({ path: `${out}/${f}.png` }).catch(() => {}) }
const count = async (g: Page, id: string) => (((await ls(g, 'open.inv.v1'))?.slots ?? []) as any[]).filter(Boolean).reduce((a, s) => a + (s.id === id ? s.n : 0), 0)
const hms = (s: string) => { const m = s.match(/(\d+):(\d\d):(\d\d)/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0 }
const treeAim = (g: Page) => face(g, TR, 't', 1.2), cryAim = (g: Page) => face(g, CR, 'c', 0.6)

try {
  // ── the editor ──
  const o = await enter(), before = await store(o), h0 = hashes(before), base: any[] = before.draft.props ?? []
  console.log(`  before ${JSON.stringify(h0)}, ${base.length} props`)
  await openFly(o); await key(o, 'KeyP'); await key(o, 'KeyE')
  const inv = await o.$eval('[data-testid="place-inv"]', e => e.textContent ?? '') as string, NK = SCENERY.filter(s => s.group === 'Nodes')
  ok(NK.length === 11 && (await Promise.all(NK.map(s => o.$(`[data-testid="place-item-${s.k}"]`)))).every(Boolean) && inv.includes('Nodes') && inv.includes('gathered'), `1. the palette has a Nodes group: ${NK.map(s => s.label).join(', ')}`)
  await shot(o, 'fly-palette'); await key(o, 'KeyE'); await sleep(1500); await lock(o)
  for (let i = 0; i < 5 && (await P(o)).snap !== 1; i++) await key(o, 'KeyG')
  const place = async (k: string, at: { x: number; z: number }) => { await choose(o, k); for (let i = 0; i < 3; i++) await o.evaluate(() => document.querySelector('[data-testid="fly-frame"] canvas')!.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }))); await o.evaluate((x: number, z: number) => (window as W).__terrain.place.put(x, z), at.x, at.z); await sleep(900); return (await props(o)).at(-1) }
  let tr = await place('node:goldwood', { x: TR.x + 3, z: TR.z }); const cr = await place('node:raw', CR)
  ok(tr.k === 'node:goldwood' && cr.k === 'node:raw' && tr.s === 1 && cr.s === 1 && /^n[0-9a-z]{8}$/.test(tr.id) && tr.id !== cr.id, `2. two nodes placed, true size whatever the wheel says (${tr.id}, ${cr.id})`)
  // the scenery twin beside it: a tree without a tag
  const twin = await place('tree:grove', { x: TR.x - 7, z: TR.z - 2 }); ok(twin.k === 'tree:grove', '2. a scenery tree beside them')
  await sleep(3000); 
  await aim(o, tr.x, tr.z, 14, -0.35); ok((await P(o)).target === tr.id, '3. the crosshair finds the node')
  ok(/Goldwood node.*N grows back in 24 h/.test(await o.$eval('[data-testid="place-hud"]', e => e.textContent ?? '') as string), '3. the status line: a node, 24 h'); await shot(o, 'fly-nodes')
  await key(o, 'KeyN'); ok((await props(o)).find(p => p.id === tr.id).w === 48, '3. N: 48 h'); await o.keyboard.down('Shift'); await key(o, 'KeyN'); await o.keyboard.up('Shift')
  ok(!('w' in (await props(o)).find(p => p.id === tr.id)), '3. Shift+N: 24 h again'); await key(o, 'KeyB'); ok(!('solid' in (await props(o)).find(p => p.id === tr.id)), '3. B does nothing to a node')
  await key(o, 'KeyM'); await o.evaluate((x: number, z: number) => (window as W).__terrain.place.put(x, z), TR.x, TR.z); await sleep(900)
  let t2 = (await props(o)).find(p => p.id === tr.id); ok(t2?.x === TR.x && t2?.z === TR.z && t2.k === 'node:goldwood', '4. moved: the same id')
  await aim(o, t2.x, t2.z, 14, -0.35); await click(o, 'left'); ok(!(await props(o)).some(p => p.id === tr.id), '4. picked up'); await o.evaluate((x: number, z: number) => (window as W).__terrain.place.put(x, z), TR.x, TR.z); await sleep(900)
  t2 = (await props(o)).find(p => p.id === tr.id); ok(t2?.x === TR.x && t2?.z === TR.z, '4. put down: still the same id'); tr = t2 ?? tr
  await o.evaluate((a: any) => (window as W).__builderFly.setCam({ x: a.x + 2, y: 8, z: a.z + 14, yaw: 0, pitch: -0.3 }), AT); await sleep(2500); await shot(o, 'fly-both')
  nodes = [tr, cr].map(({ id, k, x, z, q, s }) => ({ id, k, x, z, q, s })); const TID = `glade:${tr.id}:goldwood`, CID = `glade:${cr.id}:raw`
  if (!LOOP) { await o.evaluate(() => (window as W).__terrain.save()); await sleep(1500); ok(posts.length > 0 && posts.every(a => a === 'draft') && sent.at(-1)?.layer?.props?.length === base.length + 3, `5. Save would send them (${posts}), blocked here`) }
  else { await o.waitForFunction('window.__terrain.dirty().length === 0', { timeout: 90000, polling: 1000 }); await o.evaluate(() => (window as W).__terrain.publish('tutorial-nodes-check')); const s = await store(o); ok(s.live.props?.length === base.length + 3 && s.state === 'matches live', `5. published v${s.v}`) }
  const vLive = (await store(o)).v
  if (!LOOP) await o.goto(`${url}/shimmer/open/glade-edits`)   // light, same origin: the last hash is read from here

  // ── keeper 1: out of mana halfway, leaves, reloads, finishes; the crystal in one go ──
  const k1 = await keeper('k1'); let g = k1.g
  ok(await treeAim(g) === TID, `6. k1 (390x844) in the Glade: the Goldwood node under the crosshair`)
  ok(!!(await saw(g, /Click or E · prune the Goldwood \(5 mana\)/)), '6. the Wilds\' own prompt: 5 mana'); await shot(g, 'k1-tree')
  ok(!!(await g.$('button, [data-touch]')) && /use/i.test(await text(g)), '6. the phone has its use button')
  await setMana(g, 2); const t0 = await g.evaluate(() => Date.now()); await E(g); await workOut(g)
  ok(!!(await saw(g, /Out of mana\. The Goldwood keeps what is done\./)), '7. out of mana halfway: today\'s line')
  const d1 = await A<any>(g, 'gather()'), r1 = (await ls(g, 'open.gladework.v1'))?.[`tree:${TID}`]
  ok(d1 && !d1.working && d1.p > 0.3 && d1.p < 0.6 && Math.abs(r1.until - t0 - 24 * H) < 20000, `7. the bar holds at ${(d1?.p * 100).toFixed(0)}%, the wait is 24 h from the first touch`)
  ok(/resets 23:59:\d\d|resets 24:00:00/.test(await text(g)), '7. the bar says about 24 h'); await shot(g, 'k1-dry')
  ok(!(await ls(g, 'open.gather.v1'))?.[`tree:${TID}`], '7. nothing in the garden\'s record')
  g = await k1.load(); ok(await treeAim(g) === TID, '8. left, reloaded, back')
  const d2 = await A<any>(g, 'gather()'); ok(d2 && Math.abs(d2.p - d1.p) < 0.02 && d2.resetMs < 24 * H && d2.resetMs > 23.5 * H, `8. still ${(d2?.p * 100).toFixed(0)}%, same wait`)
  ok(!!(await saw(g, /keep working the Goldwood \(\d+ mana left\)/)), '8. the prompt: keep working')
  await setMana(g, 100)
  await g.evaluate(`(() => { const w = window; w.__tn = 0; w.__tm = setInterval(() => { const t = w.__ather.tether(); if (t && t.motes.length) w.__tn++ }, 4); const raf = () => { const t = w.__ather.tether(); if (t) w.__tn++; if (w.__tm) requestAnimationFrame(raf) }; raf() })()`)   // every frame, in the page
  await E(g); await workOut(g)
  const tether = await g.evaluate(() => { const w = window as W; clearInterval(w.__tm); w.__tm = 0; return w.__tn as number })
  ok(tether > 0, '9. the tether runs from the hand'); ok(!!(await saw(g, /\+20 Forestry/)), '9. finished: +20 Forestry')
  const down = await lootOf(g); ok(down.some(d => d.item === 'goldwood_log') && (await count(g, 'goldwood_log')) === 0 && JSON.stringify(sumOf(down)) === JSON.stringify(sumOf(r1.drops.map((d: any) => ({ item: d.id, n: d.n })))), `9. the roll of the first touch lies on the ground (${JSON.stringify(sumOf(down))})`); await shot(g, 'k1-loot')
  await collect(g, () => frame(g)); const logs = await count(g, 'goldwood_log'); ok(logs >= 2 && logs <= 4, `9. picked up (${logs} logs)`)
  await treeAim(g); const w = await saw(g, /Goldwood, regrowing \([\d:]+\)\./); ok(hms(w) > 23.5 * 3600 && hms(w) <= 24 * 3600, `10. spent: "${w}"`); await shot(g, 'k1-spent')
  await E(g); ok(await A(g, 'chan()') === null && (await ls(g, 'open.gladespent.v1'))?.[TID] === r1.until, '10. E on it starts nothing')
  ok(await cryAim(g) === CID, '11. the crystal node'); ok(!!(await saw(g, /prospect the Raw Mana \(7 mana\)/)), '11. 7 mana'); await shot(g, 'k1-crystal')
  await setMana(g, 100); const m0 = await A<number>(g, 'mana()'); await E(g); await workOut(g); const m1 = await A<number>(g, 'mana()')
  ok(!!(await saw(g, /\+20 Prospecting/)) && m0 - m1 > 5 && m0 - m1 <= 7.01, `11. gathered: +20 Prospecting, ${(m0 - m1).toFixed(1)} mana`)
  ok((await lootOf(g)).some(d => d.item === 'raw_mana_shard') && (await lootOf(g)).some(d => d.item === 'blankstone'), '11. shards + blankstone on the ground'); ok((await lootOf(g)).filter(d => d.item === 'dewl').reduce((a, d) => a + d.n, 0) === 1, '11b. M159: one dewl beside them'); await shot(g, 'k1-crystal-loot'); await collect(g, () => frame(g))
  ok((await count(g, 'raw_mana_shard')) >= 1, '11. picked up'); await cryAim(g); const w2 = await saw(g, /Raw Mana, growing back \([\d:]+\)\./); ok(hms(w2) > 23.5 * 3600, `11. "${w2}"`); await shot(g, 'k1-crystal-spent')

  // ── keeper 2: a fresh copy ── (one scene at a time: the box renders in software)
  await g.goto('about:blank')
  { const k2 = await keeper('k2'), b = k2.g; ok(await treeAim(b) === TID && !!(await saw(b, /prune the Goldwood \(5 mana\)/)), '12. k2: their copy is whole'); ok(await cryAim(b) === CID && !!(await saw(b, /prospect the Raw Mana \(7 mana\)/)), '12. ...the crystal too')
    await E(b); await workOut(b); ok(!!(await ls(b, 'open.gladespent.v1'))?.[CID] && (await lootOf(b)).length > 0, '12. they gather it'); await b.close() }

  // ── the clock ──
  skip = 23.5; g = await k1.load(); await treeAim(g); ok(!!(await saw(g, /Goldwood, regrowing \(\d+:\d\d\)\./)), '13. 23.5 hours on: still spent')
  skip = 24.5; g = await k1.load(); await treeAim(g); ok(!!(await saw(g, /prune the Goldwood \(5 mana\)/)), '13. 24.5 hours on: whole again'); await shot(g, 'k1-regrown')
  await setMana(g, 3); await E(g); await shot(g, 'k1-working'); await workOut(g); ok(!!(await ls(g, 'open.gladework.v1'))?.[`tree:${TID}`], '13. worked again, left halfway')

  // ── rolled back ──
  if (LOOP) { const rolled = await o.evaluate((v: number) => (window as W).__terrain.rollback(v), vLive - 1); const s3 = await store(o); ok(rolled && hash(s3.live) === hash(before.live), '14. rolled back: live byte-identical to before') }
  nodes = []; g = await k1.load(); await tp(g, TR.x, TR.z + 5); for (let i = 0; i < 4; i++) { await aimAt(g, TR.x, TR.z, 1.2); await frame(g) }
  const none = await ate(g); ok(!none.t && !none.c && (await A(g, 'gather()')) === null && await A(g, 'zone()') === 'glade', '14. k1, who gathered them, half done on one: nothing there, the game runs'); await shot(g, 'k1-rolled-back')
  if (!LOOP) { const h1 = hashes(await store(o)); console.log(`  after  ${JSON.stringify(h1)}`); ok(JSON.stringify(h0) === JSON.stringify(h1), '15. live, draft, version list and the draft file\'s time are untouched') }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 400)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
