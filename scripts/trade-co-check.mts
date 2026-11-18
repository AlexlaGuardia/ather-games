// THE CO.'S CITADEL OFFICE (Alex 11-18: "the player shouldnt be able to reach it through a hot key but by visiting the citadels
// trade co"; Magii 49d8a0f AFK, world/gates.md › The Co.'s Citadel office). A fresh keeper stopped in a supply town presses E from
// the seat and gets NO board; at the Ather Trading Co. door in the Citadel, the real E opens the board with every supply town's work,
// and a contract can be taken. Zero page errors (BETA M8).
//   npx tsx scripts/trade-co-check.mts [--url https://ather.games] [--out dir]
import { CO_GREETING, CO_BARK, CO_FLAVOUR, CO_ASK } from '../src/app/shimmer/open/business/co-lines'   // signed lines + lark's labels: a reword never stales the check
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/trade-co')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const door = doorsCached(R, 'citadel').find(d => d.key === 'front:trade-co')
if (!door) { console.log('FAIL: no Ather Trading Co. door in the Citadel'); process.exit(1) }
const at = shopDoorPoint(door.b)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, unknown> = { url, door: door.key }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; console.log(JSON.stringify(res, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
const board = () => p.$('[data-panel="trade-board"]').then(Boolean)
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(4000)
// 1 · seated and stopped in the town a fresh keeper arrives in: E from the seat opens nothing now, and no prompt says it would
await p.mouse.click(500, 320).catch(() => {}); await sleep(500)
await p.keyboard.press('KeyE'); await sleep(1500)
res.seatE_noBoard = !(await board())
res.noSeatPrompt = !(await p.evaluate(() => /E · Ather Trading Co\. board/.test(document.body.innerText)))
// 2 · to the Co.'s door in the Citadel (movement hooks), on foot, then the real E
const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door.at.x, door.at.z); await sleep(6000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(5000)
res.reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:trade-co')
if (!res.reach) await done(false, 'FAIL: the Co. door is not in reach')
// 2 · BETA M13 (play 11-18): the clerk TALKS first (business/co-lines.ts, signed 11-18): the greeting, one bubble a line
const bubble = () => p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
const answer = async (label: string) => { await p.evaluate((l) => ([...document.querySelectorAll<HTMLElement>('[data-talk-option]')].find(e => (e.textContent ?? '').includes(l)))?.click(), label); await sleep(800) }
await p.keyboard.press('KeyE')
res.greet = [] as boolean[]
res.greet0 = await poll(async () => (await bubble()).includes(CO_GREETING[0]), 15000)
res.noBoardYet = !(await board())
for (let k = 1; k < CO_GREETING.length; k++) { await answer(CO_ASK.next); (res.greet as boolean[]).push((await bubble()).includes(CO_GREETING[k])) }
await answer(CO_ASK.board)
res.panel = await poll(board, 15000)
await p.screenshot({ path: `${out}/trade-co.png` })
if (!res.panel) await done(false, 'FAIL: the greeting did not open the board')
res.title = await p.evaluate(() => /ather trading co\./i.test(document.querySelector('[data-panel="trade-board"]')?.textContent ?? ''))
res.clerkB1 = await p.evaluate(() => document.querySelector('[data-clerk-line]')?.textContent ?? '')
res.noShopPanel = !(await p.$('[data-panel="shop-panel"]'))
// every supply town's work: three per town (Rune Hold, Millbrook, Ashfeld), so more than any one town's board ever held
res.rows = await p.evaluate(() => [...document.querySelectorAll('[data-panel="trade-board"] button')].filter(x => /\d+ M$/.test(x.textContent ?? '')).length)
// 3 · take one: the board closes and the clerk says so (B2)
res.took = await p.evaluate(() => { const bt = [...document.querySelectorAll<HTMLButtonElement>('[data-panel="trade-board"] button')].find(x => /\d+ M$/.test(x.textContent ?? '') && !x.disabled); if (!bt) return false; bt.click(); return true })
await sleep(1200)
res.closedOnTake = !(await board())
res.toast = await p.evaluate(t => document.body.innerText.includes(t), CO_BARK.taken)
// 4 · back again: no greeting now, a flavour line (F1 first), the board says you still hold one (B3), leaving says B10
await sleep(2500); await p.keyboard.press('KeyE')
res.flavour = await poll(async () => (await bubble()).includes(CO_FLAVOUR[0]), 15000)
await answer(CO_ASK.board); await poll(board, 10000)
res.clerkB3 = await p.evaluate(() => document.querySelector('[data-clerk-line]')?.textContent ?? '')
await p.evaluate(() => (document.querySelector('[data-panel="trade-board"] button[aria-label="close"], [data-panel="trade-board"] [aria-label="close"]') as HTMLElement | null)?.click()); await sleep(900)
res.byeB10 = await p.evaluate(t => document.body.innerText.includes(t), CO_BARK.byeHolding)
res.seen = await p.evaluate(() => Object.entries(localStorage).filter(([k]) => k.includes('open.co-office.v1')).map(([, v]) => JSON.parse(v)))
const pass = !!res.seatE_noBoard && !!res.noSeatPrompt && !!res.greet0 && !!res.noBoardYet && (res.greet as boolean[]).length === 3 && (res.greet as boolean[]).every(Boolean)
  && !!res.title && res.clerkB1 === CO_BARK.board && !!res.noShopPanel && (res.rows as number) > 3 && !!res.took && !!res.closedOnTake && !!res.toast
  && !!res.flavour && res.clerkB3 === CO_BARK.holding && !!res.byeB10 && (res.seen as any[])[0]?.greeted === true && errs.length === 0
await done(pass, pass ? 'PASS' : 'FAIL')
