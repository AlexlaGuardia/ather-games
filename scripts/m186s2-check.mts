// BETA M186 s2: a pad player HEARS the game, the mouse can take over (a cursor), and prompts name the pad's button.
// Chrome only lets audio run after a real click / key / tap (a gamepad press is NOT a user gesture), so a pad-only start
// leaves the one AudioContext suspended forever. The check runs Chrome with that policy pinned (--autoplay-policy).
//   A (pad-only, 390 + desktop): a fake DualSense, no click / key / tap. The pad walks (a footstep is asked for) while
//     the context is suspended -> a 'sound is off' note is on screen. Then ONE real gesture -> the context runs, the note
//     goes, and the next footstep is played on a running clock.
//   B (desktop): with the pad the cursor is hidden; the mouse moves -> a cursor, the pad chip gone, Click to play back;
//     a pad press -> hidden again.
//   C (390 + desktop): before Greg, the prompt says '□ · Gregory' with the pad, 'E · Gregory' after the mouse / a key.
//   D (desktop, fresh context): a keyboard-only start (trusted W) -> the context runs and footsteps play.
//   npx tsx scripts/m186s2-check.mts [--url https://ather.games] [--desk-only] [--phone-only]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), deskOnly = process.argv.includes('--desk-only'), phoneOnly = process.argv.includes('--phone-only')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=document-user-activation-required']
const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const BTN = { A: 0, B: 1, X: 2, Y: 3, R3: 11 } as const

async function open(vp: string, w: number, h: number, pad: boolean) {
  const phone = vp === 'phone'
  const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS })
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: w, height: h })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    if (!sessionStorage.getItem('m186s2-seeded')) {
      sessionStorage.setItem('m186s2-seeded', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
      localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    }
    const W = window as any
    // every AudioContext the page makes, so the check can read its state
    W.__acs = []
    const AC = W.AudioContext
    if (AC) W.AudioContext = class extends AC { constructor(...a: any[]) { super(...a); W.__acs.push(this) } }
    if (s.pad) {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
      const gp = { id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons }
      let seen = false
      W.__fake = { set: (i: number, on: boolean) => { buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; if (on) seen = true; gp.timestamp++ }, axes: (a: number[]) => { gp.axes = a; gp.timestamp++ } }
      Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [seen ? gp : null, null, null, null] })
    }
    W.__raf = 0; const loop = () => { W.__raf++; requestAnimationFrame(loop) }; requestAnimationFrame(loop)
  }, { TUT, pad } as any)
  return { br, p, errs, phone }
}

for (const [vp, w, h] of (phoneOnly ? [['phone', 390, 844]] : deskOnly ? [['desktop', 1100, 700]] : [['phone', 390, 844], ['desktop', 1100, 700]]) as [string, number, number][]) {
  const { br, p, errs, phone } = await open(vp, w, h, true)
  try {
    const poll = async (fn: () => Promise<boolean>, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(200) } return false }
    const frames = async (n: number) => { const f0 = await p.evaluate(() => (window as any).__raf); await poll(() => p.evaluate((f, n) => (window as any).__raf >= f + n, f0, n), 30000) }
    const press = async (b: keyof typeof BTN, ms = 120) => { await p.evaluate(i => (window as any).__fake.set(i, true), BTN[b]); await sleep(ms); await p.evaluate(i => (window as any).__fake.set(i, false), BTN[b]); await sleep(150); await frames(2) }
    const axes = (a: number[]) => p.evaluate(a => (window as any).__fake.axes(a), a)
    const steps = () => p.evaluate(() => (window as any).__sfx?.asked?.()['step-grass'] ?? 0)
    const ac = () => p.evaluate(() => { const a = (window as any).__acs as AudioContext[]; return { n: a.length, st: a.map(c => c.state).join(','), t: a[0]?.currentTime ?? 0, act: (navigator as any).userActivation?.hasBeenActive ?? null } })
    const walk = async (ms: number) => { await axes([0, -1, 0, 0]); await sleep(ms); await axes([0, 0, 0, 0]); await frames(3) }
    const note = () => p.evaluate(() => { const e = document.querySelector('[data-audio-locked]') as HTMLElement | null; return e ? e.innerText : null })
    const cursor = () => p.evaluate(() => getComputedStyle(document.querySelector('canvas') ?? document.body).cursor)

    await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
    ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__pad), 240000), `${vp}: in the Wilds, the pad bridge mounted`)
    await sleep(5000)
    // A: pad only
    await press('R3')
    ok(await poll(() => p.evaluate(() => (window as any).__pad.kind() === 'playstation')), `${vp}: A. the pad is in use`)
    const s0 = await steps(); await walk(2500)
    const a0 = await ac()
    ok(await steps() > s0, `${vp}: A. the pad walks and a footstep is asked for (${s0} -> ${await steps()})`)
    ok(a0.n >= 1 && a0.st.includes('suspended') && a0.act === false, `${vp}: A. no gesture yet: the context is suspended (${JSON.stringify(a0)})`)
    ok(!!(await poll(async () => !!(await note()), 5000)), `${vp}: A. a 'sound is off' note is on screen ("${await note()}")`)
    // one real gesture
    if (phone) await p.touchscreen.tap(w / 2, 300)
    else await p.mouse.click(w / 2, h / 2)
    await sleep(800)
    ok(await poll(async () => (await ac()).st.split(',').every(s => s === 'running'), 8000), `${vp}: A. one real gesture -> the context runs (${JSON.stringify(await ac())})`)
    await press('R3')   // back on the pad
    await sleep(400)
    ok(await note() === null, `${vp}: A. the note is gone ("${await note()}")`)
    const s1 = await steps(), t1 = (await ac()).t; await walk(2500)
    const played = await p.evaluate(() => (window as any).__sfx?.played?.()['step-grass'] ?? 0)
    ok(await steps() > s1 && (await ac()).t > t1 + 0.5 && played > 0, `${vp}: A. a footstep plays on a running clock (asked ${s1} -> ${await steps()}, played ${played}, clock ${t1.toFixed(1)} -> ${(await ac()).t.toFixed(1)})`)
    if (!phone) {
      // B: cursor hand-over
      if (await p.evaluate(() => !!document.pointerLockElement)) { await p.keyboard.press('Escape'); await sleep(600) }
      await press('R3'); await sleep(300)
      ok(await cursor() === 'none' && await p.evaluate(() => (window as any).__pad.kind()) === 'playstation', `${vp}: B. with the pad the cursor is hidden (${await cursor()})`)
      await p.mouse.move(200, 200); await p.mouse.move(260, 240, { steps: 4 }); await sleep(400)
      ok(await cursor() !== 'none', `${vp}: B. the mouse moves -> a cursor (${await cursor()})`)
      ok(await p.evaluate(() => (window as any).__pad.kind()) === null && !(await p.$('[data-pad-hint]')), `${vp}: B. the mouse took over: no pad chip`)
      ok(await p.evaluate(() => document.body.innerText.includes('Click to play')), `${vp}: B. Click to play is back`)
      await press('R3'); await sleep(300)
      ok(await cursor() === 'none' && await p.evaluate(() => (window as any).__pad.kind()) === 'playstation', `${vp}: B. a pad press -> hidden again (${await cursor()})`)
    }
    // C: Greg's prompt names the pad's button
    await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' }))
    ok(await poll(() => p.evaluate(() => (window as any).__ather.zone() === 'glade' && !!(window as any).__greg), 120000), `${vp}: C. in the Glade`); await sleep(4000)
    const near = () => p.evaluate(() => (window as any).__ather?.near?.()?.kind ?? null)
    const at = async (x: number, z: number, yaw: number) => { await poll(() => p.evaluate(() => !!(window as any).__ather?.gladeAt), 30000); return p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), x, z, yaw) }
    const greg = await p.evaluate(() => { const g = (window as any).__greg; const v = typeof g === 'function' ? g() : typeof g.at === 'function' ? g.at() : g; return { x: v.x, z: v.z } })
    let faced = false
    for (const d of [2, 1.6, 2.4]) { for (let i = 0; i < 12 && !faced; i++) { const a = i * Math.PI / 6; await at(greg.x + Math.sin(a) * d, greg.z + Math.cos(a) * d, a); faced = await poll(async () => (await near()) === 'greg', 2500) } if (faced) break }
    ok(faced, `${vp}: C. stood before Greg`)
    await press('R3')
    const promptHas = (s: string) => p.evaluate(s => document.body.innerText.includes(s), s)
    ok(await poll(() => promptHas('□ · Gregory'), 15000) && !(await promptHas('E · Gregory')), `${vp}: C. with the pad the prompt says '□ · Gregory'`)
    if (phone) await p.touchscreen.tap(w / 2, 120)
    else { await p.mouse.move(300, 300); await p.mouse.move(340, 320, { steps: 3 }) }
    await sleep(500)
    if (!phone) ok(await poll(() => promptHas('E · Gregory'), 8000), `${vp}: C. the mouse took over: the prompt says 'E · Gregory'`)
    ok(errs.length === 0, `${vp}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
  } catch (e) { ok(false, `${vp}: threw ${String(e).slice(0, 300)}`) }
  await br.close()
}
// D: keyboard only
if (!phoneOnly) {
  const { br, p, errs } = await open('desktop', 1100, 700, false)
  try {
    const poll = async (fn: () => Promise<boolean>, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(200) } return false }
    await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
    ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds'), 240000), `keys: in the Wilds`)
    await sleep(5000)
    await p.keyboard.down('KeyW'); await sleep(3000); await p.keyboard.up('KeyW'); await sleep(500)
    const r = await p.evaluate(() => ({ st: ((window as any).__acs as AudioContext[]).map(c => c.state).join(','), played: (window as any).__sfx?.played?.()['step-grass'] ?? 0 }))
    ok(r.st.length > 0 && r.st.split(',').every(s => s === 'running') && r.played > 0, `keys: a keyboard-only start has sound (${JSON.stringify(r)})`)
    ok(!(await p.$('[data-audio-locked]')), `keys: no 'sound is off' note`)
    ok(errs.length === 0, `keys: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
  } catch (e) { ok(false, `keys: threw ${String(e).slice(0, 300)}`) }
  await br.close()
}
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
