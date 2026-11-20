// M44 part 3 DIAGNOSIS: WALKING across Wilds tile edges. In the Wilds at first-wilds, the keeper is moved east at walking pace
// (tp steps of 0.5 m every 100 ms = 5 m/s, so voids cannot interrupt the run) across x = 500 (into w1_0, which streams the w2_*
// column in) and on to x = 560. Same frame log + Chrome trace summary as arrival-profile.
// Per leg: rAF frame log, injected WebGL call timing (page-side monkeypatch, no game code touched), Long Animation Frame
// scripts, and a Chrome trace (v8 cpu profiler) summarised over the > 50 ms main-thread tasks. Traces stay on disk (--out).
//   npx tsx scripts/wilds-walk-profile.mts [origin] [--out dir]
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
const a = process.argv.slice(2)
const origin = a.find(x => x.startsWith('http')) ?? 'https://ather.games'
const arg = (k: string, d: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d }
const outDir = arg('--out', '/home/ajin/edesk-out/walk-profile-traces'); const SECS = +arg('--secs', '10')
fs.mkdirSync(outDir, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const exe = process.env.CHROME ?? ['/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(x => fs.existsSync(x))
console.log('browser', exe, 'origin', origin)
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 1280, height: 720 })
const errors: string[] = []
p.on('pageerror', e => errors.push(String(e)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const w = window as any; w.__frames = []; w.__ev = []; w.__gl = []; w.__loaf = []; w.__progs = 0; let last = performance.now()
  // frame logger + fade/zone events
  let veil: HTMLElement | null = null, lastZone = '', lastOp = 0, lastScan = 0
  const tick = (t: number) => {
    w.__frames.push([t, t - last]); last = t
    if (t - lastScan > 50) {
      lastScan = t
      if (!veil || !veil.isConnected) veil = Array.from(document.querySelectorAll<HTMLElement>('div')).find(d => d.style.background === 'rgb(246, 241, 228)' && d.style.transition.includes('opacity')) ?? null
      const op = veil ? parseFloat(veil.style.opacity || '0') : 0
      if (op > 0.5 && lastOp <= 0.5) w.__ev.push([t, 'fadeUp']); if (op <= 0.5 && lastOp > 0.5) w.__ev.push([t, 'fadeDown']); lastOp = op
      const z = w.__ather?.zone?.() ?? ''; if (z !== lastZone) { w.__ev.push([t, 'zone=' + z]); lastZone = z }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  // timed wrappers on the GL calls that stall or build things
  const names = ['linkProgram', 'compileShader', 'getProgramParameter', 'getShaderParameter', 'texImage2D', 'texSubImage2D', 'texImage3D', 'texStorage2D', 'compressedTexImage2D', 'bufferData', 'bufferSubData', 'generateMipmap', 'readPixels', 'getProgramInfoLog']
  for (const C of [(window as any).WebGL2RenderingContext, (window as any).WebGLRenderingContext]) {
    if (!C) continue
    for (const n of names) {
      const o = C.prototype[n]; if (!o) continue
      C.prototype[n] = function (...args: any[]) { const s = performance.now(); const r = o.apply(this, args); const d = performance.now() - s; if (d > 0.3 || n === 'linkProgram') w.__gl.push([s, n, d]); return r }
    }
    const cp = C.prototype.createProgram; C.prototype.createProgram = function () { w.__progs++; w.__ev.push([performance.now(), 'createProgram#' + w.__progs]); return cp.apply(this) }
  }
  try { new PerformanceObserver(l => { for (const e of l.getEntries() as any[]) w.__loaf.push({ s: e.startTime, d: e.duration, blk: e.blockingDuration, rs: e.renderStart, sl: e.styleAndLayoutStart, sc: (e.scripts ?? []).map((x: any) => ({ d: x.duration, f: x.sourceFunctionName, u: (x.sourceURL ?? '').split('/').pop()?.slice(0, 40), i: x.invokerType, ex: x.executionStart, fl: x.forcedStyleAndLayoutDuration })) }) }).observe({ type: 'long-animation-frame', buffered: true }) } catch { w.__loafOff = true }
})
await p.goto(`${origin}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof (window as any).__ather?.travel === 'function' && (window as any).__ather.zone() === 'plot', { timeout: 240000 }); await sleep(3000)
console.log('hooks: __ather keys =', (await p.evaluate(() => Object.keys((window as any).__ather))).join(','), '| gl.info hook: only __ather.calls() (draw calls); no programs/geometries/textures hook -> using GL wrapper counts instead. LoAF', (await p.evaluate(() => !(window as any).__loafOff)) ? 'on' : 'OFF')
const GLADE = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 0, made: 0 }
const OTHER = { id: 'veil-check', tile: 'first-wilds', x: -230, y: 0, z: 240, biome: 0, made: 0 }
const legs: [string, any, string][] = [['plot -> Moonwell Glade', { kind: 'waymark', w: GLADE }, 'wilds'], ['Glade -> Wilds waymark', { kind: 'waymark', w: OTHER }, 'wilds'], ['Wilds -> plot', { kind: 'home' }, 'plot']]
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8.execute', 'blink.user_timing', 'gpu', 'disabled-by-default-v8.cpu_profiler', 'v8', 'toplevel'].join(',')
const fn = (cf: any) => `${cf.functionName || '(anon)'} ${String(cf.url || '').split('/').pop()?.slice(0, 36) || ''}:${cf.lineNumber ?? ''}`
const top = (m: Map<string, number>, n: number, unit = 1) => [...m].sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => `${k} ${Math.round(v * unit)}ms`).join(' | ')

function summariseTrace(file: string, markName: string) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')); const evs: any[] = Array.isArray(raw) ? raw : raw.traceEvents
  const mains = new Set(evs.filter(e => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map(e => `${e.pid}:${e.tid}`))
  const onMain = (e: any) => mains.has(`${e.pid}:${e.tid}`)
  const marks = evs.filter(e => e.name === markName && onMain(e)); const t0 = marks.length ? marks[marks.length - 1].ts : NaN
  // cpu profile -> samples [t, nodeCallFrame]
  const prof = new Map<string, { nodes: Map<number, any>; samples: [number, number][]; t: number }>()
  for (const e of evs) {
    if (e.name === 'Profile') prof.set(`${e.pid}:${e.id}`, { nodes: new Map(), samples: [], t: e.args?.data?.startTime ?? e.ts })
    else if (e.name === 'ProfileChunk') {
      const pr = prof.get(`${e.pid}:${e.id}`) ?? (prof.set(`${e.pid}:${e.id}`, { nodes: new Map(), samples: [], t: e.ts }), prof.get(`${e.pid}:${e.id}`)!)
      const cp = e.args?.data?.cpuProfile, td = e.args?.data?.timeDeltas ?? []
      for (const n of cp?.nodes ?? []) pr.nodes.set(n.id, n.callFrame)
      ;(cp?.samples ?? []).forEach((s: number, i: number) => { pr.t += td[i] ?? 0; pr.samples.push([pr.t, s]) })
    }
  }
  const allSamples: [number, any][] = []
  for (const pr of prof.values()) for (const [t, id] of pr.samples) allSamples.push([t, pr.nodes.get(id)])
  allSamples.sort((x, y) => x[0] - y[0])
  const tasks = evs.filter(e => e.ph === 'X' && e.name === 'RunTask' && onMain(e) && e.dur > 50000 && e.ts >= t0).sort((x, y) => x.ts - y.ts)
  const out: string[] = []; const agg = new Map<string, number>(); const aggEv = new Map<string, number>()
  const inner = evs.filter(e => e.ph === 'X' && onMain(e) && e.name !== 'RunTask' && e.ts >= t0)
  for (const t of tasks) {
    const self = new Map<string, number>(), incl = new Map<string, number>()
    for (let i = 0; i < allSamples.length; i++) { const [ts, cf] = allSamples[i]; if (ts >= t.ts && ts <= t.ts + t.dur && cf) { const dt = ((allSamples[i + 1]?.[0] ?? ts) - ts) / 1000; if (dt < 100) self.set(fn(cf), (self.get(fn(cf)) ?? 0) + dt) } }
    for (const e of inner) if (e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur + 50) incl.set(e.name, (incl.get(e.name) ?? 0) + e.dur / 1000)
    for (const [k, v] of self) agg.set(k, (agg.get(k) ?? 0) + v); for (const [k, v] of incl) aggEv.set(k, (aggEv.get(k) ?? 0) + v)
    out.push(`    task @+${Math.round((t.ts - t0) / 1000)}ms ${Math.round(t.dur / 1000)}ms | self: ${top(self, 3) || '(no samples)'} | events: ${top(incl, 4)}`)
  }
  return { n: tasks.length, ms: tasks.reduce((s, t) => s + t.dur / 1000, 0), lines: out, agg, aggEv, samples: allSamples.length, t0 }
}


let fails = 0
const START = { id: 'walk-prof', tile: 'first-wilds', x: 420, y: 0, z: 40, biome: 0, made: 0 }
for (let i = 0; i < 12 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) { await p.evaluate((d) => (window as any).__ather.travel({ kind: 'waymark', w: d }), START); await sleep(5000) }
console.log('zone', await p.evaluate(() => (window as any).__ather.zone()))
await sleep(15000)   // let the arrival settle (tiles, warm-up)
const tr = path.join(outDir, `walk-${Date.now()}.json`)
await p.tracing.start({ path: tr, categories: CATS.split(',') })
const T0 = await p.evaluate(() => { performance.mark('call'); return performance.now() })
const events: string[] = []
for (let x = 420; x <= 560; x += 0.5) {
  await p.evaluate((xx) => (window as any).__ather.tp(xx, 40, -Math.PI / 2), x)
  if (Math.abs(x - 500) < 0.26) events.push(`cross@+${Math.round((await p.evaluate(() => performance.now())) - T0)}`)
  await sleep(100)
}
await sleep(4000)
await p.tracing.stop()
const r = await p.evaluate((t0) => { const w = window as any; return { frames: w.__frames.filter((f: number[]) => f[0] >= t0), gl: w.__gl.filter((g: any[]) => g[0] >= t0), loaf: w.__loaf.filter((l: any) => l.s >= t0) } }, T0)
const fr = r.frames as number[][], dts = fr.map(f => f[1]), over = (n: number) => dts.filter(d => d > n).length
console.log(`walk: ${events.join(' ')}; frames ${fr.length}; >50ms ${over(50)}, >100ms ${over(100)}, >400ms ${over(400)}; worst ${Math.round(Math.max(...dts))}ms`)
for (const [t, dt] of [...fr].sort((x, y) => y[1] - x[1]).slice(0, 8).sort((x, y) => x[0] - y[0])) {
  const lo = (r.loaf as any[]).filter(l => l.s + l.d >= t - dt && l.s <= t).map(l => `LoAF ${Math.round(l.d)}ms scripts: ${l.sc.sort((x: any, y: any) => y.d - x.d).slice(0, 3).map((x: any) => `${x.f || x.i || '?'} ${Math.round(x.d)}ms`).join(', ')}`).join(' ; ')
  console.log(`  frame +${Math.round(t - T0)}ms dt ${Math.round(dt)}ms | ${lo || 'no LoAF'}`)
}
const ts = summariseTrace(tr, 'call')
console.log(`  trace: ${ts.n} main-thread tasks >50ms totalling ${Math.round(ts.ms)}ms; file ${tr}`)
console.log(`  TOP SELF over long tasks: ${top(ts.agg, 10)}`)
console.log(`  TOP EVENTS over long tasks: ${top(ts.aggEv, 6)}`)
ts.lines.slice(0, 10).forEach(l => console.log(l))
console.log('\npage errors:', errors.length, errors.slice(0, 2).join(' | '))
await b.close()
