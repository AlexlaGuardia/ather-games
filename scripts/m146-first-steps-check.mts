// BETA M146: FIRST STEPS, played on prod (390 phone; --desktop = 1280x800).  npx tsx scripts/m146-first-steps-check.mts [--url] [--out] [--only ABCD] [--desktop]
// A FRESH keeper: the note read early; Greg talked to over and over = no gems, no glove, no errand line, no Dig, no pulse; the one
//   journal line and its marks at every step (friends not yet heard -> Greg -> the gate + settlement -> the big one -> the settlers
//   -> Greg); Greg's favour word for word; the big one down; the thanks; back at Greg: done: the errand line, The Dig on, the fold.
// B FRESH, the SKIP PATH + an EARLY DEATH: through the gate, fall, pack back = no ping; the settlement's big one first (nobody
//   asked): Chamomile thanks, Greg ends it: Morel's ping then, once (died, unread).
// C a MID-TUTORIAL save (pre-M146 shape, two friends heard) continues.   D an OLD save: byte-identical, errand as before, no First Steps.
// Hooks: __ather (tp, gladeAt, travel, open, fall, combat), __journal / __chain / __glade (READ).
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { GLADE_LINES } from '../src/app/shimmer/open/ather/glade-tutorial-lines'
import { SETTLERS, SETTLEMENT, pickTarget } from '../src/app/shimmer/open/ather/first-settlement'
import { FIRST_STEPS_TITLE } from '../src/app/shimmer/open/ather/first-steps'
import { FOLD_TEXT } from '../src/app/shimmer/open/ather/garden-fold'
import { KAEL_INVITE } from '../src/app/shimmer/open/shared/opening-chain'
import { gladeKeepers } from '../src/app/shimmer/open/ather/glade-cluster'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m146'), only = flag('--only', 'ABCD'), desk = process.argv.includes('--desktop')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)), L = (id: string) => GLADE_LINES[id].text
let fails = 0
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
  const gate = async () => { const g = { x: -212, z: 212 }, sx = g.x + 2.4, sz = g.z - 0.4; await A('gladeAt', sx, sz, Math.atan2(-(g.x - sx), -(g.z - sz))); await poll(() => p.evaluate(() => /the gate \(the Wilds\)/.test(document.body.innerText)), 15000); await p.keyboard.press('KeyE'); ok(await zone('wilds'), 'through the gate: the Wilds'); await poll(() => p.evaluate(() => (window as any).__settlement?.()?.y != null), 60000); await sleep(2500) }
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
  const friend = async (id: string) => {
    for (let k = 0; k < 4; k++) {
      const f = id === 'fennel' ? (await p.evaluate(() => (window as any).__glade?.folk ?? [])as any[]).find(x => x.id.endsWith(':fennel')) : gladeKeepers().find(x => x.id === id)
      if (!f) { await sleep(1500); continue }
      const x = f.x + Math.sin(f.yaw) * 1.8, z = f.z + Math.cos(f.yaw) * 1.8, yaw = Math.atan2(-(f.x - x), -(f.z - z))
      await A('gladeAt', x, z, yaw); await sleep(1500); await A('look', yaw, id === 'fennel' ? -0.55 : -0.15); await sleep(1200)
      await p.keyboard.press('KeyE'); if (await poll(async () => (await opts()).length > 0, 5000)) { const r = await read(); await p.keyboard.press('Escape'); await sleep(300); if ((await tut())?.heard.includes(id)) return true; void r }
    }
    return false
  }
  return { p, A, store, tut, chain, said, line, opts, read, greg, journal, invHas, zone, load, map, step, gate, settler, kill, friend }
}
type K = Awaited<ReturnType<typeof open>>
const quiet = async (k: K, tag: string) => {
  const m = await k.map(), t = JSON.parse(await k.store('open.errand.v1') ?? '{}')
  ok(!m.flip && !m.dig && !m.goal, `${tag}: the map pulses nothing (${JSON.stringify(m)})`)
  ok(!t.given && !(await k.invHas('blankstone')), `${tag}: no gems, no glove beat`)
}
const ended = async (k: K, tag: string) => {
  ok(await poll(async () => (await k.journal())?.ids.includes('errand'), 10000), `${tag}: the first errand's line starts (${(await k.journal())?.ids})`)
  const j = await k.journal(); ok(!j?.fs && !j?.ids.includes('m70') && j?.active === 'errand', `${tag}: First Steps is off the page, the errand leads`)
}
try {
  if (only.includes('A')) {
    const k = await open(undefined, true), { p } = k
    await k.step('A newborn', '', 1, 1)
    ok(await poll(() => k.invHas(KAEL_INVITE), 10000), 'A: the note is in the pack')
    const at = ((JSON.parse(await k.store('open.inv.v1') ?? 'null')?.slots ?? []) as any[]).findIndex(s => s?.id === KAEL_INVITE)
    await p.keyboard.press('KeyI'); await sleep(1200); if (await p.$('[data-pack-go="bag"]')) { await p.click('[data-pack-go="bag"]'); await sleep(700) }
    await p.click(`[data-slot="${at}"]`); await sleep(500); await p.click('[data-act="read-invite"]'); await sleep(900)
    const c = await k.chain(); ok(c?.read && c.step === 'invite', `A: the note reads early, no Dig (${c?.step}, read ${c?.read})`)
    await p.keyboard.press('Escape'); await sleep(800); await quiet(k, 'A after the note')
    await k.greg([]); let t = await k.tut()
    for (let n = 0; n < 6 && !t.greg.wilds; n++) { await k.greg([L('greg.b1.choice.c'), L('greg.b1.choice.a'), L('greg.b1.choice.b')]); t = await k.tut() }
    ok(t.greg.wilds && t.gifts.includes('grimoire'), `A: Greg's Beat 1 heard (${JSON.stringify(t.greg)})`)
    const again: string[] = []; for (let n = 0; n < 3; n++) again.push(...(await k.greg()).ls)
    ok(again.length === 3 && again.every(x => x === L('greg.b1.bark.pending')), `A: Greg thrice more: the pending bark only (${again.join(' | ')})`)
    await quiet(k, 'A after Greg x5'); await k.step('A friends', L('quest.b1.step').replace('{N}', '0'), 4, 1)
    await p.screenshot({ path: `${out}/a-friends.png` })
    let n = 0; for (const f of ['otto', 'tess', 'bonn', 'fennel']) { ok(await k.friend(f), `A: ${f} heard`); n++; if (n < 4) await k.step(`A ${n}/4`, L('quest.b1.step').replace('{N}', String(n)), 4 - n, 1) }
    await k.step('A back', L('quest.b1.done'), 1, 1)
    const no = await k.greg([L('greg.b2.choice.wait')])
    ok(no.ls.join('|') === [1, 2, 3, 4, 5, 6].map(i => L(`greg.b2.ask.${i}`)).join('|') + '|' + L('greg.b2.wait'), `A: the favour, word for word, "Not yet" (${no.ls.length} lines)`)
    await k.step('A not yet', L('quest.b1.done'), 1, 1)
    const go = await k.greg([L('greg.b2.choice.go')]); ok(go.ls.at(-1) === L('greg.b2.go'), `A: "I'll go" (${go.ls.at(-1)})`)
    ok((await k.greg()).ls.join() === L('greg.b2.bark.open'), 'A: again: the open bark')
    await k.step('A gate', L('quest.b2.step'), 1, 1); await quiet(k, 'A at the gate')
    await k.gate(); await k.settler('chamomile')
    await k.step('A big one', L('quest.m70.step'), 1, 1)
    await p.screenshot({ path: `${out}/a-wilds.png` })
    const t1 = await k.tut(), node = ((await k.A('nodes')) as any[]).find(x => x.id === t1.m70node); ok(!!node, 'A: the big one is on the map')
    if (node) await k.kill(node)
    await poll(async () => (await k.tut()).m70 === 'down', 15000); await k.step('A settlers', L('quest.m70.done'), 1, 1)
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), SETTLEMENT.x + 3, SETTLEMENT.z + 3); await sleep(3000)
    await k.settler('chamomile'); await k.step('A home', L('quest.m70.after'), 1, 1)
    ok((await k.chain()).step === 'invite', 'A: still no Dig')
    await k.A('travel', { kind: 'glade' }); ok(await k.zone('glade'), 'A: back in the Glade'); await sleep(2500)
    await quiet(k, 'A before Greg')
    const end = await k.greg([L('greg.b2.choice.wait')]); ok(end.ls[0] === FOLD_TEXT.offer, `A: Greg offers the fold (${end.ls[0]})`)
    ok((await k.tut()).fs === 'done', 'A: First Steps done'); await ended(k, 'A')
    ok(await poll(async () => (await k.chain()).step === 'dig', 6000), 'A: the early note: The Dig starts now')
    const m = await k.map(); ok(m.flip && m.dig, `A: the flip + Rune Hold pulse (${JSON.stringify(m)})`)
    await k.load(); ok((await k.tut()).fs === 'done' && !(await k.journal())?.fs, 'A: reload: still done')
    await p.screenshot({ path: `${out}/a-end.png` })
  }
  if (only.includes('B')) {
    const k = await open(undefined, true), { p } = k
    await k.gate()
    const a0 = await p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px, z: s.pz } })
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z), a0.x + 12, a0.z - 9); await sleep(2000)
    await k.A('fall'); ok(await k.zone('glade', 40000), 'B: an early death: the Glade'); await sleep(2000)
    const pk = await k.A('pack') as any; ok((await k.chain()).died && !!pk, 'B: died, the pack lies')
    await k.gate(); if (pk) { await p.evaluate((x, z) => (window as any).__ather.tp(x, z), pk.x, pk.z); ok(await poll(async () => (await k.A('pack')) === null, 20000), 'B: the pack is back') }
    await sleep(5000); ok((await k.said()).length === 0 && !(await k.chain()).pinged, 'B: Morel holds the ping'); await quiet(k, 'B')
    const near = pickTarget((await k.A('nodes')) as any[])!; await k.kill(near)
    ok(await poll(async () => (await k.tut()).m70 === 'down', 15000), 'B: skip: the settlement\'s big one first, nobody asked: down')
    await k.step('B settlers', L('quest.m70.done'), 1, 1)
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), SETTLEMENT.x + 3, SETTLEMENT.z + 3); await sleep(3000)
    ok((await k.settler('chamomile')).ls[0] === L('settler.thanks.1'), 'B: Chamomile thanks'); await k.step('B home', L('quest.m70.after'), 1, 1)
    await k.A('travel', { kind: 'glade' }); ok(await k.zone('glade'), 'B: the Glade'); await sleep(2500); await k.greg()
    ok((await k.tut()).fs === 'done', 'B: the skip path finishes First Steps at Greg'); await ended(k, 'B')
    ok(await poll(async () => (await k.said()).includes('ping'), 8000) && (await k.chain()).step === 'dig', 'B: died + unread: Morel\'s ping now, The Dig on')
    await sleep(3000); ok((await k.said()).filter(s => s === 'ping').length === 1, 'B: once')
  }
  const all = { welcome: true, moglins: true, spirits: true, wilds: true }
  if (only.includes('C')) {
    const mid = { v: 1, live: true, greg: all, heard: ['otto', 'tess'], gifts: ['grimoire', 'spike', 'seeds'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: false }
    const k = await open({ 'open.tutorial.v1': mid }); await k.load()
    if ((await k.A('zone')) !== 'glade') { await k.A('travel', { kind: 'glade' }); await k.zone('glade') }
    await k.step('C mid-tutorial', L('quest.b1.step').replace('{N}', '2'), 2, 1); await k.greg(); await k.greg(); await quiet(k, 'C')
    ok(JSON.stringify(await k.tut()) === JSON.stringify(mid), 'C: the save is untouched by the talks')
  }
  if (only.includes('D')) {
    const old = { v: 1, live: false, greg: all, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'thanked', m70node: null, m70side: 'none', folded: true }
    const k = await open({ 'open.tutorial.v1': old }); await k.load()
    ok((await k.A('zone')) === 'plot', 'D: an old keeper loads on the plot')
    const j = await k.journal(); ok(!j?.fs && j?.ids.includes('errand') && j?.ids.includes('m70'), `D: the journal as before (${j?.ids})`)
    ok((await k.store('open.tutorial.v1')) === JSON.stringify(old), 'D: the save is byte-identical')
    await k.A('travel', { kind: 'glade' }); await k.zone('glade'); await sleep(2000); await k.A('open', 'greg'); await sleep(2000)
    ok((await k.opts()).length > 1, `D: Greg's ordinary talk, the send-off first (${(await k.opts()).join(' / ')})`); await k.p.keyboard.press('Escape')
    ok((await k.store('open.tutorial.v1')) === JSON.stringify(old), 'D: still byte-identical after Greg')
  }
  ok(errs.length === 0, `page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `m146-first-steps-check: ${fails} FAIL` : 'm146-first-steps-check: PASS'); process.exit(fails ? 1 : 0)
