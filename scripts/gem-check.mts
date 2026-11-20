// ── MOREL'S AMMO BUBBLE, PLAYED (BETA M33 slice 1, play / Jin 2 16e8df5e, 11-19) ────────────────────────────────────────
// In the Wilds with the Repeater (12 rounds), real input only (R to draw, real left clicks to fire under pointer lock):
//   1. stowed: no bubble
//   2. firing: the bubble shows the rounds left and the count DROPS shot by shot; it is RED at 7 and under, not above
//   3. Morel speaks ONCE crossing 7 and ONCE at empty ('Morel:' on the message line), never per shot: exactly [low, empty]
//   4. let go: the bubble holds ~3 s, then is gone by ~4 s
//   (the gem's pulse per round is shared/morel.test.ts's: gemGlow; the screenshots show it lit)
//   7. (S2) STUCK: a keeper standing idle on the errand's first step (see Greg) with ?morel=fast (x20: the 4 min stall = 12 s)
//      gets ONE Morel hint ('greg' line on the message line), and not a second within the cooldown (15 s fast)
//   8. (S3) FOLK PING: a born keeper whose first Rinnshop stands: Morel reports Fennel's call ('Fennel says' on the message
//      line) ONCE, and the quest's meeting marker lights (journal marker on for 'rinquest'); a reload does not ping again
//   9. PHONE 390 x 844: the touch FIRE button (held) shows the bubble, and the bubble overlaps NO HUD piece or touch control
//   6. 0 page errors. Screenshot to --out (bubble white + red) for the LOOK.
// Hooks READ only (__morel.bubble/said, __ather.zone, __fpGun). Seeds a born keeper + Kael's loadout (fp-gun-check's seed).
//   npx tsx scripts/gem-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { RINQUEST_KEY } from '../src/app/shimmer/open/ather/rinquest'
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
  const geo = (pg: typeof p) => pg.evaluate(() => { const r = document.querySelector('[data-morel-bubble] > div')?.getBoundingClientRect(); return r ? { cx: r.x + r.width / 2, h: r.height, w: innerWidth } : null })
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
  { const g = await geo(p); ok(!!g && g.cx < g.w / 2 && g.h >= 50, `M51 desktop: bubble on the LEFT half, ~2x tall (${JSON.stringify(g)})`) }
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
  // 8 · S3: the first Rinnshop stands -> Fennel calls through the gem, her marker lights; once
  const r = await (await br.createBrowserContext()).newPage(); await r.setViewport({ width: 1280, height: 760 })
  r.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await r.evaluateOnNewDocument('window.__name = (f) => f')
  await r.evaluateOnNewDocument((k: string) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1')   // seed once: the reload keeps the game's own writes
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem(k, JSON.stringify({ v: 1, state: 'none', step: 0 }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [{ id: 'gem-check', kind: 'rinnshop', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [] }], chests: [], pieces: [] }))
  }, RINQUEST_KEY)
  // every Morel line ever drawn (a line lives 4 s; on this 1-2 fps box a read after the poll can miss it)
  await r.evaluateOnNewDocument(() => { const w = window as any; w.__morelSeen = []
    new MutationObserver(() => { for (const e of document.querySelectorAll('[data-say="morel"]')) { const t = e.textContent ?? ''; if (!w.__morelSeen.includes(t)) w.__morelSeen.push(t) } })
      .observe(document, { childList: true, subtree: true }) })
  await r.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 })
  const P = () => r.evaluate(() => (window as any).__morelPing?.ids ?? []) as Promise<string[]>
  ok(await poll(async () => (await P()).includes('rinquest'), 120000), `8. the Rinnshop stands: Morel pings for Fennel (${(await P()).join(',')})`)
  ok(await r.evaluate(() => ((window as any).__morelSeen as string[]).some(t => /Morel:.*Fennel says/.test(t))), "8. 'Morel: Fennel says…' on the message line")
  ok(await r.evaluate(() => (window as any).__morelPing.marker('rinquest')), "8. her meeting's marker is lit")
  await r.screenshot({ path: `${out}/4-ping.png` })
  await sleep(5000); ok((await P()).length === 1, '8. once, not on every tick')
  await r.reload({ waitUntil: 'load', timeout: 240000 }); await poll(() => r.evaluate(() => !!(window as any).__rinquest), 120000); await sleep(8000)
  ok((await P()).length === 0, '8. a reload (quest already active) does not ping again')
  // 9 · phone: touch fire shows the bubble; it sits clear of the HUD and the thumbs
  const ph = await (await br.createBrowserContext()).newPage()
  await ph.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  ph.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await ph.evaluateOnNewDocument('window.__name = (f) => f')
  await ph.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['repeater', 'charred-rifle'], primary: 'repeater', secondary: 'charred-rifle', kael: true,
      vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
  })
  await ph.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => ph.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!document.querySelector('[data-touch="fire"]')), 240000), '9. phone: in the Wilds, touch controls up')
  await sleep(3000)
  const tapAt = async (sel: string) => { const b = await ph.evaluate((q: string) => { const e = document.querySelector(q); const r = e?.getBoundingClientRect(); return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null }, sel); if (b) await ph.touchscreen.tap(b.x, b.y); return !!b }
  // the phone's 'Tap to start' (the game is paused under it), then the DRAW pill a thumb would tap
  const start = await ph.evaluate(() => { for (const e of document.querySelectorAll<HTMLElement>('button, div, span')) if ((e.innerText ?? '').trim() === 'Tap to start') { const r = e.getBoundingClientRect(); if (r.width) return { x: r.x + r.width / 2, y: r.y + r.height / 2 } } return null })
  if (start) { await ph.touchscreen.tap(start.x, start.y); await sleep(1500) }
  ok(await tapAt('[data-touch="draw"]'), '9. phone: tapped DRAW')
  await poll(async () => (await ph.evaluate(() => (window as any).__fpGun?.shown?.())) === true, 15000)
  const fb = await ph.evaluate(() => { const r = document.querySelector('[data-touch="fire"]')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  await ph.touchscreen.touchStart(fb.x, fb.y)
  const shownPh = await poll(() => ph.evaluate(() => !!document.querySelector('[data-morel-bubble]')), 20000)
  ok(shownPh, '9. phone: holding FIRE shows the bubble')
  { const g = await geo(ph); ok(!!g && g.cx < g.w / 2 && g.h >= 50, `M51 phone: bubble on the LEFT half, ~2x tall (${JSON.stringify(g)})`) }
  const hits = await ph.evaluate(() => {
    const b = document.querySelector('[data-morel-bubble]')?.getBoundingClientRect(); if (!b) return ['no bubble']
    const pad = 2, over = (r: DOMRect) => r.width > 0 && r.height > 0 && b.left < r.right - pad && b.right > r.left + pad && b.top < r.bottom - pad && b.bottom > r.top + pad
    const els = [...document.querySelectorAll<HTMLElement>('[data-touch], [data-hud]:not([data-hud="messages"])')]
    return els.filter(e => !e.contains(document.querySelector('[data-morel-bubble]')) && over(e.getBoundingClientRect())).map(e => e.getAttribute('data-touch') ?? e.getAttribute('data-hud') ?? '?')
  })
  ok(shownPh && hits.length === 0, `9. phone: the bubble overlaps nothing (${hits.join(',') || 'clear'})`)
  await ph.screenshot({ path: `${out}/5-phone.png` })
  await ph.touchscreen.touchEnd()
  ok(errs.length === 0, `6. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
