// ── BETA M87 (World Builder p5): WALK TEST + COST METER on the Wilds (owner, desktop 1280x900) ── (built on m85-stamp-check.mts)
// READ ONLY against prod (ather.games is Alex's live save): every POST to save-builder is answered IN THE PAGE from a mock store, so
// nothing reaches Alex's draft or live world; the real store (draft + live + versions) is hashed before and after: unchanged.
//   1. the meter reads draws / tris / frame against the desktop budget, toggles to phone and back
//   2. scatter painted in a fixed view: the meter's numbers go up
//   3. a big rock placed in the DRAFT; H at a spot 8 m in front of it = on foot there; W walks into the rock and stops at its face;
//      walking writes nothing to the draft; H = back to Fly over where the keeper stands
//   OWNER_KEY=... npx tsx scripts/m87-walk-meter-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m87-walk-meter-check')
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
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }).tiles
const g = tiles.find(t => t.name === 'first-wilds')!
const B = { x: g.tx * 1000 - 300 + 10, z: g.ty * 1000 + 300 - 8 }
const VIEW = { x: B.x - 20, z: B.z - 30 }, SPOTS = [{ x: B.x - 22, z: B.z - 32 }, { x: B.x - 16, z: B.z - 30 }, { x: B.x - 26, z: B.z - 28 }], R = { x: B.x + 20, z: B.z }
let mockDraft: any = null, mockLive: any = null, real: any = null
const store = (o: Page) => o.evaluate(async () => (await fetch('/shimmer/save-builder?map=wilds', { cache: 'no-store', headers: { 'x-m85-real': '1' } })).json()) as Promise<any>
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
const lock = async (o: Page) => { const b = (await (await o.$('[data-testid="fly-frame"]'))!.boundingBox())!; for (let i = 0; i < 4 && !(await o.evaluate(() => (window as W).__builderFly.locked())); i++) { await o.mouse.click(b.x + b.width / 2, b.y + 30); await sleep(1500) } }
const unlock = async (o: Page) => { if (await o.evaluate(() => (window as W).__builderFly.locked())) { await o.keyboard.press('Escape'); await sleep(900) } }
const choose = async (o: Page, k: string) => { await key(o, 'KeyE'); await o.click(`[data-testid="place-item-${k}"]`); await sleep(400); await key(o, 'KeyE'); await sleep(1200); await lock(o) }
const aim = async (o: Page, x: number, z: number) => { await o.evaluate((a: number, b: number) => { const t = (window as W).__terrain, h = t.heightAt(a, b); (window as W).__builderFly.setCam({ x: a, z: b + 10, y: (Number.isFinite(h) ? h : 5) + 7, yaw: 0, pitch: -0.6, top: false }) }, x, z); await sleep(1500) }
const meter = async (o: Page) => { await sleep(2500); return o.evaluate(() => { const m = (window as W).__costMeter, el = document.querySelector('[data-testid="cost-meter"]'); return { ...m, level: el?.getAttribute('data-level'), text: (el as HTMLElement | null)?.innerText.replace(/\n/g, ' | ') ?? '' } }) as Promise<{ calls: number; tris: number; ms: number; level: string; text: string }> }
const WT = (o: Page, f: string) => o.evaluate((n: string) => { const w = (window as W).__walkTest; return typeof w?.[n] === 'function' ? w[n]() : null }, f) as Promise<any>
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
  o.on('console', m => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)) })
  await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
  await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  real = await store(o); const h0 = hashes(real), base: any[] = real.draft.props ?? []
  console.log(`  real store before ${JSON.stringify(h0)}, draft props ${base.length}`)
  await o.setRequestInterception(true); intercept(o)
  await openFly(o)

  // ── 1. the meter
  ok(!!(await o.$('[data-testid="cost-meter"]')) && typeof (await WT(o, 'walking')) === 'boolean', '1. the Fly view has the cost meter + the walk test')
  await aim(o, VIEW.x, VIEW.z)
  const m0 = await meter(o)
  ok(m0.calls > 0 && m0.tris > 0 && m0.ms > 0 && ['green', 'amber', 'red'].includes(m0.level), `1. meter reads: ${m0.calls} draws, ${m0.tris} tris, ${m0.ms?.toFixed(1)} ms, ${m0.level} | "${m0.text}"`)
  ok(/desktop/.test(m0.text) && /\/ 600 /.test(m0.text) && /1\.50M/.test(m0.text), '1. against the desktop budget (600 draws / 1.50M tris / 16.7 ms)')
  await o.click('[data-testid="meter-budget"]'); await sleep(600)
  const ph = await o.$eval('[data-testid="cost-meter"]', e => (e as HTMLElement).innerText)
  ok(/phone/.test(ph) && /\/ 150 /.test(ph), `1. the budget toggles to phone (150 draws) | "${ph.replace(/\n/g, ' | ')}"`)
  await o.click('[data-testid="meter-budget"]'); await sleep(600)
  ok(/desktop/.test(await o.$eval('[data-testid="cost-meter"]', e => (e as HTMLElement).innerText)), '1. ... and back to desktop')
  await o.screenshot({ path: `${out}/a-meter-before-scatter.png` }).catch(() => {})

  // ── 2. scatter in the same view: the numbers move
  await key(o, 'KeyP'); await key(o, 'KeyK'); await lock(o)
  ok((await T(o)).place.scat === true, '2. P + K: the scatter brush')
  const n0 = (await T(o)).props.length
  for (const s of SPOTS) { await aim(o, s.x, s.z); await lock(o); await o.mouse.down({ button: 'right' }); await sleep(400); await o.mouse.up({ button: 'right' }); await sleep(900) }
  const n1 = (await T(o)).props.length
  ok(n1 - n0 > 30, `2. three dabs painted ${n1 - n0} scattered pieces`)
  await key(o, 'KeyK'); await unlock(o); await key(o, 'KeyP')
  await aim(o, VIEW.x, VIEW.z)
  const m1 = await meter(o)
  ok(m1.tris > m0.tris && m1.calls >= m0.calls, `2. same view, the meter moved: draws ${m0.calls} -> ${m1.calls}, tris ${m0.tris} -> ${m1.tris} (${m1.level}) | "${m1.text}"`)
  await o.screenshot({ path: `${out}/b-meter-after-scatter.png` }).catch(() => {})

  // ── 3. a big rock in the draft, then walk into it
  await key(o, 'KeyP'); await choose(o, 'filler:rock-large')
  await aim(o, R.x, R.z); await lock(o)
  const pb = (await T(o)).props; await o.mouse.down({ button: 'right' }); await sleep(300); await o.mouse.up({ button: 'right' }); await sleep(900)
  const rock = (await T(o)).props.find(p => !pb.some(b => b.id === p.id) && p.k === 'filler:rock-large')
  ok(!!rock, `3. a big rock placed in the draft at (${rock?.x?.toFixed(1)}, ${rock?.z?.toFixed(1)})`)
  await unlock(o); await key(o, 'KeyP')   // (not X: X deletes the piece under the crosshair)
  ok(!(await T(o)).place.on && (await T(o)).props.some(p => p.id === rock?.id), '3. Scenery mode closed (back to plain Fly), the rock still in the draft')
  const boxes: any[] = (await WT(o, 'boxes')) ?? []
  const box = boxes.find(b => rock && b.x0 <= rock.x && rock.x < b.x1 && b.z0 <= rock.z && rock.z < b.z1)
  ok(!!box, `3. the walker sees the rock as a solid box ${box ? `z ${box.z0.toFixed(2)}..${box.z1.toFixed(2)}, top ${box.y1.toFixed(2)}` : ''} (${boxes.length} boxes in the draft)`)
  const draft0 = JSON.stringify((await T(o)).props)
  await aim(o, rock.x, rock.z + 8)
  const c = await o.evaluate(() => (window as W).__builderFly.centre())
  await key(o, 'KeyH')
  const b0 = await WT(o, 'body')
  ok(!!(await WT(o, 'walking')) && !!b0 && !!c && Math.hypot(b0.x - c.x, b0.z - c.z) < 0.5, `3. H: on foot at the crosshair spot (${b0?.x?.toFixed(1)}, ${b0?.z?.toFixed(1)}) vs crosshair (${c?.x?.toFixed(1)}, ${c?.z?.toFixed(1)})`)
  ok(/on foot/.test(await o.$eval('[data-testid="walk-hint"]', e => (e as HTMLElement).innerText)), '3. the meter\'s hint says on foot')
  await sleep(1200); await o.screenshot({ path: `${out}/c-on-foot-facing-rock.png` }).catch(() => {})
  const face = box ? box.z1 + 0.3 : NaN
  await o.keyboard.down('KeyW')
  let stop: any = null, through = false
  const t0 = Date.now()
  while (Date.now() - t0 < 40000) {
    const b = await WT(o, 'body'); if (!b) break
    if (box && b.z < box.z1 - 0.3 && b.y < box.y1 - 0.3) through = true
    if (Math.abs(b.z - face) < 0.08) { stop = b; break }
    await sleep(40)
  }
  await o.keyboard.up('KeyW'); await sleep(1500)
  const held = await WT(o, 'body')
  ok(!!stop && !through, `3. W walks into the rock and STOPS at its face (z ${stop?.z?.toFixed(2)} vs face + body ${face.toFixed(2)}; walked ${(b0.z - (stop?.z ?? b0.z)).toFixed(1)} m)`)
  const inside = (b: any) => !!box && b.x > box.x0 + 0.1 && b.x < box.x1 - 0.1 && b.z > box.z0 + 0.1 && b.z < box.z1 - 0.1 && b.y < box.y1 - 0.3
  const atFace = !!held && Math.abs(held.z - face) < 0.15 && held.y < box.y1 - 0.3, onTop = !!held && held.y >= box.y1 - 0.05
  // the game's walker climbs a face that W keeps pushing (its mantle starts ~0.25 s in); the check's key-up lands later than that on a slow
  // headless frame, so after letting go the keeper is at the face OR on the rock's top, and never inside the stone
  ok(!!held && !inside(held) && (atFace || onTop), `3. let go: ${atFace ? 'still at the face, on the ground' : onTop ? 'on the rock\'s top (the game\'s mantle: W was still held at the face)' : 'somewhere else'} (z ${held?.z?.toFixed(2)}, feet ${held?.y?.toFixed(2)}, rock top ${box?.y1?.toFixed(2)}), never inside it`)
  await o.screenshot({ path: `${out}/d-stopped-at-rock.png` }).catch(() => {})
  ok(JSON.stringify((await T(o)).props) === draft0, '3. walking wrote nothing to the draft (pieces identical)')
  // settle first: the mantle can still be carrying the keeper onto the top; H must be judged against where it stands WHEN pressed
  let last = await WT(o, 'body'); for (let i = 0; i < 30; i++) { await sleep(200); const b = await WT(o, 'body'); if (b && last && Math.hypot(b.x - last.x, b.z - last.z) < 0.002) { last = b; break } last = b }
  await key(o, 'KeyH')
  const cam = await o.evaluate(() => (window as W).__builderFly.cam())
  ok(!(await WT(o, 'walking')) && !!cam && Math.abs(cam.x - last.x) < 0.01 && Math.abs(cam.z - last.z) < 0.01 && !cam.top, `3. H again: Fly at the same spot (${cam?.x?.toFixed(2)}, ${cam?.z?.toFixed(2)}) as the keeper (${last?.x?.toFixed(2)}, ${last?.z?.toFixed(2)}), ${(cam?.y - last.y).toFixed(1)} m up`)
  await sleep(1500); await o.screenshot({ path: `${out}/e-back-to-fly.png` }).catch(() => {})

  const after = await store(o); const h1 = hashes(after)
  ok(JSON.stringify(h0) === JSON.stringify(h1), `4. the REAL store is untouched (${JSON.stringify(h1)}); mock posts: ${[...new Set(posts)].join(', ') || 'none'}`)
  await owner.close()
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) }
ok(errs.length === 0, `0 errors${errs.length ? ': ' + errs.slice(0, 5).join(' / ') : ''}`)
await br.close()
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS')
process.exit(fails ? 1 : 0)
