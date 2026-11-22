// Check: BETA M32 GREG'S TOUR (Alex 11-19), on a PHONE viewport. A born keeper (Star, first errand open) asks Greg 'Tell me
// about the Ather' (his FIRST offer to a newborn): he gets up and WALKS the Glade (Magii fba7186: the Moonwell, each of the
// folk of Greg's garden at home; M67 s1b-2: in the closed Glade, no waymark stop), one bubble per stop, then the fade home to the keeper's planning TABLE: his last answer lights the
// glove (Magii 944ad1d, the ruled word) and goes into the gems. Tour 2 SKIPS at its 2nd stop (straight to the table); tour 3
// is Esc MID-WALK (no travel, back to his bench). Lines are @lark placeholders: imported, never retyped.
// npx tsx scripts/tour-check.mts  (URL= to point elsewhere, e.g. http://localhost:3202). Log to a FILE: it is slow on the box.
import puppeteer from 'puppeteer-core'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
import { tourStops, gloveWordFor, TOUR_ASK, TOUR_NEXT, TOUR_SKIP, TOUR_DONE } from '../src/app/shimmer/open/ather/greg-tour'
import { gregSpot } from '../src/app/shimmer/open/ather/moonwell-glade'
import { aimAt } from './lib/aim.mts'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ather:shimmer:birthRune', 'star'); if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.removeItem('open.inv.v1'); localStorage.removeItem('open.loadout.v1'); localStorage.removeItem('open.errand.v1') } localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))   // M68 s2: this check is the errand, not Greg's tutorial talk (glade-tutorial-check walks that)
 } catch { /* a sandboxed frame: no storage */ } })
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const poll = async (fn: () => Promise<boolean>, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
const greg = () => p.evaluate(() => (window as any).__greg) as Promise<{ x: number; z: number; pose: string; action: string; tour: { i: number; talk: boolean; arrived: number } | null } | undefined>
const bubble = () => p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
const answers = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(e => (e.textContent ?? '').replace('›', '').trim()))
const pick = (label: string) => p.evaluate((t: string) => { const b = [...document.querySelectorAll('[data-talk-option]')].find(e => (e.textContent ?? '').replace('›', '').trim() === t) as HTMLElement | undefined; b?.click(); return !!b }, label)
const tp = (x: number, z: number) => p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), x, z)

await p.goto(`${URL}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 }); await wait(2000)
// get to the Glade (M31: a newborn may already be there; a reload lands on the plot)
// M67 s1b-2: the Glade is the closed Glade zone now (the fold map's 'Moonwell Glade' stop = travel kind 'glade')
for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'glade'; i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await wait(4000) }
ok(await poll(async () => !!(await greg()), 120000), 'Greg is drawn at the Glade')
await wait(8000)
await p.touchscreen.tap(195, 420); await wait(800)   // the phone's 'tap to start' card (a real newborn taps it at birth)
const S = gregSpot(), stops = tourStops()
// follow like a player: ~3.5 m behind Greg, on the far side from what he is walking to / showing
const nearGreg = async () => { const g = await greg(); if (!g) return
  const st = g.tour ? stops[g.tour.i] : null, L = st && st.zone === 'glade' ? st.look : S, a = Math.atan2(g.x - L.x, g.z - L.z)
  await tp(g.x + Math.sin(a) * 3.5, g.z + Math.cos(a) * 3.5) }
const startTour = async (tag: string) => {
  let tries = 0
  for (; tries < 3; tries++) {   // E right after an arrival can land before the walker settles: try again, and SAY so
    await tp(S.x + 1.2, S.z + 1.2); await wait(2500)
    await aimAt(p, S.x, S.z, 1.0)
    await p.keyboard.press('KeyE')
    if (await poll(async () => (await answers()).includes(TOUR_ASK), 10000)) break
  }
  if (tries) console.log(`   note: ${tag} needed ${tries + 1} E presses at Greg`)
  if (!(await answers()).includes(TOUR_ASK)) { ok(false, `${tag}: '${TOUR_ASK}' is one of Greg's first answers (${(await answers()).join(' / ')})`); return false }
  ok(true, `${tag}: '${TOUR_ASK}' is one of Greg's first answers`)
  if (tag === 'tour 1') ok((await answers())[0] === TOUR_ASK, `newborn: the tour is Greg's FIRST offer (${(await answers()).join(' / ')})`)
  return pick(TOUR_ASK)
}

const glove = () => p.evaluate(() => { try { return (JSON.parse(localStorage.getItem('open.loadout.v1') ?? '{}').vessels ?? []).find((v: any) => v.id === 'starter-glove')?.word ?? null } catch { return 'ERR' } })
const zone = () => p.evaluate(() => (window as any).__ather.zone())
const backToGlade = async () => { for (let i = 0; i < 40 && (await zone()) !== 'glade'; i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await wait(4000) } await poll(async () => !!(await greg()), 120000); await wait(6000) }
const glade = stops.filter(x => x.zone === 'glade'), table = stops.length - 1
ok(stops[table].id === 'table' && glade.length === stops.length - 1, `stops: ${stops.map(x => x.id).join(' ')}`)
ok((await glove()) === null, 'a newborn\'s glove is empty before Greg')

// ── TOUR 1: every Glade stop, then the fade home to the table: the glove lights, then the gems ──────────────────────────
if (await startTour('tour 1')) {
    ok(!(await p.$('[data-talk-choices]')), 'tour 1: the talk closes; the keeper is free to walk along')
  ok(await poll(async () => (await greg())?.pose === 'stand', 20000), 'tour 1: Greg gets up off the bench')
  ok(await poll(async () => (await greg())?.action === 'walk', 20000), 'tour 1: he WALKS (the rig strides)')
  for (let i = 0; i < glade.length; i++) {
    const at = await poll(async () => { await nearGreg(); const g = await greg(); return !!g?.tour?.talk && g.tour.i === i }, 600000)
    // the stop as the PAGE has it (blueprint doors move a Moglin: node has no blueprints), and it must stand beside that Moglin as drawn
    const g = await greg() as any, ps = g?.stops?.[i] as { id: string; at: { x: number; z: number }; look: { x: number; z: number } } | undefined
    const d = g && ps ? Math.hypot(g.x - ps.at.x, g.z - ps.at.z) : 99
    ok(at && ps?.id === stops[i].id && d < 0.05, `tour 1 stop ${i} (${stops[i].id}): he stands ON the page's stop (${d.toFixed(2)} m off) and talks`)
    if (ps && stops[i].id.startsWith('folk:')) {
      const f = ((await p.evaluate(() => (window as any).__glade?.folk ?? [])) as { id: string; x: number; z: number }[]).find(q => q.id.endsWith(':' + stops[i].id.slice(5)))
      const fd = f ? Math.hypot(f.x - ps.look.x, f.z - ps.look.z) : 99, gd = f ? Math.hypot(f.x - g.x, f.z - g.z) : 99
      ok(fd < 0.05 && gd < 3, `tour 1 stop ${i}: he shows ${stops[i].id.slice(5)} where they are drawn (${fd.toFixed(2)} m) from beside them (${gd.toFixed(1)} m)`)
    }
    ok(await poll(async () => (await bubble()).includes(stops[i].line), 8000), `tour 1 stop ${i}: his bubble is that stop's line`)
    const a = await answers()
    ok(a.join() === [TOUR_NEXT, TOUR_SKIP].join(), `tour 1 stop ${i}: answers ${a.join(' / ')}`)
    if (i === 1) await p.screenshot({ path: '/tmp/tour-folk.png' })
    await pick(TOUR_NEXT); await wait(1200)
  }
  ok(await poll(async () => (await zone()) === 'plot', 30000), 'tour 1: after the last Glade stop, the fade home to the plot')
  ok(await poll(async () => (await bubble()).includes(stops[table].line), 20000), 'tour 1: Greg at the planning table, his table line')
  ok((await answers()).join() === TOUR_DONE, `tour 1 table: the one answer is ${TOUR_DONE}`)
  await p.screenshot({ path: '/tmp/tour-table.png' })
  await pick(TOUR_DONE); await wait(1500)
  ok((await glove()) === gloveWordFor('star')!.id, `tour 1 end: the glove is lit with the ruled word (${await glove()})`)
  ok(await poll(async () => /Now then/.test(await bubble()), 8000), 'tour 1 end: then straight into his send-off (the gems), at the table')
  ok((await answers()).includes(ANSWERS.more), 'tour 1 end: the send-off answers are his usual ones')
  await p.keyboard.press('Escape'); await wait(800)
  ok(!(await p.$('[data-talk-bubble]')), 'tour 1: talk closed, Greg has gone home')
}

// ── TOUR 2: skipped at its SECOND stop -> the table at once ────────────────────────────────────────────────────────────
await backToGlade()
if (await startTour('tour 2')) {
  await poll(async () => { await nearGreg(); return !!(await greg())?.tour?.talk }, 600000); await pick(TOUR_NEXT); await wait(1200)
  ok(await poll(async () => { await nearGreg(); const g = await greg(); return !!g?.tour?.talk && g.tour.i === 1 }, 600000), 'tour 2: at the second stop')
  ok(await pick(TOUR_SKIP), `tour 2: '${TOUR_SKIP}' at the stop`)
  ok(await poll(async () => (await zone()) === 'plot' && (await bubble()).includes(stops[table].line), 30000), 'tour 2: a skip jumps to the tour\'s end (the table)')
  await pick(TOUR_DONE); await wait(1500)
  ok((await glove()) === gloveWordFor('star')!.id, 'tour 2: the glove keeps its one word (not given twice, not changed)')
  ok(/Now then/.test(await bubble()), 'tour 2: the gems are still offered (not taken yet)')
  await p.keyboard.press('Escape'); await wait(800)
}

// ── TOUR 3: Esc MID-WALK (no travel, back to the bench) ────────────────────────────────────────────────────────────────
await backToGlade()
if (await startTour('tour 3')) {
  ok(await poll(async () => (await greg())?.action === 'walk', 20000), 'tour 3: walking')
  await p.keyboard.press('Escape'); await wait(1000)
  ok((await greg())?.tour === null, 'tour 3: Esc mid-walk ends the tour')
  ok(!(await p.$('[data-talk-choices]')) && (await zone()) === 'glade', 'tour 3: no talk opens and no travel on an Esc')
  ok(await poll(async () => { const g = await greg(); return g?.pose === 'sit' && Math.hypot(g.x - S.x, g.z - S.z) < 0.05 }, 600000), 'tour 3: he walks back to his bench and sits')
}

ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join(' | ')})`)
console.log(fails ? `TOUR CHECK: ${fails} FAIL` : 'TOUR CHECK: PASS')
await br.close()
process.exit(fails ? 1 : 0)
