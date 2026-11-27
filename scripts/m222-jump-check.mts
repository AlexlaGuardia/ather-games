// M222: a running jump keeps its momentum, on prod, in the Wilds (Alex 11-26: "it cancels momentum instead of pushing you
// forward, you stop and hop up"). Finds an upslope near the arrival (any rise ahead of the feet tripped the bug), runs up it,
// jumps at full run, and samples the keeper EVERY FRAME (a page-side rAF recorder on __ather.state()) until it lands.
// Before the fix the first airborne frame read 0 m/s and the rest RUN_SPEED * 0.5; after, the run carries into the air.
// No OWNER_KEY needed.   npx tsx scripts/m222-jump-check.mts [origin]
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 390, height: 844 })
const errors: string[] = []
p.on('pageerror', e => errors.push(String(e)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
await p.goto(`${origin}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && typeof (window as any).__ather?.state === 'function', { timeout: 240000 }); await sleep(5000)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
await p.mouse.click(195, 300); await sleep(500)

// an upslope: 16 m of land rising 0.06-0.6 per metre every half metre, the keeper's own ground probe
const spot = await p.evaluate(() => {
  const a = (window as any).__ather, s0 = a.state(), g = (x: number, z: number) => a.ground(x, z) as number
  for (let r = 0; r <= 48; r += 4) for (let k = 0; k < Math.max(1, r * 2); k++) {
    const t = (k / Math.max(1, r * 2)) * Math.PI * 2, x = s0.px + Math.cos(t) * r, z = s0.pz + Math.sin(t) * r
    for (let d = 0; d < 16; d++) {
      const yaw = (d / 16) * Math.PI * 2, fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      let good = true, rise = 0
      for (let m = 0.5; m <= 16 && good; m += 0.5) {
        const dy = g(x + fx * m, z + fz * m) - g(x + fx * (m - 0.5), z + fz * (m - 0.5))
        if (!(dy >= 0.03 && dy <= 0.3)) good = false; else rise += dy
      }
      if (good) return { x, z, yaw, rise }
    }
  }
  return null
})
ok(!!spot, `found an upslope near the arrival ${spot ? `(${spot.x.toFixed(1)}, ${spot.z.toFixed(1)}, rises ${spot.rise.toFixed(2)} m over 16 m)` : ''}`)
if (spot) {
  await p.evaluate((q) => { const a = (window as any).__ather; a.combat?.()?.hollows && (a.combat().hollows.length = 0); a.tp(q.x, q.z, q.yaw); a.look(q.yaw, -0.1) }, spot)
  await sleep(800)
  // the recorder: one sample per animation frame
  await p.evaluate(() => {
    const w = window as any; w.__m222 = []
    const tick = () => { const s = w.__ather.state(); w.__m222.push({ t: performance.now(), px: s.px, pz: s.pz, py: s.py, hv: Math.hypot(s.hvx, s.hvz), air: s.airborne, vy: s.vy, vault: s.vaulting || s.mantleT > 0 }); if (w.__m222.length < 20000) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  await p.keyboard.down('KeyW')
  // run until the sprint has topped out (the run speed) and the keeper is still on the slope's ground
  let run = 0
  for (const t0 = Date.now(); Date.now() - t0 < 60000; await sleep(100)) {
    const s = await p.evaluate(() => { const s = (window as any).__ather.state(); return { hv: Math.hypot(s.hvx, s.hvz), air: s.airborne } })
    if (!s.air && s.hv >= 6.3) { run = s.hv; break }
  }
  ok(run >= 6.3, `ran up to the run speed (${run.toFixed(2)} m/s)`)
  const n0 = await p.evaluate(() => (window as any).__m222.length)
  await p.keyboard.down('Space'); await sleep(250); await p.keyboard.up('Space')
  // wait for the landing (airborne, then grounded), W still held
  for (const t0 = Date.now(); Date.now() - t0 < 30000; await sleep(100)) {
    const done = await p.evaluate((n) => { const r = (window as any).__m222.slice(n); const i = r.findIndex((q: any) => q.air || q.vault); return i >= 0 && r.slice(i).some((q: any) => !q.air && !q.vault) }, n0)
    if (done) break
  }
  await p.keyboard.up('KeyW')
  const rec = await p.evaluate((n) => (window as any).__m222.slice(Math.max(0, n - 12)), n0) as { t: number; px: number; pz: number; py: number; hv: number; air: boolean; vy: number; vault: boolean }[]
  const i0 = rec.findIndex(q => q.air || q.vault), i1 = i0 < 0 ? -1 : rec.findIndex((q, i) => i > i0 && !q.air && !q.vault)
  console.log('frame  dt(ms)   x        z        feet     hv(m/s)  vy      air')
  for (const q of rec.slice(0, i1 < 0 ? 40 : i1 + 3)) console.log(`${String(rec.indexOf(q)).padStart(5)}  ${(q.t - rec[0].t).toFixed(0).padStart(6)}  ${q.px.toFixed(2).padStart(7)}  ${q.pz.toFixed(2).padStart(7)}  ${q.py.toFixed(2).padStart(7)}  ${q.hv.toFixed(2).padStart(6)}  ${q.vy.toFixed(2).padStart(6)}  ${q.air ? 'air' : q.vault ? 'VAULT' : 'ground'}`)
  ok(i0 >= 0, 'the jump left the ground')
  ok(!rec.some(q => q.vault), 'no vault / mantle in place of the jump')
  if (i0 >= 0 && i1 > i0) {
    const air = rec.slice(i0, i1)
    const minHv = Math.min(...air.map(q => q.hv))
    ok(air[0].hv >= run * 0.9, `★ take-off: ${air[0].hv.toFixed(2)} m/s on the jump frame (run ${run.toFixed(2)}, >= 90%)`)
    ok(minHv >= run * 0.9, `★ mid-air: slowest of ${air.length} airborne frames ${minHv.toFixed(2)} m/s (>= 90% of the run)`)
    // forward travel per game-second (the walker caps a frame at 1/20 s, so wall time is not game time at swiftshader fps)
    const pace = (a: number, z: number) => { let d = 0, g = 0; for (let i = Math.max(1, a); i < z; i++) { d += Math.hypot(rec[i].px - rec[i - 1].px, rec[i].pz - rec[i - 1].pz); g += Math.min(0.05, (rec[i].t - rec[i - 1].t) / 1000) } return g > 0 ? d / g : 0 }
    const before = pace(Math.max(1, i0 - 8), i0), during = pace(i0, i1 + 1)
    ok(during >= before * 0.85, `★ forward travel continued through the air: ${during.toFixed(2)} m/s in the air vs ${before.toFixed(2)} m/s on the run before it`)
  } else ok(false, 'the jump never landed inside 30 s')
}
ok(errors.length === 0, `0 page errors (${errors.slice(0, 2).join(' | ')})`)
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
