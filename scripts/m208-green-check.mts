// BETA M208 (Alex 11-26): THE CENTRE GREEN IS WHERE A KEEPER LANDS. Two FRESH anonymous keepers (two browser contexts, never
// anyone's save), each with a folded garden so home is their plot, both in one chord (a stored chord code).
// PASS =
//   1. A loads in: on its plot, standing at the gate on the Green (plot.ts HOME_LANDING, < 1.5 m), facing the gate; the Green
//      is dressed (window.__green: 2 trunks, 4 lamps)
//   2. A walks off to its start ground and travels home (the fold map's Home): lands at the gate again
//   3. A dies in the Wilds (__ather.fall = the fight's 'down'): the fold sets it down at the gate on the Green
//   4. B (A's chordmate) visits A (?visit=<A>): B stands on A's ground at the gate on the Green (the host's Green)
//   5. 0 page errors. Shots: <out>/<390|desk>-*.png
// Hooks: __ather.state / zone / travel / tp / fall, __mp.zone, __green READ; __ather.fall + tp to drive.
//   npx tsx scripts/m208-green-check.mts [--url https://ather.games] [--phone] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { HOME_LANDING, GATE, GATE_FACE, THRESHOLD } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp'), PHONE = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
await import('node:fs').then(fs => fs.mkdirSync(out, { recursive: true }))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(700) } return false }
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const CHORD = `m208${Math.random().toString(36).slice(2, 7)}`
const tag = PHONE ? 390 : 'desk'
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /(click|tap) to (play|start)/i.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.display = 'none' })
const shot = async (p: Page, n: string) => { await hideCard(p); try { await p.screenshot({ path: `${out}/${tag}-${n}.png` }) } catch { /* slow frame */ } }
const ctx = async (who: string): Promise<Page> => {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(`${who}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((tut: unknown, chord: string) => {
    if (sessionStorage.getItem('m208')) return; sessionStorage.setItem('m208', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify(tut)); localStorage.setItem('ather:mp:party', chord)
  }, TUT, CHORD)
  return p
}
const load = async (p: Page, q: string) => {
  await p.goto(`${url}/shimmer/open/ather?hour=14&mp=on${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel && !!(window as any).__ather?.state && !!(window as any).__mp, { timeout: 240000, polling: 1000 })
}
const zone = (p: Page) => p.evaluate(() => (window as any).__ather.zone()) as Promise<string>
const at = (p: Page) => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px as number, z: s.pz as number, yaw: s.yaw as number } })
const offLanding = async (p: Page) => { const s = await at(p); return Math.hypot(s.x - HOME_LANDING.x, s.z - HOME_LANDING.z) }
const landed = (p: Page, ms = 60000) => poll(async () => (await zone(p)) === 'plot' && (await offLanding(p)) < 1.5, ms)
const yawOff = (y: number) => Math.abs(Math.atan2(Math.sin(y - HOME_LANDING.yaw), Math.cos(y - HOME_LANDING.yaw)))
const green = (p: Page) => p.evaluate(() => (window as any).__green ?? null) as Promise<{ trunks: number; lamps: number } | null>
try {
  const A = await ctx('A'), B = await ctx('B')
  // 1 · load in
  await load(A, '')
  ok(await landed(A), `1. A loads in at the gate on the Green (${(await offLanding(A)).toFixed(2)} m off the landing; old start point was ${Math.hypot(THRESHOLD.x - HOME_LANDING.x, THRESHOLD.z - HOME_LANDING.z).toFixed(0)} m away)`)
  { const s = await at(A); ok(yawOff(s.yaw) < 0.2, `1. ...facing the gate (yaw ${s.yaw.toFixed(2)} vs ${HOME_LANDING.yaw.toFixed(2)})`) }
  const g = await green(A)
  ok(g && g.trunks === 2 && g.lamps === 4, `1. the Green is dressed (${JSON.stringify(g)})`)
  await sleep(2500); await shot(A, 'a-landed')
  // a wider look at the Green: out past the threshold stone, facing the gate
  const face = { x: Math.sin(GATE_FACE), z: Math.cos(GATE_FACE) }, V = { x: GATE.x + face.x * 13 + face.z * 4, z: GATE.z + face.z * 13 - face.x * 4 }
  await A.evaluate((v: { x: number; z: number }, yaw: number) => (window as any).__ather.tp(v.x, v.z, yaw), V, Math.atan2(-(GATE.x - V.x), -(GATE.z - V.z))); await sleep(2500)
  await shot(A, 'b-green')
  // 2 · travel home from the start ground
  await A.evaluate((t: { x: number; z: number }) => (window as any).__ather.tp(t.x, t.z), THRESHOLD); await sleep(1500)
  ok((await offLanding(A)) > 50, `2. A walked off to its start ground (${(await offLanding(A)).toFixed(0)} m from the landing)`)
  await A.evaluate(() => (window as any).__ather.travel({ kind: 'home' }))
  ok(await landed(A, 20000), `2. travel home lands at the gate on the Green (${(await offLanding(A)).toFixed(2)} m)`)
  // 3 · die in the Wilds
  await load(A, '&waymark=greg')
  ok(await poll(async () => (await zone(A)) === 'wilds', 240000), '3. A is out in the Wilds')
  ok(await poll(() => A.evaluate(() => typeof (window as any).__ather?.fall === 'function'), 60000), '3. the fight is up (__ather.fall)')
  await sleep(3000); await A.mouse.click(PHONE ? 195 : 640, PHONE ? 420 : 400); await sleep(800)   // the sim runs once play is clicked (as death-check)
  await A.evaluate(() => (window as any).__ather.fall())
  ok(await landed(A, 30000), `3. after the death the fold sets A down at the gate on the Green (${await zone(A)}, ${(await offLanding(A)).toFixed(2)} m)`)
  await sleep(2000); await shot(A, 'c-respawn')
  // 4 · B visits A: the host's Green
  const idA = await A.evaluate(() => localStorage.getItem('ather:mp:id'))
  ok(await poll(async () => (await A.evaluate(() => (window as any).__mp.zone())) === `open:plot:${idA}`, 90000), `4. A hosts its plot (${await A.evaluate(() => (window as any).__mp.zone())})`)
  await load(B, `&visit=${idA}&vn=A`)
  ok(await poll(async () => (await B.evaluate(() => (window as any).__mp.zone())) === `open:plot:${idA}`, 90000), `4. B is on A's ground (${await B.evaluate(() => (window as any).__mp.zone())})`)
  ok(await landed(B, 30000), `4. B lands at the gate on the HOST's Green (${(await offLanding(B)).toFixed(2)} m)`)
  await sleep(2500); await shot(B, 'd-guest')
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `5. 0 page errors (${errs.slice(0, 3).join(' | ')})`)
await br.close()
console.log(fails.length ? `FAIL ${fails.length}` : 'ALL PASS')
process.exit(fails.length ? 1 : 0)
