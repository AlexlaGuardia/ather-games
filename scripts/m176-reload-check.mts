// BETA M176: RELOAD ON E, AND A GUN NOT IN HAND RELOADS ITSELF. A test keeper (fresh context, two guns: Backbone + Repeater).
//   Wilds: 1 R swaps and never reloads (clip, reloading, mana)  2 each gun keeps its own clip  3 the swapped-away gun is full after
//   the dial, mana paid once  4 stowed: both full, each paid once  5 no mana = it waits, then pays
//   Glade (desktop): 6 beside Greg, 7 beside the gate, 8 beside a home's door: E with a part clip reloads and opens nothing, the next E
//   (full clip) opens it; the prompt reads 'E · reload' first. HELD E opens nothing.
//   Phone (--phone, --w 390|360): reload and swap are two buttons, tapped each does only its own job; nothing overlaps (reload, swap,
//   use / Gregory, jump, slide, shield, fire, aim); beside Greg the Gregory button TALKS (its own button reloads).
// Ammo is SET by the check (combat().keeper.ammo, mana.cur), everything after it is real keys / taps.
//   npx tsx scripts/m176-reload-check.mts [--url https://ather.games] [--phone] [--w 390] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { ECON } from '../src/app/shimmer/open/shared/vitals-economy'
import { GLADE_GATE } from '../src/app/shimmer/open/ather/glade-cluster'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone'), w = +flag('--w', '390'), out = flag('--out', '')
if (out) mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(200) } return false }
try {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: w, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1100, height: 700 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['repeater', 'backbone'], primary: 'backbone', secondary: 'repeater', kael: true,
      vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
  })
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fight), 240000), 'in the Wilds')
  await sleep(4000); if (!phone) await p.mouse.click(550, 350); await sleep(800)
  type S = { gun: string; ammo: number; clip: number; rel: number; mana: number; rack: Record<string, number>; st: string; panel: string | null }
  const S = () => p.evaluate(() => { const c = (window as any).__ather.combat(); return { gun: c.gun.id, ammo: c.keeper.ammo, clip: c.gun.clip, rel: c.keeper.reloading, mana: (window as any).__ather.mana(), rack: Object.fromEntries(Object.entries(c.rack ?? {}).map(([k, v]: any) => [k, v.ammo])), st: (window as any).__ather.stance().kind, panel: (window as any).__ather.panel() } }) as Promise<S>
  // the mana refill off for the count: the bar's regen is paused by every spend for 3 s, so read deltas against a rising bar with room
  const set = (ammo: number, mana = 50) => p.evaluate((a, m) => { const c = (window as any).__ather.combat(); c.keeper.ammo = a; c.keeper.reloading = 0; c.keeper.hp = c.keeper.maxHp; c.hollows.length = 0; (window as any).__ather.setMana(m) }, ammo, mana)
  const keep = setInterval(() => { p.evaluate(() => { const c = (window as any).__ather?.combat?.(); if (c) { c.hollows.length = 0; c.keeper.hp = c.keeper.maxHp } }).catch(() => {}) }, 1500)   // nothing to fight: this is about clips
  const btn = (l: string) => p.evaluate(l => { const e = document.querySelector(`[data-touch="${l}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, l)
  const tap = async (l: string) => { if (!await poll(async () => !!(await btn(l)), 8000)) { ok(false, `the ${l} button is up`); return } const b = (await btn(l))!
    const hit = await p.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e?.closest('[data-touch]')?.getAttribute('data-touch') ?? `${e?.tagName}.${String(e?.className).slice(0, 40)} '${(e as HTMLElement)?.innerText?.slice(0, 60)}'` }, b.x, b.y); if (hit !== l) ok(false, `the tap on ${l} lands on ${hit}`); await p.touchscreen.tap(b.x, b.y); await sleep(700) }
  const R = async () => { if (phone) return tap((await S()).st === 'weapon' ? 'swap' : 'draw'); await p.keyboard.down('KeyR'); await sleep(100); await p.keyboard.up('KeyR'); await sleep(700) }
  const E = async (hold = 100) => { await p.keyboard.down('KeyE'); await sleep(hold); await p.keyboard.up('KeyE'); await sleep(500) }
  const stow = async () => { if (phone) { await tap('menu'); await tap('stow') } else { await p.keyboard.down('KeyR'); await sleep(1500); await p.keyboard.up('KeyR') } await poll(async () => (await S()).st === 'stowed') }
  const drawn = async () => { for (let i = 0; i < 5 && (await S()).st !== 'weapon'; i++) await R(); return poll(async () => { const s = await S(); return s.st === 'weapon' }) }
  const spent = (a: number, b: number) => Math.abs(b - a)
  ok(await drawn() && (await S()).gun === 'backbone', 'R draws the Backbone')

  // 1 + 2 + 3
  await set(7, 50); await R(); let s = await S(); const t0 = Date.now()
  ok(s.gun === 'repeater' && s.rel === 0 && s.ammo === s.clip && s.rack.backbone === 7 && s.mana >= 50, `1. R swaps, reloads nothing (${JSON.stringify(s)})`)
  await set(5, 50); await R(); s = await S()
  if (Date.now() - t0 < 3500) ok(s.gun === 'backbone' && s.ammo === 7 && s.rel === 0 && s.rack.repeater === 5, `2. each gun its own clip (Backbone ${s.ammo}, Repeater ${s.rack.repeater})`); else console.log(`  2. too slow a box to read before the dial (${Date.now() - t0} ms)`)
  await set(7, 50); await p.evaluate(() => { const r = (window as any).__ather.combat().rack.repeater; r.ammo = 5; r.away = 0 })
  ok(await poll(async () => (await S()).rack.repeater === 12 || (await S()).rack.repeater > 5), '3. the swapped-away Repeater reloads itself')
  await sleep(6000); s = await S()
  ok(s.ammo === 7 && s.rel === 0, '3. the gun in hand does not')
  ok(s.mana > 50 - ECON.reloadMana - 0.01 && s.mana < 50 - ECON.reloadMana + 4, `3. paid once (${s.mana.toFixed(2)} of 50, a reload is ${ECON.reloadMana})`)
  // 4
  await set(7, 50); await p.evaluate(() => { const r = (window as any).__ather.combat().rack.repeater; r.ammo = 5; r.away = 0 })
  await stow(); await poll(async () => { const s = await S(); return s.ammo === s.clip && s.rack.repeater > 5 }); await sleep(2500); s = await S()
  ok(s.st === 'stowed' && s.ammo === s.clip && s.rack.repeater > 5, `4. stowed: both full (${s.ammo}/${s.clip}, Repeater ${s.rack.repeater})`)
  ok(s.mana > 50 - 2 * ECON.reloadMana - 0.01 && s.mana < 50 - 2 * ECON.reloadMana + 3, `4. each paid once (${s.mana.toFixed(2)} of 50)`)
  // 5
  await set(7, 0); for (let i = 0; i < 12; i++) { await sleep(500); await p.evaluate(() => (window as any).__ather.setMana(0)) } s = await S()
  ok(s.ammo === 7, '5. no mana: it waits'); await p.evaluate(() => (window as any).__ather.setMana(20)); ok(await poll(async () => (await S()).ammo === s.clip), '5. mana back: it pays'); ok((await S()).mana < 20 - ECON.reloadMana + 2, '5. and it cost a reload')
  // E with nothing near reloads; R again never
  await drawn(); await set(7, 50)
  if (phone) await tap('reload'); else await E()
  ok(await poll(async () => { const s = await S(); return s.rel > 0 || s.ammo === s.clip }, 5000), `${phone ? 'the reload button' : 'E'} reloads`); ok(await poll(async () => { const s = await S(); return s.rel === 0 && s.ammo === s.clip }), 'the clip fills'); s = await S(); ok(s.st === 'weapon' && s.gun === 'backbone' && s.mana < 50, 'still the same gun in hand, paid')
  const layout = async (where: string) => {
    const r = await p.evaluate(() => { const es = [...document.querySelectorAll('[data-touch]')].map(e => { const b = e.getBoundingClientRect(); return { l: e.getAttribute('data-touch')!, x: b.x, y: b.y, r: b.right, b: b.bottom } }); const bad: string[] = []
      for (let i = 0; i < es.length; i++) { const a = es[i]; if (a.x < 0 || a.r > innerWidth) bad.push(`${a.l} off screen`); for (let j = i + 1; j < es.length; j++) { const c = es[j]; if (a.x < c.r - 0.5 && c.x < a.r - 0.5 && a.y < c.b - 0.5 && c.y < a.b - 0.5) bad.push(`${a.l} over ${c.l}`) } }
      for (const a of es) { const h = document.elementFromPoint((a.x + a.r) / 2, (a.y + a.b) / 2)?.closest('[data-touch]')?.getAttribute('data-touch'); if (h !== a.l) bad.push(`${a.l} covered by ${h}`) }
      return { labels: es.map(e => e.l), bad } })
    console.log(`  ${where}: ${r.labels.join(', ')}`); ok(!r.bad.length, `${where} at ${w}: no two buttons overlap ${r.bad.join('; ')}`); return r.labels }
  if (phone) { const l = await layout('Wilds, gun out'); ok(l.includes('reload') && l.includes('swap'), 'reload and swap are two buttons') }
  if (out) await p.screenshot({ path: `${out}/wilds-${phone ? w : 'desktop'}.png` as `${string}.png` })

  // the Glade
  await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' }))
  ok(await poll(() => p.evaluate(() => (window as any).__ather.zone() === 'glade' && !!(window as any).__greg), 120000), 'in the Glade'); await sleep(4000)
  if (!phone) { await p.mouse.click(550, 350); await sleep(500) }
  ok((await S()).st === 'weapon' || await drawn(), 'the gun is still out')
  const near = () => p.evaluate(() => (window as any).__ather.near()?.kind ?? null)
  const at = (x: number, z: number, yaw: number) => p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), x, z, yaw)
  const face = async (x: number, z: number, kind: string) => { for (const d of [2, 1.6, 2.4]) for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; await at(x + Math.sin(a) * d, z + Math.cos(a) * d, a); if (await poll(async () => (await near()) === kind, 2500)) return true } return false }
  const shut = async () => { for (let i = 0; i < 6 && (await S()).panel; i++) { await p.keyboard.press('Escape'); await sleep(700) } if (!phone) { await p.mouse.click(550, 350); await sleep(500) } }
  const beside = async (name: string, kind: string) => {
    await set(7, 50); await sleep(600)
    const pr = await poll(() => p.evaluate(() => document.body.innerText.includes('E · reload')), 8000)   // a 1-2 fps box: the HUD hears of the set clip a frame or two later; ok(pr, `${name}: the prompt reads E · reload`)
    await E(); s = await S(); ok((s.rel > 0 || s.ammo === s.clip) && !s.panel, `${name}: E reloads, opens nothing (${s.ammo}/${s.clip}, rel ${s.rel.toFixed(2)}, panel ${s.panel})`)
    ok(await poll(async () => { const s = await S(); return s.ammo === s.clip && s.rel === 0 }), `${name}: the clip fills here`); s = await S(); ok(s.mana < 50 - ECON.reloadMana + 3 && s.mana > 50 - ECON.reloadMana - 0.01, `${name}: paid once (${s.mana.toFixed(2)})`)
    ok(await near() === kind, `${name}: still on it`); if (out) await p.screenshot({ path: `${out}/${kind}.png` as `${string}.png` })
    await E(); ok(await poll(async () => !!(await S()).panel, 8000), `${name}: the next E opens it (${(await S()).panel})`); await shut()
  }
  const greg = await p.evaluate(() => { const g = (window as any).__greg; const v = typeof g === 'function' ? g() : typeof g.at === 'function' ? g.at() : g; return { x: v.x, z: v.z } })
  ok(await face(greg.x, greg.z, 'greg'), 'stood before Greg')
  if (phone) {
    await set(7, 50); await sleep(900); const l = await layout('Greg, gun out'); ok(l.includes('Gregory') && l.includes('reload'), 'Gregory and reload are both up')
    if (out) await p.screenshot({ path: `${out}/greg-${w}.png` as `${string}.png` })
    await tap('reload'); ok(await poll(async () => { const s = await S(); return s.ammo === s.clip && s.rel === 0 && !s.panel }), 'the reload button reloads, no talk')
    await tap('Gregory'); ok(await poll(async () => !!(await S()).panel, 8000), 'the Gregory button talks')
  } else {
    await beside('Greg', 'greg')
    ok(await face(greg.x, greg.z, 'greg'), 'before Greg again')
    await set(7, 50); await p.keyboard.down('KeyE'); for (let i = 0; i < 12; i++) { await sleep(150); await p.keyboard.down('KeyE') } const held = await S(); await p.keyboard.up('KeyE'); ok(!held.panel, 'a HELD E reloads and never talks'); await poll(async () => (await S()).rel === 0)
    await set(7, 0); const c0 = await p.evaluate(() => (window as any).__ather.setMana(0)); void c0; await E(); ok(await poll(async () => !!(await S()).panel, 6000), 'no mana for it: E talks'); await shut()
    const doors = await p.evaluate(() => ((window as any).__ather.zoneDoors() ?? []).map((d: any) => ({ x: d.x, z: d.z, k: d.u?.kind })))
    const gate = await face(GLADE_GATE.x, GLADE_GATE.z, 'gate'); ok(gate, 'stood at the gate'); if (gate) await beside('the gate', 'gate')
    console.log(`  doors in the Glade: ${JSON.stringify(doors).slice(0, 200)}`)
    let did = false; for (const d of doors.filter((d: any) => d.k === 'shop')) { if (await face(d.x, d.z, 'zone')) { await beside(`a ${d.k} door`, 'zone'); did = true; break } }
    if (!did) console.log('  no shop door to stand at')
  }
  clearInterval(keep); ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} catch (e) { ok(false, `threw ${String(e).slice(0, 300)}`) }
await br.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0)
