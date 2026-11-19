// Check: BETA M34 SHARED LAYERS on today's Hollow body (sprites 11-19, CANON design-briefs/hollows.md). Phone viewport.
//   (the material rules, no emissive + a borrowed envMap, are ather/hollow-goop.test.ts)
//   • drips shed (the Sheds instanced mesh is drawn), a hit flings a lump + knocks it back
//   • dispersal: a kill leaves the sag + the ground-colour ring where it stood
//   • draw calls per Hollow (shambler, floater), and shots at 30 m and close for before/after
// npx tsx scripts/hollow-look-check.mts [--url U] [--out DIR] [--tag before|after]. Log to a FILE: slow on the box.
import puppeteer from 'puppeteer-core'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const URL = flag('--url', 'https://ather.games'), OUT = flag('--out', '/tmp'), TAG = flag('--tag', 'after')
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* sandboxed frame */ } })
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const poll = async (fn: () => Promise<boolean>, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
const A = (fn: string) => p.evaluate(`(window.__ather.${fn})`)

await p.goto(`${URL}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 }); await wait(2000)
await p.touchscreen.tap(195, 420); await wait(800)
for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) { await p.evaluate((w) => (window as any).__ather.travel({ kind: 'waymark', w }), GREG_WAYMARK as any); await wait(4000) }
await wait(8000)
// out of the Glade's safe ring, on open ground, and clear the field
await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), GREG_WAYMARK.x + 70, GREG_WAYMARK.z + 10); await wait(6000)
ok(await poll(async () => typeof (await p.evaluate(() => typeof (window as any).__ather?.combat)) === 'string' && !!(await p.evaluate(() => (window as any).__ather.combat?.())), 60000), 'the fight layer is up in the Wilds')
await p.evaluate(() => { (window as any).__ather.combat().hollows.length = 0 }); await wait(1500)
const calls = async () => { let s = 0; for (let k = 0; k < 3; k++) { s += await p.evaluate(() => (window as any).__ather.calls?.() ?? -1); await wait(300) } return s / 3 }
// draw calls per Hollow: an EMPTY field (strays well up on infected ground, so clear it right before each read), then SIX at once
const per = async (kind: string) => {
  await p.evaluate(() => { (window as any).__ather.combat().hollows.length = 0 }); await wait(900)
  const a = await calls()
  await p.evaluate((k: string) => { const A = (window as any).__ather; A.combat().hollows.length = 0; for (let i = 0; i < 6; i++) A.spawn(-5 + i * 2, -12, k) }, kind); await wait(900)
  const n = await p.evaluate(() => (window as any).__ather.combat().hollows.length)
  const b = await calls()
  return { a, b, n, each: (b - a) / Math.max(1, n) }
}
const sh = await per('shambler'), fl = await per('floater')
console.log(`   draw calls per Hollow: shambler ${sh.each.toFixed(1)} (${sh.a.toFixed(0)} -> ${sh.b.toFixed(0)}, ${sh.n} up) · floater ${fl.each.toFixed(1)} (${fl.a.toFixed(0)} -> ${fl.b.toFixed(0)}, ${fl.n} up)`)
ok(sh.a >= 0 && sh.each > 0 && sh.each <= 6 && fl.each > 0 && fl.each <= 6, 'a Hollow costs a handful of draw calls (budget 6)')
// one shambler 30 m ahead: the phone's 30 m read
await p.evaluate(() => { (window as any).__ather.combat().hollows.length = 0 }); await wait(500)
await p.evaluate(() => (window as any).__ather.spawn(0, -30, 'shambler')); await wait(3000)
await p.screenshot({ path: `${OUT}/hollow-30m-${TAG}.png` })
// close up: in front of the keeper, then a hit, then a kill
await p.evaluate(() => { (window as any).__ather.combat().hollows.length = 0 }); await wait(800)
await p.evaluate(() => (window as any).__ather.spawn(0, -6, 'shambler')); await wait(2500)
await p.screenshot({ path: `${OUT}/hollow-close-${TAG}.png` })
await p.evaluate(() => { const h = (window as any).__ather.combat().hollows[0]; if (h) h.hitFlash = 0.2 }); await wait(300)
await p.screenshot({ path: `${OUT}/hollow-hit-${TAG}.png` })
await wait(1500)
// kill the NEAREST one (strays well up on infected ground, so [0] is not necessarily the one in front of you)
const near = () => p.evaluate(() => { const A = (window as any).__ather, c = A.camAim(), hs = A.combat().hollows as any[]; let b: any = null, d = 1e9
  for (const h of hs) { const k = Math.hypot(h.x - c.cx, h.z - c.cz); if (k < d) { d = k; b = h } } return b ? { id: b.id as number, d } : null })
await p.evaluate(() => { (window as any).__ather.combat().hollows.length = 0 }); await wait(600)   // an empty field: nothing stands over the spot
await p.evaluate(() => (window as any).__ather.spawn(0, -6, 'shambler')); await wait(1500)
const victim = await near()
// kill it the real way: a round from the camera straight through it (setting hp=0 is swept by the sim with no event)
await p.evaluate((id: number) => { const A = (window as any).__ather, C = A.combat(), h = C.hollows.find((k: any) => k.id === id), c = A.camAim(); if (!h) return
  h.hp = 1; const dx = h.x - c.cx, dy = h.y + 1 - c.cy, dz = h.z - c.cz, L = Math.hypot(dx, dy, dz)
  C.rounds.push({ x: c.cx + dx / L, y: c.cy + dy / L, z: c.cz + dz / L, vx: dx / L * 120, vy: dy / L * 120, vz: dz / L * 120, life: 1, dmg: 50, crit: 50 }) }, victim?.id ?? -1)
ok(await poll(async () => ((await p.evaluate(() => (window as any).__ather.dispersing?.() ?? [])) as unknown[]).length > 0, 3000), 'the kill queues a dispersal where it stood')
await poll(async () => ((await p.evaluate(() => (window as any).__ather.dispersing?.() ?? [])) as unknown[]).length === 0, 8000)
{ const d = await p.evaluate(() => (window as any).__ather.dispersed?.() ?? null) as { sagFrames: number; ringPeak: number } | null
  ok(!!d && d.sagFrames > 0 && d.ringPeak > 0.3, `the dispersal DREW: the goop sagging (${d?.sagFrames} frames), then the ground's colour rising (peak ${d?.ringPeak.toFixed(2)})`) }
await p.screenshot({ path: `${OUT}/hollow-die-${TAG}.png` })
await wait(250); await p.screenshot({ path: `${OUT}/hollow-die2-${TAG}.png` })
await wait(250); await p.screenshot({ path: `${OUT}/hollow-die3-${TAG}.png` })
ok(!!victim && !(await p.evaluate((id: number) => (window as any).__ather.combat().hollows.some((k: any) => k.id === id), victim.id)), `the kill path ran on the nearest Hollow (${victim?.d.toFixed(1)} m): the sim dropped it`)
ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join(' | ')})`)
console.log(fails ? `HOLLOW LOOK CHECK: ${fails} FAIL` : 'HOLLOW LOOK CHECK: PASS')
await br.close()
process.exit(fails ? 1 : 0)
