// BETA M112 s1: the Burrfolk (trader Moglins) on prod at 390x844. npx tsx scripts/m112-burrfolk-check.mts [--url ...] [--out ...]
// Canon: CANON/game/shimmer-folds-settlements.md › THE BURRFOLK (RULED 11-23): a stall in every settlement, never follows,
// dewls only (M159; no Marks, no swaps), wares by the settlement's trade. Barks: batch 11-23b › D5 + 11-25b (SIGNED), pinned below AS TEXT.
//   S · a Burrfolk stall is drawn in 2+ settlements (window.__folk.stalls()), keeper = the generated name
//   G · E at the stall: the talk is on the Burrfolk (name), greet = signed bark 1; NO "keep a room" answer (never follows)
//   B · "Have a look": signed bark 2 + one ware per stock row; goods and too few dewls are REFUSED (bag byte-identical, the signed
//       short line); no room = refused; the exact balance buys one; Marks unchanged; the garden village unchanged
//   L · leaving: the signed leave bark on the HUD
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { folkOf } from '../src/app/shimmer/open/ather/settlement-folk'
import { burrfolkOf, stallSpot, WARES, BURR_LABEL } from '../src/app/shimmer/open/ather/burrfolk'
import { ASK } from '../src/app/shimmer/open/ather/folk-talk'
import type { Network, Settlement } from '../src/app/shimmer/open/ather/network'
import { INV_KEY, itemDef } from '../src/app/shimmer/open/shared/inventory'
import { NEW_LEDGER } from '../src/app/shimmer/open/trade'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m112')
mkdirSync(out, { recursive: true })
let KEY = process.env.OWNER_KEY
if (!KEY && existsSync('.env')) KEY = readFileSync('.env', 'utf8').match(/^OWNER_KEY=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
// ★ SIGNED (athernyx shimmer-lines-batch-2026-11-23b.md › D5, Alex 11-23), as text: prod is checked against the signing
const SIGNED = { greet: 'Wares from all over. Have a look.', stall: 'No coin, only dewls. Take your time.', leave: "Mind the road. I'll be here." }
const LEDGER_KEY = 'ather:trade:trial-ledger'
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }).tiles
const A = net.settlements.find(x => x.id === 's1-10')!, B2 = net.settlements.find(x => x.id === 's1-9')!
const bA = burrfolkOf(A, net.season, folkOf(A, net.season))!, bB = burrfolkOf(B2, net.season, folkOf(B2, net.season))!
const key = bA.stock[0], row = WARES[key], NAME = itemDef(row.product.id).name
console.log(`  stalls: ${bA.name} at ${A.name} (${bA.stock.join('+')}), ${bB.name} at ${B2.name} (${bB.stock.join('+')}); buying ${key} at ${row.price}`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
try {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* */ } })
  if (KEY) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
  await p.evaluate((k, l) => localStorage.setItem(k, JSON.stringify(l)), LEDGER_KEY, { ...NEW_LEDGER, marks: 500 })
  const marks = () => p.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null')?.marks ?? null, LEDGER_KEY) as Promise<number | null>
  const bagRaw = () => p.evaluate(k => localStorage.getItem(k), INV_KEY) as Promise<string | null>
  const countIn = (id: string) => p.evaluate((k, i) => ((JSON.parse(localStorage.getItem(k) ?? 'null')?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, x) => a + (x?.id === i ? x.n : 0), 0), INV_KEY, id) as Promise<number>
  const village = () => p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.endsWith('open.village.v1')); return JSON.stringify((JSON.parse(k ? localStorage.getItem(k) ?? 'null' : 'null')?.moglins ?? []).map((m: { id: string }) => m.id)) })
  const hudHas = (t: string, ms = 5000) => poll(async () => (await p.evaluate(() => document.body.innerText)).includes(t), ms)
  const bubble = () => p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return null; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return { line: (b.firstElementChild?.textContent ?? '').slice(sc.length), name: b.querySelector('[data-talk-name]')?.textContent ?? '' } }) as Promise<{ line: string; name: string } | null>
  const opts = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim())) as Promise<string[]>
  const pick = (label: string) => p.evaluate(l => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim() === l); b?.click(); return !!b }, label)
  const stalls = () => p.evaluate(() => (window as any).__folk?.stalls?.() ?? {}) as Promise<Record<string, { id: string; name: string; x: number; z: number }>>
  async function enterWilds(s: Settlement) {
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(2000)
    const tx = Math.floor((s.x + 500) / 1000), tz = Math.floor((s.z + 500) / 1000), tile = tiles.find(t => t.tx === tx && t.ty === tz)!
    for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
      await p.evaluate((T, x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'm112-check', tile: T, x, y: 0, z, biome: 2, made: 0 } }), tile.name, s.x - tx * 1000, s.z - tz * 1000)
      await sleep(4000)
    }
    await sleep(8000)
  }
  async function toStall(s: Settlement) {
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z), s.x, s.z); await sleep(4000)
    await poll(async () => !!(await stalls())[s.id], 30000)
    await p.mouse.click(200, 420); await sleep(800)
    const sp = stallSpot(s), fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw)   // stand 2.2 m in front of the plank, facing it
    await p.evaluate((x, z, y) => { const g = (window as any).__ather; g.tp(x, z, y); g.look(y, -Math.atan2(1.1, 2.2)) }, sp.x + fx * 2.2, sp.z + fz * 2.2, Math.atan2(fx, fz)); await sleep(1500)   // camera yaw looks along -(sin, cos): this faces the stall
    await p.keyboard.press('KeyE'); await p.mouse.move(5, 5)
    return poll(async () => !!(await p.$('[data-talk-choices]')), 15000)
  }

  // ── S · stalls in 2+ settlements ──
  await enterWilds(A)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z), A.x, A.z)
  const sA = await poll(async () => (await stalls())[A.id]?.name === bA.name, 30000)
  ok(sA, `S1. ${A.name}: a Burrfolk stall, kept by ${bA.name} (${JSON.stringify((await stalls())[A.id] ?? null)})`)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z), B2.x, B2.z)
  const sB = await poll(async () => (await stalls())[B2.id]?.name === bB.name, 30000)
  ok(sB, `S2. ${B2.name}: a Burrfolk stall, kept by ${bB.name} (${JSON.stringify((await stalls())[B2.id] ?? null)})`)
  ok(bA.name !== bB.name, 'S3. two stalls, two names')

  // ── G · the greet; never a room ask (a fresh arrival at A: a 2 km tp back leaves A's ground + folk unstreamed) ──
  await enterWilds(A)
  ok(await toStall(A), `G1. E at ${A.name}'s stall opens a talk`)
  const g = await bubble()
  ok(g?.name === bA.name && g.line === SIGNED.greet, `G2. on ${bA.name}, greet = the signed bark (${JSON.stringify(g)})`)
  ok(await p.evaluate(() => (window as any).__folkTalk?.on) === bA.id, 'G3. the talk is on the Burrfolk (__folkTalk.on)')
  const o0 = await opts()
  ok(!o0.includes(ASK.room) && !o0.includes(ASK.needs) && o0.includes(BURR_LABEL.look), `G4. no "${ASK.room}" (never follows), "${BURR_LABEL.look}" offered (${JSON.stringify(o0)})`)
  await p.screenshot({ path: `${out}/stall-greet-390.png` })

  // ── B · the barter ──
  ok(await pick(BURR_LABEL.look), 'B1. picked "Have a look"'); await sleep(900)
  const b1 = await bubble(), o1 = await opts()
  ok(b1?.line === SIGNED.stall, `B2. stall = the signed bark (${b1?.line})`)
  ok(bA.stock.every(k => o1.includes(BURR_LABEL.swap(k))) && !o1.includes(ASK.room), `B3. one ware per stock row, no room ask (${JSON.stringify(o1)})`)
  const setBag = (slots: { id: string; n: number }[], fill: boolean) => p.evaluate((k, sl, fl) => { const inv = JSON.parse(localStorage.getItem(k) ?? 'null') ?? { v: 1 }; inv.slots = Array.from({ length: 32 }, (_, i) => sl[i] ?? (fl ? { id: 'junk' + i, n: 1 } : null)); localStorage.setItem(k, JSON.stringify(inv)) }, INV_KEY, slots, fill)
  const signedRow = `${NAME} · ${row.price} dewls`, signedShort = `You need ${row.price} dewls for the ${NAME}.`
  ok(o1.includes(signedRow), `B3b. the signed row, as text: "${signedRow}" (${JSON.stringify(o1)})`)
  const again = async (slots: { id: string; n: number }[], fill: boolean) => { await p.keyboard.press('Escape'); await sleep(600); await setBag(slots, fill); await enterWilds(A); const t = await toStall(A); await pick(BURR_LABEL.look); await sleep(900); return t }
  // goods and one dewl too few: refused
  ok(await again([{ id: 'dewl', n: row.price - 1 }, { id: 'goldwood_log', n: 20 }, { id: 'raw_mana_shard', n: 20 }, { id: 'starwillow_branch', n: 20 }, { id: 'goldwood_plank', n: 20 }], false), 'B4. back with goods and one dewl too few')
  const m0 = await marks(), v0 = await village(), raw0 = await bagRaw()
  ok(await pick(signedRow), 'B5. picked it'); await sleep(1200)
  ok(await hudHas(signedShort) && (await bagRaw()) === raw0, `B6. REFUSED: "${signedShort}", the bag byte-identical`)
  await p.screenshot({ path: `${out}/stall-refused-390.png` })
  // no room: refused
  ok(await again([{ id: 'dewl', n: row.price + 1 }], true), 'B7. back with a full bag')
  const rawF = await bagRaw(); await pick(signedRow); await sleep(1200)
  ok(await hudHas(BURR_LABEL.full(key)) && (await bagRaw()) === rawF, `B8. REFUSED: "${BURR_LABEL.full(key)}", the bag byte-identical`)
  // the exact balance
  ok(await again([{ id: 'dewl', n: row.price }], false), 'B9. back with the exact balance')
  const p1 = await countIn(row.product.id); await pick(signedRow); await sleep(1200)
  ok(await poll(async () => (await countIn('dewl')) === 0 && (await countIn(row.product.id)) === p1 + row.product.n, 8000), `B10. exactly ${row.price} dewls -> ${row.product.n} ${row.product.id} (${await countIn('dewl')}, ${await countIn(row.product.id)})`)
  ok(await hudHas(BURR_LABEL.done(key)), `B11. HUD "${BURR_LABEL.done(key)}"`)
  ok((await marks()) === m0 && m0 === 500, `B12. no Marks change (${m0} -> ${await marks()})`)
  ok((await village()) === v0, 'B13. no Moglin moved (the garden village unchanged)')
  await p.screenshot({ path: `${out}/stall-bought-390.png` })

  // ── L · leaving ──
  ok(await pick(ASK.bye), 'L1. picked goodbye')
  ok(await hudHas(SIGNED.leave), `L2. the signed leave bark: "${SIGNED.leave}"`)
  ok(errs.length === 0, `Z. page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
