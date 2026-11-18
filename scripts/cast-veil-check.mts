// A VEIL cast in the Wilds (BETA M15c). The glove holds Heat Mirage. X stands a decoy; Hollows close on it instead of the keeper.
//   npx tsx scripts/cast-veil-check.mts [origin] [shot.png]
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
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: 'Heat Mirage' }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
})
await p.goto(`${origin}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(5000)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
await p.mouse.click(400, 250); await sleep(800)
await p.waitForFunction(() => typeof (window as any).__ather?.look === 'function', { timeout: 60000 }); await p.evaluate(() => (window as any).__ather.look(0, -0.25)); await sleep(600)
await p.evaluate(() => { const a = (window as any).__ather; a.combat().hollows.length = 0 })
await sleep(300)
await p.evaluate(() => { const a = (window as any).__ather; a.spawn(0, -14) })
await sleep(300)
await p.keyboard.press('KeyX'); await sleep(500)
const d = await p.evaluate(() => { const c = (window as any).__ather.combat(); return c.decoy ? { x: c.decoy.x, z: c.decoy.z, left: c.decoy.until - c.clock } : null })
ok(!(await p.evaluate(() => document.body.innerText.includes('not out here yet'))), 'no "not out here yet" refusal')
ok(!!d && d.left > 2, `a decoy stands (${JSON.stringify(d)})`)
const tgt = await p.evaluate(() => { const a = (window as any).__ather, c = a.combat(), s = a.state(), h = c.hollows[0]; h.state = 'chase'; return { hx: h.x, hz: h.z, kx: s.px, kz: s.pz, dx: c.decoy.x, dz: c.decoy.z } })
await sleep(3000)
const after = await p.evaluate(() => { const c = (window as any).__ather.combat(); const h = c.hollows[0]; return h ? { x: h.x, z: h.z } : null })
const dist = (a: { x: number; z: number }, x: number, z: number) => Math.hypot(a.x - x, a.z - z)
ok(!!after && dist(after, tgt.dx, tgt.dz) < Math.hypot(tgt.hx - tgt.dx, tgt.hz - tgt.dz) - 0.3, `the Hollow closed on the decoy (${JSON.stringify(after)})`)
await sleep(3500)
await p.waitForFunction(() => { const c = (window as any).__ather.combat(); return !c.decoy || c.decoy.until <= c.clock }, { timeout: 40000 }).catch(() => {})
ok((await p.evaluate(() => { const c = (window as any).__ather.combat(); return !c.decoy || c.decoy.until <= c.clock })), 'the decoy expired')
if (shot) await p.screenshot({ path: shot })
ok(errors.length === 0, `0 page errors (${errors.slice(0, 2).join(' | ')})`)
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
