// ── THE OPENING CHAIN, PLAYED (BETA M73 s1, play-M73, 11-23) ─────────────────────────────────────────────────────────────
// In the real page, two fresh born keepers (separate browser contexts, phone 390x844):
//   A. the note is in the bag; fall once (hook __ather.fall = the fight's 'down') -> while the pack lies, Morel says nothing;
//      walk back onto the pack -> Morel's ping on the HUD WORD FOR WORD, once; RELOAD -> no second ping (state says pinged)
//   B. open the bag, read the note -> its text WORD FOR WORD, The Dig on, no ping owed; open the gate -> Morel's gate hint
//      word for word, the Flip map button pulses; flip -> it stops, Rune Hold's door pulses; a fall + pack back -> no ping
//   C. (s3) read the note, flip, Rune Hold's door -> the continent at Rune Hold; walk into Kael's yard above it -> the chain's
//      yard step, the journal page found in the bag (HUD), its text WORD FOR WORD when read; to the Travelers Station door ->
//      E -> Veyra Unit 1 v2 WORD FOR WORD (scene boxes + lines + the two choices, both asked) -> the send line -> THE SHIP-REPAIR
//      FLAG set (__chain.shipRepair); RELOAD -> still set, and Veyra's bark word for word
//   0 page errors.
// SETUP (stated): born keeper (birthRune) only. Hooks: __ather.fall / tp / state / pack / zone / open (movement + panel
// open + reads); __chain.state / said (READ only).   npx tsx scripts/m73-chain-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { KAEL_INVITE_TEXT } from '../src/app/shimmer/open/shared/kael-invite-lines'
import { MOREL_PING, MOREL_DIG_HINT } from '../src/app/shimmer/open/shared/morel-lines'
import { KAEL_INVITE } from '../src/app/shimmer/open/shared/opening-chain'
import { INV_KEY } from '../src/app/shimmer/open/shared/inventory'
import { KAEL_PAGE } from '../src/app/shimmer/open/shared/opening-chain'
import { KAEL_PAGE_TEXT } from '../src/app/shimmer/open/shared/kael-page-lines'
import { VEYRA_UNIT1, VEYRA_PICK } from '../src/app/shimmer/open/shared/veyra-lines'
import { PAGE_FOUND } from '../src/app/shimmer/open/shared/opening-chain-store'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp'), only = flag('--only', 'ABC')   // --only C: one part
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []

async function keeper(tag: string) {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: false })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* */ } })
  return p
}
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const W = (p: Page) => ({
  zone: () => p.evaluate(() => (window as any).__ather?.zone?.() ?? null) as Promise<string | null>,
  chain: () => p.evaluate(() => (window as any).__chain?.state?.() ?? null) as Promise<any>,
  said: () => p.evaluate(() => (window as any).__chain?.said?.() ?? null) as Promise<string[] | null>,
  pack: () => p.evaluate(() => (window as any).__ather.pack()) as Promise<any>,
  at: () => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px as number, z: s.pz as number } }),
  inv: () => p.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), INV_KEY) as Promise<{ slots: ({ id: string; n: number } | null)[] } | null>,
  text: () => p.evaluate(() => document.body.innerText) as Promise<string>,
})
async function intoWilds(p: Page) {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => (await W(p).zone()) === 'wilds', 240000), 'in the Wilds')
  await poll(async () => p.evaluate(() => typeof (window as any).__ather?.fall === 'function' && typeof (window as any).__ather?.tp === 'function' && !!(window as any).__chain))
  await sleep(3000)
}
async function walkTo(p: Page, x: number, z: number) {
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z), x, z)
  await poll(async () => { const q = await W(p).at(); return Math.hypot(q.x - x, q.z - z) < 0.5 }, 30000)
}
const hasNote = async (p: Page) => ((await W(p).inv())?.slots ?? []).some(s => s?.id === KAEL_INVITE)
async function fallAndRecover(p: Page, tag: string) {
  const w = W(p), a0 = await w.at(), spot = { x: a0.x + 20, z: a0.z - 16 }
  await walkTo(p, spot.x, spot.z)
  await p.evaluate(() => (window as any).__ather.fall())
  ok(await poll(async () => (await w.zone()) === 'plot', 30000), `${tag}: a fall sends the keeper home`)
  const pk = await w.pack()
  ok(!!pk, `${tag}: a pack lies where they fell`)
  ok(await hasNote(p), `${tag}: the note stayed on the keeper (not in the pack)`)
  return pk
}

// ── A: die once, recover the pack, the ping once ──
if (only.includes('A')) {
  const p = await keeper('A'), w = W(p)
  await intoWilds(p)
  ok(await poll(() => hasNote(p), 10000), 'A: the bag holds a note from Kael')
  const c0 = await w.chain()
  ok(c0?.step === 'invite' && !c0.read && !c0.died && !c0.pinged, `A: chain at the invite (${JSON.stringify(c0)})`)
  const pk = await fallAndRecover(p, 'A')
  await sleep(4000)
  ok((await w.said())?.length === 0 && (await w.chain()).died, 'A: died, pack lying: Morel says nothing yet')
  await intoWilds(p)
  await walkTo(p, pk.x, pk.z)
  ok(await poll(async () => (await w.pack()) === null, 20000), 'A: walking onto the pack takes it back')
  ok(await poll(async () => (await w.said())?.includes('ping') ?? false, 6000), 'A: Morel pings once the pack is back')
  const shown = await w.text()
  ok(shown.includes(MOREL_PING.unreadNote), 'A: the ping on the HUD, word for word')
  await p.screenshot({ path: `${out}/m73-a-ping.png` })
  await sleep(3000)
  ok((await w.said())?.filter(s => s === 'ping').length === 1, 'A: the ping said exactly once')
  const c1 = await w.chain()
  ok(c1.pinged && c1.step === 'dig', 'A: pinged, The Dig on')
  await intoWilds(p); await sleep(5000)
  ok((await w.said())?.length === 0 && (await w.chain()).pinged && !(await w.text()).includes(MOREL_PING.unreadNote), 'A: after a reload no second ping')
}

// ── B: read the note first ──
if (only.includes('B')) {
  const p = await keeper('B'), w = W(p)
  await intoWilds(p)
  ok(await poll(() => hasNote(p), 10000), 'B: the bag holds a note from Kael')
  const at = ((await w.inv())?.slots ?? []).findIndex(s => s?.id === KAEL_INVITE)
  await p.keyboard.press('KeyI'); await sleep(1000)
  if (await p.$('[data-pack-go="bag"]')) { await p.click('[data-pack-go="bag"]'); await sleep(700) }
  await p.click(`[data-slot="${at}"]`); await sleep(500)
  await p.click('[data-act="read-invite"]'); await sleep(800)
  const lines = await p.evaluate(() => [...document.querySelectorAll('[data-invite-line]')].map(e => e.textContent))
  ok(JSON.stringify(lines) === JSON.stringify(KAEL_INVITE_TEXT), `B: the note reads word for word (${lines.length} paragraphs)`)
  const fits = await p.evaluate(() => { const r = document.querySelector('[data-invite-note]')!.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth })
  ok(fits, 'B: the note fits the 390 px phone')
  await p.screenshot({ path: `${out}/m73-b-note.png` })
  const c = await w.chain()
  ok(c.read && c.step === 'dig' && !c.pinged, 'B: read early: The Dig on, no ping')
  await p.keyboard.press('Escape'); await sleep(800)
  await p.evaluate(() => (window as any).__ather.open('gate')); await sleep(1200)
  ok((await w.said())?.includes('hint') && (await w.text()).includes(MOREL_DIG_HINT.digFlip), 'B: at the gate Morel says the hint, word for word')
  ok(!!(await p.$('[data-flip-pulse]')), 'B: the Flip map button pulses')
  await p.screenshot({ path: `${out}/m73-b-gate.png` })
  await p.evaluate(() => { [...document.querySelectorAll('[data-panel="fold-map"] button')].find(b => b.textContent === 'Flip map')?.dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await sleep(1000)
  ok(!(await p.$('[data-flip-pulse]')) && (await w.chain()).flipped, 'B: flipped: the button stops pulsing')
  ok(!!(await p.$('[data-dig-door="rune-hold"]')), 'B: Rune Hold\'s door pulses in the Nyx list')
  await p.screenshot({ path: `${out}/m73-b-nyx.png` })
  await p.keyboard.press('Escape'); await sleep(800)
  await intoWilds(p)
  const pk = await fallAndRecover(p, 'B')
  await intoWilds(p); await walkTo(p, pk.x, pk.z)
  await poll(async () => (await w.pack()) === null, 20000); await sleep(3000)
  ok(!(await w.said())?.includes('ping') && (await w.chain()).pinged, 'B: a note read before the death: no ping, ever')
  ok((await w.said())?.filter(s => s === 'hint').length === 0, 'B: the gate hint does not repeat after a reload')
}

// ── C (s3): Rune Hold -> Kael's yard -> the journal page -> Veyra -> THE SHIP-REPAIR FLAG, across a reload ──
if (only.includes('C')) {
  const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
  const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
  const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
  const station = doorsCached(R, 'rune-hold').find(d => d.key === 'front:station')!
  ok(!!station, 'C: the Travelers Station door stands in Rune Hold')
  const p = await keeper('C'), w = W(p)
  await intoWilds(p)
  ok(await poll(() => hasNote(p), 10000), 'C: the bag holds a note from Kael')
  const at = ((await w.inv())?.slots ?? []).findIndex(s => s?.id === KAEL_INVITE)
  await p.keyboard.press('KeyI'); await sleep(1000)
  if (await p.$('[data-pack-go="bag"]')) { await p.click('[data-pack-go="bag"]'); await sleep(700) }
  await p.click(`[data-slot="${at}"]`); await sleep(500)
  await p.click('[data-act="read-invite"]'); await sleep(800)
  await p.keyboard.press('Escape'); await sleep(800)
  await p.evaluate(() => (window as any).__ather.open('gate')); await sleep(1200)
  await p.evaluate(() => { [...document.querySelectorAll('[data-panel="fold-map"] button')].find(b => b.textContent === 'Flip map')?.dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await sleep(1000)
  const c0 = await w.chain()
  ok(c0.step === 'dig' && c0.read && c0.flipped && !c0.page, `C: past s2 (The Dig on, flipped): ${JSON.stringify(c0)}`)
  // through Rune Hold's pulsing door: the continent, at Rune Hold
  await p.evaluate(() => (document.querySelector('[data-dig-door="rune-hold"] button') as HTMLButtonElement)?.click())
  ok(await poll(async () => p.evaluate(() => location.pathname.endsWith('/continent') && !!(window as any).__drive?.footTp && !!(window as any).__shipyards?.sites && !!(window as any).__market && !!(window as any).__chain), 240000), 'C: the Rune Hold door lands on the continent')
  await sleep(3000)
  // the continent's HUD (and its message line) mounts only once the drive starts ("Press any key to drive", page.tsx
  // `started`); a real keeper presses a key to move at all, so a key here, then the line has somewhere to be drawn
  await p.keyboard.press('ShiftLeft'); await sleep(800)
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-hud="messages"]')), 10000), 'C: a key starts the drive: the continent HUD (the message line) is up')
  ok((await w.chain()).step === 'dig', 'C: at Rune Hold the chain is still on The Dig (the yard not reached)')
  const yard = ((await p.evaluate(() => (window as any).__shipyards.sites())) as any[]).find(s => s.key === 'front:shipyard')
  ok(!!yard && yard.inherited, "C: Kael's yard is a site above Rune Hold")
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 20, z + 20, 0, 0), yard.x, yard.z); await sleep(4000)
  await p.evaluate((x, z) => (window as any).__drive.footTp(x, z, 0, -0.1), yard.x, yard.z)
  ok(await poll(async () => (await w.chain())?.step === 'yard', 20000), "C: inside Kael's yard: the chain's yard step")
  let hudSeen = false   // the item line can be replaced by the next item line (a door in reach), so watch for it while waiting
  ok(await poll(async () => { if ((await w.text()).includes(PAGE_FOUND)) hudSeen = true; return ((await w.inv())?.slots ?? []).some(s => s?.id === KAEL_PAGE) }, 10000), 'C: the journal page is found: in the bag')
  for (let t = 0; t < 6 && !hudSeen; t++) { if ((await w.text()).includes(PAGE_FOUND)) hudSeen = true; else await sleep(500) }
  ok((await w.chain()).page && hudSeen, `C: the HUD says so ("${PAGE_FOUND}")`)
  try { await p.screenshot({ path: `${out}/m73-c-yard.png` }) } catch { /* slow frame */ }
  // read it in the bag
  const pat = ((await w.inv())?.slots ?? []).findIndex(s => s?.id === KAEL_PAGE)
  await p.keyboard.press('KeyI'); await sleep(1000)
  if (await p.$('[data-pack-go="bag"]')) { await p.click('[data-pack-go="bag"]'); await sleep(700) }
  await p.click(`[data-slot="${pat}"]`); await sleep(500)
  await p.click('[data-act="read-kael-page"]'); await sleep(800)
  const plines = await p.evaluate(() => [...document.querySelectorAll('[data-kael-page-line]')].map(e => e.textContent))
  ok(JSON.stringify(plines) === JSON.stringify(KAEL_PAGE_TEXT), `C: the page reads word for word (${plines.length} paragraphs)`)
  ok(await p.evaluate(() => { const r = document.querySelector('[data-kael-page]')!.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth }), 'C: the page fits the 390 px phone')
  try { await p.screenshot({ path: `${out}/m73-c-page.png` }) } catch { /* slow frame */ }
  ok((await w.chain()).pageRead && !(await p.evaluate(() => (window as any).__chain.shipRepair())), 'C: page read: Veyra next, the flag not yet set')
  await p.keyboard.press('Escape'); await sleep(800)
  // to Veyra at the Travelers Station
  // door-folk-check's approach: out along the building's yaw, facing it with the same yaw convention
  const fx = Math.cos(station.b.yaw), fz = Math.sin(station.b.yaw), yaw = Math.atan2(fx, fz)
  const toStation = async () => {
    await p.evaluate((x, z) => (window as any).__drive.tp(x + 25, z + 25, 0, 0), station.at.x, station.at.z); await sleep(4000)
    await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), station.at.x + fx * 0.8, station.at.z + fz * 0.8, yaw)
    const r = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:station', 30000)
    if (!r) console.log('  diag:', JSON.stringify({ door: station.at, b: { x: station.b.x, z: station.b.z, yaw: station.b.yaw }, foot: await p.evaluate(() => { const f = (window as any).__drive.foot(); return { x: f.px, y: f.py, z: f.pz } }), reach: await p.evaluate(() => (window as any).__market.reach()) }))
    return r
  }
  ok(await toStation(), 'C: at the Travelers Station door')
  await p.keyboard.press('KeyE')
  const bubble = () => p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return null; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return { scene: sc, line: (b.firstElementChild?.textContent ?? '').slice(sc.length), name: b.querySelector('[data-talk-name]')?.textContent ?? '' } }) as Promise<{ scene: string; line: string; name: string } | null>
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, ''))) as Promise<string[]>
  const pick = (label: string) => p.evaluate(l => { const b = [...document.querySelectorAll('[data-talk-option]')].find(e => (e.textContent ?? '').replace(/^›/, '') === l) as HTMLButtonElement | undefined; b?.click(); return !!b }, label)
  const beat = async (k: keyof typeof VEYRA_UNIT1, then: string, want?: string[]) => {
    const want1 = VEYRA_UNIT1[k]
    const got = await poll(async () => { const b = await bubble(); return !!b && b.line === want1.line }, 10000)
    const b = await bubble()
    ok(got && b!.scene === (want1.scene ?? '') && b!.name === 'Veyra', `C: Veyra ${k} word for word ("${b?.line}"${b?.scene ? `, scene "${b.scene}"` : ''})`)
    if (want) ok(JSON.stringify(await opts()) === JSON.stringify(want), `C: the keeper's answers at ${k}: ${JSON.stringify(await opts())}`)
    ok(await pick(then), `C: picked "${then}" at ${k}`); await sleep(500)
  }
  await beat('open', VEYRA_PICK.next)
  try { await p.screenshot({ path: `${out}/m73-c-veyra.png` }) } catch { /* slow frame */ }
  await beat('kaels', VEYRA_PICK.asked, [VEYRA_PICK.asked, VEYRA_PICK.where])
  await beat('asked1', VEYRA_PICK.next)
  ok(!(await p.evaluate(() => (window as any).__chain.shipRepair())), 'C: mid-talk: the flag not yet set')
  await beat('asked2', VEYRA_PICK.where, [VEYRA_PICK.where, VEYRA_PICK.next])
  await beat('where1', VEYRA_PICK.next)
  await beat('where2', VEYRA_PICK.next, [VEYRA_PICK.next])
  const sendShown = await poll(async () => (await bubble())?.line === VEYRA_UNIT1.send.line, 10000)
  ok(sendShown && await p.evaluate(() => (window as any).__chain.shipRepair()) === true && (await w.chain()).step === 'repair', 'C: the send line: THE SHIP-REPAIR FLAG is set')
  await beat('send', VEYRA_PICK.next)
  ok(await poll(async () => (await bubble()) === null, 5000), 'C: the talk closes after the send')
  // reload: the flag persists; Veyra barks
  await p.reload({ waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => p.evaluate(() => !!(window as any).__drive?.footTp && !!(window as any).__market && !!(window as any).__chain), 240000), 'C: reloaded')
  await sleep(3000)
  ok(await p.evaluate(() => (window as any).__chain.shipRepair()) === true && (await w.chain()).step === 'repair', 'C: after a reload THE SHIP-REPAIR FLAG is still set')
  ok(await toStation(), 'C: back at the Station door')
  await p.keyboard.press('KeyE')
  await beat('bark', VEYRA_PICK.next)
  ok(await poll(async () => !!(await p.$('[data-shop="station"]')), 10000), "C: after her bark the Station's own panel opens")
  try { await p.screenshot({ path: `${out}/m73-c-bark.png` }) } catch { /* slow frame */ }
}

ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `m73-chain-check: ${fails} FAIL` : 'm73-chain-check: PASS')
process.exit(fails ? 1 : 0)
