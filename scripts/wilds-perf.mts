// What a Wilds frame costs to DRAW, against the plot, measured on the live page (Alex 11-16: "the lag hits pretty
// hard here.. i dont know if its the amount of enemies").
//
//   npx tsx scripts/wilds-perf.mts [origin]
//
// The headless box runs SwiftShader, so a frame RATE here means nothing. What it counts instead is true under any
// driver: GL draw calls per frame, vertices submitted per frame, and how much of each frame is spent in JS before
// the GL work (rAF callback time). It samples until the counts stop climbing, since the Wilds stream in.
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.createBrowserContext(); const p = await ctx.newPage()
await p.setViewport({ width: 960, height: 600 })
await p.evaluateOnNewDocument('window.__name = (f) => f')   // tsx wraps named closures in __name, which the page lacks
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const s = { calls: 0, verts: 0, inst: 0, frames: [] as { calls: number; verts: number; inst: number; js: number }[] }
  ;(window as any).__perf = s
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const P = C.prototype as any
    for (const [name, vi, ii] of [['drawElements', 1, -1], ['drawArrays', 2, -1], ['drawElementsInstanced', 1, 4], ['drawArraysInstanced', 2, 3]] as const) {
      const f = P[name]; if (!f) continue
      P[name] = function (...a: number[]) { if ((window as any).__top) (window as any).__top.push([name, a[vi], ii >= 0 ? a[ii] : 1]); s.calls++; const n = ii >= 0 ? a[ii] : 1; s.verts += a[vi] * n; if (ii >= 0) s.inst += n; return f.apply(this, a) }
    }
  }
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb: FrameRequestCallback) => raf((t) => {
    const t0 = performance.now(); cb(t); const js = performance.now() - t0
    if (s.calls) { s.frames.push({ calls: s.calls, verts: s.verts, inst: s.inst, js }); if (s.frames.length > 60) s.frames.shift() }
    s.calls = 0; s.verts = 0; s.inst = 0
  })
})
const read = () => p.evaluate(() => {
  const f = (window as any).__perf.frames as { calls: number; verts: number; inst: number; js: number }[]
  const med = (k: 'calls' | 'verts' | 'inst' | 'js') => { const v = f.map(x => x[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? 0 }
  return { calls: med('calls'), verts: med('verts'), inst: med('inst'), js: +med('js').toFixed(1), n: f.length }
})
async function settle(label: string) {
  let last = -1, same = 0, r = await read()
  for (let i = 0; i < 40 && same < 3; i++) { await sleep(3000); r = await read(); if (Math.abs(r.calls - last) <= 2) same++; else same = 0; last = r.calls }
  console.log(`${label.padEnd(18)} draw calls ${String(r.calls).padStart(5)} · verts ${String(Math.round(r.verts / 1000)).padStart(6)}k · instances ${String(r.inst).padStart(6)} · js/frame ${r.js} ms`)
}
await p.goto(`${origin}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.zone, { timeout: 240000 })
await settle('plot')
await p.goto(`${origin}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 })
await settle('wilds (greg)')
// one frame's biggest calls: count × instances, so the heavy mesh names itself by its index count
await p.evaluate(() => { (window as any).__top = [] }); await sleep(6000)
const top = await p.evaluate(() => { const t = (window as any).__top as [string, number, number][]; (window as any).__top = null; return t })
const seen = new Map<string, number>()
for (const [n, c, k] of top) { const key = `${n} idx ${c} × ${k}`; seen.set(key, (seen.get(key) ?? 0) + 1) }
console.log('heaviest calls (one frame):')
for (const [k, v] of [...seen].sort((a, b) => { const w = (s: string) => { const m = s.match(/idx (\d+) × (\d+)/)!; return +m[1] * +m[2] }; return w(b[0]) - w(a[0]) }).slice(0, 12)) console.log(`  ${k}  (${v}x)`)
await b.close()
