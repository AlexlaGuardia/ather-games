// A TERRAIN cast in the Wilds (BETA M15c). The glove holds Stonewall (archetype 'terrain', a wall). X puts it at the
// aim point: a piece lives in the Combat and blocks Hollows for areaSecs. Before M15c the key said
// "Stonewall is not out here yet" and nothing was placed.
//   npx tsx scripts/cast-terrain-check.mts [origin] [shot.png]
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
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: 'Stonewall' }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
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
// wait for the CAMERA to take the look (play 11-18): the cast aims along the camera's world direction (combat-layer runCast), and
// at 1-2 fps no frame had applied look(0, -0.25) yet, so the cast went out along the ARRIVAL view (x -0.71, z +0.71, level) and the
// wall rose along the keeper's line, behind it. __ather.aim() is the camera's own direction (read-only probe).
await p.waitForFunction(() => { const a = (window as any).__ather.aim?.(); return !!a && a.z < -0.9 && a.y < -0.1 }, { timeout: 30000, polling: 250 })
await p.keyboard.press('KeyX'); await sleep(300)
// poll for the raised piece (it lands on a combat frame; fixed reads raced it at load ~6, play 11-18)
const readPieces = () => p.evaluate(() => { const c = (window as any).__ather.combat(); return { pieces: (c.pieces ?? []).length, cells: (c.pieces ?? []).reduce((n: number, q: any) => n + q.cells.length, 0) } })
let r = await readPieces()
for (const t0 = Date.now(); Date.now() - t0 < 8000 && r.pieces === 0; await sleep(250)) r = await readPieces()
const msg = await p.evaluate(() => document.body.innerText.includes('not out here yet'))
ok(!msg, 'no "not out here yet" refusal')
ok(r.pieces === 1 && r.cells >= 5, `a terrain piece is raised in the Combat (${JSON.stringify(r)})`)
ok((await p.evaluate(() => (window as any).__casts.mana())) < mana - 10, 'X spent its mana')
// the keeper collides with it (dynamic-solids.ts): from 4 m short of the wall, hold W ~2 s and never get past its cells at ground level
{
  const wall = await p.evaluate(() => { const c = (window as any).__ather.combat(); const q = c.pieces[0].cells; return { z: q[0].z, x0: Math.min(...q.map((k: any) => k.x)), x1: Math.max(...q.map((k: any) => k.x)) } })
  await p.evaluate((w) => { const a = (window as any).__ather; a.combat().hollows.length = 0; a.tp(Math.round((w.x0 + w.x1) / 2), w.z + 4, 0) }, wall)
  await sleep(300)
  // hold W until the keeper has covered 1.5 m (or 10 s): a fixed 2 s at load ~6 under swiftshader moved 0-0.24 m (play 11-18,
  // prod FAIL twice), which proves nothing about the wall. Then keep pushing 2 s more INTO it: the wall must still hold.
  await p.keyboard.down('KeyW')
  for (const t0 = Date.now(); Date.now() - t0 < 10000; await sleep(200)) if (((await p.evaluate(() => (window as any).__ather.state().pz)) as number) < wall.z + 4 - 1.5) break
  for (let i = 0; i < 20; i++) await sleep(100)
  await p.keyboard.up('KeyW')
  const end = await p.evaluate(() => (window as any).__ather.state())
  ok(end.pz < wall.z + 4 - 1, `the keeper did walk toward it (z ${end.pz.toFixed(2)})`)
  ok(end.pz > wall.z - 0.6, `holding W into it, the keeper did not pass the wall's cells (z ${end.pz.toFixed(2)}, wall z ${wall.z}, y ${end.py.toFixed(2)})`)
}
if (shot) await p.screenshot({ path: shot })
ok(errors.length === 0, `0 page errors (${errors.slice(0, 2).join(' | ')})`)
void mana0
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
