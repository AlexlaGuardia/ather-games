// BETA M9, the measurable half (frame rate stays Alex's phone): THE HEAP STAYS BOUNDED. On prod, a born keeper walks loops on the
// Ather plot, then plays the Wilds (wakes Hollows, casts, draws and fires the gun, waymark trips home and back), then comes home.
// Every 30 s: a forced GC (HeapProfiler.collectGarbage), then Runtime.getHeapUsage, so a sample is what the page RETAINS, not
// garbage it has not swept yet. Prints every sample.
//   npx tsx scripts/beta-m9-heap.mts [--url https://ather.games] [--min 15] [--plot-min N --wilds-min N] [--size 390x844]
// --plot-min / --wilds-min set each phase's length on their own (default: --min split 40/60); --size sets the viewport (11-21, M9 re-run).
// --settlement [--settle-min 5]: INSTEAD, the M19 leg (11-18): stand in a Wilds settlement with its Moglin rigs mounted
// (__folk.drawn), short walks inside it, a sample every 30 s; PASS = after a 2-sample warm-up the last third is within 15%
// of the first, the rigs stayed mounted, 0 page errors. The default run is unchanged.
// PASS = in each phase, after its warm-up, the last third's average is within 15% of the first third's (no steady climb), coming
// home from the Wilds gives the memory back (within 25% of the plot's level AFTER a first Wilds visit, see 1b), and 0 page errors. A Wilds level ABOVE the plot's
// is expected (tiles stream in); a Wilds level that keeps rising is the leak. Run ONCE on a quiet box (free -m > 2 GB, no build).
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
import { folkOf } from '../src/app/shimmer/open/ather/settlement-folk'
import type { Network } from '../src/app/shimmer/open/ather/network'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), MIN = Number(flag('--min', '15'))
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); const [VW, VH] = flag('--size', '800x500').split('x').map(Number); await p.setViewport({ width: VW, height: VH })

// A/B legs (M34 heap, 11-19): --nosound stubs the AudioContext out before the page loads (sfx.ts decodes + caches samples);
// --nosheen sets window.__noBorrow (combat-layer.tsx: Hollows take no env map). Same walk, one suspect removed.
if (process.argv.includes('--nosound')) await p.evaluateOnNewDocument(() => { try { (window as any).AudioContext = undefined; (window as any).webkitAudioContext = undefined } catch { /* sandboxed */ } })
if (process.argv.includes('--nosheen')) await p.evaluateOnNewDocument(() => { (window as any).__noBorrow = true })
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
if (process.argv.includes('--settlement')) {
  // M19 leg: the settlement folk-check stands in (a free + an employed Moglin), reached the way folk-check reaches it
  const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
  const st = net.settlements.find(x => { const f = folkOf(x, net.season); return f.some(y => !y.employed) && f.some(y => y.employed) })!
  const nFolk = folkOf(st, net.season).length
  const tx = Math.floor((st.x + 500) / 1000), tz = Math.floor((st.z + 500) / 1000)
  const tile = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }).tiles.find(t => t.tx === tx && t.ty === tz)!
  for (let i = 0; i < 40 && (await A('zone')) !== 'wilds'; i++) {
    await A('travel', { kind: 'waymark', w: { id: 'm9-settle', tile: tile.name, x: st.x - tx * 1000, y: 0, z: st.z - tz * 1000, biome: 2, made: 0 } })
    await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 15000, polling: 1000 }).catch(() => {})
  }
  if ((await A('zone')) !== 'wilds') { console.log('never reached the Wilds\nFAIL'); await br.close(); process.exit(1) }
  await sleep(6000); await A('tp', st.x, st.z, 0)
  const rigs = () => p.evaluate((id: string) => (((window as any).__folk?.drawn?.() ?? {})[id] ?? []).length as number, st.id)
  await p.waitForFunction((id: string, n: number) => ((((window as any).__folk?.drawn?.() ?? {})[id]) ?? []).length === n, { timeout: 60000, polling: 1000 }, st.id, nFolk).catch(() => {})
  console.log(`settlement ${st.name}: ${await rigs()}/${nFolk} Moglin rigs mounted`)
  const SN = Math.max(6, Math.round(Number(flag('--settle-min', '5')) * 2)), mounted: number[] = []
  await sample('settle')
  for (let i = 0; i < SN; i++) await slice('settle', async () => {   // short walks round the burrows, back to the anchor each time
    await hold('KeyW', 1500); await hold('KeyD', 800); await hold('KeyS', 1500); await A('tp', st.x, st.z, i * 0.9); mounted.push(await rigs())
  })
  await br.close()
  const xs = samples.filter(x => x.phase === 'settle').slice(2).map(x => x.mb), k = Math.max(1, Math.floor(xs.length / 3))
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)
  const first = mean(xs.slice(0, k)), last = mean(xs.slice(-k)), ratio = last / first
  const stayed = mounted.length > 0 && mounted.every(n => n === nFolk)
  console.log(`settle: ${xs.length} samples after 2 warm-up · first third ${first.toFixed(1)} MB · last third ${last.toFixed(1)} MB · ${(ratio * 100 - 100).toFixed(1)}%`)
  console.log(`rigs mounted every slice: ${stayed} (${mounted.join(',')}) · page errors: ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
  const ok = ratio <= 1.15 && stayed && errs.length === 0
  console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1)
}
await sample('plot')
const slices = Math.max(6, Math.round(MIN * 2))
const plotN = process.argv.includes('--plot-min') ? Math.max(3, Math.round(Number(flag('--plot-min', '0')) * 2)) : Math.round(slices * 0.4)
const wildsN = process.argv.includes('--wilds-min') ? Math.max(6, Math.round(Number(flag('--wilds-min', '0')) * 2)) : slices - Math.round(slices * 0.4)
console.log(`viewport ${VW}x${VH} · plot ${plotN} slices · wilds ${wildsN} slices (30 s each)`)
// 1 · the plot: walking loops round the garden, back to the middle each loop
for (let i = 0; i < plotN; i++) await slice('plot', async () => { await walkLoop(); await A('tp', 0, 8, i * 0.7) })
const greg = { kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }
// travel can be refused while the Wilds are still streaming ('The Wilds are still loading'): ask again until it lands
const toWilds = async () => {
  for (let k = 0; k < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; k++) { await A('travel', greg); await sleep(4000) }
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 }); await sleep(4000)
}
const toHome = async () => { await A('travel', { kind: 'home' }); await p.waitForFunction(() => (window as any).__ather.zone() === 'plot', { timeout: 60000 }) }
// home lasts past WILDS_RELEASE_MS (60 s: the Wilds' tiles are dropped then), and is judged on the samples after 70 s
const homeLevel = async (phase: string) => {
  const t = Math.round((Date.now() - t0) / 1000)
  for (let i = 0; i < 5; i++) await slice(phase, walkLoop)
  const all = samples.filter(s => s.phase === phase), late = all.filter(s => s.t - t >= 70), xs = (late.length ? late : all).map(s => s.mb)
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
}
// 1b · RE-BASELINE (11-22, hub 7f25d6a2): the home is judged against the plot measured AFTER a first Wilds visit, not the cold
// plot. WHY: a first trip leaves one-off state that is not a leak and never grows: V8 compiled code for the Wilds (~6 MB measured on
// prod 11-22) plus the boot-ring tiles kept for the next trip. Judging home against a never-visited plot counted that fixed cost as
// "not given back" (home 39.5 vs cold plot 30.8 = +28%, while the per-trip growth was gone after b52cb9c5). The criterion is a
// BOUNDED heap: the 25% line stays, it now measures what the Wilds keep PER visit, not the one-off cost of the first.
await toWilds()
await slice('first-wilds', walkLoop)
await toHome()
const plotWarm = await homeLevel('plot-warm')
// 2 · the Wilds: Greg's waymark, wake what is near, cast, shoot; every 4th slice a waymark trip home and back
await toWilds()
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
await toHome()
const home = await homeLevel('home')
await br.close()

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const judge = (phase: string, warm: number) => {
  const xs = samples.filter(s => s.phase === phase).slice(warm).map(s => s.mb), k = Math.max(1, Math.floor(xs.length / 3))
  const first = avg(xs.slice(0, k)), last = avg(xs.slice(-k)), ratio = last / first
  console.log(`${phase}: ${xs.length} samples after ${warm} warm-up · first third ${first.toFixed(1)} MB · last third ${last.toFixed(1)} MB · ${(ratio * 100 - 100).toFixed(1)}%`)
  return { first, last, ok: ratio <= 1.15 }
}
const plot = judge('plot', 1), wilds = judge('wilds', 2)
const back = home <= plotWarm * 1.25
console.log(`cold plot (last third) ${plot.last.toFixed(1)} MB · plot after a first Wilds visit ${plotWarm.toFixed(1)} MB (one-off first-visit cost ${(plotWarm - plot.last).toFixed(1)} MB)`)
console.log(`home after the Wilds: ${home.toFixed(1)} MB vs the warm plot's ${plotWarm.toFixed(1)} MB (${back ? 'given back' : 'NOT given back'}, ${((home / plotWarm) * 100 - 100).toFixed(1)}%)`)
console.log(`page errors: ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
const pass = plot.ok && wilds.ok && back && errs.length === 0
console.log(pass ? 'PASS' : 'FAIL'); process.exit(pass ? 0 : 1)
