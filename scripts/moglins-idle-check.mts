// ── IDLE MOGLINS, SEEN (P1 Alex 11-23: 'i asked a few moglins to join my garden but im not seeing them here') ────────────
// A fresh profile whose village holds two recruits with NO room (and one whose room is gone), on its own plot:
//   1. all three stand idle by the planning table (__moglinsIdle, written by the drawn component)
//   2. E on the first (aimed, the real prompt 'E · Ash'): hello -> 'Go home to your kin?' -> 'No, stay.' parts nobody;
//      again -> 'Yes. Go well.': Ash leaves the arc, the save lists Ash as parted, the other two still stand idle
//   3. 0 page errors   (the probe is written by the mounted component's render, so a listed id is a drawn one)
// Never Alex's save: a new browser context.   npx tsx scripts/moglins-idle-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { adoptVillage } from '../src/app/shimmer/open/ather/moglins'
import { idleSpot, IDLE_LINES } from '../src/app/shimmer/open/ather/moglins-idle'
import { aimAt } from './lib/aim.mts'
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
  // 2 · the go-home talk on Ash (idle order = village order: Ash is 0 of 3)
  const tapText = async (text: string) => {
    const box = await p.evaluate((t: string) => { for (const e of document.querySelectorAll<HTMLElement>('[data-talk-option]')) {
      if ((e.textContent ?? '').replace(/^\s*›\s*/, '').trim() !== t) continue
      const r = e.getBoundingClientRect(); if (r.width > 4) return { x: r.x + r.width / 2, y: r.y + r.height / 2 } } return null }, text)
    if (!box) return false; await p.mouse.click(box.x, box.y); return true
  }
  const a = idleSpot(0, 3), sx = a.x + Math.sin(a.yaw + Math.PI) * 1.8, sz = a.z + Math.cos(a.yaw + Math.PI) * 1.8
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), sx, sz); await sleep(2500); await aimAt(p, a.x, a.z, 0.6)
  ok(await poll(() => p.evaluate(() => /E · Ash/.test(document.body.innerText)), 15000), "2. the prompt 'E · Ash'")
  await p.keyboard.press('KeyE')
  ok(await poll(() => p.evaluate((l: string) => document.body.innerText.includes(l), IDLE_LINES.hello('Ash')), 10000), '2. hello')
  ok(await tapText(IDLE_LINES.askHome) && await poll(() => p.evaluate((l: string) => document.body.innerText.includes(l), IDLE_LINES.confirm), 10000), '2. asked home: the confirm')
  ok(await tapText(IDLE_LINES.no), "2. 'No, stay.'"); await sleep(1500)
  const still = await p.evaluate(() => JSON.parse(localStorage.getItem('open.village.v1') ?? 'null')?.moglins?.length)
  ok(still === 3, `2. ...parts nobody (${still} in the village)`)
  await tapText(IDLE_LINES.askHome); await sleep(700)
  ok(await tapText(IDLE_LINES.yes), "2. 'Yes. Go well.'")
  ok(await poll(() => p.evaluate(() => { const s = (window as any).__moglinsIdle as string[]; return !!s && !s.includes('idle-a') && s.includes('idle-b') && s.includes('idle-c') }), 10000), `2. Ash left the arc, Birch + Cedar stay (${JSON.stringify(await p.evaluate(() => (window as any).__moglinsIdle))})`)
  const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('open.village.v1') ?? 'null'))
  ok(sv?.parted?.includes('idle-a') && !sv?.moglins?.some((m: any) => m.id === 'idle-a'), `2. the save: parted ${JSON.stringify(sv?.parted)}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `3. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
