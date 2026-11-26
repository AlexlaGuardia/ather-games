// BETA M189: REBIND THE CONTROLLER (Alex 11-26: 'i need to be able to customize each button for the controller').
// A fake DualSense (as m186-pad-check) on /shimmer/open/ather, fresh anonymous context:
//   1. Options (START) > Controls lists the controller: Jump on ✕, Close on ○
//   2. click Jump, press ○ (B): Jump → ○, Close swaps onto ✕, a 'swapped' note shows
//   3. reload: B jumps, A no longer does; the keyboard keymap is the same bytes and Space still jumps
//   4. Reset controller: Jump back on ✕ (saved), A jumps again
//   npx tsx scripts/m189-padbind-check.mts [--url https://ather.games] [--desk-only] [--phone-only]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), deskOnly = process.argv.includes('--desk-only'), phoneOnly = process.argv.includes('--phone-only')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const KEYMAP = JSON.stringify({ v: 1, bound: { KeyL: 'KeyK' } })
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15 } as const

for (const [vp, w, h] of (phoneOnly ? [['phone', 390, 844]] : deskOnly ? [['desktop', 1100, 700]] : [['phone', 390, 844], ['desktop', 1100, 700]]) as [string, number, number][]) {
  const phone = vp === 'phone'
  const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS })
  try {
    const p: Page = await (await br.createBrowserContext()).newPage()
    await p.setViewport(phone ? { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: w, height: h })
    const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    await p.evaluateOnNewDocument('window.__name = (f) => f')
    await p.evaluateOnNewDocument((s: any) => {
      if (!sessionStorage.getItem('m189-seeded')) {
        sessionStorage.setItem('m189-seeded', '1')
        localStorage.setItem('ather:shimmer:birthRune', 'star')
        localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
        localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
        localStorage.setItem('open.keymap.v1', s.KEYMAP)
      }
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
      const pad = { id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons }
      let seen = false
      const W = window as any
      W.__fake = { set: (i: number, on: boolean) => { buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; if (on) seen = true; pad.timestamp++ } }
      Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [seen ? pad : null, null, null, null] })
      W.__raf = 0; const loop = () => { W.__raf++; requestAnimationFrame(loop) }; requestAnimationFrame(loop)
    }, { TUT, KEYMAP } as any)
    const poll = async (fn: () => Promise<boolean>, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(200) } return false }
    const frames = async (n: number) => { const f0 = await p.evaluate(() => (window as any).__raf); await poll(() => p.evaluate((f, n) => (window as any).__raf >= f + n, f0, n), 30000) }
    const press = async (b: keyof typeof BTN, ms = 120) => { await p.evaluate(i => (window as any).__fake.set(i, true), BTN[b]); await sleep(ms); await p.evaluate(i => (window as any).__fake.set(i, false), BTN[b]); await sleep(150); await frames(2) }
    const A = () => p.evaluate(() => { const a = (window as any).__ather, s = a.state(); return { y: s.py, panel: a.panel() } })
    const optsUp = () => p.evaluate(() => !!document.querySelector('[data-panel="options"]'))
    const jumpOn = async (b: keyof typeof BTN | 'Space') => {   // hold the button / key, watch the keeper's height
      for (let i = 0; i < 20 && Math.abs(await p.evaluate(() => (window as any).__ather.state().vy ?? 0)) > 0.01; i++) await frames(2)
      const y0 = (await A()).y
      if (b === 'Space') await p.keyboard.down('Space'); else await p.evaluate(i => (window as any).__fake.set(i, true), BTN[b])
      let top = y0; for (let i = 0; i < 12; i++) { await frames(1); top = Math.max(top, (await A()).y) }
      if (b === 'Space') await p.keyboard.up('Space'); else await p.evaluate(i => (window as any).__fake.set(i, false), BTN[b])
      await frames(3); for (let i = 0; i < 30 && (await A()).y > y0 + 0.05; i++) await frames(2)
      return top - y0
    }
    const glyph = (id: string) => p.evaluate(id => document.querySelector(`[data-padbind="${id}"] [data-padglyph]`)?.textContent ?? null, id)
    const stored = () => p.evaluate(() => { const m = JSON.parse(localStorage.getItem('shimmer.voxel.bindings.v1') ?? 'null'); return m ? { jump: m['move.jump'].pad.join(), close: m['ui.close'].pad.join() } : null })
    const openControls = async () => {
      for (let i = 0; i < 3 && !(await optsUp()); i++) { await press('START'); await poll(optsUp, 4000) }
      await p.evaluate(() => [...document.querySelectorAll('[data-panel="options"] button')].find(b => b.textContent?.trim() === 'Controls')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
      return poll(() => p.evaluate(() => !!document.querySelector('[data-padbinds]')), 6000)
    }
    const closeOpts = async () => { for (let i = 0; i < 4 && await optsUp(); i++) { await press('B'); await sleep(400) } return !(await optsUp()) }
    const load = async () => {
      await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
      ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__pad), 240000), `${vp}: in the Wilds, the pad bridge mounted`)
      await sleep(5000)
      if (phone) { await p.touchscreen.tap(w / 2, 300); await sleep(800) }
      await press('R3')
      ok(await poll(() => p.evaluate(() => (window as any).__pad.kind() === 'playstation')), `${vp}: the pad is seen`)
    }
    await load()
    const km0 = await p.evaluate(() => localStorage.getItem('open.keymap.v1'))
    // 1
    ok(await openControls(), `${vp}: 1. START > Controls shows the Controller list`)
    ok(await glyph('move.jump') === '✕' && await glyph('ui.close') === '○', `${vp}: 1. Jump ${await glyph('move.jump')}, Close ${await glyph('ui.close')}`)
    // 2
    await p.evaluate(() => (document.querySelector('[data-padbind="move.jump"]') as HTMLElement).click())
    ok(await poll(async () => (await glyph('move.jump')) !== '✕', 3000), `${vp}: 2. the row listens (${await glyph('move.jump')})`)
    await press('B')
    ok(await poll(async () => (await glyph('move.jump')) === '○', 4000) && await glyph('ui.close') === '✕', `${vp}: 2. ○ pressed: Jump ${await glyph('move.jump')}, Close ${await glyph('ui.close')}`)
    const said = await p.evaluate(() => document.querySelector('[data-padsaid]')?.textContent ?? '')
    ok(/swapped/.test(said), `${vp}: 2. the clash note: '${said}'`)
    ok(await optsUp(), `${vp}: 2. the press that bound did not close Options`)
    ok(JSON.stringify(await stored()) === JSON.stringify({ jump: 'B', close: 'A' }), `${vp}: 2. saved ${JSON.stringify(await stored())}`)
    if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/m189-controller-${vp}.png` }).catch(() => {})
    ok(await closeOpts(), `${vp}: 2. B still closes Options`)
    // 3
    await p.reload({ waitUntil: 'load', timeout: 240000 }); await sleep(1000)
    ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__pad), 240000), `${vp}: 3. reloaded`)
    await sleep(5000)
    if (phone) { await p.touchscreen.tap(w / 2, 300); await sleep(800) }
    await press('R3')
    await poll(() => p.evaluate(() => (window as any).__pad.kind() === 'playstation'))
    ok(JSON.stringify(await stored()) === JSON.stringify({ jump: 'B', close: 'A' }), `${vp}: 3. the rebind survived the reload`)
    const jb = await jumpOn('B')
    ok(jb > 0.2, `${vp}: 3. B jumps (+${jb.toFixed(2)} m)`)
    const ja = await jumpOn('A')
    ok(ja < 0.1, `${vp}: 3. A no longer jumps (+${ja.toFixed(2)} m)`)
    await sleep(600); await closeOpts()
    for (let i = 0; i < 3 && (await A()).panel; i++) { await press('B'); await sleep(400) }
    ok(await p.evaluate(() => localStorage.getItem('open.keymap.v1')) === km0, `${vp}: 3. the keyboard keymap is untouched`)
    if (!phone) { const js = await jumpOn('Space'); ok(js > 0.2, `${vp}: 3. Space still jumps (+${js.toFixed(2)} m)`) }
    // 4
    ok(await openControls(), `${vp}: 4. Controls again`)
    await p.evaluate(() => [...document.querySelectorAll('[data-padbinds] button')].find(b => /Reset controller/.test(b.textContent ?? ''))?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    ok(await poll(async () => (await glyph('move.jump')) === '✕', 3000) && await glyph('ui.close') === '○', `${vp}: 4. reset: Jump ${await glyph('move.jump')}, Close ${await glyph('ui.close')}`)
    ok(JSON.stringify(await stored()) === JSON.stringify({ jump: 'A', close: 'B' }), `${vp}: 4. reset saved ${JSON.stringify(await stored())}`)
    ok(await closeOpts(), `${vp}: 4. B closes Options`)
    const jr = await jumpOn('A')
    ok(jr > 0.2, `${vp}: 4. A jumps again (+${jr.toFixed(2)} m)`)
    ok(await p.evaluate(() => localStorage.getItem('open.keymap.v1')) === km0, `${vp}: 4. the keyboard keymap is still untouched`)
    ok(errs.length === 0, `${vp}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
  } catch (e) { ok(false, `${vp}: threw ${String(e).slice(0, 300)}`) }
  finally { await br.close() }
}
console.log(fails ? `M189 padbind: ${fails} FAIL` : 'M189 padbind: PASS')
process.exit(fails ? 1 : 0)
