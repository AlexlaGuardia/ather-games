// M228b prod check: the Exchange is a LIVING MARKET. Orders FILL (resting price, oldest first), what a fill pays waits in the
//   CLAIM box at the counter, the form presets to the GUIDE price with 7-day stats under it, and ATHER TRADING CO. CLERKS keep a
//   small buy + sell on the basic goods, gone when the switch is off.
//   A. API: clerk orders sit on the basic goods; two test keepers' crossing orders fill ONCE (claims land, then are claimed).
//   B. Browser (--phone 390x844, else 1440x900): test keeper A at the counter picks Blankstone, sees the guide price + the stats
//      line, sells below the clerks' buy -> it trades at once, the Marks wait under Claim, Claim puts them in the purse.
//   C. (--switch) the switch: exchange_config clerks=off -> no clerk orders on the book; back on -> they return.
// ⚠ Writes the LIVE accounts db for the test keepers dummy_m228b_a / dummy_m228b_b only (their orders, claims and fills are wiped
//   at start and end). --switch takes the clerks off the live book for about a minute, then puts them back.
//   npx tsx scripts/m228b-market-check.mts [--phone] [--switch] [--url https://ather.games] [--out /tmp/m228b]
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
import { COUNTER, toWorld } from '../src/app/shimmer/open/ather/lingston'
import { CLERK_NAME, CLERK_ITEMS, CLAIM_MARKS } from '../src/app/shimmer/open/ather/exchange-market'
if (!process.env.ATHER_SESSION_SECRET) {
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { upsertGoogleAccount, claimUsername, accountsDb } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), SWITCH = process.argv.includes('--switch'), out = flag('--out', '/tmp/m228b') + (PHONE ? '-390' : '-desk')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }

const K = ['dummy_m228b_a', 'dummy_m228b_b'].map(n => {
  const a = upsertGoogleAccount(`dummy-m228b-${n}`, null, null)
  if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}: ${JSON.stringify(c)}`) }
  return { id: a.user_id, name: n, cookie: '' }
})
for (const k of K) k.cookie = `ather_session=${mintSession(k.id, k.name)}`
const [KA, KB] = K
const wipe = () => {
  const d = accountsDb()
  d.prepare('DELETE FROM exchange_orders WHERE user_id IN (?, ?)').run(KA.id, KB.id)
  d.prepare('DELETE FROM exchange_claims WHERE user_id IN (?, ?)').run(KA.id, KB.id)
  d.prepare('DELETE FROM exchange_fills WHERE buyer IN (?, ?) OR seller IN (?, ?)').run(KA.id, KB.id, KA.id, KB.id)
}
wipe()
type Row = { order_id: string; side: string; item: string; who: string; mine: boolean; n: number; price: number }
const api = async (k: { cookie: string } | null, body?: object, q = '') => {
  const r = await fetch(`${url}/api/exchange${q}`, body ? { method: 'POST', headers: { 'content-type': 'application/json', ...(k ? { cookie: k.cookie } : {}) }, body: JSON.stringify(body) } : { headers: k ? { cookie: k.cookie } : {} })
  return { status: r.status, j: await r.json() as any }
}
const clerkRows = (book: Row[]) => book.filter(r => r.who === CLERK_NAME)

// ── A. the API ──
{
  const g = await api(KA)
  const cr = clerkRows(g.j.book)
  const items = new Set(cr.map(r => r.item))
  ok(items.size >= 8 && [...items].every(i => CLERK_ITEMS.includes(i)) && cr.some(r => r.side === 'buy') && cr.some(r => r.side === 'sell'), `A1. Co. clerk orders sit on ${items.size} basic goods, both sides (${[...items].join(' ')})`)
  ok(cr.every(r => !r.mine && r.who === CLERK_NAME), 'A2. clerk rows show as "Co. clerk", never a keeper')
  const sA = await api(KA, { action: 'place', side: 'sell', item: 'moonkoi', n: 2, price: 41 })
  const bB = await api(KB, { action: 'place', side: 'buy', item: 'moonkoi', n: 2, price: 41 })
  ok(sA.status === 200 && (sA.j.order?.fills ?? []).length === 0, 'A3. test keeper A posts a sell (2 Moonkoi at 41)')
  const bf = bB.j.order?.fills ?? []
  const mine = bf.filter((f: any) => f.seller === KA.id)
  ok(bB.status === 200 && mine.length === 1 && mine[0].n === 2 && mine[0].price === 41, `A4. B's crossing buy fills A's sell at once (${JSON.stringify(bf)})`)
  const fillsAB = Number((accountsDb().prepare('SELECT COUNT(*) AS c FROM exchange_fills WHERE buyer = ? AND seller = ?').get(KB.id, KA.id) as { c: number }).c)
  const leftAB = (await api(KA)).j.book.filter((r: Row) => r.item === 'moonkoi' && (r.who === KA.name || r.who === KB.name))
  ok(fillsAB === 1 && leftAB.length === 0, `A5. the two crossing orders fill ONCE (fills ${fillsAB}, left on the book ${leftAB.length})`)
  const ca = (await api(KA)).j.claims, cb = (await api(KB)).j.claims
  ok(ca[CLAIM_MARKS] === 82 - 1 && cb.moonkoi === 2, `A6. claims: A ${JSON.stringify(ca)} (82 less the fee), B ${JSON.stringify(cb)}`)
  const t1 = await api(KB, { action: 'claim', item: 'moonkoi', n: 2 }), t2 = await api(KB, { action: 'claim', item: 'moonkoi', n: 2 })
  ok(t1.status === 200 && t1.j.claimed?.n === 2 && t2.status === 400, 'A7. B claims the 2 Moonkoi once; a second claim is refused')
  const st = await api(null, undefined, '?item=moonkoi')
  ok(st.j.market?.stats?.last === 41 && st.j.market.stats.volume >= 2 && typeof st.j.market.guide === 'number', `A8. the 7-day stats see the fill (${JSON.stringify(st.j.market)})`)
  const seed = await api(null, undefined, '?item=blankstone')
  ok(typeof seed.j.market?.guide === 'number' && seed.j.market.guide > 0, `A9. Blankstone has a guide price (${JSON.stringify(seed.j.market)})`)
}

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const ctx = await br.createBrowserContext(), p = await ctx.newPage()
  if (PHONE) await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  else await p.setViewport({ width: 1440, height: 900 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.setCookie({ name: 'ather_session', value: mintSession(KA.id, KA.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
  const BAG = { v: 1, slots: [{ id: 'blankstone', n: 20 }, ...Array(31).fill(null)], gifts: ['bait1'] }
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m228b-seeded')) return
    sessionStorage.setItem('m228b-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    localStorage.setItem('open.inv.v1', JSON.stringify(s.BAG))
  }, { TUT, BAG } as any)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 180000, polling: 1000 })
  await sleep(3000)
  try { await dismissStartCard(p) } catch (e) {
    await p.screenshot({ path: `${out}/x-start-card.png` })
    const near = await p.evaluate(() => { const el = [...document.querySelectorAll('div')].find(d => d.children.length === 0 && /^Tap to start$/i.test((d.textContent ?? '').trim())); if (!el) return 'none'; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return `card at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}; on top: <${top?.tagName} ${(top as HTMLElement)?.className ?? ''}> "${(top?.textContent ?? '').slice(0, 80)}"` })
    console.log(`start card: ${String(e).slice(0, 120)} · ${near}`)
    throw e
  }
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
  const front = toWorld(0, COUNTER.z + 1.5), ahead = toWorld(0, COUNTER.z - 2)
  const yaw = Math.atan2(-(ahead.x - front.x), -(ahead.z - front.z))
  for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: { id: 'm228', tile: 'first-wilds', x: front.x, y: 0, z: front.z, biome: 2, made: 0 } }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  ok((await A('zone')) === 'wilds', 'B2. the keeper is in the Wilds')
  await sleep(6000)
  await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { ...front, yaw }); await sleep(3000)
  let prompt = ''
  for (let i = 0; i < 20 && !/E · Exchange attendant/.test(prompt); i++) { await sleep(500); prompt = await p.evaluate(() => document.body.innerText) }
  ok(/E · Exchange attendant/.test(prompt), 'B3. at the counter the prompt reads "E · Exchange attendant"')
  await p.screenshot({ path: `${out}/a-hall.png` })
  await p.keyboard.press('KeyE'); await sleep(1500)
  const bubble = await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
  ok(/Exchange attendant/i.test(bubble), `B4. E speaks to a Moglin attendant (bubble: "${bubble.slice(0, 70)}")`)
  await p.screenshot({ path: `${out}/b-attendant.png` })
  await p.keyboard.press('Enter'); await sleep(2500)
  // the form: Blankstone, guide + stats
  await (await p.$('[data-x-tab="search"]'))!.click(); await sleep(500)
  await (await p.$('[data-x-search]'))!.type('blankst'); await sleep(600)
  await (await p.$('[data-x-pick="blankstone"]'))!.click(); await sleep(2500)
  const guide = await p.evaluate(() => Number((document.querySelector('[data-x-guide]') as HTMLElement | null)?.dataset.xGuide ?? 0))
  const priceVal = await p.evaluate(() => (document.querySelector('[data-x-price]') as HTMLInputElement | null)?.value ?? '')
  const statsTxt = await p.evaluate(() => (document.querySelector('[data-x-stats]') ?? document.querySelector('[data-x-stats-empty]'))?.textContent ?? '')
  ok(guide > 0 && priceVal === String(guide), `B5. the form presets to the guide price (guide ${guide}, field ${priceVal})`)
  ok(/7 days: high \d+ · low \d+ · last \d+ · \d+ traded|No trades in the last 7 days/.test(statsTxt), `B6. 7-day stats under the form ("${statsTxt}")`)
  await p.evaluate(() => document.querySelector('[data-x-form]')?.scrollIntoView({ block: 'center' }))
  await p.screenshot({ path: `${out}/c-form-guide.png` })
  const marks = () => p.evaluate(() => Number(((document.querySelector('[data-x-form]')?.textContent ?? '').match(/· ([\d,]+) Marks/)?.[1] ?? '-1').replace(/,/g, '')))
  const setField = async (sel: string, v: string) => { await p.focus(sel); for (let i = 0; i < 8; i++) await p.keyboard.press('Backspace'); await p.type(sel, v) }
  await (await p.$('[data-x-side="sell"]'))!.click(); await setField('[data-x-n]', '3'); await setField('[data-x-price]', '2')
  await (await p.$('[data-x-place]'))!.click(); await sleep(2500)
  const msg1 = await p.evaluate(() => document.querySelector('[data-x-msg]')?.textContent ?? '')
  const claimRow = await p.evaluate((m: string) => (document.querySelector(`[data-x-claim-row="${m}"]`)?.textContent ?? ''), CLAIM_MARKS)
  ok(/traded at once/.test(msg1) && /Marks/.test(claimRow), `B7. a sell below the clerks' buy trades at once; the Marks wait under Claim (${msg1} | ${claimRow})`)
  const fillC = accountsDb().prepare("SELECT buyer, n, price FROM exchange_fills WHERE seller = ? AND item = 'blankstone' ORDER BY at DESC LIMIT 1").get(KA.id) as { buyer: string; n: number; price: number } | undefined
  ok(fillC?.buyer === 'co:clerk' && fillC.price > 2, `B8. it filled a Co. clerk buy at the clerk's price (${JSON.stringify(fillC)})`)
  await p.screenshot({ path: `${out}/d-claim.png` })
  const m0 = await marks()
  const want = Number(claimRow.replace(/[^\d]/g, ''))
  await (await p.$(`[data-x-claim="${CLAIM_MARKS}"]`))!.click(); await sleep(2000)
  // the form's purse line lives on the search tab; read the purse after the claim from it
  const gone = !(await p.$(`[data-x-claim-row="${CLAIM_MARKS}"]`))
  const msg2 = await p.evaluate(() => document.querySelector('[data-x-msg]')?.textContent ?? '')
  await p.screenshot({ path: `${out}/e-claimed.png` })
  await (await p.$('[data-x-tab="search"]'))!.click(); await sleep(400)
  if (await p.$('[data-x-pick="blankstone"]')) { await (await p.$('[data-x-pick="blankstone"]'))!.click(); await sleep(1500) }
  const m1 = await marks()
  ok(gone && /Claimed/.test(msg2) && want > 0 && (m0 < 0 || m1 === m0 + want), `B9. Claim puts the Marks in the purse (${msg2}; purse ${m0} -> ${m1}, +${want})`)
  const left = (await api(KA)).j.claims
  ok(!left[CLAIM_MARKS], `B10. the claim box is empty after (${JSON.stringify(left)})`)
  ok(errs.length === 0, `B11. no page errors (${errs.slice(0, 2).join(' | ')})`)
} finally {
  await br.close()
}

// ── C. the switch ──
if (SWITCH) {
  const d = accountsDb()
  const prev = d.prepare("SELECT value FROM exchange_config WHERE key = 'clerks'").get() as { value: string } | undefined
  d.prepare("INSERT INTO exchange_config (key, value) VALUES ('clerks', 'off') ON CONFLICT(key) DO UPDATE SET value = 'off'").run()
  let n = -1
  for (let i = 0; i < 20 && n !== 0; i++) { await sleep(6000); n = clerkRows((await api(null)).j.book).length }
  ok(n === 0, `C1. switch off: no clerk orders on the book (${n})`)
  if (prev) d.prepare("UPDATE exchange_config SET value = ? WHERE key = 'clerks'").run(prev.value); else d.prepare("DELETE FROM exchange_config WHERE key = 'clerks'").run()
  for (let i = 0; i < 20 && n === 0; i++) { await sleep(6000); n = clerkRows((await api(null)).j.book).length }
  ok(n > 0, `C2. switch back on: the clerks return (${n})`)
}
wipe()
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
