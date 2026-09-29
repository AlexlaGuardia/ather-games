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
/** poll `f` until it returns true (up to `secs`): two software-GL pages on one box can lag a snapshot or two */
async function until(f: () => Promise<boolean>, secs = 15): Promise<boolean> {
  for (let t = 0; t < secs * 4; t++) { if (await f()) return true; await sleep(250) }
  return false
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
  // ★ THE LOBBY (09-29): both at the clerk; A arrived first so A LEADS. B readies; A's one Launch takes BOTH aboard.
  const [la, lb] = [await toBoard(pa), await toBoard(pb)]
  // whoever's lobby socket connected first leads; the other is the mate (pages load in parallel, so ask, never assume)
  const aLeads = /you lead/.test(la.board)
  const [lead, mate, leadBoard, mateBoard, mateName] = aLeads ? [pa, pb, la, lb, B.name] : [pb, pa, lb, la, A.name]
  ok(la.talked && lb.talked && /you lead/.test(leadBoard.board) && /Launch together/.test(leadBoard.board), `one leads with Launch together (party ${PARTY}, ${aLeads ? A.name : B.name} leads)`)
  ok(/the leader picks/.test(mateBoard.board) && /Ready/.test(mateBoard.board), "the mate's lobby: the leader picks, Ready")
  const rosterA = await lead.evaluate(() => document.querySelector('[data-roster]')?.textContent ?? '')
  ok(rosterA.includes(A.name) && rosterA.includes(B.name), `one roster (${rosterA.replace(/\s+/g, ' ').slice(0, 80)})`)
  ok(!(await clickLaunch(lead)), "the leader cannot launch while the mate isn't ready")
  const readied = await mate.evaluate(() => { const b = [...document.querySelectorAll('[data-panel=departures] button')].find(x => /^Ready$/.test(x.textContent ?? '')) as HTMLButtonElement | undefined; b?.click(); return !!b })
  ok(readied, 'the mate readies')
  ok(await until(async () => clickLaunch(lead), 6), '★ the leader launches for the party once the mate is ready')
  await sleep(9000)    // both in the Breach, snapshots flowing, the first round climbing in
  let ca: any = null, cb: any = null
  const both = await until(async () => {
    ca = await coopOf(pa); cb = await coopOf(pb)
    return ca?.status === 'live' && cb?.status === 'live' && ca?.party?.length === 2 && cb?.party?.length === 2
  })
  console.log('  A:', JSON.stringify(ca)?.slice(0, 220))
  console.log('  B:', JSON.stringify(cb)?.slice(0, 220))
  ok(ca?.zone === 'the-hold' && cb?.zone === 'the-hold', 'both keepers are in the Breach')
  ok(both && ca?.code === PARTY && cb?.code === PARTY, `★ both pages are live on the party's server fight (${PARTY}), both keepers in it (${ca?.party?.join(' + ')})`)
  ok(ca?.round === cb?.round, `the same round on both pages (${ca?.round})`)
  ok(ca?.salvage === 500 && cb?.salvage === 500, 'each keeper starts with their own 500 salvage')
  // a second look deeper into the round, when more of the flood is in (one shared body proves little)
  await sleep(5000)
  let da: any = null, db: any = null, common2 = 0, total2 = 0
  await until(async () => {
    da = await coopOf(pa); db = await coopOf(pb)
    const sa2 = new Set<number>(da?.flood ?? [])
    common2 = (db?.flood ?? []).filter((id: number) => sa2.has(id)).length; total2 = Math.max(sa2.size, (db?.flood ?? []).length)
    return total2 >= 3 && common2 === total2
  })
  console.log(`  later: A ${JSON.stringify(da?.flood)} · B ${JSON.stringify(db?.flood)}`)
  ok(total2 >= 3 && common2 === total2, `★★ deeper into the round, ONE flood (${common2} of ${total2} bodies, the same ids on both pages)`)

  // ── down, then over: idle keepers are killed by the flood. A downed keeper watches under a banner; the run ends
  //    only when both are down. (Both start on one spot, so they usually fall together: the banner is checked on
  //    either page, not staggered.)
  // stage it: B goes down to the lobby, well away from the roof where the first round climbs in on A
  const jumped = await pb.evaluate(() => (window as any).__holdJump?.('Lobby') ?? false)
  ok(jumped, 'B moves down to the lobby (A stays on the roof)')
  let sawWatching = false, overBoth = false
  for (let t = 0; t < 360 && !overBoth; t++) {
    await sleep(250)
    const [wa, wb] = await Promise.all([pa, pb].map(p => p.evaluate(() => !!document.querySelector('[data-coop-down]'))))
    if (wa !== wb && !sawWatching) {
      sawWatching = true
      await pb.evaluate(() => (window as any).__holdJump?.('Roof'))   // B goes back up into the flood: now B falls too
    }
    const [overA, overB] = await Promise.all([pa, pb].map(p => p.evaluate(() => /The Breach took you/.test(document.body.innerText))))
    if (overA && overB) overBoth = true
  }
  ok(sawWatching, '★ the first keeper down WATCHES under the banner while the other still stands')
  ok(overBoth, '★ the run ends for both only when both are down')
  // ★ AFTER THE MISSION: both back at the Station, the lobby open, still one party
  let backA: any = null, backB: any = null
  const home = await until(async () => {
    backA = await coopOf(pa); backB = await coopOf(pb)
    return backA?.zone === 'travelers-station' && backB?.zone === 'travelers-station'
  }, 25)
  ok(home, `★ both are brought back to the Station (${backA?.zone} / ${backB?.zone})`)
  const lobbyBack = await until(async () => lead.evaluate(() => /Departures/.test(document.querySelector('[data-panel=departures]')?.textContent ?? '')), 8)
  const rosterBack = await lead.evaluate(() => document.querySelector('[data-roster]')?.textContent ?? '')
  ok(lobbyBack && rosterBack.includes(mateName), '★ the lobby is open again, and the mate is still in the party')
} finally {
  await browser.close()
}
console.log(`coop-flow: ${pass} passed, ${fails.length} failed`)
process.exit(fails.length ? 1 : 0)
