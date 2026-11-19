// BETA M25 proof: the Alkin rig (open/shared/folk-model.tsx), measured, not asserted (swiftshader is 1-2 fps).
// (1) THE CROWD: bench /shimmer/dev/folk at a phone viewport (390x844): 5 folk rigs + a keeper + a Moglin on screen,
//     0 page errors, draw calls + frame time printed. The bench is OWNER-GATED: the check visits /owner with OWNER_KEY
//     from .env first, and SKIPs the leg (printed) if it still gets a 403.
// (2) THE GAME: the continent at 390x844, keeper put at the densest cluster of door talkers: rigs mounted (>=1), draw
//     calls + frame time printed, 0 page errors. Measured 11-19: the continent has 9 talkers and its densest cluster is
//     ONE within 70 m, so in play today a phone never sees more than a rig or two; the bench is the ~6-on-screen case.
//     (The Moonwell five are Moglins, not the Alkin rig; Greg is the one rig at the Glade.)
//   npx tsx scripts/m25-folk-perf-check.mts [--url http://localhost:3203]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
const i = process.argv.indexOf('--url'), url = i > 0 ? process.argv[i + 1] : 'http://localhost:3203'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ownerKey = (() => { try { return /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() } catch { return undefined } })()   // the bench is owner-gated (page-shot.mts pattern)
const ok = (c: boolean, m: string) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
try {
  const measure = (pg: import('puppeteer-core').Page, probe: string) => pg.evaluate(`new Promise(res => {
    const calls = []; let frames = 0; const t0 = performance.now();
    function f() { frames++; calls.push(${probe}.calls()); if (performance.now() - t0 < 10000) requestAnimationFrame(f); else res({ frames, ms: performance.now() - t0, calls }) }
    requestAnimationFrame(f)
  })`) as Promise<{ frames: number; ms: number; calls: number[] }>
  const fmt = (m: { frames: number; ms: number; calls: number[] }) => `drawCalls(median)=${[...m.calls].sort((a, c) => a - c)[Math.floor(m.calls.length / 2)]} max=${Math.max(...m.calls)} frames=${m.frames}/${(m.ms / 1000).toFixed(1)}s avgFrame=${(m.ms / m.frames).toFixed(0)}ms`
  // 1 · the crowd: bench at phone size
  const b = await br.newPage(); await b.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const be: string[] = []; b.on('pageerror', e => be.push(String(e).slice(0, 200)))
  if (ownerKey) await b.goto(`${url}/owner?key=${encodeURIComponent(ownerKey)}`, { waitUntil: 'load', timeout: 60000 })
  const res = await b.goto(`${url}/shimmer/dev/folk`, { waitUntil: 'load', timeout: 180000 })
  if (res && res.status() === 403) console.log('  SKIP bench: owner-gated here (403); no OWNER_KEY in .env?')
  else {
    const up = await poll(() => b.evaluate(() => !!(window as any).__folkBench && (window as any).__folkBench.calls() > 0), 120000)
    ok(up, 'bench canvas up, probe reads draw calls')
    if (up) { const rigs = await b.evaluate(() => (window as any).__folkBench.rigs); console.log(`  PROOF bench 390x844: folk rigs=${rigs} (+ keeper + Moglin) ${fmt(await measure(b, 'window.__folkBench'))} (swiftshader, not asserted)`) }
    ok(be.length === 0, `bench page errors: ${be.length} ${be.join(' | ')}`)
  }
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
  const mounted = await poll(async () => (await p.evaluate(() => (window as any).__doorFolk.drawn().length)) >= 1, 90000)
  await sleep(3000)   // let any further near talkers mount before measuring
  const rigs: number = await p.evaluate(() => (window as any).__doorFolk.drawn().length)
  ok(mounted && rigs >= 1, `folk rigs mounted at the densest cluster: ${rigs} (cluster size ${best.n})`)
  console.log(`  PROOF continent 390x844: rigs=${rigs} ${fmt(await measure(p, 'window.__doorFolk'))} (swiftshader, not asserted) pageErrors=${errs.length}`)
  ok(errs.length === 0, `continent page errors: ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
