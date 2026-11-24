// BETA M128 s2: the infection story SAID, on prod at 390x844 (setup + hooks as m128-infection-check.mts; fresh profiles, no account,
// every write stubbed). Each signed line counted as it comes on screen, word for word: pings that fired before s2 reach the keeper
// once, none twice over reloads; the right clue from the right folk; a lost place's clue carried by ITS folk to the next; the
// object, the thanks; a player sees nothing and the save is byte-identical.
//   npx tsx scripts/m128-tell-check.mts [--url https://ather.games] [--out dir]      (OWNER_KEY from env or .env)
import puppeteer, { type Page } from 'puppeteer-core'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { folkOf } from '../src/app/shimmer/open/ather/settlement-folk'
import { burrfolkOf, stallSpot, BURR_LABEL } from '../src/app/shimmer/open/ather/burrfolk'
import { INFECT_WEEK_MS as W } from '../src/app/shimmer/open/ather/infection'
import { STALL_STOPPED, INFECT_CARRY, INFECT_CLUE, INFECT_SAVED, MOREL_INFECT } from '../src/app/shimmer/open/ather/infect-lines'
import { LISTEN } from '../src/app/shimmer/open/ather/yarrow-teach'
import { infectId } from '../src/app/shimmer/open/ather/infect-id'
import { LOST_WHY } from '../src/app/shimmer/open/ather/waymarks'
import { STARTING_SQUARES } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
import type { Network, Settlement } from '../src/app/shimmer/open/ather/network'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m128-tell'); mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /^OWNER_KEY=(.+)$/m.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const A = net.settlements.find(s => s.id === 's1-9')!, B = net.settlements.find(s => s.id === 's1-5')!
const SAVE = 'ather.infection.v1', sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const fill = (l: string, s: Settlement) => l.replace('{PLACE}', s.name)
const L = (k: keyof typeof MOREL_INFECT, s: Settlement) => fill(MOREL_INFECT[k], s)
const WATCH = [A, B].flatMap(s => Object.keys(MOREL_INFECT).map(k => L(k as 'start', s))).concat(INFECT_CLUE.flatMap(c => c.obj ? [c.obj] : []))
const errs: string[] = []
async function open(owner: boolean, seed: { save?: unknown; waymark?: unknown; fog?: string }) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  p.on('pageerror', e => errs.push(`${owner ? 'owner' : 'player'}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)) === owner, owner ? '0. the OWNER' : '0. NOT the owner')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    ;(window as any).__pings = []; (window as any).__lines = {}; { const on: Record<string, boolean> = {}; setInterval(() => { const t = document.body?.innerText ?? ''; for (const l of s.watch) { const is = t.includes(l); if (is && !on[l]) (window as any).__lines[l] = ((window as any).__lines[l] ?? 0) + 1; on[l] = is } }, 300) } window.addEventListener('ather-infection', e => (window as any).__pings.push((e as CustomEvent).detail))
    if (sessionStorage.getItem('m128')) return; sessionStorage.setItem('m128', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('ather.garden.v1', JSON.stringify({ owned: s.owned, grey: 50, pages: 10, layout: s.layout }))
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest', 'm70pack'], b2: 'accepted', baitDay: null, fold: 'done', m70: 'thanked' }))
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: [{ id: 'waymark', n: 4 }, ...Array(31).fill(null)], gifts: ['bait1'] }))
    if (s.fog) localStorage.setItem('ather.fog.v2', s.fog)
    if (s.save) localStorage.setItem('ather.infection.v1', JSON.stringify(s.save))
    if (s.waymark) localStorage.setItem('ather.waymarks.v1', JSON.stringify([s.waymark]))
  }, { owned: [...STARTING_SQUARES], layout: LAYOUT, watch: WATCH, ...seed })
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
      await p.evaluate((x, z, y) => { const g = (window as any).__ather; const c = g.combat?.(); if (c) { c.hollows.length = 0; c.keeper.hp = c.keeper.maxHp } g.tp(x, z, y); g.look(y, -Math.atan2(1.1, 2.2)) }, sp.x + fx * (2.2 - (k % 3) * 0.3), sp.z + fz * (2.2 - (k % 3) * 0.3), Math.atan2(fx, fz)); await sleep(2500)
      await p.keyboard.press('KeyE'); await p.mouse.move(5, 5); await poll(async () => (await opts()).length > 0, 6000); o = await opts()
      if (o.length && (await p.evaluate(() => (window as any).__folkTalk?.on)) !== burrfolkOf(s, net.season, folkOf(s, net.season))!.id) { await p.keyboard.press('Escape'); await sleep(1500); o = [] }   // E took a Moglin beside it: stand again
      if (!o.length) { await p.screenshot({ path: `${out}/stall-miss-${k}.png` }); console.log(`  stall miss ${k}: ${JSON.stringify(await p.evaluate(() => document.body.innerText.slice(-300).replace(/\s+/g, ' ')))}`) }
    }
    await p.keyboard.press('Escape'); await sleep(1200); return o
  }
  const lit = async (id: string) => ((await G('wmLit')) as { id: string; lit: boolean }[]).find(w => w.id === id)?.lit
  const alive = () => p.evaluate(() => { if ((window as any).__m128hp) return; (window as any).__m128hp = setInterval(() => { const c = (window as any).__ather?.combat?.(); if (c) c.keeper.hp = c.keeper.maxHp }, 200) })
  const ground = async () => (await G('wmGround')) as { ground: string; settlement: string | null }
  return { ride, p, G, I, raw, boot, reload, goto, tp, home, place, stallTalk, lit, alive, ground }
}
const WM = { id: 'wm-t', tile: 'first-wilds', x: A.x, y: 0, z: A.z + 16, biome: 2, made: 1, settlement: A.id }
const said = (p: Page) => p.evaluate(() => (window as any).__lines) as Promise<Record<string, number>>
const heard = async (p: Page, l: string, ms = 40000) => poll(async () => (await said(p))[l] === 1, ms)
/** stand before one Moglin and talk; the bubble's words, then what each (listen) shows */
async function talkTo(o: Awaited<ReturnType<typeof open>>, s: Settlement, fid: string): Promise<string[]> {
  const { p } = o, words = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')), opts = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, '').trim())) as Promise<string[]>
  const CAND = [STALL_STOPPED, INFECT_CARRY, INFECT_SAVED, ...INFECT_CLUE.map(c => c.folk)], seen: string[] = []
  await poll(async () => p.evaluate((id: string, f: string) => [...((window as any).__folk?.drawn?.()[id] ?? []), (window as any).__folk?.stalls?.()[id]].some((x: any) => x?.id === f), s.id, fid), 40000)
  for (let k = 0; k < 10 && !seen.length; k++) {
    const f = await p.evaluate((id: string, fid: string) => [...(window as any).__folk.drawn()[id], (window as any).__folk.stalls()[id]].find((x: any) => x?.id === fid), s.id, fid) as any, a = f.yaw + [0, 0.5, -0.5, 1, -1, 2, -2, 3, 1.5, -1.5][k], d = fid === burrfolkOf(s, 1, folkOf(s, 1))?.id ? 2.2 : 1.7
    await p.evaluate((x: number, z: number, y: number) => { const g = (window as any).__ather, c = g.combat?.(); if (c) { c.hollows.length = 0; c.keeper.hp = c.keeper.maxHp } g.tp(x, z, y); g.look(y, -Math.atan2(1.1, 1.7)) }, f.x + Math.sin(a) * d, f.z + Math.cos(a) * d, a)
    await sleep(1800); await p.keyboard.press('KeyE'); await p.mouse.move(5, 5); await poll(async () => (await opts()).length > 0, 6000)
    if (!(await opts()).length) continue
    if ((await p.evaluate(() => (window as any).__folkTalk?.on)) !== fid) { await p.keyboard.press('Escape'); await sleep(1500); continue }
    for (let n = 0; n < 4; n++) {
      await sleep(1500); const t = await words(), got = CAND.find(l => t.includes(l) && !seen.includes(l)); seen.push(got ?? '(no infection line)')
      if (n === 0) await p.screenshot({ path: `${out}/talk-${s.id}-${fid.replace(/\W/g, '_')}.png` })
      if (!(await opts()).some(x => x.includes(LISTEN))) break
      await p.evaluate((l: string) => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].find(e => e.textContent?.includes(l))!.click(), LISTEN)
    }
    await p.keyboard.press('Escape'); await sleep(1200)
  }
  return seen
}
try {
  // an infection of the first build: started and half a week old, the keeper told nothing
  const at = Date.now() - Math.floor(W * 0.6), save = { v: 1, season: 1, next: 1, active: { id: A.id, at, online: 0, clue: 1, sent: ['start', 'hold'] }, saved: [], lost: [], told: 0, assigned: 1 }
  const o = await open(true, { save }), { p, I } = o
  await o.boot(); ok(await poll(async () => !!(await I('state'))?.active, 30000), '1. the engine holds it')
  ok(await heard(p, L('start', A)), `1. fired before s2: "${L('start', A)}"`); await p.screenshot({ path: `${out}/1-start.png` })
  ok((await p.evaluate(() => document.body.innerText)).includes('Morel'), '1. Morel says it'); ok(await heard(p, L('hold', A)), '1. then the hold line')
  await sleep(12000); await o.reload(); await sleep(15000); ok(Object.keys(await said(p)).length === 0, `2. a reload says nothing again (${JSON.stringify(await said(p))})`)
  ok(await o.goto(A.x, A.z), '3. at the held place'); await o.alive(); const fa = folkOf(A, 1)
  const t1 = await talkTo(o, A, fa[0].id); ok(t1.join('|') === INFECT_CLUE[0].folk, `3. its folk: clue 1 (${JSON.stringify(t1)})`)
  { const b = burrfolkOf(A, 1, fa)!, ts = await talkTo(o, A, b.id); ok(ts.join('|') === STALL_STOPPED, `3. the stall: "${STALL_STOPPED}" (${JSON.stringify(ts)})`) }
  ok(await o.home(), '3. home'); await I('pass', W); ok(await heard(p, L('second', A)), '4. the second week, once'); await sleep(10000)
  await I('play', W); ok(await heard(p, L('lost', A)), '5. lost, once'); await p.screenshot({ path: `${out}/2-lost.png` })
  const now = await said(p); ok(now[L('start', A)] === undefined && now[L('second', A)] === 1 && now[L('lost', A)] === 1, `5. each once (${JSON.stringify(now)})`)
  await o.p.evaluate((w: any) => (window as any).__ather.travel({ kind: 'waymark', w }), WM); ok(await poll(async () => (await p.evaluate(() => document.body.innerText)).includes(LOST_WHY), 4000), `5. its waymark: "${LOST_WHY}"`)
  await o.reload(); await sleep(15000); ok(Object.keys(await said(p)).length === 0, '5. reload: nothing again')
  // ── the next place ──
  ok(await o.goto(B.x, B.z), `6. at ${B.name}`); await o.alive(); ok(await poll(async () => (await I('known')).includes(B.id), 20000), '6. discovered')
  ok(await I('start', B.id), '6. infected'); ok(await heard(p, L('start', B)), '6. its start line')
  const inB = () => p.evaluate((id: string) => ((window as any).__folk?.drawn?.()[id] ?? []).map((f: any) => f.id), B.id) as Promise<string[]>
  ok(await poll(async () => (await inB()).includes(fa[0].id), 40000), `6. one of ${A.name}'s folk stands in ${B.name} (${fa[0].name}: ${JSON.stringify(await inB())})`)
  const t2 = await talkTo(o, B, fa[0].id); ok(t2.join('|') === `${INFECT_CARRY}|${INFECT_CLUE[0].folk}`, `6. the carried clue: opener, clue 1 (${JSON.stringify(t2)})`)
  const t3 = await talkTo(o, B, folkOf(B, 1)[0].id); ok(t3.join('|') === INFECT_CLUE[1].folk, `6. ${B.name}'s own: clue 2 (${JSON.stringify(t3)})`)
  await o.reload(); ok(await o.goto(B.x, B.z), '6. reload, back'); await o.alive(); ok(await poll(async () => (await inB()).includes(fa[0].id), 40000), '6. reload: still there')
  // ── its big one ──
  const champ = () => p.evaluate(() => (window as any).__ather.combat()?.champ ? { ...(window as any).__ather.combat().champ } : null) as Promise<any>
  for (let k = 0; k < 10 && !(await champ()); k++) { await o.tp(B.x + Math.cos(k * 0.785) * 12, B.z + Math.sin(k * 0.785) * 12); await sleep(5000) }
  await poll(async () => (await champ())?.state !== 'rise', 90000); ok((await champ())?.nodeId === infectId(B.id), '7. its big one')
  for (let bar = 0; bar < 3; bar++) {
    await p.waitForFunction((n: number) => { const ch = (window as any).__ather.combat().champ; return !ch || (ch.state !== 'submerge' && ch.state !== 'rise' && ch.bar >= n) }, { timeout: 90000 }, bar)
    await p.evaluate(() => { const ch = (window as any).__ather.combat().champ; if (ch) { ch.hp = 1; ch.state = 'recover'; ch.t = 30 } })
    await p.waitForFunction((n: number) => { const c = (window as any).__ather.combat(), ch = c.champ; if (!ch || ch.state === 'submerge' || ch.bar > n) return true
      c.keeper.hp = c.keeper.maxHp; c.rounds.push({ x: ch.x, y: ch.y + 1.7, z: ch.z + 6, vx: 0, vy: 0, vz: -40, life: 1, dmg: 10, crit: 16 }); return false }, { timeout: 60000, polling: 400 }, bar)
  }
  ok(await poll(async () => (await I('state')).saved.join() === B.id && (await I('state')).told === 2, 20000), '7. saved, both clues told')
  ok(await heard(p, INFECT_CLUE[1].obj!), `7. what it left: "${INFECT_CLUE[1].obj}"`); await p.screenshot({ path: `${out}/3-object.png` })
  ok(await poll(async () => !(await inB()).includes(fa[0].id), 20000), '7. the folk who carried it have gone on')
  const t4 = await talkTo(o, B, folkOf(B, 1)[0].id); ok(t4.join('|') === INFECT_SAVED, `7. the thanks (${JSON.stringify(t4)})`)
  const t5 = await talkTo(o, B, folkOf(B, 1)[0].id); ok(t5.join('|') === '(no infection line)', `7. then the plain hello (${JSON.stringify(t5)})`)
  await o.reload(); await sleep(15000); ok(Object.keys(await said(p)).length === 0, `7. reload: nothing again (${JSON.stringify(await said(p))})`); await p.close()
  // ── the player ──
  const q = await open(false, { save: { ...save, lost: [B.id] } }), r0 = JSON.stringify({ ...save, lost: [B.id] })
  await q.boot(); await sleep(20000); ok(Object.keys(await said(q.p)).length === 0, '8. not the owner: nothing said'); ok(await q.goto(A.x, A.z), '8. at the place'); await q.alive()
  const t6 = await talkTo(q, A, fa[0].id); ok(t6.join('|') === '(no infection line)', `8. its folk's plain hello (${JSON.stringify(t6)})`)
  ok((await q.raw()) === r0 && (await q.p.evaluate(() => Object.keys(localStorage).some(k => k.includes('infection-told')))) === false, '8. the save byte-identical, nothing written beside it')
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS'); process.exit(fails ? 1 : 0)
