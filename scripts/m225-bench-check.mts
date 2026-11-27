// ── M225 (Alex 11-27): the keeper body bench shows the WHOLE keeper (not just the head), every face slider is there and moves
// the live model, a cartoon head picked lands on the CLASSIC head shape (chin taper 0 + chin length 0), the new Hair size /
// height / forward dials move it, the avatar holds still (no auto-spin) and a drag turns it, on desk 1440x900 and phone
// 390x844 (one-finger drag); the player creator (fresh keeper, 390) holds still too and a one-finger drag turns it.
// READ-ONLY on the bench (never saves; Alex's saved numbers are read back and compared to the sliders).
// Shots: docs/looks/m225-2026-11-27/<tag>-*.png
//   OWNER_KEY=... npx tsx scripts/m225-bench-check.mts [--url https://ather.games] [--tag after] [--no-creator]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), tag = flag('--tag', 'after'), KEY = process.env.OWNER_KEY, DIR = 'docs/looks/m225-2026-11-27'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
if (!KEY) { console.log('need OWNER_KEY'); process.exit(2) }
mkdirSync(DIR, { recursive: true })
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }

async function bench(w: number, h: number, phone: boolean) {
  const vt = phone ? 'phone' : 'desk'
  const ctx = await br.createBrowserContext(), p: Page = await ctx.newPage()
  await p.setViewport({ width: w, height: h, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 })
  p.on('pageerror', e => errs.push(`${vt}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const metric = (a: string) => p.$eval('[data-metrics]', (e, a) => e.getAttribute(a as string) ?? '', a)
  const click = (sel: string) => p.$eval(sel, e => (e as HTMLElement).click())
  const dialVal = (key: string) => p.$eval(`[data-dial-value="${key}"]`, e => e.textContent ?? '').catch(() => null)
  const setDial = (key: string, v: number) => p.evaluate((key: string, v: number) => {
    const el = document.querySelector(`[data-dial="${key}"]`) as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, key, v)
  const view = () => p.evaluate(() => { const w = window as unknown as { __benchYaw?: () => number; __benchOrbit?: () => number[] }; return [w.__benchYaw?.() ?? NaN, ...(w.__benchOrbit?.() ?? [])] })
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'load', timeout: 120000 })
  const savedFile = await p.evaluate(async () => { const r = await fetch('/shimmer/save-keeper-proportions', { cache: 'no-store' }); return r.ok ? (await r.json()).models : null })
  ok(savedFile !== null || !url.startsWith('https'), `${vt}: the saved proportions file reads (owner)`)
  await p.goto(`${url}/shimmer/dev/keeper-body`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForSelector('[data-pick="head-0"]', { timeout: 240000 })
  await p.waitForFunction(() => !/loading/.test(document.querySelector('[data-status]')?.textContent ?? ''), { timeout: 60000 }); await sleep(2500)
  // 1. the whole keeper is on screen: the canvas sits inside the window and the edited figure's crown + feet project inside it
  const cv = await p.$eval('[data-bench-canvas]', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] })
  ok(cv[1] + cv[3] <= h + 1 && cv[3] >= 250, `${vt}: the bench canvas fits the window (top ${cv[1].toFixed(0)}, height ${cv[3].toFixed(0)} of ${h})`)
  const height = Number(await metric('data-height'))
  const fr = await p.evaluate((hh: number) => (window as unknown as { __benchFrame: (h: number, x: number) => number[] }).__benchFrame(hh, 0.42), height)
  ok(fr.length === 4 && fr[0] < 0.98 && fr[1] > -0.98 && Math.abs(fr[2]) < 1 && Math.abs(fr[3]) < 1, `${vt}: body + head both on screen (crown NDC y ${fr[0]?.toFixed(2)}, feet ${fr[1]?.toFixed(2)})`)
  await p.screenshot({ path: `${DIR}/${tag}-${vt}-bench.png` })
  // 2. Alex's saved numbers survive: Medium / Broad's sliders read the saved file
  const mb = savedFile?.['medium-broad'] ?? {}
  for (const k of ['headW', 'headH', 'eye', 'legs'] as const) if (typeof mb[k] === 'number') ok(Number((await dialVal(k))?.replace('+', '')) === mb[k], `${vt}: saved ${k} ${mb[k]} is on the slider (${await dialVal(k)})`)
  // 3. every face slider is there (incl. the M225 hair dials), shows its number, and moves the live model
  for (const k of ['jaw', 'chin', 'eye', 'eyeGap', 'eyeLift', 'mouthLift', 'hairSize', 'hairY', 'hairZ']) {
    const dv = await dialVal(k); ok(dv !== null, `${vt}: face slider ${k} on the bench (${dv})`)
    if (dv === null) continue
    const el = await p.$(`[data-dial="${k}"]`)
    const [mn, mx] = await el!.evaluate(e => [Number((e as HTMLInputElement).min), Number((e as HTMLInputElement).max)])
    const v0 = Number(dv.replace('+', '')), a = await metric('data-sig')
    await setDial(k, v0 + (mx - v0 > v0 - mn ? (mx - v0) * 0.7 : -(v0 - mn) * 0.7)); await sleep(500)
    const b = await metric('data-sig')
    if (k === 'eye' && !phone) { const c = (await (await p.$('canvas'))!.boundingBox())!; await p.screenshot({ path: `${DIR}/${tag}-desk-eye-big.png`, clip: { x: c.x + c.width * 0.3, y: c.y, width: c.width * 0.45, height: c.height * 0.5 } }) }
    await setDial(k, v0); await sleep(400)
    ok(a !== b && await metric('data-sig') === a, `${vt}: slider ${k} moves the live model and comes back`)
  }
  // 4. no auto-spin: over 3 s idle neither the figure nor the view turns
  const v1 = await view(); await sleep(3000); const v2 = await view()
  ok(v1.length >= 2 && v1.every((n, i) => Math.abs(n - v2[i]) < 1e-4), `${vt}: still over 3 s idle (yaw ${v1[0]?.toFixed(3)} -> ${v2[0]?.toFixed(3)}, view ${v1[1]?.toFixed(3)} -> ${v2[1]?.toFixed(3)})`)
  // 5. a drag turns it (mouse on the desk, one finger on the phone)
  const cx = cv[0] + cv[2] / 2, cy = cv[1] + cv[3] / 2
  if (phone) {
    await p.touchscreen.touchStart(cx - 80, cy)
    for (let i = 1; i <= 10; i++) { await p.touchscreen.touchMove(cx - 80 + i * 16, cy); await sleep(30) }
    await p.touchscreen.touchEnd()
  } else {
    await p.mouse.move(cx - 150, cy); await p.mouse.down()
    for (let i = 1; i <= 12; i++) { await p.mouse.move(cx - 150 + i * 25, cy); await sleep(30) }
    await p.mouse.up()
  }
  await sleep(1500)
  const v3 = await view()
  ok(Math.abs(v3[1] - v2[1]) > 0.2, `${vt}: a ${phone ? 'one-finger' : 'mouse'} drag turns the view round the keeper (${v2[1]?.toFixed(2)} -> ${v3[1]?.toFixed(2)} rad)`)
  await p.screenshot({ path: `${DIR}/${tag}-${vt}-dragged.png` })
  if (!phone) {   // reload, so the head shots below face the camera (a drag back lands wherever the damping lets it)
    await p.reload({ waitUntil: 'load', timeout: 240000 }); await p.waitForSelector('[data-pick="head-0"]', { timeout: 240000 })
    await p.waitForFunction(() => !/loading/.test(document.querySelector('[data-status]')?.textContent ?? ''), { timeout: 60000 }); await sleep(2500)
  }
  // 6. a cartoon head picked = the CLASSIC head shape: chin taper 0.00 + chin length 0.00, its mouth on (desk only)
  if (!phone) {
    await setDial('jaw', 0.5); await setDial('chin', 0.1); await sleep(300)
    for (const hd of [1, 4, 8]) {
      await click(`[data-pick="head-${hd}"]`); await sleep(900)
      ok(await dialVal('jaw') === '0.00' && await dialVal('chin') === '0.00', `head ${hd}: picked on the classic head (chin taper ${await dialVal('jaw')}, chin length ${await dialVal('chin')})`)
      const c = (await (await p.$('canvas'))!.boundingBox())!
      await p.screenshot({ path: `${DIR}/${tag}-head-${hd}.png`, clip: { x: c.x + c.width * 0.25, y: c.y, width: c.width * 0.5, height: c.height * 0.55 } })
    }
    const s0 = await metric('data-sig'); await setDial('hairSize', 1.2); await setDial('hairY', 0.03); await sleep(600)
    ok(await metric('data-sig') !== s0, 'D female: Hair size + Hair height move the hair')
    const c = (await (await p.$('canvas'))!.boundingBox())!
    await p.screenshot({ path: `${DIR}/${tag}-head-8-hair-tuned.png`, clip: { x: c.x + c.width * 0.25, y: c.y, width: c.width * 0.5, height: c.height * 0.55 } })
    ok(await p.$eval('[data-act="save"]', e => (e as HTMLButtonElement).disabled === false), 'edits are pending (unsaved: this check never saves)')
  }
  await ctx.close()
}

async function creator() {
  const ctx = await br.createBrowserContext(), p: Page = await ctx.newPage()
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  p.on('pageerror', e => errs.push(`creator: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await sleep(6000); await dismissStartCard(p).catch(() => false)
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))), 'creator: the birth gate shows (fresh keeper, 390)')
  const tap = async (re: RegExp) => {
    const b = await p.evaluate((src: string) => { const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
      for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) { const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 40) continue; const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue; if (r.width * r.height < area) { area = r.width * r.height; best = r } }
      return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 } }, re.source)
    if (b) await p.touchscreen.tap(b.x, b.y); return !!b
  }
  ok(await tap(/^BE BORN/), 'creator: tapped BE BORN')
  ok(await poll(() => p.evaluate(() => !!(window as unknown as { __creatorOrbit?: () => number[] }).__creatorOrbit?.().length), 40000), 'creator: the preview is up')
  await sleep(1500)
  const view = () => p.evaluate(() => (window as unknown as { __creatorOrbit: () => number[] }).__creatorOrbit())
  // the controls' first reading can lag their target prop by a few slow (swiftshader) frames: wait for one steady second first
  const v0 = await view(); let settled = false
  for (let i = 0; i < 20 && !settled; i++) { const x = await view(); await sleep(1000); const y = await view(); settled = x.every((n, j) => Math.abs(n - y[j]) < 1e-4) }
  ok(settled && Math.abs((await view())[0] - v0[0]) < 1e-4, `creator: the view settles with no turn round the keeper (azimuth ${v0[0]?.toFixed(4)} -> ${(await view())[0]?.toFixed(4)})`)
  const v1 = await view(); await sleep(3000); const v2 = await view()
  ok(v1.length === 3 && v1.every((n, i) => Math.abs(n - v2[i]) < 1e-4), `creator: preview still over 3 s idle (view ${v1.map(n => n.toFixed(4)).join('/')} -> ${v2.map(n => n.toFixed(4)).join('/')})`)
  const box = await p.$eval('[data-creator-preview]', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] })
  await p.screenshot({ path: `${DIR}/${tag}-creator-still.png` })
  const cx = box[0] + box[2] / 2, cy = box[1] + box[3] / 2
  await p.touchscreen.touchStart(cx - 80, cy)
  for (let i = 1; i <= 10; i++) { await p.touchscreen.touchMove(cx - 80 + i * 16, cy); await sleep(30) }
  await p.touchscreen.touchEnd(); await sleep(1500)
  const v3 = await view()
  ok(Math.abs(v3[0] - v2[0]) > 0.2, `creator: a one-finger drag turns the keeper (${v2[0]?.toFixed(2)} -> ${v3[0]?.toFixed(2)} rad)`)
  await p.screenshot({ path: `${DIR}/${tag}-creator-dragged.png` })
  await ctx.close()
}

try {
  if (!process.argv.includes('--only-creator')) { await bench(1440, 900, false); await bench(390, 844, true) }
  if (!process.argv.includes('--no-creator')) await creator()
} catch (e) { ok(false, `run threw: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors (${errs.join(' | ')})`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
