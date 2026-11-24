// BETA M121: DISCOVERED GROUND CAN TURN GREY BY CHANCE, on prod, 390x844, non-owner. npx tsx scripts/m121-spread-check.mts [--url ...] [--out ...]
//   A fresh profile (born -> the gate): the first section (Greg's stone) reads Hollow ground + infected; every other discovered
//     section reads Charted (M121 s2), its region is drawn Charted on the fold map, the legend has the four words, nothing overflows 390
//   B the roll: game days skipped one by one on a copy of A's save with a fixed seed -> some clear sections turn, none in its
//     grace days, never more than the cap per day, never the first section's kind of exempt one; the same save run again gives
//     the same sections on the same days; another seed gives a different result; a 3000-day absence turns at most the cap
//   C a pre-M121 save (no grey, no rule) loads with every section as the old rule showed it (what it showed Clear without a clear reads Charted), its cleared list unchanged, twice
//   D a waymark on cleared ground: the roll turns it -> Hollow ground + DARK + travel refused; cleared again -> Clear + lit + travels
//   0 page errors
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { SETTLEMENT } from '../src/app/shimmer/open/ather/first-settlement'
import { SECTION_RULE, PRE_M121_GROW_MS, LEGEND, AREA_STATES } from '../src/app/shimmer/open/ather/spread-map'
import { GAME_DAY_MS as D } from '../src/app/shimmer/open/ather/nodes'
import { STARTING_SQUARES } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m121')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; nodes: { id: string; x: number; z: number }[] }[] }).tiles
const fw = [...tiles.find(t => t.name === 'first-wilds')!.nodes].sort((a, b) => Math.hypot(a.x - SETTLEMENT.x, a.z - SETTLEMENT.z) - Math.hypot(b.x - SETTLEMENT.x, b.z - SETTLEMENT.z))
const FIRST = fw[0], OTHERS = fw.slice(1, 6), FAR = fw.find(n => n.id === 'first-wilds:1,0')!
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
type Store = Record<string, string>
async function page(seed?: Store) {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (seed) await p.evaluateOnNewDocument((s: Record<string, string>) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, seed)
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args) as Promise<any>
  const SM = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => { const s = (window as any).__spreadMap?.(); return s ? (typeof s[f] === 'function' ? s[f](...args) : s[f]) : null }, fn, a) as Promise<any>
  const store = (suffix: string) => p.evaluate((s: string) => { const k = Object.keys(localStorage).find(x => x.endsWith(s)); return k ? JSON.parse(localStorage.getItem(k) ?? 'null') : null }, suffix) as Promise<any>
  const load = async () => { await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.wm, { timeout: 240000 }); await sleep(3000) }
  const toWilds = async () => { if ((await A('zone')) !== 'wilds') { await poll(async () => { if ((await A('zone')) === 'wilds') return true; await A('travel', { kind: 'waymark', w: GREG_WAYMARK }); await sleep(4000); return (await A('zone')) === 'wilds' }, 120000) } ; return poll(async () => !!(await SM('seen'))?.length, 60000) }
  return { p, A, SM, store, load, toWilds }
}
const MAP = 'ather.spreadmap.v1', LEDGER = 'ather.nodes.v2'
const keyOf = (s: Store, suffix: string) => Object.keys(s).find(k => k.endsWith(suffix))!
const edit = (s: Store, suffix: string, f: (v: any) => any): Store => ({ ...s, [keyOf(s, suffix)]: JSON.stringify(f(JSON.parse(s[keyOf(s, suffix)]))) })
const seeded = (): Store => ({
  'ather:shimmer:birthRune': 'star', 'ather.garden.v1': JSON.stringify({ owned: [...STARTING_SQUARES], grey: 50, pages: 10, layout: LAYOUT }),
  'open.tutorial.v1': JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'thanked', m70node: null, m70side: 'none' }),
})
try {
  // ── A · fresh ──
  let snap: Store
  {
    const { p, A, SM, store } = await page()
    const tap = async (src: string) => { const b = await p.evaluate((s: string) => { const rx = new RegExp(s, 'i'); let best: DOMRect | null = null, area = Infinity; for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) { const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 40) continue; const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue; if (r.width * r.height < area) { area = r.width * r.height; best = r } } return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 } }, src); if (b) await p.mouse.click(b.x, b.y) }
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
    await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 90000)
    await tap('^BE BORN')
    await poll(() => p.evaluate(() => !!document.querySelector('[data-creator-done]')), 45000)
    await (await p.$('[data-creator-done]'))?.click()
    ok(await poll(async () => (await A('zone')) === 'glade', 60000), `A. fresh: born in the Glade (${await A('zone')})`)
    const gate = { x: -212, z: 212 }, sx = gate.x + 2.4, sz = gate.z - 0.4
    await A('gladeAt', sx, sz, Math.atan2(-(gate.x - sx), -(gate.z - sz)))
    await poll(() => p.evaluate(() => /the gate \(the Wilds\)/.test(document.body.innerText)), 15000)
    await p.keyboard.press('KeyE')
    ok(await poll(async () => (await A('zone')) === 'wilds', 120000), 'A. through the gate')
    await poll(async () => !!(await SM('seen'))?.length, 60000)
    ok((await SM('here')) === FIRST.id && (await SM('state', FIRST.id)) === 'hollow', `A. the first section ${FIRST.id} reads Hollow ground (${await SM('state', FIRST.id)})`)
    ok(((await SM('seen')) as string[]).join() === FIRST.id, `A. only the section stood in is uncovered (${await SM('seen')})`)
    ok((await SM('infected', FIRST.id)) === true, 'A. ...and is infected (its champion is there to fight)')
    for (const n of OTHERS) {
      ok((await SM('state', n.id)) === 'unseen', `A. ${n.id} Unseen before`)
      await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), n.x, n.z + 12)
      const got = await poll(async () => (await SM('state', n.id)) !== 'unseen', 30000)
      ok(got && (await SM('state', n.id)) === 'charted', `A. ${n.id} discovered: Charted (${await SM('state', n.id)})`)
    }
    const other = ((await SM('seen')) as string[]).filter(id => id !== FIRST.id)
    const states = await Promise.all(other.map(id => SM('state', id)))
    ok(other.length >= OTHERS.length && states.every(s => s === 'charted'), `A. every other discovered section Charted (${other.length})`)
    await SM('seen'); await A('wmClear', OTHERS[0].id); await sleep(1500)   // one section cleared: all four states on the map
    ok((await SM('state', OTHERS[0].id)) === 'clear', `A. ${OTHERS[0].id} cleared: Clear`)
    await A('open', 'gate'); await sleep(2500)
    const map = await p.evaluate(() => {
      const L = document.querySelector<HTMLElement>('[data-spread-legend]'); if (!L) return null
      const sw = [...L.querySelectorAll<HTMLElement>('[data-legend-state]')]
      const panel = L.closest<HTMLElement>('[data-panel]') ?? document.body
      const out = [...panel.querySelectorAll<HTMLElement>('div, span, button')].filter(e => { const r = e.getBoundingClientRect(); return (e.textContent ?? '').trim() && r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5) }).length
      return { states: sw.map(s => s.dataset.legendState), words: sw.map(s => s.innerText.replace(/·/g, '').trim()), looks: new Set(sw.map(s => { const c = getComputedStyle(s.querySelector('span')!); return `${c.backgroundImage}|${c.borderTopStyle}|${c.borderTopColor}` })).size, out, wide: document.documentElement.scrollWidth - innerWidth, legendWide: L.scrollWidth - L.clientWidth }
    })
    ok(!!map && map.words.join(' · ') === LEGEND().join(' · ') && map.states.join() === AREA_STATES.join(), `A. the legend: ${map?.words.join(' · ')}`)
    ok(map?.looks === 4, `A. four different swatches (${map?.looks})`)
    ok(!!map && map.out === 0 && map.wide <= 0 && map.legendWide <= 0, `A. no text overflows 390 (${JSON.stringify(map)})`)
    await p.evaluate(() => document.querySelector('[data-spread-legend]')?.scrollIntoView({ block: 'center' })); await p.screenshot({ path: `${out}/a-legend.png` })
    await p.evaluate(() => document.querySelector('[data-panel] canvas')?.scrollIntoView({ block: 'start' })); await p.screenshot({ path: `${out}/a-map.png` }); await p.keyboard.press('Escape')
    // the map's own pixels: one section's ground on the fold map while Charted, then once cleared
    const paint = async (n: { x: number; z: number }) => {
      await A('open', 'gate'); await sleep(2500)
      const c = await p.evaluate((x, z) => { const cv = document.querySelector<HTMLCanvasElement>('[data-panel] canvas'); if (!cv || cv.width !== 1500) return null; const d = cv.getContext('2d')!.getImageData(Math.round((x / 1000 + 1.5) * 500) - 4, Math.round((z / 1000 + 1.5) * 500) - 4, 8, 8).data; let r = 0, g = 0, b = 0; for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2] } return [r, g, b].map(v => Math.round(v / 64)) }, n.x, n.z)
      await p.keyboard.press('Escape'); await sleep(800); return c
    }
    const asCharted = await paint(OTHERS[1]), st1 = await SM('state', OTHERS[1].id)
    await A('wmClear', OTHERS[1].id); await sleep(5000)
    const asClear = await paint(OTHERS[1]), st2 = await SM('state', OTHERS[1].id)
    ok(st1 === 'charted' && st2 === 'clear' && !!asCharted && !!asClear && asCharted[0] - asCharted[1] >= asClear[0] - asClear[1] + 6, `A. the map paints Charted ground its own colour (Charted ${asCharted}, Clear ${asClear})`)
    const m = await store(MAP)
    ok(!!m?.rule && Object.keys(m.grey).join() === FIRST.id, `A. saved: rule + the one grey section (${JSON.stringify(m?.rule)}, ${Object.keys(m?.grey ?? {})})`)
    snap = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage))) as Store
    await p.close()
  }
  // ── B · the roll ──
  const DAYS = 30
  const play = async (seed: number) => {
    const { p, A, SM, store, load, toWilds } = await page(edit(snap, MAP, m => ({ ...m, rule: { ...m.rule, seed } })))
    await load(); await toWilds()
    const perDay: number[] = []
    let firstTurn = Infinity
    for (let d = 1; d <= DAYS; d++) { const b = Object.keys((await store(MAP)).grey).length; await A('skipDays', 1); await sleep(250); const a = Object.keys((await store(MAP)).grey).length; perDay.push(a - b); if (a > b) firstTurn = Math.min(firstTurn, d) }
    await sleep(4500)
    const m = await store(MAP), led = await store(LEDGER)
    const shown = await Promise.all(Object.keys(m.grey).map(id => SM('state', id)))
    await A('open', 'gate'); await sleep(1500); await p.screenshot({ path: `${out}/b-map-${seed}.png` })
    await p.close()
    return { m, led, perDay, firstTurn, shown }
  }
  const M0 = JSON.parse(snap[keyOf(snap, MAP)])
  if (M0.rule) {
    const a = await play(12345), b = await play(12345), c = await play(777)
    const upto = Math.min(a.m.rule.day, b.m.rule.day)
    const g = (m: any, to: number) => JSON.stringify(Object.entries(m.grey as Record<string, number>).filter(([id, t]) => id !== FIRST.id && t <= to * D).sort())
    const turned = Object.keys(a.m.grey).filter(id => id !== FIRST.id)
    console.log(`  seed 12345 turned ${g(a.m, upto)}; per day ${a.perDay.join('')}`)
    ok(turned.length > 0 && turned.length < Object.keys(a.m.seen).length - 1, `B. over ${DAYS} days some, not all, turned (${turned.length} of ${Object.keys(a.m.seen).length})`)
    ok(a.shown.every(s => s === 'hollow'), `B. each reads Hollow ground (${a.shown})`)
    ok(a.firstTurn > SECTION_RULE.graceDays, `B. none in the grace days (first on day ${a.firstTurn})`)
    ok(a.perDay.every(n => n <= SECTION_RULE.capPerCatchUp), 'B. never over the cap')
    ok(g(a.m, upto) === g(b.m, upto), 'B. same seed: the same sections on the same days')
    ok(g(c.m, c.m.rule.day) !== g(a.m, a.m.rule.day), `B. another seed: a different result (${g(c.m, c.m.rule.day)})`)
    const away = edit(snap, MAP, m => ({ ...m, seen: { ...Object.fromEntries(Object.entries(m.seen as Record<string, number>).map(([k, t]) => [k, t - 3000 * D])), ...Object.fromEntries(fw.slice(0, 20).map(n => [n.id, Date.now() - 3000 * D])) }, rule: { ...m.rule, seed: 5, day: m.rule.day - 3000 } }))
    const q = await page(away); await q.load(); await q.toWilds(); const am = await q.store(MAP); await q.p.close()
    const n = Object.keys(am.grey).filter(id => id !== FIRST.id).length
    ok(n === SECTION_RULE.capPerCatchUp, `B. away 3000 days, ${Object.keys(am.seen).length} discovered: ${n} turned (cap ${SECTION_RULE.capPerCatchUp})`)
  } else ok(false, 'B. no rule in the save: the roll is not live')
  // ── C · a pre-M121 save ──
  {
    const now = Date.now(), ids = fw.slice(0, 8).map(n => n.id), seen: Record<string, number> = {}
    ids.forEach((id, i) => { seen[id] = i % 2 ? now - PRE_M121_GROW_MS - 3600e3 : now - 3600e3 })
    const clean = [ids[1], ids[4]].sort()   // one long-untended but cleared, one fresh and cleared
    const want = ids.map((id, i) => (clean.includes(id) ? 'clear' : i % 2 ? 'hollow' : 'charted')).join()
    const { p, A, SM, store, load, toWilds } = await page({ ...seeded(), 'open.tutorial.v1': JSON.stringify({ ...JSON.parse(seeded()['open.tutorial.v1']), m70: 'none' }), [MAP]: JSON.stringify({ v: 1, seen, first: true }), [LEDGER]: JSON.stringify({ v: 2, epoch: now - 400 * D, at: now - 100 * D, clean }) })
    await load(); await toWilds(); await sleep(5000)
    const read = async () => (await Promise.all(ids.map(id => SM('state', id)))).join()
    ok((await read()) === want, `C. pre-M121 save: every section unchanged (${await read()})`)
    ok(((await store(LEDGER)).clean as string[]).join() === clean.join(), `C. ...its cleared ground is untouched (${(await store(LEDGER)).clean})`)
    ok((await SM('state', FIRST.id)) === 'charted' && (await SM('state', fw[9].id)) === 'unseen', 'C. ...the first section is not re-infected, unseen stays unseen')
    await load(); await toWilds(); await sleep(5000)
    ok((await read()) === want && !!(await store(MAP)).rule, 'C. a second load: the same, the rule now running')
    ok((await A('zone')) === 'wilds', 'C. in the Wilds'); await p.close()
  }
  // ── D · the waymark ──
  {
    const { p, A, SM, load, toWilds } = await page(seeded())
    await load(); await toWilds()
    ok((await SM('state', FIRST.id)) === 'charted', `D. a keeper whose big one already fell: the first section is not re-infected (${await SM('state', FIRST.id)})`)
    await A('wmGoto', FAR.x, FAR.z); await sleep(6000)
    const node = await A('wmClearHere'); await sleep(1500)
    const r = await A('wmPlant'), w = (await A('wm'))[0]
    ok(r?.ok === true && w?.node === node, `D. planted on cleared ground (${node})`)
    const lit = async () => ((await A('wmLit')) as { id: string; lit: boolean }[]).find(k => k.id === w.id)?.lit
    ok((await lit()) === true && (await poll(async () => (await SM('state', node)) === 'clear', 15000)), 'D. Clear + lit')
    let days = 0
    for (; days < 150 && (await SM('state', node)) !== 'hollow'; days++) { await A('skipDays', 1); await sleep(300); for (const id of (await SM('grey') ?? []) as string[]) if (id !== node) { await A('wmClear', id); await sleep(150) } }
    ok((await SM('state', node)) === 'hollow' && days > SECTION_RULE.graceDays, `D. the roll turned it grey after ${days} days`)
    ok((await lit()) === false, 'D. its waymark is DARK')
    await A('travel', { kind: 'home' }); await poll(async () => (await A('zone')) === 'plot', 30000); await sleep(3000)
    await A('travel', { kind: 'waymark', w }); await sleep(3500)
    ok((await A('zone')) === 'plot', 'D. dark: travel refused')
    ok((await A('wmClear', node)) === true, 'D. cleared again'); await sleep(1000)
    ok((await lit()) === true, 'D. RELIT')
    await A('travel', { kind: 'waymark', w })
    ok(await poll(async () => (await A('zone')) === 'wilds', 60000), 'D. relit: travels')
    ok(await poll(async () => (await SM('state', node)) === 'clear', 15000), 'D. the section reads Clear')
    await p.close()
  }
  ok(errs.length === 0, `Z. page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS'); process.exit(fails ? 1 : 0)
