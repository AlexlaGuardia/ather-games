// BETA M148: the Backbone's burst rhythm, on prod, in the Ather. Fresh anonymous profiles (never a real save), every non-GET stubbed.
// PHONE 390x844 (the fire button) and DESKTOP 1280x760 (the mouse): draw the Backbone (R), then
//   1 hold 3 s of sim time = 15 rounds, bursts 0.63 s apart, rounds 0.09  2 release: the burst in flight finishes, then nothing
//   3 a tap = 3 rounds  4 every round its own sound (3 oscillators a shot) and its own streak, the gun's snap on it
//   5 emptied: one reload, the clip back  6 the Repeater held keeps firing (M151; one a pull before)
// TUNER (owner): the two burst dials are there for the Backbone only, save, survive a reload, reach the gun in the Ather, reset.
// Times are read off the combat clock (a slow software GPU runs the sim slower than the wall).
//   OWNER_KEY=... npx tsx scripts/m148-backbone-check.mts [--url ...] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { RANGE_GUNS } from '../src/app/shimmer/open/shared/gunplay'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), OUT = flag('--out', '/tmp'), KEY = process.env.OWNER_KEY
const bb = RANGE_GUNS.find(g => g.id === 'backbone')!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(200) } return false }
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const LO = { v: 1, guns: ['backbone', 'repeater'], primary: 'backbone', secondary: 'repeater', kael: true, vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] })
const errs: string[] = []
async function page(phone: boolean) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200))); await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    const co = AudioContext.prototype.createOscillator; (window as any).__osc = 0; AudioContext.prototype.createOscillator = function () { (window as any).__osc++; return co.call(this) }
    if (sessionStorage.getItem('m148')) return; sessionStorage.setItem('m148', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut)); localStorage.setItem('open.loadout.v1', JSON.stringify(s.lo)) }, { tut: TUT, lo: LO })
  return p
}
async function wilds(p: Page, phone: boolean) {
  await p.goto(`${url}/shimmer/open/ather?hour=14&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__ather?.combat, { timeout: 240000 }); await sleep(4000)
  if (phone) await p.touchscreen.tap(195, 500); else await p.mouse.click(640, 300)
  await sleep(1500)
}
const gun = (p: Page) => p.evaluate(() => { const c = (window as any).__ather.combat(); return { id: c.gun.id, ammo: c.keeper.ammo, rel: c.keeper.reloading, cd: c.gun.fireCd, gap: c.gun.burstGap, dmg: c.gun.damage, clock: c.clock, osc: (window as any).__osc } })
const tapKey = async (p: Page, k: 'KeyR') => { await p.keyboard.down(k); await sleep(80); await p.keyboard.up(k); await sleep(1500) }
async function run(phone: boolean) {
  const L = phone ? 'phone' : 'desktop', p = await page(phone); await wilds(p, phone); await tapKey(p, 'KeyR')
  ok(await poll(async () => (await gun(p)).id === 'backbone'), `${L}: the Backbone is in hand`); await sleep(1500)
  const g0 = await gun(p); ok(g0.cd === bb.fireCd && g0.gap === bb.burstGap && g0.dmg === bb.damage, `${L}: its row (gap ${g0.gap}, delay ${g0.cd}, ${g0.dmg} a round)`)
  // the trace: a row per round the frame it left, on the combat clock; the gun's snap and the new streaks beside it
  await p.evaluate(() => { const W = window as any; W.__tr = []; W.__dur = 0; let a = W.__ather.combat().keeper.ammo; const seen = new WeakSet()
    const f = () => { const c = W.__ather.combat(), k = c.keeper; let st = 0; for (const r of c.rounds) if (!seen.has(r)) { seen.add(r); st++ }
      if (k.ammo < a) W.__tr.push({ t: c.clock, n: a - k.ammo, st, kick: W.__fpGun?.kick?.() ?? -1 }); a = k.ammo; requestAnimationFrame(f) }; requestAnimationFrame(f) })
  const tr = () => p.evaluate(() => (window as any).__tr as { t: number; n: number; st: number; kick: number }[]), clear = () => p.evaluate(() => { (window as any).__tr.length = 0 })
  const fireAt = phone ? await p.evaluate(() => { const r = document.querySelector('[data-touch="fire"]')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }) : { x: 640, y: 380 }
  const cdp = await p.createCDPSession()
  const press = () => phone ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fireAt] }) : p.mouse.down(), lift = () => phone ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : p.mouse.up()
  const fill = () => p.evaluate(() => { const c = (window as any).__ather.combat(); c.keeper.ammo = c.gun.clip; c.keeper.reloading = 0; c.keeper.hp = c.keeper.maxHp })
  const osc0 = (await gun(p)).osc
  // 1. hold
  await press(); ok(await poll(async () => { const t = await tr(); return t.length > 0 && (await gun(p)).clock - t[0].t > 2.9 }), `${L}: held for 3 s of combat time`)
  if (phone) await p.screenshot({ path: `${OUT}/m148-${L}.png` })
  const atLift = (await tr()).reduce((s, r) => s + r.n, 0); await lift(); await sleep(6000)
  const T = await tr(), t0 = T[0].t, all = T.flatMap(r => Array.from({ length: r.n }, () => r.t - t0)), in3 = all.filter(t => t <= 2.95).length
  ok(in3 === 15, `1. ${L}: hold 3 s = ${in3} rounds`)
  const starts = all.filter((_, i) => i % 3 === 0), drift = starts.map((t, i) => t - i * 0.63), worst = Math.max(...drift.map(Math.abs)); ok(worst <= 0.055, `1. ${L}: ${starts.length} bursts, 0.63 s apart (worst off ${worst.toFixed(3)} s, a frame is 0.05)`)
  ok(all.every((t, i) => i % 3 === 0 || Math.abs(t - starts[Math.floor(i / 3)] - (i % 3) * 0.09) <= 0.055), `1. ${L}: rounds 0.09 s apart`)
  ok(all.length % 3 === 0 && all.length - atLift <= 5, `2. ${L}: released at ${atLift}, ended on ${all.length} (whole bursts)`)
  ok(T.reduce((s, r) => s + r.st, 0) >= all.length - 1, `4. ${L}: ${T.reduce((s, r) => s + r.st, 0)} streaks for ${all.length} rounds`)
  ok((await gun(p)).osc - osc0 >= all.length * 3, `4. ${L}: ${((await gun(p)).osc - osc0) / 3} shot sounds for ${all.length} rounds`)
  ok(T.every(r => r.kick > 0), `4. ${L}: the gun snaps on every round (${T.map(r => r.kick.toFixed(1)).join(' ')})`)
  // 3. tap
  await fill(); await sleep(1500); await clear(); await press(); await sleep(120); if (!(await tr()).length) await sleep(250); await lift(); await sleep(5000)
  const n = (await tr()).reduce((s, r) => s + r.n, 0); ok(n === 3, `3. ${L}: a tap = ${n} rounds`)
  // 5. empties and reloads
  await p.evaluate(() => { const c = (window as any).__ather.combat(); c.keeper.ammo = 5 }); await sleep(500); await clear(); await press()
  ok(await poll(async () => (await gun(p)).rel > 0), `5. ${L}: emptied, it reloads`); await lift()
  ok(await poll(async () => { const g = await gun(p); return g.rel <= 0 && g.ammo === bb.clip }), `5. ${L}: the clip is back (${(await gun(p)).ammo})`)
  const n5 = (await tr()).reduce((s, r) => s + r.n, 0); ok(n5 === 5, `5. ${L}: 5 rounds left = ${n5} fired`)
  // 6. the Repeater: one a pull, as before
  await tapKey(p, 'KeyR'); ok(await poll(async () => (await gun(p)).id === 'repeater'), `6. ${L}: the Repeater in hand`); await sleep(1500); await clear()
  await press(); await poll(async () => (await tr()).reduce((s, r) => s + r.n, 0) >= 2, 30000); await lift(); await sleep(800); const n6 = (await tr()).reduce((s, r) => s + r.n, 0); ok(n6 >= 2, `6. ${L}: the Repeater held = ${n6} rounds (M151: it keeps firing)`)
  await p.close()
}
try {
  const only = flag('--only', '')
  if (!only || only === 'phone') await run(true)
  if (!only || only === 'desktop') await run(false)
  if ((!only || only === 'tuner') && KEY) {
    const p = await page(false); await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
    const tuner = async () => { await p.goto(`${url}/shimmer/dev/guns`, { waitUntil: 'load', timeout: 120000 }); await p.waitForSelector('[data-gun]', { timeout: 60000 }); await sleep(2500) }
    const pick = async (id: string) => { await p.select('[data-gun]', id); await sleep(600) }
    const set = (k: string, v: number) => p.evaluate((k, v) => { const e = document.querySelector<HTMLInputElement>(`[data-knob="${k}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(e, String(v)); e.dispatchEvent(new Event('input', { bubbles: true })) }, k, v)
    const val = (k: string) => p.evaluate(k => Number(document.querySelector<HTMLInputElement>(`[data-knob="${k}"]`)?.value ?? NaN), k)
    await tuner(); ok(!(await p.$('[data-knob="BURST_GAP"]')), 'tuner: no burst dials on the Repeater')
    await pick('backbone'); ok((await val('BURST_GAP')) === 0.09 && (await val('BURST_DELAY')) === 0.45, `tuner: dials at ${await val('BURST_GAP')} / ${await val('BURST_DELAY')}`)
    const read0 = await p.$eval('[data-rhythm-read]', e => e.textContent)
    const o0 = await p.evaluate(() => (window as any).__osc); await set('BURST_DELAY', 0.6); await set('BURST_GAP', 0.12); await sleep(4000)
    ok((await p.evaluate(() => (window as any).__osc)) - o0 >= 9, 'tuner: Fire plays the bursts aloud')
    const read1 = await p.$eval('[data-rhythm-read]', e => e.textContent); const ps = (s: string | null) => s?.match(/([\d.]+) a second/)?.[1]
    ok(!!ps(read0) && ps(read0) === ps(read1), `tuner: ${read0} -> ${read1}`); await p.screenshot({ path: `${OUT}/m148-tuner.png` })
    await tuner(); await pick('backbone'); ok((await val('BURST_DELAY')) === 0.6 && (await val('BURST_GAP')) === 0.12, 'tuner: saved across a reload')
    await wilds(p, false); await tapKey(p, 'KeyR'); ok(await poll(async () => (await gun(p)).id === 'backbone' && Math.abs((await gun(p)).cd - 0.6) < 1e-9), `tuner: the Ather fires it at ${(await gun(p)).cd} / ${(await gun(p)).gap}`)
    await tuner(); await pick('backbone'); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Reset to defaults')!.click()); await sleep(500); ok((await val('BURST_DELAY')) === 0.45, 'tuner: reset puts it back')
  } else if (!KEY) console.log('SKIP tuner (no OWNER_KEY)')
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, String(e).slice(0, 300)) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
