// BETA M235 s1: FEWER, BIGGER ZONES, ALL START INFECTED, UNCOVERED WHOLE, A SLOW RETURN. On prod, non-owner, fresh/seeded test keepers
// only. npx tsx scripts/m235-zones-check.mts [--url ...] [--out ...] [--desk]   (390x844 by default; --desk = 1280x800)
// REPLACES m121-spread-check.mts, whose asserts' MEANING changed with M235 (Alex 11-27 reverses M121): "every other discovered
// section reads Charted" -> every uncovered zone reads Hollow ground; "four words / four swatches" -> three; "the first section
// alone starts grey" -> every zone starts infected; "8%/day, 3 per catch-up" -> ZONE_RULE (2%/day after 3 days, 1 per catch-up);
// "a pre-M121 save keeps its sections" -> an old save converts sections onto zones.
//   A fresh keeper: nothing uncovered before the gate; through it the WHOLE zone is uncovered and reads Hollow ground + infected,
//     the fold map paints a far corner of that zone (never walked) out of the mist while a never-entered zone stays under it;
//     another zone stepped into reads Hollow ground; its champion's ground cleared -> Clear; the legend is the three signed
//     words with three swatches, nothing overflows; zones ~ a quarter of the old sections (the champion count)
//   B the return: a save with many cleared zones, days skipped one by one from the plot (no zone stood in): some turn, at most
//     one a day, none in the grace days; the same seed gives the same zones on the same days, another seed differs
//   C an old-format save (sections, no zones flag) converts: a zone clear only if all its sections were; uncovered if any was
//   D a waymark bound on a cleared zone: the return turns it -> DARK + travel refused; cleared again -> lit
//   0 page errors
import puppeteer, { type Page } from 'puppeteer-core'
import { pickWilds } from './lib/glade-gate.mts'   // M172: E at the Glade's gate opens the fold map; the Wilds is a stop on it
import { mkdirSync, readFileSync } from 'node:fs'
import { SETTLEMENT } from '../src/app/shimmer/open/ather/first-settlement'
import { ZONE_RULE, LEGEND, AREA_STATES } from '../src/app/shimmer/open/ather/spread-map'
import { fuseZones } from '../src/app/shimmer/open/ather/zones'
import { SUB } from '../src/app/shimmer/open/ather/nodes'
import { dismissStartCard } from './lib/start-card.mts'
import { GAME_DAY_MS as D } from '../src/app/shimmer/open/ather/nodes'
import { STARTING_SQUARES } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m235'), DESK = process.argv.includes('--desk')
mkdirSync(out, { recursive: true })
// the phone tap card closes on a tap; the no-touch "Click to play" card needs pointer lock, which headless refuses: it is pointer-events
// none and sits under the panels, so failing to close it is not a failure of the check
const card = async (p: any) => { try { await dismissStartCard(p, 5000) } catch { /* see above */ } }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: any[] }[] }).tiles
const F = fuseZones(tiles.flatMap(t => t.nodes.map(n => ({ ...n, tile: t.name, x: n.x + t.tx * 1000, z: n.z + t.ty * 1000, gi: t.tx * SUB + n.i, gj: t.ty * SUB + n.j }))))
const Z = (sectionId: string) => F.zoneOf.get(sectionId)!
const fw = [...tiles.find(t => t.name === 'first-wilds')!.nodes].sort((a, b) => Math.hypot(a.x - SETTLEMENT.x, a.z - SETTLEMENT.z) - Math.hypot(b.x - SETTLEMENT.x, b.z - SETTLEMENT.z))
const FIRST = fw[0], OTHERS = fw.slice(1, 6), FAR = fw.find(n => n.id === 'first-wilds:1,0')!
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
type Store = Record<string, string>
async function page(seed?: Store) {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport(DESK ? { width: 1280, height: 800, deviceScaleFactor: 1 } : { width: 390, height: 844, deviceScaleFactor: 1 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (seed) await p.evaluateOnNewDocument((s: Record<string, string>) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, seed)
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args) as Promise<any>
  const SM = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => { const s = (window as any).__spreadMap?.(); return s ? (typeof s[f] === 'function' ? s[f](...args) : s[f]) : null }, fn, a) as Promise<any>
  const store = (suffix: string) => p.evaluate((s: string) => { const k = Object.keys(localStorage).find(x => x.endsWith(s)); return k ? JSON.parse(localStorage.getItem(k) ?? 'null') : null }, suffix) as Promise<any>
  const load = async () => { await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.wm, { timeout: 240000 }); await sleep(3000); await card(p) }
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
  const zFirst = Z(FIRST.id)
  {
    const { p, A, SM, store } = await page()
    const tap = async (src: string) => { const b = await p.evaluate((s: string) => { const rx = new RegExp(s, 'i'); let best: DOMRect | null = null, area = Infinity; for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) { const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 40) continue; const r = e.getBoundingClientRect(); if (r.width && r.height && r.width * r.height < area) { area = r.width * r.height; best = r } } return best ? { x: best.x + best.width / 2, y: best.y + best.height / 2 } : null }, src); if (b) await p.mouse.click(b.x, b.y); return !!b }
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
    await card(p)
    await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 90000)
    await tap('^BE BORN')
    await poll(() => p.evaluate(() => !!document.querySelector('[data-creator-done]')), 45000)
    await (await p.$('[data-creator-done]'))?.click()
    ok(await poll(async () => (await A('zone')) === 'glade', 60000), `A. fresh: born in the Glade (${await A('zone')})`)
    ok(((await store(MAP))?.seen && Object.keys((await store(MAP)).seen).length) ? false : true, 'A. fresh: nothing uncovered (all Unseen)')
    const gate = { x: -212, z: 212 }, sx = gate.x + 2.4, sz = gate.z - 0.4
    await A('gladeAt', sx, sz, Math.atan2(-(gate.x - sx), -(gate.z - sz)))
    await poll(() => p.evaluate(() => /the gate \(fold map\)/.test(document.body.innerText)), 15000)
    await p.keyboard.press('KeyE'); await pickWilds(p)
    ok(await poll(async () => (await A('zone')) === 'wilds', 120000), 'A. through the gate')
    await poll(async () => !!(await SM('seen'))?.length, 60000)
    const zs = await SM('zones'), secs = await SM('sections')
    console.log(`  zones ${zs} / sections ${secs}`)
    ok(zs === F.zones.length && secs > 0 && zs / secs < 0.34 && zs / secs > 0.2, `A. champions: ${zs} zones where there were ${secs} sections (${(zs / secs).toFixed(2)})`)
    ok((await SM('here')) === zFirst && (await SM('state', zFirst)) === 'hollow' && (await SM('infected', zFirst)) === true, `A. the first zone ${zFirst} reads Hollow ground + infected (${await SM('state', zFirst)})`)
    ok(((await SM('seen')) as string[]).join() === zFirst, `A. only the zone stood in is uncovered (${await SM('seen')})`)
    // the fold map: a corner of this zone the keeper never walked is out of the mist; a never-entered zone stays under it
    const mem = F.members.get(zFirst)!.map(id => fw.find(n => n.id === id)).filter(Boolean) as typeof fw
    const far = [...mem].sort((a, b) => Math.hypot(b.x - SETTLEMENT.x, b.z - SETTLEMENT.z) - Math.hypot(a.x - SETTLEMENT.x, a.z - SETTLEMENT.z))[0]
    const unseen = fw.find(n => Z(n.id) !== zFirst && Math.hypot(n.x - SETTLEMENT.x, n.z - SETTLEMENT.z) > 250)!
    const lum = async (n: { x: number; z: number }) => p.evaluate((x, z) => { const cv = document.querySelector<HTMLCanvasElement>('[data-panel] canvas'); if (!cv || cv.width !== 1500) return null; const d = cv.getContext('2d')!.getImageData(Math.round((x / 1000 + 1.5) * 500) - 4, Math.round((z / 1000 + 1.5) * 500) - 4, 8, 8).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += d[k] + d[k + 1] + d[k + 2]; return s / (d.length / 4) / 3 }, n.x, n.z) as Promise<number | null>
    await A('open', 'gate'); await sleep(2500)
    const lFar = await lum(far), lUn = await lum(unseen)
    console.log(`  far corner ${far.id} (${Math.round(Math.hypot(far.x - SETTLEMENT.x, far.z - SETTLEMENT.z))} m off) lum ${lFar?.toFixed(0)}; unseen ${unseen.id} lum ${lUn?.toFixed(0)}`)
    ok(lFar !== null && lUn !== null && lFar > lUn + 25, `A. the whole zone is uncovered on the map: its far corner ${lFar?.toFixed(0)} vs a never-entered zone ${lUn?.toFixed(0)}`)
    await p.evaluate(() => document.querySelector('[data-panel] canvas')?.scrollIntoView({ block: 'start' })); await p.screenshot({ path: `${out}/a-zone-uncovered.png` }); await p.keyboard.press('Escape'); await sleep(800)
    // another zone: stepped in -> Hollow ground, whole
    const next = fw.find(n => Z(n.id) !== zFirst && Math.hypot(n.x - SETTLEMENT.x, n.z - SETTLEMENT.z) < 400)!, zNext = Z(next.id)
    ok((await SM('state', zNext)) === 'unseen', `A. ${zNext} Unseen before`)
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), next.x, next.z + 12)
    ok(await poll(async () => (await SM('state', zNext)) === 'hollow', 30000), `A. ${zNext} stepped into: Hollow ground (${await SM('state', zNext)})`)
    ok(((await SM('seen')) as string[]).every(id => id.startsWith('z')), 'A. the map is keyed by zones')
    await A('wmClear', zNext); await sleep(1500)   // its champion's ground cleared (the check hook clears it as a kill does)
    ok((await SM('state', zNext)) === 'clear', `A. ${zNext} cleared: Clear`)
    await A('open', 'gate'); await sleep(2500)
    const map = await p.evaluate(() => {
      const L = document.querySelector<HTMLElement>('[data-spread-legend]'); if (!L) return null
      const sw = [...L.querySelectorAll<HTMLElement>('[data-legend-state]')]
      const panel = L.closest<HTMLElement>('[data-panel]') ?? document.body
      const out = [...panel.querySelectorAll<HTMLElement>('div, span, button')].filter(e => { const r = e.getBoundingClientRect(); return (e.textContent ?? '').trim() && r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5) }).length
      return { states: sw.map(s => s.dataset.legendState), words: sw.map(s => s.innerText.replace(/·/g, '').trim()), looks: new Set(sw.map(s => { const c = getComputedStyle(s.querySelector('span')!); return `${c.backgroundImage}|${c.borderTopStyle}|${c.borderTopColor}` })).size, out, wide: document.documentElement.scrollWidth - innerWidth, legendWide: L.scrollWidth - L.clientWidth, body: document.body.innerText }
    })
    ok(!!map && map.words.join(' · ') === 'Unseen · Hollow ground · Clear' && map.words.join(' · ') === LEGEND().join(' · ') && map.states.join() === AREA_STATES.join(), `A. the legend: ${map?.words.join(' · ')}`)
    ok(map?.looks === 3, `A. three different swatches (${map?.looks})`)
    ok(!!map && !/charted/i.test(map.body), 'A. the retired word is nowhere on the page')
    ok(!!map && map.out === 0 && map.wide <= 0 && map.legendWide <= 0, `A. no text overflows (${JSON.stringify({ ...map, body: undefined })})`)
    await p.evaluate(() => document.querySelector('[data-spread-legend]')?.scrollIntoView({ block: 'center' })); await p.screenshot({ path: `${out}/a-legend.png` })
    await p.keyboard.press('Escape')
    const m = await store(MAP)
    ok(!!m?.rule && m.zones === 1, `A. saved: zones + the return rule (${JSON.stringify(m?.rule)})`)
    snap = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage))) as Store
    await p.close()
  }
  // ── B · the return ──
  const DAYS = 40, cleared = F.zones.filter(z => z.tile === 'first-wilds' || z.tile === GREG_WAYMARK.tile).map(z => z.id).slice(0, 30)
  const play = async (seed: number) => {
    const now = Date.now()
    const s0 = edit(edit(snap, MAP, m => ({ ...m, seen: Object.fromEntries(cleared.map(id => [id, now - 3600e3])), grey: {}, rule: { ...m.rule, seed } })), LEDGER, l => ({ ...l, clean: [...cleared].sort() }))
    const { p, A, store, load } = await page(s0)
    await load()
    await A('travel', { kind: 'home' }); await poll(async () => (await A('zone')) === 'plot', 60000); await sleep(1500)
    const perDay: number[] = []; let firstTurn = Infinity
    for (let d = 1; d <= DAYS; d++) { const b = ((await store(LEDGER)).clean as string[]).length; await A('skipDays', 1); await sleep(250); const a = ((await store(LEDGER)).clean as string[]).length; perDay.push(b - a); if (b > a) firstTurn = Math.min(firstTurn, d) }
    const m = await store(MAP)
    await p.close()
    return { m, perDay, firstTurn }
  }
  {
    const a = await play(12345), b = await play(12345), c = await play(777)
    const g = (m: any) => JSON.stringify(Object.entries(m.grey as Record<string, number>).sort())
    const n = Object.keys(a.m.grey).length
    console.log(`  ${cleared.length} cleared zones; seed 12345 per day ${a.perDay.join('')}; seed 777 ${c.perDay.join('')}`)
    ok(n > 0 && n < cleared.length, `B. over ${DAYS} days some, not all, cleared zones were taken back (${n} of ${cleared.length})`)
    ok(a.firstTurn > ZONE_RULE.graceDays, `B. none in the ${ZONE_RULE.graceDays} grace days (first on day ${a.firstTurn})`)
    ok(a.perDay.every(k => k <= ZONE_RULE.capPerCatchUp), `B. at most ${ZONE_RULE.capPerCatchUp} a day`)
    ok(g(a.m) === g(b.m), 'B. same seed: the same zones on the same days')
    ok(g(c.m) !== g(a.m), 'B. another seed: a different result')
  }
  // ── C · an old-format save (sections) converts ──
  {
    const now = Date.now(), full = [...F.members.entries()].filter(([z, g]) => g.length === 4 && g.every(id => id.startsWith('first-wilds:')))
    const [zA, gA] = full[0], [zB, gB] = full[1] ?? full[0]
    const seen = Object.fromEntries([gA[0], gB[1]].map(id => [id, now - 3600e3]))
    const clean = [...gA, ...gB.slice(0, 3)].sort()
    const { p, SM, store, load, toWilds } = await page({ ...seeded(), [MAP]: JSON.stringify({ v: 1, seen, first: true, grey: {}, rule: { seed: 9, day: Math.floor(now / D), since: now - 3600e3 } }), [LEDGER]: JSON.stringify({ v: 2, epoch: now - 400 * D, at: now - 100 * D, clean }) })
    await load(); await toWilds(); await sleep(5000)
    const m = await store(MAP), l = await store(LEDGER)
    ok(m?.zones === 1 && !Object.keys(m.seen).some((id: string) => id.startsWith('first-wilds:')), `C. converted: the map is keyed by zones (${Object.keys(m?.seen ?? {}).slice(0, 4)})`)
    ok((l.clean as string[]).includes(zA) && !(l.clean as string[]).includes(zB) && !(l.clean as string[]).some(id => id.startsWith('first-wilds:')), `C. ${zA} (4 of 4 sections clear) clear; ${zB} (3 of 4) still infected`)
    ok((await SM('state', zA)) === 'clear' && (zA === zB || (await SM('state', zB)) === 'hollow'), `C. on the map: ${zA} ${await SM('state', zA)}, ${zB} ${await SM('state', zB)}`)
    ok(m.rule?.seed === 9, 'C. its seed carries')
    await load(); await toWilds(); await sleep(3000)
    ok(JSON.stringify((await store(LEDGER)).clean) === JSON.stringify(l.clean), 'C. a second load: unchanged')
    await p.close()
  }
  // ── D · the waymark ──
  {
    const { p, A, SM, load, toWilds } = await page(seeded())
    await load(); await toWilds()
    await A('wmGoto', FAR.x, FAR.z); await sleep(6000)
    const node = await A('wmClearHere'); await sleep(1500)
    const r = await A('wmPlant'), w = (await A('wm'))[0]
    ok(r?.ok === true && w?.node === node && String(node).startsWith('z'), `D. planted on a cleared zone (${node})`)
    const lit = async () => ((await A('wmLit')) as { id: string; lit: boolean }[]).find(k => k.id === w.id)?.lit
    ok((await lit()) === true, 'D. lit')
    await A('travel', { kind: 'home' }); await poll(async () => (await A('zone')) === 'plot', 30000); await sleep(2000)
    let days = 0
    for (; days < 600 && (await lit()) !== false; days++) { await A('skipDays', 1); await sleep(120) }
    ok((await lit()) === false && days > ZONE_RULE.graceDays, `D. the return took its zone back after ${days} days: DARK`)
    await A('travel', { kind: 'waymark', w }); await sleep(3500)
    ok((await A('zone')) === 'plot', 'D. dark: travel refused')
    ok((await A('wmClear', node)) === true, 'D. cleared again'); await sleep(1000)
    ok((await lit()) === true, 'D. RELIT')
    await p.close()
  }
  ok(errs.length === 0, `Z. page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS'); process.exit(fails ? 1 : 0)
