// ── BETA M108 s1: KAEL'S SHIP, REPAIR STAGE 1, THE CELL HOUSING AT HOLLIS (owner-only ?ship=gate; shared/ship-repair.ts) ───────
// SETUP (stated): a fresh keeper in its own browser context (owner unlocked, birth rune seeded), never a real keeper's save. The
// ship-repair flag (M73) and the purse are SEEDED in localStorage (open.chain.v1 step 'repair'; ather:trade:trial-ledger marks):
// the chain itself is proven by m73-chain-check. Hooks MOVE (__drive.tp / footTp) and READ (__market, __repair, localStorage).
// Every talk answer is a real click on the talk buttons; E at the door is the real key. 390x844 throughout.
//   N · owner + flag on, NO ship-repair flag: Hollis's door is in reach, E = Hollis's ambient bark only, no Pay offered, no
//       ledger line in the journal, no repair record written.
//   S · flag set, purse SHORT (1,000): the journal shows Kael's open line (word for word) + "Take Kael's page..."; E plays Unit 3
//       word for word (3 lines + scenes, then the quote with the price chip); Pay is shown DISABLED; a forced click does nothing;
//       purse unchanged, record quoted only; the entry has turned to "Earn the Marks..."; E again = the short bark.
//   R · (s2) still quoted, no housing, at Franky in Kael's yard: the E verb is 'board', E = "not ready" on the HUD, NO
//       destination map, record unchanged.
//   P · purse 10,000, reload: E = the counter (quote line + price), Pay -> purse 10,000 - price, toast "in your bag", record
//       MADE but NOT stage1, the housing in the bag; reload -> still made / not stage1, purse still deducted, housing still in
//       the bag, Kael's line NOT struck, the keeper's entry = "Fit the cell housing at Kael's yard." (s2 changed P6-P9)
//   F · (s2) at Franky with the housing: the prompt reads "E · Fit the cell housing"; E -> record stage1, the housing used up,
//       toast "fitted", no map on that E; reload -> stage 1 persists, housing still gone, Kael's line struck, the entry gone;
//       E at Franky again -> the destination map opens with canon's three.
//       ★ s3 RE-MEANT F7-F9 (were "fitted: plain board, E = the map, canon's three"): the fit leaves the cells EMPTY (canon
//       83b6870), so now: Kael's ledger shows its next line (LEDGER_CHARGE_LINE) + the keeper's "Trade with a Digger..." entry;
//       E at Franky = the "cells are empty" line, NO map. The map asserts moved to C (after the first charge).
//   T · (s3) the Digger's trade, in the Ather (Bryonydell, the first settlement on the opening path, DIGGER_SURE): talk to the
//       Digger, NO planks: the trade answer is offered, picking it is REFUSED (bag unchanged, the "need" line); with 6 Goldwood
//       Plank: three trades -> 3 Raw Mana Shards in the bag, 0 planks; no Moglin leaves (the village unchanged).
//   C · (s3) at Franky with 3 shards: the prompt reads "E · Charge the cells"; E -> record charged, the shards used up, toast,
//       no map on that E; reload -> charged persists, Kael's charge line struck, the entry gone; E -> the destination map with
//       canon's three (?ship=gate, no override).
//   G · owner WITHOUT ?ship=gate: the manatech door is not among the dressed doors.
// PASS = all of that + 0 page errors.   npx tsx scripts/m108-repair-check.mts [--url https://ather.games] [--out /tmp/m108]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { NEW_LEDGER } from '../src/app/shimmer/open/trade'
import { newChain } from '../src/app/shimmer/open/shared/opening-chain'
import { CELL_HOUSING_PRICE, CELL_HOUSING, LABEL, RAW_SHARD, FIRST_CHARGE_SHARDS, LEDGER_CHARGE_LINE } from '../src/app/shimmer/open/shared/ship-repair'
import { folkOf, DIGGER_SURE } from '../src/app/shimmer/open/ather/settlement-folk'
import { builtFolkSpots } from '../src/app/shimmer/open/ather/settlement-lots'
import { DIGGER_LABEL, DIGGER_TRADE } from '../src/app/shimmer/open/ather/digger-trade'
import { ASK } from '../src/app/shimmer/open/ather/folk-talk'
import type { Network } from '../src/app/shimmer/open/ather/network'
import { DESTINATIONS } from '../src/app/shimmer/open/continent/destination-map'
import { INV_KEY } from '../src/app/shimmer/open/shared/inventory'
import { HOLLIS_FIRST, HOLLIS_QUOTE, HOLLIS_BARK, LEDGER_CELL_LINE, ENTRY_TAKE_PAGE, ENTRY_EARN_MARKS } from '../src/app/shimmer/open/shared/hollis-lines'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m108')
mkdirSync(out, { recursive: true })
// the owner key: the env, else the repo's .env (read here, never echoed)
let KEY = process.env.OWNER_KEY
if (!KEY && existsSync('.env')) KEY = readFileSync('.env', 'utf8').match(/^OWNER_KEY=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
if (!KEY) { console.error('OWNER_KEY not set'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const door = doorsCached(R, 'rune-hold').find(d => d.key === 'front:manatech')
if (!door) { console.log('FAIL: no manatech door in Rune Hold'); process.exit(1) }
const at = shopDoorPoint(door.b)
const LEDGER_KEY = 'ather:trade:trial-ledger', CHAIN_KEY = 'open.chain.v1', REPAIR_KEY = 'open.repair.v1'
const FLAG_CHAIN = { ...newChain(), step: 'repair', read: true, page: true, pageRead: true }

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
try {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* */ } })
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
  const own = await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner).catch(() => false))
  ok(own, '0. the browser is the owner (/api/owner)')
  const seed = (o: { chain?: unknown; marks?: number }) => p.evaluate((ck, c, lk, l) => {
    if (c) localStorage.setItem(ck, JSON.stringify(c))
    if (l) localStorage.setItem(lk, JSON.stringify(l))
  }, CHAIN_KEY, o.chain ?? null, LEDGER_KEY, o.marks === undefined ? null : { ...NEW_LEDGER, marks: o.marks })
  const marks = () => p.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null')?.marks ?? null, LEDGER_KEY) as Promise<number | null>
  const record = () => p.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), REPAIR_KEY) as Promise<{ quoted: boolean; made?: boolean; stage1: boolean } | null>
  const countIn = (id: string) => p.evaluate((k, i) => ((JSON.parse(localStorage.getItem(k) ?? 'null')?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, x) => a + (x?.id === i ? x.n : 0), 0), INV_KEY, id) as Promise<number>
  const housings = () => p.evaluate((k, id) => ((JSON.parse(localStorage.getItem(k) ?? 'null')?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, x) => a + (x?.id === id ? x.n : 0), 0), INV_KEY, CELL_HOUSING) as Promise<number>
  const hudHas = (t: string, ms = 5000) => poll(async () => (await p.evaluate(() => document.body.innerText)).includes(t), ms)
  const mapOpen = () => p.evaluate(() => !!document.querySelector('[data-panel="destination-map"]'))
  // Franky at Kael's yard (the destination-map-check's spot: 1.5 m off her starboard beam, facing her); returns the E verb + its text
  const KAEL = 'front:shipyard'
  const toW = (s: any, lx: number, lz: number) => ({ x: s.x + s.ax[0] * lx + s.az[0] * lz, z: s.z + s.ax[1] * lx + s.az[1] * lz })
  async function besideFranky() {
    await p.waitForFunction(() => !!(window as any).__shipyards?.sites, { timeout: 120000 })
    const s = (await p.evaluate(() => (window as any).__shipyards.sites()) as any[]).find(q => q.key === KAEL)
    if (!s) return { verb: null, text: null }
    const g = toW(s, 3 + s.ramp.L + 2.5, -52)
    await p.evaluate((a, b) => { (window as any).__drive.footTp(a, b, 0, -0.2) }, g.x, g.z)
    if (!await poll(async () => !!(await p.evaluate((k: string) => (window as any).__shipyards?.[k]?.ship?.(), KAEL)), 120000)) return { verb: null, text: null }
    const ship = await p.evaluate((k: string) => (window as any).__shipyards[k].ship(), KAEL)
    const at = toW(s, ship.lx + 3.5 + 1.5, ship.lz), mid = toW(s, ship.lx, ship.lz), yaw = Math.atan2(-(mid.x - at.x), -(mid.z - at.z))
    await p.evaluate((a, b, w) => { (window as any).__drive.footTp(a, b, w, -0.1); (window as any).__drive.look(w, -0.1) }, at.x, at.z, yaw)
    await poll(async () => !!(await p.evaluate(() => document.querySelector('[data-yard-prompt]'))), 8000)
    return p.evaluate(() => { const e = document.querySelector('[data-yard-prompt]'); return { verb: e?.getAttribute('data-yard-prompt') ?? null, text: e?.textContent ?? null } })
  }
  const tapE = async () => { await p.keyboard.down('KeyE'); await sleep(80); await p.keyboard.up('KeyE'); await sleep(1500) }
  const bubble = () => p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return null; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return { scene: sc, line: (b.firstElementChild?.textContent ?? '').slice(sc.length), name: b.querySelector('[data-talk-name]')?.textContent ?? '' } }) as Promise<{ scene: string; line: string; name: string } | null>
  const opts = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].map(e => ({ t: (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim(), off: e.hasAttribute('data-talk-disabled') }))) as Promise<{ t: string; off: boolean }[]>
  const pick = (label: string) => p.evaluate(l => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim() === l); b?.click(); return !!b }, label)
  const entries = async () => { await p.keyboard.press('KeyJ'); await sleep(1200)
    const e = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-entry]')].map(x => ({ id: x.dataset.entry, title: (x.querySelector('button span:nth-child(2)') as HTMLElement | null)?.innerText.trim() ?? '', struck: ((x.querySelector('button span:nth-child(2)') as HTMLElement | null)?.style.textDecoration ?? '').includes('line-through') })))
    await p.keyboard.press('KeyJ'); await sleep(600); return e }
  async function continent(q: string) {
    await p.goto(`${url}/shimmer/open/continent?hour=12${q}`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2500)
    await p.keyboard.press('ShiftLeft'); await sleep(400); await p.keyboard.press('KeyW'); await sleep(500)
  }
  async function toDoor() {
    const b = door!.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
    await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door!.at.x, door!.at.z); await sleep(6000)
    await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(5000)
    return poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:manatech', 30000)
  }
  const talkE = async () => { await p.keyboard.press('KeyE'); return poll(async () => !!(await bubble()), 10000) }
  const leave = async () => { await pick(LABEL.leave); await sleep(600) }

  // ── N · gate on, no ship-repair flag ──
  await seed({ chain: newChain(), marks: 10_000 })
  await continent('&ship=gate')
  ok(await toDoor(), 'N1. the manatech door is in reach (owner + ?ship=gate)')
  ok(await talkE(), 'N2. E at the door opens a talk')
  const bN = await bubble(), oN = await opts()
  ok(bN?.name === 'Hollis' && bN.line === HOLLIS_BARK.ambient, `N3. Hollis, ambient bark only ("${bN?.name}": "${bN?.line}")`)
  ok(!oN.some(o => o.t === LABEL.pay), `N4. no order offered without the flag (${JSON.stringify(oN.map(o => o.t))})`)
  await leave()
  const eN = await entries()
  ok(!eN.some(e => e.id?.startsWith('repair-')), `N5. no ledger line without the flag (${JSON.stringify(eN.map(e => e.id))})`)
  ok((await record()) === null && (await marks()) === 10_000, 'N6. no repair record, purse untouched')

  // ── S · flag set, short purse ──
  await seed({ chain: FLAG_CHAIN, marks: 1_000 })
  await continent('&ship=gate')
  const eS = await entries()
  const kael = eS.find(e => e.id === 'repair-cell-housing'), mine = eS.find(e => e.id === 'repair-cell-entry')
  ok(kael?.title === LEDGER_CELL_LINE && !kael.struck, `S1. the ledger shows stage 1, word for word ("${kael?.title}")`)
  ok(mine?.title === ENTRY_TAKE_PAGE, `S2. the keeper's entry: "${mine?.title}"`)
  ok(await toDoor(), 'S3. at the door')
  ok(await talkE(), 'S4. E opens Hollis')
  for (let i = 0; i < HOLLIS_FIRST.length; i++) {
    const b = await bubble()
    ok(b?.line === HOLLIS_FIRST[i].line && (b?.scene ?? '') === (HOLLIS_FIRST[i].scene ?? ''), `S5.${i} shop:first line ${i} word for word ("${b?.line}")`)
    await pick('…'); await sleep(500)
  }
  for (let i = 0; i < HOLLIS_QUOTE.length; i++) {
    const b = await bubble(), chip = await p.evaluate(() => document.querySelector('[data-repair-price]')?.textContent ?? null)
    ok(b?.line === HOLLIS_QUOTE[i].line && chip === LABEL.price, `S6.${i} shop:quote line ${i} + price chip ("${b?.line}" · ${chip})`)
    if (i === 0) await p.screenshot({ path: `${out}/quote-390.png` })
    if (i + 1 < HOLLIS_QUOTE.length) { await pick('…'); await sleep(500) }
  }
  const oS = await opts(), payS = oS.find(o => o.t === LABEL.pay)
  ok(!!payS && payS.off, `S7. Pay shown, DISABLED on a short purse (${JSON.stringify(oS)})`)
  await pick(LABEL.pay); await sleep(1200)
  ok((await marks()) === 1_000, `S8. refused: nothing deducted (${await marks()})`)
  const rS = await record()
  ok(!!rS && rS.quoted && !rS.stage1, `S9. record = quoted, not stage 1 (${JSON.stringify(rS)})`)
  await leave()
  ok((await entries()).find(e => e.id === 'repair-cell-entry')?.title === ENTRY_EARN_MARKS, 'S10. the entry turned to "Earn the Marks..."')
  // the talk camera turned to Hollis's face (beside the door), so the crosshair left the door: aim at it again, as a player would
  ok(await toDoor(), 'S11. at the door again')
  ok(await talkE(), 'S11. E again')
  ok((await bubble())?.line === HOLLIS_BARK.short, `S12. the short bark ("${(await bubble())?.line}")`)
  await p.keyboard.press('Escape'); await sleep(600)

  // ── R · (s2) quoted, no housing: Franky is not ready, no map ──
  await continent('&ship=gate')
  const fR = await besideFranky()
  ok(fR.verb === 'board' && fR.text !== LABEL.fitPrompt, `R1. at Franky, no housing: the E verb is 'board' (${JSON.stringify(fR)})`)
  await tapE()
  ok(await hudHas(LABEL.notReady), `R2. E at Franky = "${LABEL.notReady}"`)
  ok(!(await mapOpen()), 'R3. no destination map before the housing is fitted')
  const rR = await record()
  ok(!!rR && rR.quoted && !rR.made && !rR.stage1 && (await housings()) === 0, `R4. record unchanged, nothing in the bag (${JSON.stringify(rR)})`)
  await p.screenshot({ path: `${out}/not-ready-390.png` })

  // ── P · enough Marks ──
  await seed({ marks: 10_000 })
  await continent('&ship=gate')
  ok(await toDoor(), 'P1. at the door')
  ok(await talkE(), 'P2. E opens Hollis')
  const bP = await bubble(), oP = await opts()
  ok(bP?.line === HOLLIS_QUOTE[0].line && oP.some(o => o.t === LABEL.pay && !o.off), `P3. the counter: quote line + Pay enabled ("${bP?.line}")`)
  ok(await pick(LABEL.pay), 'P4. clicked Pay')
  ok(await poll(async () => (await marks()) === 10_000 - CELL_HOUSING_PRICE, 8000), `P5. purse 10,000 -> ${await marks()} (-${CELL_HOUSING_PRICE})`)
  const rP = await record()
  ok(!!rP && rP.made === true && !rP.stage1 && (await poll(async () => (await housings()) === 1, 5000)), `P6. record MADE, stage 1 NOT yet; the housing in the bag (${JSON.stringify(rP)} · ${await housings()})`)
  ok(await hudHas(LABEL.made), `P7. the HUD says "${LABEL.made}"`)
  await p.screenshot({ path: `${out}/paid-390.png` })
  await continent('&ship=gate')
  ok((await p.evaluate(() => (window as any).__repair?.state?.())) ?.made === true && !(await p.evaluate(() => (window as any).__repair?.stage1?.())) && (await marks()) === 10_000 - CELL_HOUSING_PRICE && (await housings()) === 1, 'P8. after reload: made persists, stage 1 not done, purse still deducted, housing still in the bag')
  const eP = await entries()
  ok(!eP.find(e => e.id === 'repair-cell-housing')?.struck && eP.find(e => e.id === 'repair-cell-entry')?.title === LABEL.fitEntry, `P9. Kael's line NOT struck yet, the keeper's entry = "${LABEL.fitEntry}" (${JSON.stringify(eP.filter(e => e.id?.startsWith('repair')))})`)

  // ── F · (s2) fit it at the yard, then board ──
  const fF = await besideFranky()
  ok(fF.verb === 'board' && fF.text === LABEL.fitPrompt, `F1. at Franky with the housing: "${LABEL.fitPrompt}" (${JSON.stringify(fF)})`)
  await tapE()
  ok(await poll(async () => !!(await record())?.stage1, 5000), `F2. E = fitted: record stage 1 (${JSON.stringify(await record())})`)
  ok((await poll(async () => (await housings()) === 0, 5000)) && await hudHas(LABEL.fitted), `F3. the housing used up (${await housings()}), HUD "${LABEL.fitted}"`)
  ok(!(await mapOpen()), 'F4. the fitting E does not also open the map')
  await p.screenshot({ path: `${out}/fitted-390.png` })
  await continent('&ship=gate')
  ok(!!(await p.evaluate(() => (window as any).__repair?.stage1?.())) && (await housings()) === 0, 'F5. after reload: stage 1 persists, the housing still gone')
  const eF = await entries()
  ok(!!eF.find(e => e.id === 'repair-cell-housing')?.struck && !eF.some(e => e.id === 'repair-cell-entry'), `F6. Kael's line struck, the keeper's entry gone (${JSON.stringify(eF.filter(e => e.id?.startsWith('repair')))})`)
  ok(!!eF.find(e => e.id === 'repair-cell-charge' && e.title === LEDGER_CHARGE_LINE && !e.struck) && eF.find(e => e.id === 'repair-charge-entry')?.title === LABEL.chargeEntry, `F7. (s3) Kael's next line "${LEDGER_CHARGE_LINE}" + the keeper's "${LABEL.chargeEntry}" (${JSON.stringify(eF.filter(e => e.id?.startsWith('repair')))})`)
  const fB = await besideFranky()
  ok(fB.verb === 'board' && fB.text !== LABEL.fitPrompt && fB.text !== LABEL.chargePrompt, `F8. at Franky, fitted, no shards: plain 'board' (${JSON.stringify(fB)})`)
  await tapE()
  ok(await hudHas(LABEL.empty) && !(await mapOpen()), `F9. (s3 RE-MEANT) E at Franky without the charge = "${LABEL.empty}", NO destination map`)
  ok((await record())?.charged !== true, 'F10. record not charged')

  // ── T · (s3) the Digger's trade in the Ather ──
  const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
  const st = net.settlements.find(x => x.id === DIGGER_SURE[0])!, folk = folkOf(st, net.season), dig = folk.find(f => f.profession === 'digger')!
  const spot = builtFolkSpots(st, folk, net.season).find(q => q.id === dig.id)!
  const tx = Math.floor((st.x + 500) / 1000), tz = Math.floor((st.z + 500) / 1000)
  const tile = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }).tiles.find(t => t.tx === tx && t.ty === tz)!
  console.log(`  digger: ${dig.name} at ${st.name} (${st.id})`)
  const village = () => p.evaluate(() => localStorage.getItem('open.village.v1'))
  async function toDigger() {
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(2000)
    for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
      await p.evaluate((T, x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'm108-check', tile: T, x, y: 0, z, biome: 2, made: 0 } }), tile.name, st.x - tx * 1000, st.z - tz * 1000)
      await sleep(4000)
    }
    await sleep(8000)
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z), st.x, st.z); await sleep(4000)
    await p.mouse.click(200, 420); await sleep(800)
    const L = Math.hypot(st.x - spot.x, st.z - spot.z), ux = L > 0.1 ? (st.x - spot.x) / L : 0, uz = L > 0.1 ? (st.z - spot.z) / L : 1
    await p.evaluate((x, z, y) => { const g = (window as any).__ather; g.tp(x, z, y); g.look(y, -Math.atan2(1.1, 2)) }, spot.x + ux * 2, spot.z + uz * 2, Math.atan2(ux, uz)); await sleep(1500)
    await p.keyboard.press('KeyE'); await p.mouse.move(5, 5)
    if (!await poll(async () => !!(await p.$('[data-talk-choices]')), 15000)) return false
    for (let k = 0; k < folk.length && (await bubble())?.name !== dig.name; k++) { if (!(await pick(ASK.others))) break; await sleep(800) }
    return (await bubble())?.name === dig.name
  }
  const v0 = await village()
  ok(await toDigger(), `T1. in ${st.name}, talking to the Digger ${dig.name}`)
  ok((await opts()).some(o => o.t === DIGGER_LABEL.trade), `T2. the trade is offered: "${DIGGER_LABEL.trade}" (${JSON.stringify((await opts()).map(o => o.t))})`)
  const bag0 = await p.evaluate(k => localStorage.getItem(k), INV_KEY)
  ok(await pick(DIGGER_LABEL.trade), 'T3. no planks: picked the trade')
  await sleep(1200)
  ok(await hudHas(DIGGER_LABEL.short) && (await p.evaluate(k => localStorage.getItem(k), INV_KEY)) === bag0 && (await countIn(RAW_SHARD)) === 0, `T4. refused: "${DIGGER_LABEL.short}", the bag unchanged, no shard`)
  await p.screenshot({ path: `${out}/digger-refused-390.png` })
  await p.evaluate((k, id) => { const inv = JSON.parse(localStorage.getItem(k)!); const i = inv.slots.findIndex((x: unknown) => !x); inv.slots[i] = { id, n: 6 }; localStorage.setItem(k, JSON.stringify(inv)) }, INV_KEY, DIGGER_TRADE.want.id)
  ok(await toDigger(), 'T5. back at the Digger with 6 Goldwood Plank')
  for (let i = 0; i < FIRST_CHARGE_SHARDS; i++) { await pick(DIGGER_LABEL.trade); await sleep(1200) }
  ok(await poll(async () => (await countIn(RAW_SHARD)) === FIRST_CHARGE_SHARDS && (await countIn(DIGGER_TRADE.want.id)) === 0, 8000), `T6. three trades: ${await countIn(RAW_SHARD)} Raw Mana Shards in the bag, ${await countIn(DIGGER_TRADE.want.id)} planks left`)
  ok(await hudHas(DIGGER_LABEL.done), `T7. the HUD says "${DIGGER_LABEL.done}"`)
  ok((await village()) === v0, 'T8. no Moglin leaves: the garden village unchanged')
  await p.screenshot({ path: `${out}/digger-traded-390.png` })
  await p.keyboard.press('Escape'); await sleep(600)

  // ── C · (s3) the first charge at Franky, then board ──
  await continent('&ship=gate')
  ok((await entries()).find(e => e.id === 'repair-charge-entry')?.title === LABEL.chargeEntryReady, `C1. the entry turned to "${LABEL.chargeEntryReady}"`)
  const fC = await besideFranky()
  ok(fC.verb === 'board' && fC.text === LABEL.chargePrompt, `C2. at Franky with the shards: "${LABEL.chargePrompt}" (${JSON.stringify(fC)})`)
  await tapE()
  ok(await poll(async () => !!(await record())?.charged, 5000), `C3. E = the first charge: record charged (${JSON.stringify(await record())})`)
  ok((await poll(async () => (await countIn(RAW_SHARD)) === 0, 5000)) && await hudHas(LABEL.charged), `C4. the shards used up (${await countIn(RAW_SHARD)}), HUD "${LABEL.charged}"`)
  ok(!(await mapOpen()), 'C5. the charging E does not also open the map')
  await p.screenshot({ path: `${out}/charged-390.png` })
  await continent('&ship=gate')
  ok(!!(await p.evaluate(() => (window as any).__repair?.charged?.())) && (await countIn(RAW_SHARD)) === 0, 'C6. after reload: the first charge persists, the shards still gone')
  const eC = await entries()
  ok(!!eC.find(e => e.id === 'repair-cell-charge')?.struck && !eC.some(e => e.id === 'repair-charge-entry'), `C7. Kael's charge line struck, the entry gone (${JSON.stringify(eC.filter(e => e.id?.startsWith('repair')))})`)
  const fM = await besideFranky()
  ok(fM.verb === 'board' && fM.text !== LABEL.chargePrompt, `C8. at Franky, charged: plain 'board' (${JSON.stringify(fM)})`)
  await tapE()
  ok(await poll(mapOpen, 5000), 'C9. E at Franky = the destination map opens (follows the record, ?ship=gate, no override)')
  const list = await p.evaluate(() => [...document.querySelectorAll('[data-dest]')].map(e => e.textContent))
  ok(JSON.stringify(list) === JSON.stringify(DESTINATIONS.map(d => d.label)), `C10. canon's three, word for word (${JSON.stringify(list)})`)
  await p.screenshot({ path: `${out}/map-390.png` })
  await p.keyboard.press('Escape'); await sleep(600)

  // ── G · owner, no ?ship=gate ──
  await continent('')
  await toDoor()
  const keys = await p.evaluate(() => (window as any).__market.doors().map((d: any) => d.key)) as string[]
  ok(!keys.includes('front:manatech') && keys.includes('front:corkhouse'), `G1. no ?ship=gate: no manatech door (Rune Hold doors dressed: ${keys.length})`)
  ok(!(await entries()).some(e => e.id?.startsWith('repair-')), 'G2. no ?ship=gate: no ledger line')
  ok(errs.length === 0, `Z. page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
