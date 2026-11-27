// ── BETA M85 s1: SCENERY MODE ON THE WILDS (World Builder, owner, desktop) ──
// READ ONLY against prod (ather.games is Alex's live save): every POST to save-builder is answered IN THE PAGE from a mock store (draft
// = what the editor saved, live = the draft at Publish), and a reload reads that mock draft back. So:
//   owner (1280x900): Fly on the Wilds, P opens Scenery mode, the palette is the Wilds' (no nodes / rooms / lilies), place 3 kinds
//     (outcrop rock, fence, sign), MOVE + TURN + SCALE the rock (M, R, wheel past 2), Save, RELOAD: the draft brings all 3 back, Publish.
//   keeper (fresh, no owner key, 390x844): the SCRATCH world = the real live Wilds layer + the published pieces, served to that one tab
//     only; the game draws all 3 on the ground and a walk at the rock STOPS at its face.
//   the real store (draft + live + versions) is hashed before and after: unchanged.
//   OWNER_KEY=... npx tsx scripts/m85-scenery-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { paletteOf } from '../src/app/shimmer/open/ather/scenery'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m85-scenery-check')
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
const ROCK0 = { x: B.x + 4, z: B.z - 6 }, ROCK = { x: B.x + 4, z: B.z + 3 }, FENCE = { x: B.x + 14, z: B.z + 3 }, SIGN = { x: B.x - 6, z: B.z + 3 }
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
try {
  const owner = await br.createBrowserContext(), o = await owner.newPage()
  o.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
  await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  real = await store(o); const h0 = hashes(real), base: any[] = real.draft.props ?? []
  console.log(`  real store before ${JSON.stringify(h0)}, draft props ${base.length}, live props ${(real.live.props ?? []).length}`)
  await o.setRequestInterception(true); intercept(o)
  await openFly(o)
  ok(Number.isFinite(await o.evaluate((a: number, b: number) => (window as W).__terrain.heightAt(a, b), ROCK.x, ROCK.z)), `the Wilds draft has ground at the test spot (${ROCK.x}, ${ROCK.z})`)
  ok(!!(await o.$('[data-testid="place-toggle"]')) && (await o.$eval('[data-testid="place-toggle"]', e => e.textContent)) === 'Scenery (P)', '1. Fly on the Wilds shows a Scenery (P) button')
  await key(o, 'KeyP'); ok((await T(o)).place.on && !!(await o.$('[data-testid="place-hud"]')), '1. P opens Scenery mode (hotbar + status line)')
  await key(o, 'KeyE')
  const items = await o.$$eval('[data-testid^="place-item-"]', a => a.map(e => (e as HTMLElement).dataset.testid!.slice(11)))
  const want = paletteOf('wilds').map(s => s.k)
  ok(items.length === want.length && !items.some(k => k.startsWith('node:') || k.startsWith('room:') || k === 'filler:lily-pads'), `1. the inventory is the Wilds kit (${items.length} kinds; no nodes, rooms, lilies)`)
  await o.screenshot({ path: `${out}/a-palette.png` }).catch(() => {})
  await key(o, 'KeyE'); await sleep(1000); await lock(o)
  // place: the rock (at its first spot), the fence, the sign; snap 0.5 m
  await choose(o, 'filler:rock-large'); await o.evaluate((p: any) => (window as W).__terrain.place.put(p.x, p.z), ROCK0); await sleep(600)
  await choose(o, 'filler:fence'); await o.evaluate((p: any) => (window as W).__terrain.place.put(p.x, p.z), FENCE); await sleep(600)
  await choose(o, 'filler:sign'); await o.evaluate((p: any) => (window as W).__terrain.place.put(p.x, p.z), SIGN); await sleep(600)
  let ps = (await T(o)).props.filter(p => !base.some(b => b.id === p.id))
  ok(ps.length === 3 && ['filler:rock-large', 'filler:fence', 'filler:sign'].every(k => ps.some(p => p.k === k)), `2. three pieces of three kinds placed (${ps.map(p => `${p.k}@${p.x},${p.z}`).join(' ')})`)
  const rock = ps.find(p => p.k === 'filler:rock-large')
  // move + turn + scale the rock: aim at it, M picks it up, R turns, the wheel grows it past 2, put it down at ROCK
  await aim(o, ROCK0.x, ROCK0.z); let tgt = null; for (let i = 0; i < 16 && tgt !== rock?.id; i++) { tgt = (await T(o)).place.target; if (tgt !== rock?.id) await sleep(500) }   // the target lands a frame after the aim (~1 fps on swiftshader)
  ok(tgt === rock?.id, `3. the crosshair finds the rock (${tgt})`)
  await key(o, 'KeyM'); ok((await T(o)).place.moving === rock?.id, '3. M picks it up to move')
  await key(o, 'KeyR'); for (let i = 0; i < 24; i++) { await wheel(o, -100); await sleep(60) }
  await sleep(600); await o.screenshot({ path: `${out}/b-moving-rock.png` }).catch(() => {})
  await o.evaluate((p: any) => (window as W).__terrain.place.put(p.x, p.z), ROCK); await sleep(800)
  const r2 = (await T(o)).props.find(p => p.id === rock?.id)
  ok(!!r2 && Math.abs(r2.x - ROCK.x) < 0.51 && Math.abs(r2.z - ROCK.z) < 0.51 && r2.q > 0 && r2.s > 2, `3. moved, turned, scaled past 2 (${JSON.stringify(r2)})`)
  const drawn = await o.evaluate(() => (window as W).__scenery?.()) as { items: any[]; meshes: number }
  ok(!!drawn && drawn.items.filter(i => ps.some(p => p.id === i.id)).length === 3 && drawn.meshes > 0, `3. the editor draws all 3 on the draft ground (${drawn?.meshes} meshes)`)
  await aim(o, ROCK.x, ROCK.z + 6); await o.screenshot({ path: `${out}/c-editor-placed.png` }).catch(() => {})
  // save, reload: the draft brings them back
  await o.evaluate(() => (window as W).__terrain.save()); await sleep(1500)
  ok(posts.includes('draft') && (mockDraft?.props ?? []).length === base.length + 3, `4. Save sends the draft with the pieces (${(mockDraft?.props ?? []).length})`)
  await openFly(o)
  const back = (await T(o)).props.filter(p => !base.some(b => b.id === p.id))
  ok(back.length === 3 && JSON.stringify(back.find(p => p.id === rock?.id)) === JSON.stringify(r2), `4. RELOAD: the draft keeps all 3, the rock as moved (${back.map(p => `${p.k} s${p.s}`).join(', ')})`)
  // publish (mock store: live = the draft)
  await o.evaluate(() => (window as W).__terrain.publish('m85-scenery-check')); await sleep(1500)
  ok(posts.includes('publish') && (mockLive?.props ?? []).length === base.length + 3, `5. Publish carries the pieces (${(mockLive?.props ?? []).length}) to the scratch live layer`)
  const after = await store(o); const h1 = hashes(after)
  ok(JSON.stringify(h0) === JSON.stringify(h1), `5. the REAL store is untouched (${JSON.stringify(h1)})`)
  await owner.close()

  // the keeper: a fresh one, in the scratch world (real live layer + the published pieces, this tab only)
  const liveTxt = await (await fetch(`${url}/shimmer/open/wilds-edits`, { cache: 'no-store' } as any)).text()
  const scratch = JSON.stringify({ ...JSON.parse(liveTxt), props: mockLive.props })
  const ctx = await br.createBrowserContext(), kp = await ctx.newPage(); await kp.setViewport({ width: 390, height: 844 })
  kp.on('pageerror', e => errs.push('keeper: ' + String(e).slice(0, 200)))
  await kp.setRequestInterception(true)
  kp.on('request', r => { if (r.method() === 'GET' && r.url().includes('/shimmer/open/wilds-edits')) r.respond({ status: 200, contentType: 'application/json', body: scratch }); else r.continue() })
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
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
  ok(mine.length === 3 && mine.every((i: any) => Number.isFinite(i.y)), `6. the game draws all 3 on the ground (${mine.map((i: any) => `${i.k}@${i.x},${i.z} y${i.y.toFixed(2)} s${i.s}`).join(' ')})`)
  const rb = (sc?.boxes ?? []).filter((b: any) => ROCK.x >= b.x0 && ROCK.x <= b.x1 && ROCK.z >= b.z0 && ROCK.z <= b.z1)
  ok(rb.length > 0, `6. the rock registers a collision box (${rb.map((b: any) => `${(b.x1 - b.x0).toFixed(1)}x${(b.z1 - b.z0).toFixed(1)}`).join(' ')})`)
  const face = Math.max(...rb.map((b: any) => b.z1))
  const pos = async () => { const s = await A('state') as { px: number; pz: number }; return { x: s.px, z: s.pz } }
  await A('tp', ROCK.x, face + 4, 0); await sleep(1500); await A('look', 0, -0.05); await sleep(1500)
  await kp.screenshot({ path: `${out}/d-keeper-sees.png` })
  const z0 = (await pos()).z
  await kp.keyboard.down('KeyW')
  for (let t = 0; t < 40; t++) { await sleep(500); if ((await pos()).z < ROCK.z) break }
  await kp.keyboard.up('KeyW'); await sleep(500)
  const zE = (await pos()).z
  ok(z0 - zE >= 1 && zE > face - 0.05, `7. the walk moved (${z0.toFixed(2)} -> ${zE.toFixed(2)}) and STOPPED at the rock's face (z ${face.toFixed(2)})`)
  await kp.screenshot({ path: `${out}/e-keeper-blocked.png` })
  await ctx.close()
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `\n${fails} FAILED` : '\nPASS'); process.exit(fails ? 1 : 0)
