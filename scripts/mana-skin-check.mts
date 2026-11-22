// M80 (Alex 11-22): F = shield up, E = the car. Hold F (phone: the SHIELD hold) in BOTH worlds: nothing for 1 s, then the
// keeper's own Mana Skin climbs 10 per 2 mana, stops on release, stops at the cap (50). On Nyx, E gets in / out of the
// courser and F no longer does. ⚠ The stall + fill run on frame dt (clamped 0.1 s), so swiftshader at ~1 fps takes several
// real seconds per game second: the key-hold trace runs 14 s. The numbers are pinned by shared/vitals-economy.test.ts; this proves the wiring.
//   npx tsx scripts/mana-skin-check.mts [--url https://ather.games] [--phone]      (--phone = 390x844 touch, the SHIELD button)
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
async function page() {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1100, height: 700 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { try {
    if (sessionStorage.getItem('msc')) return; sessionStorage.setItem('msc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
  } catch { /* a storage-less frame */ } })
  return { p, errs }
}
const skin = (p: any) => p.evaluate(() => (window as any).__skin.cur() as number)
const mana = (p: any) => p.evaluate(() => (window as any).__casts.mana() as number)
async function down(p: any) {
  if (!phone) return p.keyboard.down('KeyF')
  const bb = await (await p.$('[data-touch="shield"]'))?.boundingBox(); if (bb) await p.touchscreen.touchStart(bb.x + bb.width / 2, bb.y + bb.height / 2)
}
const up = (p: any) => (phone ? p.touchscreen.touchEnd() : p.keyboard.up('KeyF'))
async function charge(p: any, where: string, errs: string[]) {
  await p.waitForFunction(() => !!(window as any).__skin && !!(window as any).__casts, { timeout: 180000 }); await sleep(1500)
  if (phone) ok(!!(await p.$('[data-touch="shield"]')), `${where}: the SHIELD hold is on the phone row`)
  const m0 = await mana(p), s0 = await skin(p)
  ok(s0 === 0, `${where}: no skin to start (${s0})`)
  await down(p)
  // the trace is taken on the page's clock, stamped when the page itself sees F held
  const tr = await p.evaluate(async () => {
    const w = window as any, out: [number, number, number][] = []
    const t = performance.now(); while (!w.__skin.held() && performance.now() - t < 3000) await new Promise(r => setTimeout(r, 20))
    const t0 = performance.now()
    while (performance.now() - t0 < 14000) { out.push([(performance.now() - t0) / 1000, w.__skin.cur(), w.__casts.mana()]); await new Promise(r => setTimeout(r, 80)) }
    return out
  }) as [number, number, number][]
  await up(p)
  const early = tr.filter(([t]) => t < 0.8), last = tr[tr.length - 1]
  ok(early.length > 0 && early.every(([, s]) => s === 0), `${where}: nothing for the 1 s stall (${early.length} samples < 0.8 s, max ${Math.max(0, ...early.map(x => x[1])).toFixed(2)})`)
  ok(last[1] > 0.5, `${where}: then the skin climbs (${last[1].toFixed(1)} by ${last[0].toFixed(1)} s)`)
  const spent = m0 - last[2]
  ok(spent > 0 && Math.abs(last[1] / spent - 5) < 0.6, `${where}: 10 skin per 2 mana (skin ${last[1].toFixed(1)} for ${spent.toFixed(2)} mana, ratio ${(last[1] / spent).toFixed(2)}; the refill is paused while it spends)`)
  await sleep(300); const r0 = await skin(p); await sleep(1500); const r1 = await skin(p)
  ok(Math.abs(r1 - r0) < 0.01, `${where}: letting go stops it (${r0.toFixed(2)} -> ${r1.toFixed(2)})`)
  // the cap: a scripted hold until it stops climbing (slow headless frames fill slowly: dt is clamped)
  await p.evaluate(() => (window as any).__skin.hold(true))
  let s = 0; for (let i = 0; i < 90 && s < 49.9; i++) { await sleep(1000); s = await skin(p) }
  const mc = await mana(p); await sleep(2000); const s2 = await skin(p), mc2 = await mana(p)
  await p.evaluate(() => (window as any).__skin.hold(null))
  ok(s >= 49.9 && s2 <= 50.001 && mc2 >= mc - 0.01, `${where}: stops at the cap 50 and spends no more (skin ${s2.toFixed(2)}, mana ${mc.toFixed(2)} -> ${mc2.toFixed(2)})`)
  const bar = await p.evaluate(() => !!document.querySelector('[data-hud] [data-skin], [data-skin]'))
  console.log(`  (health bar skin node present: ${bar})`)
  ok(errs.length === 0, `${where}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
}
{ // the Ather plot
  const { p, errs } = await page()
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.look === 'function', { timeout: 240000 }); await sleep(3000)
  await p.mouse.click(phone ? 195 : 550, phone ? 300 : 350).catch(() => {}); await sleep(500)
  await charge(p, 'plot', errs)
  await p.close()
}
{ // Nyx: E is the car now, F is the skin
  const { p, errs } = await page()
  await p.goto(`${url}/shimmer/open/continent?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.foot, { timeout: 240000 }); await sleep(2000)
  await p.mouse.click(phone ? 195 : 550, phone ? 300 : 350).catch(() => {}); await sleep(400)
  const mode = () => p.evaluate(() => (window as any).__drive.foot().mode as string)
  const poll = async (want: string) => { for (let i = 0; i < 30; i++) { if (await mode() === want) return true; await sleep(500) } return false }
  if (!phone) {
    await p.keyboard.press('KeyF'); await sleep(2000)
    ok(await mode() === 'drive', `nyx: F at the wheel no longer gets out (${await mode()})`)
    await p.keyboard.press('KeyE')
    ok(await poll('foot'), 'nyx: E gets out of the courser')
    await sleep(1500); await p.keyboard.press('KeyF'); await sleep(2000)
    ok(await mode() === 'foot', `nyx: F beside the courser no longer gets in (${await mode()})`)
    await p.keyboard.press('KeyE')
    ok(await poll('drive'), 'nyx: E gets back in')
    await p.keyboard.press('KeyE'); ok(await poll('foot'), 'nyx: and out again')
  } else {
    const tapE = async () => { const el = await p.$('[data-touch="get out"][data-touch-near]'); const bb = await el?.boundingBox(); if (bb) { await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); return true } await p.keyboard.press('KeyE'); return false }
    const tapped = await tapE()
    ok(await poll('foot'), `nyx phone: the E pill gets out (${tapped ? 'tapped the pill' : 'pill not found, pressed E'})`)
  }
  await sleep(2000)
  await charge(p, 'nyx on foot', errs)
}
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
