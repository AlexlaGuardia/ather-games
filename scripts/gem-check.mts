// ── MOREL'S AMMO BUBBLE, PLAYED (BETA M33 slice 1, play / Jin 2 16e8df5e, 11-19) ────────────────────────────────────────
// In the Wilds with the Repeater (12 rounds), real input only (R to draw, real left clicks to fire under pointer lock):
//   1. stowed: no bubble
//   2. firing: the bubble shows the rounds left and the count DROPS shot by shot; it is RED at 7 and under, not above
//   3. Morel speaks ONCE crossing 7 and ONCE at empty ('Morel:' on the message line), never per shot: exactly [low, empty]
//   4. let go: the bubble holds ~3 s, then is gone by ~4 s
//   (the gem's pulse per round is shared/morel.test.ts's: gemGlow; the screenshots show it lit)
//   7. (S2) STUCK: a keeper standing idle on the errand's first step (see Greg) with ?morel=fast (x20: the 4 min stall = 12 s)
//      gets ONE Morel hint ('greg' line on the message line), and not a second within the cooldown (15 s fast)
//   6. 0 page errors. Screenshot to --out (bubble white + red) for the LOOK.
// Hooks READ only (__morel.bubble/said, __ather.zone, __fpGun). Seeds a born keeper + Kael's loadout (fp-gun-check's seed).
//   npx tsx scripts/gem-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/gem-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 760 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['repeater', 'charred-rifle'], primary: 'repeater', secondary: 'charred-rifle', kael: true,
      vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
  })
  const B = () => p.evaluate(() => (window as any).__morel?.bubble() ?? null) as Promise<{ show: boolean; n: number; red: boolean; alpha: number } | null>
  const said = () => p.evaluate(() => (window as any).__morel?.said() ?? []) as Promise<string[]>
  const drawn = () => p.evaluate(() => !!document.querySelector('[data-morel-bubble]'))
  const poll = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(150) } return false }
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__morel), 240000), 'in the Wilds, Morel mounted')
  await sleep(4000); await p.mouse.click(640, 380); await sleep(800)
  // 1 · stowed
  ok(!(await drawn()), '1. stowed: no bubble')
  // draw
  await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR')
  ok(await poll(async () => (await p.evaluate(() => (window as any).__fpGun?.shown?.())) === true, 15000), '   R drew the gun')
  await sleep(800)
  // 2 · fire the clip out, one real click at a time, sampling the bubble
  const seen: { n: number; red: boolean }[] = []
  let shotWhite = false, shotRed = false
  for (let i = 0; i < 30; i++) {
    // ★ hold until the round LEAVES (this box draws 1-2 fps: a 90 ms click lands between two frames and the game never sees it)
    const n0 = (await B())?.n ?? -1
    await p.mouse.down(); await poll(async () => { const b = await B(); return !!b && b.n !== n0 && b.show }, 6000); await p.mouse.up(); await sleep(150)
    const b = await B()
    if (b?.show && (!seen.length || seen[seen.length - 1].n !== b.n)) seen.push({ n: b.n, red: b.red })
    if (b?.show && !b.red && !shotWhite && await drawn()) { shotWhite = true; await p.screenshot({ path: `${out}/1-bubble.png` }) }
    if (b?.show && b.red && !shotRed && await drawn()) { shotRed = true; await p.screenshot({ path: `${out}/2-bubble-red.png` }) }
    if (b && b.n === 0) break
  }
  console.log(`   counts seen: ${seen.map(s => `${s.n}${s.red ? 'R' : ''}`).join(' ')}`)
  ok(seen.length >= 4 && seen.every((s, i) => i === 0 || s.n < seen[i - 1].n), '2. the count drops shot by shot while firing')
  ok(seen.every(s => s.red === (s.n <= 7)), '2. red at 7 and under, never above')
  ok(seen.some(s => s.n === 0), '2. fired the clip dry')
  // 3 · what Morel said
  const s = await said()
  ok(s.join(',') === 'low,empty', `3. Morel spoke exactly twice: [${s.join(',')}]`)
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-say="morel"]')].some(e => /Morel:/.test(e.textContent ?? ''))), "3. the line reads 'Morel: …' on the message line")
  // 4 · let go: holds ~3 s, gone by ~4 s (measured from the last click; a reload may run meanwhile)
  const t0 = Date.now()
  await sleep(2300)
  ok(await drawn(), `4. still shown ${((Date.now() - t0) / 1000).toFixed(1)} s after release`)
  ok(await poll(async () => !(await drawn()), 6000), `4. gone after the hold (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
  ok(Date.now() - t0 >= 3000, '4. not before ~3 s')
  // 7 · S2: idle on the errand -> one hint, not repeated inside the cooldown
  const q = await (await br.createBrowserContext()).newPage(); await q.setViewport({ width: 1280, height: 760 })
  q.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await q.evaluateOnNewDocument('window.__name = (f) => f')
  await q.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })   // born, gems not given: stage 'greg'
  await q.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg&morel=fast`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => q.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__morelHints), 240000), '7. in the Wilds on the errand, hints mounted')
  const H = () => q.evaluate(() => (window as any).__morelHints.said()) as Promise<string[]>
  const t1 = Date.now()
  ok(await poll(async () => (await H()).length >= 1, 120000), `7. standing idle: Morel gives a hint (${((Date.now() - t1) / 1000).toFixed(0)} s; fast stall = 12 s)`)
  const h1 = await H()
  ok(h1[0]?.startsWith('greg:0'), `7. it is the errand stage's first hint (${h1.join(',')})`)
  ok(await q.evaluate(() => [...document.querySelectorAll('[data-say="morel"]')].some(e => /Gregory/.test(e.textContent ?? ''))), '7. the hint is on the message line')
  await sleep(8000)
  ok((await H()).length === 1, `7. not repeated inside the cooldown (${(await H()).join(',')})`)
  await q.screenshot({ path: `${out}/3-hint.png` })
  ok(errs.length === 0, `6. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
