// M150 s5 (Alex 11-27): A) THE GUN BENCH (owner, desktop 1280): all 8 guns listed (the 6 + DB2 Twins + M9 Grinder); every gun has
// GAMEPLAY dials (damage, head damage, round speed, clip, reload; pellets / burst / charge where the gun has them; its fire-rate dial)
// and DIMENSION dials (overall length, barrel, stock where it has one, body height, width + the s4 build dials); each moves the gun
// or its numbers (window.__gunBench, the gun in hand) and saves (open:gun-stats.v1 / open:gun-build.v1); a reload keeps them.
// B) LIVE (fresh non-owner profile, phone 390x844, every POST stubbed): the Lance's HEADSHOT kills a full Shambler in one, its body
// shot does not (22); the Charred Rifle hits for the Lance's 22. 0 page errors. Shots of OUR renders to --out.
//   OWNER_KEY=... npx tsx scripts/m150-bench-sliders-check.mts [--url https://ather.games] [--out docs/looks/guns-2026-11-27b] [--only bench|live]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/guns-2026-11-27b'), only = flag('--only', '')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const poll = async (f: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(200) } return false }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
let bad = 0
const say = (ok: boolean, m: string) => { if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', m) }

async function bench() {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 760 })
  p.on('pageerror', e => errs.push('bench: ' + String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const KEY = process.env.OWNER_KEY; if (!KEY) { say(false, 'OWNER_KEY not set'); return }
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 120000 })
  const load = async (q: string) => {
    await p.goto(`${url}/shimmer/dev/guns?${q}`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__fpGun && !!(window as any).__fpGun.key() && !!(window as any).__gunBench, { timeout: 240000 })
    await sleep(1200)
  }
  const set = (attr: string, k: string, v: number) => p.evaluate((attr, k, v) => {
    const el = document.querySelector(`[${attr}="${k}"]`) as HTMLInputElement | null; if (!el) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); return true
  }, attr, k, v)
  const read = () => p.evaluate(() => ({ b: (window as any).__gunBench as Record<string, any>, key: (window as any).__fpGun.key() as string,
    stats: [...document.querySelectorAll('[data-stat-knob]')].map(e => e.getAttribute('data-stat-knob')!),
    builds: [...document.querySelectorAll('[data-build-knob]')].map(e => e.getAttribute('data-build-knob')!),
    rate: [...document.querySelectorAll('[data-rhythm] [data-knob]')].map(e => e.getAttribute('data-knob')!),
    opts: [...document.querySelectorAll('[data-gun] option')].map(o => (o as HTMLOptionElement).value),
    savedS: localStorage.getItem('open:gun-stats.v1'), savedB: localStorage.getItem('open:gun-build.v1'), values: document.querySelector('[data-values]')?.textContent ?? '' }))
  await p.evaluate(() => { localStorage.removeItem('open:gun-stats.v1'); localStorage.removeItem('open:gun-build.v1') })
  const GUNS = ['backbone', 'charred-rifle', 'lance', 'spitter', 'repeater', 'roar', 'twins', 'grinder']
  for (const g of GUNS) {
    await load(`gun=${g}&set=new&preview=hip`)
    let r = await read()
    say(r.opts.length === 8 && r.opts.includes(g) && r.b.id === g && r.b.preview, `${g}: listed (${r.opts.length} on the bench), new model in hand`)
    const wantStats = ['damage', 'crit', 'projSpeed', 'clip', 'reloadTime', ...(g === 'roar' || g === 'twins' ? ['pellets'] : []), ...(g === 'backbone' ? ['burst'] : []), ...(g === 'charred-rifle' ? ['charge'] : [])]
    say(wantStats.every(k => r.stats.includes(k)) && r.stats.length === wantStats.length, `${g}: gameplay dials ${r.stats.join(',')}`)
    const hasStock = !['repeater', 'twins'].includes(g)
    const wantDims = ['length', 'barrel', 'height', 'width', 'scale', ...(hasStock ? ['stock'] : [])]
    say(wantDims.every(k => r.builds.includes(k)) && r.builds.includes('stock') === hasStock && r.rate.length >= 1, `${g}: dimension dials ${r.builds.filter(k => ['length', 'barrel', 'stock', 'height', 'width'].includes(k)).join(',')} + fire rate ${r.rate.join(',')}`)
    if (g === 'twins' || g === 'grinder') await p.screenshot({ path: `${out}/${g}-in-hand.png` })
    if (g === 'twins' || g === 'grinder') await (await p.$('[data-compare]'))?.screenshot({ path: `${out}/${g}-today-vs-new.png` })
    // gameplay: damage, round speed, the fire rate
    const b0 = r.b
    await set('data-stat-knob', 'damage', 30); await sleep(300); r = await read()
    say(r.b.damage === 30 && r.b.dps > b0.dps && JSON.parse(r.savedS ?? '{}')[g]?.damage === 30 && r.values.includes('"STATS"'), `${g}: damage 30 moves the numbers (dps ${b0.dps.toFixed(1)} -> ${r.b.dps.toFixed(1)}), saved, in Copy values`)
    await set('data-stat-knob', 'projSpeed', 150); await sleep(300); r = await read(); say(r.b.projSpeed === 150, `${g}: round speed 150`)
    const rk = r.rate[r.rate.length - 1]; const cd0 = r.b.fireCd
    await set('data-knob', rk, rk === 'BURST_GAP' ? 0.12 : rk === 'BURST_DELAY' ? 0.75 : 0.4); await sleep(400); r = await read()
    say(r.b.fireCd !== cd0 || rk === 'BURST_GAP', `${g}: fire rate dial ${rk} moves it (${cd0} -> ${r.b.fireCd})`)
    // dimensions
    const k0 = r.key, f0 = r.b.front, bk0 = r.b.back, t0 = r.b.top
    await set('data-build-knob', 'length', 1.2); await sleep(500); r = await read()
    say(r.key !== k0 && Math.abs(r.b.front - f0 * 1.2) < 0.002 && JSON.parse(r.savedB ?? '{}')[g]?.length === 1.2, `${g}: length 1.2 redraws (front ${f0.toFixed(3)} -> ${r.b.front.toFixed(3)}), saved`)
    const f1 = r.b.front, bk1 = r.b.back
    await set('data-build-knob', 'barrel', 1.5); await sleep(500); r = await read()
    say(r.b.front < f1 - 0.01 && Math.abs(r.b.back - bk1) < 1e-6, `${g}: barrel 1.5 reaches further forward (${f1.toFixed(3)} -> ${r.b.front.toFixed(3)}), the back stays`)
    if (hasStock) { const bb = r.b.back; await set('data-build-knob', 'stock', 1.4); await sleep(500); r = await read(); say(r.b.back > bb + 0.01, `${g}: stock 1.4 reaches further back (${bb.toFixed(3)} -> ${r.b.back.toFixed(3)})`) }
    await set('data-build-knob', 'height', 1.25); await sleep(500); r = await read(); say(r.b.top > t0 * 1.2, `${g}: height 1.25 lifts the rail (${t0.toFixed(3)} -> ${r.b.top.toFixed(3)})`)
    const kw = r.key; await set('data-build-knob', 'width', 0.8); await sleep(500); r = await read(); say(r.key !== kw, `${g}: width 0.8 redraws`)
    void bk0
    if (g === 'grinder' || g === 'twins' || g === 'lance') await p.screenshot({ path: `${out}/${g}-dialled.png` })
  }
  // reload keeps a gun's moves; reset forgets them
  await load('gun=grinder&set=new&preview=hip'); let r = await read()
  say(r.b.damage === 30 && r.b.projSpeed === 150 && Math.abs(r.b.front) > 0 && JSON.parse(r.savedB ?? '{}').grinder?.barrel === 1.5, 'reload: the Grinder comes back with its stats and dimensions')
  await p.click('[data-stats-reset]'); await sleep(400); await p.click('[data-build-reset]'); await sleep(600); r = await read()
  say(Math.abs(r.b.damage - 13.5 * r.b.fireCd / 0.22) < 1e-9 && !JSON.parse(r.savedS ?? '{}').grinder && !JSON.parse(r.savedB ?? '{}').grinder, `reset: the Grinder's stats + build back to its row (damage ${r.b.damage.toFixed(2)} = 13.5 on its still-dialled ${r.b.fireCd} s rhythm, which keeps DPS)`)
  await load('gun=twins&set=new&preview=hip'); r = await read()
  say(r.b.damage === 30 && JSON.parse(r.savedB ?? '{}').twins?.width === 0.8, 'reload: the Twins keep theirs too')
  await p.evaluate(() => { localStorage.removeItem('open:gun-stats.v1'); localStorage.removeItem('open:gun-build.v1'); localStorage.removeItem('open:gun-tune.v2') })
  await p.close()
}

// ── B: LIVE, a fresh non-owner keeper at 390 ──
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const LO = { v: 1, kael: true, vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }
async function live(gunId: string) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  p.on('pageerror', e => errs.push(`live ${gunId}: ` + String(e).slice(0, 200))); await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m150s5')) return; sessionStorage.setItem('m150s5', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut)); localStorage.setItem('open.loadout.v1', JSON.stringify(s.lo)) }, { tut: TUT, lo: { ...LO, guns: [gunId], primary: gunId, secondary: null } })
  await p.goto(`${url}/shimmer/open/ather?hour=14&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__ather?.combat, { timeout: 240000 }); await sleep(3000)
  await dismissStartCard(p); await sleep(1000)
  const g = () => p.evaluate(() => { const c = (window as any).__ather.combat(); return { id: c.gun.id, dmg: c.gun.damage, crit: c.gun.crit, headKill: !!c.gun.headKill, stance: (window as any).__ather.stance().kind } })
  const tapR = async () => { await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(1500) }
  await tapR(); if (!(await poll(async () => { const x = await g(); return x.id === gunId && x.stance === 'weapon' }, 8000))) await tapR()
  const held = await g()
  say(held.id === gunId && held.stance === 'weapon', `live ${gunId}: in hand (${held.id}, damage ${held.dmg}, crit ${held.crit}, headKill ${held.headKill})`)
  // keep the field to ONE still shambler 3.5 m ahead; the keeper cannot die
  await p.evaluate(() => { const W = window as any; W.__keep = null; W.__hits = []
    const f = () => { const c = W.__ather.combat(); c.keeper.hp = c.keeper.maxHp; c.keeper.reloading = 0; if (c.keeper.ammo < 1) c.keeper.ammo = 1
      for (let i = c.hollows.length - 1; i >= 0; i--) { const h = c.hollows[i]; if (h.id !== W.__keep) c.hollows.splice(i, 1); else { h.state = 'recover'; h.t = 9; h.x = W.__at.x; h.z = W.__at.z } }
      for (const e of c.events) if (e.kind === 'hit') W.__hits.push(e)
      requestAnimationFrame(f) }; W.__at = { x: 0, z: 0 }; requestAnimationFrame(f) })
  const fireAt = await p.evaluate(() => { const r = document.querySelector('[data-touch="fire"]')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  const cdp = await p.createCDPSession()
  const shoot = async (zone: 'head' | 'body') => {
    const id = await p.evaluate(() => { const W = window as any, A = W.__ather, a = A.camAim(); A.spawn(0, -3.5); const h = A.combat().hollows.at(-1)
      W.__keep = h.id; W.__at = { x: h.x, z: h.z }; h.hp = h.maxHp; W.__hits = []; return h.id })
    await sleep(500)
    const b = await p.evaluate(id => { const A = (window as any).__ather, h = A.combat().hollows.find((x: any) => x.id === id), a = A.camAim(); return h ? { x: h.x, y: h.y, z: h.z, cx: a.cx, cy: a.cy, cz: a.cz, hp: h.hp } : null }, id)
    if (!b) return null
    const dx = b.x - b.cx, dz = b.z - b.cz, dist = Math.hypot(dx, dz), aimY = b.y + (zone === 'head' ? 1.55 : 0.85) + 0.08 * 0   // HEAD_Y / BODY_Y
    await p.evaluate((y, q) => (window as any).__ather.look(y, q), Math.atan2(-dx, -dz), Math.atan2(aimY - b.cy, dist)); await sleep(600)
    await p.evaluate(() => { const c = (window as any).__ather.combat(); c.keeper.ammo = c.gun.clip; c.keeper.bloom = 0; c.keeper.sinceShot = 99 })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fireAt] }); await sleep(120); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(900)
    return p.evaluate((id, hp0) => { const W = window as any, h = W.__ather.combat().hollows.find((x: any) => x.id === id), hits = W.__hits.filter((e: any) => e.id === id)
      return { hp0, hp: h ? h.hp : 0, gone: !h, head: hits.some((e: any) => e.head), body: hits.some((e: any) => !e.head), killed: hits.some((e: any) => e.killed) } }, id, b.hp)
  }
  const tries = async (zone: 'head' | 'body') => { for (let i = 0; i < 4; i++) { const r = await shoot(zone); if (r && (zone === 'head' ? r.head : r.body)) return r } return null }
  if (gunId === 'lance') {
    const h = await tries('head')
    say(!!h && h.head && h.killed && h.hp0 === 45, `live lance: HEADSHOT kills a full shambler in one (${JSON.stringify(h)})`)
    await p.screenshot({ path: `${out}/live-lance-390.png` })
    const b = await tries('body')
    say(!!b && b.body && !b.killed && Math.abs(b.hp0 - b.hp - 22) < 0.01, `live lance: BODY shot does not (45 -> ${b?.hp})`)
  } else {
    say(held.dmg === 22, `live charred-rifle: damage ${held.dmg} == the Lance's 22`)
    const b = await tries('body')
    say(!!b && b.body && Math.abs(b.hp0 - b.hp - 22) < 0.01, `live charred-rifle: a body shot takes 22 (45 -> ${b?.hp})`)
  }
  await p.close()
}
try {
  if (only !== 'live') await bench().catch(e => say(false, 'bench: ' + String(e).slice(0, 300)))
  if (only !== 'bench') for (const id of ['lance', 'charred-rifle']) await live(id).catch(e => say(false, `live ${id}: ` + String(e).slice(0, 300)))
} finally {
  say(errs.length === 0, `page errors: ${errs.slice(0, 4).join(' | ') || 0}`)
  console.log(bad ? 'FAIL' : 'ALL PASS'); await br.close(); process.exit(bad ? 1 : 0)
}
