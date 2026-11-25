// ── A GUEST'S TWO HALVES, AND THE 7TH (BETA M156 s4, play / Jin, 11-25) ────────────────────────────────────────────────────
// PROD ONLY, owner. Two throwaway browsers per part, one throwaway party, no account. SETUP (stated): health set high, the champion's
// bar / health set on the running sim, positions by wmGoto; the talk is the real E at a settler.
// A: N (2 told) is there when H's place falls: ITS 3rd folk line from a settler there, once, then their plain hello.
// B: N (6 told) gets its 7th as a guest: the opening is NOT said; N leaves unheard, home alone: not said; its own next place cleared
//    at home: the thanks + the 7th's folk line once, the opening once; then the plain hello.   0 page errors.
//   npx tsx scripts/m156-guest-tell-check.mts [--url https://ather.games] [--only A|B]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import type { Network } from '../src/app/shimmer/open/ather/network'
import { GAME_DAY_MS } from '../src/app/shimmer/open/ather/nodes'
import { folkOf } from '../src/app/shimmer/open/ather/settlement-folk'
import { LISTEN } from '../src/app/shimmer/open/ather/yarrow-teach'
import { INFECT_CLUE, INFECT_OPEN, INFECT_SAVED } from '../src/app/shimmer/open/ather/infect-lines'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'HC' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X')
const rid = (p: string) => p + Math.random().toString(36).slice(2, 8), IDH = rid('p_zz'), IDN = rid('p_mm'), IDX = rid('p_aa')
const KEYS = ['ather.nodes.v2', 'ather.spreadmap.v1', 'ather.infection.v1']
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] })
const poll = async (fn: () => Promise<unknown>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return (Date.now() - t) / 1000 + 0.01; await sleep(300) } return 0 }
const ev = (p: Page, obj: string, f: string) => p.evaluate((o: string, k: string) => (window as any)[o]?.[k]?.(), obj, f) as Promise<any>
async function open(tag: string, id: string, seed: Record<string, unknown>, party = CODE): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 0.4 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string, id: string, s: string) => {
    if (location.protocol !== 'https:') return   // about:blank
    { const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET' && /save|garden|owner/.test(String(u))) ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i) }
    if (sessionStorage.getItem('m156h')) return; sessionStorage.setItem('m156h', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); if (c) localStorage.setItem('ather:mp:party', c); localStorage.setItem('ather:mp:id', id)
    for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, JSON.stringify(v))
  }, party, id, JSON.stringify(seed))
  return p
}
const load = async (p: Page) => {
  await p.goto(`${url}/shimmer/open/ather?hour=13&infect=1`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.zone && !!(window as any).__ather?.wmNodes && !!(window as any).__mp && !!(window as any).__lobby, { timeout: 240000, polling: 1000 })
  await sleep(2500)
}
const wilds = async (p: Page) => { for (let i = 0; i < 30 && (await ev(p, '__ather', 'zone')) !== 'wilds'; i++) {
  await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 15000, polling: 1000 }).catch(() => {}) } }
/** the clear nodes of the tile both stand in, as the PAGE reads them */
const clear = async (p: Page) => ((await ev(p, '__ather', 'wmNodes')) as any[] ?? []).filter(n => !n.infected).map(n => n.id).sort().join()
const bytes = (p: Page) => p.evaluate((ks: string[]) => JSON.stringify(ks.map(k => localStorage.getItem(k))), KEYS) as Promise<string>
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network, A = net.settlements.find(s => s.id === 's1-9')!, B = net.settlements.find(s => s.id === 's1-5')!
type Ch = { node: string; bar: number; hp: number; state: string; x: number; y: number; z: number; remote: boolean } | null
const champ = (p: Page) => p.evaluate(() => { const c = (window as any).__ather?.combat?.(), h = c?.champ; return h ? { node: h.nodeId, bar: h.bar, hp: h.hp, state: h.state, x: h.x, y: h.y, z: h.z, remote: !!c.remote } : null }) as Promise<Ch>
const tough = (p: Page) => p.evaluate(() => { const k = (window as any).__ather.combat().keeper; k.maxHp = 1e6; k.hp = 1e6 })
const near = async (p: Page, x: number, z: number) => { await p.evaluate((x: number, z: number) => (window as any).__ather.wmGoto(x, z), x, z)
  await poll(() => p.evaluate((x: number, z: number) => { const s = (window as any).__ather.state?.(); return s && Math.hypot(s.px - x, s.pz - z) < 60 }, x, z), 30000); await sleep(1500)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), x, z); await tough(p) }
const ledger = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('ather.nodes.v2') ?? '{"clean":[]}').clean as string[])
const count = async (p: Page, id: string) => (await ledger(p)).filter(k => k === id).length
const host = (p: Page) => p.evaluate(() => (window as any).__fight?.hostId?.()) as Promise<string>
const grey = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('ather.garden.v1') ?? '{}').grey ?? 0) as Promise<number>
const onHost = (p: Page, bar: number, hp: number) => p.evaluate((b: number, h: number) => { const c = (window as any).__ather.combat().champ; if (!c) return false; c.bar = b; c.hp = h; return true }, bar, hp)
/** the last blow, from a round put in the host's sim */
const blow = (p: Page) => poll(async () => p.evaluate(() => { const c = (window as any).__ather.combat(), h = c.champ; if (!h) return true; h.bar = 2; h.hp = 1; c.rounds.push({ x: h.x + 1.8, y: h.y + 1.7, z: h.z, vx: -50, vy: 0, vz: 0, life: 1, dmg: 5, crit: 5 }); return false }), 90000)
const met = async (a: Page, b: Page, ia: string, ib: string) => poll(async () => (await ev(a, '__mp', 'peers'))?.some((q: any) => q.id === ib) && (await ev(b, '__mp', 'peers'))?.some((q: any) => q.id === ia), 90000)
const asOwner = async (p: Page) => { const K = process.env.OWNER_KEY; if (!K) { console.error('no OWNER_KEY'); process.exit(2) } await p.goto(`${url}/owner?key=${encodeURIComponent(K)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}) }
const only = flag('--only', '')
const I = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('ather.infection.v1') ?? 'null')) as Promise<any>
const T = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('ather.infection-told.v1') ?? 'null')) as Promise<any>
const opens = (p: Page) => p.evaluate(() => (window as any).__opens as number)
/** the settler's words: which infection lines the talk showed */
async function talkTo(p: Page, s: typeof A): Promise<string[]> {
  const fid = folkOf(s, 1)[0].id, CAND = [INFECT_SAVED, ...INFECT_CLUE.map(c => c.folk)], seen: string[] = []
  const opts = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].map(e => e.textContent ?? ''))
  await p.bringToFront()
  await poll(() => p.evaluate((id: string, f: string) => ((window as any).__folk?.drawn?.()[id] ?? []).some((x: any) => x.id === f), s.id, fid), 60000)
  for (let k = 0; k < 12 && !seen.length; k++) {
    const f = await p.evaluate((id: string, fid: string) => (window as any).__folk.drawn()[id]?.find((x: any) => x.id === fid), s.id, fid) as any; if (!f) { await sleep(3000); continue }
    const a = f.yaw + [0, 0.5, -0.5, 1, -1, 2, -2, 3, 1.5, -1.5, 2.5, -2.5][k]
    await p.evaluate((x: number, z: number, y: number) => { const g = (window as any).__ather, c = g.combat?.(); if (c) { c.hollows.length = 0; c.keeper.hp = c.keeper.maxHp } g.tp(x, z, y); g.look(y, -Math.atan2(1.1, 1.7)) }, f.x + Math.sin(a) * 1.7, f.z + Math.cos(a) * 1.7, a)
    await sleep(2500); await p.keyboard.press('KeyE'); await p.mouse.move(5, 5); await poll(async () => (await opts()).length > 0, 8000)
    if (!(await opts()).length) continue
    if ((await p.evaluate(() => (window as any).__folkTalk?.on)) !== fid) { await p.keyboard.press('Escape'); await sleep(1500); continue }
    for (let n = 0; n < 4; n++) {
      await sleep(2000); const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); seen.push(CAND.find(l => t.includes(l) && !seen.includes(l)) ?? '(plain hello)')
      if (!(await opts()).some(x => x.includes(LISTEN))) break
      await p.evaluate((l: string) => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].find(e => e.textContent?.includes(l))!.click(), LISTEN)
    }
    await p.keyboard.press('Escape'); await sleep(1500)
  }
  return seen
}
const now = Date.now(), rule = { seed: 7, day: Math.floor(now / GAME_DAY_MS) + 1, since: now }
const base = { 'open.works.v1': { v: 1, rooms: [], chests: [], pieces: [] }, 'open.tutorial.v1': { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], owned: true }, 'ather.spreadmap.v1': { v: 1, seen: {}, first: true, grey: {}, rule } }
const inf = (o: object) => ({ 'ather.infection.v1': { v: 1, season: 1, next: now + 9e9, active: null, saved: [], lost: [], told: 0, assigned: 0, ...o } })
const spot = (p: Page, id: string) => p.evaluate((id: string) => { const k = (window as any).__ather.nodes().find((q: any) => q.id === id); return k ? { x: k.x, z: k.z } : null }, `infect:${id}`)
/** H's place A falls with N there */
async function cleared(told: number) {
  const code = 'GT' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X'), ih = rid('p_zz'), im = rid('p_mm')
  const h = await open('H', ih, { ...base, ...inf({ active: { id: A.id, at: now, online: 0, clue: 1, sent: ['start'] }, assigned: 1 }) }, code); await asOwner(h)
  const n = await open('N', im, { ...base, ...inf({ told, assigned: told }), 'ather.infection-told.v1': { v: 1, season: 1, said: [], clueOf: {}, met: [], heard: Array.from({ length: told }, (_, k) => k + 1), open: false } }, code); await asOwner(n)
  await n.evaluateOnNewDocument((l: string) => { (window as any).__opens = 0; let on = false; setInterval(() => { const is = !!document.body?.innerText.includes(l); if (is && !on) (window as any).__opens++; on = is }, 100) }, INFECT_OPEN)
  await load(h); await wilds(h); await load(n); await wilds(n)
  ok(await met(h, n, ih, im) && await poll(() => n.evaluate(() => !!(window as any).__guest?.ledger?.()?.held), 40000), `${told}. N is H's guest, H's place is held`)
  await near(h, A.x + 2, A.z + 14); await near(n, A.x + 4, A.z + 14); await sleep(4000)
  const at = (await spot(h, A.id))!; await near(h, at.x + 8, at.z + 4); await near(n, at.x - 8, at.z + 4)
  ok(await poll(async () => (await champ(h))?.node === `infect:${A.id}` && !!(await champ(n))?.remote, 90000), `${told}. the champion, H's, N shown it`)
  await poll(async () => (await champ(h))?.state !== 'rise', 60000); await onHost(h, 2, 60); await poll(async () => (await champ(n))?.bar === 2, 30000); await sleep(1500)
  ok(await blow(h), `${told}. it falls`)
  ok(await poll(async () => (await I(n)).told === told + 1 && (await I(n)).given?.join() === `${told + 1}` && !(await I(n)).saved.length, 30000), `${told}. N: its own next, ${told + 1} (${JSON.stringify(await I(n))})`)
  return { h, n, ih }
}
try {
  if (only !== 'B') {
    const { h, n, ih } = await cleared(2)
    ok((await T(n)).at?.['3'] === `${ih}|${A.id}`, 'A. kept: whose Wilds, which place')
    const t1 = await talkTo(n, A); ok(t1.join('|') === INFECT_CLUE[2].folk, `A. a settler at the HOST's place: N's own 3rd, word for word (${JSON.stringify(t1)})`)
    const t2 = await talkTo(n, A); ok(t2.join('|') === '(plain hello)', `A. once: then the plain hello (${JSON.stringify(t2)})`)
    const th = await talkTo(h, A); ok(th.join('|') === `${INFECT_SAVED}|${INFECT_CLUE[0].folk}`, `A. H, its own story: the thanks, the 1st (${JSON.stringify(th)})`)
    ok((await T(n)).heard.join() === '1,2,3', `A. N's save: heard (${JSON.stringify(await T(n))})`); await h.close(); await n.close()
  }
  if (only !== 'A') {
    const { h, n } = await cleared(6); await sleep(20000)
    ok((await opens(n)) === 0 && !(await T(n)).open, 'B. the 7th as a guest: 20 s on, the opening is not said')
    await h.close(); await n.evaluate(() => { localStorage.removeItem('ather:mp:party'); window.dispatchEvent(new Event('ather:party')) }); await load(n); await wilds(n); await near(n, B.x + 2, B.z + 14); await sleep(20000)
    ok((await n.evaluate(() => !(window as any).__guest?.ledger?.())) && (await opens(n)) === 0 && !(await T(n)).open, 'B. home alone, reloaded, 20 s: still not said')
    ok(await poll(() => n.evaluate((id: string) => (window as any).__infect.known().includes(id), B.id), 60000) && await n.evaluate((id: string) => (window as any).__infect.start(id), B.id), 'B. N\'s own place is held')
    await sleep(8000); ok((await opens(n)) === 0, 'B. held: still not said')
    await poll(async () => !!(await spot(n, B.id)), 30000); const at = (await spot(n, B.id))!; await near(n, at.x + 8, at.z + 4)
    ok(await poll(async () => (await champ(n))?.node === `infect:${B.id}`, 90000), 'B. its champion'); await poll(async () => (await champ(n))?.state !== 'rise', 60000); await tough(n); ok(await blow(n), 'B. it falls at home')
    ok(await poll(async () => (await I(n)).saved.join() === B.id && (await I(n)).opened === true, 20000), `B. saved, open (${JSON.stringify(await I(n))})`)
    ok(await poll(async () => (await opens(n)) === 1, 60000), `B. "${INFECT_OPEN}" now`)
    const t1 = await talkTo(n, B); ok(t1.join('|') === `${INFECT_SAVED}|${INFECT_CLUE[6].folk}`, `B. left unheard: at home, the thanks and the 7th (${JSON.stringify(t1)})`)
    const t2 = await talkTo(n, B); ok(t2.join('|') === '(plain hello)', `B. once (${JSON.stringify(t2)})`)
    const o = await opens(n); await load(n); await sleep(15000); ok(o === 1 && (await opens(n)) === 0, `B. the opening once (${o}), a reload says nothing`)
  }
  ok(errs.length === 0, `page errors: ${errs.length} ${errs.join(' | ')}`)
} catch (e) { ok(false, `error: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
