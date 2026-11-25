// ── M153 s1a: PLACE MODE (Fly, the Glade) ──
//   default = READ ONLY, for prod (owner, on the box): every POST to save-builder is intercepted in the page and answered from the page's
//     own layer, so the tool opens, places, undoes and saves with NOTHING written; the live layer + the draft are hashed before and after.
//   --loop = the whole loop for real (place, autosave, publish, a fresh keeper sees + bumps it, roll back) against a THROWAWAY COPY only:
//     it refuses anything that is not localhost, and the shared tree's own ports (3200, 3201..3205).
//   OWNER_KEY=.. npx tsx scripts/place-mode-check.mts [--url https://ather.games] [--out dir] [--loop --url http://localhost:3291]
import puppeteer, { type Page } from 'puppeteer-core'
import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { SCENERY_BY } from '../src/app/shimmer/open/ather/scenery'
import { parseGladeLayer, gladeLayerGround } from '../src/app/shimmer/open/ather/glade-layer'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/place-mode-check'), LOOP = process.argv.includes('--loop')
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
try {
  const o = await enter()
  const before = await store(o), h0 = hashes(before), base: any[] = before.draft.props ?? []
  console.log(`  before ${JSON.stringify(h0)}, ${base.length} props`)
  await openFly(o)
  const fx = await o.evaluate(() => (window as W).__builderFly.fixed()) as { folk: string[]; meshes: number }
  ok(['greg', 'otto', 'tess', 'bonn'].every(f => fx.folk.includes(f)) && fx.folk.length >= 9 && fx.meshes > 25, `1. Fly draws today's people, houses, stations and gate as ghosts (${fx.folk.length} people, ${fx.meshes} meshes)`)
  const sc = await o.evaluate(() => (window as W).__builderFly.scene()); ok(sc.tiles === 1 && sc.sea === 0 && !sc.other.length, `1. the terrain is what it was (${JSON.stringify(sc)})`)
  await key(o, 'KeyP'); ok((await P(o)).on && !!(await o.$('[data-testid="place-hud"]')), '2. P opens Place: hotbar + status line')
  await o.evaluate(() => { (window as W).__t = (window as W).__builderFly.cam().top }); await key(o, 'KeyT')
  ok((await P(o)).turn === 15 && !(await o.evaluate(() => (window as W).__builderFly.cam().top)), '2. T steps the turn (45 -> 15), the view stays')
  await key(o, 'KeyG'); ok((await P(o)).snap === 0.25, '2. G steps the snap (0.5 -> 0.25)'); await key(o, 'KeyG'); await key(o, 'KeyG')
  ok((await P(o)).snap === 1, '2. ...free, then 1 m')
  await key(o, 'KeyE'); ok(!!(await o.$('[data-testid="place-inv"]')), '2. E opens the inventory')
  const n = await o.$$eval('[data-testid^="place-item-"]', a => a.length); ok(n === SCENERY_BY.size, `2. it lists the whole palette (${n})`)
  await o.screenshot({ path: `${out}/fly-palette.png` }).catch(() => {})
  await key(o, 'KeyE'); await sleep(1500); await lock(o)
  ok(await o.evaluate(() => (window as W).__builderFly.locked()), '3. a click locks the mouse in Place mode')
  ok((await props(o)).length === base.length, '3. that click placed nothing')
  // a tree
  await choose(o, 'tree:grove'); await aim(o, AT.x, AT.z); await key(o, 'KeyR')
  for (let i = 0; i < 4; i++) await o.evaluate(() => document.querySelector('[data-testid="fly-frame"] canvas')!.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })))
  await sleep(600); await o.screenshot({ path: `${out}/fly-hand.png` }).catch(() => {})
  const c0 = await o.evaluate(() => (window as W).__builderFly.centre()) as { x: number; z: number }
  await click(o, 'right')
  const t = (await props(o)).find(p => !base.some((b: any) => b.id === p.id))
  ok(!!t && t.k === 'tree:grove' && Math.abs(t.x - c0.x) <= 0.51 && Math.abs(t.z - c0.z) <= 0.51 && Number.isInteger(t.x) && Number.isInteger(t.z), `3. right places the tree at the crosshair, on the 1 m snap (${JSON.stringify(t)})`)
  ok(t?.s === 1.2 && Math.abs(t.q * 90 - 15) < 0.1, '3. ...with the wheel size and the turn')
  await sleep(3000); const dr = await o.evaluate(() => (window as W).__scenery()) as { meshes: number; drawn: number; items: any[] }
  const tY = dr.items.find(i => i.id === t?.id)?.y
  ok(dr.meshes >= 2 && dr.items.length === base.length + 1 && Math.abs(tY - (await o.evaluate((x: number, z: number) => (window as W).__builderFly.drawnAt(x, z), t.x, t.z) as number)) < 0.03, `3. drawn, standing on the drawn ground (${tY?.toFixed(2)})`)
  // the target, move, toggle
  await aim(o, t.x, t.z, 10, -0.5); ok((await P(o)).target === t.id, '4. the crosshair finds it')
  await key(o, 'KeyB'); ok((await props(o)).find(p => p.id === t.id).solid === false, '4. B: walk through'); await key(o, 'KeyB'); ok((await props(o)).find(p => p.id === t.id).solid === true, '4. B: blocks')
  await key(o, 'KeyM'); ok((await P(o)).moving === t.id, '4. M takes it for a move'); await aim(o, AT.x + 6, AT.z); await click(o, 'right')
  const m = (await props(o)).find(p => p.id === t.id); ok(m && Math.abs(m.x - t.x - 6) < 1.6 && m.s === 1.2 && m.q === t.q && (await P(o)).moving === null, `4. right puts it down there, same size + turn (${m?.x}, ${m?.z})`)
  // a chest, pick up, undo, delete
  await choose(o, 'prop:chest'); await aim(o, AT.x - 4, AT.z); await click(o, 'right'); const ch = (await props(o)).at(-1)
  ok(ch.k === 'prop:chest', '5. a chest beside it'); await sleep(2500)
  await aim(o, ch.x, ch.z, 14, -0.5); ok((await P(o)).target === ch.id, '5. the crosshair finds the chest')
  await click(o, 'left'); ok(!(await props(o)).some(p => p.id === ch.id) && (await P(o)).hand?.k === 'prop:chest', '5. left picks it up, into the hand')
  await o.keyboard.down('Control'); await o.keyboard.press('KeyZ'); await o.keyboard.up('Control'); await sleep(800)
  ok((await props(o)).some(p => p.id === ch.id), '5. Ctrl+Z puts it back')
  await aim(o, ch.x, ch.z, 14, -0.5); await key(o, 'KeyX'); ok(!(await props(o)).some(p => p.id === ch.id), '5. X deletes it')
  await o.keyboard.down('Control'); await o.keyboard.press('KeyZ'); await o.keyboard.up('Control'); await sleep(800)
  // a terrain edit lifts it, and shares the undo
  const y0 = (await o.evaluate(() => (window as W).__scenery()) as any).items.find((i: any) => i.id === m.id).y
  await o.evaluate((x: number, z: number) => { const T = (window as W).__terrain, c = T.origin(); T.stroke('raise', x - c.x, z - c.z, 10, 0.5, 6) }, m.x, m.z); await sleep(1500)
  const y1 = (await o.evaluate(() => (window as W).__scenery()) as any).items.find((i: any) => i.id === m.id).y
  ok(y1 > y0 + 0.5, `6. a terrain edit lifts it (${y0.toFixed(2)} -> ${y1.toFixed(2)})`)
  await o.evaluate(() => (window as W).__terrain.undo()); await sleep(1200)
  ok(Math.abs((await o.evaluate(() => (window as W).__scenery()) as any).items.find((i: any) => i.id === m.id).y - y0) < 1e-6 && (await props(o)).length === base.length + 2, '6. one undo history: the stroke goes first, the pieces stay')
  if (LOOP) {
    // a scene for Alex, through the tool
    const scene: [string, number, number][] = [['tree:pale', -8, -6], ['tree:shimmer', 10, -8], ['bush:sunfruit-bush', 2, -3], ['bush:moonberry-bush', 4, 0], ['bush:bloom-bush', -2, 3], ['crystal:violet', 7, 5], ['crystal:ather', -6, 6], ['prop:crafting_table', -10, 2], ['prop:exchange_booth', 12, 1], ['piece:goldwood_bench', 0, 6], ['piece:iron_lantern', 3, 6]]
    for (const [k, dx, dz] of scene) { await choose(o, k); await o.evaluate((x: number, z: number) => (window as W).__terrain.place.put(x, z), AT.x + dx, AT.z + dz); await sleep(700) }
    await sleep(6000); await o.evaluate((a: any) => (window as W).__builderFly.setCam({ x: a.x, y: 13, z: a.z + 24, yaw: 0, pitch: -0.38 }), AT); await sleep(2500)
    await o.screenshot({ path: `${out}/fly-scene.png` }).catch(() => {})
    await o.evaluate(() => document.exitPointerLock()); await sleep(800); await o.click('[data-testid="fly-full"]'); await sleep(3000); await o.screenshot({ path: `${out}/fly-scene-full.png` }).catch(() => {}); await key(o, 'KeyE'); await o.screenshot({ path: `${out}/fly-palette-full.png` }).catch(() => {}); await key(o, 'KeyE'); await key(o, 'Escape')
  }
  const want = await props(o)
  // save: the layer a save sends
  if (!LOOP) {
    await o.evaluate(() => (window as W).__terrain.save()); await sleep(1500)
    const L = sent.at(-1)?.layer; ok(posts.join() === 'draft' && L?.props?.length === base.length + 2, `7. Save sends the pieces in the draft (${posts}), blocked here`)
    const { props: _p, ...rest } = L ?? {}, { props: _q, ...rest0 } = before.draft; ok(hash(rest) === hash(rest0) || JSON.stringify(Object.keys(rest).sort()) === JSON.stringify(Object.keys(rest0).sort()), '7. the rest of the layer keeps its keys')
    ok(hash(rest.tiles) === hash(rest0.tiles), '7. the sculpted ground it would send is the draft\'s, byte for byte')
    await o.evaluate(() => (window as W).__terrain.save())
    await o.setRequestInterception(true).catch(() => {})
    const h1 = hashes(await store(o)); console.log(`  after  ${JSON.stringify(h1)}`)
    ok(JSON.stringify(h0) === JSON.stringify(h1), '8. live, draft, version list and the draft file\'s time are untouched')
  } else {
    console.log('  waiting for the autosave (60 s)…')
    await o.waitForFunction('window.__terrain.dirty().length === 0', { timeout: 90000, polling: 1000 })
    const s1 = await store(o); ok(s1.draft.props?.length === want.length && !s1.live.props && s1.state === 'unpublished changes', `7. autosave wrote the draft (${s1.draft.props?.length}), live has none`)
    const game = async () => {
      const g = await (await br.createBrowserContext()).newPage(); g.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
      await g.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await g.evaluateOnNewDocument('window.__name = (f) => f')
      await g.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
      await g.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
      await g.waitForFunction(() => typeof (window as W).__ather?.travel === 'function', { timeout: 240000 })
      for (let i = 0; i < 40 && !(await g.evaluate(() => (window as W).__ather?.zone?.() === 'glade')); i++) { await g.evaluate(() => (window as W).__ather.travel({ kind: 'glade' })); await sleep(4000) }
      await sleep(8000); await g.touchscreen.tap(195, 500); await sleep(1000); return g
    }
    const drawnIn = (g: Page) => g.evaluate(() => (window as W).__scenery?.() ?? { items: [], meshes: 0, drawn: 0 }) as Promise<any>
    /** walk north (W) into the trunk from 2.5 m south; where the feet stop */
    const bump = async (g: Page) => { await g.evaluate((x: number, z: number) => (window as W).__ather.tp(x, z, 0), m.x, m.z + 2.5); await sleep(2500); await g.keyboard.down('KeyW'); let lz = 1e9, same = 0
      for (let i = 0; i < 40 && same < 6; i++) { await sleep(1500); const z = await g.evaluate(() => (window as W).__ather.state().pz) as number; same = Math.abs(z - lz) < 0.02 ? same + 1 : 0; lz = z; if (z < m.z - 1) break }
      await g.keyboard.up('KeyW'); await sleep(500); return g.evaluate(() => { const s = (window as W).__ather.state(); return { x: s.px, z: s.pz, y: s.py } }) as Promise<{ x: number; z: number; y: number }> }
    let g = await game(); ok((await drawnIn(g)).items.length === 0, '8. a fresh keeper sees nothing of the draft')
    const w0 = await bump(g); ok(w0.z < m.z - 0.5, `8. ...and walks through the spot (to z ${w0.z.toFixed(1)}, the tree is drafted at ${m.z})`); await g.close()
    await o.evaluate(() => (window as W).__terrain.publish('place-mode-check')); const s2 = await store(o)
    ok(s2.live.props?.length === want.length && s2.state === 'matches live' && s2.v > 0, `9. Publish: v${s2.v}, ${s2.live.props?.length} pieces live`)
    g = await game(); const gd = await drawnIn(g), G = gladeLayerGround(parseGladeLayer(s2.live).edits)
    const gt = gd.items.find((i: any) => i.id === m.id); ok(gd.drawn >= want.length && gd.items.length === want.length && Math.abs(gt.y - G(m.x, m.z)) < 1e-6, `9. a fresh keeper (390x844) sees them all, on the ground (${gd.items.length} pieces, ${gd.meshes} draw calls)`)
    const w1 = await bump(g), K = SCENERY_BY.get('tree:grove')!, half = K.box!.w * m.s / 2
    ok(w1.z > m.z + half - 0.05 && w1.z < m.z + half + 0.8 && Math.abs(w1.x - m.x) < 1, `9. ...and bumps the trunk (stops at z ${w1.z.toFixed(2)}, its face is ${(m.z + half).toFixed(2)})`)
    await g.evaluate((a: any) => (window as W).__ather.tp(a.x, a.z + 15, 0), AT); await sleep(4000); await g.evaluate(() => { const e = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play/.test(d.textContent ?? '') && d.clientHeight < 400).at(0); if (e) e.style.display = 'none' }); await g.screenshot({ path: `${out}/game-phone.png` }).catch(() => {})
    await g.setViewport({ width: 1280, height: 800 }); await sleep(5000); await g.evaluate(() => { for (const e of document.querySelectorAll('div')) if (/Click to play/.test(e.textContent ?? '') && e.clientHeight < 400) (e as HTMLElement).style.display = 'none' }); await g.screenshot({ path: `${out}/game-desktop.png` }).catch(() => {}); await g.close()
    const back = s2.v - 1, rolled = await o.evaluate((v: number) => (window as W).__terrain.rollback(v), back); const s3 = await store(o)
    ok(rolled && !s3.live.props && !s3.draft.props && hash(s3.live) === hash(before.live), `10. roll back to v${back}: live is byte-identical to before, the draft too has none`)
    g = await game(); ok((await drawnIn(g)).items.length === 0, '10. the keeper sees none'); const w2 = await bump(g); ok(w2.z < m.z - 0.5, '10. ...and walks through again'); await g.close()
  }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 400)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
