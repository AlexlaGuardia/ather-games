// ── BETA M204 s2 HER GLOW ACCENT + THE SECOND FORMS' EFFECTS (2026-11-26, sprites-M204s2) ─────────────────────────────────
// Alex 11-26: "everytime the player feed the spirit the infused spices add to the color until its full and the color cant be
// changed.. (can we give the spirit this same glow accent?) ... feed the spirit 10 meals to lock in its element and glow".
// OWNER, 390 x 844, swiftshader, a fresh context per case (seeded localStorage; every non-GET fetch is stubbed, so no save
// is written anywhere). One bloomed fox planter; her pot's `meals` is the bar.
//  1. 0 meals: no accent on her (probe accents = null).
//  2. 3 earth meals: a PARTIAL earth accent (n 3, open, strength < 0.5, the bar's earth colour lit).
//  3. a MIXED 10-meal bar: LOCKED (strength 1, the count mix); RELOAD: the same locked accent.
//  4. owner preview ?form=storm / water / mana: Vulnarc / Vulnix / Vulnara carry their effect (fx mounted on her, all 9 rig
//     anchors found); Vulnara's gold trail lays smears while she runs. ?form=earth (Vulnore): no effect.
//  5. frame cost: mean frame ms over 6 s, ?form=water with and without the effect (&fx=0) and the accent; reported (NOTE).
//  0 page errors. Shots to --shots.
//   OWNER_KEY=... npx tsx scripts/m204-glow-check.mts [--url https://ather.games] [--shots docs/looks/m204-s2-2026-11-26]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { accentOf } from '../src/app/shimmer/open/ather/spirit-accent'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const at0 = Date.now() - 20 * 86400000
const PIECES = [{ id: 'p0', item: 'spirit_planter', x: -134, z: 100, q: 0, placedAt: 1 }]
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const MIX = ['mana', 'storm', 'earth', 'earth', 'water', 'water', 'water', 'mana', 'storm', 'earth']
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
async function open(meals: string[], q: string) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  p.on('pageerror', e => errs.push(`${q}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); process.exit(1) }
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m204g')) return; sessionStorage.setItem('m204g', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces })); localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: { p0: { seed: 'mana_seed_fox', at: s.at0, v: 2, tends: [], bloomed: true, meals: s.meals } }, met: [] }))
    localStorage.setItem('ather.spiritFollow.v1', '[]'); localStorage.setItem('ather.spiritParty.v1', '[]')
  }, { pieces: PIECES, tut: TUT, at0, meals })
  await load(p, q)
  return p
}
async function load(p: Page, q: string) {
  await p.goto(`${url}/shimmer/open/ather?hour=19${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(4000)
  await p.touchscreen.tap(195, 644); await sleep(500)
  await p.waitForFunction(() => (window as any).__spiritModel?.rigs?.size > 0, { timeout: 120000 }); await sleep(1500)
}
const accent = (p: Page) => p.evaluate(() => (window as any).__spiritModel?.accents?.p0 ?? null) as Promise<{ hex: string; s: number; n: number; locked: boolean } | null>
const hideCard = (p: Page) => p.evaluate(() => { const h = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of h.filter(d => !h.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
/** step beside her, let her settle, step back and frame her middle */
async function frame(p: Page, name: string) {
  if (!shots) return
  const r0 = await p.evaluate(() => { const r = [...(window as any).__spiritModel.rigs.values()][0]; return { x: r.x, z: r.z } })
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x + 1.4, z + 1.1, 0), r0.x, r0.z); await sleep(900)
  let last = { x: 1e9, z: 1e9 }
  for (let k = 0; k < 24; k++) { await sleep(500); const q = await p.evaluate(() => { const r = [...(window as any).__spiritModel.rigs.values()][0]; return { x: r.x, z: r.z } }); if (Math.hypot(q.x - last.x, q.z - last.z) < 0.02) break; last = q }
  await p.evaluate(() => { const W = window as any, r = [...W.__spiritModel.rigs.values()][0]; W.__ather.tp(r.x + 2.0, r.z + 1.5, 0) }); await sleep(150)
  const m = await p.evaluate(() => { const r = [...(window as any).__spiritModel.rigs.values()][0], b = r.body, ps = b.meshes.body.geometry.getAttribute('position'), V = b.bones[0].position.clone(); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9
    for (let i = 0; i < ps.count; i += 3) { b.at('body', i, V); x0 = Math.min(x0, V.x); x1 = Math.max(x1, V.x); z0 = Math.min(z0, V.z); z1 = Math.max(z1, V.z) }
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2 } })
  await aimAt(p, m.x, m.z, 0.3); await hideCard(p); await sleep(600); await aimAt(p, m.x, m.z, 0.3); await sleep(300)
  await p.screenshot({ path: `${shots}/${name}.png` })
}
const frameMs = (p: Page) => p.evaluate(async () => { const t0 = performance.now(); let n = 0; while (performance.now() - t0 < 6000) { await new Promise(r => requestAnimationFrame(r)); n++ } return (performance.now() - t0) / Math.max(1, n) }) as Promise<number>

// 1. no meals
{ const p = await open([], ''); const a = await accent(p)
  ok(a === null && await p.evaluate(() => 'p0' in ((window as any).__spiritModel?.accents ?? {})), `1 0 meals: no accent on her (${JSON.stringify(a)})`)
  await frame(p, 'a-0-meals'); await p.browserContext().close() }
// 2. three earth
{ const p = await open(['earth', 'earth', 'earth'], ''); const a = await accent(p), want = accentOf(['earth', 'earth', 'earth'])!
  ok(!!a && a.n === 3 && !a.locked && a.s > 0 && a.s < 0.5 && a.hex === want.hex, `2 3 earth meals: a partial earth accent (${JSON.stringify(a)}, earth ${want.hex})`)
  await frame(p, 'b-3-earth'); await p.browserContext().close() }
// 3. mixed 10, then reload
{ const p = await open(MIX, ''); const a = await accent(p), want = accentOf(MIX)!
  ok(!!a && a.n === 10 && a.locked && a.s === 1 && a.hex === want.hex, `3 a mixed 10-meal bar: locked mixed accent (${JSON.stringify(a)}, mix ${want.hex})`)
  await frame(p, 'c-10-mixed-locked')
  await load(p, ''); const b = await accent(p)
  ok(!!b && b.locked && b.hex === a?.hex && b.s === 1, `3 reload: the same locked accent (${JSON.stringify(b)})`)
  await p.browserContext().close() }
// 4. the forms' effects (owner preview), each with a locked mixed bar so the accent shows on the form too
for (const [el, name] of [['storm', 'vulnarc'], ['water', 'vulnix'], ['mana', 'vulnara'], ['earth', 'vulnore']] as const) {
  const p = await open(MIX, `&form=${el}`)
  const fx = await p.evaluate(() => { const W = window as any, f = W.__spiritModel?.fxs?.get('p0'); return f ? { ...f.stats(), parent: !!f.points.parent } : null })
  const look = await p.evaluate(() => [...(window as any).__spiritModel.rigs.values()][0]?.body ? Object.keys((window as any).__spiritModel.urls).join() : '')
  if (name === 'vulnore') ok(fx === null && look.includes('vulnore'), `4 ?form=earth (Vulnore): no effect (${JSON.stringify(fx)}, ${look})`)
  else ok(!!fx && fx.form === name && fx.bones === 9 && fx.parent && look.includes(name), `4 ?form=${el}: ${name} carries her effect (${JSON.stringify(fx)}, ${look})`)
  if (name === 'vulnara') {
    // she runs to the keeper: the trail lays smears behind her
    const r0 = await p.evaluate(() => { const r = [...(window as any).__spiritModel.rigs.values()][0]; return { x: r.x, z: r.z } })
    await p.evaluate(() => { localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['p0'])) })
    await load(p, `&form=${el}`)
    await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x + 7, z + 5, 0), r0.x, r0.z)
    // the count LAID while she runs (alive-at-once depends on the frame rate: at swiftshader's ~3 fps a 0.9 s smear spans ~3 frames)
    let most = 0, laid = 0; for (let k = 0; k < 30; k++) { await sleep(200); const st = await p.evaluate(() => { const f = (window as any).__spiritModel.fxs.get('p0'); return f ? f.stats() : null }); if (st) { most = Math.max(most, st.trail); laid = st.laid } }
    ok(laid >= 6 && most >= 1, `4 Vulnara's gold trail lays smears while she runs (${laid} laid in 6 s, most alive at once ${most})`)
  }
  await frame(p, `d-${name}`)
  if (name === 'vulnix') {
    // both measured the same way: a fresh load, 6 s settle, then 6 s of frames; without first (the page is warm by the second)
    await load(p, `&form=${el}&fx=0`); await sleep(6000); const noFx = await frameMs(p)
    await load(p, `&form=${el}`); await sleep(6000); const withFx = await frameMs(p)
    console.log(`NOTE 5 frame cost (swiftshader, 390, Vulnix + locked accent): with effect ${withFx.toFixed(1)} ms/frame, ?fx=0 ${noFx.toFixed(1)} ms/frame (delta ${(withFx - noFx).toFixed(1)} ms)`)
    ok(withFx < noFx * 1.25 + 2, `5 the effect costs little: ${withFx.toFixed(1)} vs ${noFx.toFixed(1)} ms/frame`)
  }
  await p.browserContext().close()
}
ok(errs.length === 0, `0 page errors (${errs.slice(0, 3).join(' | ')})`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'ALL PASS')
process.exit(fails ? 1 : 0)
