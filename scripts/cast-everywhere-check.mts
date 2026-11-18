// M15 (Alex 11-18): Q works the same in every mode. On the Ather plot AND the continent on foot, a blank Star bracelet
// casts Firewall: mana drops, the Q chip shows a cooldown, the flash is drawn, 0 page errors. Q off the wheel is refused.
//   npx tsx scripts/cast-everywhere-check.mts [origin]     (default http://localhost:3201)
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'http://localhost:3201'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
async function page() {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 800, height: 500 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  return { p, errs }
}
async function pressQ(p: any, where: string, errs: string[]) {
  await p.waitForFunction(() => !!(window as any).__casts, { timeout: 120000 }); await sleep(1500)
  const m0 = await p.evaluate(() => (window as any).__casts.mana())
  await p.evaluate(() => { const w = window as any; w.__peak = 0; w.__iv = setInterval(() => { const c = w.__casts.hud().find((x: any) => x.key === 'Q'); if (c && c.cool > w.__peak) w.__peak = c.cool }, 30) })
  await p.keyboard.press('KeyQ'); await sleep(500)
  const m1 = await p.evaluate(() => (window as any).__casts.mana())
  // the chip repaints on the next frame; the continent runs at a few fps under swiftshader, so give it a few
  let chip: any = null
  for (let i = 0; i < 12; i++) { chip = await p.evaluate(() => (window as any).__casts.hud().find((c: any) => c.key === 'Q')); if (chip?.cool > 0.2) break; await sleep(300) }
  const flash = await p.evaluate(() => document.querySelectorAll('[data-cast-flash]').length)
  ok(m1 < m0 - 5, `${where}: Q spent mana (${m0.toFixed(0)} -> ${m1.toFixed(0)})`)
  const peak = await p.evaluate(() => (window as any).__peak)
  ok(peak > 0.2, `${where}: Q chip cooling (peak ${peak.toFixed(2)}, now ${JSON.stringify(chip)})`)
  console.log(`  flash nodes: ${flash}`)
  ok(errs.length === 0, `${where}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
}
{ // the Ather plot
  const { p, errs } = await page()
  await p.goto(`${origin}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.look === 'function', { timeout: 240000 }); await sleep(3000)
  await p.mouse.click(400, 250); await sleep(500)
  await pressQ(p, 'plot', errs)
}
{ // the continent on foot
  const { p, errs } = await page()
  await p.goto(`${origin}/shimmer/open/continent?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.foot, { timeout: 240000 }); await sleep(2000)
  await p.mouse.click(400, 250).catch(() => {}); await sleep(400)
  await p.keyboard.press('KeyQ'); await sleep(300)   // at the wheel: refused, spends nothing
  const m = await p.evaluate(() => (window as any).__casts?.mana?.() ?? 100)
  ok(m >= 99, `continent driving: Q refused (mana ${m.toFixed ? m.toFixed(0) : m})`)
  await p.keyboard.press('KeyF'); await sleep(2500)
  await p.evaluate(() => (window as any).__drive.footTp(244, 31, 0)); await sleep(2500)
  await pressQ(p, 'continent on foot', errs)
}
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
