/**
 * slack-flow.mts — THE SLACK TOGETHER on the live site (2026-09-29). Built on coop-flow.mts: two signed-in keepers in
 * one party, the leader picks the Boss card (the Slack) and launches for both, and both pages then show the SAME
 * Stillwind streamed from breach-server (`?mode=slack`). Then idle keepers on the line are run down: a fallen keeper
 * waits under a banner and comes back, or the whole party falls and the Stillwind stands again.
 *
 *   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/slack-flow.mts
 *
 * (header of the script this was copied from, kept for its notes:)
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
const PARTY = 'SL' + Math.random().toString(36).slice(2, 6).toUpperCase()
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
    // the Boss card is locked until the Stillwind's Road is read in the Breach's lab: both keepers have read it
    localStorage.setItem(`u:${id}:ather:shimmer:stillwind-road`, JSON.stringify({ season: 'lenna', at: Date.now() }))
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
  const [la, lb] = [await toBoard(pa), await toBoard(pb)]
  const aLeads = /you lead/.test(la.board)
  const [lead, mate] = aLeads ? [pa, pb] : [pb, pa]
  ok(la.talked && lb.talked && /you lead/.test(aLeads ? la.board : lb.board), `one leads (party ${PARTY}, ${aLeads ? A.name : B.name} leads)`)
  // the leader picks the Boss card
  const picked = await lead.evaluate(() => {
    (document.querySelector('[data-mission-current]') as HTMLButtonElement | null)?.click()
    return true
  })
  await sleep(400)
  const boss = await lead.evaluate(() => { const b = document.querySelector('[data-mission=boss]') as HTMLButtonElement | null; if (b && !b.disabled) { b.click(); return true } return false })
  ok(picked && boss, 'the leader picks the Boss card (the Slack)')
  await sleep(1200)
  const cur = await lead.evaluate(() => document.querySelector('[data-mission-current]')?.getAttribute('data-mission-current'))
  ok(cur === 'boss', `the lobby's mission is the Slack (${cur})`)
  const readied = await mate.evaluate(() => { const b = [...document.querySelectorAll('[data-panel=departures] button')].find(x => /^Ready$/.test(x.textContent ?? '')) as HTMLButtonElement | undefined; b?.click(); return !!b })
  ok(readied, 'the mate readies')
  ok(await until(async () => clickLaunch(lead), 6), '★ the leader launches the Slack for the party')
  let ca: any = null, cb: any = null
  const both = await until(async () => {
    ca = await coopOf(pa); cb = await coopOf(pb)
    return ca?.slack?.status === 'live' && cb?.slack?.status === 'live' && ca.slack.party.length === 2 && cb.slack.party.length === 2
  }, 30)
  console.log('  A:', JSON.stringify(ca?.slack), ca?.zone)
  console.log('  B:', JSON.stringify(cb?.slack), cb?.zone)
  ok(ca?.zone === 'stillwind-edge' && cb?.zone === 'stillwind-edge', 'both keepers are on the edge')
  ok(both && ca.slack.code === PARTY && cb.slack.code === PARTY, `★ both pages are live on the party's Stillwind (${PARTY}, ${ca?.slack?.party?.join(' + ')})`)
  ok(ca?.slack?.hp === cb?.slack?.hp, `the same Stillwind hp on both pages (${ca?.slack?.hp})`)
  // it walks toward them: the SAME body on both pages, and it moves
  const z0 = ca?.slack?.z
  await sleep(6000)
  let za = 0, zb = 0
  const agree = await until(async () => {
    const [x, y] = [await coopOf(pa), await coopOf(pb)]
    za = x?.slack?.z; zb = y?.slack?.z
    return Math.abs(za - zb) < 1.5 && Math.abs(za - z0) > 3
  }, 10)
  ok(agree, `★★ one Stillwind: both pages put it at the same place, and it has walked (${z0?.toFixed?.(1)} → A ${za?.toFixed?.(1)} / B ${zb?.toFixed?.(1)})`)
  // idle on the line, they are run down. Either one falls and watches (then comes back), or both fall and it stands again
  let sawDown = false, sawBack = false, sawStand = false
  for (let t = 0; t < 4 * 150 && !(sawDown && (sawBack || sawStand)); t++) {
    await sleep(250)
    const [da, db] = await Promise.all([pa, pb].map(p => p.evaluate(() => ({ down: !!document.querySelector('[data-coop-down]'), text: document.body.innerText }))))
    if (da.down || db.down) sawDown = true
    if (sawDown && /Back at the near end/.test(da.text + db.text)) sawBack = true
    if (/The Stillwind stands/.test(da.text + db.text)) sawStand = true
  }
  ok(sawDown || sawStand, `★ a keeper run down in the Slack (banner ${sawDown}, stands again ${sawStand})`)
  ok(sawBack || sawStand, `★ and the fallen come back (back at the near end ${sawBack}, the Stillwind stands ${sawStand})`)
  await pa.screenshot({ path: process.env.SHOT ?? '/tmp/slack-flow-a.png' })
} finally {
  await browser.close()
}
console.log(`slack-flow: ${pass} passed, ${fails.length} failed`)
process.exit(fails.length ? 1 : 0)
