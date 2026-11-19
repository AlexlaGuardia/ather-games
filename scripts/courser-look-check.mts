// Check: BETA M35 COURSER BODIES (Alex's pick 11-19: Darter carriage-born, every other kind chunky). On the test track at
// 390x844: each kind (Tally darter, Dray hauler, Scree scrambler, Flick skitter, via ?model=) driven up to speed and shot
// from BEHIND (the chase camera you drive with) and from the SIDE; the wheels turn with the road; frames counted over 4 s
// with the stock Darter so the before (prod, the blockout) and after (the new bodies) compare on the same box.
// npx tsx scripts/courser-look-check.mts [--url U] [--out DIR] [--tag before|after]. Log to a FILE: slow on the box.
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const URL = flag('--url', 'https://ather.games'), OUT = flag('--out', '/tmp'), TAG = flag('--tag', 'after')
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const KINDS: [string, string][] = TAG === 'before' ? [['', 'darter']] : [['', 'darter'], ['tally', 'darter'], ['dray', 'hauler'], ['scree', 'scrambler'], ['flick', 'skitter']]
for (const [model, kind] of KINDS) {
  const p = await br.newPage(); const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
  await p.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* sandboxed */ } })
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  await p.goto(`${URL}/shimmer/open/drive?hour=13${model ? `&model=${model}` : ''}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive, { timeout: 240000 }); await wait(3000)
  await p.keyboard.press('KeyX'); await wait(800)   // 'press any key to drive' (X drives nothing)
  const name = model || 'stock'
  if (!model) {   // frames over 4 s, standing still (the same scene for before and after)
    const fps = await p.evaluate(`new Promise(res => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(n / 4) } requestAnimationFrame(f) })`) as number   // a string: tsx's __name helper does not exist in the page
    console.log(`   ${TAG}: ${fps.toFixed(2)} fps standing (stock Darter)`)
  }
  await p.evaluate(() => (window as any).__drive.input({ throttle: 1, steer: 0 })); await wait(5000)
  const sp = await p.evaluate(() => { const s = (window as any).__drive.state(); return Math.hypot(s.vx, s.vz) })
  await p.screenshot({ path: `${OUT}/courser-${name}-behind-${TAG}.png` })
  await p.evaluate(() => (window as any).__drive.cam('side')); await wait(1500)
  await p.screenshot({ path: `${OUT}/courser-${name}-side-${TAG}.png` })
  ok(sp > 3, `${name} (${kind}): drives (${sp.toFixed(1)} m/s) and is shot from behind + side`)
  ok(errs.length === 0, `${name}: no page errors (${errs.slice(0, 2).join(' | ')})`)
  await p.close()
}
console.log(fails ? `COURSER LOOK CHECK: ${fails} FAIL` : 'COURSER LOOK CHECK: PASS')
await br.close()
process.exit(fails ? 1 : 0)
