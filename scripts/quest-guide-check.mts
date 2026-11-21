// BETA M63 s1: the quest guide is a GLARE on the compass + a trail that fades in only when you face the mark.
//   A. the active quest shows on the compass as a glare ([data-glare]) at its bearing, brighter facing it
//   B. the trail (window.__questGuide.trailOpacity) is ~0 facing away, ~1 facing the mark, with an intermediate value on the way (a fade, not a pop)
//   C. no world pillar without ?pillar=1 (probe.pillars 0); with it, >= 1
//   E. (s2 GPS) a planted quest whose STRAIGHT line is not walkable (a ridge / a face / water): the route lands, every 1 m
//      of it stays under the walker's climb (MAX_WALK_GRADIENT), it is not the straight line, and facing the glare the
//      trail draws along it
//   D. 0 page errors
//   npx tsx scripts/quest-guide-check.mts [--base http://localhost:3204] [--shot path.png --phone]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const base = flag('--base', 'https://ather.games'), shot = flag('--shot', ''), phone = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
async function open(q: string) {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 700 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200))); await p.evaluateOnNewDocument('window.__name = (f) => f')
  // a BORN keeper: without a birth the errand stage is 'none' and there is no quest to point at (the first run of this
  // check, 11-21, failed A-C on prod and devwin alike for exactly that reason)
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* private */ } })
  await p.goto(`${base}/shimmer/open/ather?hour=13&waymark=greg${q}`, { waitUntil: 'load', timeout: 240000 })
  await poll(() => p.evaluate(() => typeof (window as any).__ather?.look === 'function' && (window as any).__questGuide?.glareBearing != null).catch(() => false), 240000)
  await sleep(2000); if (!phone) await p.mouse.click(550, 350); await sleep(500)
  return p
}
const probe = (p: Page) => p.evaluate(() => { const q = (window as any).__questGuide; return q ? { ...q } : null })
const look = (p: Page, deg: number) => p.evaluate((d: number) => (window as any).__ather.look((-d * Math.PI) / 180, 0), deg)
const glare = (p: Page) => p.evaluate(() => { const e = document.querySelector('[data-glare]') as HTMLElement | null; return e ? { rel: +e.dataset.rel!, bright: +e.dataset.bright! } : null })
try {
  const p = await open('')
  const q0 = await probe(p)
  ok(!!q0 && q0.glareBearing != null, `A. __questGuide probe present, active bearing ${q0?.glareBearing?.toFixed(1)}`)
  const b = q0?.glareBearing ?? 0
  // WAIT ON STATE, NOT SLEEPS: headless swiftshader runs ~1 fps on a dev server, so a fixed sleep reads a stale frame (the
  // first devwin run, 11-21, read the compass 800 ms after a turn and saw the previous heading)
  await look(p, b + 180)
  await poll(async () => { const q = await probe(p), g = await glare(p); return !!q && q.trailOpacity < 0.05 && !!g && Math.abs(Math.abs(g.rel) - 180) < 30 }, 60000)
  const away = await probe(p), gAway = await glare(p)
  ok(!!away && away.trailOpacity < 0.05 && !away.facing, `B. facing away: trailOpacity ${away?.trailOpacity}`)
  await look(p, b + 40)
  // turned 40 deg clockwise past the mark = the mark sits 40 deg to the LEFT of the notch (rel = bearing - heading = -40)
  await poll(async () => { const g = await glare(p); return !!g && Math.abs(g.rel + 40) < 4 }, 60000)
  const gSide = await glare(p)
  ok(!!gSide && Math.abs(gSide.rel + 40) < 4, `A. glare on the compass 40 deg off, on the left: rel ${gSide?.rel}`)
  await look(p, b); const samples: number[] = []
  await poll(async () => { const v = (await probe(p))?.trailOpacity ?? -1; samples.push(v); return v > 0.95 }, 60000)
  await poll(async () => { const g = await glare(p); return !!g && Math.abs(g.rel) < 4 }, 30000)
  const on = await probe(p), gOn = await glare(p)
  ok(!!on && on.trailOpacity > 0.95 && on.facing, `B. facing the mark: trailOpacity ${on?.trailOpacity}`)
  // A FADE, NOT A POP, proven per frame: sampling from outside cannot catch a 0.3 s fade on a ~1-3 fps headless page, so the
  // probe logs [opacity, dt] each frame and the opacity may never rise faster than 1 per fadeS. (A pop = 0 -> 1 in a short
  // frame.) Where the probe predates the log, fall back to an outside intermediate sample.
  const log: [number, number][] | undefined = on?.fadeLog, fadeS: number = on?.fadeS ?? 0.3
  if (log && log.length > 1) {
    let worst = 0, rises = 0, mid = 0
    for (let i = 1; i < log.length; i++) { const d = log[i][0] - log[i - 1][0], dt = Math.max(log[i][1], 1e-6); if (d > 1e-6) { rises++; worst = Math.max(worst, d / dt); if (log[i][0] < 0.999) mid++ } }
    ok(rises > 0 && worst <= 1 / fadeS + 0.05, `B. a fade, not a pop: opacity rose over ${rises} frame(s), never faster than ${(1 / fadeS).toFixed(2)}/s (worst ${worst.toFixed(2)}/s; ${mid} mid-fade frame(s); frame dt ${log.map(l => l[1].toFixed(2)).slice(-6).join(',')})`)
  } else ok(samples.some(v => v > 0.05 && v < 0.95), `B. a fade, not a pop: intermediate sample ${samples.find(v => v > 0.05 && v < 0.95)} (${samples.length} samples)`)
  ok(!!gOn && Math.abs(gOn.rel) < 4 && !!gAway && gOn.bright > gAway.bright && gOn.bright > 0.95, `A. glare at the notch and brighter facing it: ${gOn?.bright} vs ${gAway?.bright}`)
  ok(on?.pillars === 0, `C. no pillar without ?pillar=1 (${on?.pillars})`)
  // E. the GPS route: hunt a goal behind something you cannot walk straight over (only where s2 is deployed)
  const hasS2 = await p.evaluate(() => typeof (window as any).__questPlant === 'function')
  if (!hasS2) console.log('-  E. skipped: this build has no GPS route yet (window.__questPlant missing)')
  const here = (await probe(p))?.at as [number, number]
  let goal: [number, number] | null = null
  if (hasS2) hunt: for (const r of [60, 90, 130, 180, 240]) for (let k = 0; k < 24; k++) {
    const t = (k / 24) * Math.PI * 2, x = here[0] + Math.cos(t) * r, z = here[1] + Math.sin(t) * r
    if (!(await p.evaluate((x: number, z: number) => (window as any).__questStraight(x, z), x, z))) { goal = [x, z]; break hunt }
  }
  if (hasS2) ok(!!goal, `E. found a goal whose straight line is not walkable from (${here?.map(v => v.toFixed(0))}): ${goal?.map(v => v.toFixed(0))}`)
  if (goal) {
    await p.evaluate((x: number, z: number) => (window as any).__questPlant(x, z), goal[0], goal[1])
    let slice = 0
    const landed = await poll(async () => { const q = await probe(p); slice = Math.max(slice, q?.sliceMs ?? 0); return !!q?.route && !q.routeBusy && !q.route.straightClear }, 180000)
    const q = await probe(p), r = q?.route
    ok(landed && !!r, `E. the route landed: ${JSON.stringify(r)}`)
    ok(!!r && r.maxRise <= 1.035 + 1e-6, `E. never steeper than the walker climbs: max rise ${r?.maxRise?.toFixed(3)} per m (limit 1.035)`)
    ok(!!r && r.pts > 2 && r.mode !== 'straight', `E. not the straight line: ${r?.pts} points, ${r?.mode}, reached ${r?.reached}`)
    console.log(`   worst planning slice seen ${slice.toFixed(1)} ms (headless swiftshader wall clock)`)
    const b2 = q!.glareBearing!
    await look(p, b2)
    await poll(async () => { const q = await probe(p); return !!q && q.trailOpacity > 0.9 && q.trail.length > 2 }, 60000)
    const f = await probe(p)
    ok(!!f && f.trailOpacity > 0.9 && f.trail.length > 2, `E. facing the glare the trail draws along the route (${f?.trail.length} dots, opacity ${f?.trailOpacity?.toFixed(2)})`)
    if (shot) { await sleep(500); await p.screenshot({ path: shot.replace(/\.png$/, '-route.png') }) }
  }
  if (shot) { await sleep(500); await p.screenshot({ path: shot }) }
  const p2 = await open('&pillar=1'); await sleep(1500)
  const pq = await probe(p2); ok(!!pq && pq.pillars >= 1, `C. ?pillar=1 brings the pillar back (${pq?.pillars})`)
} catch (e) { ok(false, 'threw ' + String(e).slice(0, 200)) }
ok(errs.length === 0, `D. 0 page errors ${errs.join(' | ')}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'PASS quest-guide-check'); process.exit(fails ? 1 : 0)
