// ── THE ALCHEMY ROOM, PLAYED (2026-11-17, play / Jin 30bbef32) ─────────────────────────────────────────────────────
// The cauldron BOILS canon's brews (ather/alchemy.ts). A keeper brews a Shard Tonic at the alchemy room's cauldron (shards
// from the room's store, bark from the bag), is refused at a full bar, drinks it at 20 mana (→ 85), drinks a Starlight
// Tincture (the buff saves per keeper and survives a reload). SETUP (stated): an alchemy room standing at (-100, 100) with
// 3 Raw Mana Shards in its store; bag slot 8 holds 2 Goldwood Bark, slot 9 a Starlight Tincture. Hooks: movement, reading,
// __ather.drink (the click's own handler), setMana (the spend).
//   npx tsx scripts/alchemy-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/alchemy')
mkdirSync(out, { recursive: true })
const ROOM: Room = { id: 'alchemy-check', kind: 'alchemy', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [{ id: 'raw_mana_shard', n: 3 }] }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument((room: Room) => {
  if (sessionStorage.getItem('ac')) return; sessionStorage.setItem('ac', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }
  slots[8] = { id: 'goldwood_bark', n: 2 }; slots[9] = { id: 'starlight_tincture', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] }))
}, ROOM)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const slotOf = async (id: string) => (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(s => s?.id === id)
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const A = (fn: string, ...a: unknown[]) => p.evaluate((f, args) => (window as any).__ather[f](...args), fn, a)
const res: Record<string, unknown> = { url }
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
// 1. the cauldron
const b = benchOf(ROOM)
await A('tp', b.x, b.z - 1.4, Math.PI); await sleep(2000); await shot('ac-0-cauldron')   // facing the back wall: the cauldron
await A('tp', b.x, b.z - 1.4, 0); await sleep(800)
await p.keyboard.press('e'); await sleep(900)
res.cauldron = await p.evaluate(() => !!document.querySelector('[data-panel="bench"] [data-job="brew-shard_tonic"]'))
await click('[data-job="brew-shard_tonic"] button'); await sleep(600)
res.afterBrew = await bag(); res.store = ((await read('open.works.v1'))?.rooms?.[0]?.store ?? []).length; await shot('ac-1-brewed')
await p.keyboard.press('Escape'); await sleep(500)
// 2. hold the tonic: refused at a full bar, then drunk at 20
const slot = await slotOf('shard_tonic'); res.tonicSlot = slot
await p.keyboard.press(String(slot + 1)); await sleep(500)
await A('setMana', 100); await A('drink'); await sleep(300)
res.fullDrink = (await bag()).shard_tonic ?? 0
await A('setMana', 20); await A('drink'); await sleep(300)
res.mana = await p.evaluate(() => (window as any).__ather.mana()); res.afterDrink = (await bag()).shard_tonic ?? 0
// 3. the Starlight Tincture (bag slot 9, so move it to the hand by pressing nothing: drink needs it HELD, so put it on the bar)
await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('open.inv.v1')!); v.slots[4] = v.slots[9]; v.slots[9] = null; localStorage.setItem('open.inv.v1', JSON.stringify(v)) })
await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
await p.keyboard.press('5'); await sleep(500)
await A('drink'); await sleep(400)
res.buffs = await A('buffs'); res.afterTincture = (await bag()).starlight_tincture ?? 0
await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
res.buffsAfterReload = await A('buffs')
res.errs = errs
console.log(JSON.stringify(res))
const r = res.afterBrew as Record<string, number>, bu = res.buffs as Record<string, number>, ba = res.buffsAfterReload as Record<string, number>
const pass = res.cauldron === true && r.shard_tonic === 1 && !r.goldwood_bark && res.store === 0
  && res.fullDrink === 1 && Math.abs((res.mana as number) - 85) < 3 && res.afterDrink === 0
  && bu?.starlight > Date.now() && res.afterTincture === 0 && ba?.starlight === bu.starlight && errs.length === 0
console.log(pass ? 'PASS: Shard Tonic brewed (store + bag) → refused at a full bar → drunk at 20 (→ 85) → Starlight Tincture drunk, the buff survives a reload' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
