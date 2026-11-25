// BETA M112 s2: Gleaner + the Burrfolk camp on prod at 390x844. npx tsx scripts/m112-gleaner-check.mts [--url ...] [--out ...]
// Canon: shimmer-folds-settlements.md › THE BURRFOLK; lines batch 11-23b › D1-D4 (SIGNED), pinned below AS TEXT.
// Magii #16993: players meet Gleaner only when M70 ships; until then the post is OWNER-ONLY. Two contexts:
//   P (player) · C the camp is drawn + named · PP1 Gleaner at the post (M70 s1 moved it from owner-only to the first settlement)
//   O (owner)  · C the camp · OP1 Gleaner at the post · OG greet/answers/never follows (D1, D4) · OB a sale (D2, dewls,
//                no Marks) · OD1 the camp POINTER (D3) after the first purchase · OL leave = camp.repeat
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { burrfolkOf, stallSpot, WARES, BURR_LABEL } from '../src/app/shimmer/open/ather/burrfolk'
import { GLEANER_POST, BURR_CAMP } from '../src/app/shimmer/open/ather/gleaner'
import { ASK } from '../src/app/shimmer/open/ather/folk-talk'
import type { Network, Settlement } from '../src/app/shimmer/open/ather/network'
import { INV_KEY } from '../src/app/shimmer/open/shared/inventory'
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
const SIGNED = {   // ★ batch 11-23b › D1-D4, stall + camp 11-25b › A (MAIN), SIGNED, as text
  greet: 'Mind the pack. Everything in it has been somewhere.', have: 'What have you got?', look: 'Just looking.',
  stall: 'Odds and ends. No coin here, only dewls.',
  camp: "If you want the odd finds, our camp's out in the Wilds. All of us gather there, so bring dewls.",
  campRepeat: 'Our camp, out in the Wilds. Go and see.', ask: 'My stall stays and so do I. Feet were never my trade.',
}
const LEDGER_KEY = 'ather:trade:trial-ledger'
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }).tiles
const POST = GLEANER_POST, b = burrfolkOf(POST, 1)!, key = b.stock[0], row = WARES[key]
const CAMP: Settlement = { id: 'camp', name: 'camp', x: BURR_CAMP.x, z: BURR_CAMP.z }
console.log(`  Gleaner post at ${POST.x},${POST.z} (${b.stock.join('+')}); camp at ${BURR_CAMP.x},${BURR_CAMP.z}`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
try {
  for (const owner of [false, true]) {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* */ } })
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 60000 })
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
      await p.evaluate((T, x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'm112s2-check', tile: T, x, y: 0, z, biome: 2, made: 0 } }), tile.name, s.x - tx * 1000, s.z - tz * 1000)
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

    const camp = () => p.evaluate(() => (window as any).__folk?.camp?.() ?? null) as Promise<{ x: number; z: number; label: string; drawn: number | null } | null>
  const W = owner ? 'O' : 'P'
  // ── C · the camp: for every keeper, out in the Wilds where Gleaner's pointer says ──
  await enterWilds(CAMP)
  ok(await poll(async () => (await camp())?.drawn != null, 30000), `${W}C1. the Burrfolk camp is drawn at ${BURR_CAMP.x},${BURR_CAMP.z} (${JSON.stringify(await camp())})`)
  ok(await hudHas('Burrfolk camp', 15000), `${W}C2. walking in names it: "Burrfolk camp"`)
  await p.screenshot({ path: `${out}/camp-${W}-390.png` })
  // ── P · Gleaner's post: owner-only until M70 (Magii #16993) ──
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z), POST.x, POST.z); await sleep(4000)
  const postOn = await poll(async () => (await p.evaluate(() => (window as any).__folk?.gleanerPost?.())) === true, owner ? 20000 : 6000)
  const st = await stalls()
  if (!owner) { ok(postOn && st[POST.id]?.name === 'Gleaner', `PP1. M70 s1: a player sees Gleaner at the first settlement (post ${postOn}, stall ${JSON.stringify(st[POST.id] ?? null)})`) }
  else {
    ok(postOn && st[POST.id]?.name === 'Gleaner', `OP1. the owner sees Gleaner at the post (${JSON.stringify(st[POST.id] ?? null)})`)
    await p.evaluate((k, id, n) => { const inv = JSON.parse(localStorage.getItem(k) ?? 'null') ?? { v: 1, slots: Array(32).fill(null) }; const i = inv.slots.findIndex((x: unknown) => !x); inv.slots[i] = { id, n }; localStorage.setItem(k, JSON.stringify(inv)) }, INV_KEY, 'dewl', row.price + 1)
    await enterWilds(POST)
    ok(await toStall(POST), 'OG1. E at Gleaner opens a talk')
    const g = await bubble(), o0 = await opts()
    ok(g?.name === 'Gleaner' && g.line === SIGNED.greet, `OG2. greet = signed D1 (${JSON.stringify(g)})`)
    ok(o0.includes(SIGNED.have) && o0.includes(SIGNED.look), `OG3. the signed answers (${JSON.stringify(o0)})`)
    ok(await pick(ASK.room), 'OG4. asked along'); await sleep(800)
    ok((await bubble())?.line === SIGNED.ask, `OG5. never follows: signed D4 (${(await bubble())?.line})`)
    await pick(ASK.back); await sleep(800)
    ok(await pick(SIGNED.have), 'OB1. "What have you got?"'); await sleep(900)
    const s1 = await bubble(), o1 = await opts()
    ok(s1?.line === SIGNED.stall && b.stock.every(k => o1.includes(BURR_LABEL.swap(k))), `OB2. signed D2 + a ware per row (${JSON.stringify(o1)})`)
    const m0 = await marks(), w1 = await countIn('dewl'), p1 = await countIn(row.product.id)
    ok(await pick(BURR_LABEL.swap(key)), 'OB3. picked the ware'); await sleep(1500)
    ok(await poll(async () => (await countIn('dewl')) === w1 - row.price && (await countIn(row.product.id)) === p1 + row.product.n, 8000), `OB4. exactly ${row.price} dewls -> ${row.product.n} ${row.product.id}`)
    ok((await marks()) === m0, 'OB5. no Marks change')
    ok(await poll(async () => (await bubble())?.line === SIGNED.camp, 6000), `OD1. the POINTER plays after the first purchase: signed D3 (${(await bubble())?.line})`)
    await p.screenshot({ path: `${out}/gleaner-camp-390.png` })
    ok(await pick(ASK.bye), 'OL1. goodbye')
    ok(await hudHas(SIGNED.campRepeat), `OL2. leave bark = signed camp.repeat`)
  }
  await p.evaluate((k, l) => localStorage.setItem(k, JSON.stringify(l)), LEDGER_KEY, { ...NEW_LEDGER, marks: 500 })
}
  ok(errs.length === 0, `Z. page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
