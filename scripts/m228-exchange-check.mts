// M228 s1 prod check: Lingston's trade hall (the Grand Exchange) at its stand-in spot in the Wilds.
//   A test keeper walks to the counter, speaks to a Moglin attendant with E, sees the current offers (one posted by keeper B),
//   searches an item, places a SELL and a BUY order (the goods / Marks leave the save); keeper B then sees both in the ONE book.
//   The Citadel has no Grand Exchange door (the shipped doors code). Run: --phone (390x844) and without (1440x900).
// ⚠ Writes the LIVE accounts db for the two test keepers only (dummy_m228_a / dummy_m228_b): run from the repo root, on the box.
//   Cleanup: every order those two hold is deleted at the start and at the end.
//   M228b: orders now FILL and Co. clerks quote the basic goods, so A's plank sell is priced ABOVE the clerks' buy (99, not 7)
//   to stay a resting order; the fill path has its own check (m228b-market-check.mts).
//   npx tsx scripts/m228-exchange-check.mts [--phone] [--url https://ather.games] [--out /tmp/m228]
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { gunzipSync } from 'zlib'
import { dismissStartCard } from './lib/start-card.mts'
import { LINGSTON, COUNTER, toWorld } from '../src/app/shimmer/open/ather/lingston'
if (!process.env.ATHER_SESSION_SECRET) {   // the same secret prod signs with (else a minted cookie reads as signed out)
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { upsertGoogleAccount, claimUsername, accountsDb } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')
const X = await import('../src/lib/accounts/exchange')

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), out = flag('--out', '/tmp/m228') + (PHONE ? '-390' : '-desk')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }

const K = ['dummy_m228_a', 'dummy_m228_b'].map(n => {
  const a = upsertGoogleAccount(`dummy-m228-${n}`, null, null)
  if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}: ${JSON.stringify(c)}`) }
  return { id: a.user_id, name: n }
})
const [KA, KB] = K
const wipe = () => accountsDb().prepare(`DELETE FROM exchange_orders WHERE user_id IN (?, ?)`).run(KA.id, KB.id)
wipe()
// keeper B already has an offer on the book, so A has something to see on arrival
const pB = X.placeOrder(KB.id, { side: 'sell', item: 'moonkoi', n: 4, price: 33 })
ok(pB.ok, '0. keeper B posts a sell offer (4 Moonkoi at 33)')

// the Citadel: no Grand Exchange door in the shipped doors code (the same module the continent page reads)
{
  const { makeRegion } = await import('../src/app/shimmer/open/region')
  const { doorsCached } = await import('../src/app/shimmer/open/business/doors')
  const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8'))
  const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
  const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
  const cit = doorsCached(R, 'citadel')
  ok(!cit.some(d => /exchange/i.test(d.key) || /exchange/i.test(d.name)) && cit.some(d => d.key === 'front:trade-co'), `1. the Citadel shows no Exchange door; the Co. office stays (${cit.length} doors)`)
}

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const ctx = await br.createBrowserContext(), p = await ctx.newPage()
  if (PHONE) await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  else await p.setViewport({ width: 1440, height: 900 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.setCookie({ name: 'ather_session', value: mintSession(KA.id, KA.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
  const BAG = { v: 1, slots: [{ id: 'goldwood_plank', n: 20 }, ...Array(31).fill(null)], gifts: ['bait1'] }
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m228-seeded')) return
    sessionStorage.setItem('m228-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    localStorage.setItem('open.inv.v1', JSON.stringify(s.BAG))
  }, { TUT, BAG } as any)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 180000, polling: 1000 })
  await sleep(3000); await dismissStartCard(p)
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
  const front = toWorld(0, COUNTER.z + 1.5), ahead = toWorld(0, COUNTER.z - 2)
  const yaw = Math.atan2(-(ahead.x - front.x), -(ahead.z - front.z))
  for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: { id: 'm228', tile: 'first-wilds', x: front.x, y: 0, z: front.z, biome: 2, made: 0 } }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  ok((await A('zone')) === 'wilds', '2. the keeper is in the Wilds')
  await sleep(6000)
  await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { ...front, yaw }); await sleep(3000)
  let prompt = ''
  for (let i = 0; i < 20 && !/E · Exchange attendant/.test(prompt); i++) { await sleep(500); prompt = await p.evaluate(() => document.body.innerText) }
  ok(/E · Exchange attendant/.test(prompt), '3. at the counter the prompt reads "E · Exchange attendant"')
  await p.screenshot({ path: `${out}/a-hall.png` })
  await p.keyboard.press('KeyE'); await sleep(1500)
  const bubble = await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
  ok(/Exchange attendant/i.test(bubble), `4. E speaks to a Moglin attendant (bubble: "${bubble.slice(0, 70)}")`)
  await p.screenshot({ path: `${out}/b-attendant.png` })
  await p.keyboard.press('Enter'); await sleep(2500)
  const rows = async () => p.evaluate(() => [...document.querySelectorAll('[data-panel="exchange"] [data-x-row]')].map(r => { const d = (r as HTMLElement).dataset; return `${d.side}:${d.item}:${d.mine}` }))
  let offers: string[] = []
  for (let i = 0; i < 20 && !offers.length; i++) { await sleep(500); offers = await rows() }
  ok(!!(await p.$('[data-panel="exchange"]')) && offers.includes('sell:moonkoi:0'), `5. the panel shows the current offers, B's included (${offers.join(' ')})`)
  await p.screenshot({ path: `${out}/c-offers.png` })
  await (await p.$('[data-x-tab="search"]'))!.click(); await sleep(500)
  await (await p.$('[data-x-search]'))!.type('goldwood pl'); await sleep(600)
  const picks = await p.evaluate(() => [...document.querySelectorAll('[data-x-pick]')].map(b => (b as HTMLElement).dataset.xPick))
  ok(picks.includes('goldwood_plank'), `6. search "goldwood pl" finds Goldwood Plank (${picks.join(', ')})`)
  await (await p.$('[data-x-pick="goldwood_plank"]'))!.click(); await sleep(600)
  await p.screenshot({ path: `${out}/d-search.png` })
  const setField = async (sel: string, v: string) => { await p.focus(sel); for (let i = 0; i < 8; i++) await p.keyboard.press('Backspace'); await p.type(sel, v) }
  // the bag as the panel reads it (the save key is per keeper): "you have N"
  const bagPlanks = () => p.evaluate(() => Number((document.querySelector('[data-x-form]')?.textContent ?? '').match(/you have (\d+)/)?.[1] ?? -1))
  const before = await bagPlanks()
  await (await p.$('[data-x-side="sell"]'))!.click(); await setField('[data-x-n]', '3'); await setField('[data-x-price]', '99')
  await (await p.$('[data-x-place]'))!.click(); await sleep(2500)
  const msg1 = await p.evaluate(() => document.querySelector('[data-x-msg]')?.textContent ?? '')
  ok(/Sell order placed/.test(msg1) && (await bagPlanks()) === before - 3, `7. a SELL order is placed and its 3 planks leave the bag (${msg1}; bag ${before} -> ${await bagPlanks()})`)
  await (await p.$('[data-x-tab="search"]'))!.click(); await sleep(400)
  await (await p.$('[data-x-search]'))!.type(' '); await sleep(300)
  if (await p.$('[data-x-pick="goldwood_plank"]')) await (await p.$('[data-x-pick="goldwood_plank"]'))!.click(); await sleep(500)
  await (await p.$('[data-x-side="buy"]'))!.click(); await setField('[data-x-n]', '2'); await setField('[data-x-price]', '5')
  await (await p.$('[data-x-place]'))!.click(); await sleep(2500)
  const msg2 = await p.evaluate(() => document.querySelector('[data-x-msg]')?.textContent ?? '')
  ok(/Buy order placed/.test(msg2), `8. a BUY order is placed (${msg2})`)
  const mine = await rows()
  ok(mine.includes('sell:goldwood_plank:1') && mine.includes('buy:goldwood_plank:1'), `9. "Your orders" lists both (${mine.join(' ')})`)
  await p.screenshot({ path: `${out}/e-orders.png` })
  // keeper B reads the ONE book with B's own session
  const bBook = await (await fetch(`${url}/api/exchange`, { headers: { cookie: `ather_session=${mintSession(KB.id, KB.name)}` } })).json() as { book: { side: string; item: string; who: string; mine: boolean; n: number; price: number }[] }
  const seen = bBook.book.filter(r => r.who === KA.name && r.item === 'goldwood_plank' && !r.mine)
  ok(seen.some(r => r.side === 'sell' && r.n === 3 && r.price === 99) && seen.some(r => r.side === 'buy' && r.n === 2 && r.price === 5), `10. keeper B sees A's sell (3 at 99) and buy (2 at 5) in the shared book`)
  ok(errs.length === 0, `11. no page errors (${errs.slice(0, 2).join(' | ')})`)
} finally {
  await br.close()
  wipe()
}
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
