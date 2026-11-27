// ── M216 s1: the keeper body bench is ONE SOURCE per proportion. Owner, prod, desk 1280 + 390x844. READ-ONLY: never saves.
// Every face (Classic + the four sets) sits on the dials' head: at Chin taper 0 + Chin length 0 a set's head is where
// Classic's is (the M116 sets lifted it for their own baked chin = the double chin), the chin / eye sliders move a face set,
// every slider shows its live number, and every slider moves the figure. Shots: docs/looks/m216-s1-2026-11-26/<tag>-*.png
//   OWNER_KEY=... npx tsx scripts/m216-bench-sync-check.mts [--url https://ather.games] [--tag after]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), tag = flag('--tag', 'after')
const KEY = process.env.OWNER_KEY, DIR = 'docs/looks/m216-s1-2026-11-26'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
if (!KEY) { console.log('need OWNER_KEY'); process.exit(2) }
mkdirSync(DIR, { recursive: true })
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const p: Page = await br.newPage(); await p.setViewport({ width: 1280, height: 820 })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
const metric = (a: string) => p.$eval('[data-metrics]', (e, a) => e.getAttribute(a as string) ?? '', a)
const click = (sel: string) => p.$eval(sel, e => (e as HTMLElement).click())
const btn = (text: string) => p.evaluate((t: string) => [...document.querySelectorAll('button')].find(b => b.textContent === t)?.click(), text)
const setDial = (key: string, v: number) => p.evaluate((key: string, v: number) => {
  const el = document.querySelector(`[data-dial="${key}"]`) as HTMLInputElement
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v))
  el.dispatchEvent(new Event('input', { bubbles: true }))
}, key, v)
const dialVal = (key: string) => p.$eval(`[data-dial-value="${key}"]`, e => e.textContent ?? '').catch(() => null)
try {
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 120000 })
  await p.goto(`${url}/shimmer/dev/keeper-body`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForSelector('[data-pick="face-0"]', { timeout: 240000 })
  await p.waitForFunction(() => !/loading/.test(document.querySelector('[data-status]')?.textContent ?? ''), { timeout: 60000 }); await sleep(1000)
  await click('[data-act="compare"]'); await btn('Turntable'); await sleep(600)   // one figure, still, facing the camera
  // every slider shows its live number, including the M216 chin length + eye spacing / height
  const dials = await p.$$eval('[data-dial]', es => es.map(e => e.getAttribute('data-dial')!))
  for (const k of ['jaw', 'chin', 'eyeGap', 'eyeLift', 'headW', 'headH', 'neck']) ok(dials.includes(k), `slider ${k} on the bench`)
  let shown = 0; for (const k of dials) if (await dialVal(k)) shown++
  ok(dials.length > 0 && shown === dials.length, `every slider shows its live number (${shown}/${dials.length})`)
  ok(await dialVal('jaw') === '0.00', `Medium / Broad chin taper reads 0.00 (${await dialVal('jaw')})`)
  // every face at chin taper 0: the head sits where Classic's does (no baked chin lifting it), shot of each
  await click('[data-pick="face-0"]'); await sleep(500)
  const classicY = await metric('data-head-y'), classicH = await metric('data-height')
  for (let face = 0; face <= 4; face++) {
    await click(`[data-pick="face-${face}"]`); await sleep(900)
    const y = await metric('data-head-y'), h = await metric('data-height')
    ok(y === classicY && h === classicH, `face ${face} at chin taper 0: head ${y} / crown ${h} = Classic's ${classicY} / ${classicH} (no own chin)`)
    const c = (await (await p.$('canvas'))!.boundingBox())!
    await p.screenshot({ path: `${DIR}/${tag}-face${face}.png`, clip: { x: c.x + c.width * 0.3, y: c.y, width: c.width * 0.4, height: c.height * 0.55 } })
  }
  // on a face set the chin + eye sliders move the head (before: the set ignored them); the build fingerprint, not the canvas
  // (the idle float redraws the canvas every frame)
  await click('[data-pick="face-4"]'); await sleep(600)
  const dials4 = await p.$$eval('[data-dial]', es => es.map(e => e.getAttribute('data-dial')!))
  for (const k of dials4) {
    const dv0 = Number((await dialVal(k))!.replace('+', '')), el = await p.$(`[data-dial="${k}"]`)
    const [mn, mx] = await el!.evaluate(e => [Number((e as HTMLInputElement).min), Number((e as HTMLInputElement).max)])
    const a = await metric('data-sig')
    await setDial(k, dv0 + (mx - dv0 > dv0 - mn ? (mx - dv0) * 0.7 : -(dv0 - mn) * 0.7)); await sleep(500)
    const b = await metric('data-sig')
    await setDial(k, dv0); await sleep(400)
    ok(a !== b && await metric('data-sig') === a, `face 4 (Strong): slider ${k} moves the figure and comes back`)
  }
  // 390x844: fits, the new sliders reachable
  await p.setViewport({ width: 390, height: 844 }); await sleep(1200)
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390: no sideways page scroll')
  ok(await p.$eval('[data-dial-value="chin"]', e => { const r = e.getBoundingClientRect(); return r.width > 5 && r.right <= window.innerWidth + 1 }).catch(() => false), '390: the chin length number fits')
  await p.screenshot({ path: `${DIR}/${tag}-390.png` })
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
