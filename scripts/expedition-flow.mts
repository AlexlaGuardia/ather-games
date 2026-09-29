/**
 * expedition-flow.mts — the expedition from the clerk (2026-09-29): pick Expedition in the lobby, Launch, land on a
 * generated floor with its HUD, no page errors; a screenshot to LOOK at. Owner session (the headless hooks are owner-only).
 *
 *   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/expedition-flow.mts
 */
import puppeteer from 'puppeteer-core'
import { mintSession } from '../src/lib/accounts/session'

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'https://ather.games'
const WHO = { id: 'u_156700d4312d118944', name: 'dummy_fern' }
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('needs OWNER_KEY'); process.exit(2) }
let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l); console.log(`${c ? '✓' : '✗'} ${l}`) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'] })
const errors: string[] = []
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1280, height: 760 })
  p.on('pageerror', (e) => errors.push(e instanceof Error ? e.message : String(e)))
  await p.setCookie({ name: 'ather_session', value: mintSession(WHO.id, WHO.name), domain: new URL(ORIGIN).hostname, path: '/', httpOnly: true })
  await p.evaluateOnNewDocument((id: string) => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem(`u:${id}:ather:shimmer:birthRune`, 'barrier')
    localStorage.setItem(`u:${id}:ather:shimmer:runes`, JSON.stringify(['barrier']))
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i)!; if (/mp:party/.test(k)) localStorage.removeItem(k) }
  }, WHO.id)
  await p.goto(`${ORIGIN}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await p.goto(`${ORIGIN}/shimmer/play3d`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  for (let t = 0; t < 60 && !(await p.evaluate(() => typeof (window as any).__goZone === 'function')); t++) await sleep(500)
  await p.evaluate(() => (window as any).__goZone('travelers-station'))
  await sleep(6000)
  ok(await p.evaluate(() => (window as any).__talk('station-clerk')), 'talk to the clerk')
  await sleep(1200)
  await p.evaluate(() => (document.querySelector('[data-mission-current]') as HTMLButtonElement)?.click())
  await sleep(400)
  const picked = await p.evaluate(() => { const b = document.querySelector('[data-mission=expedition]') as HTMLButtonElement | null; b?.click(); return !!b })
  await sleep(400)
  ok(picked && await p.evaluate(() => document.querySelector('[data-mission-current]')?.getAttribute('data-mission-current') === 'expedition'), 'pick Expedition in the lobby')
  const launched = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-panel=departures] button')].find(x => /^Launch · /.test(x.textContent ?? '')) as HTMLButtonElement | undefined; if (b && !b.disabled) { b.click(); return true } return false })
  ok(launched, 'Launch')
  await sleep(9000)
  const zone = await p.evaluate(() => (window as any).__coop?.().zone)
  ok(zone === 'expedition', `★ standing on a generated floor (${zone})`)
  const hud = await p.evaluate(() => document.querySelector('[data-expedition-hud]')?.textContent ?? '')
  ok(/elites 0\/[3-9]/.test(hud), `★ the expedition HUD counts its elites (${hud.replace(/\s+/g, ' ')})`)
  await p.screenshot({ path: '/tmp/claude-0/-root/99e9653a-fb45-4a3d-b590-52fe3259a8c9/scratchpad/expedition.png' })
  ok(errors.length === 0, `no page errors (${errors.slice(0, 2).join(' | ')})`)
} finally { await b.close() }
console.log(`expedition-flow: ${pass} passed, ${fails.length} failed`)
process.exit(fails.length ? 1 : 0)
