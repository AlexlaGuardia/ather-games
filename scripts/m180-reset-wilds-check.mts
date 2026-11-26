// ── BETA M180: the owner's Reset Wilds, proven on prod with a TEST keeper only (dummy_fern, a cluster dummy) ──────────────
// Run on the box that holds OWNER_KEY + ATHER_SESSION_SECRET (they are read from the environment, never printed):
//   OWNER_KEY=... ATHER_SESSION_SECRET=... npx tsx scripts/m180-reset-wilds-check.mts [--url https://ather.games] [--user dummy_fern]
// 1 · a phone (390x844) opens the open world as the test keeper; the game writes its save and the cloud pushes it.
// 2 · the tool side (the save API, as the keeper) plants OLD Wilds: marker ids in the spread ledger, the map, the infection.
// 3 · a second phone opens the page: it adopts that save (the marker is in its localStorage) and stays OPEN.
// 4 · a non-owner (the keeper's own session, no owner cookie) gets 403; then the OWNER resets the keeper's Wilds.
// 5 · server: the five Wilds keys gone, rev bumped, every other garden key + the keepers (the bag) byte-identical.
// 6 · the open page cannot write back: 40 s later, and after a reload (its pagehide beacon), the server has no marker;
//     after the reload the page holds a newborn's Wilds (no marker) and fog, waymarks, garden, bag equal the reset save.
// 7 · cluster: every OTHER account's save and the cluster tables are unchanged (read-only sqlite on this box, if present).
import puppeteer, { type Page, type Browser } from 'puppeteer-core'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { signJwt, SESSION_COOKIE, SESSION_TTL_SEC } from '../src/lib/accounts/session'
import { newFog } from '../src/app/shimmer/open/ather/explored'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const URL_ = flag('--url', 'https://ather.games'), USER = flag('--user', 'dummy_fern')
const OWNER = process.env.OWNER_KEY, SECRET = process.env.ATHER_SESSION_SECRET
if (!OWNER || !SECRET) { console.log('FAIL need OWNER_KEY + ATHER_SESSION_SECRET'); process.exit(1) }
if (!/^dummy_/.test(USER)) { console.log('FAIL this check only ever runs on a dummy_ test keeper'); process.exit(1) }
const DB = '/root/ather-games/data/accounts.db'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const WILDS = ['ather.nodes.v2', 'ather.nodes.skew', 'ather.spreadmap.v1', 'ather.infection.v1', 'ather.infection-told.v1']
const MARK = 'm180-marker'
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12)

// the keeper's id (read-only)
const ro = existsSync(DB) ? new DatabaseSync(DB, { readOnly: true }) : null
const acct = ro?.prepare('SELECT user_id, username FROM accounts WHERE username = ?').get(USER) as { user_id: string; username: string } | undefined
if (!acct) { console.log(`FAIL no account ${USER} in ${DB}`); process.exit(1) }
const now = Math.floor(Date.now() / 1000)
const jwt = signJwt({ user_id: acct.user_id, username: acct.username, iat: now, exp: now + SESSION_TTL_SEC }, SECRET)
const H = { 'content-type': 'application/json', origin: URL_ }
const asKeeper = (path: string, body?: unknown) => fetch(URL_ + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...H, cookie: `${SESSION_COOKIE}=${jwt}` }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
const asOwner = (body: unknown) => fetch(URL_ + '/api/owner/reset-wilds', { method: 'POST', headers: { ...H, cookie: `ather_owner=${OWNER}` }, body: JSON.stringify(body) })
type Doc = { garden: { keys: Record<string, string> }; keepers: { id: string; keys: Record<string, string> }[]; [k: string]: unknown }
const serverDoc = async () => { const j = await (await asKeeper('/api/saves/open')).json() as { doc: Doc | null; rev: number }; return j }
const others = () => ro ? sha(JSON.stringify([
  ro.prepare("SELECT s.user_id, s.game, s.rev, s.data FROM saves s JOIN accounts a ON a.user_id = s.user_id WHERE s.user_id != ? AND a.username LIKE 'dummy\\_%' ESCAPE '\\' ORDER BY s.user_id, s.game").all(acct.user_id),
  ro.prepare('SELECT * FROM cluster_members ORDER BY user_id').all(), ro.prepare('SELECT user_id, data FROM cluster_gardens WHERE user_id != ? ORDER BY user_id').all(acct.user_id)]))   // the keeper's own snapshot is the game's upload : 'no-db'

const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const br: Browser = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS })
const errsOf = new Map<Page, string[]>()
async function phone(): Promise<Page> {
  const ctx = await br.createBrowserContext(), p = await ctx.newPage()
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  const host = new URL(URL_).hostname
  await p.setCookie({ name: SESSION_COOKIE, value: jwt, domain: host, path: '/', httpOnly: true, secure: URL_.startsWith('https'), sameSite: 'Lax' })
  const errs: string[] = []; errsOf.set(p, errs); p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
  return p
}
const cloud = (p: Page) => p.evaluate(() => { const s = (window as any).__openCloud?.state?.(); return s ? { mode: s.mode as string, owner: s.owner as string | null, rev: s.rec?.rev as number | undefined } : null }).catch(() => null)
async function openWorld(p: Page) {
  await p.goto(`${URL_}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }).catch(() => {})
}
async function waitLive(p: Page, ms: number) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { const c = await cloud(p); if (c?.mode === 'live' && c.rev !== undefined) return c; await sleep(2000) }
  return cloud(p)
}
const local = (p: Page) => p.evaluate((owner: string) => { const o: Record<string, string> = {}; const pre = `u:${owner}:`; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith(pre)) o[k.slice(pre.length)] = localStorage.getItem(k)! } return o }, acct.user_id)

try {
  const othersBefore = others()
  // 1 · the game writes a real save
  const p1 = await phone(); await openWorld(p1)
  const c1 = await waitLive(p1, 120000)
  let s = await serverDoc()
  for (let i = 0; i < 25 && !s.doc; i++) { await sleep(5000); s = await serverDoc() }
  ok(!!s.doc && s.rev >= 1, `1 the page saved the test keeper (mode ${c1?.mode}, rev ${s.rev}, ${Object.keys(s.doc?.garden.keys ?? {}).length} garden keys)`)
  await p1.browserContext().close()
  if (!s.doc) throw new Error('no save to work on')

  // 2 · plant OLD Wilds through the save API (as the keeper, on its own device)
  const lease = await (await asKeeper('/api/saves/open/lease', { device: 'm180-tool' })).json() as { doc: Doc; rev: number }
  const d = lease.doc, g = d.garden.keys
  const spread = (() => { try { return JSON.parse(g['ather.nodes.v2'] ?? 'null') } catch { return null } })() ?? { v: 2, epoch: Date.now() - 864e5, at: Date.now() - 864e5, clean: [] }
  g['ather.nodes.v2'] = JSON.stringify({ ...spread, clean: [...new Set([...(spread.clean ?? []), MARK])].sort() })
  g['ather.nodes.skew'] = String(3 * 864e5)
  const map = (() => { try { return JSON.parse(g['ather.spreadmap.v1'] ?? 'null') } catch { return null } })() ?? { v: 1, seen: {}, first: true, grey: {} }
  g['ather.spreadmap.v1'] = JSON.stringify({ ...map, seen: { ...map.seen, [MARK]: Date.now() - 864e5 }, grey: { ...map.grey, [MARK]: Date.now() - 864e5 } })
  // the infection (M128) + its tell, with the marker; fog + a waymark the reset must keep (far corner bits: a keeper
  // standing in the garden never uncovers them)
  g['ather.infection.v1'] = JSON.stringify({ v: 1, season: 0, next: null, active: null, saved: [], lost: [MARK], told: 1, assigned: 1 })
  g['ather.infection-told.v1'] = JSON.stringify({ v: 1, season: 0, said: [MARK], clueOf: {}, met: [], heard: [1], open: true })
  if (!g['ather.fog.v2']) { const f = newFog(); for (let k = f.bits.length - 64; k < f.bits.length; k++) f.bits[k] = 0xa5; let b = ''; for (let k = 0; k < f.bits.length; k += 8192) b += String.fromCharCode(...f.bits.subarray(k, k + 8192)); g['ather.fog.v2'] = Buffer.from(b, 'latin1').toString('base64') }
  if (!g['ather.waymarks.v1'] || g['ather.waymarks.v1'] === '[]') g['ather.waymarks.v1'] = JSON.stringify([{ id: 'wm-m180-test', tile: 'first-wilds', x: 1, z: 1, biome: 'meadow', made: Date.now() }])
  const planted = await asKeeper('/api/saves/open', { base_rev: lease.rev, device: 'm180-tool', doc: d })
  ok(planted.ok, `2 old Wilds planted (marker in the ledger, map, infection, tell; skew 3 days) + fog + a waymark: ${planted.status}`)

  // 3 · a phone opens the page: adopts the save, holds the marker, stays OPEN
  const p2 = await phone(); await openWorld(p2)
  const c2 = await waitLive(p2, 150000)
  const l2 = await local(p2)
  ok(c2?.mode === 'live' && (l2['ather.nodes.v2'] ?? '').includes(MARK), `3 the open page adopted the old Wilds (mode ${c2?.mode}, rev ${c2?.rev}, marker ${(l2['ather.nodes.v2'] ?? '').includes(MARK)})`)

  // 4 · non-owner 403, then the owner's reset (dry run first, the panel's confirm)
  const no = await fetch(URL_ + '/api/owner/reset-wilds', { method: 'POST', headers: { ...H, cookie: `${SESSION_COOKIE}=${jwt}` }, body: JSON.stringify({ username: USER }) })
  ok(no.status === 403, `4 a non-owner gets ${no.status}`)
  let pre: { doc: Doc | null; rev: number } = { doc: null, rev: 0 }, res: { rev?: number; removed?: string[] } = {}
  for (let t = 0; t < 4; t++) {                                  // the open page may push between our read and the reset: retry until clean
    pre = await serverDoc()
    const dry = await (await asOwner({ username: USER, dry: true })).json() as { rev: number; removed: string[] }
    if (dry.rev !== pre.rev) continue
    res = await (await asOwner({ username: USER })).json()
    if (res.rev === pre.rev + 1) break
  }
  const post = await serverDoc()
  ok(res.rev === pre.rev + 1 && post.rev === res.rev && res.removed?.length === 5, `4 owner reset: rev ${pre.rev} -> ${res.rev}, removed ${JSON.stringify(res.removed)}`)
  // 5 · server: Wilds gone, the rest byte-identical
  const pg = pre.doc!.garden.keys, qg = post.doc!.garden.keys
  ok(WILDS.every(k => !(k in qg)), `5 server: no Wilds key left (${WILDS.filter(k => k in qg).join(',') || 'none'})`)
  const kept = Object.keys(pg).filter(k => !WILDS.includes(k))
  ok(kept.length === Object.keys(qg).length && kept.every(k => pg[k] === qg[k]), `5 server: the other ${kept.length} garden keys byte-identical (fog ${sha(pg['ather.fog.v2'] ?? '')}, waymarks ${sha(pg['ather.waymarks.v1'] ?? '')}, garden ${sha(pg['ather.garden.v1'] ?? '')})`)
  ok(JSON.stringify(pre.doc!.keepers) === JSON.stringify(post.doc!.keepers), `5 server: the keepers (bag ${sha(pre.doc!.keepers[0]?.keys['open.inv.v1'] ?? '')}) byte-identical`)

  // 6 · no write-back from the open page
  await sleep(40000)
  const c6 = await cloud(p2), s6 = await serverDoc()
  ok(!JSON.stringify(s6.doc!.garden.keys).includes(MARK), `6 40 s on, the open page wrote nothing back (page mode ${c6?.mode}, server rev ${s6.rev})`)
  await p2.reload({ waitUntil: 'load', timeout: 240000 })        // its pagehide beacon goes with the old rev; then boot adopts
  await p2.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }).catch(() => {})
  const c6b = await waitLive(p2, 150000)
  const l6 = await local(p2), s6b = await serverDoc()
  ok(!JSON.stringify(s6b.doc!.garden.keys).includes(MARK), `6 after the reload (beacon + boot) the server still has no old Wilds (rev ${s6b.rev})`)
  ok(c6b?.mode === 'live' && WILDS.every(k => !(l6[k] ?? '').includes(MARK)), `6 the page now holds a newborn's Wilds: no marker (mode ${c6b?.mode}; nodes ${sha(l6['ather.nodes.v2'] ?? '')}, clean ${(() => { try { return JSON.parse(l6['ather.nodes.v2']).clean.length } catch { return 'none' } })()}, skew ${l6['ather.nodes.skew'] ?? 'none'})`)
  for (const k of ['ather.fog.v2', 'ather.waymarks.v1', 'ather.garden.v1']) ok(l6[k] === qg[k], `6 page ${k} equals the reset save (${sha(l6[k] ?? '')} / ${sha(qg[k] ?? '')})`)
  ok((l6['open.inv.v1'] ?? null) === (post.doc!.keepers[0]?.keys['open.inv.v1'] ?? null), `6 page bag equals the reset save (${sha(l6['open.inv.v1'] ?? '')})`)
  ok((errsOf.get(p2) ?? []).length === 0, `6 0 page errors ${JSON.stringify(errsOf.get(p2) ?? [])}`)
  await p2.browserContext().close()

  // 7 · nobody else moved
  ok(others() === othersBefore, `7 the other dummies' saves + the cluster tables (members, gardens) unchanged; real players' saves are not read (${othersBefore})`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
