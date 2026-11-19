// Check: BETA M32 GREG'S TOUR (Alex 11-19), on a PHONE viewport. A born keeper (Star, first errand open) asks Greg 'Tell me
// about the Ather': he gets up and WALKS to each stop (greg-tour.ts), waits for the keeper, one bubble per stop; the last
// stop's answer ends the tour and goes straight into his send-off (the gems, where he stands). A second tour is SKIPPED at
// its second stop: he walks back to his bench and sits. A third is skipped MID-WALK with Esc.
// Lines are @lark placeholders: imported, never retyped. Stops parked on Magii (the show garden) are not checked.
// npx tsx scripts/tour-check.mts  (URL= to point elsewhere, e.g. http://localhost:3202). Log to a FILE: it is slow on the box.
import puppeteer from 'puppeteer-core'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
import { tourStops, TOUR_ASK, TOUR_NEXT, TOUR_SKIP, TOUR_DONE } from '../src/app/shimmer/open/ather/greg-tour'
import { gregSpot } from '../src/app/shimmer/open/ather/moonwell-glade'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.removeItem('open.inv.v1'); localStorage.removeItem('open.loadout.v1'); localStorage.removeItem('open.errand.v1') } })
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
for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) { await p.evaluate((w) => (window as any).__ather.travel({ kind: 'waymark', w }), GREG_WAYMARK as any); await wait(4000) }
ok(await poll(async () => !!(await greg()), 120000), 'Greg is drawn at the Glade')
await wait(8000)
const S = gregSpot(), stops = tourStops()
const nearGreg = async () => { const g = await greg(); if (g) await tp(g.x + 1.4, g.z + 1.4) }
const startTour = async (tag: string) => {
  await tp(S.x + 1.2, S.z + 1.2); await wait(2500)
  await p.keyboard.press('KeyE')
  if (!(await poll(async () => (await answers()).includes(TOUR_ASK), 15000))) { ok(false, `${tag}: '${TOUR_ASK}' is one of Greg's first answers (${(await answers()).join(' / ')})`); return false }
  ok(true, `${tag}: '${TOUR_ASK}' is one of Greg's first answers`)
  return pick(TOUR_ASK)
}

// ── TOUR 1: every stop, then into the send-off ──────────────────────────────────────────────────────────────────────────
if (await startTour('tour 1')) {
  ok(!(await p.$('[data-talk-choices]')), 'tour 1: the talk closes; the keeper is free to walk along')
  ok(await poll(async () => (await greg())?.pose === 'stand', 20000), 'tour 1: Greg gets up off the bench')
  ok(await poll(async () => (await greg())?.action === 'walk', 20000), 'tour 1: he WALKS (the rig strides)')
  for (let i = 0; i < stops.length; i++) {
    const at = await poll(async () => { await nearGreg(); return !!(await greg())?.tour?.talk && (await greg())!.tour!.i === i }, 600000)
    const g = await greg(), d = g ? Math.hypot(g.x - stops[i].at.x, g.z - stops[i].at.z) : 99
    ok(at && d < 0.05, `tour 1 stop ${i} (${stops[i].id}): he stands ON the stop (${d.toFixed(2)} m off) and talks`)
    ok(await poll(async () => (await bubble()).includes(stops[i].line), 8000), `tour 1 stop ${i}: his bubble is that stop's line`)
    const a = await answers(), last = i === stops.length - 1
    ok(last ? a.join() === TOUR_DONE : a.includes(TOUR_NEXT) && a.includes(TOUR_SKIP), `tour 1 stop ${i}: answers ${a.join(' / ')}`)
    if (i === 0) await p.screenshot({ path: '/tmp/tour-stop0.png' })
    await pick(last ? TOUR_DONE : TOUR_NEXT); await wait(1200)
  }
  ok(await poll(async () => /Now then/.test(await bubble()), 8000), 'tour 1 end: a first-errand keeper goes straight into his send-off (the gems)')
  { const g = await greg(); ok(!!g && g.pose === 'stand' && Math.hypot(g.x - S.x, g.z - S.z) > 2, 'tour 1 end: he gives it where he stands, not from the bench') }
  ok((await answers()).includes(ANSWERS.more), 'tour 1 end: the send-off answers are his usual ones')
  await p.screenshot({ path: '/tmp/tour-sendoff.png' })
  await p.keyboard.press('Escape'); await wait(800)
  ok(await poll(async () => { const g = await greg(); return g?.pose === 'sit' && Math.hypot(g.x - S.x, g.z - S.z) < 0.05 }, 600000), 'tour 1: talk closed, he walks back to his bench and sits')
}

// ── TOUR 2: skipped at its SECOND stop ──────────────────────────────────────────────────────────────────────────────────
if (await startTour('tour 2')) {
  await poll(async () => { await nearGreg(); return !!(await greg())?.tour?.talk }, 600000); await pick(TOUR_NEXT); await wait(1200)
  const two = await poll(async () => { await nearGreg(); const g = await greg(); return !!g?.tour?.talk && g.tour.i === 1 }, 600000)
  ok(two, 'tour 2: at the second stop')
  ok(await pick(TOUR_SKIP), `tour 2: '${TOUR_SKIP}' skips at the stop`)
  await wait(1200)
  ok(/Now then/.test(await bubble()), 'tour 2: a skip still hands over to the send-off (first errand)')
  await p.keyboard.press('Escape'); await wait(800)
  ok(await poll(async () => { const g = await greg(); return g?.pose === 'sit' && Math.hypot(g.x - S.x, g.z - S.z) < 0.05 }, 600000), 'tour 2: back on his bench')
}

// ── TOUR 3: Esc MID-WALK ────────────────────────────────────────────────────────────────────────────────────────────────
if (await startTour('tour 3')) {
  ok(await poll(async () => (await greg())?.action === 'walk', 20000), 'tour 3: walking')
  await p.keyboard.press('Escape'); await wait(1000)
  ok((await greg())?.tour === null, 'tour 3: Esc mid-walk ends the tour')
  ok(!(await p.$('[data-talk-choices]')), 'tour 3: no talk opens on an Esc')
  ok(await poll(async () => (await greg())?.pose === 'sit', 600000), 'tour 3: he goes back and sits')
}

ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join(' | ')})`)
console.log(fails ? `TOUR CHECK: ${fails} FAIL` : 'TOUR CHECK: PASS')
await br.close()
process.exit(fails ? 1 : 0)
