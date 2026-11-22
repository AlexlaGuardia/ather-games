// BETA M9 (11-21 pm): WHAT does the page keep after the Wilds? The heap run showed home ~14 MB above the plot. This takes a
// V8 heap snapshot (after forced GC) on the plot, at the end of a Wilds stretch, and home again, then diffs SELF size by
// constructor (and strings as one bucket), plus two direct tallies for the ProgramKeeper suspect: shader-source strings
// (contain gl_Position / gl_FragColor / SHADER_NAME / precision ...) and WebGLProgram objects. Self size, not retained: a
// retained-size dominator pass on a 50 MB heap is slow, and self size by type already says WHICH kind of thing grew.
//   npx tsx scripts/m9-heap-diff.mts [--url https://ather.games] [--size 390x844] [--wilds-min 3] [--top 15]
import puppeteer from 'puppeteer-core'
import { createWriteStream, readFileSync, mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), WMIN = Number(flag('--wilds-min', '3')), TOP = Number(flag('--top', '15'))
const HOME_S = Number(flag('--home-sec', '90'))   // 11-22: past WILDS_RELEASE_MS (60 s), so the home snapshot is after the release
const [VW, VH] = flag('--size', '390x844').split('x').map(Number)
const dir = flag('--out', '/tmp/m9-heap-diff'); mkdirSync(dir, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: VW, height: VH })
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const cdp = await p.createCDPSession(); await cdp.send('HeapProfiler.enable')
const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__ather[f](...args), fn, a)
const hold = async (key: string, ms: number) => { await p.keyboard.down(key); await sleep(ms); await p.keyboard.up(key) }
const walkLoop = async () => { for (const [k, ms] of [['KeyW', 3000], ['KeyD', 1500], ['KeyW', 3000], ['KeyA', 1500], ['KeyS', 3000]] as const) await hold(k, ms) }
const playFor = async (ms: number, play: () => Promise<void>) => { const end = Date.now() + ms; while (Date.now() < end) { await play().catch(() => {}); await sleep(300) } }

type Agg = { total: number; byKey: Map<string, { size: number; count: number }>; shaderStr: { size: number; count: number }; programs: number }
const snap = async (label: string): Promise<Agg> => {
  for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await sleep(300) }
  const used = (await cdp.send('Runtime.getHeapUsage') as { usedSize: number }).usedSize
  const file = `${dir}/${label}.heapsnapshot`, out = createWriteStream(file)
  const onChunk = (e: { chunk: string }) => out.write(e.chunk)
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false } as any)
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await new Promise<void>(r => out.end(() => r()))
  const s = JSON.parse(readFileSync(file, 'utf8'))
  const f: string[] = s.snapshot.meta.node_fields, types: string[] = s.snapshot.meta.node_types[0], N = f.length
  const iT = f.indexOf('type'), iN = f.indexOf('name'), iS = f.indexOf('self_size'), nodes: number[] = s.nodes, strs: string[] = s.strings
  const agg: Agg = { total: 0, byKey: new Map(), shaderStr: { size: 0, count: 0 }, programs: 0 }
  const SHADER = /gl_Position|gl_FragColor|SHADER_NAME|precision (highp|mediump) float|#include <|pc_fragColor/
  for (let o = 0; o < nodes.length; o += N) {
    const t = types[nodes[o + iT]], name = strs[nodes[o + iN]] ?? '', size = nodes[o + iS]
    agg.total += size
    const isStr = t === 'string' || t === 'concatenated string' || t === 'sliced string'
    const key = isStr ? '(strings)' : t === 'object' || t === 'native' || t === 'closure' ? `${t}:${name.slice(0, 60)}` : `(${t})${t === 'array' || t === 'hidden' || t === 'code' ? '' : ':' + name.slice(0, 40)}`
    const e = agg.byKey.get(key) ?? { size: 0, count: 0 }; e.size += size; e.count++; agg.byKey.set(key, e)
    if (isStr && size > 200 && SHADER.test(name)) { agg.shaderStr.size += size; agg.shaderStr.count++ }
    if ((t === 'object' || t === 'native') && name === 'WebGLProgram') agg.programs++
  }
  const nTiles = await p.evaluate(() => ((window as any).__ather?.wildsLoaded?.() ?? []).length).catch(() => -1)
  console.log(`snapshot ${label}: Wilds tiles held ${nTiles} · usedSize ${(used / 1048576).toFixed(1)} MB · snapshot self total ${(agg.total / 1048576).toFixed(1)} MB · shader-source strings ${agg.shaderStr.count} = ${(agg.shaderStr.size / 1048576).toFixed(2)} MB · WebGLProgram ${agg.programs}`)
  return agg
}
const diff = (a: Agg, b: Agg, title: string) => {
  const keys = new Set([...a.byKey.keys(), ...b.byKey.keys()])
  const rows = [...keys].map(k => { const x = a.byKey.get(k) ?? { size: 0, count: 0 }, y = b.byKey.get(k) ?? { size: 0, count: 0 }; return { k, d: y.size - x.size, dc: y.count - x.count, y: y.size } })
  rows.sort((r, s) => s.d - r.d)
  console.log(`\n== ${title}: self total ${((b.total - a.total) / 1048576).toFixed(2)} MB · shader-source strings ${((b.shaderStr.size - a.shaderStr.size) / 1048576).toFixed(2)} MB (${b.shaderStr.count - a.shaderStr.count}) · WebGLProgram ${b.programs - a.programs >= 0 ? '+' : ''}${b.programs - a.programs}`)
  for (const r of rows.slice(0, TOP)) console.log(`  ${(r.d / 1048576).toFixed(2).padStart(7)} MB  ${String(r.dc >= 0 ? '+' + r.dc : r.dc).padStart(8)}  ${r.k}`)
}

await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.zone, { timeout: 240000 }); await sleep(3000)
await playFor(60000, async () => { await walkLoop(); await A('tp', 0, 8, 0) })
const plot = await snap('plot')
const greg = { kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }
for (let k = 0; k < 40 && (await A('zone')) !== 'wilds'; k++) { await A('travel', greg); await sleep(4000) }
await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 }); await sleep(4000)
let i = 0
await playFor(WMIN * 60000, async () => {   // same play as beta-m9-heap: wake a node's Hollows, cast, shoot, walk; keep the keeper standing
  const ns = await A('nodes') as { x: number; z: number }[] | undefined, n = ns?.[(i++ * 3) % Math.max(1, ns?.length ?? 1)]
  if (n) await A('tp', n.x + 22, n.z + 22, 0.8)
  await p.keyboard.press('KeyQ'); await sleep(400); await p.keyboard.press('KeyR'); await sleep(600)
  for (let s = 0; s < 4; s++) { await p.mouse.down(); await sleep(120); await p.mouse.up(); await sleep(350) }
  await A('setMana', 100); await walkLoop()
  await p.evaluate(() => { const c = (window as any).__ather.combat(); if (c?.keeper) c.keeper.hp = c.keeper.maxHp })
})
const wilds = await snap('wilds')
await A('travel', { kind: 'home' }); await p.waitForFunction(() => (window as any).__ather.zone() === 'plot', { timeout: 60000 })
await playFor(HOME_S * 1000, walkLoop)
const home = await snap('home')
await br.close()
diff(plot, home, 'HOME minus PLOT (what the Wilds left behind)')
diff(plot, wilds, 'WILDS minus PLOT')
console.log(`\npage errors: ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
