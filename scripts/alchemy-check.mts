// ── THE ALCHEMY ROOM, PLAYED (2026-11-17, play / Jin 30bbef32) ─────────────────────────────────────────────────────
// ★ 11-22 (sweep pass 6, sprites): the ROOM is RETIRED. ALC_LIVE flipped 11-21 (ebb47e56): alchemy is a furniture set, and an
// Alchemy room standing from before comes down on load and is paid back into the garden bank (workshop.tsx retireAlchemy ->
// rooms.ts retireRooms). Brewing at a placed piece is alchemy-set-check's job now. This check keeps what is still true here:
// (1) the seeded room is retired on load and its cost (24 Goldwood Log) + store (3 Raw Mana Shard) land in the bank, once;
// (2) the drink half below, from a Shard Tonic seeded in the bag (bag slot 3) instead of one brewed at the room.
// The history below is the room's, kept as it was.
// The cauldron BOILS canon's brews (ather/alchemy.ts). A keeper brews a Shard Tonic at the alchemy room's cauldron (shards
// from the room's store, bark from the bag), is refused at a full bar, drinks it at 20 mana (→ 85), drinks a Starlight
// Tincture (the buff saves per keeper and survives a reload). SETUP (stated): an alchemy room standing at (-100, 100) with
// 3 Raw Mana Shards in its store; bag slot 8 holds 2 Goldwood Bark, slot 9 a Starlight Tincture. Hooks: movement, reading,
// __ather.drink (the click's own handler), setMana (the spend).
// M43 (11-20): the Make button is gone. The keeper brings the bark into the STATION STORE (store panel: Pack toggle, +/All), picks the
// brew, quantity, FOCUS; the station works it in real time with the panel open (no Moglin seeded) into its output; Collect all.

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
  slots[3] = { id: 'shard_tonic', n: 1 }; slots[9] = { id: 'starlight_tincture', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] }))
}, ROOM)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const slotOf = async (id: string) => (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(s => s?.id === id)
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const A = (fn: string, ...a: unknown[]) => p.evaluate((f, args) => (window as any).__ather[f](...args), fn, a)
const res: Record<string, unknown> = { url }
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
const bank = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.bank.v1'))?.stacks ?? []) as { id: string; n: number }[]) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
// 1. the retired room: gone from the plot, paid back into the bank (once: a reload must not pay it twice)
const b = benchOf(ROOM)
await A('tp', b.x, b.z - 1.4, Math.PI); await sleep(2000); await shot('ac-0-retired')   // where the room stood: open ground
res.made = await poll(async () => !(((await read('open.works.v1'))?.rooms ?? []) as Room[]).some(r => r.kind === 'alchemy'), 30000)
res.bank = await bank()
res.toast = await p.evaluate(() => document.body.innerText.includes('Alchemy is a set of furniture now'))
await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
res.bankAfterReload = await bank()
await p.keyboard.press('Escape'); await sleep(500)
// 2. hold the tonic: refused at a full bar, then drunk at 20
const slot = await slotOf('shard_tonic'); res.tonicSlot = slot
// hold it: press its key until the stance says that slot is in hand (a key pressed while the arrival veil is up is ignored, M67)
res.held = await poll(async () => { const st = await A('stance'); if (st?.kind === 'item' && st.slot === slot) return true; await p.keyboard.press(String(slot + 1) as any); await sleep(400); return false }, 20000)
res.stance = await A('stance')
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
const bu = res.buffs as Record<string, number>, ba = res.buffsAfterReload as Record<string, number>
const bk = res.bank as Record<string, number>, bk2 = res.bankAfterReload as Record<string, number>
const pass = res.made === true && bk.goldwood_log === 24 && bk.raw_mana_shard === 3 && bk2.goldwood_log === 24 && bk2.raw_mana_shard === 3
  && res.tonicSlot === 3 && res.held === true && res.fullDrink === 1 && Math.abs((res.mana as number) - 85) < 3 && res.afterDrink === 0
  && bu?.starlight > Date.now() && res.afterTincture === 0 && ba?.starlight === bu.starlight && errs.length === 0
console.log(pass ? 'PASS: the old Alchemy room retired on load (24 Goldwood Log + 3 Raw Mana Shard in the bank, not paid twice on reload) → Shard Tonic refused at a full bar → drunk at 20 (→ 85) → Starlight Tincture drunk, the buff survives a reload' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
