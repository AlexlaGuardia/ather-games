// M228 s2 prod check: the Exchange hall's counter no longer hides the Moglin attendants. A test keeper stands at the counter
//   (where the E prompt fires) and the hall's probe (__ather.lingstonSight, lingston-hall.tsx) raycasts from the real camera to
//   each attendant's head centre + shoulders: nothing may stand between (1.05 m counter = blocked by 'counter', only ears showed).
//   Run: --phone (390x844) and without (1440x900). Reads only (signs in as the existing test keeper dummy_m228_a, writes nothing).
//   npx tsx scripts/m228-s2-counter-check.mts [--phone] [--url https://ather.games] [--out /tmp/m228s2]
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
import { COUNTER, toWorld } from '../src/app/shimmer/open/ather/lingston'
if (!process.env.ATHER_SESSION_SECRET) {
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { upsertGoogleAccount } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), out = flag('--out', '/tmp/m228s2') + (PHONE ? '-390' : '-desk')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
const KA = upsertGoogleAccount('dummy-m228-dummy_m228_a', null, null)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage()
  if (PHONE) await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  else await p.setViewport({ width: 1440, height: 900 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.setCookie({ name: 'ather_session', value: mintSession(KA.user_id, KA.username ?? 'dummy_m228_a'), domain: new URL(url).hostname, path: '/', httpOnly: true })
  const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m228s2-seeded')) return
    sessionStorage.setItem('m228s2-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
  }, { TUT } as any)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  for (let k = 0; k < 4; k++) {   // a dev server's fast-refresh reload can land mid-boot: wait it out and start again
    try { await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 180000, polling: 1000 }); await sleep(3000); await dismissStartCard(p); break }
    catch (e) { if (k === 3 || !/context was destroyed|navigation/i.test(String(e))) throw e; await sleep(5000) }
  }
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
  const front = toWorld(0, COUNTER.z + 1.5), ahead = toWorld(0, COUNTER.z - 2)
  const yaw = Math.atan2(-(ahead.x - front.x), -(ahead.z - front.z))
  for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: { id: 'm228s2', tile: 'first-wilds', x: front.x, y: 0, z: front.z, biome: 2, made: 0 } }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  ok((await A('zone')) === 'wilds', '1. the keeper is in the Wilds')
  await sleep(6000)
  await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { ...front, yaw }); await sleep(3000)
  let prompt = ''
  for (let i = 0; i < 20 && !/E · Exchange attendant/.test(prompt); i++) { await sleep(500); prompt = await p.evaluate(() => document.body.innerText) }
  ok(/E · Exchange attendant/.test(prompt), '2. the keeper stands at the counter (the prompt reads "E · Exchange attendant")')
  await p.screenshot({ path: `${out}/counter.png` })
  type Pt = { clear: boolean; onScreen: boolean; blocker: string | null }
  const sight = await A('lingstonSight') as { i: number; head: Pt; shoulder: Pt }[] | undefined
  console.log('  sight', JSON.stringify(sight))
  ok(Array.isArray(sight) && sight.length === 3, `3. the hall's probe finds the three attendants (${sight?.length ?? 'no probe'})`)
  for (const s of sight ?? []) ok(s.head.clear && s.shoulder.clear, `4.${s.i} attendant ${s.i}: head + shoulders not hidden from the camera (head ${s.head.blocker ?? 'clear'}, shoulders ${s.shoulder.blocker ?? 'clear'})`)
  const mid = sight?.find(s => s.i === 1)
  ok(mid?.head.onScreen && mid?.shoulder.onScreen, '5. the attendant the keeper faces has head + shoulders on screen')
  ok(errs.length === 0, `6. no page errors (${errs.slice(0, 2).join(' | ')})`)
} finally { await br.close() }
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
