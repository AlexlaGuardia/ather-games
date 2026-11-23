// ── IDLE MOGLINS, SEEN (P1 Alex 11-23: 'i asked a few moglins to join my garden but im not seeing them here') ────────────
// A fresh profile whose village holds two recruits with NO room (and one whose room is gone), on its own plot:
//   1. all three stand idle by the planning table (__moglinsIdle, written by the drawn component)
//   2. 0 page errors   (the probe is written by the mounted component's render, so a listed id is a drawn one)
// Never Alex's save: a new browser context.   npx tsx scripts/moglins-idle-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { adoptVillage } from '../src/app/shimmer/open/ather/moglins'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const now = Date.now()
const mog = (id: string, name: string, profession: string, room?: string) => ({ id, name, home: 'glade', homeName: 'the Glade', grades: { craft: 2, yield: 2, trade: 2 }, dream: 'to see the sea', profession, recruitedAt: now - 7_200_000, ...(room ? { room } : {}) })
const VILLAGE = { v: 1, moglins: [mog('idle-a', 'Ash', 'carpenter'), mog('idle-b', 'Birch', 'cook'), mog('idle-c', 'Cedar', 'smith', 'no-such-room')], lastTick: now }
const ids = ['idle-a', 'idle-b', 'idle-c']
ok(adoptVillage(VILLAGE, now).moglins.length === 3, '0. the seed survives the game\'s adopter')
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((v: string) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('open.village.v1', v) }
  }, JSON.stringify(VILLAGE))
  await p.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(3000)
  if ((await p.evaluate(() => (window as any).__ather.zone())) !== 'plot') await p.evaluate(() => (window as any).__ather.travel({ kind: 'plot' }))
  ok(await poll(() => p.evaluate(() => (window as any).__ather.zone() === 'plot'), 60000), '0. on the keeper\'s own plot')
  const idleOk = await poll(() => p.evaluate((w: string[]) => { const s = (window as any).__moglinsIdle as string[] | undefined; return !!s && w.every(id => s.includes(id)) }, ids), 30000)
  ok(idleOk, `1. all three stand idle (${JSON.stringify(await p.evaluate(() => (window as any).__moglinsIdle ?? null))})`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `2. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
