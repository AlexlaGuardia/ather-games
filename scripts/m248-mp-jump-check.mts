// ── BETA M248 prod check: OTHERS JUMP (and show their real moves) IN MULTIPLAYER ─────────────────────────────────────────
// Two signed-in test keepers (dummy_m233_a / dummy_m233_b) in one party, in the Wilds (a party = a private instance, so the
// check never lands beside a real player). PROD ONLY (the game socket is behind the tunnel). PASS =
//   1. both live in the Wilds and each sees the other
//   2. A stands: B's view of A sits still (state ground)
//   3. A jumps (real Space): B's view of A RISES above where it stood (sampled drawn y, > 0.4 m) with a jump/fall state, and LANDS
//      (back within 0.15 m, state no longer in the air)
//   4. A sprints (W held): B sees 'sprint'
//   5. A punches (the 'Melee' key, the phone's hit button path): B sees 'punch'
//   6. 0 page errors
// The old-payload fallback (an old client = no state code = ground-snapped) is the unit test's job: mp-state.test.ts.
// Hooks READ only: __mp (status, zone, peers, shown, me). Desktop 1280x800.
//   npx tsx scripts/m248-mp-jump-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
if (!process.env.ATHER_SESSION_SECRET) {
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { upsertGoogleAccount, claimUsername } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'mj' + Math.random().toString(36).slice(2, 8)
const [KA, KB] = ['dummy_m233_a', 'dummy_m233_b'].map(n => {
  const a = upsertGoogleAccount(`dummy-m233-${n}`, null, null)
  if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}: ${JSON.stringify(c)}`) }
  return { id: a.user_id, name: n }
})
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
const mp = (p: Page, f: string) => p.evaluate((k: string) => (window as any).__mp?.[k]?.(), f)
type Peer = { id: string; name: string; y: number; ty: number; st: string | null }
const peerOf = async (p: Page, name: string) => (((await mp(p, 'peers')) ?? []) as Peer[]).find(q => q.name === name) ?? null
async function open(k: { id: string; name: string }): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(`${k.name}: ${String(e).slice(0, 180)}`))
  await p.setCookie({ name: 'ather_session', value: mintSession(k.id, k.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
  await p.evaluateOnNewDocument((s: any) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:mp:party', s.code)
    for (const pre of ['', `u:${s.id}:`]) {
      localStorage.setItem(`${pre}ather:mp:party`, s.code)
      localStorage.setItem(`${pre}open.tutorial.v1`, JSON.stringify(s.TUT))
      localStorage.setItem(`${pre}open.rinquest.v1`, JSON.stringify({ v: 1, state: 'done', step: 0 }))
    }
  }, { code: CODE, id: k.id, TUT } as any)
  return p
}
async function toWilds(p: Page, tag: string) {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await dismissStartCard(p).catch(() => {})
  ok(await poll(async () => (await mp(p, 'status')) === 'live' && (await mp(p, 'zone')) === 'open:wilds', 240000), `1. ${tag}: live in the Wilds`)
  await sleep(2000); await p.mouse.click(640, 400); await sleep(600)
}
/** B samples A's drawn figure every 30 ms in the page (one CDP read at the end, so the samples are not paced by the wire) */
const startSampling = (b: Page, name: string) => b.evaluate((n: string) => {
  const w = window as any; w.__m248 = []
  w.__m248t = setInterval(() => { const q = (w.__mp?.peers?.() ?? []).find((x: any) => x.name === n); if (q) w.__m248.push({ t: performance.now(), y: q.y, ty: q.ty, st: q.st, shown: w.__mp?.shown?.()?.[q.id] ?? null }) }, 30)
}, name)
const stopSampling = (b: Page) => b.evaluate(() => { const w = window as any; clearInterval(w.__m248t); return w.__m248 as { t: number; y: number; ty: number; st: string | null; shown: string | null }[] })
try {
  const a = await open(KA); await toWilds(a, 'A')
  const b = await open(KB); await toWilds(b, 'B')
  ok(await poll(async () => !!(await peerOf(b, KA.name)), 60000), '1. B sees A')
  ok(await poll(async () => !!(await peerOf(a, KB.name)), 60000), '1. A sees B')
  // 2 · A stands
  await sleep(2500)
  const s0 = await peerOf(b, KA.name)
  ok(s0 && s0.st === 'ground', `2. A standing: B reads state ${s0?.st} (y drawn ${Number(s0?.y).toFixed(2)}, sent ${Number(s0?.ty).toFixed(2)})`)
  const y0 = s0 ? s0.y : NaN
  // 3 · A jumps
  await startSampling(b, KA.name)
  let aPeak = -Infinity
  await a.keyboard.down('Space'); const t0 = Date.now()
  while (Date.now() - t0 < 250) { const m = await mp(a, 'me'); if (m) aPeak = Math.max(aPeak, m.y); await sleep(20) }
  await a.keyboard.up('Space')
  while (Date.now() - t0 < 2200) { const m = await mp(a, 'me'); if (m) aPeak = Math.max(aPeak, m.y); await sleep(40) }
  await sleep(800)
  const S = await stopSampling(b)
  const peak = Math.max(...S.map(s => s.y)), last = S[S.length - 1]
  const airSt = S.filter(s => s.st === 'jump' || s.st === 'fall').length, airShown = S.filter(s => s.shown === 'jump' || s.shown === 'fall').length
  console.log(`   A's own feet peak ${(aPeak - y0).toFixed(2)} m over the stand; B sampled ${S.length}, ${airSt} in the air`)
  ok(peak - y0 > 0.4, `3. B's view of A RISES: drawn peak ${(peak - y0).toFixed(2)} m above where A stood`)
  ok(airSt > 0 && airShown > 0, `3. with a jump/fall state, and posed in it (${airSt} samples heard, ${airShown} drawn)`)
  ok(last && Math.abs(last.y - y0) < 0.15 && last.st !== 'jump' && last.st !== 'fall', `3. and LANDS: back to ${(last.y - y0).toFixed(3)} m, state ${last.st}`)
  // 4 · A sprints
  await startSampling(b, KA.name)
  await a.keyboard.down('KeyW'); await sleep(2800); await a.keyboard.up('KeyW'); await sleep(600)
  const S2 = await stopSampling(b)
  ok(S2.some(s => s.st === 'sprint' && s.shown === 'sprint'), `4. A sprints: B sees 'sprint' (${S2.filter(s => s.st === 'sprint').length} samples)`)
  // 5 · A punches (the phone's hit button: a 'Melee' key)
  await sleep(800)
  await startSampling(b, KA.name)
  await a.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Melee' })))
  await sleep(1200)
  const S3 = await stopSampling(b)
  ok(S3.some(s => s.st === 'punch' && s.shown === 'punch'), `5. A punches: B sees 'punch' (${S3.filter(s => s.st === 'punch').length} samples)`)
  ok(errs.length === 0, `6. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS'); process.exit(fails ? 1 : 0)
