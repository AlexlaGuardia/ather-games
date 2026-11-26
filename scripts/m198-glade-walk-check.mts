// M198 check (m198-glade-walk-check): in the closed Glade a keeper WALKS (real W key) across the friends' old mist edges,
//   which M198 opened (Otto 0,11 + 1,11: the old wall at world x -334; Tess 1,11 + 2,11: the old wall at world z 334),
//   and is still stopped one square further out (Otto's new edge x -354, Tess's z 354).
//   1. west across x -334 (Otto's ground, z 113 / 104 / 145 lanes, clear of the Stonery pad and Sax's house)
//   2. still walled at x -354
//   3. south across z 334 (Tess's ground, x -306 / -300 / -326 lanes, clear of Yarrow's house)
//   4. still walled at z 354
//   5. 0 page errors
//   npx tsx scripts/m198-glade-walk-check.mts [--url http://localhost:3201] [--desktop]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(process.argv.includes('--desktop') ? { width: 1100, height: 680 } : { width: 390, height: 844, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.travel === 'function', { timeout: 180000 })
  for (let i = 0; i < 40 && !(await p.evaluate(() => (window as any).__ather?.zone?.() === 'glade')); i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await sleep(4000) }
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'glade' && !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__ather[f](...args), fn, a)
  const tick = async (n = 2, ms = 60) => { for (let i = 0; i < n; i++) { await p.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } }).catch(() => {}); if (ms) await sleep(ms) } }
  // walk from (x,z) toward (tx,tz) with the real W key; returns where the keeper ended up
  const walk = async (x: number, z: number, tx: number, tz: number, max = 45000) => {
    await A('tp', x, z, 0); await sleep(2500); await tick(4)
    const t0 = Date.now(); let s = await A('state') as { px: number; pz: number }, best = s, still = 0
    while (Date.now() - t0 < max) {
      const dx = tx - s.px, dz = tz - s.pz; if (Math.hypot(dx, dz) < 1.5) break
      await A('look', Math.atan2(-dx, -dz), 0); await p.keyboard.down('KeyW'); await tick(3)
      const n = await A('state') as { px: number; pz: number }
      still = Math.hypot(n.px - s.px, n.pz - s.pz) < 0.05 ? still + 1 : 0; s = n; best = s
      if (still > 12) break   // stopped against something
    }
    await p.keyboard.up('KeyW'); await tick(2)
    return best
  }
  if (process.argv.includes('--phone') || !process.argv.includes('--desktop')) { await p.touchscreen.tap(195, 420).catch(() => {}); await sleep(800) }
  // 1 + 2: Otto's ground, west
  let crossed: { px: number; pz: number } | null = null, lane = 0
  for (const z of [113, 104, 145]) { const e = await walk(-326, z, -346, z); console.log(`  otto lane z ${z}: ended at ${e.px.toFixed(1)}, ${e.pz.toFixed(1)}`); if (e.px < -338) { crossed = e; lane = z; break } }
  ok(!!crossed, `1. walked west across Otto's old edge x -334${crossed ? ` (lane z ${lane}, reached x ${crossed.px.toFixed(1)})` : ''}`)
  { const e = await walk(-346, lane || 113, -366, lane || 113); ok(e.px > -354.6, `2. stopped at Otto's new edge x -354 (ended x ${e.px.toFixed(1)})`) }
  // 3 + 4: Tess's ground, south
  crossed = null; lane = 0
  for (const x of [-306, -300, -326]) { const e = await walk(x, 326, x, 346); console.log(`  tess lane x ${x}: ended at ${e.px.toFixed(1)}, ${e.pz.toFixed(1)}`); if (e.pz > 338) { crossed = e; lane = x; break } }
  ok(!!crossed, `3. walked south across Tess's old edge z 334${crossed ? ` (lane x ${lane}, reached z ${crossed.pz.toFixed(1)})` : ''}`)
  { const e = await walk(lane || -306, 346, lane || -306, 366); ok(e.pz < 354.6, `4. stopped at Tess's new edge z 354 (ended z ${e.pz.toFixed(1)})`) }
  ok(errs.length === 0, `5. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
