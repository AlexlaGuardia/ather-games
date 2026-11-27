// ── BETA M85 s3: STAMPS + COPY / PASTE ON THE WILDS (World Builder, owner, desktop) ── (built on m85-scatter-check.mts, s2)
// READ ONLY against prod (ather.games is Alex's live save): every POST to save-builder is answered IN THE PAGE from a mock store (draft
// = what the editor saved, live = the draft at Publish), and a reload reads that mock draft back. So:
//   owner (1280x900): Fly on the Wilds, P; REAL right-clicks place a fence, a sign and a big rock; Shift + left selects the three;
//     "Save as stamp" puts it on the shelf; the shelf button holds it; right stamps it, R R turns it 90° and right stamps it again;
//     Clear, Shift + left one piece, Ctrl+C, Ctrl+V, right pastes it; Save, RELOAD keeps every piece (and the shelf), Publish.
//   keeper (fresh, no owner key, 390x844): the SCRATCH world = the real live Wilds layer + the published pieces; the game draws every
//     stamped / pasted piece on the ground, and the big rocks' copies block (a box).
//   the real store (draft + live + versions) is hashed before and after: unchanged.
//   OWNER_KEY=... npx tsx scripts/m85-stamp-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m85-stamp-check')
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
const SRC = [{ x: B.x - 4, z: B.z }, { x: B.x, z: B.z + 1 }, { x: B.x + 5, z: B.z - 1 }], AT1 = { x: B.x + 2, z: B.z - 22 }, AT2 = { x: B.x + 24, z: B.z - 10 }, AT3 = { x: B.x - 16, z: B.z - 12 }
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
// s3: lock clicks the TOP of the small fly frame: the HUD's buttons (Save as stamp, Clear, the shelf) sit over its middle
const lock = async (o: Page) => { const b = (await (await o.$('[data-testid="fly-frame"]'))!.boundingBox())!; for (let i = 0; i < 4 && !(await o.evaluate(() => (window as W).__builderFly.locked())); i++) { await o.mouse.click(b.x + b.width / 2, b.y + 30); await sleep(1500) } }
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


const P = (o: Page) => T(o).then(t => t.place)
const unlock = async (o: Page) => { await o.keyboard.press('Escape'); await sleep(900) }
const ui = async (o: Page, sel: string) => { await unlock(o); await o.click(sel); await sleep(700); await lock(o) }
const click = async (o: Page, button: 'left' | 'right', shift = false) => { if (shift) await o.keyboard.down('Shift'); await o.mouse.down({ button }); await sleep(300); await o.mouse.up({ button }); if (shift) await o.keyboard.up('Shift'); await sleep(900) }
const ctrl = async (o: Page, c: string) => { await o.keyboard.down('Control'); await o.keyboard.press(c as any); await o.keyboard.up('Control'); await sleep(800) }
/** aim at a piece: the crosshair's target must be it before a click */
const aimAt = async (o: Page, p: { id: string; x: number; z: number }) => { for (let d = 0; d < 4; d++) { await aim(o, p.x, p.z + [0, 0.4, -0.4, 0.8][d]); await lock(o); for (let i = 0; i < 8; i++) { if ((await P(o)).target === p.id) return true; await sleep(500) } } return false }
const rel = (ps: any[]) => { const cx = ps.reduce((a, p) => a + p.x, 0) / ps.length, cz = ps.reduce((a, p) => a + p.z, 0) / ps.length; return ps.map(p => ({ k: p.k, dx: p.x - cx, dz: p.z - cz, q: p.q, s: p.s })) }
const near = (a: number, b: number, e = 0.01) => Math.abs(a - b) <= e
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
  await key(o, 'KeyP'); ok((await P(o)).on, '1. P opens Scenery mode')
  await lock(o)
  // three real pieces: a fence, a sign, a big rock (turned + grown, so the stamp has turns + sizes to keep)
  const KINDS = ['filler:fence', 'filler:sign', 'filler:rock-large']
  for (let i = 0; i < 3; i++) {
    await choose(o, KINDS[i]); if (i === 2) { await key(o, 'KeyR'); for (let w = 0; w < 6; w++) { await wheel(o, -100); await sleep(250) } }
    await aim(o, SRC[i].x, SRC[i].z); await lock(o); await click(o, 'right')
  }
  const fresh = async () => (await T(o)).props.filter(p => !base.some(b => b.id === p.id))
  const src = await fresh()
  ok(src.length === 3 && KINDS.every(k => src.some(p => p.k === k)), `1. right-clicks placed ${src.length}: ${src.map(p => `${p.k}@q${p.q} s${p.s}`).join(', ')}`)
  // SELECT: Shift + left on each
  for (const p of src) { const hit = await aimAt(o, p); if (!hit) console.log(`  (crosshair never reached ${p.id})`); await click(o, 'left', true) }
  const sel0: string[] = (await P(o)).sel
  ok(sel0.length === 3 && src.every(p => sel0.includes(p.id)), `2. Shift + left selected ${sel0.length} of 3: ${sel0.join(', ')}`)
  ok((await fresh()).length === 3, '2. selecting never picks a piece up')
  await aim(o, B.x, B.z + 6); await sleep(2000); await o.screenshot({ path: `${out}/a-selected.png` }).catch(() => {})
  // SAVE AS STAMP (the button)
  await ui(o, '[data-testid="stamp-save"]')
  let pl = await P(o)
  ok(pl.stamps.length === 1 && pl.stamps[0].pieces.length === 3, `3. "Save as stamp" puts a 3-piece stamp on the shelf (${pl.stamps.length} on it)`)
  const stamp = pl.stamps[pl.stamps.length - 1]
  // STAMP IT (the shelf button), twice: once as is, once turned 90°
  await ui(o, `[data-testid="stamp-${stamp.id}"]`)
  ok(!!(await P(o)).stampHand && !!(await o.$('[data-testid="stamp-hud"]')), '4. the shelf button holds the stamp (its HUD line)')
  await aim(o, AT1.x, AT1.z); await lock(o); await sleep(1500)
  await o.screenshot({ path: `${out}/b-stamp-ghost.png` }).catch(() => {})
  let c1: any = await o.evaluate(() => (window as W).__builderFly.centre())
  const before1 = (await T(o)).props
  await click(o, 'right')
  const s1 = (await T(o)).props.filter(p => !before1.some(b => b.id === p.id))
  await key(o, 'KeyR'); await key(o, 'KeyR')
  ok(near((await P(o)).stampHand?.q ?? -1, 1), `4. R R turns the stamp in hand 90° (q ${(await P(o)).stampHand?.q})`)
  await aim(o, AT2.x, AT2.z); await lock(o); await sleep(1500)
  await o.screenshot({ path: `${out}/c-stamp-ghost-turned.png` }).catch(() => {})
  const before2 = (await T(o)).props
  await click(o, 'right')
  const s2 = (await T(o)).props.filter(p => !before2.some(b => b.id === p.id))
  const rs = rel(src), r1 = rel(s1), r2 = rel(s2)
  const match = (a: any[], b: any[], q: number) => a.every(x => b.some(y => { const yaw = -q * Math.PI / 2, dx = x.dx * Math.cos(yaw) + x.dz * Math.sin(yaw), dz = -x.dx * Math.sin(yaw) + x.dz * Math.cos(yaw); return y.k === x.k && near(y.dx, dx, 0.02) && near(y.dz, dz, 0.02) && near(((y.q - x.q - q) % 4 + 4) % 4 % 4, 0, 0.01) && y.s === x.s }))
  ok(s1.length === 3 && s1.every(p => !base.some(b => b.id === p.id) && !src.some(b => b.id === p.id)) && match(rs, r1, 0), `5. stamp 1: 3 new pieces (${s1.map(p => p.id).join(', ')}), same offsets / turns / sizes as the selection`)
  ok(s2.length === 3 && match(rs, r2, 1), `5. stamp 2 (turned 90°): 3 new pieces, offsets turned round the centre and each piece turned 90° too`)
  ok(!!c1 && near(s1.reduce((a, p) => a + p.x, 0) / 3, Math.round(c1.x * 2) / 2, 0.02) && near(s1.reduce((a, p) => a + p.z, 0) / 3, Math.round(c1.z * 2) / 2, 0.02), `5. stamp 1 is centred on the crosshair (snapped 0.5): (${c1?.x?.toFixed(2)}, ${c1?.z?.toFixed(2)})`)
  await key(o, 'KeyX')
  ok(!(await P(o)).stampHand, '5. X puts the stamp away')
  await aim(o, AT1.x + 10, AT1.z + 14); await sleep(2500); await o.screenshot({ path: `${out}/d-stamped-twice.png` }).catch(() => {})
  // COPY / PASTE one piece
  await ui(o, '[data-testid="select-clear"]')
  const one = src.find(p => p.k === 'filler:rock-large')!
  await aimAt(o, one); await click(o, 'left', true)
  ok((await P(o)).sel.length === 1, '6. Shift + left selects one piece')
  await ctrl(o, 'KeyC'); ok(((await P(o)).clip ?? []).length === 1, '6. Ctrl+C copies it')
  await ctrl(o, 'KeyV'); ok((await P(o)).stampHand?.name === 'paste', '6. Ctrl+V holds the copy on the crosshair')
  await aim(o, AT3.x, AT3.z); await lock(o)
  const before3 = (await T(o)).props
  await click(o, 'right'); await key(o, 'KeyX')
  const pz = (await T(o)).props.filter(p => !before3.some(b => b.id === p.id))
  ok(pz.length === 1 && pz[0].id !== one.id && pz[0].k === one.k && pz[0].q === one.q && pz[0].s === one.s, `6. pasted: a copy with a new id (${pz[0]?.id}), kind ${pz[0]?.k}, q ${pz[0]?.q}, s ${pz[0]?.s}`)
  const all = [...src, ...s1, ...s2, ...pz]
  ok(new Set(all.map(p => p.id)).size === 10, '6. 10 pieces in all, every id unique')
  // save, reload
  await o.evaluate(() => (window as W).__terrain.save()); await sleep(1500)
  ok(posts.includes('draft') && all.every(p => (mockDraft?.props ?? []).some((q: any) => q.id === p.id)), `7. Save sends the draft with all 10`)
  await openFly(o)
  const back = (await T(o)).props.filter(p => !base.some(b => b.id === p.id))
  ok(back.length === 10 && all.every(p => { const q = back.find(r => r.id === p.id); return q && q.k === p.k && q.x === p.x && q.z === p.z && q.q === p.q && q.s === p.s }), `7. RELOAD: the draft keeps all ${back.length}, exactly`)
  ok((await P(o)).stamps.some((s: any) => s.id === stamp.id && s.pieces.length === 3), '7. RELOAD: the stamp is still on the shelf')
  await o.evaluate(() => (window as W).__terrain.publish('m85-stamp-check')); await sleep(1500)
  ok(posts.includes('publish') && all.every(p => (mockLive?.props ?? []).some((q: any) => q.id === p.id)), `8. Publish carries all 10 to the scratch live layer`)
  const after = await store(o); const h1 = hashes(after)
  ok(JSON.stringify(h0) === JSON.stringify(h1), `8. the REAL store is untouched (${JSON.stringify(h1)})`)
  await owner.close()

  // the keeper
  const liveTxt = await (await fetch(`${url}/shimmer/open/wilds-edits`, { cache: 'no-store' } as any)).text()
  const scratch = JSON.stringify({ ...JSON.parse(liveTxt), props: mockLive.props })
  const ctx = await br.createBrowserContext(), kp = await ctx.newPage(); await kp.setViewport({ width: 390, height: 844 })
  kp.on('pageerror', e => errs.push('keeper: ' + String(e).slice(0, 200)))
  await kp.setRequestInterception(true)
  kp.on('request', r => { if (r.method() === 'GET' && r.url().includes('/shimmer/open/wilds-edits')) r.respond({ status: 200, contentType: 'application/json', body: scratch }); else r.continue() })
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
  await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await kp.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await dismissStartCard(kp)
  const A = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as W).__ather?.[f]?.(...x), fn, a)
  await kp.waitForFunction(() => (window as W).__ather?.wildsLoaded?.().length > 0, { timeout: 240000, polling: 1000 }); await sleep(2000)
  const greg = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 0, made: 0 }
  for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: greg }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  ok((await A('zone')) === 'wilds', '9. a fresh keeper (390x844, no owner key) is in the Wilds')
  await sleep(4000); await dismissStartCard(kp).catch(e => console.log('  (start card: ' + String(e).slice(0, 80) + ')'))
  let sc: any = null
  for (let i = 0; i < 20; i++) { sc = await kp.evaluate(() => (window as W).__wildsScenery?.() ?? null); if (sc?.items?.length) break; await sleep(1000) }
  const mine = (sc?.items ?? []).filter((i: any) => all.some(p => p.id === i.id))
  ok(mine.length === 10 && mine.every((i: any) => Number.isFinite(i.y)), `9. the game draws all ${mine.length} of 10 stamped / pasted pieces on the ground`)
  const rocks = all.filter(p => p.k === 'filler:rock-large'), boxed = rocks.filter(p => (sc?.boxes ?? []).some((b: any) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1))
  ok(rocks.length === 4 && boxed.length === 4, `9. every copy of the big rock blocks (${boxed.length} of ${rocks.length} have a box)`)
  await A('tp', AT1.x, AT1.z + 12, 0); await sleep(1500); await A('look', 0, -0.3); await sleep(3000)
  await kp.screenshot({ path: `${out}/e-keeper-sees-stamp.png` })
  await A('tp', AT2.x, AT2.z + 12, 0); await sleep(1500); await A('look', 0, -0.3); await sleep(3000)
  await kp.screenshot({ path: `${out}/f-keeper-sees-turned-stamp.png` })
  await ctx.close()
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `\n${fails} FAILED` : '\nPASS'); process.exit(fails ? 1 : 0)
