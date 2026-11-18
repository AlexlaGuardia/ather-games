// A FIELD cast in the Wilds (BETA M15c). The glove holds Cyclone Cage (archetype 'field', the hold-them-inside ring). X puts it at the
// aim point: a field lives in the Combat, and a Hollow standing in it is rooted for as long as it lasts. Before M15c the key said
// "Cyclone Cage is not out here yet" and nothing was placed.
//   npx tsx scripts/cast-field-check.mts [origin] [shot.png]
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
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: 'Cyclone Cage' }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
})
await p.goto(`${origin}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(5000)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
await p.mouse.click(400, 250); await sleep(800)
await p.waitForFunction(() => typeof (window as any).__ather?.look === 'function', { timeout: 60000 }); await p.evaluate(() => (window as any).__ather.look(0, -0.25)); await sleep(600)
await p.evaluate(() => { const a = (window as any).__ather; a.combat().hollows.length = 0; a.spawn(0, -6) })
await sleep(300)
const mana0 = await p.evaluate(() => (window as any).__ather.mana())
const mana = await p.evaluate(() => (window as any).__casts.mana())
await p.keyboard.press('KeyX'); await sleep(300)
// stand the Hollow in the ring (the aim lands a few metres off where a spawned Hollow wanders to), then let a tick pass
await p.evaluate(() => { const c = (window as any).__ather.combat(), f = c.fields?.[0], h = c.hollows[0]; if (f && h) { h.x = f.x; h.z = f.z; h.y = f.y } })
await sleep(1500)
const r = await p.evaluate(() => { const c = (window as any).__ather.combat(); return { fields: (c.fields ?? []).length, f: (c.fields ?? []).map((f: any) => [f.x, f.z, f.r]), h: c.hollows.map((h: any) => [h.x, h.z]), eye: (() => { const a = (window as any).__ather; return a.pos?.() ?? null })(), fx: c.hollows.map((h: any) => h.fx ?? null) } })
const msg = await p.evaluate(() => document.body.innerText.includes('not out here yet'))
ok(!msg, 'no "not out here yet" refusal')
ok(r.fields === 1, `a field is placed in the Combat (${JSON.stringify(r)})`)
ok(r.fx.some((f: any) => f && f.rooted > 0), `the Hollow inside is held (${JSON.stringify(r.fx)})`)
ok((await p.evaluate(() => (window as any).__casts.mana())) < mana - 10, 'X spent its mana')
if (shot) await p.screenshot({ path: shot })
ok(errors.length === 0, `0 page errors (${errors.slice(0, 2).join(' | ')})`)
void mana0
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
