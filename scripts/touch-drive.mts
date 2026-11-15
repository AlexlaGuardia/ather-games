// ── Phone check for the CONTINENT's touch controls (2026-11-15, hub) ────────────────────────────────────────
// Emulated landscape phone, real touch events. Proves by the courser's / walker's own state: tap starts, the stick
// drives (up = throttle) and steers (sideways), the F pill gets you out when stopped, a right-half drag looks on foot,
// and F gets you back in. Screenshots to --out.   npx tsx scripts/touch-drive.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage()
await p.emulate({ viewport: { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
await p.goto(`${flag('--url', 'https://ather.games')}/shimmer/open/continent`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__drive?.state, { timeout: 180000 })
await wait(4000)
await p.screenshot({ path: `${out}/drive-1-intro.png` })
const car = () => p.evaluate(() => { const s = (window as any).__drive.state(); return { x: s.x, z: s.z, yaw: s.yaw, v: Math.hypot(s.vx, s.vz) } })
const foot = () => p.evaluate(() => (window as any).__drive.foot())
const pill = async (text: string) => {
  const h = await p.evaluateHandle(t => [...document.querySelectorAll('div')].find(d => d.textContent === t) ?? null, text)
  return (await (h as any).boundingBox?.()) ?? null
}
await p.touchscreen.tap(420, 200); await wait(1000)                 // tap to drive
const c0 = await car()
// throttle: thumb down left, push straight up, hold
await p.touchscreen.touchStart(130, 300)
for (let i = 1; i <= 6; i++) { await p.touchscreen.touchMove(130, 300 - i * 10); await wait(30) }
await wait(5000)
const c1 = await car()
// steer: slide the same thumb right while still on the gas
for (let i = 1; i <= 5; i++) { await p.touchscreen.touchMove(130 + i * 10, 240); await wait(30) }
await wait(2500)
await p.screenshot({ path: `${out}/drive-2-driving.png` })
const c2 = await car()
await p.touchscreen.touchEnd()
// stop: hold drift (handbrake) until slow
const drift = await pill('drift')
if (drift) { await p.touchscreen.touchStart(drift.x + drift.width / 2, drift.y + drift.height / 2); await wait(6000); await p.touchscreen.touchEnd() }
// brake: pull the stick down until the courser is slow enough to step out (the swiftshader sim runs ~0.2x, so poll)
await p.touchscreen.touchStart(130, 260)
for (let i = 1; i <= 6; i++) { await p.touchscreen.touchMove(130, 260 + i * 8); await wait(30) }
for (let t = 0; t < 60 && (await car()).v > 1.2; t++) await wait(1000)
await p.touchscreen.touchEnd()
// let go and hold the handbrake so it does not creep (stepping out wants < 1.5 m/s)
const hb = await pill('drift')
if (hb) { await p.touchscreen.touchStart(hb.x + hb.width / 2, hb.y + hb.height / 2); for (let t = 0; t < 40 && (await car()).v > 0.5; t++) await wait(1000); await p.touchscreen.touchEnd() }
await wait(2500)
const vStop = (await car()).v
await p.screenshot({ path: `${out}/drive-3-stopped.png` })
const out1 = await pill('Fget out')
if (out1) await p.touchscreen.tap(out1.x + out1.width / 2, out1.y + out1.height / 2)
await wait(1500)
const f1 = await foot()
// look on foot: drag right half
await p.touchscreen.touchStart(600, 180)
for (let i = 1; i <= 10; i++) { await p.touchscreen.touchMove(600 - i * 20, 180); await wait(60) }
await p.touchscreen.touchEnd(); await wait(800)
await p.screenshot({ path: `${out}/drive-4-foot.png` })
const yawAfter = await p.evaluate(() => (window as any).__drive.foot())
const lookYaw = await p.evaluate(() => { const c = (window as any).__drive; return c })
void lookYaw
// get back in: walk is not needed, stepOut leaves you beside the courser in reach
const in1 = await pill('Fget in')
if (in1) await p.touchscreen.tap(in1.x + in1.width / 2, in1.y + in1.height / 2)
await wait(1500)
const f2 = await foot()
const r = {
  drove: +Math.hypot(c1.x - c0.x, c1.z - c0.z).toFixed(1), speedAt5s: +c1.v.toFixed(1), steered: +(c2.yaw - c1.yaw).toFixed(2),
  driftPill: !!drift, stoppedV: +vStop.toFixed(2), gotOut: f1.mode === 'foot', gotIn: f2.mode === 'drive', getInPill: !!in1,
}
console.log(JSON.stringify(r))
void yawAfter
const ok = r.drove > 5 && Math.abs(r.steered) > 0.1 && r.driftPill && r.gotOut && r.getInPill && r.gotIn
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); process.exit(ok ? 0 : 1)
