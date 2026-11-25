// BETA M151: EVERY gun fires while held, on prod, in the Ather (phone 390x844 fire button + desktop mouse). Fresh anonymous profiles, every
// non-GET stubbed. Per gun: 1 held = round after round on its own cadence (combat clock; Repeater 0.22 s)  2 released = it stops
//   3 a tap = one round (the Backbone: one burst)  4 held through the clip's end: one reload, its own length, then it fires on, the mana paid
//   5 Repeater: R mid-hold reloads at once, then fires on  6 Roar: 9 pellets a round, and they shove a Hollow back  7 0 page errors
//   npx tsx scripts/m151-hold-check.mts [--url ...] [--out dir] [--only phone|desktop] [--gun id]
import puppeteer, { type Page } from 'puppeteer-core'
import { RANGE_GUNS } from '../src/app/shimmer/open/shared/gunplay'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), OUT = flag('--out', '/tmp')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(200) } return false }
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const LO = { v: 1, kael: true, vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] })
const errs: string[] = []
async function page(phone: boolean, lo: object) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200))); await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    const co = AudioContext.prototype.createOscillator; (window as any).__osc = 0; AudioContext.prototype.createOscillator = function () { (window as any).__osc++; return co.call(this) }
    if (sessionStorage.getItem('m151')) return; sessionStorage.setItem('m151', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut)); localStorage.setItem('open.loadout.v1', JSON.stringify(s.lo)) }, { tut: TUT, lo })
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
async function run(phone: boolean, g: (typeof RANGE_GUNS)[number]) {
  const side = g.slot === 'SIDEARM', L = `${phone ? 'phone' : 'desktop'} ${g.id}`
  const p = await page(phone, { ...LO, guns: [g.id], primary: side ? null : g.id, secondary: side ? g.id : null }); await wilds(p, phone); await tapKey(p, 'KeyR')
  if (!(await poll(async () => (await gun(p)).id === g.id && await p.evaluate(() => (window as any).__ather.stance().kind === 'weapon'), 8000))) await tapKey(p, 'KeyR')
  ok(await poll(async () => (await gun(p)).id === g.id && await p.evaluate(() => (window as any).__ather.stance().kind === 'weapon'), 20000), `0. ${L}: in hand (${(await gun(p)).id})`); await sleep(1500)
  // a row per frame a round left, on the combat clock; new streaks beside it. Nothing may hurt or be hit (shove test aside): the sky is watched, the field kept empty
  await p.evaluate(() => { const W = window as any; W.__tr = []; W.__keep = null; let a = W.__ather.combat().keeper.ammo; const seen = new WeakSet()
    const f = () => { const c = W.__ather.combat(), k = c.keeper; let st = 0; k.hp = k.maxHp; for (const r of c.rounds) if (!seen.has(r)) { seen.add(r); st++ }
      for (let i = c.hollows.length - 1; i >= 0; i--) if (c.hollows[i].id !== W.__keep) c.hollows.splice(i, 1); else { c.hollows[i].hp = 999; c.hollows[i].state = 'stagger'; c.hollows[i].t = 9 }
      if (k.ammo < a) W.__tr.push({ t: c.clock, n: a - k.ammo, st }); a = k.ammo; requestAnimationFrame(f) }; requestAnimationFrame(f) })
  type R = { t: number; n: number; st: number }
  const tr = () => p.evaluate(() => (window as any).__tr as R[]), count = async () => (await tr()).reduce((s, r) => s + r.n, 0), clear = () => p.evaluate(() => { (window as any).__tr.length = 0 })
  const fireAt = phone ? await p.evaluate(() => { const r = document.querySelector('[data-touch="fire"]')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }) : { x: 640, y: 380 }
  const cdp = await p.createCDPSession()
  const press = () => phone ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fireAt] }) : p.mouse.down(), lift = () => phone ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : p.mouse.up()
  const fill = (n = g.clip) => p.evaluate(n => { const c = (window as any).__ather.combat(); c.keeper.ammo = n; c.keeper.reloading = 0; if (c.mana) c.mana.cur = 100 }, n)
  const clock = () => p.evaluate(() => (window as any).__ather.combat().clock as number), rest = async (s: number) => { const t = await clock(); await poll(async () => (await clock()) - t > s, 60000) }
  const burst = g.burst, cyc = (g.burst - 1) * g.burstGap + g.fireCd + (g.charge ?? 0), shots = Math.min(g.clip, burst > 1 ? 6 : 8)
  // 1 held
  await fill(); await rest(1.2); await fill(); await rest(0.1); await clear(); await press()
  const got = await poll(async () => (await count()) >= shots, 90000)
  if (g.id === 'repeater' || g.id === 'roar') await p.screenshot({ path: `${OUT}/m151-${L.replace(' ', '-')}.png` })
  const T = await tr(); await lift(); await rest(cyc + 0.3); const n1 = await count()
  const at = T.flatMap(r => Array.from({ length: r.n }, () => r.t - T[0].t)).slice(0, shots), lead = at.filter((_, i) => i % burst === 0)
  ok(got, `1. ${L}: held fires on (${n1} rounds; wanted ${shots} in one hold)`)
  // the Spitter (auto, untouched by M151) leaves on whole frames: late by up to one a round, never early
  // charge: each frame boundary may add one frame (0.05) before and after the charge, so its cycle may only run late, not early
  const slack = g.charge || g.auto ? (i: number) => [-0.055, 0.055 + (g.charge ? 0.1 : 0.05) * i] : () => [-0.055, 0.055], off = lead.map((t, i) => t - i * cyc)
  ok(got && off.every((o, i) => o >= slack(i)[0] && o <= slack(i)[1]), `1. ${L}: every ${cyc.toFixed(2)} s (measured ${lead.length > 1 ? (lead[lead.length - 1] / (lead.length - 1)).toFixed(3) : '-'}, worst off ${Math.max(...off.map(Math.abs)).toFixed(3)})`)
  // 2 released: no round after the last the trigger asked for (a burst / a charge in flight may finish)
  await rest(cyc * 2); const n2 = await count(); ok(n2 === n1, `2. ${L}: released, it stops (${n1} -> ${n2})`)
  if (g.id === 'roar') { const r = await tr(); ok(r.length > 0 && r.every(x => x.st === 9 * x.n), `6. ${L}: ${r.map(x => x.st).join(' ')} pellets a round`) } else ok((await tr()).reduce((s, r) => s + r.st, 0) <= n2, `6. ${L}: one streak a round`)
  // 3 a tap: down until the pull is seen, at most
  await fill(); await rest(cyc + 0.3); await clear(); await press(); if (g.auto || g.charge) await sleep(60); else await poll(async () => (await count()) > 0, 5000); await lift(); await rest(cyc * 2 + 0.3)
  const n3 = await count(), tapMax = g.auto ? 3 : burst; ok(n3 >= 1 ? n3 <= tapMax && (g.auto || n3 === burst) : !!(g.auto || g.charge), `3. ${L}: a tap = ${n3} round${n3 === 1 ? '' : 's'}${n3 ? '' : ' (a 60 ms tap between two slow frames)'}`)
  // 4 the clip ends mid-hold
  const left = burst; await fill(left); await rest(cyc + 0.2); await fill(left); await clear(); await press()
  const on = await poll(async () => (await count()) >= left + 1, 60000), R4 = await tr(); await lift()
  const m0 = R4.findIndex((_, i) => R4.slice(0, i + 1).reduce((s, r) => s + r.n, 0) >= left), gap = on ? R4[m0 + 1].t - R4[m0].t : -1, want = g.reloadTime + (g.charge ?? 0)
  ok(on && gap >= want - 0.055 && gap <= want + 0.16, `4. ${L}: the reload (${g.reloadTime} s) interrupts and the held trigger resumes (${gap.toFixed(2)} s)`)
  if (side) { // 5 R mid-hold
    await rest(1.6); await fill(); await rest(0.5); await clear(); await press(); await poll(async () => (await count()) >= 2, 30000)
    await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR')
    const re = await poll(async () => (await gun(p)).rel > 0, 8000), k0 = await count(), dur = await (async () => { const t = await clock(); await poll(async () => (await gun(p)).rel <= 0, 30000); return (await clock()) - t })()
    ok(re, `5. ${L}: R mid-hold reloads`); ok(await poll(async () => (await count()) > k0, 20000), `5. ${L}: then fires on (reload seen ${dur.toFixed(2)} s)`); await lift()
  }
  if (g.id === 'roar') { // 6 the shove
    const moved: number[] = []
    for (let d = 0; d < 6 && !moved.some(m => m > 0.3); d++) {
      await rest(1); await fill(); await p.evaluate(y => (window as any).__ather.look(y, 0), d * 1.05); await rest(0.4)
      const z = await p.evaluate(() => { const W = window as any, A = W.__ather; A.spawn(0, -3.2); const h = A.combat().hollows.at(-1); W.__keep = h.id; return h.id }); await rest(0.3)
      const st = () => p.evaluate(id => { const A = (window as any).__ather, h = A.combat().hollows.find((x: any) => x.id === id), a = A.camAim(); return h ? { x: h.x, y: h.y, z: h.z, cx: a.cx, cy: a.cy, cz: a.cz } : null }, z)
      const b = await st(); if (!b) continue
      const dx = b.x - b.cx, dz = b.z - b.cz, dist = Math.hypot(dx, dz); await p.evaluate((y, q) => (window as any).__ather.look(y, q), Math.atan2(-dx, -dz), Math.atan2(b.y + 0.85 - b.cy, dist)); await rest(0.3)
      const s0 = await st(); await clear(); await press(); await poll(async () => (await count()) >= 1, 20000); await lift(); await rest(0.7); const s1 = await st()
      if (s0 && s1) moved.push(Math.hypot(s1.x - s1.cx, s1.z - s1.cz) - Math.hypot(s0.x - s0.cx, s0.z - s0.cz))
    }
    ok(moved.some(m => m > 0.3 && m <= 2.6), `6. ${L}: a shell shoves a Hollow back (${moved.map(m => m.toFixed(2)).join(' ')} m)`)
  }
  await p.close()
}
try {
  const only = flag('--only', ''), id = flag('--gun', '')
  for (const phone of [true, false]) if (!only || (only === 'phone') === phone) for (const g of RANGE_GUNS) if (!id || id === g.id) await run(phone, g).catch(e => ok(false, `${phone ? 'phone' : 'desktop'} ${g.id}: ${String(e).slice(0, 200)}`))
  ok(errs.length === 0, `7. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, String(e).slice(0, 300)) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
