// BETA M208 s2b: A FULL CHORD ON ONE PLOT. Four FRESH anonymous keepers (never anyone's save), all folded, one chord code. A hosts;
// B and C visit A one after another (?visit=<A>): each gets A's plot (the snapshot) on the first try and stands on its free spot,
// while the guest before it stays. D is a FOURTH keeper on the chord code: a chord is three (canon glossary › Chord, 'three to
// a door'; shimmer-server lobby.py SEATS = 3), so the lobby is full and D's visit is refused. Built to isolate 11-26's
// "the 4th keeper's visit fails" (m208-four-check) from signed-in keepers, the db and the box's load: that was this cap.
// PASS = 1. A hosts its plot · B, C: on A's ground, snapshot in, no end:*, on freeLanding(its id) < 1.2 m
//   D: refused:not-home, never on A's ground · 5. A lists both guests · 6. 0 page errors. Prints each visit log + the net probes.
//   npx tsx scripts/m208-guests-check.mts [--url https://ather.games] [--phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { freeLanding } from '../src/app/shimmer/open/ather/green-landing'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(700) } return false }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const CHORD = `m2g${Math.random().toString(36).slice(2, 7)}`
const ctx = async (who: string): Promise<Page> => {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(`${who}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((tut: unknown, chord: string) => {
    if (sessionStorage.getItem('m2g')) return; sessionStorage.setItem('m2g', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify(tut)); localStorage.setItem('ather:mp:party', chord)
  }, TUT, CHORD)
  return p
}
const load = async (p: Page, q: string) => {
  await p.goto(`${url}/shimmer/open/ather?hour=14&mp=on${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__mp, { timeout: 240000, polling: 1000 })
}
const mpZone = (p: Page) => p.evaluate(() => (window as any).__mp.zone() as string | null)
const at = (p: Page) => p.evaluate(() => { const s = (window as any).__ather.state(); return { zone: (window as any).__ather.zone() as string, x: s.px as number, z: s.pz as number } })
const vis = (p: Page) => p.evaluate(() => { const v = (window as any).__visit; return { log: v?.log?.() ?? null, snap: v?.hasSnap?.() ?? null, net: v?.net?.() ?? null, vis: document.visibilityState } })
try {
  const A = await ctx('A'); await load(A, '')
  ok(await poll(async () => /^open:plot:p_/.test((await mpZone(A)) ?? ''), 90000), `1. A hosts its plot (${await mpZone(A)})`)
  const idA = ((await mpZone(A)) ?? '').replace('open:plot:', '')
  const guests: Page[] = []
  for (const name of ['B', 'C']) {
    const P = await ctx(name); guests.push(P)
    const t0 = Date.now(); await load(P, `&visit=${idA}&vn=A`)
    const there = await poll(async () => (await mpZone(P)) === `open:plot:${idA}` && (await vis(P)).snap === true, 90000)
    const v = await vis(P)
    console.log(`  ${name}: ${((Date.now() - t0) / 1000).toFixed(0)} s, log ${JSON.stringify(v.log)}, net ${JSON.stringify(v.net)}, ${v.vis}; host net ${JSON.stringify((await vis(A)).net)}`)
    ok(there && !(v.log ?? []).some((e: string) => e.startsWith('end:')), `${name}. on A's ground with A's plot (${await mpZone(P)}, snapshot ${v.snap})`)
    const id = await P.evaluate(() => localStorage.getItem('ather:mp:id')), want = freeLanding(id ?? '')
    ok(await poll(async () => { const s = await at(P); return s.zone === 'plot' && Math.hypot(s.x - want.x, s.z - want.z) < 1.2 }, 30000), `${name}. on its free spot`)
    for (const [i, G] of guests.entries()) { const g = await vis(G); if ((g.log ?? []).some((e: string) => e.startsWith('end:'))) ok(false, `guest ${i} left: ${JSON.stringify(g.log)}`) }
  }
  const D = await ctx('D'); await load(D, `&visit=${idA}&vn=A`)
  ok(await poll(async () => ((await vis(D)).log ?? []).includes('refused:not-home'), 90000), `D. a 4th on the chord code is refused: the chord is three (${JSON.stringify((await vis(D)).log)})`)
  ok((await mpZone(D)) !== `open:plot:${idA}` && (await vis(D)).snap !== true, `D. ...never on A's ground (${await mpZone(D)})`)
  ok(await poll(async () => (await A.evaluate(() => (window as any).__visit.guests().length)) >= 2, 20000), `5. A lists both guests (${await A.evaluate(() => (window as any).__visit.guests().length)})`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `6. 0 page errors (${errs.slice(0, 3).join(' | ')})`)
await br.close()
console.log(fails.length ? `FAIL ${fails.length}` : 'ALL PASS')
process.exit(fails.length ? 1 : 0)
