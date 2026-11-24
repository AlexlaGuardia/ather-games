// ── BETA M126 s2: IDLE SKITS, PLAYED AT 390x844 AS A NON-OWNER ───────────────────────────────────────────────────────
// SETUP (stated): 3 bloomed spirits on 3 Spirit Beds (pa Vulnyx, pb Vulnyx, pc Manalotl), all three FOLLOWING, a Mana'mal
// out (Gemdigger). Open ground, no walls. Hooks: __ather.tp (place the keeper once), __formation (the slots, where each
// really stands), __skits (read-only probe, shared/idle-skits.ts: on, plan, lying, framed).
//  1. The formation holds 4 and they come to their slots.
//  2. No input past the idle threshold (25 s): skits start; distinct moments (the Mana'mal lies, the spirits play / sniff).
//  3. While idle: the Mana'mal is LYING (nap > 0.8); a spirit is more than 1.5 m from its slot; the camera framed a follower.
//  4. One key press: skits off, every follower back within 0.65 m of its slot inside ~2 s (2.5 s allowed).
//  5. 0 page errors.
//   npx tsx scripts/m126-skits-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m126-skits')
mkdirSync(out, { recursive: true })
const BEDS = ['pa', 'pb', 'pc'].map((id, k) => ({ id, item: 'spirit_planter', x: -146, z: 90 + k * 3, q: 0, placedAt: 1 }))
const at0 = Date.now() - 20 * 86400000
const POTS = {
  pa: { seed: 'mana_seed_fox', at: at0, v: 2, tends: [], bloomed: true },
  pb: { seed: 'mana_seed_fox', at: at0 + 1, v: 2, tends: [], bloomed: true },
  pc: { seed: 'mana_seed_axolotl', at: at0 + 2, v: 2, tends: [], bloomed: true },
}
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
type V = { x: number; z: number }
type F = { stopped: boolean; keeper: V; members: { id: string; kind: string }[]; pos: Record<string, V>; slots: Record<string, V> }
type S = { on: boolean; idle: boolean; hollowHeld: boolean; framed: number; plan: Record<string, { kind: string }>; lying: Record<string, number> }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)), '0. a NON-owner keeper')
  await p.evaluateOnNewDocument((s: { pieces: unknown[]; pots: unknown; tut: unknown }) => {
    if (sessionStorage.getItem('m126s2')) return; sessionStorage.setItem('m126s2', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces, walls: {} }))
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
    localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['pa', 'pb', 'pc']))
    localStorage.setItem('open.companion.v1', JSON.stringify({ active: 'gemdigger', met: ['gemdigger'], sentHome: false }))
    for (const k of ['ather.spiritFed.v1', 'ather.trainAssign.v1', 'open.bank.v1', 'ather.spiritParty.v1']) localStorage.removeItem(k)
  }, { pieces: BEDS, pots: POTS, tut: TUT })
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const read = () => p.evaluate(() => JSON.parse(JSON.stringify({ f: (window as any).__formation ?? null, s: (window as any).__skits ?? null }))) as Promise<{ f: F | null; s: S | null }>
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(5000); await hideCard()
  await p.touchscreen.tap(195, 644); await sleep(600)
  await p.evaluate(() => (window as any).__ather?.tp?.(-139, 94, Math.PI))
  // displacement is measured from the slots as they stood BEFORE idle (the live slots turn with the idle camera's yaw)
  let base: Record<string, V> = {}
  const off = (f: F, slots = base) => Object.fromEntries(f.members.map(m => [m.id, f.pos[m.id] && slots[m.id] ? Math.hypot(f.pos[m.id].x - slots[m.id].x, f.pos[m.id].z - slots[m.id].z) : 99]))
  // 1. four in the formation, in their places
  let r = await read()
  for (let t = 0; t < 60 && !(r.f && r.f.members.length === 4 && Object.keys(r.f.pos).length === 4); t++) { await sleep(500); r = await read() }
  ok(!!r.f && r.f.members.length === 4 && r.f.members.some(m => m.kind === 'manamal'), `1. the formation holds the Mana'mal + 3 spirits (${r.f?.members.map(m => m.id).join(',')})`)
  // settled = the keeper stands where they were put (not the spawn), still, and everyone is in place
  const kAt = (f: F | null) => f ? Math.hypot(f.keeper.x + 139, f.keeper.z - 94) : 99
  let o0: Record<string, number> = { none: 99 }, kb = { x: 0, z: 0 }
  for (let t = 0; t < 80; t++) { r = await read(); if (kAt(r.f) > 3) { await p.evaluate(() => (window as any).__ather?.tp?.(-139, 94, Math.PI)); await sleep(1000); continue } if (r.f && r.f.stopped && !r.s?.on) { base = r.f.slots; kb = r.f.keeper; o0 = off(r.f); if (Object.values(o0).every(v => v < 0.65)) break } await sleep(250) }
  ok(Object.values(o0).every(v => v < 0.65), `1. all in their slots before idling (${JSON.stringify(Object.fromEntries(Object.entries(o0).map(([k, v]) => [k, +v.toFixed(2)])))})`)
  ok(!r.s?.on, '1. no skits before idle')
  // 2. no input: wait for idle + skits
  const t0 = Date.now()
  for (let t = 0; t < 600 && !r.s?.on; t++) { await sleep(500); r = await read() }
  ok(!!r.s?.on, `2. skits started after ${((Date.now() - t0) / 1000).toFixed(0)} s of no input (idle ${r.s?.idle}, hollows held ${r.s?.hollowHeld})`)
  const kinds = Object.entries(r.s?.plan ?? {}).map(([id, s]) => `${id}:${s.kind}`)
  const mmId = r.f?.members.find(m => m.kind === 'manamal')?.id ?? 'manamal'
  ok(r.s?.plan?.[mmId]?.kind === 'lie' && new Set(Object.values(r.s?.plan ?? {}).map(s => s.kind)).size >= 2, `2. distinct moments (${kinds.join(', ')})`)
  // 3. watch the skits for 22 s
  let maxOff: Record<string, number> = {}, lieMax = 0, best = 9, bestId = ''
  for (let t = 0; t < 240 && !(t > 44 && best < 0.2 && lieMax > 0.8); t++) {
    await sleep(500); r = await read(); if (!r.f || !r.s) continue
    for (const [id, v] of Object.entries(off(r.f))) maxOff[id] = Math.max(maxOff[id] ?? 0, v)
    lieMax = Math.max(lieMax, r.s.lying[mmId] ?? 0); 
    // the RENDERED camera against where each follower stands (a follower counts once the idle camera asked for one)
    const c = await p.evaluate(() => (window as any).__ather.camAim()) as { x: number; z: number; cx: number; cz: number }
    if (r.s.framed > 0) for (const m of r.f.members) { const q = r.f.pos[m.id]; if (!q) continue; const e = Math.atan2(q.x - c.cx, q.z - c.cz) - Math.atan2(c.x, c.z), a = Math.abs(Math.atan2(Math.sin(e), Math.cos(e))); if (a < best) { best = a; bestId = m.id } }
    if (t === 20) await shot('m126s2-skits')
  }
  ok(lieMax > 0.8, `3. the Mana'mal lay down (nap ${lieMax.toFixed(2)})`)
  const spiritOff = Object.entries(maxOff).filter(([id]) => id !== mmId)
  ok(spiritOff.some(([, v]) => v > 1.5), `3. a spirit went more than 1.5 m from its slot (${spiritOff.map(([id, v]) => `${id} ${v.toFixed(1)}`).join(', ')})`)
  ok(best < 0.2, `3. the rendered camera came to face a follower (${bestId} off by ${best.toFixed(2)} rad)`)
  ok(!!r.s?.on, '3. still skitting with no input')
  // 4. input: back to their slots
  const moved = r.f ? Math.hypot(r.f.keeper.x - kb.x, r.f.keeper.z - kb.z) : 99
  ok(moved < 0.3 && kAt(r.f) < 3, `3. the keeper never moved, so the distances are the followers' own (${moved.toFixed(2)})`)
  const away = r.f ? Object.values(off(r.f)).filter(v => v > 1).length : 0
  ok(away > 0, `4. followers are away as the input comes (${away})`)
  await p.keyboard.press('ShiftLeft')
  const tIn = Date.now(); let back = -1, last: Record<string, number> = {}
  for (let t = 0; t < 40 && back < 0; t++) { await sleep(100); r = await read(); if (!r.f) continue; last = off(r.f); if (!r.s?.on && Object.values(last).every(v => v < 0.65)) back = (Date.now() - tIn) / 1000 }
  ok(away > 0 && back >= 0 && back <= 2.5, `4. on input all back in their slots in ${back.toFixed(1)} s (${JSON.stringify(Object.fromEntries(Object.entries(last).map(([k, v]) => [k, +v.toFixed(2)])))})`)
  await shot('m126s2-back')
  ok(errs.length === 0, `5. 0 page errors (${errs.slice(0, 3).join(' | ')})`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
