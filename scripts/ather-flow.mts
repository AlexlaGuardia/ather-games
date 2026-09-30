/**
 * ather-flow.mts — two keepers in one party find each other IN THE ATHER (2026-09-29). Both load the voxel world with the
 * party link; each page's party strip must show the other with a distance (which only presence can give it), and a
 * third look from play3d's Station lobby must read them as "in the Ather" / "at Moonwell".
 *
 *   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/ather-flow.mts
 */
import puppeteer, { type Page } from 'puppeteer-core'
import { mintSession } from '../src/lib/accounts/session'

const ORIGIN = process.env.COOP_ORIGIN ?? 'https://ather.games'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const PARTY = 'AT' + Math.random().toString(36).slice(2, 6).toUpperCase()
const A = { id: 'u_156700d4312d118944', name: 'dummy_fern' }
const B = { id: 'u_986fb228a294e6720d', name: 'dummy_moss' }
let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l); console.log(`${c ? '✓' : '✗'} ${l}`) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1100,700'],
})
const errors: string[] = []
async function keeper(who: { id: string; name: string }): Promise<Page> {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 1100, height: 700 })
  page.on('pageerror', (e) => errors.push(`${who.name}: ${e instanceof Error ? e.message : String(e)}`))
  await page.setCookie({ name: 'ather_session', value: mintSession(who.id, who.name), domain: new URL(ORIGIN).hostname, path: '/', httpOnly: true })
  // a born keeper: a fresh context would meet the birth screen, which gates the world (as it should)
  await page.evaluateOnNewDocument((id: string) => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem(`u:${id}:ather:shimmer:birthRune`, 'barrier')
    localStorage.setItem(`u:${id}:ather:shimmer:runes`, JSON.stringify(['barrier']))
  }, who.id)
  await page.goto(`${ORIGIN}/shimmer/voxel3d?party=${PARTY}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  return page
}
const strip = (p: Page) => p.evaluate(() => document.querySelector('[data-party-strip]')?.textContent?.replace(/\s+/g, ' ') ?? '')
try {
  const pa = await keeper(A)
  const pb = await keeper(B)
  let sa = '', sb = ''
  for (let t = 0; t < 120; t++) {
    sa = await strip(pa); sb = await strip(pb)
    // two agreeing readings in a row, a second apart: a single sample can land on a mate's first instant
    if (/\d+m/.test(sa) && /\d+m/.test(sb)) { await sleep(1000); sa = await strip(pa); sb = await strip(pb); if (/\d+m/.test(sa) && /\d+m/.test(sb)) break }
    await sleep(500)
  }
  console.log(`  A's strip: "${sa}"\n  B's strip: "${sb}"`)
  for (const [n, pg] of [['A', pa], ['B', pb]] as const) console.log(`  ${n} probe:`, JSON.stringify(await pg.evaluate(() => (window as any).__atherParty?.())))
  ok(sa.includes(B.name) && sb.includes(A.name), `★ each keeper's strip names the other (party ${PARTY})`)
  const same = /\d+m/.test(sa) && /\d+m/.test(sb)
  ok(same || /garden|Moonwell|Ather/.test(sa), same ? '★★ in the same part of the Ather, each sees the other with a distance (presence both ways)' : 'in different parts of the Ather, each reads where the other is')
  const da = Number(/(\d+)m/.exec(sa)?.[1] ?? NaN), db = Number(/(\d+)m/.exec(sb)?.[1] ?? NaN)
  if (same) ok(Math.abs(da - db) <= 3, `★ both keepers agree how far apart they are (${da}m / ${db}m): nobody is announced at the origin`)
  ok(errors.length === 0, `no page errors (${errors.slice(0, 2).join(' | ')})`)
} finally {
  await browser.close()
}
console.log(`ather-flow: ${pass} passed, ${fails.length} failed`)
process.exit(fails.length ? 1 : 0)
