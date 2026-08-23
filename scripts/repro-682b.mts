// #682 RESIDUAL HOLE — can a SECOND account inherit the browser's anonymous garden?
//
// The main repro proved per-account slots stop the direct clobber. This one tests the path that
// survived it: an anonymous garden sitting in the browser, claimed by nobody, that adoption would
// hand to whoever signs in next. Account C is seeded with NO cloud row on purpose — that is the
// only route into the adoption branch.
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'

const TOKENS = process.env.REPRO_TOKENS ?? '/tmp/ather-repro-tokens.json'
const S = process.env.REPRO_OUT ?? '/tmp'
const tok = JSON.parse(readFileSync(TOKENS, 'utf8'))
const C = JSON.parse(readFileSync(TOKENS, 'utf8')).C
const ORIGIN = process.env.REPRO_ORIGIN ?? 'http://localhost:3205'
const PLAY = `${ORIGIN}/shimmer/play3d`

// ⚠⚠ NEVER AGAINST PRODUCTION. This rig SEEDS ACCOUNTS AND OVERWRITES CLOUD SAVES to prove a
// data-loss bug. Pointed at :3200 it would write test accounts into the live accounts.db and
// could destroy a real garden — the exact thing it exists to prevent. It refuses rather than
// trusting whoever runs it to have read this comment.
if (ORIGIN.includes(':3200') || /ather\.games/.test(ORIGIN)) {
  console.error('REFUSING: :3200 / ather.games is PRODUCTION. Run this against an isolated dev server with its own data/accounts.db.')
  process.exit(2)
}

const SETTLE = Number(process.env.SETTLE ?? 22)
const ANON = 'ather:save:shimmer'
const ANON_GARDEN = JSON.stringify({ _epoch: 2, whose: 'ANONYMOUS_GARDEN', plot: 'anon-marker' })

// ⚠⚠ /shimmer/play3d IS OWNER-GATED — without the cookie it 307s to /room, and a probe that does
// not check lands on a page that never runs hydrate and reports "nothing happened". That is a false
// NEGATIVE shaped exactly like a broken fix, and it cost a run. Loud, and it stops.
let OWNER_KEY = ''
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = /^OWNER_KEY=(.*)$/.exec(line.trim())
  if (m) OWNER_KEY = m[1].replace(/^["']|["']$/g, '')
}
if (!OWNER_KEY) { console.error('OWNER_KEY missing — play3d would redirect and this would lie'); process.exit(2) }

async function gotoGame(page: any): Promise<void> {
  await page.goto(PLAY, { waitUntil: 'networkidle2', timeout: 60_000 })
  const url = page.url()
  if (!url.includes('/shimmer/play3d')) {
    console.error(`REFUSING TO REPORT: landed on ${url}, not the game. The owner gate redirected us.`)
    process.exit(2)
  }
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium-browser', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
         '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'],
})
const out: Record<string, unknown> = {}
const setSession = async (page: any, jwt: string) => {
  await browser.deleteCookie({ name: 'ather_session', domain: 'localhost' } as any).catch(() => {})
  await page.setCookie({ name: 'ather_session', value: jwt, domain: 'localhost', path: '/' })
}
const slots = (page: any) => page.evaluate((pre: string) => Object.fromEntries(
  Object.keys(localStorage).filter(k => k.startsWith(pre))
    .map(k => [k, (localStorage.getItem(k) ?? '').slice(0, 70)])), ANON)

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  // Born + an ANONYMOUS garden already in the browser, exactly as a pre-account player leaves it.
  await page.evaluateOnNewDocument((garden: string) => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'barrier')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['barrier']))
    if (!localStorage.getItem('ather:save:shimmer')) localStorage.setItem('ather:save:shimmer', garden)
  }, ANON_GARDEN)

  // A signs in. A HAS a cloud row, so the cloud wins and adoption never fires — the exact path that
  // used to leave the anonymous slot unclaimed.
  await setSession(page, tok.A.cookie)
  await page.goto(`${ORIGIN}/owner?key=${encodeURIComponent(OWNER_KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await gotoGame(page)
  await new Promise(r => setTimeout(r, SETTLE * 1000))
  out.after_A = await slots(page)

  // C signs in. C has NO cloud row, so C reaches adoption. Does C get the anonymous garden?
  await setSession(page, C.cookie)
  await gotoGame(page)
  await new Promise(r => setTimeout(r, SETTLE * 1000))
  await new Promise(r => setTimeout(r, 14_000))
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await new Promise(r => setTimeout(r, 3_000))
  out.after_C = await slots(page)
} finally { await browser.close() }
console.log(JSON.stringify(out, null, 1))
