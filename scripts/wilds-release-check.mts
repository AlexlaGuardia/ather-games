// BETA M9 (11-22): the Wilds give their memory back at home. stream() only evicted while the keeper was IN the Wilds, so after
// a trip the last ring of parsed tiles stayed resident on the plot (the heap diff's biggest holder: 8.2 MB after 30 min). Now a
// minute at home (WILDS_RELEASE_MS) drops every tile outside the boot ring round Greg's waymark (releaseTo). This check:
//   1. boot: the boot ring is loaded, heap measured (forced GC)
//   2. a waymark 3+ tiles from Greg: far tiles load
//   3. home, 20 s: the far tiles are STILL held (the grace window), and a hop back to the far waymark inside it is quick
//   4. home again, 75 s: only boot-ring tiles remain, and the heap is back within 25% of the boot plot (M9's give-back line)
//   5. back to the far waymark after the release: it arrives (the tiles re-parse behind the veil, sliced), worst frame in the
//      4 s after arrival is REPORTED (SwiftShader inflates ms; compare the two hops, not the absolute)
//   npx tsx scripts/wilds-release-check.mts [--url https://ather.games] [--size 390x844]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), [VW, VH] = flag('--size', '390x844').split('x').map(Number)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { x: number; z: number; biome: number }[] }[] }).tiles
const greg = tiles.find(t => t.name === 'first-wilds')!
const far = tiles.filter(t => t.nodes.length && Math.max(Math.abs(t.tx - greg.tx), Math.abs(t.ty - greg.ty)) >= 3)
  .sort((a, b) => Math.max(Math.abs(a.tx - greg.tx), Math.abs(a.ty - greg.ty)) - Math.max(Math.abs(b.tx - greg.tx), Math.abs(b.ty - greg.ty)))[0]
const ring = (t: { tx: number; ty: number }) => new Set(tiles.filter(x => Math.abs(x.tx - t.tx) <= 1 && Math.abs(x.ty - t.ty) <= 1).map(x => x.name))
const bootRing = ring(greg), farRing = ring(far)
const farMark = { kind: 'waymark', w: { id: 'm9-far', tile: far.name, x: far.nodes[0].x, y: 0, z: far.nodes[0].z, biome: far.nodes[0].biome, made: 0 } }

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: VW, height: VH })
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const w = window as any; w.__fr = []; let last = performance.now()
  const tick = (t: number) => { w.__fr.push([t, t - last]); last = t; if (w.__fr.length > 20000) w.__fr.splice(0, 10000); requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
})
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const cdp = await p.createCDPSession(); await cdp.send('HeapProfiler.enable')
const heap = async () => { for (let i = 0; i < 2; i++) await cdp.send('HeapProfiler.collectGarbage'); return +((await cdp.send('Runtime.getHeapUsage') as { usedSize: number }).usedSize / 1048576).toFixed(1) }
const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__ather[f](...args), fn, a)
const loaded = () => A('wildsLoaded') as Promise<string[]>
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
// travel and time it: call -> zone flips; then the worst rAF frame in the 4 s after arrival
const hop = async (d: unknown, to: 'wilds' | 'plot') => {
  for (let k = 0; k < 20 && (await A('zone')) !== to; k++) {
    const t0 = await p.evaluate(() => performance.now()); await A('travel', d)
    const got = await p.waitForFunction((z: string) => (window as any).__ather.zone() === z, { timeout: 60000, polling: 100 }, to).then(() => true).catch(() => false)
    if (!got) { await sleep(3000); continue }
    const t1 = await p.evaluate(() => performance.now()); await sleep(4000)
    const worst = await p.evaluate((a: number) => Math.max(0, ...((window as any).__fr as number[][]).filter(f => f[0] >= a && f[0] <= a + 4000).map(f => f[1])), t1)
    return { ms: Math.round(t1 - t0), worst: Math.round(worst) }
  }
  return null
}

await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.wildsLoaded?.().length > 0, { timeout: 240000, polling: 1000 })
await sleep(4000)
const boot = await loaded(), heap0 = await heap()
console.log(`far waymark: ${far.name} (${far.tx},${far.ty}), boot ring ${[...bootRing].length} tiles round first-wilds (${greg.tx},${greg.ty})`)
ok(boot.length > 0 && boot.every(n => bootRing.has(n)), `1. boot: ${boot.length} tiles loaded, all in the boot ring · heap ${heap0} MB`)
const h1 = await hop(farMark, 'wilds'); await sleep(4000)
const atFar = await loaded()
ok(!!h1 && atFar.some(n => farRing.has(n) && !bootRing.has(n)), `2. at the far waymark: ${atFar.length} tiles, far ones in (${h1 ? `${h1.ms} ms to arrive` : 'never arrived'})`)
await hop({ kind: 'home' }, 'plot'); await sleep(20000)
const grace = await loaded()
ok(grace.some(n => !bootRing.has(n)), `3a. home 20 s: far tiles still held in the grace window (${grace.filter(n => !bootRing.has(n)).length} outside the boot ring)`)
const h2 = await hop(farMark, 'wilds')
ok(!!h2, `3b. hop back inside the window: ${h2 ? `${h2.ms} ms to arrive, worst frame after ${h2.worst} ms` : 'never arrived'}`)
await hop({ kind: 'home' }, 'plot'); await sleep(75000)
const after = await loaded(), heap1 = await heap()
ok(after.every(n => bootRing.has(n)), `4a. home 75 s: only boot-ring tiles left (${after.length}: ${after.join(',')})`)
ok(heap1 <= heap0 * 1.25, `4b. heap given back: ${heap1} MB vs the boot plot's ${heap0} MB (${((heap1 / heap0 - 1) * 100).toFixed(1)}%, line +25%)`)
const h3 = await hop(farMark, 'wilds'); await sleep(3000)
const again = await loaded()
ok(!!h3 && again.some(n => farRing.has(n) && !bootRing.has(n)), `5. back after the release: ${h3 ? `${h3.ms} ms to arrive, worst frame after ${h3.worst} ms (inside-window hop: ${h2?.ms ?? '?'} ms / ${h2?.worst ?? '?'} ms)` : 'never arrived'}`)
await br.close()
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
