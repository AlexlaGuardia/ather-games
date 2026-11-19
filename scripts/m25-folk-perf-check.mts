// BETA M25 proof: the Alkin rig (open/shared/folk-model.tsx). (1) bench /shimmer/dev/folk renders with 0 page errors;
// (2) a phone viewport (390x844) at the densest cluster of door talkers on the continent: rigs mounted (>=5), renderer
// draw calls + average frame time over ~10 s, printed (NOT asserted: swiftshader is 1-2 fps), 0 page errors.
// (The Moonwell five are Moglins, not the Alkin rig; Greg is the one rig at the Glade, so the Alkin crowd is at the doors.)
//   npx tsx scripts/m25-folk-perf-check.mts [--url http://localhost:3201]
import puppeteer from 'puppeteer-core'
const i = process.argv.indexOf('--url'), url = i > 0 ? process.argv[i + 1] : 'http://localhost:3201'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
try {
  // 1 · the bench
  const b = await br.newPage(); const be: string[] = []; b.on('pageerror', e => be.push(String(e).slice(0, 200)))
  await b.goto(`${url}/shimmer/dev/folk`, { waitUntil: 'load', timeout: 180000 })
  const canv = await poll(() => b.evaluate(() => !!document.querySelector('canvas')), 120000)
  await sleep(5000)
  ok(canv, 'bench canvas mounted'); ok(be.length === 0, `bench page errors: ${be.length} ${be.join(' | ')}`)
  await b.close()
  // 2 · phone viewport, door talkers
  const p = await br.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.goto(`${url}/shimmer/open/continent`, { waitUntil: 'load', timeout: 180000 })
  ok(await poll(() => p.evaluate(() => !!(window as any).__drive?.state && !!(window as any).__doorFolk?.all().length), 240000), 'continent up, door talkers known')
  const all: { key: string; x: number; z: number }[] = await p.evaluate(() => (window as any).__doorFolk.all())
  let best = { n: 0, x: 0, z: 0 }
  for (const a of all) { const n = all.filter(t => Math.hypot(t.x - a.x, t.z - a.z) < 70).length; if (n > best.n) best = { n, x: a.x, z: a.z } }
  console.log(`  talkers ${all.length}; densest cluster ${best.n} within 70 m of ${best.x.toFixed(0)},${best.z.toFixed(0)}`)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 15, z + 15, 0, 0), best.x, best.z)
  await sleep(4000)
  await p.evaluate((x, z) => (window as any).__drive.footTp(x + 8, z + 8, 0, -0.08), best.x, best.z)
  const mounted = await poll(async () => (await p.evaluate(() => (window as any).__doorFolk.drawn().length)) >= 5, 90000)
  const rigs: number = await p.evaluate(() => (window as any).__doorFolk.drawn().length)
  ok(mounted && rigs >= 5, `folk rigs mounted: ${rigs}`)
  const m: { frames: number; ms: number; calls: number[] } = await p.evaluate(`new Promise(res => {
    const calls = []; let frames = 0; const t0 = performance.now();
    function f() { frames++; calls.push(window.__doorFolk.calls()); if (performance.now() - t0 < 10000) requestAnimationFrame(f); else res({ frames, ms: performance.now() - t0, calls }) }
    requestAnimationFrame(f)
  })`)
  const med = [...m.calls].sort((a, c) => a - c)[Math.floor(m.calls.length / 2)]
  console.log(`  PROOF 390x844: rigs=${rigs} drawCalls(median)=${med} max=${Math.max(...m.calls)} frames=${m.frames}/${(m.ms / 1000).toFixed(1)}s avgFrame=${(m.ms / m.frames).toFixed(0)}ms (swiftshader, not asserted) pageErrors=${errs.length}`)
  ok(errs.length === 0, `continent page errors: ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
