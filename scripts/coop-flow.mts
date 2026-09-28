/**
 * coop-flow.mts — CO-OP BREACH end to end on the live site (2026-09-28): two signed-in keepers join one party by
 * link, each talks to the Station clerk, both Launch together, and both pages then show the SAME fight streamed
 * from breach-server (same party room, same round, the same flood). Owner-gated today (the Breach is the season
 * proof), so both contexts carry the owner cookie as well as their own session.
 *
 *   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/coop-flow.mts
 */
import puppeteer, { type Page } from 'puppeteer-core'
import { mintSession } from '../src/lib/accounts/session'

const ORIGIN = process.env.COOP_ORIGIN ?? 'https://ather.games'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const PARTY = 'CO' + Math.random().toString(36).slice(2, 6).toUpperCase()
const A = { id: 'u_156700d4312d118944', name: 'dummy_fern' }
const B = { id: 'u_986fb228a294e6720d', name: 'dummy_moss' }
let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l); console.log(`${c ? '✓' : '✗'} ${l}`) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('needs OWNER_KEY (set -a; . .env; set +a)'); process.exit(2) }

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'],
})
async function keeper(who: { id: string; name: string }): Promise<Page> {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  await page.setCookie({ name: 'ather_session', value: mintSession(who.id, who.name), domain: new URL(ORIGIN).hostname, path: '/', httpOnly: true })
  await page.evaluateOnNewDocument((id: string) => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem(`u:${id}:ather:shimmer:birthRune`, 'barrier')
    localStorage.setItem(`u:${id}:ather:shimmer:runes`, JSON.stringify(['barrier']))
  }, who.id)
  await page.goto(`${ORIGIN}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.goto(`${ORIGIN}/shimmer/play3d?party=${PARTY}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  return page
}
const coopOf = (p: Page) => p.evaluate(() => (window as unknown as { __coop?: () => any }).__coop?.() ?? null)
async function toBoard(p: Page) {
  await p.evaluate(() => (window as any).__goZone('travelers-station'))
  await sleep(6000)
  const talked = await p.evaluate(() => (window as any).__talk('station-clerk'))
  await sleep(1200)
  const board = await p.evaluate(() => document.querySelector('[data-panel=departures]')?.textContent?.replace(/\s+/g, ' ') ?? '')
  return { talked, board }
}
const clickLaunch = (p: Page) => p.evaluate(() => {
  const b = [...document.querySelectorAll('[data-panel=departures] button')].find(x => /Launch together/.test(x.textContent ?? '')) as HTMLButtonElement | undefined
  if (b && !b.disabled) { b.click(); return true }
  return false
})

try {
  const pa = await keeper(A), pb = await keeper(B)
  await sleep(18000)
  // both walk to the clerk first, then launch within a second of each other (a keeper left standing alone on the
  // roof while a friend is still at the Station gets killed, and a party whose every present keeper is down is over)
  const [la, lb] = [await toBoard(pa), await toBoard(pb)]
  ok(la.talked && /Go together/.test(la.board) && /your party, into one Breach/.test(la.board), `A's board offers Go together for the Breach (party ${PARTY})`)
  ok(lb.talked && /your party, into one Breach/.test(lb.board), "B's board too")
  ok(await clickLaunch(pa), 'A launches together')
  ok(await clickLaunch(pb), 'B launches together')
  await sleep(9000)    // both in the Breach, snapshots flowing, the first round climbing in
  const ca = await coopOf(pa), cb = await coopOf(pb)
  console.log('  A:', JSON.stringify(ca)?.slice(0, 220))
  console.log('  B:', JSON.stringify(cb)?.slice(0, 220))
  ok(ca?.zone === 'the-hold' && cb?.zone === 'the-hold', 'both keepers are in the Breach')
  ok(ca?.code === PARTY && cb?.code === PARTY && ca?.status === 'live' && cb?.status === 'live', `★ both pages are live on the party's server fight (${PARTY})`)
  ok(ca?.party?.length === 2 && cb?.party?.length === 2, `★ the server has both keepers in one Breach (${ca?.party?.join(' + ')})`)
  ok(ca?.round === cb?.round, `the same round on both pages (${ca?.round})`)
  ok(ca?.salvage === 500 && cb?.salvage === 500, 'each keeper starts with their own 500 salvage')
  // a second look deeper into the round, when more of the flood is in (one shared body proves little)
  await sleep(7000)
  const da = await coopOf(pa), db = await coopOf(pb)
  const sa2 = new Set<number>(da?.flood ?? []), common2 = (db?.flood ?? []).filter((id: number) => sa2.has(id)).length
  const total2 = Math.max(sa2.size, (db?.flood ?? []).length)
  console.log(`  later: A ${JSON.stringify(da?.flood)} · B ${JSON.stringify(db?.flood)}`)
  ok(total2 >= 3 && common2 / total2 >= 0.8, `★★ deeper into the round, still ONE flood (${common2} of ${total2} bodies on both pages)`)
} finally {
  await browser.close()
}
console.log(`coop-flow: ${pass} passed, ${fails.length} failed`)
process.exit(fails.length ? 1 : 0)
