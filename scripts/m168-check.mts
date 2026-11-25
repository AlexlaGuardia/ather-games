// ── M168 s1: THE MOGLINS' PROMPTS, MOMO IN FLY, FENCES ON A SLOPE ──
//   default = Fly READ ONLY (owner, on the box): every POST to save-builder is answered in the page, live + draft hashed before and after.
//   --prompts = the game only, no owner key: each Glade Moglin's 'E · talk to {NAME}' (desktop), and on a phone a real tap on the
//     'use' button opens the talk.   --loop = publish for real and look as a fresh keeper: A THROWAWAY COPY on localhost only.
//   npx tsx scripts/m168-check.mts [--url ..] [--out dir] [--prompts [--phone]] [--loop --url http://localhost:3291]
import puppeteer, { type Page } from 'puppeteer-core'
import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { aimAt } from './lib/aim.mts'
import { parseGladeLayer, gladeLayerGround } from '../src/app/shimmer/open/ather/glade-layer'
import { sceneryPlaced } from '../src/app/shimmer/open/ather/scenery'
import { padGround } from '../src/app/shimmer/open/ather/glade-pads'
import { momoSpot } from '../src/app/shimmer/open/ather/glade-momo'
import { gladeKeepers } from '../src/app/shimmer/open/ather/glade-cluster'
import { setGladePeople } from '../src/app/shimmer/open/ather/glade-people'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m168-check'), LOOP = process.argv.includes('--loop'), PROMPTS = process.argv.includes('--prompts'), phone = process.argv.includes('--phone')
if (LOOP) { const u = new URL(url); if (u.hostname !== 'localhost' || /^32[0]\d$/.test(u.port)) { console.error('--loop publishes: a throwaway copy on localhost only'); process.exit(2) } }
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY ?? ''
if (!KEY && !PROMPTS) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = [], posts: string[] = [], sent: any[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const AT = { x: -100, z: 130 }, HILL = { x: -84, z: 128 }
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
const flyMomo = (o: Page) => o.evaluate(() => (window as W).__builderFly.fixed().momo) as Promise<{ x: number; y: number; z: number; yaw: number; meshes: number } | null>
const scen = (o: Page) => o.evaluate(() => (window as W).__scenery?.()?.items ?? []) as Promise<any[]>
const near = (a: any, b: any, e = 0.02) => !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < e
try {
  if (PROMPTS) {
    const g = await game(phone)
    const folk = async () => (await g.evaluate(() => (window as W).__glade?.folk ?? [])) as { id: string; x: number; z: number; yaw: number }[]
    await until(async () => (await folk()).length >= 5); await sleep(10000)
    for (const n of ['Hazel', 'Sax', 'Yarrow', 'Mallow', 'Fennel']) {
      const id = `moonwell:${n.toLowerCase()}`, f = (await folk()).find(q => q.id === id); if (!f) { ok(false, `${n} is drawn`); continue }
      await g.evaluate((x, z, y) => (window as W).__ather.gladeAt(x, z, y), f.x + Math.sin(f.yaw) * 1.8, f.z + Math.cos(f.yaw) * 1.8, Math.atan2(Math.sin(f.yaw), Math.cos(f.yaw))); await sleep(2500); await aimAt(g, f.x, f.z, 0.6)
      ok(await until(() => g.evaluate((k: string) => { const q = (window as W).__ather.near(); return k === 'moonwell:fennel' ? q?.kind === 'gfennel' : q?.kind === 'folk' && q.id === k }, id)), `${n}: in reach`)
      let calm = 0; await until(async () => { calm = await g.evaluate(() => document.querySelector<HTMLElement>('[data-veil]')?.style.opacity === '0') ? calm + 1 : 0; return calm >= 4 }, 40000)
      ok(await until(() => g.evaluate((t: string) => document.body.innerText.includes(t), `E · talk to ${n}`)) && !(await g.evaluate(() => /talk to the folk of|E · Fennel/.test(document.body.innerText))), `${n}: the prompt 'E · talk to ${n}'`)
      if (phone) {
        const at = await g.evaluate(() => { const b = document.querySelector<HTMLElement>('[data-touch="use"][data-touch-near]'); if (!b) return null; const r = b.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, e = document.elementFromPoint(x, y); return { x, y, top: e === b || b.contains(e) } })
        ok(at?.top, `${n}: the 'use' button is up and on top`); ok(!(await g.evaluate(() => document.querySelector('[data-talk-option]'))), `${n}: no talk before the tap`)
        if (at) await g.touchscreen.tap(at.x, at.y)
      }
      if (n === 'Hazel') await g.screenshot({ path: `${out}/prompt-${phone ? 'phone' : 'desk'}.png` })
      if (!phone) await g.keyboard.press('KeyE')
      ok(await until(() => g.evaluate(() => !!document.querySelector('[data-talk-option]'))), `${n}: ${phone ? 'the tap' : 'E'} opens the talk`)
      if (await g.evaluate(() => (window as W).__ather.panel())) await g.keyboard.press('Escape'); await sleep(1500)
    }
  } else {
    const o = await enter(), before = await store(o), h0 = hashes(before), base: any[] = before.draft.props ?? []
    console.log(`  before ${JSON.stringify(h0)}`)
    await openFly(o); await key(o, 'KeyP'); await lock(o)
    // M · Momo
    setGladePeople(base); const land0 = gladeLayerGround(parseGladeLayer(before.draft).edits), stand0 = padGround(base, land0)
    const B0 = gladeKeepers().find(k => k.id === 'bonn')!, m0 = await flyMomo(o), w0 = momoSpot(stand0)
    ok(m0?.meshes === 3 && near(m0, w0, 0.06), `M. Momo is drawn in Fly by Bonn (${m0 && [m0.x, m0.y, m0.z].map(v => v.toFixed(2))})`)
    if (!m0) throw new Error('no Momo')
    await aim(o, m0.x, m0.z, 3, -0.6); await o.screenshot({ path: `${out}/fly-momo.png` })
    const targets: (string | null)[] = []
    const ahead = async (x: number, y: number, z: number) => { await o.evaluate((a: number, b: number, c: number) => (window as W).__builderFly.setCam({ x: a, y: b + 2, z: c + 2, yaw: 0, pitch: -Math.PI / 4, top: false }), x, y, z); await sleep(1500); targets.push((await P(o)).target) }
    for (const h of [0.08, 0.16, 0.24]) await ahead(m0.x, m0.y + h, m0.z)
    ok(targets.every(t => t === null || t === 'wbonn'), `M. the crosshair on him takes nothing of his (${targets})`)
    // move Bonn by the tool
    await o.evaluate((x: number, z: number) => { const T = (window as W).__terrain, c = T.origin(); (window as W).__builderFly.setCam({ x, z: z + 6, y: T.heightAt(x - c.x, z - c.z) + 6, yaw: 0, pitch: -Math.atan2(5.35, 6), top: false }) }, B0.x, B0.z); await sleep(1800); await key(o, 'KeyM')
    ok((await P(o)).moving === 'wbonn' && (await flyMomo(o)) === null, 'M. Bonn in hand: Momo is not left behind')
    await o.evaluate((a: number, b: number) => (window as W).__terrain.place.put(a, b), B0.x + 8, B0.z - 4); await sleep(1500)
    setGladePeople(await props(o)); const m1 = await flyMomo(o); ok(near(m1, momoSpot(stand0), 0.06) && !near(m1, m0, 4), `M. he follows Bonn (${m1 && [m1.x, m1.z].map(v => v.toFixed(2))})`)
    await o.screenshot({ path: `${out}/fly-momo-moved.png` })
    ok(!JSON.stringify(await props(o)).includes('momo'), 'M. he is not a piece')
    // F · fences on a hill: raised in the draft, fences run over it through the tool
    const put = async (x: number, z: number) => { const n = (await props(o)).length; await o.evaluate((a: number, b: number) => (window as W).__terrain.place.put(a, b), x, z); await sleep(700); const q = await props(o); return q.length > n ? q[q.length - 1] : null }
    await aim(o, HILL.x, HILL.z, 16, -0.4)
    await o.evaluate((x: number, z: number) => { const T = (window as W).__terrain, c = T.origin(); for (let k = 0; k < 3; k++) T.stroke('raise', x - c.x, z - c.z, 14, 0.5, 6) }, HILL.x, HILL.z); await sleep(1500)
    await choose(o, 'filler:fence'); const ids: string[] = []
    for (let x = -14; x <= 14; x += 2) { const p = await put(HILL.x + x, HILL.z); if (p) ids.push(p.id) }
    await choose(o, 'filler:fence-corner'); const cr = await put(HILL.x - 6, HILL.z + 6); if (cr) ids.push(cr.id)
    await sleep(1500); const it = (await scen(o)).filter(i => ids.includes(i.id)), lean = it.filter(i => i.tilt), top = Math.max(0, ...lean.map(i => Math.abs(i.tilt[0])))
    ok(it.length === ids.length && lean.length >= 10 && top > 0.15 && top <= 1, `F. Fly: ${lean.length}/${ids.length} fences lean, the most ${top.toFixed(2)} m per m`)
    await o.evaluate((x: number, z: number) => { const T = (window as W).__terrain, c = T.origin(); (window as W).__builderFly.setCam({ x, z: z + 20, y: T.heightAt(x - c.x, z - c.z) + 4, yaw: 0, pitch: -0.15, top: false }) }, HILL.x, HILL.z); await sleep(2500); await o.screenshot({ path: `${out}/fly-fences.png` })
    const row = it.filter(i => i.k === 'filler:fence').sort((a, b) => a.x - b.x), gaps = row.slice(1).map((b, k) => { const a = row[k], end = (p: any, s: number) => p.y + s * (p.q === 2 ? -1 : 1) * (p.tilt?.[0] ?? 0); return Math.abs(end(a, 1) - end(b, -1)) })
    ok(gaps.length >= 10 && Math.max(...gaps) < 0.02, `F. end to end they meet (worst ${Math.max(...gaps).toFixed(3)} m)`)
    // a sloping one is still taken by the crosshair at its raised end
    const st = [...lean].filter(i => i.k === 'filler:fence').sort((a, b) => Math.abs(b.tilt[0]) - Math.abs(a.tilt[0]))[0], e = st.tilt[0] > 0 ? 0.6 : -0.6
    const y = st.y + e * st.tilt[0] + 0.82 - 0.0; await o.evaluate((a: number, b: number, c: number) => (window as W).__builderFly.setCam({ x: a, y: b + 2, z: c + 4, yaw: 0, pitch: -Math.atan2(2, 4), top: false }), st.x + (st.q === 2 ? -e : e), y, st.z); await sleep(1800)
    ok((await P(o)).target === st.id, `F. the crosshair takes it by its sloping rail (${(await P(o)).target})`); await o.screenshot({ path: `${out}/fly-target.png` })
    if (!LOOP) { await sleep(500); ok(!posts.includes('publish'), `nothing was published (${posts.join()})`); ok(!JSON.stringify(sent).includes('tilt'), 'the tilt is saved nowhere'); const h1 = hashes(await store(o)); ok(JSON.stringify(h1) === JSON.stringify(h0), `live + draft as they were ${JSON.stringify(h1)}`) }
    else {
      await o.evaluate(() => (window as W).__terrain.publish('m168')); const s2 = await store(o); ok(s2.v === before.v + 1, `L. Publish: v${s2.v} (${await o.evaluate(() => (window as W).__terrain.status())})`)
      ok(!/tilt|momo/.test(JSON.stringify(s2.live)), 'L. neither Momo nor a tilt is in the layer')
      for (const ph of [true, false]) {
        const g = await game(ph), gi = (await scen(g)).filter(i => ids.includes(i.id)), tag = ph ? 'phone' : 'desk'
        ok(gi.length === ids.length && gi.every(a => { const b = it.find(q => q.id === a.id); return Math.abs(a.y - b.y) < 0.02 && Math.abs((a.tilt?.[0] ?? 0) - (b.tilt?.[0] ?? 0)) < 0.02 && Math.abs((a.tilt?.[1] ?? 0) - (b.tilt?.[1] ?? 0)) < 0.02 }), `L. ${tag}: every fence stands and leans as in Fly (${gi.length})`)
        const gm = await g.evaluate(() => (window as W).__glade.momo); ok(near(gm, m1, 0.06), `L. ${tag}: Momo is where Fly had him (${gm && [gm.x, gm.z].map((v: number) => v.toFixed(2))})`)
        await g.evaluate((x: number, z: number) => { const a = (window as W).__ather; a.gladeAt(x, z, 0); a.look?.(0, -0.1) }, HILL.x, HILL.z + 18); await sleep(7000); await g.screenshot({ path: `${out}/game-fences-${tag}.png` as `${string}.png` })
        if (!ph) {   // walk into a leaning one from +z: it stops you
          const T = st; await g.evaluate((x: number, z: number) => { const a = (window as W).__ather; a.gladeAt(x, z, 0); a.look?.(0, -0.2) }, T.x, T.z + 1.6); await sleep(5000); await g.mouse.click(640, 400); await sleep(800)
          await g.keyboard.down('KeyW'); let z = 99; for (let k = 0; k < 40; k++) { await sleep(1000); const q = await g.evaluate(() => (window as W).__ather.state().pz); if (Math.abs(q - z) < 0.005 && k > 12) break; z = q } await g.keyboard.up('KeyW')
          const pz = await g.evaluate(() => (window as W).__ather.state().pz); ok(pz > T.z && pz < T.z + 1, `L. a leaning fence stops the keeper (${(pz - T.z).toFixed(2)} m from it)`)
        }
        await g.close()
      }
      await o.evaluate((v: number) => (window as W).__terrain.rollback(v), before.v); ok(hash((await store(o)).live) === h0.live, 'L. roll back: live is what it was')
    }
  }
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
await br.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
