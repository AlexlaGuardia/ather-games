/**
 * party-flow.mts — two real signed-in keepers, end to end (2026-09-28): A sees B online in Play together ›
 * Friends, invites B, the invite PROMPT appears in B's world, B joins, both carry the same party code and the
 * multiplayer server puts them in one party instance. Runs against the LIVE site (the presence + game sockets
 * only exist behind the public tunnel), as two dummy accounts that are already friends.
 *
 *   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/party-flow.mts
 */
import puppeteer, { type Page } from 'puppeteer-core'
import { mintSession } from '../src/lib/accounts/session'

const ORIGIN = process.env.PARTY_ORIGIN ?? 'https://ather.games'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const A = { id: 'u_156700d4312d118944', name: 'dummy_fern' }
const B = { id: 'u_986fb228a294e6720d', name: 'dummy_moss' }
let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l); console.log(`${c ? '✓' : '✗'} ${l}`) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'],
})
async function keeper(who: { id: string; name: string }): Promise<Page> {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  await page.setCookie({ name: 'ather_session', value: mintSession(who.id, who.name), domain: new URL(ORIGIN).hostname, path: '/', httpOnly: true })
  // born, under THIS keeper's own keys (`u:<id>:…`, lib/keeper-local): an unborn keeper sits in the birth ritual,
  // and the game (and so the in-game presence socket) does not mount until the keeper is born
  await page.evaluateOnNewDocument((id: string) => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem(`u:${id}:ather:shimmer:birthRune`, 'barrier')
    localStorage.setItem(`u:${id}:ather:shimmer:runes`, JSON.stringify(['barrier']))
  }, who.id)
  await page.goto(`${ORIGIN}/shimmer/play3d`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  return page
}
const clickText = (page: Page, text: string, scope = 'button') => page.evaluate((t: string, sel: string) => {
  const el = [...document.querySelectorAll(sel)].find(b => (b.textContent ?? '').trim().includes(t)) as HTMLElement | undefined
  el?.click(); return !!el
}, text, scope)
const partyOf = (page: Page) => page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (/party/i.test(k) && !/leader|lock/i.test(k)) return localStorage.getItem(k) }
  return null
})

try {
  const pa = await keeper(A)
  const pb = await keeper(B)
  await sleep(20000)  // both worlds up + both presence sockets connected

  // A: the friends list says B is here
  const fr = await pa.evaluate(() => fetch('/api/friends', { cache: 'no-store' }).then(r => r.json()))
  const moss = (fr.friends ?? []).find((f: { username: string }) => f.username === B.name)
  ok(!!moss && moss.online === true, `★ A's friends list shows ${B.name} ONLINE (from the presence server)`)

  // A: open the menu → Play together → Friends → Invite
  await pa.keyboard.press('o'); await sleep(600)   // O opens the menu (Escape only closes it)
  const opened = await clickText(pa, 'Play together')
  await sleep(500)
  await clickText(pa, 'Friends'); await sleep(1500)
  const row = await pa.evaluate((n: string) => !!document.querySelector(`[data-friend="${n}"]`), B.name)
  ok(opened && row, `A opens Play together › Friends and ${B.name} has a row`)
  const invited = await pa.evaluate((n: string) => {
    const r = document.querySelector(`[data-friend="${n}"]`)
    const b = r && [...r.querySelectorAll('button')].find(x => x.textContent?.trim() === 'Invite') as HTMLElement | undefined
    b?.click(); return !!b
  }, B.name)
  await sleep(2500)
  const note = await pa.evaluate((n: string) => document.querySelector(`[data-friend="${n}"]`)?.textContent ?? '', B.name)
  ok(invited && /invited/.test(note), `★ A invites ${B.name}; the row says "${note.replace(/\s+/g, ' ').trim()}"`)
  const aParty = await partyOf(pa)
  ok(!!aParty, `A had no party, so inviting started one (${aParty})`)

  // B: the prompt appears in the world
  const prompt = await pb.evaluate(() => document.querySelector('[data-panel="party-invite"]')?.textContent ?? '')
  ok(prompt.includes(A.name) && prompt.includes('invites you'), `★★ B sees the invite IN THE GAME: "${prompt.replace(/\s+/g, ' ').trim().slice(0, 70)}"`)
  await clickText(pb, 'Join'); await sleep(4000)
  const bParty = await partyOf(pb)
  ok(!!bParty && bParty === aParty, `★★ B joined A's party (${bParty})`)
  const gone = await pb.evaluate(() => !document.querySelector('[data-panel="party-invite"]'))
  ok(gone, 'the prompt is gone after joining')

  // the server: one party instance holding both
  await sleep(4000)
  // asked on the box itself: the public /shimmer-ws/ path only carries the sockets
  const stats = await fetch('http://127.0.0.1:8400/stats').then(r => r.ok ? r.json() : null).catch(() => null)
  const blob = JSON.stringify(stats ?? {})
  console.log('  server stats:', blob.slice(0, 300))
  const inst = (stats?.instances ?? []).find((i: { id: string }) => i.id === `party_${aParty}__play3d:rune-hold`)
  ok(!!inst && inst.players === 2, `★★ both keepers stand in ONE party instance of Rune Hold (${inst?.id}: ${inst?.players} players)`)
} finally {
  await browser.close()
}
console.log(`party-flow: ${pass} passed, ${fails.length} failed`)
if (fails.length) process.exit(1)
