// Q and X on the live Ather page (Alex 11-16), real keys. A Star-born keeper's blank bracelet casts Firewall (status):
// a Hollow set in front of them is slowed; X with a blank glove says so and spends nothing; the HUD shows both plates.
//   npx tsx scripts/cast-keys-check.mts [origin] [shot.png]
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'https://ather.games', shot = process.argv[3]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 1280, height: 760 })
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.goto(`${origin}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(5000)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
await p.mouse.click(640, 380); await sleep(800)
const plates = await p.evaluate(() => document.querySelector('[data-hud="casts"]')?.textContent ?? '')
ok(plates.includes('Q') && plates.includes('Firewall') && plates.includes('X') && plates.includes('no word'), `HUD plates: "${plates}"`)
// a Hollow 6 m ahead, look down at it
await p.evaluate(() => (window as any).__ather.look(0, -0.25)); await sleep(600)
// wait for the CAMERA to take the look (11-19: at 1-2 fps a fixed 600 ms cast along the arrival view and the field missed)
await p.waitForFunction(() => { const a = (window as any).__ather.camAim?.(); return !!a && a.z < -0.9 && a.y < -0.1 }, { timeout: 30000, polling: 250 })
await p.evaluate(() => { const a = (window as any).__ather; a.combat().hollows.length = 0; a.spawn(0, -6) })
await sleep(300)
const mana0 = await p.evaluate(() => (window as any).__ather.mana())
await p.keyboard.press('KeyQ')
// POLL for the slow (play 11-18): the field lands on a later combat frame, and under swiftshader at load ~6 a fixed 0.9 s read the
// Hollow before any frame had stamped it (prod FAIL twice, mana already spent = the cast had fired). 8 s, then judge.
const readFx = () => p.evaluate(() => { const c = (window as any).__ather.combat(); return { fx: c.hollows.map((h: any) => h.fx ?? null), n: c.hollows.length } })
let r = await readFx()
for (const t0 = Date.now(); Date.now() - t0 < 8000 && !r.fx.some((f: any) => f && f.slowed > 0); await sleep(250)) r = await readFx()
const mana1 = await p.evaluate(() => (window as any).__ather.mana())
ok(r.n > 0 && r.fx.some((f: any) => f && f.slowed > 0), `Q (Firewall) slowed the Hollow ahead (${JSON.stringify(r)})`)
ok(mana1 < mana0 - 10, `Q spent its mana (${mana0.toFixed(0)} → ${mana1.toFixed(0)})`)
if (shot) await p.screenshot({ path: shot })
await p.keyboard.press('KeyQ'); await sleep(300)
ok(Math.abs((await p.evaluate(() => (window as any).__ather.mana())) - mana1) < 3, 'Q again inside the cooldown spent nothing')
const m2 = await p.evaluate(() => (window as any).__ather.mana())
await p.keyboard.press('KeyX'); await sleep(300)
ok(Math.abs((await p.evaluate(() => (window as any).__ather.mana())) - m2) < 3, 'X with a blank glove spent nothing')
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
