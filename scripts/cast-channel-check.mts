// A CHANNEL cast in the Wilds (BETA M15c). The glove holds Meltbore (held, billed per second). X down starts it, holding bills mana, X up stops it.
//   npx tsx scripts/cast-channel-check.mts [origin] [shot.png]
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'https://ather.games', shot = process.argv[3]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 800, height: 500 })
const errors: string[] = []
p.on('pageerror', e => errors.push(String(e)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['charred-rifle', 'repeater'], primary: 'charred-rifle', secondary: 'repeater', kael: true,
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: 'Meltbore' }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
})
await p.goto(`${origin}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(5000)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
await p.mouse.click(400, 250); await sleep(800)
await p.waitForFunction(() => typeof (window as any).__ather?.look === 'function', { timeout: 60000 }); await p.evaluate(() => (window as any).__ather.look(0, -0.25)); await sleep(600)
await p.evaluate(() => { const a = (window as any).__ather; a.combat().hollows.length = 0 })
await sleep(300)
const m0 = await p.evaluate(() => (window as any).__casts.mana())
// POLL, never a fixed sleep: swiftshader under load gives a handful of frames a second and dt is capped per frame, so a fixed
// 1.5 s once credited only 0.2 s held (play 11-18: load 5, FAIL; rerun PASS at 0.30000000000000004). Hold until 0.5 s is credited.
await p.keyboard.down('KeyX')
const pollFor = async (fn: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250) } return false }
await pollFor(async () => ((await p.evaluate(() => (window as any).__casts.channel()?.held ?? 0)) as number) > 0.5, 20000)
const mid = await p.evaluate(() => ({ m: (window as any).__casts.mana(), ch: (window as any).__casts.channel() }))
ok(!(await p.evaluate(() => document.body.innerText.includes('not out here yet'))), 'no "not out here yet" refusal')
ok(!!mid.ch && mid.ch.held > 0.5, `held: channel running, >0.5 s credited (polled: the harness runs slow, dt is capped per frame) (${JSON.stringify(mid.ch)})`)
ok(!!mid.ch && Math.abs(mid.ch.paid - 8 * mid.ch.held) < 0.01 && m0 - mid.m > 4 + mid.ch.paid * 0.8, `held: mana billed per second (8/s, 4 on the press) (${m0.toFixed(1)} -> ${mid.m.toFixed(1)})`)
await p.keyboard.up('KeyX')
await pollFor(async () => (await p.evaluate(() => (window as any).__casts.channel())) === null, 10000)
const end = await p.evaluate(() => ({ m: (window as any).__casts.mana(), ch: (window as any).__casts.channel() }))
ok(end.ch === null, 'released: channel stopped')
// Meltbore is an EMP now (f0d7a558, Alex 11-18): with no keeper in the beam the closing line says so, not 'nothing here to open'
const said = await pollFor(async () => (await p.evaluate(() => document.body.innerText.includes('no shields in the beam'))) as boolean, 5000)
ok(said && !(await p.evaluate(() => document.body.innerText.includes('nothing here to open'))), "released: the HUD says 'no shields in the beam' (the EMP), never 'nothing here to open'")
await sleep(800)
const later = await p.evaluate(() => (window as any).__casts.mana())
ok(later >= end.m - 0.01, `released: no more billing (${end.m.toFixed(1)} -> ${later.toFixed(1)})`)
if (shot) await p.screenshot({ path: shot })
ok(errors.length === 0, `0 page errors (${errors.slice(0, 2).join(' | ')})`)
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
