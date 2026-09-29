/**
 * queue-flow.mts — FIND OTHERS end to end on the live site (2026-09-28): two signed-in keepers join one party by
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
  await page.goto(`${ORIGIN}/shimmer/play3d`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
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
  // neither is partied with the other: leave whatever party a past run left behind
  for (const p of [pa, pb]) await p.evaluate(() => { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i)!; if (/party/i.test(k)) localStorage.removeItem(k) } })
  const [la, lb] = [await toBoard(pa), await toBoard(pb)]
  ok(/Find others/.test(la.board) && /Find others/.test(lb.board), 'both boards offer Find others')
  const pick = (p: Page) => p.evaluate(() => {
    const r = document.querySelector('[data-mode=others] input') as HTMLInputElement | null
    r?.click()
    const b = [...document.querySelectorAll('[data-panel=departures] button')].find(x => /^Find others/.test(x.textContent ?? '')) as HTMLButtonElement | undefined
    if (b && !b.disabled) { b.click(); return true }
    return false
  })
  ok(await pick(pa), 'A takes a place in the line')
  const findA = await until(async () => pa.evaluate(() => /Finding others/.test(document.querySelector('[data-panel=finding]')?.textContent ?? '')), 5)
  ok(findA, 'A sees the finding view')
  ok(await pick(pb), 'B takes a place in the line')
  // two waiting: matched when the first has waited the fill time (25s)
  let ca: any = null, cb: any = null
  const matched = await until(async () => {
    ca = await coopOf(pa); cb = await coopOf(pb)
    return ca?.zone === 'the-hold' && cb?.zone === 'the-hold' && /^MX/.test(ca?.code ?? '') && ca?.code === cb?.code && ca?.status === 'live' && cb?.status === 'live'
  }, 50)
  console.log('  A:', JSON.stringify(ca)?.slice(0, 240)); console.log('  B:', JSON.stringify(cb)?.slice(0, 240))
  ok(matched, `★★ matched and launched into ONE Breach (${ca?.code})`)
  const seen = await until(async () => {
    ca = await coopOf(pa); cb = await coopOf(pb)
    return (ca?.drawn ?? []).includes(B.name) && (cb?.drawn ?? []).includes(A.name)
  }, 15)
  ok(seen, `★ each draws the other (A sees ${JSON.stringify(ca?.drawn)}, B sees ${JSON.stringify(cb?.drawn)})`)
} finally {
  await browser.close()
}
console.log(`queue-flow: ${pass} passed, ${fails.length} failed`)
process.exit(fails.length ? 1 : 0)
