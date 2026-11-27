// M245 (Alex 11-27): Hollows 100-150 hp, guns re-numbered, head = body x HEAD_MULT (no Lance insta-kill), champions keep the
// newcomer's time-to-kill. A fresh NON-owner keeper (every POST stubbed), each gun in hand from its loadout:
//  - the gun in hand carries the table's body / head damage (c.gun after the tuner's baked rhythm: the Backbone fires 24);
//  - a fresh shambler / crawler / floater spawns at 150 / 120 / 100;
//  - a live body shot takes the table's damage off a fresh shambler (single-round guns); the Lance's HEADSHOT drops a fresh 150
//    shambler in one (216 > 150) and does NOT drop a 240 hp one (no insta-kill rule);
//  - M245 s2 (Alex 11-27): a woken champion rises at 500 a bar (was 270 = 150 x 1.8; the newcomer's time-to-kill printed, no longer held);
//  - M245 s2: the Twins' pair rule on the live engine (bench-only gun, so the held Roar is made a Twins-shaped pair in place: clip 4,
//    0.2 s, reload 2.8, pair): four pulls fire LEFT, RIGHT, LEFT, RIGHT, the 4th starts the 2.8 s reload, a 5th pull does not fire;
//  - 0 page errors.
//   npx tsx scripts/m245-damage-check.mts [--url https://ather.games] [--view 390|desk] [--guns repeater,lance] [--out docs/looks/m245-2026-11-27]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m245-2026-11-27'), view = flag('--view', '390')
const GUNS = flag('--guns', 'repeater,spitter,backbone,roar,lance,charred-rifle').split(',')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const poll = async (f: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(200) } return false }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
let bad = 0
const say = (ok: boolean, m: string) => { if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', m) }

// the table (Alex 11-27): body a round, pellets, head = body x HEAD_MULT
const TABLE: Record<string, { body: number; pellets: number; head: number }> = {
  repeater: { body: 18, pellets: 1, head: 27 }, spitter: { body: 16, pellets: 1, head: 24 }, backbone: { body: 24, pellets: 1, head: 36 },
  roar: { body: 12, pellets: 8, head: 15 }, lance: { body: 108, pellets: 1, head: 216 }, 'charred-rifle': { body: 77, pellets: 1, head: 154 },
}
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const LO = { v: 1, kael: true, vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }

async function live(gunId: string, first: boolean) {
  const p: Page = await (await br.createBrowserContext()).newPage()
  if (view === 'desk') await p.setViewport({ width: 1280, height: 760 }); else await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  p.on('pageerror', e => errs.push(`${view} ${gunId}: ` + String(e).slice(0, 200))); await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m245')) return; sessionStorage.setItem('m245', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut)); localStorage.setItem('open.loadout.v1', JSON.stringify(s.lo)) }, { tut: TUT, lo: { ...LO, guns: [gunId], primary: gunId === 'repeater' ? null : gunId, secondary: gunId === 'repeater' ? gunId : null } })   // the Repeater is a SIDEARM
  await p.goto(`${url}/shimmer/open/ather?hour=14&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__ather?.combat, { timeout: 240000 }); await sleep(3000)
  await dismissStartCard(p); await sleep(1000)
  if (view === 'desk') { await p.mouse.click(640, 300); await sleep(1500) }   // pointer lock: the desk fires with the mouse
  const g = () => p.evaluate(() => { const c = (window as any).__ather.combat(); return { id: c.gun.id, dmg: c.gun.damage, crit: c.gun.crit, pellets: c.gun.pellets ?? 1, headKill: 'headKill' in c.gun, stance: (window as any).__ather.stance().kind } })
  const tapR = async () => { await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(1500) }
  await tapR(); if (!(await poll(async () => { const x = await g(); return x.id === gunId && x.stance === 'weapon' }, 8000))) await tapR()
  const held = await g(), want = TABLE[gunId]
  say(held.id === gunId && held.stance === 'weapon' && Math.abs(held.dmg - want.body) < 1e-6 && Math.abs(held.crit - want.head) < 1e-6 && held.pellets === want.pellets && !held.headKill,
    `${view} ${gunId}: in hand body ${held.dmg} x${held.pellets}, head ${held.crit} (table ${want.body} x${want.pellets}, ${want.head}; headKill ${held.headKill})`)
  // fresh Hollows' hp
  if (first) {
    const hp = await p.evaluate(() => { const A = (window as any).__ather, o: Record<string, number> = {}
      for (const k of ['shambler', 'crawler', 'floater']) { A.spawn(0, -20, k); const h = A.combat().hollows.at(-1); o[k] = h.hp + '/' + h.maxHp as never }
      return o })
    say(String(hp.shambler) === '150/150' && String(hp.crawler) === '120/120' && String(hp.floater) === '100/100', `${view}: fresh Hollows spawn at ${JSON.stringify(hp)} (150 / 120 / 100)`)
  }
  const fireAt = view === 'desk' ? null : await p.evaluate(() => { const r = document.querySelector('[data-touch="fire"]')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  const cdp = await p.createCDPSession()
  const pull = async () => {
    if (fireAt) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fireAt] }); await sleep(120); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
    else { await p.mouse.down(); await sleep(80); await p.mouse.up() }
  }
  if (gunId === 'roar') {
    // M245 s2: the pair rule. Run BEFORE the keep-loop below (it refills ammo / clears reloads every frame).
    await p.evaluate(() => { const W = window as any, c = W.__ather.combat(); W.__tw = []; W.__gun0 = c.gun
      c.gun = { ...c.gun, pair: true, clip: 4, fireCd: 0.2, reloadTime: 2.8, damage: 99 / 8, crit: 99 / 8 * 1.25 }
      c.keeper.ammo = 4; c.keeper.reloading = 0; c.keeper.sinceShot = 99; if (c.mana) c.mana.cur = Math.max(c.mana.cur, 999)
      const f = () => { const cc = W.__ather.combat(); for (const e of cc.events) if (e.kind === 'fired') W.__tw.push({ hand: e.hand ?? null, ammo: cc.keeper.ammo, rel: +cc.keeper.reloading.toFixed(2) }); if (!W.__twStop) requestAnimationFrame(f) }
      requestAnimationFrame(f) })
    for (let i = 0; i < 5; i++) { await pull(); await sleep(380) }
    const tw = await p.evaluate(() => { const W = window as any; W.__twStop = true; const c = W.__ather.combat(); return { shots: W.__tw, reloading: +c.keeper.reloading.toFixed(2), ammo: c.keeper.ammo } })
    const hands = tw.shots.map((s: any) => s.hand).join(',')
    say(hands === 'left,right,left,right' && tw.shots[3].ammo === 0 && tw.shots[3].rel > 2.7 && tw.reloading > 0 && tw.reloading < 2.8,
      `${view} twins (pair rule, live engine): 5 pulls -> ${tw.shots.length} shots [${hands}], 4th starts the reload (${tw.shots[3]?.rel} s of 2.8), 5th refused, still reloading ${tw.reloading} s`)
    await p.screenshot({ path: `${out}/twins-pair-${view}.png` })
    await p.evaluate(() => { const W = window as any, c = W.__ather.combat(); c.gun = W.__gun0; c.keeper.reloading = 0; c.keeper.ammo = c.gun.clip })
  }
  // keep the field to ONE still shambler; the keeper cannot die
  await p.evaluate(() => { const W = window as any; W.__keep = null; W.__hits = []
    const f = () => { const c = W.__ather.combat(); c.keeper.hp = c.keeper.maxHp; c.keeper.reloading = 0; if (c.keeper.ammo < 1) c.keeper.ammo = 1
      for (let i = c.hollows.length - 1; i >= 0; i--) { const h = c.hollows[i]; if (h.id !== W.__keep) c.hollows.splice(i, 1); else { h.state = 'recover'; h.t = 9; h.x = W.__at.x; h.z = W.__at.z } }
      for (const e of c.events) if (e.kind === 'hit') W.__hits.push(e)
      requestAnimationFrame(f) }; W.__at = { x: 0, z: 0 }; requestAnimationFrame(f) })
  const shoot = async (zone: 'head' | 'body', hpSet?: number) => {
    const id = await p.evaluate((hpSet) => { const W = window as any, A = W.__ather; A.spawn(0, -3.5); const h = A.combat().hollows.at(-1)
      W.__keep = h.id; W.__at = { x: h.x, z: h.z }; if (hpSet) { h.hp = h.maxHp = hpSet } W.__hits = []; return h.id }, hpSet ?? 0)
    await sleep(500)
    const b = await p.evaluate(id => { const A = (window as any).__ather, h = A.combat().hollows.find((x: any) => x.id === id), a = A.camAim(); return h ? { x: h.x, y: h.y, z: h.z, cx: a.cx, cy: a.cy, cz: a.cz, hp: h.hp } : null }, id)
    if (!b) return null
    const dx = b.x - b.cx, dz = b.z - b.cz, dist = Math.hypot(dx, dz), aimY = b.y + (zone === 'head' ? 1.55 : 0.85)
    await p.evaluate((y, q) => (window as any).__ather.look(y, q), Math.atan2(-dx, -dz), Math.atan2(aimY - b.cy, dist)); await sleep(600)
    await p.evaluate(() => { const c = (window as any).__ather.combat(); c.keeper.ammo = c.gun.clip; c.keeper.bloom = 0; c.keeper.sinceShot = 99 })
    await pull(); await sleep(1100)
    return p.evaluate((id, hp0) => { const W = window as any, h = W.__ather.combat().hollows.find((x: any) => x.id === id), hits = W.__hits.filter((e: any) => e.id === id)
      return { hp0, hp: h ? h.hp : 0, gone: !h, n: hits.length, head: hits.some((e: any) => e.head), body: hits.some((e: any) => !e.head), killed: hits.some((e: any) => e.killed) } }, id, b.hp)
  }
  const tries = async (zone: 'head' | 'body', hpSet?: number) => { for (let i = 0; i < 4; i++) { const r = await shoot(zone, hpSet); if (r && (zone === 'head' ? r.head && !r.body : r.body && !r.head)) return r } return null }
  if (want.pellets === 1) {
    const b = await tries('body'), took = b ? b.hp0 - b.hp : NaN, rounds = took / want.body
    // the Backbone's tap is a 3-round burst: what it took is a whole number of 24s
    say(!!b && b.hp0 === 150 && Math.abs(rounds - Math.round(rounds)) < 1e-6 && Math.round(rounds) >= 1 && (gunId === 'backbone' || Math.round(rounds) === 1),
      `${view} ${gunId}: a body shot on a fresh 150 shambler takes ${took} (${rounds.toFixed(2)} x ${want.body}) ${JSON.stringify(b)}`)
  }
  if (gunId === 'lance') {
    const h = await tries('head')
    say(!!h && h.head && h.killed && h.hp0 === 150, `${view} lance: HEADSHOT (216) drops a fresh 150 shambler in one ${JSON.stringify(h)}`)
    await p.screenshot({ path: `${out}/lance-head-${view}.png` })
    const big = await tries('head', 240)
    say(!!big && big.head && !big.killed && Math.abs(big.hp - 24) < 0.01, `${view} lance: a 240 hp body takes the 216 and lives (no insta-kill) ${JSON.stringify(big)}`)
  }
  if (gunId === 'repeater') {
    // the champion: wake one, read a bar's hp, the newcomer's time-to-kill (3 bars / the Repeater held) vs before (3 x 150 / 10 a 0.22 s)
    const ch = await p.evaluate(async () => { const A = (window as any).__ather; A.wake(0); for (let i = 0; i < 40 && !A.combat().champ; i++) await new Promise(r => setTimeout(r, 100))
      const c = A.combat().champ, g = A.combat().gun; return c ? { hp: Math.ceil(c.hp), bar: c.bar, dmg: g.damage, cd: g.fireCd } : null })
    const ttk270 = 3 * 270 / (ch ? ch.dmg / ch.cd : 1), ttk = ch ? 3 * ch.hp / (ch.dmg / ch.cd) : NaN
    say(!!ch && ch.bar === 0 && ch.hp === 500, `${view}: a champion rises at ${ch?.hp} a bar (500); newcomer (Repeater, held) time-to-kill ${ttk270.toFixed(1)} -> ${ttk.toFixed(1)} s (bar 270 -> 500)`)
  }
  await p.close()
}
let first = true
for (const id of GUNS) { await live(id, first); first = false }
say(errs.length === 0, `0 page errors (${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''})`)
await br.close()
console.log(bad ? `FAILED ${bad}` : 'ALL PASS')
process.exit(bad ? 1 : 0)
