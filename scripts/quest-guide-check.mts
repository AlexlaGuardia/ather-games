// BETA M63 s1: the quest guide is a GLARE on the compass + a trail that fades in only when you face the mark.
//   A. the active quest shows on the compass as a glare ([data-glare]) at its bearing, brighter facing it
//   B. the trail (window.__questGuide.trailOpacity) is ~0 facing away, ~1 facing the mark, with an intermediate value on the way (a fade, not a pop)
//   C. no world pillar without ?pillar=1 (probe.pillars 0); with it, >= 1
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
  await look(p, b + 180); await sleep(1500)
  const away = await probe(p), gAway = await glare(p)
  ok(!!away && away.trailOpacity < 0.05 && !away.facing, `B. facing away: trailOpacity ${away?.trailOpacity}`)
  await look(p, b + 40); await sleep(800)
  const gSide = await glare(p)
  ok(!!gSide && Math.abs(gSide.rel - 40) < 4, `A. glare on the compass 40 deg off: rel ${gSide?.rel}`)
  await look(p, b); const samples: number[] = []
  for (let i = 0; i < 40; i++) { samples.push((await probe(p))?.trailOpacity ?? -1); await sleep(40) }
  await sleep(1000)
  const on = await probe(p), gOn = await glare(p)
  ok(!!on && on.trailOpacity > 0.95 && on.facing, `B. facing the mark: trailOpacity ${on?.trailOpacity}`)
  ok(samples.some(v => v > 0.05 && v < 0.95), `B. a fade, not a pop: intermediate sample ${samples.find(v => v > 0.05 && v < 0.95)}`)
  ok(!!gOn && Math.abs(gOn.rel) < 4 && !!gAway && gOn.bright > gAway.bright && gOn.bright > 0.95, `A. glare at the notch and brighter facing it: ${gOn?.bright} vs ${gAway?.bright}`)
  ok(on?.pillars === 0, `C. no pillar without ?pillar=1 (${on?.pillars})`)
  if (shot) { await sleep(500); await p.screenshot({ path: shot }) }
  const p2 = await open('&pillar=1'); await sleep(1500)
  const pq = await probe(p2); ok(!!pq && pq.pillars >= 1, `C. ?pillar=1 brings the pillar back (${pq?.pillars})`)
} catch (e) { ok(false, 'threw ' + String(e).slice(0, 200)) }
ok(errs.length === 0, `D. 0 page errors ${errs.join(' | ')}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'PASS quest-guide-check'); process.exit(fails ? 1 : 0)
