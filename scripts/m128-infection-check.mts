// BETA M128 s1: WEEKLY SETTLEMENT INFECTIONS, the engine, on prod at 390x844.
// SETUP (stated): fresh browser profiles, no account; every non-GET fetch + beacon stubbed, so no real save is read or written.
// The hook (owner + ?infect=1): __infect.pass(ms) = days pass in the open world, .play(ms) = time played. An infection STARTS
// through the game's own tick (one known settlement), never by a forced write.
//  OWNER 1 nothing discovered = no save written. 2 discovered, a waymark planted, trade open. 3 a week on: infected by the tick, the
//    ping event with no text; ground grey round the homes, waymark dark, travel refused, trade stopped, homes + folk the same.
//    4 reload: still held. 5 its champion beaten: saved, ground back, waymark lit, trade back, clue 1. 6 a second one: 30 weeks away
//    = no loss clock; part of the week played, reload, the rest played: LOST: place, folk, waymark gone, ground grey, no champion;
//    reload stays. 7 0 page errors.
//  PLAYER 8 a held save seeded: not the owner = no hook, same ground / waymark / trade / place, the save byte-identical.
//   npx tsx scripts/m128-infection-check.mts [--url https://ather.games] [--out dir]      (OWNER_KEY from env or .env)
import puppeteer, { type Page } from 'puppeteer-core'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { folkOf } from '../src/app/shimmer/open/ather/settlement-folk'
import { burrfolkOf, stallSpot, BURR_LABEL } from '../src/app/shimmer/open/ather/burrfolk'
import { INFECT_WEEK_MS as W } from '../src/app/shimmer/open/ather/infection'
import { infectId } from '../src/app/shimmer/open/ather/infect-id'
import { DARK_WHY } from '../src/app/shimmer/open/ather/waymarks'
import { STARTING_SQUARES } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
import type { Network, Settlement } from '../src/app/shimmer/open/ather/network'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m128-infection'); mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /^OWNER_KEY=(.+)$/m.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const A = net.settlements.find(s => s.id === 's1-9')!, B = net.settlements.find(s => s.id === 's1-5')!
const SAVE = 'ather.infection.v1', sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
async function open(owner: boolean, seed: { save?: unknown; waymark?: unknown }) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  p.on('pageerror', e => errs.push(`${owner ? 'owner' : 'player'}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)) === owner, owner ? '0. the OWNER' : '0. NOT the owner')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    ;(window as any).__pings = []; window.addEventListener('ather-infection', e => (window as any).__pings.push((e as CustomEvent).detail))
    if (sessionStorage.getItem('m128')) return; sessionStorage.setItem('m128', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('ather.garden.v1', JSON.stringify({ owned: s.owned, grey: 50, pages: 10, layout: s.layout }))
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest', 'm70pack'], b2: 'accepted', baitDay: null, fold: 'done', m70: 'thanked' }))
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: [{ id: 'waymark', n: 4 }, ...Array(31).fill(null)], gifts: ['bait1'] }))
    if (s.save) localStorage.setItem('ather.infection.v1', JSON.stringify(s.save))
    if (s.waymark) localStorage.setItem('ather.waymarks.v1', JSON.stringify([s.waymark]))
  }, { owned: [...STARTING_SQUARES], layout: LAYOUT, ...seed })
  const G = (f: string, ...a: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), f, a) as Promise<any>
  const I = (f: string, ...a: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__infect?.[f]?.(...a), f, a) as Promise<any>
  const raw = () => p.evaluate((k: string) => localStorage.getItem(k), SAVE)
  const load = async () => { await p.waitForFunction(() => !!(window as any).__ather?.wm, { timeout: 240000 }); await sleep(5000) }
  const boot = async () => { await p.goto(`${url}/shimmer/open/ather?hour=13&infect=1`, { waitUntil: 'load', timeout: 240000 }); await load() }
  const reload = async () => { await p.reload({ waitUntil: 'load', timeout: 240000 }); await load() }
  const goto = async (x: number, z: number, near = 120) => poll(async () => { const s = await G('state'); if ((await G('zone')) === 'wilds' && s && Math.hypot((s.x ?? s.px) - x, (s.z ?? s.pz) - z) < near) return true; await G('wmGoto', x, z); await sleep(5000); return false }, 120000)
  const ride = async (w: unknown) => { for (let k = 0; k < 12; k++) { await G('travel', { kind: 'waymark', w }); if (await poll(async () => (await G('zone')) === 'wilds', 6000)) return true }; return false }   // re-sent while the Wilds index loads (m75 checks' way)
  const tp = async (x: number, z: number) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z), x, z); await sleep(1500) }
  const home = async () => { await sleep(1500); await G('travel', { kind: 'home' }); return poll(async () => (await G('zone')) === 'plot', 40000) }
  const place = (s: Settlement) => p.evaluate((id: string) => ({ folk: ((window as any).__folk?.drawn?.()[id] ?? []).map((f: any) => f.id).join(), stall: (window as any).__folk?.stalls?.()[id]?.id ?? null, homes: JSON.stringify(((window as any).__settlements?.built?.() ?? []).find((b: any) => b.id === id) ?? null), map: (window as any).__folk?.mapSettlements?.() ?? null }), s.id)
  const opts = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim())) as Promise<string[]>
  const stallTalk = async (s: Settlement) => {   // m112-burrfolk-check's walk-up: 2.2 m before the plank, E
    await poll(async () => !!(await place(s)).stall, 30000); await p.mouse.click(200, 420); await sleep(800)
    const sp = stallSpot(s), fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw); let o: string[] = []
    for (let k = 0; k < 8 && !o.length; k++) {
      await p.evaluate((x, z, y) => { const g = (window as any).__ather; const c = g.combat?.(); if (c) { c.hollows.length = 0; c.keeper.hp = c.keeper.maxHp } g.tp(x, z, y); g.look(y, -Math.atan2(1.1, 2.2)) }, sp.x + fx * 2.2, sp.z + fz * 2.2, Math.atan2(fx, fz)); await sleep(1500)
      await p.keyboard.press('KeyE'); await p.mouse.move(5, 5); await poll(async () => (await opts()).length > 0, 6000); o = await opts()
    }
    await p.keyboard.press('Escape'); await sleep(1200); return o
  }
  const lit = async (id: string) => ((await G('wmLit')) as { id: string; lit: boolean }[]).find(w => w.id === id)?.lit
  const alive = () => p.evaluate(() => { if ((window as any).__m128hp) return; (window as any).__m128hp = setInterval(() => { const c = (window as any).__ather?.combat?.(); if (c) c.keeper.hp = c.keeper.maxHp }, 200) })
  const ground = async () => (await G('wmGround')) as { ground: string; settlement: string | null }
  return { ride, p, G, I, raw, boot, reload, goto, tp, home, place, stallTalk, lit, alive, ground }
}
try {
  const o = await open(true, {}), { p, G, I } = o
  await o.boot()
  ok(Array.isArray(await I('known')), '0. the engine is on'); if (!Array.isArray(await I('known'))) throw new Error('no engine on this build')
  await sleep(11000)
  ok((await I('known')).length === 0 && (await o.raw()) === null, '1. nothing discovered: no clock, no save written')
  // ── 2 · discovered ──
  ok(await o.goto(A.x, A.z), `2. at ${A.name}`); await o.alive(); await o.tp(A.x + 2, A.z + 16)
  ok(await poll(async () => (await I('known')).join() === A.id, 20000), `2. discovered: ${await I('known')}`)
  ok(await poll(async () => { const s = JSON.parse((await o.raw()) ?? 'null'); return !!s && s.next > Date.now() && !s.active }, 25000), `2. the week's clock starts (${await o.raw()})`)
  await poll(async () => !!(await o.place(A)).folk, 30000); await sleep(3000)
  let planted: any = null; for (const [dx, dz] of [[2, 16], [14, 8], [-12, 12], [10, -22], [-20, 4]]) { await o.tp(A.x + dx, A.z + dz); planted = await G('wmPlant'); if (planted?.ok) break }
  const w = ((await G('wm')) as any[])[0]; ok(!!w && w.settlement === A.id && (await o.lit(w?.id)) === true, `2. a waymark in ${A.name}, lit (${JSON.stringify(planted)})`)
  const before = await o.place(A), b = burrfolkOf(A, net.season, folkOf(A, net.season))!
  const t0 = await o.stallTalk(A); ok(t0.includes(BURR_LABEL.look), `2. trade open at ${b.name}'s stall (${JSON.stringify(t0)})`)
  await o.tp(A.x + 2, A.z + 16); await p.screenshot({ path: `${out}/1-before.png` })
  // ── 3 · a week on ──
  ok(await o.home(), '3. home'); await I('pass', W + 1000)
  ok(await poll(async () => (await I('state'))?.active?.id === A.id, 30000), `3. a week on: ${A.name} is infected by the tick (${JSON.stringify((await I('state'))?.active)})`)
  const ev = (await p.evaluate(() => (window as any).__pings)) as any[]
  ok(ev.length === 1 && ev[0].kind === 'start' && ev[0].id === A.id && ev[0].name === A.name && !('text' in ev[0]) && !('line' in ev[0]), `3. the ping event, no text (${JSON.stringify(ev)})`)
  await sleep(1500); ok((await o.lit(w.id)) === false, '3. its waymark is dark')
  await G('travel', { kind: 'waymark', w }); const said = await poll(async () => (await p.evaluate(() => document.body.innerText)).includes(DARK_WHY), 4000); await sleep(3000)
  ok(said && (await G('zone')) === 'plot', '3. travel refused')
  ok(await o.goto(A.x + 100, A.z), '3. back by foot'); await o.alive(); await o.tp(A.x + 45, A.z); await sleep(1500)
  ok((await o.ground()).ground === 'infected', `3. the ground round the homes is grey (${JSON.stringify(await o.ground())})`)
  ok(await poll(() => p.evaluate((x, z) => (window as any).__ather.combat()?.drained?.(x, z) === true, A.x + 8, A.z + 40), 15000), '3. the fight reads it as Hollow ground')
  await poll(async () => !!(await o.place(A)).folk, 30000); await sleep(3000)
  const during = await o.place(A); ok(during.folk === before.folk && during.homes === before.homes && during.stall === before.stall && during.map === before.map && before.folk.length > 0, `3. homes and folk the same (${during.folk})`)
  const t1 = await o.stallTalk(A); ok(t1.length > 0 && !t1.includes(BURR_LABEL.look), `3. trade stopped, the stall still talks (${JSON.stringify(t1)})`)
  await o.tp(A.x + 2, A.z + 16); await p.screenshot({ path: `${out}/2-held.png` }); await G('open', 'gate'); await sleep(2500); await p.screenshot({ path: `${out}/3-map-held.png` }); await p.keyboard.press('Escape')
  // ── 4 · reload ──
  await o.reload(); ok(await poll(async () => (await I('state'))?.active?.id === A.id, 30000) && (await poll(async () => (await o.lit(w.id)) === false, 20000)), '4. reload: still held, still dark')
  ok((await p.evaluate(() => (window as any).__pings.length)) === 0, '4. no second start ping')
  // ── 5 · its champion ──
  ok(await o.goto(A.x, A.z), '5. in the settlement'); await o.alive()
  const champ = () => p.evaluate(() => (window as any).__ather.combat()?.champ ? { ...(window as any).__ather.combat().champ } : null) as Promise<any>
  if (!(await poll(async () => !!(await champ()), 15000))) for (let k = 0; k < 8 && !(await champ()); k++) { await o.tp(A.x + Math.cos(k * 0.785) * 12, A.z + Math.sin(k * 0.785) * 12); await sleep(5000) }
  const c0 = await champ(); ok(c0?.nodeId === infectId(A.id) && Math.hypot(c0.nx - A.x, c0.nz - A.z) < 30, `5. its champion stands in it (${c0?.nodeId}, ${c0 && Math.hypot(c0.nx - A.x, c0.nz - A.z).toFixed(0)} m from the middle)`)
  await poll(async () => (await champ())?.state !== 'rise', 90000); await p.screenshot({ path: `${out}/4-champion.png` })
  for (let bar = 0; bar < 3; bar++) {
    await p.waitForFunction((n: number) => { const ch = (window as any).__ather.combat().champ; return !ch || (ch.state !== 'submerge' && ch.state !== 'rise' && ch.bar >= n) }, { timeout: 90000 }, bar)
    await p.evaluate(() => { const ch = (window as any).__ather.combat().champ; if (ch) { ch.hp = 1; ch.state = 'recover'; ch.t = 30 } })
    await p.waitForFunction((n: number) => { const c = (window as any).__ather.combat(), ch = c.champ; if (!ch || ch.state === 'submerge' || ch.bar > n) return true
      c.keeper.hp = c.keeper.maxHp; c.rounds.push({ x: ch.x, y: ch.y + 1.7, z: ch.z + 6, vx: 0, vy: 0, vz: -40, life: 1, dmg: 10, crit: 16 }); return false }, { timeout: 60000, polling: 400 }, bar)
  }
  ok(await poll(async () => { const s = await I('state'); return !s.active && s.saved.join() === A.id && s.told === 1 && !s.lost.length }, 20000), `5. beaten: saved, clue 1 (${JSON.stringify(await I('state'))})`)
  ok((await p.evaluate(() => (window as any).__pings.some((e: any) => e.kind === 'saved'))), '5. the saved event')
  await sleep(2500); ok((await o.lit(w.id)) === true, '5. its waymark relit')
  ok((await o.ground()).settlement === A.id && (await I('state')).active === null, `5. kept ground again (${JSON.stringify(await o.ground())})`)
  const t2 = await o.stallTalk(A); ok(t2.includes(BURR_LABEL.look), `5. trade back (${JSON.stringify(t2)})`)
  await o.home(); await sleep(4000); ok(await o.ride(w), '5. the waymark travels')
  // ── 6 · a second one, lost ──
  ok(await o.goto(B.x, B.z), `6. at ${B.name}`); await o.alive(); ok(await poll(async () => (await I('known')).includes(B.id), 20000), '6. discovered')
  let wb: any = null; for (const [dx, dz] of [[2, 16], [14, 8], [-12, 12], [10, -22], [-20, 4]]) { await o.tp(B.x + dx, B.z + dz); if ((await G('wmPlant'))?.ok) { wb = ((await G('wm')) as any[]).find(x => x.settlement === B.id); break } }
  ok(!!wb, '6. a waymark there'); await o.home(); await I('pass', 2 * W)
  ok(await poll(async () => (await I('state'))?.active?.id === B.id, 30000), `6. a week on: ${B.name}, never ${A.name} again`)
  await I('pass', 30 * W); await sleep(1000); const on0 = (await I('state')).active.online; ok(on0 < 30000, `6. 30 weeks away: the loss clock is still at its start (${on0} ms)`)
  await sleep(12000); const on1 = (await I('state')).active?.online; ok(on1 > on0 && on1 < on0 + 30000, `6. it counts played time (${on0} -> ${on1} ms)`)
  await I('play', W / 2); const on2 = (await I('state')).active.online; await o.reload(); await poll(async () => !!(await I('state'))?.active, 30000)
  const on3 = (await I('state')).active.online; ok(on3 >= on2 && on3 < on2 + 40000, `6. reload in the middle: kept, the gap not counted (${on2} -> ${on3})`)
  await I('play', W / 2 + 1000); ok(await poll(async () => { const s = await I('state'); return !s.active && s.lost.join() === B.id }, 30000), `6. a played week: LOST (${JSON.stringify(await I('state'))})`)
  ok((await p.evaluate(() => (window as any).__pings.filter((e: any) => e.kind === 'lost').length)) === 1, '6. the lost event, once')
  ok((await I('state')).told === 1 && (await I('state')).assigned === 2, '6. its clue is carried')
  const lostIs = async (n: string) => {
    await sleep(1500); ok((await o.lit(wb.id)) === false && ((await G('wm')) as any[]).length === 2, `${n} its waymark is dark, the keeper's ledger untouched (${JSON.stringify(await G('wmLit'))} ${JSON.stringify(wb)} of ${((await G('wm')) as any[]).length})`)
    ok(await o.goto(B.x + 3, B.z + 16, 100), `${n} walked there`); await o.alive(); await o.tp(B.x + 3, B.z + 16); await sleep(9000)
    const g = await o.ground(), pl = await o.place(B); ok(g.ground === 'infected' && g.settlement === null, `${n} no settlement, Hollow ground (${JSON.stringify(g)})`)
    ok(!pl.folk && !pl.stall && pl.homes === 'null', `${n} its folk, stall and homes are gone`)
    ok((await p.evaluate(() => (window as any).__ather.combat()?.champ?.nodeId ?? null)) !== infectId(B.id), `${n} no champion to beat`)
    await p.screenshot({ path: `${out}/5-lost.png` })
  }
  await lostIs('6.'); await o.reload(); await poll(async () => (await I('state'))?.lost?.length === 1, 30000); await lostIs('6. reload:')
  ok((await I('state')).saved.join() === A.id && (await o.lit(w.id)) === true, `6. ${A.name} stays safe`)
  await p.close()
  // ── 8 · the player ──
  const save = { v: 1, season: 1, next: 1, active: { id: A.id, at: 1, online: W * 3, clue: 1, sent: ['start'] }, saved: [], lost: [B.id], told: 0, assigned: 1 }
  const q = await open(false, { save, waymark: w }), r0 = JSON.stringify(save)
  await q.boot(); ok((await q.p.evaluate(() => typeof (window as any).__infect)) === 'undefined', '8. not the owner: no hook')
  ok((await q.lit(w.id)) === true, '8. the waymark is lit'); ok(await q.ride(w), '8. and travels')
  await q.alive(); await q.tp(A.x + 2, A.z + 16); await poll(async () => !!(await q.place(A)).folk, 30000); await sleep(12000)
  const qa = await q.place(A); ok(qa.folk === before.folk && qa.homes === before.homes && (await q.ground()).settlement === A.id, '8. the same place')
  const t3 = await q.stallTalk(A); ok(t3.join('|') === t0.join('|'), `8. the same trade (${JSON.stringify(t3)})`)
  ok(await q.goto(B.x, B.z), '8. at the other'); ok(await poll(async () => !!(await q.place(B)).folk, 60000) && (await q.ground()).settlement === B.id, `8. ${B.name} stands`)
  ok((await q.raw()) === r0 && (await q.p.evaluate(() => (window as any).__pings.length)) === 0, '8. the save byte-identical, no event')
  ok(errs.length === 0, `7. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS'); process.exit(fails ? 1 : 0)
