// BETA M9, the measurable half (frame rate stays Alex's phone): THE HEAP STAYS BOUNDED. On prod, a born keeper walks loops on the
// Ather plot, then plays the Wilds (wakes Hollows, casts, draws and fires the gun, waymark trips home and back), then comes home.
// Every 30 s: a forced GC (HeapProfiler.collectGarbage), then Runtime.getHeapUsage, so a sample is what the page RETAINS, not
// garbage it has not swept yet. Prints every sample.
//   npx tsx scripts/beta-m9-heap.mts [--url https://ather.games] [--min 15]
// PASS = in each phase, after its warm-up, the last third's average is within 15% of the first third's (no steady climb), coming
// home from the Wilds gives the memory back (within 25% of the plot's own level), and 0 page errors. A Wilds level ABOVE the plot's
// is expected (tiles stream in); a Wilds level that keeps rising is the leak. Run ONCE on a quiet box (free -m > 2 GB, no build).
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), MIN = Number(flag('--min', '15'))
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: 800, height: 500 })
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))   // born: the ritual does not take the screen
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const cdp = await p.createCDPSession(); await cdp.send('HeapProfiler.enable')
const t0 = Date.now(), samples: { t: number; phase: string; mb: number }[] = []
const sample = async (phase: string) => {
  await cdp.send('HeapProfiler.collectGarbage')
  const h = await cdp.send('Runtime.getHeapUsage') as { usedSize: number }
  const s = { t: Math.round((Date.now() - t0) / 1000), phase, mb: +(h.usedSize / 1048576).toFixed(1) }
  samples.push(s); console.log(`  ${String(s.t).padStart(4)}s  ${phase.padEnd(6)} ${s.mb} MB`)
}
const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__ather[f](...args), fn, a)
// one 30 s slice of play, then a sample
const hold = async (key: string, ms: number) => { await p.keyboard.down(key); await sleep(ms); await p.keyboard.up(key) }
const walkLoop = async () => { for (const [k, ms] of [['KeyW', 3000], ['KeyD', 1500], ['KeyW', 3000], ['KeyA', 1500], ['KeyS', 3000]] as const) await hold(k, ms) }
const slice = async (phase: string, play: () => Promise<void>) => { const end = Date.now() + 30000; while (Date.now() < end) { await play().catch(() => {}); await sleep(300) } await sample(phase) }

await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.zone, { timeout: 240000 }); await sleep(3000)
await sample('plot')
const slices = Math.max(6, Math.round(MIN * 2)), plotN = Math.round(slices * 0.4), wildsN = slices - plotN
// 1 · the plot: walking loops round the garden, back to the middle each loop
for (let i = 0; i < plotN; i++) await slice('plot', async () => { await walkLoop(); await A('tp', 0, 8, i * 0.7) })
// 2 · the Wilds: Greg's waymark, wake what is near, cast, shoot; every 4th slice a waymark trip home and back
const greg = { kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }
await A('travel', greg)
await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 }); await sleep(4000)
for (let i = 0; i < wildsN; i++) {
  await slice('wilds', async () => {
    if (i % 4 === 3) {   // a waymark trip: home, a breath, back
      await A('travel', { kind: 'home' }); await p.waitForFunction(() => (window as any).__ather.zone() === 'plot', { timeout: 60000 }); await sleep(2000)
      await A('travel', greg); await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 60000 }); await sleep(2000)
      return
    }
    const ns = await A('nodes') as { x: number; z: number }[] | undefined
    const n = ns?.[(i * 3) % Math.max(1, ns.length)]
    if (n) await A('tp', n.x + 22, n.z + 22, 0.8)   // near an infected node: Hollows come
    await p.keyboard.press('KeyQ'); await sleep(400)   // a tactical cast (M15: works in every mode)
    await p.keyboard.press('KeyR'); await sleep(600)   // draw the gun
    for (let s = 0; s < 4; s++) { await p.mouse.down(); await sleep(120); await p.mouse.up(); await sleep(350) }
    await A('setMana', 100)
    await walkLoop()
    const k = await A('combat') as { keeper?: { hp: number; maxHp: number } } | undefined
    if (k?.keeper) await p.evaluate(() => { const c = (window as any).__ather.combat(); c.keeper.hp = c.keeper.maxHp })   // keep the keeper standing: this measures memory, not the fight
  })
}
// 3 · home again: the Wilds' memory should be given back
await A('travel', { kind: 'home' }); await p.waitForFunction(() => (window as any).__ather.zone() === 'plot', { timeout: 60000 })
for (let i = 0; i < 3; i++) await slice('home', walkLoop)
await br.close()

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const judge = (phase: string, warm: number) => {
  const xs = samples.filter(s => s.phase === phase).slice(warm).map(s => s.mb), k = Math.max(1, Math.floor(xs.length / 3))
  const first = avg(xs.slice(0, k)), last = avg(xs.slice(-k)), ratio = last / first
  console.log(`${phase}: ${xs.length} samples after ${warm} warm-up · first third ${first.toFixed(1)} MB · last third ${last.toFixed(1)} MB · ${(ratio * 100 - 100).toFixed(1)}%`)
  return { first, last, ok: ratio <= 1.15 }
}
const plot = judge('plot', 1), wilds = judge('wilds', 2)
const home = avg(samples.filter(s => s.phase === 'home').map(s => s.mb))
const back = home <= plot.last * 1.25
console.log(`home after the Wilds: ${home.toFixed(1)} MB vs the plot's ${plot.last.toFixed(1)} MB (${back ? 'given back' : 'NOT given back'})`)
console.log(`page errors: ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
const pass = plot.ok && wilds.ok && back && errs.length === 0
console.log(pass ? 'PASS' : 'FAIL'); process.exit(pass ? 0 : 1)
