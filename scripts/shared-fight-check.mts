// ── SHARED FIGHTS: ONE PARTY, ONE SET OF HOLLOWS (BETA M28 slice 2, play / Jin 2 16e8df5e, 11-19) ────────────────────────
// Two keepers in one party (lib/party's stored code, as party-zones-check) in the Wilds. PROD ONLY (the game socket lives
// behind the public tunnel; run via tools/edesk-check.sh). PASS =
//   1. both live in the Wilds, each sees the other
//   2. exactly ONE host, and both agree who (the lowest id)
//   3. the guest draws the host's Hollows: every guest Hollow id is one the host has, within 1.5 m of it (sampled together)
//      and the guest has spawned none of its own
//   3b (slice 3) the GUEST draws (real R) and shoots (real clicks) a shared Hollow: its hp drops ON THE HOST; shot down, BOTH
//      keepers get a drop (each their own copy)
//   4. the host leaves (a page load home: no socket there): within 15 s the guest is the host and its Hollows are still there
//   5. 0 page errors
// Hooks READ only: __mp (status, peers), __fight (host, hostId, ids).
//   npx tsx scripts/shared-fight-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'sf' + Math.random().toString(36).slice(2, 8)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
const mp = (p: Page, f: string) => p.evaluate((k: string) => (window as any).__mp?.[k]?.(), f)
const F = (p: Page, f: string) => p.evaluate((k: string) => (window as any).__fight?.[k]?.(), f)
const idOf = (p: Page) => p.evaluate(() => localStorage.getItem('ather:mp:id'))
type H = { id: number; x: number; z: number; hp: number }
async function open(tag: string): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 800, height: 500 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:mp:party', c) }, CODE)
  return p
}
try {
  const a = await open('A'), b = await open('B')
  for (const [p, t] of [[a, 'A'], [b, 'B']] as const) {
    await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
    ok(await poll(async () => (await mp(p, 'status')) === 'live' && (await mp(p, 'zone')) === 'open:wilds' && !!(await p.evaluate(() => (window as any).__fight)), 240000), `1. ${t}: live in the Wilds, fight hook up`)
  }
  const ida = await idOf(a), idb = await idOf(b)
  const sees = async (p: Page, id: string | null) => (((await mp(p, 'peers')) ?? []) as { id: string }[]).some(q => q.id === id)
  ok(await poll(async () => (await sees(a, idb)) && (await sees(b, ida)), 60000), `1. each sees the other (A ${ida}, B ${idb})`)
  // 2 · one host, agreed
  ok(await poll(async () => (await F(a, 'sharing')) && (await F(b, 'sharing')), 30000), '2. both are sharing the fight')
  const ha = await F(a, 'host'), hb = await F(b, 'host'), hidA = await F(a, 'hostId'), hidB = await F(b, 'hostId')
  const want = [ida!, idb!].sort()[0]
  ok(ha !== hb, `2. exactly one host (A ${ha}, B ${hb})`)
  ok(hidA === hidB && hidA === want, `2. both agree it is the lowest id (${hidA} / ${hidB}, expect ${want})`)
  const host = ha ? a : b, guest = ha ? b : a, ht = ha ? 'A' : 'B', gt = ha ? 'B' : 'A'
  // 3 · the guest draws the host's Hollows
  ok(await poll(async () => ((await F(host, 'ids')) as H[]).length > 0 && ((await F(guest, 'ids')) as H[]).length > 0, 120000), `3. Hollows on both (${ht} hosts)`)
  await sleep(3000)
  const [hs, gs] = await Promise.all([F(host, 'ids') as Promise<H[]>, F(guest, 'ids') as Promise<H[]>])
  const miss = gs.filter(g => !hs.some(h => h.id === g.id))
  const far = gs.filter(g => { const h = hs.find(o => o.id === g.id); return h && Math.hypot(h.x - g.x, h.z - g.z) > 1.5 })
  console.log(`   host ${hs.length} Hollows, guest ${gs.length}; not the host's: ${miss.length}; > 1.5 m off: ${far.map(f => f.id).join(',') || 'none'}`)
  ok(miss.length === 0, `3. every guest Hollow is one of the host's (${gs.length} drawn, ${miss.length} strays of its own)`)
  ok(far.length === 0, '3. each within 1.5 m of where the host has it')
  // 3b · slice 3: the guest's shots count on the host; a kill drops for both
  await guest.mouse.click(400, 250); await sleep(800)
  await guest.keyboard.down('KeyR'); await sleep(150); await guest.keyboard.up('KeyR')
  ok(await poll(async () => (await guest.evaluate(() => (window as any).__ather.stance()?.kind)) === 'weapon', 10000), `3b. ${gt} drew (real R)`)
  const dropsH0 = await F(host, 'drops') as number, dropsG0 = await F(guest, 'drops') as number
  let hitOnHost: string | null = null, killedId: number | null = null
  for (let i = 0; i < 60 && killedId === null; i++) {
    const s = await guest.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, z: a.pz } })
    const gh = (await F(guest, 'ids')) as H[]; if (!gh.length) { await sleep(800); continue }
    const t = [...gh].sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0]
    const dx = t.x - s.x, dz = t.z - s.z, d = Math.hypot(dx, dz) || 1
    if (d > 9 || d < 4) { await guest.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), t.x - dx / d * 7, t.z - dz / d * 7, Math.atan2(-dx, -dz)); await sleep(1200) }
    const s2 = await guest.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, z: a.pz } })
    const t2 = ((await F(guest, 'ids')) as H[]).find(h => h.id === t.id); if (!t2) continue
    const ex = t2.x - s2.x, ez = t2.z - s2.z, dd = Math.hypot(ex, ez) || 1
    await guest.evaluate((yw: number, pt: number) => (window as any).__ather.look(yw, pt), Math.atan2(-ex, -ez), -Math.atan2(0.75, dd))
    const hpHost0 = ((await F(host, 'ids')) as H[]).find(h => h.id === t.id)?.hp
    await guest.mouse.down(); await sleep(200); await guest.mouse.up()
    await poll(async () => { const h = ((await F(host, 'ids')) as H[]).find(o => o.id === t.id); return !h || (hpHost0 !== undefined && h.hp < hpHost0) }, 3000)
    const hh = ((await F(host, 'ids')) as H[]).find(o => o.id === t.id)
    if (hpHost0 !== undefined && (!hh || hh.hp < hpHost0) && !hitOnHost) hitOnHost = `Hollow ${t.id}: ${hpHost0} -> ${hh ? hh.hp : 'dispersed'} on the host (guest shot ${i + 1})`
    if (!hh) killedId = t.id
  }
  ok(!!hitOnHost, `3b. the guest's shot counts on the host: ${hitOnHost ?? 'never'}`)
  ok(killedId !== null, `3b. the guest's shots took a shared Hollow down (${killedId ?? 'none in 60 shots'})`)
  ok(await poll(async () => (await F(host, 'drops') as number) > dropsH0 && (await F(guest, 'drops') as number) > dropsG0, 10000),
    `3b. a drop for BOTH keepers (host ${dropsH0} -> ${await F(host, 'drops')}, guest ${dropsG0} -> ${await F(guest, 'drops')})`)
  // 4 · the host leaves: the guest takes over with the Hollows intact
  const before = ((await F(guest, 'ids')) as H[]).map(g => g.id)
  await host.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })   // home: the plot opens no socket
  ok(await poll(async () => (await F(guest, 'host')) === true, 15000), `4. ${ht} left: ${gt} hosts within 15 s`)
  const after = (await F(guest, 'ids')) as H[]
  const kept = before.filter(id => after.some(h => h.id === id)).length
  ok(after.length > 0 && kept >= Math.min(before.length, 1), `4. ${gt}'s Hollows are still there (${kept}/${before.length} kept, ${after.length} now)`)
  ok(errs.length === 0, `5. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
