// M78 (Alex 11-22): mana is felt. In BOTH worlds a cast stops the refill for 3 s, then it climbs again (0.4/s); on the plot a
// Shard Tonic drinks, and a second bottle inside the shared 15 s potion cooldown is refused with a line, the chip showing it.
// The numbers themselves are pinned by shared/vitals-economy.test.ts; this proves the wiring on a real page.
//   npx tsx scripts/mana-economy-check.mts [--url https://ather.games] [--phone]      (--phone = 390x844)
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
async function page() {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844 } : { width: 1100, height: 700 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('mec')) return; sessionStorage.setItem('mec', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['repeater'], primary: null, secondary: 'repeater', kael: false,
      vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: 'Stonewall' }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
    const slots: unknown[] = Array(32).fill(null)
    slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }; slots[3] = { id: 'shard_tonic', n: 2 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  })
  return { p, errs }
}
const mana = (p: any) => p.evaluate(() => (window as any).__casts.mana() as number)
/** Q, then: flat for the pause, climbing after. Samples on the page's own clock so slow headless frames cannot fake a pause. */
async function pause(p: any, where: string) {
  await p.waitForFunction(() => !!(window as any).__casts, { timeout: 180000 }); await sleep(1500)
  const m0 = await mana(p)
  // a press can land before the keeper may cast (slow headless boot): press again until the bar drops, up to 4 tries
  let spent = false
  for (let i = 0; i < 4 && !spent; i++) { await p.keyboard.press('KeyQ'); spent = await p.waitForFunction((m0: number) => { const w = window as any; if (w.__casts.mana() < m0 - 5) { w.__spentT = performance.now(); return true } return false }, { timeout: 5000, polling: 50 }, m0).then(() => true, () => false) }
  const trace = !spent ? [] : await p.evaluate(async (m0: number) => {
    const w = window as any, t0 = w.__spentT as number, out: [number, number][] = []
    while (performance.now() - t0 < 12000) {
      out.push([performance.now() - t0, w.__casts.mana()])
      await new Promise(r => setTimeout(r, 100))
    }
    return out
  }, m0) as [number, number][]
  ok(trace.length > 0, `${where}: Q spent mana (${m0.toFixed(1)} -> ${trace[0]?.[1]?.toFixed(1)})`)
  if (!trace.length) return
  // margins either side of the 3 s line: the spend is stamped up to a frame late
  const inPause = trace.filter(([t]) => t < 2.3 * 1000).map(([, m]) => m), after = trace.filter(([t]) => t > 4 * 1000)
  const spread = Math.max(...inPause) - Math.min(...inPause), last = after[after.length - 1]?.[1] ?? 0, atEnd = Math.max(...inPause)
  ok(spread < 0.05, `${where}: mana flat inside the 3 s pause (spread ${spread.toFixed(3)} over ${inPause.length} samples)`)
  ok(last > atEnd + 0.1, `${where}: mana climbs after the pause (${atEnd.toFixed(2)} -> ${last.toFixed(2)} by ${(after[after.length - 1]?.[0] / 1000).toFixed(1)} s)`)
  const rate = after.length > 2 ? (after[after.length - 1][1] - after[0][1]) / ((after[after.length - 1][0] - after[0][0]) / 1000) : 0
  // only an upper bound means anything here: the refill runs on frame dt clamped at 0.1 s, so swiftshader's ~1 fps reads far
  // below the dial (0.04-0.10/s measured 11-22). The 0.4/s itself is pinned by shared/vitals-economy.test.ts.
  ok(rate > 0 && rate < 0.45, `${where}: refill no faster than the 0.4/s dial (read ${rate.toFixed(2)}/s; slow headless frames read lower)`)
}
{ // the Ather plot: the pause, then the shared potion cooldown
  const { p, errs } = await page()
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.look === 'function', { timeout: 240000 }); await sleep(3000)
  await p.mouse.click(phone ? 195 : 550, phone ? 300 : 350); await sleep(500)
  await pause(p, 'plot')
  const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__ather[f](...args), fn, a)
  let held = false
  for (let i = 0; i < 40 && !held; i++) { const st = await A('stance') as any; if (st?.kind === 'item' && st.slot === 3) held = true; else { await p.keyboard.press('4'); await sleep(400) } }
  ok(held, 'plot: Shard Tonic in hand')
  await A('setMana', 20); await A('drink'); await sleep(400)
  const m1 = await mana(p)
  ok(Math.abs(m1 - 85) < 3, `plot: first tonic drunk (20 -> ${m1.toFixed(1)})`)
  let chip = false
  for (let i = 0; i < 10 && !chip; i++) { chip = await p.evaluate(() => /Potion\s*·?\s*1[0-5] s/.test((document.querySelector('[data-hud="status"]') as HTMLElement | null)?.innerText ?? document.body.innerText)); if (!chip) await sleep(300) }
  ok(chip, 'plot: the Potion cooldown chip shows')
  await A('setMana', 20); await A('drink'); await sleep(400)
  const m2 = await mana(p), said = await p.evaluate(() => document.body.innerText.includes('Too soon for another'))
  ok(m2 < 25, `plot: second bottle inside 15 s refused (mana ${m2.toFixed(1)})`)
  ok(said, 'plot: the refusal says why')
  const left = await p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []).filter((s: any) => s?.id === 'shard_tonic').reduce((n: number, s: any) => n + s.n, 0))
  ok(left === 1, `plot: the refused bottle is kept (${left} left)`)
  ok(errs.length === 0, `plot: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
  await p.close()
}
{ // the continent on foot: the same pause (the shared refill)
  const { p, errs } = await page()
  await p.goto(`${url}/shimmer/open/continent?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.foot, { timeout: 240000 }); await sleep(2000)
  await p.mouse.click(phone ? 195 : 550, phone ? 300 : 350).catch(() => {}); await sleep(400)
  await p.keyboard.press('KeyE'); await sleep(2500)
  await p.evaluate(() => (window as any).__drive.footTp(244, 31, 0)); await sleep(2500)
  await pause(p, 'continent on foot')
  ok(errs.length === 0, `continent: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
}
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
