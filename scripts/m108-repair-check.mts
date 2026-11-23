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
//   P · purse 10,000, reload: E = the counter (quote line + price), Pay -> purse 10,000 - price, toast, record stage1; reload ->
//       stage1 still true, purse still deducted, Kael's line struck in the journal.
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
import { CELL_HOUSING_PRICE, LABEL } from '../src/app/shimmer/open/shared/ship-repair'
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
  const record = () => p.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), REPAIR_KEY) as Promise<{ quoted: boolean; stage1: boolean } | null>
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

  // ── P · enough Marks ──
  await seed({ marks: 10_000 })
  await continent('&ship=gate')
  ok(await toDoor(), 'P1. at the door')
  ok(await talkE(), 'P2. E opens Hollis')
  const bP = await bubble(), oP = await opts()
  ok(bP?.line === HOLLIS_QUOTE[0].line && oP.some(o => o.t === LABEL.pay && !o.off), `P3. the counter: quote line + Pay enabled ("${bP?.line}")`)
  ok(await pick(LABEL.pay), 'P4. clicked Pay')
  ok(await poll(async () => (await marks()) === 10_000 - CELL_HOUSING_PRICE, 8000), `P5. purse 10,000 -> ${await marks()} (-${CELL_HOUSING_PRICE})`)
  ok(!!(await record())?.stage1, 'P6. repair record: stage 1 done')
  ok(await poll(async () => (await p.evaluate(() => document.body.innerText)).includes(LABEL.fitted), 5000), 'P7. the HUD says the housing is fitted')
  await p.screenshot({ path: `${out}/paid-390.png` })
  await continent('&ship=gate')
  ok(!!(await p.evaluate(() => (window as any).__repair?.stage1?.())) && (await marks()) === 10_000 - CELL_HOUSING_PRICE, 'P8. after reload: stage 1 persists, purse still deducted')
  const eP = await entries()
  ok(!!eP.find(e => e.id === 'repair-cell-housing')?.struck && !eP.some(e => e.id === 'repair-cell-entry'), `P9. Kael's line struck, the keeper's entry gone (${JSON.stringify(eP.filter(e => e.id?.startsWith('repair')))})`)

  // ── G · owner, no ?ship=gate ──
  await continent('')
  await toDoor()
  const keys = await p.evaluate(() => (window as any).__market.doors().map((d: any) => d.key)) as string[]
  ok(!keys.includes('front:manatech') && keys.includes('front:corkhouse'), `G1. no ?ship=gate: no manatech door (Rune Hold doors dressed: ${keys.length})`)
  ok(!(await entries()).some(e => e.id?.startsWith('repair-')), 'G2. no ?ship=gate: no ledger line')
  ok(errs.length === 0, `Z. page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
