// ── BETA M234 s2 FOOD FEEDS SPIRITS, POTIONS HEAL KEEPERS: OWNER + ?spirits=3d (2026-11-27, play-M234s2) ─────────────────
// Canon: athernyx game/alchemy.md › THE RECIPES SIT-DOWN (+ Magii 30d19fd Moonberry). A fresh keeper (seeded save) with an
// OLD-SAVE bag (2 Roast Rinn + 1 Roast Tuskroot already in it):
//  A. (run LAST) the Wilds: hurt to 30, hold a Roast Rinn, eat -> NOT healed, the roast stays in the bag (the HUD says it is spirit food).
//  B. the Crusher Table lists the spice mix (Fuli Powder + Firewort) beside its infusions; Make -> +1 Fiery Fuli Powder.
//     The Farm takes Firewort: a Firewort seed is plantable (bag row + icon) [asserted through the item def on the page].
//  C. the hearth grills: Spicy Grilled Rinn (with the made spice), Grilled Rinn with Moonberry, Grilled Rinn with Aqual Sauce.
//  D. her panel (a bloomed fox): every dish has a feed button, the old roasts too. Moonberry dish first: bond 0 -> 7, three
//     Water slots; Grilled Rinn: +4 bond, three more Water; Roast Rinn: bond capped at 12 (only +1); Roast Tuskroot: refused
//     (her bond is full today, no element), stays in the bag; Spicy Grilled Rinn: the bar fills to 10 with a Mana slot (the
//     touch of Mana). Reload: bond + bar kept. 0 page errors.
//   npx tsx scripts/m234-dishes-check.mts [--desk] [--url http://localhost:3203] [--out docs/looks/m234-s2-2026-11-27]
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const desk = process.argv.includes('--desk')
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m234-s2-2026-11-27') + (desk ? '/desk' : '/390')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const CRUSHER = { id: 'm234-crusher', item: 'alc_mortar', x: P.x, z: P.z, q: 0, placedAt: 1 }
const PLANTER = { id: 'vx-m234', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
const ROOM: Room = { id: 'm234-cook', kind: 'cooking', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [] }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(desk ? { width: 1280, height: 800 } : { width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); process.exit(1) }
  await p.evaluateOnNewDocument((at: number, crusher: unknown) => {
    if (sessionStorage.getItem('m234s2')) return; sessionStorage.setItem('m234s2', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null)
    // slot 0 = the old roast (held); the rest in the bag
    const put: [number, string, number][] = [[0, 'roast_rinn', 2], [1, 'waymark', 12], [8, 'roast_tuskroot', 1], [9, 'shimmerscale', 3], [10, 'aqual_sauce', 3],
      [11, 'fuli_powder', 1], [12, 'crop:firewort:D', 1], [13, 'moonberry', 1], [14, 'seed:firewort:D', 1]]
    for (const [k, id, n] of put) slots[k] = { id, n }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [crusher] }))   // the seed runs on the first game load: B's crusher rides it
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: { 'vx-m234': { seed: 'mana_seed_fox', at, bloomed: true } }, met: [] }))
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-m234']))
    localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['vx-m234']))
  }, Date.now() - BLOOM_MS - 60000, CRUSHER)
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
  const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
  const setWorks = (w: unknown) => p.evaluate(v => localStorage.setItem('open.works.v1', JSON.stringify(v)), w)
  const load = async (q = '') => {
    await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d${q}`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500)
    try { await dismissStartCard(p) } catch { /* best effort (desktop card refuses pointer lock headless) */ }
  }

  // ── B. the Crusher Table: Fuli Powder + Firewort -> the spice mix
  await load()
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), CRUSHER.x, CRUSHER.z + 1.3); await sleep(2000)
  await aimAt(p, CRUSHER.x, CRUSHER.z, 0.5); await p.keyboard.press('e'); await sleep(1200)
  const listed = await p.evaluate(() => [...document.querySelectorAll('[data-panel="alchemy"] [data-infusion]')].map(e => `${e.getAttribute('data-infusion')}:${e.getAttribute('data-can')}`).join())
  ok(listed.includes('fiery_fuli_powder:1'), `B the Crusher Table lists the Firewort spice, makeable (${listed})`)
  await shot('b-crusher')
  await click('[data-infusion="fiery_fuli_powder"] [data-act="infusion-make"] button'); await sleep(900)
  const bb = await bag()
  ok(bb.fiery_fuli_powder === 1 && !bb.fuli_powder && !bb['crop:firewort:D'], `B Make: +1 Fiery Fuli Powder, Fuli Powder + Firewort spent (${JSON.stringify({ f: bb.fiery_fuli_powder, p: bb.fuli_powder, w: bb['crop:firewort:D'] })})`)
  const iconOk = await p.evaluate(() => fetch('/open/icons/seed-firewort.svg').then(r => r.ok && r.headers.get('content-type')?.includes('svg')))
  ok(!!iconOk && bb['seed:firewort:D'] === 1, 'B a Firewort seed loads in the bag (its icon is served)')
  await p.keyboard.press('Escape'); await sleep(500)

  // ── C. the hearth grills the first dish + its variants
  await setWorks({ v: 1, rooms: [ROOM], chests: [], pieces: [] }); await load()
  const b = benchOf(ROOM)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.4); await sleep(2000)
  await aimAt(p, b.x, b.z, 0.6); await p.keyboard.press('e'); await sleep(1200)
  const outOf = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.works.v1'))?.rooms?.[0]?.out ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  ok(!await p.evaluate(() => !!document.querySelector('[data-panel="bench"] [data-job="cook-water_meal"]')), 'C the Water meal job is gone (the grill took it)')
  const JOBS: [string, string[]][] = [['grilled_rinn_spicy', ['shimmerscale', 'aqual_sauce', 'fiery_fuli_powder']], ['grilled_rinn_moonberry', ['moonberry']], ['grilled_rinn', []]]
  for (const [d, ins] of JOBS) {
    ok(await p.evaluate(j => !!document.querySelector(`[data-panel="bench"] [data-job="${j}"]`), `grill-${d}`), `C the hearth lists Grill: ${d}`)
    await click(`[data-job-pick="grill-${d}"]`); await sleep(300)
    for (const i of ins) { await click(`[data-src-item="${i}"] [data-move="all"]`); await sleep(400) }
    await click('[data-qty="max"]'); await sleep(200)
    if (d === 'grilled_rinn_spicy') await shot('c-hearth')
    await click('[data-act="focus"] button')
    ok(await poll(async () => ((await outOf())[d] ?? 0) === 1, 120000), `C the hearth grilled 1 ${d}`)
    await sleep(400)
  }
  await click('[data-act="collect-all"] button'); await sleep(800)
  const cb = await bag()
  ok(cb.grilled_rinn === 1 && cb.grilled_rinn_spicy === 1 && cb.grilled_rinn_moonberry === 1, `C collected the three dishes (${JSON.stringify({ g: cb.grilled_rinn, s: cb.grilled_rinn_spicy, m: cb.grilled_rinn_moonberry })})`)
  await p.keyboard.press('Escape'); await sleep(500)

  // ── D. feed her
  await setWorks({ v: 1, rooms: [], chests: [], pieces: [PLANTER] }); await load()
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
  type Pan = { bar: string[]; bond: number; today: number; feeds: Record<string, string>; w: number; overflow: boolean }
  const readPanel = () => p.evaluate(() => {
    const pn = document.querySelector<HTMLElement>('[data-panel="spirit"]'); if (!pn) return null
    const bar = pn.querySelector('[data-meal-bar]'), bd = pn.querySelector('[data-bond]'), r = pn.getBoundingClientRect()
    return { bar: (bar?.getAttribute('data-meal-bar') ?? '').split(',').filter(Boolean), bond: Number(bd?.getAttribute('data-bond') ?? -1), today: Number(bd?.getAttribute('data-bond-today') ?? -1),
      feeds: Object.fromEntries([...pn.querySelectorAll('[data-feed-meal]')].map(x => [x.getAttribute('data-feed-meal')!, `${x.getAttribute('data-feed-steep')}|${x.getAttribute('data-feed-bond')}`])), w: r.width, overflow: r.right > innerWidth + 0.5 || r.left < -0.5 }
  }) as Promise<Pan | null>
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].length)
  async function openPanel(): Promise<Pan | null> {
    for (let k = 0; k < 10; k++) {
      await sleep(3000)
      const t = await p.evaluate(() => { const q = (window as any).__spiritModel?.trots?.fox; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }) as { x: number; z: number; y: number; h: number } | null
      if (!t) { await sleep(500); continue }
      await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
      await p.keyboard.press('e'); await sleep(900)
      if (await opts()) {
        const picked = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace('›', '').trim().startsWith('Open')) as HTMLButtonElement | undefined; b?.click(); return !!b })
        if (!picked) return null
        await sleep(2000)
        return readPanel()
      }
      await p.keyboard.press('Escape'); await sleep(400)
    }
    return null
  }
  const d0 = await openPanel()
  ok(!!d0 && d0.bar.length === 0 && d0.bond === 0, `D her panel: Steep empty, bond 0 (${d0?.bar.join()}, ${d0?.bond})`)
  ok(!!d0 && ['roast_rinn', 'roast_tuskroot', 'grilled_rinn', 'grilled_rinn_spicy', 'grilled_rinn_moonberry'].every(k => k in d0.feeds), `D a feed button for every dish, the old roasts too (${Object.keys(d0?.feeds ?? {}).join()})`)
  ok(d0?.feeds.grilled_rinn === 'water,water,water|4' && d0?.feeds.grilled_rinn_spicy === 'water,water,water,mana|4' && d0?.feeds.roast_rinn === '|3', `D dish values: grill 3 Water, spicy + Mana, roast bond only (${JSON.stringify(d0?.feeds)})`)
  await shot('d-0-panel')
  await click('[data-feed-meal="grilled_rinn_moonberry"]'); await sleep(1000)
  const d1 = await readPanel()
  ok(!!d1 && d1.bond === 7 && d1.bar.join() === 'water,water,water', `D Moonberry dish: bond 0 -> 7 (more than the plain dish's 4), three Water slots (${d1?.bond}, ${d1?.bar.join()})`)
  await click('[data-feed-meal="grilled_rinn"]'); await sleep(1000)
  const d2 = await readPanel()
  ok(!!d2 && d2.bond === 11 && d2.bar.filter(e => e === 'water').length === 6, `D Grilled Rinn + Aqual Sauce: a Water dish fills Water slots (+3) and bond +4 (${d2?.bond}, ${d2?.bar.join()})`)
  await click('[data-feed-meal="roast_rinn"]'); await sleep(1000)
  const d3 = await readPanel(), b3 = await bag()
  ok(!!d3 && d3.bond === 12 && d3.today === 12 && d3.bar.length === 6 && b3.roast_rinn === 1, `D a roast feeds her: bond only, capped at 12 today (${d3?.bond}, today ${d3?.today}, bar ${d3?.bar.length}, roasts left ${b3.roast_rinn})`)
  await click('[data-feed-meal="roast_tuskroot"]'); await sleep(1000)
  const d4 = await readPanel(), b4 = await bag()
  ok(!!d4 && d4.bond === 12 && b4.roast_tuskroot === 1, `D her bond is full today: the roast is refused and stays in the bag (${d4?.bond}, ${b4.roast_tuskroot})`)
  await click('[data-feed-meal="grilled_rinn_spicy"]'); await sleep(1500)
  const d5 = await readPanel()
  ok(!!d5 && d5.bar.length === 10 && d5.bar.filter(e => e === 'mana').length === 1 && d5.bar[9] === 'mana', `D the spicy dish adds a touch of Mana; the Steep sets at 10 (${d5?.bar.join()})`)
  ok(!!d5 && !d5.overflow && d5.w <= (desk ? 1280 : 390), `D the panel fits (${d5?.w.toFixed(0)} px)`)
  await shot('d-1-fed')
  await p.keyboard.press('Escape'); await sleep(600)
  await load()
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
  const d6 = await openPanel()
  ok(!!d6 && d6.bond === 12 && d6.bar.length === 10, `D after a reload: bond 12 + the full Steep kept (${d6?.bond}, ${d6?.bar.length})`)
  // ── A. (run last: the Wilds keeps the keeper there) the Wilds: a held roast no longer heals the keeper
  await load('&waymark=greg')
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__ather?.combat, { timeout: 240000 }); await sleep(4000)
  { const k = ((await read('open.inv.v1'))?.slots ?? []).findIndex((x: { id: string } | null) => x?.id === 'roast_rinn'); await p.keyboard.press(String(k + 1)); await sleep(500) }
  await p.evaluate(() => { const c = (window as any).__ather.combat(); c.hollows.length = 0; c.keeper.hp = 30; c.keeper.sinceHurt = 0 })
  await poll(async () => await p.evaluate(() => (window as any).__ather.hp()) <= 31, 30000)
  const hurt = await p.evaluate(() => (window as any).__ather.hp()) as number
  await p.evaluate(() => { (window as any).__ather.combat().keeper.sinceHurt = 0; (window as any).__ather.eat() })
  await sleep(1500)
  const after = await p.evaluate(() => { const k = (window as any).__ather.combat().keeper; k.sinceHurt = 0; return k.hp }) as number
  const ab = await bag()
  ok(hurt <= 31 && after <= hurt + 3, `A eating a roast no longer heals the keeper (hp ${hurt} -> ${after}; was +40)`)
  ok(ab.roast_rinn === 1, `A the roast stays in the bag (${ab.roast_rinn}; 1 left after D fed one)`)
  ok(await p.evaluate(() => /Food is for spirits/.test(document.body.innerText)), 'A the HUD says food is for spirits')
  await shot('a-wilds-no-heal')

  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
