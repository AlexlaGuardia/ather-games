// BETA M140: THE OWNER'S "ALL GUNS" BUTTON, on prod, 390x844, in the Ather. Fresh profiles (anonymous keepers, never a real save), every
// non-GET stubbed. Seed: Backbone (a bought Lens) + Repeater owned, Backbone and Repeater worn, 777 Marks.
//  PLAYER 1 no Dev tab, no gun button (also with ?dev=1&owner=1 on the URL).
//  OWNER  2 the button adds the other 4 (6 in all), nothing worn / fitted / spent changes; a second press adds none.  3 the Character
//         dropdowns list all 6; each is equipped there, drawn (R) in the Wilds and fires (its ammo drops).  4 a reload keeps the 6.
//         5 the second button: exactly the old set, a worn lent gun out of its slot; vessels, fit, Marks as before.  6 0 page errors.
//   OWNER_KEY=... npx tsx scripts/m140-guns-check.mts [--url ...]
import puppeteer, { type Page } from 'puppeteer-core'
import { RANGE_GUNS } from '../src/app/shimmer/open/shared/gunplay'
import { slotOfGun } from '../src/app/shimmer/open/shared/loadout'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), KEY = process.env.OWNER_KEY; if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms = 30000) => { for (let t = 0; t < ms; t += 400) { if (await f().catch(() => false)) return true; await sleep(400) } return false }
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const LO = { v: 1, guns: ['backbone', 'repeater'], primary: 'backbone', secondary: 'repeater', kael: true, vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove', fit: { backbone: { owned: ['lens'], sight: 'lens' } } }
const ALL = RANGE_GUNS.map(g => g.id)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
async function open(owner: boolean, q = '') {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)) === owner, owner ? '0. the OWNER' : '0. NOT the owner')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m140')) return; sessionStorage.setItem('m140', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut)); localStorage.setItem('open.loadout.v1', JSON.stringify(s.lo)); localStorage.setItem('ather:trade:trial-ledger', JSON.stringify({ marks: 777 })) }, { tut: TUT, lo: LO })
  await go(p, q); return p
}
async function go(p: Page, q = '') {
  await p.goto(`${url}/shimmer/open/ather?hour=14&waymark=greg${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__ather?.combat, { timeout: 240000 }); await sleep(4000)
  await p.touchscreen.tap(195, 644); await sleep(800)
}
const key = async (p: Page, k: 'KeyO' | 'KeyP' | 'KeyR' | 'Escape', hold = 80) => { await p.keyboard.down(k); await sleep(hold); await p.keyboard.up(k); await sleep(1200) }
const dev = async (p: Page) => { if (!(await p.$('[data-panel="options"]'))) await key(p, 'KeyO'); await poll(async () => !!(await p.$('[data-panel="options"]')), 8000); await sleep(1500); const b = await click(p, '^Dev$'); await sleep(600); return b }
const click = (p: Page, re: string) => p.evaluate((src: string) => { const rx = new RegExp(src), b = [...document.querySelectorAll<HTMLElement>('[data-panel="options"] button')].find(e => rx.test(e.textContent ?? '')); b?.click(); return !!b }, re)
const lo = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('open.loadout.v1')!)) as Promise<any>
const rest = (l: any) => JSON.stringify([l.vessels, l.tactical, l.signature, l.kael, l.fit]), marks = (p: Page) => p.evaluate(() => localStorage.getItem('ather:trade:trial-ledger'))
try {
  for (const q of ['', '&dev=1&owner=1']) { const n = await open(false, q); await key(n, 'KeyO')
    ok(await poll(async () => !!(await n.$('[data-panel="options"]')), 8000), `1. player${q}: Options opens`); await sleep(2000)
    ok(!(await click(n, '^Dev$')) && !(await n.evaluate(() => /All guns|added guns/.test(document.body.textContent ?? ''))), `1. player${q}: no Dev tab, no gun button`); await n.close() }
  const p = await open(true), m0 = await marks(p)
  ok(await dev(p), '2. owner: the Dev tab'); ok(await click(p, 'All guns'), '2. owner: the All guns button'); await sleep(800)
  let l = await lo(p); ok(ALL.every(g => l.guns.includes(g)) && l.guns.length === ALL.length, `2. all ${ALL.length} owned (${l.guns})`)
  ok(l.primary === 'backbone' && l.secondary === 'repeater' && rest(l) === rest(LO) && (await marks(p)) === m0, '2. worn guns, vessels, sights, Marks untouched')
  const j = JSON.stringify(l); await click(p, 'All guns'); await sleep(600); ok(JSON.stringify(await lo(p)) === j, '2. a second press adds none'); await key(p, 'Escape')
  // 3. equip each in the Character tab, draw, fire
  for (const g of RANGE_GUNS) {
    const slot = slotOfGun(g), other = slot === 'primary' ? 'secondary' : 'primary'
    await key(p, 'KeyP'); await poll(async () => !!(await p.$('[data-slot-id]')), 8000)
    const list = await p.evaluate(async (s: string, o: string, id: string) => {
      const w = (ms: number) => new Promise(r => setTimeout(r, ms)), el = (x: string) => document.querySelector<HTMLElement>(`[data-slot-id="${x}"]`)!
      el(o).querySelector<HTMLElement>('button')!.click(); await w(400); [...el(o).querySelectorAll<HTMLElement>('button')].find(b => /Leave this slot empty/.test(b.textContent ?? ''))?.click(); await w(400)
      if (!el(s).querySelector('[data-option]')) { el(s).querySelector<HTMLElement>('button')!.click(); await w(400) }
      const ids = [...el(s).querySelectorAll<HTMLElement>('[data-option]')].map(b => b.dataset.option!); el(s).querySelector<HTMLElement>(`[data-option="${id}"]`)?.click(); await w(400); return ids }, slot, other, g.id)
    ok(list.length === RANGE_GUNS.filter(x => slotOfGun(x) === slot).length && list.includes(g.id), `3. ${g.id}: in the ${slot} dropdown (${list})`)
    await key(p, 'KeyP'); await poll(async () => !(await p.$('[data-panel^="pack-"]')), 8000); await sleep(500)
    const id = () => p.evaluate(() => [(window as any).__ather.combat().gun.id, (window as any).__ather.stance().kind])
    await p.evaluate(() => { const C = (window as any).__ather.combat(); C.hollows.length = 0 })
    if ((await id())[1] !== 'weapon') await key(p, 'KeyR')
    const drawn = await poll(async () => { const s = await id(); return s[0] === g.id && s[1] === 'weapon' }, 12000)
    await p.evaluate(() => { const C = (window as any).__ather.combat(); C.keeper.hp = C.keeper.maxHp; C.keeper.ammo = C.gun.clip; C.keeper.reloading = 0 }); await sleep(600)
    const a0 = await p.evaluate(() => (window as any).__ather.combat().keeper.ammo) as number
    const box = await p.evaluate(() => { const e = document.querySelector('[data-touch="fire"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
    if (box) await p.touchscreen.touchStart(box.x, box.y)
    await poll(async () => (await p.evaluate(() => (window as any).__ather.combat().keeper.ammo) as number) < a0, 6000)
    if (box) await p.touchscreen.touchEnd()
    let a1 = await p.evaluate(() => (window as any).__ather.combat().keeper.ammo) as number
    if (a1 >= a0) { await sleep(1500); a1 = await p.evaluate(() => (window as any).__ather.combat().keeper.ammo) as number }   // a charge gun lets go on the release
    ok(drawn && !!box && a1 < a0, `3. ${g.id}: drawn and fired in the Wilds (${await id()}, ammo ${a0} -> ${a1}${box ? '' : ', no fire button'})`)
  }
  await go(p); l = await lo(p); ok(ALL.every(g => l.guns.includes(g)) && l.guns.length === ALL.length && !!l.primary !== !!l.secondary, `4. a reload keeps the 6 (worn ${l.primary} / ${l.secondary})`)
  const lent = (g: string | null) => (g && !LO.guns.includes(g) ? null : g), w = [lent(l.primary), lent(l.secondary)]
  ok(await dev(p) && await click(p, 'Take back the added guns'), '5. the second button'); await sleep(800); l = await lo(p)
  ok(l.guns.join() === LO.guns.join() && l.primary === w[0] && l.secondary === w[1] && !l.lent, `5. exactly the old set (${l.guns}; worn ${l.primary} / ${l.secondary})`)
  ok(rest(l) === rest(LO) && (await marks(p)) === m0, '5. vessels, sights, Marks as before')
  ok(!(await p.evaluate(() => /added guns/.test(document.querySelector('[data-panel="options"]')?.textContent ?? ''))), '5. and that button is gone')
  await p.close()
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 400)}`) }
ok(errs.length === 0, `6. 0 page errors ${errs.slice(0, 3).join(' | ')}`)
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
