/**
 * lobby-look.mts — the Departures lobby with a chord of three, at phone and desktop sizes (2026-09-29, Alex: "a team of
 * three fits comfortably… it converts better on the phone"). Screenshots to LOOK at; owner session (__lobbyPreview).
 *   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/lobby-look.mts
 */
import puppeteer from 'puppeteer-core'
import { mintSession } from '../src/lib/accounts/session'
const ORIGIN = process.env.SMOKE_ORIGIN ?? 'https://ather.games'
const WHO = { id: 'u_156700d4312d118944', name: 'dummy_fern' }
const OUT = process.env.OUT ?? '/tmp'
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('needs OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const [name, w, h, mobile] of [['phone', 390, 844, true], ['desktop', 1280, 760, false]] as const) {
    const p = await b.newPage()
    await p.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 })
    await p.setCookie({ name: 'ather_session', value: mintSession(WHO.id, WHO.name), domain: new URL(ORIGIN).hostname, path: '/', httpOnly: true })
    await p.evaluateOnNewDocument((id: string) => {
      localStorage.setItem('ather:epoch', '2')
      localStorage.setItem(`u:${id}:ather:shimmer:birthRune`, 'barrier')
      localStorage.setItem(`u:${id}:ather:shimmer:runes`, JSON.stringify(['barrier']))
    }, WHO.id)
    await p.goto(`${ORIGIN}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await p.goto(`${ORIGIN}/shimmer/play3d`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    for (let t = 0; t < 60 && !(await p.evaluate(() => typeof (window as any).__lobbyPreview === 'function')); t++) await sleep(500)
    await p.evaluate(() => (window as any).__goZone('travelers-station'))
    await sleep(6000)
    await p.evaluate(() => { (window as any).__talk('station-clerk'); (window as any).__lobbyPreview(true) })
    // the nameplates are drei <Html>: under software GL they mount over ~3s, so a 2.5s shot caught some missing (09-29)
    await sleep(4500)
    await p.screenshot({ path: `${OUT}/lobby-${name}.png` })
    console.log(`${name}: seats ${await p.evaluate(() => [...document.querySelectorAll('[data-seat]')].map(e => e.getAttribute('data-seat')).join(','))}`)
    await p.close()
  }
} finally { await b.close() }
