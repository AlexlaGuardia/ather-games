// ── BETA M124 s1: SPIRIT BEDS, PLAYED AT 390x844 AS A NON-OWNER (RULED athernyx ce34508) ──────────────────────────────────
// SETUP (stated): an M122-SHAPE save: 6 beds (spirit_planter) pa..pf on the start ground; bed pa holds a Vulnyx at 'pa' and a
// Manalotl at 'pa#2' (bloomed), plus an overdue Owl seed at 'pa#3'; bed pb holds a Bat. A Grimoire Pedestal stands placed.
// Bag: 3 Spirit Beds + 1 Mana Seed. Party + follow empty. Hooks: tp/look/state (movement + reading only).
//  1. Boot: only the FEATURED spirit of bed pa is drawn (the Vulnyx 'pa'); the Manalotl 'pa#2' lives out of sight (not drawn).
//  2. Place 2 beds by touch (8 stand); a 9th is refused (still 8, the bag keeps it, the refusal line shows).
//  3. Bed pa's panel (title 'Spirit Bed'): the overdue Owl blooms there (record 3 = past the old one-spirit lock); the bed
//     still takes the bag's Mana Seed (saved at 'pa#4').
//  4. Feature 'pa#2': saved; the Manalotl is drawn near her bed and the Vulnyx is not.
//  5. The grimoire roster lists all 4 spirits grouped by bed (pa: pa, pa#2, pa#3; pb: pb), featured marked.
//  6. Ask along 'pa' (the unfeatured Vulnyx): she joins the party and is drawn again.
//  s2: the words on screen are the SIGNED ones (lark batch 11-24c, canon-tested in lines-batch-24c.test.ts), old placeholders gone.
//  8. OWNER, desktop 1280x900 (Creative mode is a desktop editor): a building zone (the SITE path, canPlacePiece with `site`) takes 8
//     Spirit Beds by real clicks; the 9th is refused with the same signed line; a bench still sets; a standing bed still turns.
//     The editor's POSTs never leave the page (fetch stub), so the Glade draft is not written; read back equal at the end.
//  7. Reload: 'pa#2' is still in the save (same pot), still featured, still listed. 0 page errors.
//   npx tsx scripts/m124-beds-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync, existsSync } from 'fs'
import { aimAt } from './lib/aim.mts'
import { GLADE_SIZE } from '../src/app/shimmer/world/glade-builder'
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /^OWNER_KEY=(.+)$/m.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
/** the signed MAIN lines, spelled out (not read from the build, so a drift in the build fails here) */
const CAPPED = '8 spirit beds already stand in this garden.', NEAR = 'Chose to stay near this bed.', ROAM = 'Roaming the garden.', ASK = 'Ask to stay'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m124-beds')
mkdirSync(out, { recursive: true })
const BEDS = ['pa', 'pb', 'pc', 'pd', 'pe', 'pf'].map((id, k) => ({ id, item: 'spirit_planter', x: -134 - k * 2.6, z: 98.5, q: 0, placedAt: 1 }))
const PED = { id: 'ped-m124', item: 'grimoire_pedestal', x: -126, z: 102.5, q: 0, placedAt: 1 }
const at0 = Date.now() - 20 * 86400000
const POTS = {
  pa: { seed: 'mana_seed_fox', at: at0, v: 2, tends: [], bloomed: true },
  'pa#2': { seed: 'mana_seed_axolotl', at: at0 + 1, v: 2, tends: [], bloomed: true },
  'pa#3': { seed: 'mana_seed_owl', at: at0 + 2, v: 2, tends: [] },   // overdue: blooms on the next ripen
  pb: { seed: 'mana_seed_bat', at: at0 + 3, v: 2, tends: [], bloomed: true },
}
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms = 20000) => { for (let t = 0; t < ms; t += 400) { if (await f().catch(() => false)) return true; await sleep(400) } return false }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)), '0. a NON-owner keeper')
  await p.evaluateOnNewDocument((s: { pieces: unknown[]; pots: unknown; tut: unknown }) => {
    if (sessionStorage.getItem('m124')) return; sessionStorage.setItem('m124', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'spirit_planter', n: 3 }; slots[1] = { id: 'mana_seed_fox', n: 1 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces }))
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
    for (const k of ['ather.spiritFollow.v1', 'ather.spiritFed.v1', 'ather.trainAssign.v1', 'open.bank.v1', 'ather.spiritParty.v1']) localStorage.removeItem(k)
  }, { pieces: [...BEDS, PED], pots: POTS, tut: TUT })
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(x => x.endsWith(key)) ?? key) ?? 'null'), k) as Promise<any>
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tp = async (x: number, z: number, yaw: number) => { await A('tp', x, z, yaw); await sleep(1500) }
  const centre = (sel: string) => p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null }, sel)
  // the dev server's Next badge sits over hotbar slot 1 at 390 (prod has none): take it out before any tap
  const tap = async (sel: string) => { await p.evaluate(() => document.querySelectorAll('nextjs-portal').forEach(e => e.remove())).catch(() => {}); const b = await centre(sel); if (b) { await p.touchscreen.tap(b.x, b.y); await sleep(700) } return !!b }
  const click = async (sel: string) => { const b = await centre(sel); if (b) { await p.mouse.click(b.x, b.y); await sleep(700) } return !!b }
  const drawn = () => p.evaluate(() => ({ ...((window as any).__spiritModel?.species ?? {}) })) as Promise<Record<string, number>>
  const beds = async () => (((await read('open.works.v1'))?.pieces ?? []) as { item: string }[]).filter(q => q.item === 'spirit_planter').length
  const bagN = async (id: string) => (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === id ? s.n : 0), 0)
  const book = () => read('ather.grimoire.v1')
  const boot = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(5000); await hideCard() }
  const eAt = async (x: number, z: number, ty: number) => { await tp(x, z + 1.3, 0); await aimAt(p, x, z, ty); await p.keyboard.press('e'); await sleep(1200) }
  const openPanel = async (sel: string, x: number, z: number, ty: number) => { for (let k = 0; k < 3; k++) { await eAt(x, z, ty); if (await poll(async () => !!(await centre(sel)), 6000)) return true; await p.keyboard.press('Escape'); await sleep(500) } return false }

  await boot()
  await p.touchscreen.tap(195, 644); await sleep(600)
  // 1. only the featured spirit is drawn
  ok(await poll(async () => (await drawn()).fox === 1, 30000), `1. the featured Vulnyx (pa) is drawn (${JSON.stringify(await drawn())})`)
  await sleep(2000)
  ok(!(await drawn()).axolotl, `1. the unfeatured Manalotl (pa#2) is NOT drawn (${JSON.stringify(await drawn())})`)
  await shot('m124-1-boot')
  // 2. place 2 beds by touch, the 9th refused
  const placeAt = async (x: number, z: number) => {
    const before = await beds(); await tp(x, z, 0)
    if (!(await centre('[data-act="place"]'))) for (let t = 0; t < 3; t++) { await tap('[data-hud="hotbar"] button[aria-label="slot 1"]'); if (await poll(async () => !!(await centre('[data-act="place"]')), 6000)) break }
    for (let t = 0; t < 3 && (await beds()) === before; t++) { await tap('[data-act="place"]'); await sleep(600) }
    if ((await beds()) === before) console.log(`   (place at ${x},${z}: hud '${(await p.evaluate(() => document.querySelector('[data-hud-say]')?.textContent ?? document.body.innerText.slice(-200)))?.slice(0, 160)}')`)
    return (await beds()) > before
  }
  ok(await placeAt(-136, 106), '2. a 7th bed placed by touch')
  ok(await placeAt(-141, 110), '2. an 8th bed placed by touch')
  ok((await beds()) === 8 && (await bagN('spirit_planter')) === 1, `2. 8 beds stand, 1 left in the bag (${await beds()})`)
  const before9 = await beds(); await placeAt(-146, 106)
  const refusal = await poll(async () => p.evaluate(() => document.body.innerText.includes('8 spirit beds already stand in this garden.')), 4000)
  ok((await beds()) === before9 && (await bagN('spirit_planter')) === 1, `2. the 9th bed is refused (${await beds()} stand, bag ${await bagN('spirit_planter')})`)
  ok(refusal, "2. the refusal line shows: '8 spirit beds already stand in this garden.'")
  await shot('m124-2-ninth')
  // put the held bed away (from the hand there is no Cancel): tap its slot again, else another slot
  for (const s of [1, 1, 3, 4]) { if (!(await centre('[data-placing]'))) break; await tap(`[data-hud="hotbar"] button[aria-label="slot ${s}"]`); await sleep(500) }
  ok(!(await centre('[data-placing]')), '2. the held bed is put away (out of placing)')
  // 3. bed pa: the owl blooms past the old lock, the bed takes the next seed
  const pa = BEDS[0]
  ok(await openPanel('[data-panel="planter"]', pa.x, pa.z, 0.4), '3. E at bed pa opens its panel')
  const title = await p.evaluate(() => document.querySelector('[data-panel="planter"]')?.textContent ?? '')
  ok(title.includes('Spirit Bed'), '3. the panel is titled Spirit Bed')
  ok(await poll(async () => p.evaluate(() => document.querySelector('[data-bed-record]')?.getAttribute('data-bed-record') === '3'), 8000), '3. the overdue Owl bloomed in bed pa: its record holds 3 (pa, pa#2, pa#3)')
  ok((await book())?.pots?.['pa#3']?.bloomed === true, '3. pa#3 saved bloomed')
  const words = () => p.evaluate(() => [...document.querySelectorAll('[data-planter="bloomed"]')].map(e => ({ id: e.getAttribute('data-spirit'), t: (e as HTMLElement).textContent ?? '', b: e.querySelector('[data-act="feature-spirit"] button')?.textContent ?? null })))
  const heading = await p.evaluate(() => document.querySelector('[data-bed-record] span')?.textContent)
  let ws = await words(); const wOf = (id: string) => ws.find(x => x.id === id)
  ok(heading === 'Bloomed here', `3. the record's heading is 'Bloomed here' (${heading})`)
  ok(!!wOf('pa')?.t.includes(NEAR) && wOf('pa')?.b === null, `3. the featured one reads '${NEAR}' (${wOf('pa')?.t})`)
  ok(!!wOf('pa#2')?.t.includes(ROAM) && wOf('pa#2')?.b === ASK, `3. an unfeatured one reads '${ROAM}' with the button '${ASK}' (${wOf('pa#2')?.t} / ${wOf('pa#2')?.b})`)
  ok(!/Featured\.|Out in the garden|>Feature</.test(ws.map(x => `${x.t}>${x.b}<`).join()), '3. no placeholder words left on the panel')
  await tap('[data-act="plant-seed"][data-seed="mana_seed_fox"]')
  ok(await poll(async () => (await book())?.pots?.['pa#4']?.seed === 'mana_seed_fox', 5000) && (await bagN('mana_seed_fox')) === 0, '3. the bed took the Mana Seed (saved at pa#4, bag -1)')
  // 4. feature pa#2
  ok(await tap('[data-planter="bloomed"][data-spirit="pa#2"] [data-act="feature-spirit"] button'), '4. tapped Ask to stay on the Manalotl (pa#2)')
  ok(await poll(async () => (await book())?.featured?.pa === 'pa#2', 5000), `4. saved: bed pa features pa#2 (${JSON.stringify((await book())?.featured)})`)
  ws = await words(); ok(!!wOf('pa#2')?.t.includes(NEAR) && !!wOf('pa')?.t.includes(ROAM) && wOf('pa')?.b === ASK, `4. the lines flip: pa#2 '${NEAR}', pa '${ROAM}' (${wOf('pa#2')?.t} / ${wOf('pa')?.t})`)
  await shot('m124-4-featured'); await p.keyboard.press('Escape'); await sleep(500)
  ok(await poll(async () => { const d = await drawn(); return d.axolotl === 1 && !d.fox }, 20000), `4. the Manalotl is drawn, the Vulnyx is not (${JSON.stringify(await drawn())})`)
  const ax = await p.evaluate(() => (window as any).__spiritModel?.trots?.axolotl ?? null) as { x: number; z: number; home: { x: number; z: number } } | null
  ok(!!ax && Math.hypot(ax.home.x - pa.x, ax.home.z - pa.z) < 0.01 && Math.hypot(ax.x - pa.x, ax.z - pa.z) < 6, `4. near her bed (home ${ax?.home.x},${ax?.home.z}; at ${ax?.x.toFixed(1)},${ax?.z.toFixed(1)})`)
  // 5. the roster, grouped by bed
  const roster = () => p.evaluate(() => ({
    beds: [...document.querySelectorAll('[data-roster-bed]')].map(e => e.getAttribute('data-roster-bed')),
    rows: [...document.querySelectorAll('[data-roster-spirit]')].map(e => `${e.getAttribute('data-bed')}:${e.getAttribute('data-roster-spirit')}${e.getAttribute('data-featured') === '1' ? '*' : ''}`),
    inP: [...document.querySelectorAll('[data-roster-spirit][data-in-party="1"]')].map(e => e.getAttribute('data-roster-spirit')),
  })) as Promise<{ beds: string[]; rows: string[]; inP: string[] }>
  ok(await openPanel('[data-roster]', PED.x, PED.z, 0.95), '5. E at the pedestal opens the roster')
  let r = await roster(); await shot('m124-5-roster')
  ok(r.beds.join() === 'pa,pb', `5. grouped by bed (${r.beds.join()})`)
  ok(r.rows.join() === 'pa:pa,pa:pa#2*,pa:pa#3,pb:pb*', `5. all 4 spirits listed by bed, featured marked (${r.rows.join()})`)
  const heads = await p.evaluate(() => [...document.querySelectorAll('[data-roster-bed]')].map(e => e.textContent))
  ok(heads.join() === 'Bed 1,Bed 2', `5. the headers read Bed 1, Bed 2 (${heads.join()})`)
  // 6. ask along the unfeatured Vulnyx
  await click('[data-roster-spirit="pa"] [data-act="ask"] button')
  r = await roster(); ok(r.inP.includes('pa'), `6. ask along: pa is in the party (${r.inP.join()})`)
  await p.keyboard.press('Escape'); await sleep(500)
  ok(await poll(async () => (await drawn()).fox === 1, 20000), `6. the unfeatured Vulnyx is drawn again with the keeper (${JSON.stringify(await drawn())})`)
  // 7. reload: the M122 #2 spirit kept
  await boot()
  const b = await book()
  ok(JSON.stringify(b?.pots?.['pa#2']) === JSON.stringify(POTS['pa#2']) && b?.featured?.pa === 'pa#2', '7. reload: pa#2 kept byte-for-byte and still featured')
  ok(await poll(async () => { const d = await drawn(); return d.axolotl === 1 && d.fox === 1 }, 30000), `7. reload: Manalotl (featured) + Vulnyx (party) drawn (${JSON.stringify(await drawn())})`)
  ok(await openPanel('[data-roster]', PED.x, PED.z, 0.95) && (await roster()).rows.includes('pa:pa#2*'), '7. reload: the roster still lists pa#2 at bed pa')
  await shot('m124-7-reload')
  // 8. the site path (owner, Creative mode, desktop)
  ok(!!KEY, '8. an OWNER_KEY for the owner step')
  if (KEY) {
    const o = await (await br.createBrowserContext()).newPage(); await o.setViewport({ width: 1280, height: 900 }); o.on('pageerror', e => errs.push('site: ' + String(e).slice(0, 200))); o.on('dialog', d => d.accept())
    await o.evaluateOnNewDocument('window.__name = (f) => f')
    await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {})
    await o.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
    const snap = () => o.evaluate(async () => { const r = await fetch('/shimmer/save-builder?map=glade', { cache: 'no-store' }); return r.ok ? r.text() : '' })
    const before = await snap(); ok(!!before, '8. owner: the Glade builder answers')
    await o.evaluateOnNewDocument((body: string) => { const f = window.fetch.bind(window); window.fetch = (u, i) => (String(u).includes('save-builder') && (i?.method ?? 'GET').toUpperCase() === 'POST') ? Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })) : f(u, i) }, before)
    await o.goto(`${url}/shimmer/dev?mode=creative&map=glade`, { waitUntil: 'load', timeout: 240000 })
    await o.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "glade"', { timeout: 240000, polling: 500 })
    const zones = () => o.evaluate('window.__terrain.zones()') as Promise<{ id: string; x0: number; x1: number; build: { id: string; item: string; q: number }[] }[]>
    const had = new Set((await zones()).map(z => z.id))
    await o.keyboard.press('9')
    const px = async (x: number, z: number) => { const c = await o.$eval('[data-testid="terrain-canvas"]', el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height } }); return { x: c.l + (x + GLADE_SIZE / 2) / GLADE_SIZE * c.w, y: c.t + (z + GLADE_SIZE / 2) / GLADE_SIZE * c.h } }
    const a1 = await px(100, -114), a2 = await px(124, -90)
    await o.mouse.move(a1.x, a1.y); await o.mouse.down(); for (let i = 1; i <= 8; i++) { await o.mouse.move(a1.x + (a2.x - a1.x) * i / 8, a1.y + (a2.y - a1.y) * i / 8); await sleep(40) } await o.mouse.up(); await sleep(500)
    const mine = async () => (await zones()).find(z => !had.has(z.id))
    ok(!!(await mine()), '8. a real drag made a building zone')
    await o.click('[data-testid="zone-kind-other"]'); await sleep(200); await o.click('[data-testid="zone-build-open"]'); await sleep(400)
    const W = 24, at = async (lx: number, lz: number) => { const b = await o.$eval('[data-testid="zb-plan"]', el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height } }); const x = b.l + (lx + 1) / (W + 2) * b.w, y = b.t + (lz + 1) / (W + 2) * b.h; await o.mouse.move(x - 3, y - 3); await o.mouse.move(x, y); await sleep(80); await o.mouse.click(x, y); await sleep(250) }
    const n = async () => (await mine())?.build.filter(b => b.item === 'spirit_planter').length ?? -1
    const why = () => o.$eval('[data-testid="zb-why"]', e => e.textContent ?? '')
    await o.click('[data-testid="zb-part-spirit_planter"]')
    for (let i = 0; i < 8; i++) await at(3 + (i % 4) * 5, 4 + Math.floor(i / 4) * 5)
    ok(await n() === 8, `8. 8 Spirit Beds set on the site (${await n()})`)
    await at(12, 18)
    ok(await n() === 8 && (await why()) === CAPPED, `8. the 9th on the site is refused, same line (${await n()} stand: ${await why()})`)
    try { await o.screenshot({ path: `${out}/m124-8-site.png` }) } catch { /* slow frame */ }
    await o.click('[data-testid="zb-part-goldwood_bench"]'); await at(12, 18)
    ok(!!(await mine())?.build.some(b => b.item === 'goldwood_bench'), '8. a bench still sets on that site')
    await o.keyboard.press('Escape'); await sleep(200); await at(3, 4); const q0 = (await mine())!.build[0].q
    await o.click('[data-testid="zb-turn"]'); await sleep(250)
    ok((await mine())!.build[0].q !== q0 && await n() === 8, '8. a standing bed still turns with 8 standing')
    await o.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
    ok(await snap() === before, '8. the Glade draft was never written')
  }
  ok(errs.length === 0, `0 page errors (${errs.join(' | ')})`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS: M124 s1+s2 spirit beds at 390x844 (non-owner): 8 beds, a 9th refused; a bed past its old lock blooms + takes a seed; feature draws one, the unfeatured is out of sight; roster by bed; ask along draws an unfeatured one; an M122 #2 spirit kept over reload')
process.exit(fails ? 1 : 0)
