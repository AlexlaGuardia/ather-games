// ── M164: does a keeper who comes back a day later hang? ──
//   One seed load (real clock, a keeper in the Glade) is copied into a clean browser context per row; the save's age and the page's clock are
//   turned separately, with the session recorder on / blocked, as player / owner. A row hangs when the page stops answering.
//   Rows 'agree' (every clock tells the same time) must not hang; rows 'split' (only Date.now moved) are there to name the cause and are reported only.
//   Nothing reaches PostHog's event / replay endpoints (answered in the browser).
//   [OWNER_KEY=..] npx tsx scripts/day-later-check.mts [--url https://ather.games] [--only 2,5] [--repeat 3]
import puppeteer, { type CDPSession, type Page } from 'puppeteer-core'
import { fakeClock } from './lib/clock.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), only = flag('--only', '').split(',').filter(Boolean).map(Number), KEY = process.env.OWNER_KEY ?? ''
const H = 3_600_000, sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-blink-features=AutomationControlled',   /* PostHog drops a robot's events; a player's are what is asked about */  '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
type Clock = 'real' | 'all' | 'now-only' | 'jump'
type Row = { n: number; name: string; age: number; clock: Clock; skip: number; recorder: boolean; owner: boolean; agree: boolean }
const ROWS: Row[] = [
  { n: 1, name: 'control: same save, real clock', age: 0, clock: 'real', skip: 0, recorder: true, owner: false, agree: true },
  { n: 2, name: 'save 25 h old, real clock', age: 25, clock: 'real', skip: 0, recorder: true, owner: false, agree: true },
  { n: 3, name: 'save 25 h old, real clock', age: 25, clock: 'real', skip: 0, recorder: true, owner: true, agree: true },
  { n: 4, name: 'save 25 h old, real clock', age: 25, clock: 'real', skip: 0, recorder: false, owner: false, agree: true },
  { n: 5, name: 'save 30 d old, real clock', age: 720, clock: 'real', skip: 0, recorder: true, owner: false, agree: true },
  { n: 6, name: 'save as is, every clock +24.5 h', age: 0, clock: 'all', skip: 24.5, recorder: true, owner: false, agree: true },
  { n: 7, name: 'tab left open, every Date jumps +25 h mid-visit (a sleeping laptop)', age: 0, clock: 'jump', skip: 25, recorder: true, owner: false, agree: true },
  { n: 13, name: 'tab left open, every Date jumps +25 h mid-visit', age: 0, clock: 'jump', skip: 25, recorder: false, owner: false, agree: true },
  { n: 14, name: 'tab left open, every Date jumps +23 h mid-visit', age: 0, clock: 'jump', skip: 23, recorder: true, owner: false, agree: true },
  { n: 15, name: 'tab left open, every Date jumps +1 h mid-visit', age: 0, clock: 'jump', skip: 1, recorder: true, owner: false, agree: true },
  { n: 8, name: 'save as is, Date.now only +24.5 h (the old check)', age: 0, clock: 'now-only', skip: 24.5, recorder: true, owner: false, agree: false },
  { n: 9, name: 'save as is, Date.now only +24.5 h', age: 0, clock: 'now-only', skip: 24.5, recorder: false, owner: false, agree: false },
  { n: 10, name: 'save as is, Date.now only +24.5 h', age: 0, clock: 'now-only', skip: 24.5, recorder: true, owner: true, agree: false },
  { n: 11, name: 'save as is, Date.now only +23.5 h', age: 0, clock: 'now-only', skip: 23.5, recorder: true, owner: false, agree: false },
  { n: 12, name: 'save 25 h old, Date.now only +0.1 h', age: 25, clock: 'now-only', skip: 0.1, recorder: true, owner: false, agree: false },
]
type Seed = { ls: Record<string, string>; ck: any[] }
// every moment in the text, hours back: 13-digit times within 60 d of now, and the time inside a v7 id (the recorder's session ids)
const near = (t: number) => Math.abs(t - Date.now()) < 60 * 24 * H
const older = (s: string, ms: number) => s.replace(/(?<!\d)\d{13}(?!\d)/g, d => near(+d) ? String(+d - ms) : d).replace(/\b([0-9a-f]{8})-([0-9a-f]{4})-7/g, (m, a, b) => { const t = parseInt(a + b, 16); if (!near(t)) return m; const x = (t - ms).toString(16).padStart(12, '0'); return `${x.slice(0, 8)}-${x.slice(8)}-7` })
async function page(o: { recorder: boolean; owner: boolean; seed?: Seed; clock: Clock; skip: number }) {
  const ctx = await br.createBrowserContext(), p = await ctx.newPage(), c = { rec: 0, replay: 0 }
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await p.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36')
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.setRequestInterception(true)
  p.on('request', r => {
    const u = r.url(), ph = /posthog\.com/.test(u)
    if (ph && /recorder/.test(u)) { c.rec++; return void (o.recorder ? r.continue() : r.abort()) }
    if (ph && r.method() === 'POST' && !/\/flags/.test(u)) { if (/\/s\//.test(u)) c.replay++; return void r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"status":1}' }) }
    r.continue()
  })
  await p.evaluateOnNewDocument((seed: Record<string, string> | null) => {
    if (localStorage.getItem('chk')) return
    localStorage.setItem('chk', '1')
    if (seed) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); return }
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'rinstick'] }))
  }, o.seed?.ls ?? null)
  if (o.seed) for (const k of o.seed.ck) await p.setCookie(k).catch(() => {})
  const off = o.clock === 'jump' ? 0 : o.skip * H
  if (o.clock === 'now-only') await p.evaluateOnNewDocument((ms: number) => { const real = Date.now.bind(Date); Date.now = () => real() + ms }, off)
  else if (o.clock !== 'real') await p.evaluateOnNewDocument(fakeClock, off)
  if (o.owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  return { ctx, p, c }
}
const alive = async (p: Page, ms = 45000) => Promise.race([p.evaluate('1').then(() => true, () => true), sleep(ms).then(() => false)])
// to the game and 25 s of play; 'ok' or where it stopped answering
async function visit(p: Page): Promise<string> {
  const nav = p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(e => e)
  await Promise.race([nav, sleep(95000)])
  let t0 = Date.now()
  for (;;) {
    if (!await alive(p)) return `HANG ${Math.round((Date.now() - t0) / 1000)} s into the load`
    const r = await p.evaluate(() => typeof (window as any).__ather?.travel === 'function' && !!(window as any).__ather?.gather).catch(() => false)
    if (r) break
    if (Date.now() - t0 > 240000) return 'never ready (page answers)'
    await sleep(1000)
  }
  return play(p, 25)
}
async function play(p: Page, secs: number): Promise<string> {
  const t0 = Date.now(); while (Date.now() - t0 < secs * 1000) { if (!await alive(p)) return 'HANG in play'; await Promise.race([p.touchscreen.tap(195, 500), sleep(20000)]).catch(() => {}); await sleep(2500) }
  return await alive(p) ? 'ok' : 'HANG in play'
}
async function stack(p: Page, c: CDPSession) { const s: any = await Promise.race([(async () => { const ev = new Promise(r => c.once('Debugger.paused', (e: any) => r(e.callFrames.slice(0, 40).map((f: any) => f.functionName || '?').join(' < ')))); await c.send('Debugger.pause'); return ev })().catch(e => String(e)), sleep(15000).then(() => 'no stack')]); return String(s).slice(0, 900) }
let bad = 0
try {
  const s = await page({ recorder: true, owner: false, clock: 'real', skip: 0 }), sr = await visit(s.p); await sleep(5000)
  const seed: Seed = { ls: await s.p.evaluate(() => ({ ...localStorage })) as any, ck: await s.p.cookies(url) }; await s.ctx.close()
  console.log(`seed ${sr}: ${Object.keys(seed.ls).length} keys (${Object.keys(seed.ls).filter(k => k.startsWith('ph_')).length} ph_), ${seed.ck.length} cookies, recorder asked ${s.c.rec}, replay posts ${s.c.replay}`)
  if (sr !== 'ok') throw new Error('the seed did not load')
  for (const r of ROWS.flatMap(x => Array<Row>(+flag('--repeat', '1')).fill(x))) {
    if (only.length && !only.includes(r.n)) continue
    if (r.owner && !KEY) { console.log(`- ${r.n}. ${r.name}: skipped, no OWNER_KEY`); continue }
    const ms = r.age * H, aged: Seed = { ls: Object.fromEntries(Object.entries(seed.ls).map(([k, v]) => [k, older(v, ms)])), ck: seed.ck.map(({ name, value, domain, path, secure, sameSite, expires }) => ({ name, value: older(value, ms), domain, path, secure, sameSite, ...(expires > 0 ? { expires } : {}) })) }
    const t = await page({ ...r, seed: aged }); const dbg = await t.p.createCDPSession(); await dbg.send('Debugger.enable'); let v = await visit(t.p)
    if (v === 'ok' && r.clock === 'jump') { await t.p.evaluate((x: number) => (window as any).__clock(x), r.skip * H); v = await play(t.p, 60) }
    const ck = v === 'ok' ? await t.p.evaluate((n: number) => [Date.now(), new Date().getTime(), performance.timeOrigin + performance.now()].map(x => ((x - n) / 3_600_000).toFixed(1)).join(' / '), Date.now()) : '?'
    const st = v.startsWith('HANG') ? await stack(t.p, dbg) : ''
    const good = v === 'ok' && (!r.agree || !r.recorder || t.c.replay > 0); if (r.agree && !good) bad++
    console.log(`${good ? '✓' : r.agree ? '✗' : '·'} ${r.n}. ${r.agree ? 'agree' : 'split'} | ${r.owner ? 'owner' : 'player'} | recorder ${r.recorder ? 'on' : 'blocked'} (asked ${t.c.rec}, replay posts ${t.c.replay}) | clocks h ahead (Date.now / new Date / performance) ${ck} | ${r.name}: ${v}${v === 'ok' && !good ? ' BUT the recorder sent nothing' : ''}${st ? `\n      ${st}` : ''}`)
    // a hung tab would not close: its context is dropped without waiting
    await Promise.race([t.ctx.close().catch(() => {}), sleep(10000)])
  }
} catch (e) { bad++; console.log(`✗ crashed: ${String(e).slice(0, 300)}`) } finally { await Promise.race([br.close(), sleep(10000)]); br.process()?.kill('SIGKILL') }
console.log(bad ? `FAIL (${bad})` : 'PASS'); process.exit(bad ? 1 : 0)
