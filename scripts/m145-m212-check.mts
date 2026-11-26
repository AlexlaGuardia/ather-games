// BETA M145 + M212: the tutorial's guidance, played on prod (desktop 1280x800 AND 390x844 phone, both in one run).
// A FRESH keeper: the 3D '!' (window.__questBang) stands over Greg at step 1; Greg's Beat 1 hands the grimoire -> the first-time
//   arrow (window.__arrow, [data-hud="first-arrow"]) points at the hotbar slot it landed in, hidden while a talk box is up; the '!'
//   has moved to the tour's first stop; picking the slot retires the arrow; a reload never brings it back; the next stop wears the '!'.
// D a VETERAN (old save, First Steps long done): neither the '!' nor an arrow, nothing armed.  0 page errors.
// Harness = m146-first-steps-check.mts (same hooks: __ather, __journal, __glade; READ only).  npx tsx scripts/m145-m212-check.mts [--url] [--out] [--sizes desk,phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { pickWilds } from './lib/glade-gate.mts'   // M172: E at the Glade's gate opens the fold map; the Wilds is a stop on it
import { mkdirSync } from 'node:fs'
import { GLADE_LINES } from '../src/app/shimmer/open/ather/glade-tutorial-lines'
import { SETTLERS, SETTLEMENT, pickTarget } from '../src/app/shimmer/open/ather/first-settlement'
import { FIRST_STEPS_TITLE } from '../src/app/shimmer/open/ather/first-steps'
import { FOLD_TEXT } from '../src/app/shimmer/open/ather/garden-fold'
import { KAEL_INVITE } from '../src/app/shimmer/open/shared/opening-chain'
import { gladeKeepers, gladeNewbornSpot, gregInGlade } from '../src/app/shimmer/open/ather/glade-cluster'
import { setGladePeople } from '../src/app/shimmer/open/ather/glade-people'   // M153 s1c-1: people stand where the site's layer puts them
import { parseTut, TOUR, GUIDES, type Stop } from '../src/app/shimmer/open/ather/glade-tutorial'
import { friendStart, nodeBeside, type Talker } from '../src/app/shimmer/open/ather/glade-friend-talk'
import { fennelStart, fennelScript } from '../src/app/shimmer/open/ather/glade-fennel-talk'
import { hasStick } from '../src/app/shimmer/open/ather/rinquest'
import { gladeNodes } from '../src/app/shimmer/open/ather/glade-nodes'
import { parseGladeLayer } from '../src/app/shimmer/open/ather/glade-layer'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m145-m212'), sizes = flag('--sizes', 'desk,phone').split(',')
let desk = true
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)), L = (id: string) => GLADE_LINES[id].text
let fails = 0, nodes = gladeNodes([], () => 0)
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<unknown>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }

async function open(seed?: Record<string, unknown>, born = false) {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport(desk ? { width: 1280, height: 800 } : { width: 390, height: 844, deviceScaleFactor: 2 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (seed) await p.evaluateOnNewDocument((s: string) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star'); for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, v as string) }, JSON.stringify(Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]))))
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
  const store = (suffix: string) => p.evaluate((s: string) => { const k = Object.keys(localStorage).find(x => x.endsWith(s)); return k ? localStorage.getItem(k) : null }, suffix) as Promise<string | null>
  const tut = async () => JSON.parse(await store('open.tutorial.v1') ?? 'null') as any
  const chain = () => p.evaluate(() => (window as any).__chain?.state?.() ?? null) as Promise<any>
  const said = () => p.evaluate(() => (window as any).__chain?.said?.() ?? []) as Promise<string[]>
  const line = () => p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return ''; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return (b.firstElementChild?.textContent ?? '').slice(sc.length) }) as Promise<string>
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim())) as Promise<string[]>
  const pick = async (l?: string) => { await p.evaluate((l: string | null) => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => !l || (e.textContent ?? '').includes(l)); b?.click() }, l ?? null); await sleep(700) }
  /** read the talk: the answer named in `want` if it is there, else the first; returns the lines */
  const read = async (want: string[] = [], max = 16) => { const ls: string[] = [], all: string[] = []; for (let k = 0; k < max && (await opts()).length; k++) { await poll(async () => !!(await line()), 4000); ls.push(await line()); const o = await opts(); all.push(...o); await pick(want.find(w => o.includes(w))) } return { ls, all } }
  const greg = async (want: string[] = []) => { await A('open', 'greg'); await poll(async () => (await opts()).length > 0, 10000); const r = await read(want); await p.keyboard.press('Escape'); await sleep(400); return r }
  const journal = () => p.evaluate(() => { const j = (window as any).__journal?.(); return j ? { ids: j.entries.filter((e: any) => !e.struck).map((e: any) => e.id), fs: j.entries.find((e: any) => e.id === 'first-steps') ?? null, active: j.prefs.active } : null }) as Promise<any>
  const invHas = async (id: string) => ((JSON.parse(await store('open.inv.v1') ?? 'null')?.slots ?? []) as any[]).some(s => s?.id === id)
  const zone = (z: string, ms = 120000) => poll(async () => (await A('zone')) === z, ms)
  const load = async (q = '') => { await p.goto(`${url}/shimmer/open/ather?hour=13${q}`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__chain, { timeout: 240000 }); await sleep(2500) }
  if (born) {
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
    await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 90000)
    for (let k = 0; k < 3 && !(await p.$('[data-creator-done]')); k++) { await p.evaluate(() => { let b: HTMLElement | null = null; for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"]')) if (/^BE BORN/i.test((e.innerText ?? '').trim())) b = e; b?.click() }); await poll(() => p.evaluate(() => !!document.querySelector('[data-creator-done]')), 30000) }
    await (await p.$('[data-creator-done]'))?.click()
    ok(await zone('glade', 60000), 'born in the Glade'); await sleep(2500)
    const s = await p.evaluate(() => { const q = (window as any).__ather.state(); return { x: q.px, z: q.pz, yaw: q.yaw as number } }), nb = gladeNewbornSpot(), off = Math.hypot(s.x - nb.x, s.z - nb.z)
    ok(off < 1, `born on the newborn spot (${off.toFixed(2)} m off; ${nb.x.toFixed(1)}, ${nb.z.toFixed(1)})`)
  }
  /** the gate: no flip pulse, no Rune Hold pulse, no errand goal */
  const map = async () => { await A('open', 'gate'); await sleep(1500); const ath = await p.evaluate(() => ({ flip: !!document.querySelector('[data-flip-pulse]'), stop: !!document.querySelector('[data-quest-stop]'), pin: !!document.querySelector('[data-quest-pin]') })); await p.evaluate(() => { [...document.querySelectorAll('[data-panel="fold-map"] button')].find(b => b.textContent === 'Flip map')?.dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await sleep(900); const nyx = await p.evaluate(() => ({ dig: !!document.querySelector('[data-dig-door]'), goal: !!document.querySelector('[data-goal]') })); await p.keyboard.press('Escape'); await sleep(600); return { ...ath, ...nyx } }
  const step = async (tag: string, note: string, glade: number, wilds: number) => {
    await poll(async () => (await journal())?.fs?.note === note, 8000)
    const j = await journal(), s = j?.fs ? [j.fs.where, ...(j.fs.also ?? [])] : []
    ok(j?.fs?.title === FIRST_STEPS_TITLE && j.fs.note === note, `${tag}: "${j?.fs?.title}" · "${j?.fs?.note}"`)
    ok(j?.active === 'first-steps' && s.filter((w: any) => w?.zone === 'glade').length === glade && s.filter((w: any) => w?.zone === 'wilds').length === wilds, `${tag}: marks Glade ${glade} / Wilds ${wilds} (${JSON.stringify(s)})`)
    ok(!j?.ids.includes('errand') && !j?.ids.includes('m70'), `${tag}: no errand line, no second quest (${j?.ids})`)
  }
  const gate = async () => { const g = { x: -212, z: 212 }, sx = g.x + 2.4, sz = g.z - 0.4; await A('gladeAt', sx, sz, Math.atan2(-(g.x - sx), -(g.z - sz))); await poll(() => p.evaluate(() => /the gate \(fold map\)/.test(document.body.innerText)), 15000); await p.keyboard.press('KeyE'); await pickWilds(p); ok(await zone('wilds'), 'through the gate: the Wilds'); await poll(() => p.evaluate(() => (window as any).__settlement?.()?.y != null), 60000); await sleep(2500) }
  const settler = async (id: string) => { const s = SETTLERS.find(x => x.id === id)!, px = s.x + Math.sin(s.yaw) * 2.2, pz = s.z + Math.cos(s.yaw) * 2.2
    for (let k = 0; k < 4; k++) { await p.evaluate((x, z, y) => { const g = (window as any).__ather; g.tp(x, z, y); g.look?.(y, -Math.atan2(0.8, 2.2)) }, px, pz, Math.atan2(px - s.x, pz - s.z)); await sleep(1800); await p.keyboard.press('KeyE'); if (await poll(async () => (await opts()).length > 0, 6000)) return read() }
    return { ls: [] as string[], all: [] as string[] } }
  const kill = async (n: { x: number; z: number }) => {
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 18, 0), n.x, n.z)
    ok(await poll(() => p.evaluate(() => !!(window as any).__ather.combat().champ), 60000), 'its champion wakes')
    await poll(() => p.evaluate(() => (window as any).__ather.combat().champ?.state !== 'rise'), 90000)
    const breakIt = async () => {
      await p.evaluate(() => { const c = (window as any).__ather.combat(); c.keeper.hp = c.keeper.maxHp; const ch = c.champ; ch.hp = 1; ch.state = 'recover'; ch.t = 30 })
      await p.waitForFunction(() => {
        const c = (window as any).__ather.combat(), ch = c.champ
        if (!ch || ch.state === 'submerge') return true
        c.keeper.hp = c.keeper.maxHp; c.keeper.sinceShot = 99; c.keeper.ammo = 12; c.keeper.reloading = 0; c.keeper.bloom = 0
        c.rounds.push({ x: ch.x, y: ch.y + 1.7, z: ch.z + 6, vx: 0, vy: 0, vz: -40, life: 1, dmg: 10, crit: 16 })
        return false
      }, { timeout: 60000, polling: 400 })
    }
    await breakIt()
    await p.waitForFunction(() => { const ch = (window as any).__ather.combat().champ; return ch && ch.state !== 'submerge' }, { timeout: 90000 })
    await breakIt()
    await p.waitForFunction(() => { const ch = (window as any).__ather.combat().champ; return ch && ch.state !== 'submerge' && ch.bar === 2 }, { timeout: 90000 })
    await breakIt()
    ok(await poll(() => p.evaluate(() => !(window as any).__ather.combat().champ), 60000), 'the big one is down')
  }
  const at = async (id: string) => gladeKeepers().find(x => x.id === id) ?? ((await p.evaluate(() => (window as any).__glade?.folk ?? [])) as any[]).find(x => x.id.endsWith(`:${id}`))
  const friend = async (id: string) => {
    for (let k = 0; k < 4; k++) {
      const f = await at(id), t0 = parseTut(await tut())!, q0 = await p.evaluate(() => (window as any).__rinquest?.quest?.() ?? null) as any
      if (!f) { await sleep(1500); continue }
      const x = f.x + Math.sin(f.yaw) * 1.8, z = f.z + Math.cos(f.yaw) * 1.8, yaw = Math.atan2(-(f.x - x), -(f.z - z))
      await A('gladeAt', x, z, yaw); await sleep(1500); await A('look', yaw, gladeKeepers().some(x => x.id === id) ? -0.15 : -0.55); await sleep(1200)
      await p.keyboard.press('KeyE'); if (await poll(async () => (await opts()).length > 0, 5000)) { const r = await read(); await p.keyboard.press('Escape'); await sleep(300); const t = await tut(), want = id === 'fennel' ? fennelScript(fennelStart(t0, !!q0 && hasStick(q0), 0)) : friendStart(t0, id as Talker, nodeBeside(id as Talker, f, nodes)).script
        if (t?.heard.includes(id) || t?.met?.includes(id)) { ok(r.ls.join('|') === want.map(L).join('|'), `${id}: the signed lines in order (${r.ls.length}/${want.length})${r.ls.join('|') === want.map(L).join('|') ? '' : ' ' + r.ls.join(' | ')}`); return true } }
    }
    return false
  }
  return { p, A, store, tut, chain, said, line, opts, read, greg, journal, invHas, zone, load, map, step, gate, settler, kill, friend, at }
}
type K = Awaited<ReturnType<typeof open>>
const bang = (k: K) => k.p.evaluate(() => (window as any).__questBang ?? null) as Promise<any>
const arrow = (k: K) => k.p.evaluate(() => { const a = (window as any).__arrow ?? null, el = document.querySelector('[data-hud="first-arrow"]'), r = el?.getBoundingClientRect(); return { a, el: r ? { x: r.left + r.width / 2, top: r.top, bottom: r.bottom } : null } }) as Promise<any>
const arrowsSave = async (k: K) => JSON.parse(await k.store('open.arrows.v1') ?? 'null')
const d2 = (a: any, b: any) => (a && b ? Math.hypot(a.x - b.x, a.z - b.z) : 1e9)
const face = async (k: K, t: { x: number; z: number }) => { const s = await k.p.evaluate(() => { const q = (window as any).__ather.state(); return { x: q.px, z: q.pz } }); await k.A('look', Math.atan2(-(t.x - s.x), -(t.z - s.z)), 0.12); await sleep(1200) }
try {
  { const layer = parseGladeLayer(await (await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' })).json()); setGladePeople(layer.props); nodes = gladeNodes(layer.props ?? [], () => 0) }
  for (const sz of sizes) {
    desk = sz === 'desk'; const T = desk ? 'desk' : '390'
    // ── A: a fresh keeper ──
    const k = await open(undefined, true), { p } = k
    await k.step(`${T} A step 1`, L('quest.b1.step.greg'), 1, 1)
    const g = gregInGlade(), j1 = await k.journal()
    ok(await poll(async () => (await bang(k))?.on === true, 10000), `${T}: the '!' is up at step 1`)
    let b = await bang(k)
    ok(b?.zone === 'glade' && d2(b, j1.fs.where) < 0.5 && d2(b, g) < 3, `${T}: the '!' stands over Greg (${b?.x?.toFixed(1)},${b?.z?.toFixed(1)}; Greg ${g.x.toFixed(1)},${g.z.toFixed(1)}; y ${b?.y?.toFixed(1)})`)
    ok(!(await arrow(k)).el && (await arrowsSave(k)) === null, `${T}: no arrow before anything is given`)
    await face(k, g); await p.screenshot({ path: `${out}/${T}-a-bang-greg.png` })
    let t = await k.tut()
    for (let n = 0; n < 6 && !t.greg.wilds; n++) { await k.greg([L('greg.b1.choice.c'), L('greg.b1.choice.a'), L('greg.b1.choice.b')]); t = await k.tut() }
    ok(t.greg.wilds && t.gifts.includes('grimoire'), `${T}: Greg's Beat 1 heard, the grimoire handed`)
    // the talk helper ends on an Escape; a talk that had already closed itself turns that Escape into the Options menu (which, rightly, hides the arrow too)
    const optsUp = await p.evaluate(() => !!document.querySelector('[data-panel="options"]'))
    if (optsUp) { await p.keyboard.press('Escape'); await sleep(800) }
    ok(await poll(async () => (await arrow(k)).a?.shown === true, 10000), `${T}: the arrow is up after the talk box closes${optsUp ? ' (the Options menu had it hidden: closed first)' : ''} ${JSON.stringify((await arrow(k)).a)}`)
    const ar = await arrow(k), slot = ar.a?.slot as number
    const inv = (JSON.parse(await k.store('open.inv.v1') ?? 'null')?.slots ?? []) as any[]
    ok(ar.a?.id === 'grimoire' && inv[slot]?.id === 'grimoire_pedestal', `${T}: it points at the slot the grimoire landed in (slot ${slot + 1}: ${inv[slot]?.id})`)
    const sr = await p.evaluate((i: number) => { const r = document.querySelector(`[data-hud="hotbar"] [aria-label="slot ${i + 1}"]`)?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, top: r.top, bottom: r.bottom } : null }, slot)
    const low = !!sr && sr.top > (desk ? 800 : 844) / 2   // a bar on the bottom edge (touch layout) is pointed at from above
    ok(!!sr && !!ar.el && Math.abs(sr.x - ar.el.x) < 4 && (low ? ar.el.bottom <= sr.top && sr.top - ar.el.bottom < 30 : ar.el.top >= sr.bottom && ar.el.top - sr.bottom < 30), `${T}: drawn on that slot, ${low ? 'over the bottom bar pointing down' : 'under the top bar pointing up'} (${JSON.stringify(sr)} vs ${JSON.stringify(ar.el)})`)
    ok(ar.el && ar.el.top >= 0 && ar.el.bottom <= (desk ? 800 : 844), `${T}: the arrow is on screen`)
    ok(JSON.stringify((await arrowsSave(k))?.armed) === '["grimoire"]', `${T}: armed, saved with the keeper`)
    await p.screenshot({ path: `${out}/${T}-b-arrow.png` })
    // a talk box hides it
    await k.A('open', 'greg'); await poll(async () => (await k.opts()).length > 0, 10000)
    ok(!(await arrow(k)).el, `${T}: never over a talk box`)
    await p.keyboard.press('Escape'); await sleep(800)
    ok(await poll(async () => !!(await arrow(k)).el, 6000), `${T}: back once the talk box closes`)
    // the '!' has moved to the tour's first stop
    const j2 = await k.journal(); b = await bang(k)
    ok(b?.on && d2(b, j2.fs.where) < 0.5 && d2(b, g) > 1, `${T}: step done -> the '!' moved to the tour's first stop (${TOUR[0]}: ${b?.x?.toFixed(1)},${b?.z?.toFixed(1)})`)
    const f0 = await k.at(TOUR[0]); if (f0) { await face(k, f0); await p.screenshot({ path: `${out}/${T}-c-bang-${TOUR[0]}.png` }) }
    // reload before use: still armed, still shown
    await k.load(); if ((await k.A('zone')) !== 'glade') { await k.A('travel', { kind: 'glade' }); await k.zone('glade') }
    ok(await poll(async () => (await arrow(k)).a?.shown === true, 15000), `${T}: unused, a reload keeps it`)
    // use it: pick the slot
    if (desk) await p.keyboard.press(`Digit${slot + 1}`)
    else await p.click(`[data-hud="hotbar"] [aria-label="slot ${slot + 1}"]`)   // the phone path: the slot itself, by pointer
    ok(await poll(async () => !(await arrow(k)).el, 6000), `${T}: picked -> the arrow is gone`)
    ok((await arrowsSave(k))?.done?.includes('grimoire') && !(await arrowsSave(k))?.armed?.includes('grimoire'), `${T}: retired in the save`)
    await p.screenshot({ path: `${out}/${T}-d-used.png` })
    await p.keyboard.press('Escape'); await sleep(500)
    await k.load(); if ((await k.A('zone')) !== 'glade') { await k.A('travel', { kind: 'glade' }); await k.zone('glade') }
    await sleep(3000); ok(!(await arrow(k)).el && (await arrow(k)).a?.shown !== true, `${T}: a reload never brings it back`)
    // the next stop: the '!' moves again
    ok(await k.friend(TOUR[0]), `${T}: ${TOUR[0]} heard`)
    await k.step(`${T} A ${TOUR[1]}`, L(`quest.b1.step.${TOUR[1]}`), 1, 1)
    const j3 = await k.journal(); ok(await poll(async () => d2(await bang(k), j3.fs.where) < 0.5, 6000), `${T}: the '!' moved on to ${TOUR[1]}`)
    await p.browserContext().close()
    // ── D: a veteran ──
    const all = { welcome: true, moglins: true, spirits: true, wilds: true }
    const old = { v: 1, live: false, greg: all, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'thanked', m70node: null, m70side: 'none', folded: true }
    const v = await open({ 'open.tutorial.v1': old }); await v.load()
    await sleep(2000); ok((await bang(v))?.on !== true && !(await arrow(v)).el, `${T} veteran on the plot: no '!', no arrow`)
    await v.A('travel', { kind: 'glade' }); await v.zone('glade'); await sleep(3000)
    ok((await bang(v))?.on === false, `${T} veteran in the Glade: no '!' (${JSON.stringify(await bang(v))})`)
    ok(!(await arrow(v)).el && (await arrowsSave(v)) === null, `${T} veteran: no arrow, nothing armed`)
    await v.p.screenshot({ path: `${out}/${T}-e-veteran.png` })
    await v.p.browserContext().close()
  }
  ok(errs.length === 0, `page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `m145-m212-check: ${fails} FAIL` : 'm145-m212-check: PASS'); process.exit(fails ? 1 : 0)
