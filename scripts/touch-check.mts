// ── Phone check for the open world's touch controls (2026-11-15, hub) ─────────────────────────────────────
// Emulates a landscape phone (real touch events, no mouse), loads the Ather, and proves by the walker's own
// state that the stick moves the body and a right-half drag turns it, the gate map travels by tap with its
// Close / Flip buttons, and the fire button empties the clip in the Wilds. Screenshots to --out (default scratch).
//   npx tsx scripts/touch-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp')
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage()
await p.emulate({ viewport: { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
await p.goto(`${flag('--url', 'https://ather.games')}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 120000 })
const media = await p.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, anyFine: matchMedia('(any-pointer: fine)').matches }))
console.log('media', JSON.stringify(media))
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 })
await new Promise(r => setTimeout(r, 3000))
await p.screenshot({ path: `${out}/touch-1-intro.png` })
const st = () => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px, z: s.pz, yaw: s.yaw } })
await p.touchscreen.tap(420, 200)                      // dismiss the intro
await new Promise(r => setTimeout(r, 800))
const s0 = await st()
// stick: thumb down on the left, push up (forward), hold ~4 s
await p.touchscreen.touchStart(120, 300)
for (let i = 1; i <= 6; i++) { await p.touchscreen.touchMove(120, 300 - i * 10); await new Promise(r => setTimeout(r, 30)) }
await new Promise(r => setTimeout(r, 4000))
await p.screenshot({ path: `${out}/touch-2-stick.png` })
await p.touchscreen.touchEnd()
const s1 = await st()
// look: drag on the right half, 200 px to the left
await p.touchscreen.touchStart(600, 180)
for (let i = 1; i <= 10; i++) { await p.touchscreen.touchMove(600 - i * 20, 180); await new Promise(r => setTimeout(r, 60)) }
await p.touchscreen.touchEnd()
await new Promise(r => setTimeout(r, 800))
const s2 = await st()
await p.screenshot({ path: `${out}/touch-3-look.png` })
// the gate's map, travelled by touch: open it the way E would, tap Gregory's pin, land in the Wilds
await p.evaluate(() => (window as any).__ather.open('gate'))
await new Promise(r => setTimeout(r, 1200))
await p.screenshot({ path: `${out}/touch-4-map.png` })
const panelBtns = await p.$$eval('button', bs => bs.map(b => b.textContent?.trim()).filter(t => t === 'Close' || t === 'Flip map'))
// the Stops list, not the pin: on a fresh save the map image is all fog and the pin sits under it
const stop = await p.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent?.startsWith("Gregory's waymark"))!)
const bb = await (stop as any).boundingBox()
await p.touchscreen.tap(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2)
await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 60000 })
await new Promise(r => setTimeout(r, 4000))
// fire: hold the fire button, the clip must drop
const ammo = () => p.evaluate(() => (window as any).__ather.combat().keeper.ammo as number)
const a0 = await ammo()
const fireBtn = await p.evaluateHandle(() => [...document.querySelectorAll('div')].find(d => d.textContent === 'fire' && d.children.length === 0)!)
const fb = await (fireBtn as any).boundingBox()
await p.touchscreen.touchStart(fb.x + fb.width / 2, fb.y + fb.height / 2)
await new Promise(r => setTimeout(r, 1500))
await p.screenshot({ path: `${out}/touch-5-wilds-fire.png` })
await p.touchscreen.touchEnd()
const a1 = await ammo()
console.log(JSON.stringify({ panelBtns, zone: 'wilds', ammo: [a0, a1] }))
const shot = a1 < a0 && panelBtns.length === 2
const moved = Math.hypot(s1.x - s0.x, s1.z - s0.z), turned = s2.yaw - s1.yaw
console.log(JSON.stringify({ moved: +moved.toFixed(2), turned: +turned.toFixed(3), stickMovedOnly: Math.abs(s1.yaw - s0.yaw) < 1e-6 }))
const ok = moved > 0.5 && turned > 0.3 && shot
console.log(ok ? 'PASS' : 'FAIL')
await b.close()
process.exit(ok ? 0 : 1)
