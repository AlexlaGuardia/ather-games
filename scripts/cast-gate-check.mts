// A GATE cast on the Ather plot (BETA M15c). The glove holds Gate. X strikes two rings (keeper + castRange out); walking
// into the far one brings the keeper out at the near one; mana is billed per second; it closes at areaSecs.
//   npx tsx scripts/cast-gate-check.mts [origin] [shot.png]     (default http://localhost:3201)
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'http://localhost:3201', shot = process.argv[3]
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
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: 'Gate' }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
})
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
await p.goto(`${origin}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof (window as any).__ather?.look === 'function' && !!(window as any).__casts, { timeout: 240000 }); await sleep(3000)
await p.mouse.click(400, 250); await sleep(800)
await p.evaluate(() => { (window as any).__ather.setMana(100) })
const s0 = await p.evaluate(() => (window as any).__ather.state()), m0 = await p.evaluate(() => (window as any).__casts.mana())
await p.keyboard.press('KeyX'); await sleep(1200)
const g = await p.evaluate(() => (window as any).__casts.gate())
ok(!(await p.evaluate(() => document.body.innerText.includes('not out here yet'))), 'no "not out here yet" refusal')
ok(!!g, `a gate stands (${JSON.stringify(g)})`)
const m1 = await p.evaluate(() => (window as any).__casts.mana())
ok(m1 < m0 - 17, `mana spent: cast cost + per-second bill (${m0.toFixed(1)} -> ${m1.toFixed(1)})`)
if (shot) await p.screenshot({ path: shot })
// step into the far ring (the headless walk is too slow to cover 14 m inside 12 s, so place the keeper there): out at the near one
await p.evaluate((f: any) => (window as any).__ather.tp(f.x, f.z), g.far); await sleep(1500)
const s1 = await p.evaluate(() => (window as any).__ather.state()), warps = await p.evaluate(() => (window as any).__casts.warps())
ok(warps === 1 && Math.hypot(s1.px - g.near.x, s1.pz - g.near.z) < 3, `into the far ring, out at the near one (warps ${warps}, now ${s1.px.toFixed(1)},${s1.pz.toFixed(1)} vs near ${g.near.x},${g.near.z})`)
// it closes at areaSecs (12s) or when the pool is dry
await p.waitForFunction(() => !(window as any).__casts.gate(), { timeout: 40000 }).catch(() => {})
ok(!(await p.evaluate(() => (window as any).__casts.gate())), 'the gate closed')
ok(errors.length === 0, `0 page errors (${errors.slice(0, 2).join(' | ')})`)
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
