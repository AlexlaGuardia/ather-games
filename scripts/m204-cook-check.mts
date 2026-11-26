// ── BETA M204 s1 + M207 THE ELEMENT COMES FROM COOKING: OWNER + ?spirits=3d (2026-11-26, play-M204cook; M207 world-M207) ───
// Alex 11-26: the four INFUSIONS are made at the alchemy set (M207: Aqual Sauce = Shimmerscale + Aqual at the Crusher, Fuli
// Powder = Fuli at the Crusher, Golden Tonic = Goldleaf + Dinloid at the Still, Storm Broth = Stormgrass + Rhyloid at the
// Cauldron Nook), an infusion + a Shimmerscale is cooked into its element's meal at the hearth, the meal FED to a spirit fills
// one slot of a 10-slot bar by her name in the element's colour; it never resets or changes; 3 meals of one element + M201's
// stat bar = she evolves; 10 = the bar is full and locked. ASSERTS MOVED (M207): phase A was "grind Rootvine -> Earth Spice";
// it is now the four infusions at three stations + an OLD SAVE's Earth Spice loading as a Golden Tonic.
// SETUP (stated): bag = 5 Shimmerscale + 1 Shimmerscale Scales (M206: the sauce grinds the scales), 1 each Aqual / Fuli / Dinloid / Rhyloid, 1 Goldleaf (B), 1 Stormgrass (C), 1 OLD
// Earth Spice (M204 save), 2 Earth Meals + 4 Water Meals; Crusher Table, Still, Cauldron Nook 4 m apart from (-130, 102.5)
// (phase A), a cooking room at (-100, 100) (phase B), then a bloomed fox planter at (-130, 102.5) in the party (phase C). Her
// stat record: 30 growths + 5 GRD played, so the Earth form's GRD bar is met (asserted in the panel first).
//  A. E at each station: its infusions listed and makeable; Make -> the infusion in the bag, its inputs spent. The old Earth
//     Spice reads as a Golden Tonic (2 with the Still's). Rootvine is nowhere in the bag.
//  B. E at the hearth: Cook each element's meal from its infusion + a scale; Focus; collect -> +1 Mana, +1 Storm, +2 Earth,
//     +1 Water Meal.
//  C. Her panel: bar 10 empty; feed Mana -> slot 0 mana colour, Storm -> slot 1 storm colour; reload: still there. Three Earth
//     meals: the 3rd earth evolves her (panel data-form-element=earth). Water meals: slot water colour, earlier slots never
//     change, the element stays earth; at 10 the bar is locked and no feed button shows. 390 wide, 0 page errors.
//   npx tsx scripts/m204-cook-check.mts [--url http://localhost:3202] [--out docs/looks/m207-2026-11-26]
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { secondFormName } from '../src/app/shimmer/spirits/evolution'
import { ELEMENT_COLORS } from '../src/app/shimmer/spirits/spirit'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m207-2026-11-26')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const STATIONS = [{ id: 'm207-crusher', item: 'alc_mortar', at: 'crusher', els: ['mana', 'water'] }, { id: 'm207-still', item: 'alc_still', at: 'still', els: ['earth'] }, { id: 'm207-nook', item: 'alc_mixer', at: 'nook', els: ['storm'] }]
  .map((s, k) => ({ ...s, piece: { id: s.id, item: s.item, x: P.x + 4 * k, z: P.z, q: 0, placedAt: 1 } }))
const PLANTER = { id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
const ROOM: Room = { id: 'm204-cook', kind: 'cooking', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [] }
const REC = { form: 'base', g: { grd: 5 }, plays: 5, xp: 0, grown: 30 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); process.exit(1) }
  await p.evaluateOnNewDocument((piece: unknown, at: number, rec: unknown) => {
    if (sessionStorage.getItem('m204')) return; sessionStorage.setItem('m204', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null)
    const put: [string, number][] = [['waymark', 12], ['shimmerscale', 5], ['shimmerscale_scales', 1], ['water_crystal', 1], ['violet_crystal', 1], ['earth_crystal', 1], ['storm_crystal', 1],
      ['crop:goldleaf:B', 1], ['crop:stormgrass:C', 1], ['earth_spice', 1], ['earth_meal', 2], ['water_meal', 4]]
    put.forEach(([id, n], k) => { slots[k] = { id, n } })
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: piece }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: { 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true } }, met: [] }))
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check']))
    localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['vx-check']))
    localStorage.setItem('ather.spiritStats.v1', JSON.stringify({ 'vx-check': rec }))
  }, STATIONS.map(s => s.piece), Date.now() - BLOOM_MS - 60000, REC)
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
  const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
  const load = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500) }
  const setWorks = (w: unknown) => p.evaluate(v => localStorage.setItem('open.works.v1', JSON.stringify(v)), w)

  // ── A. the four infusions at their stations
  await load()
  const NAME = { mana: 'fuli_powder', water: 'aqual_sauce', earth: 'golden_tonic', storm: 'storm_broth' } as Record<string, string>
  for (const st of STATIONS) {
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), st.piece.x, st.piece.z + 1.3); await sleep(2000)
    await aimAt(p, st.piece.x, st.piece.z, 0.5); await p.keyboard.press('e'); await sleep(1200)
    const listed = await p.evaluate(() => [...document.querySelectorAll('[data-panel="alchemy"] [data-infusion]')].map(e => `${e.getAttribute('data-infusion')}:${e.getAttribute('data-can')}`).join())
    ok(listed === st.els.map(e => `${e}:1`).join(), `A the ${st.at} lists ${st.els.join(' + ')}, makeable (${listed})`)
    await shot(`a-${st.at}`)
    for (const el of st.els) {
      const before = await bag()
      await click(`[data-infusion="${el}"] [data-act="infusion-make"] button`); await sleep(800)
      const after = await bag()
      ok((after[NAME[el]] ?? 0) === (before[NAME[el]] ?? 0) + 1, `A ${st.at}: Make ${NAME[el]} -> +1 (${before[NAME[el]] ?? 0} -> ${after[NAME[el]] ?? 0})`)
    }
    await p.keyboard.press('Escape'); await sleep(500)
  }
  const a = await bag()
  ok(a.fuli_powder === 1 && a.aqual_sauce === 1 && a.storm_broth === 1 && a.golden_tonic === 2, `A bag: 1 Fuli Powder, 1 Aqual Sauce, 1 Storm Broth, 2 Golden Tonic (the old Earth Spice converted) ${JSON.stringify({ f: a.fuli_powder, aq: a.aqual_sauce, s: a.storm_broth, g: a.golden_tonic })}`)
  ok(!a.earth_spice && !a.water_crystal && !a.violet_crystal && !a.earth_crystal && !a.storm_crystal && !a['crop:goldleaf:B'] && !a['crop:stormgrass:C'] && !a.shimmerscale_scales && a.shimmerscale === 5,
    `A the inputs spent (gems, Goldleaf, Stormgrass, the Shimmerscale scales (M206); 5 Shimmerscale left: ${a.shimmerscale}); no spice left`)
  ok(!Object.keys(a).some(k => k.includes('rootvine')), 'A no Rootvine anywhere in the bag')

  // ── B. the hearth cooks the spice + a Shimmerscale into an Earth Meal
  await setWorks({ v: 1, rooms: [ROOM], chests: [], pieces: [] }); await load()
  const b = benchOf(ROOM)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.4); await sleep(2000)
  await aimAt(p, b.x, b.z, 0.6); await p.keyboard.press('e'); await sleep(1200)
  const outOf = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.works.v1'))?.rooms?.[0]?.out ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  const MEALS: [string, number][] = [['mana', 1], ['storm', 1], ['earth', 2], ['water', 1]]
  for (const [el, n] of MEALS) {
    ok(await p.evaluate(j => !!document.querySelector(`[data-panel="bench"] [data-job="${j}"]`), `cook-${el}_meal`), `B the hearth lists Cook: ${el} meal`)
    await click(`[data-job-pick="cook-${el}_meal"]`); await sleep(300)
    await click(`[data-src-item="${NAME[el]}"] [data-move="all"]`); await sleep(400)
    if (el === 'mana') { await click('[data-src-item="shimmerscale"] [data-move="all"]'); await sleep(400) }
    await click('[data-qty="max"]'); await sleep(200)
    if (el === 'mana') await shot('b-hearth')
    await click('[data-act="focus"] button')
    ok(await poll(async () => ((await outOf())[`${el}_meal`] ?? 0) === n, 120000), `B the hearth cooked ${n} ${el} meal(s) from ${NAME[el]}`)
    await sleep(400)
  }
  await click('[data-act="collect-all"] button'); await sleep(800)
  const bb = await bag()
  ok(bb.mana_meal === 1 && bb.storm_meal === 1 && bb.earth_meal === 4 && bb.water_meal === 5, `B collected: meals mana 1, storm 1, earth 4, water 5 (${JSON.stringify({ m: bb.mana_meal, s: bb.storm_meal, e: bb.earth_meal, w: bb.water_meal })})`)
  ok(!bb.fuli_powder && !bb.aqual_sauce && !bb.storm_broth && !bb.golden_tonic, 'B every infusion went into a meal')
  await p.keyboard.press('Escape'); await sleep(500)

  // ── C. feed her
  await setWorks({ v: 1, rooms: [], chests: [], pieces: [PLANTER] }); await load()
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
  type Pan = { bar: string[]; slots: { el: string; bg: string }[]; locked: string; formEl: string | null; formName: string | null; earthMet: string | null; feeds: string[]; w: number; overflow: boolean }
  const readPanel = () => p.evaluate(() => {
    const pn = document.querySelector<HTMLElement>('[data-panel="spirit"]'); if (!pn) return null
    const bar = pn.querySelector('[data-meal-bar]'), r = pn.getBoundingClientRect(), fe = pn.querySelector('[data-form-element]')
    return { bar: (bar?.getAttribute('data-meal-bar') ?? '').split(',').filter(Boolean), slots: [...pn.querySelectorAll('[data-meal-slot]')].map(s => ({ el: s.getAttribute('data-meal-el') ?? '', bg: getComputedStyle(s).backgroundColor })),
      locked: bar?.getAttribute('data-meal-locked') ?? '', formEl: fe?.getAttribute('data-form-element') ?? null, formName: fe?.getAttribute('data-form-name') ?? null,
      earthMet: pn.querySelector('[data-form-bar="earth"]')?.getAttribute('data-form-met') ?? null,
      feeds: [...pn.querySelectorAll('[data-feed-meal]')].map(x => x.getAttribute('data-feed-meal')!), w: r.width, overflow: r.right > innerWidth + 0.5 || r.left < -0.5 }
  }) as Promise<Pan | null>
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].length)
  async function openPanel(): Promise<Pan | null> {
    for (let k = 0; k < 10; k++) {
      await sleep(3000)
      const t = await p.evaluate(() => { const q = (window as any).__spiritModel?.trots?.fox; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }) as { x: number; z: number; y: number; h: number } | null
      if (!t) { await sleep(500); continue }
      await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
      await p.keyboard.press('e'); await sleep(900)
      if (await opts()) {
        const picked = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace('›', '').trim().startsWith('Open')) as HTMLButtonElement | undefined; b?.click(); return !!b })
        if (!picked) return null
        await sleep(2000)
        return readPanel()
      }
      await p.keyboard.press('Escape'); await sleep(400)
    }
    return null
  }
  const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})` }
  const c0 = await openPanel()
  ok(!!c0 && c0.slots.length === 10 && c0.bar.length === 0, `C her panel: a 10-slot bar, empty (${c0?.slots.length}, ${c0?.bar.join()})`)
  ok(c0?.earthMet === '1', `C setup: her Earth form's stat bar is met (${c0?.earthMet})`)
  ok(!!c0 && c0.feeds.includes('earth_meal') && c0.feeds.includes('water_meal'), `C feed buttons for the meals in the bag (${c0?.feeds.join()})`)
  await shot('c-0-panel')
  ok(!!c0 && ['mana_meal', 'storm_meal', 'earth_meal', 'water_meal'].every(m => c0.feeds.includes(m)), `C a feed button for each element's meal (${c0?.feeds.join()})`)
  await click('[data-feed-meal="mana_meal"]'); await sleep(900)
  await click('[data-feed-meal="storm_meal"]'); await sleep(900)
  const c1 = await readPanel()
  ok(!!c1 && c1.bar.join() === 'mana,storm' && c1.slots[0].bg === hex(ELEMENT_COLORS.mana) && c1.slots[1].bg === hex(ELEMENT_COLORS.storm) && c1.slots[2].el === '', `C fed Mana + Storm: slot 0 mana, slot 1 storm, in their colours (${c1?.slots[0].bg}, ${c1?.slots[1].bg})`)
  ok(!!c1 && c1.formEl === null, 'C two meals: no form yet')
  await shot('c-1-fed')
  await p.keyboard.press('Escape'); await sleep(600)
  // reload: the bar survives
  await load()
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
  const c2 = await openPanel()
  ok(!!c2 && c2.bar.join() === 'mana,storm', `C after a reload: the bar still reads mana,storm (${c2?.bar.join()})`)
  for (let k = 0; k < 3; k++) { await click('[data-feed-meal="earth_meal"]'); await sleep(k === 2 ? 1500 : 900) }
  const c3 = await readPanel()
  const name = secondFormName({ species: 'fox' }, 'earth')
  ok(!!c3 && c3.bar.join() === 'mana,storm,earth,earth,earth' && c3.slots[2].bg === hex(ELEMENT_COLORS.earth), `C three Earth meals, earth colour (${c3?.bar.join()})`)
  ok(!!c3 && c3.formEl === 'earth' && c3.formName === name, `C the 3rd Earth meal with her bar met: she evolves, panel says ${c3?.formName} (want ${name})`)
  await shot('c-2-evolved')
  let prev = c3?.bar ?? [], stable = true, stays = true
  for (let k = 0; k < 5; k++) {
    await click('[data-feed-meal="water_meal"]'); await sleep(900)
    const c = await readPanel(); if (!c) { stable = false; break }
    if (c.bar.length !== prev.length + 1 || prev.some((m, i) => c.bar[i] !== m)) stable = false
    if (c.formEl !== 'earth') stays = false
    prev = c.bar
  }
  const c4 = await readPanel()
  ok(stable && prev.join() === 'mana,storm,earth,earth,earth,water,water,water,water,water', `C five Water meals: each takes the next slot, no earlier slot changes (${prev.join()})`)
  ok(!!c4 && c4.slots[9].bg === hex(ELEMENT_COLORS.water), `C a water slot in the water colour (${c4?.slots[9].bg})`)
  ok(stays, 'C her element stays earth (never changes)')
  ok(!!c4 && c4.locked === '1' && c4.feeds.length === 0, `C 10 meals: the bar is locked, no feed button (${c4?.locked}, ${c4?.feeds.join()})`)
  ok(!!c4 && !c4.overflow && c4.w <= 390, `C the panel fits 390 wide (${c4?.w.toFixed(0)} px)`)
  await shot('c-3-locked')
  // every grimoire key on this profile (a garden key may be prefixed): the one holding her bar
  const saved = await p.evaluate(() => Object.keys(localStorage).filter(x => x.endsWith('ather.grimoire.v1'))
    .map(k => JSON.parse(localStorage.getItem(k)!)?.pots?.['vx-check']).filter(Boolean)
    .sort((x, y) => (y.meals?.length ?? 0) - (x.meals?.length ?? 0))[0] ?? null) as { meals?: string[]; element?: string } | null
  ok(!!saved && saved.element === 'earth' && (saved.meals ?? []).length === 10, `C saved: element ${saved?.element}, ${saved?.meals?.length} meals`)
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
