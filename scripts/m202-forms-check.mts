// BETA M202 s1: THE VULNYX LINE'S SECOND FORMS on prod, 390x844 (SwiftShader). Fresh contexts, every non-GET stubbed, storage seeded
// (never the keeper's own save). One bloomed Vulnyx on one planter.
//  OWNER  1 `?form=mana|storm|earth|water`: she draws as Vulnara / Vulnarc / Vulnore / Vulnix (that glb asked for and mounted, the base
//         one not), rigged (one skeleton, idle clip on), grown past her base (0.70 m) by her own size dial (formGrow:
//         ~0.84 m at 1.2; M202 v2 Vulnore + Vulnara + Vulnarc + Vulnix ~0.98 m at 1.4); a still of each. --forms earth,mana = only those.
//  PLAYER 2 `?form=storm` without the owner cookie: her base Vulnyx, no form glb asked for (the preview is owner-only).   3 0 page errors.
// M202 Marlotl: --species axolotl = the Manalotl line (one bloomed Manalotl; owner ?form=water = Marlotl; player ?form=water = base).
// M202 Cragbear: --species water-bear = the Dewbear line (owner ?form=earth = Cragbear; player ?form=earth = base Dewbear).
//   + Lumebear / Voltbear / Tidebear: owner ?form=mana|storm|water, each sized by BEAR_GLB_TALL.
// M202 Noctyx line: --species bat (owner ?form=storm|mana|earth|water = Noctarc / Noctara / Noctore / Noctix, sized by NOCT_GLB_TALL;
//   player ?form=mana sees her base Noctyx).
// M202 Athowl line: --species owl (owner ?form=mana|storm|earth|water = Mystowl / Voltowl / Cragowl / Tideowl, sized by OWL_GLB_TALL;
//   player ?form=storm sees her base Athowl).
// M202 Croakling line: --species frog (owner ?form=water|mana|earth|storm = Croakrill / Croakara / Croakore / Croakarc, sized by
//   CROAK_GLB_TALL = her body, the lure not counted; player ?form=mana sees her base Croakling, public since M226 d634c011).
// M202 Shellmere line: --species turtle (owner ?form=earth|mana|storm|water = Mesamere / Aurmere / Voltmere / Tidemere, sized by
//   SHELL_GLB_TALL = her body, antennae + crystal not counted; player ?form=earth sees her base Shellmere, public since M226).
// M202 Lepara line: --species rabbit (owner ?form=mana|storm|earth|water = Lepaura / Leparc / Lepore / Lepnix, sized by LEP_GLB_TALL =
//   her body idle mean height, ears counted as the base's; player ?form=earth sees her base Lepara).
// M202 Hovari line: --species hummingbird (owner ?form=storm|mana|earth|water = Voltari / Lumari / Obsidari / Tidari, sized by
//   HOV_GLB_TALL = her body height, the hover not counted; player ?form=mana sees her base Hovari).
//   OWNER_KEY=... npx tsx scripts/m202-forms-check.mts [--species fox|axolotl|water-bear] [--shots dir] [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { LEP_GLB_TALL, SHELL_GLB_TALL, CROAK_GLB_TALL, BEAR_GLB_TALL, HOV_GLB_TALL, LOTL_GLB_TALL, NOCT_GLB_TALL, OWL_GLB_TALL, SECOND_FORMS, SPIRIT_ELEMENTS, SPIRIT_RIGS, formGrow } from '../src/app/shimmer/open/ather/spirit-models'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const SP = flag('--species', 'fox') as 'fox' | 'axolotl' | 'water-bear' | 'bat' | 'owl' | 'hummingbird' | 'frog' | 'turtle' | 'rabbit', url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const at0 = Date.now() - 20 * 86400000
const PIECES = [{ id: 'p0', item: 'spirit_planter', x: -134, z: 100, q: 0, placedAt: 1 }]
const POTS = { p0: { seed: `mana_seed_${SP}`, at: at0, v: 2, tends: [], bloomed: true } }
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
async function open(owner: boolean, q: string) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  const got: string[] = []; p.on('pageerror', e => errs.push(`${owner ? 'owner' : 'player'}: ${String(e).slice(0, 200)}`)); p.on('response', r => { if (/open\/spirits\//.test(r.url())) got.push(r.url().split('/').pop()!.split('?')[0]) })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)) === owner, owner ? '0. the OWNER' : '0. NOT the owner')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m202')) return; sessionStorage.setItem('m202', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces })); localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: s.sp, stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
    localStorage.setItem('ather.spiritFollow.v1', '[]'); localStorage.setItem('ather.spiritParty.v1', '[]')
  }, { pieces: PIECES, pots: POTS, tut: TUT, sp: SP })
  await p.goto(`${url}/shimmer/open/ather?hour=14${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(4000)
  await p.touchscreen.tap(195, 644); await sleep(500)
  return { p, got }
}
/** wait for her rig, then her standing height in WORLD metres over 40 frames (top of the body minus her feet) */
const measure = (p: Page) => p.evaluate(async (hover: boolean) => {
  const W = window as any, raf = () => new Promise(r => requestAnimationFrame(r))
  for (let k = 0; k < 600 && !(W.__spiritModel?.rigs?.size); k++) await new Promise(r => setTimeout(r, 100))
  const r = [...(W.__spiritModel?.rigs?.values() ?? [])][0]; if (!r) return null
  // M202 Hovari redo: a hoverer's drift pitches her forward (her height read 0.86-0.93 of her hover's while she followed the keeper),
  // so read her once she hangs still (two reads 0.5 s apart within 2 cm; 12 s cap): HOV_GLB_TALL is her hover (idle) height
  if (hover) { let last = { x: 1e9, z: 1e9 }; for (let k = 0; k < 24; k++) { await new Promise(res => setTimeout(res, 500)); if (Math.hypot(r.x - last.x, r.z - last.z) < 0.02) break; last = { x: r.x, z: r.z } } }
  let hi = 0, n = 0
  for (let f = 0; f < 40; f++) { await raf(); const b = r.body, geo = b.meshes.body.geometry, ps = geo.getAttribute('position'), V = b.bones[0].position.clone(); let lo = 1e9, top = -1e9
    for (let i = 0; i < ps.count; i += 3) { b.at('body', i, V); lo = Math.min(lo, V.y); top = Math.max(top, V.y) } hi += top - lo; n++ }
  return { h: hi / n, look: r.h, sp: r.sp, x: r.x, z: r.z, rigs: W.__spiritModel.rigs.size, urls: { ...W.__spiritModel.urls }, live: W.__spiritModel.rigCount.live }
}, SP === 'hummingbird')
const hideCard = (p: Page) => p.evaluate(() => { const h = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of h.filter(d => !h.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})

const base = SPIRIT_RIGS[SP]!
const MID_AIM = new Set(['vulnix', 'marlotl', 'cragbear', 'aurlotl', 'arclotl', 'craglotl', 'lumebear', 'voltbear', 'tidebear', 'noctarc', 'noctara', 'noctore', 'noctix', 'mystowl', 'voltowl', 'cragowl', 'tideowl', 'voltari', 'lumari', 'obsidari', 'tidari', 'croakrill', 'croakara', 'croakore', 'croakarc', 'mesamere', 'aurmere', 'voltmere', 'tidemere'])
const only = flag('--forms', '').split(',').filter(Boolean)
for (const el of SPIRIT_ELEMENTS.filter(e => SECOND_FORMS[SP]?.[e] && (!only.length || only.includes(e)))) {
  const L = SECOND_FORMS[SP]![el]!, file = L.url.split('/').pop()!
  const { p, got } = await open(true, `&form=${el}`); const m = await measure(p)
  ok(!!m && m.sp === SP, `1 ${el}: a rigged ${SP}-line body mounted (${m?.rigs} rig, ${m?.live} live)`)
  ok(!!m && m.urls[L.url] === 1 && !m.urls[base.url], `1 ${el}: ${L.name} mounted, not her base (${JSON.stringify(m?.urls)})`)
  // the preview waits on /api/owner, so her base glb may load (and draw) for the first frames before she turns: a NOTE, not an
  // assert. The mounted assert above is what says she draws as the form. A pot with `element` set (M201) never asks for the base.
  ok(got.includes(file), `1 ${el}: ${file} asked for`); console.log(`NOTE 1 ${el}: glbs asked for: ${got.join(', ')}`)
  // M202 Marlotl: the Manalotl line is sized by LENGTH (0.90 m x her dial), so her standing height is her glb's (rig metrics) x look h
  const want = SP === 'fox' ? 0.70 * formGrow(L.name) : (SP === 'water-bear' ? BEAR_GLB_TALL[L.name] : SP === 'bat' ? NOCT_GLB_TALL[L.name] : SP === 'owl' ? OWL_GLB_TALL[L.name] : SP === 'hummingbird' ? HOV_GLB_TALL[L.name] : SP === 'frog' ? CROAK_GLB_TALL[L.name] : SP === 'turtle' ? SHELL_GLB_TALL[L.name] : SP === 'rabbit' ? LEP_GLB_TALL[L.name] : LOTL_GLB_TALL[L.name]) * L.h
  ok(!!m && m.h > want * 0.9 && m.h < want * 1.1, `1 ${el}: grown past her base to ~${want.toFixed(2)} m: ${m?.h.toFixed(3)} m standing (look h ${m?.look.toFixed(3)})`)
  if (shots && m) { await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x + 1.4, z + 1.1, 0), m.x, m.z); await sleep(900)
    // after the tp she walks to the keeper: aim only once she has SETTLED (two reads 0.5 s apart within 2 cm; 12 s cap), else the still
    // frames the place she left (the Vulnara still showed only her brush)
    let last = { x: 1e9, z: 1e9 }
    for (let k = 0; k < 24; k++) { await sleep(500); const q = await p.evaluate(() => { const r = [...(window as any).__spiritModel.rigs.values()][0]; return { x: r.x, z: r.z } })
      if (Math.hypot(q.x - last.x, q.z - last.z) < 0.02) break; last = q }
    // settled beside the keeper she is too close to frame: step back 3 m from where she now stands and shoot at once
    await p.evaluate(() => { const W = window as any, r = [...W.__spiritModel.rigs.values()][0]; W.__ather.tp(r.x + 2.4, r.z + 1.8, 0) }); await sleep(150)
    // M202 v3: Vulnix is the longest of the line, so her root sits well off her middle and the still cut her head: for her the aim is
    // the middle of her drawn body (world bbox of her skinned verts); the other forms keep the root aim their stills were judged on
    const mid = MID_AIM.has(L.name)
    const m2 = await p.evaluate((mid: boolean) => { const r = [...(window as any).__spiritModel.rigs.values()][0]; if (!mid) return { x: r.x, z: r.z }
      const b = r.body, ps = b.meshes.body.geometry.getAttribute('position'), V = b.bones[0].position.clone(); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9
      for (let i = 0; i < ps.count; i += 3) { b.at('body', i, V); x0 = Math.min(x0, V.x); x1 = Math.max(x1, V.x); z0 = Math.min(z0, V.z); z1 = Math.max(z1, V.z) }
      return { x: (x0 + x1) / 2, z: (z0 + z1) / 2 } }, mid); await aimAt(p, m2.x, m2.z, 0.35); await hideCard(p)
    await p.screenshot({ path: `${shots}/${L.name}-390.png` }) }
  await p.browserContext().close()
}
{ const pel = SP === 'fox' ? 'storm' : SP === 'water-bear' ? 'earth' : SP === 'bat' ? 'mana' : SP === 'owl' ? 'storm' : SP === 'hummingbird' || SP === 'frog' ? 'mana' : SP === 'turtle' || SP === 'rabbit' ? 'earth' : 'water', { p, got } = await open(false, `&form=${pel}`); const m = await measure(p)
  ok(!!m && m.urls[base.url] === 1 && Object.keys(m.urls).length === 1, `2 player ?form=${pel}: her base ${SP} (${JSON.stringify(m?.urls)})`)
  ok(!got.some(g => /(vuln(ara|arc|ore|ix)|marlotl|aurlotl|arclotl|craglotl|cragbear|lumebear|voltbear|tidebear|noct(arc|ara|ore|ix)|(myst|volt|crag|tide)owl|voltari|lumari|obsidari|tidari|croak(rill|ara|ore|arc)|(mesa|aur|volt|tide)mere)-/.test(g)), `2 player: no form glb asked for (${got.join(', ')})`)
  await p.browserContext().close() }
ok(errs.length === 0, `3 page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0)
