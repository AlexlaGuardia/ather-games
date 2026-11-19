// ── THE WILDS TERRAIN EDITOR (BETA M38 slice 1, play / Jin f8ce0338, 11-19) ─────────────────────────────────────────────────
// PASS =
//   1. the OWNER (cookie via /owner?key) is in the Wilds; B (real key) turns the editor on
//   2. holding the left button (real mouse) raises the ground under the crosshair (the ring's spot) by > 6 m; it saves
//   3. a RELOAD keeps it: the edit layer is read at runtime (GET /shimmer/open/wilds-edits)
//   4. the walker cannot climb it: walking (real W, held) straight at the mound from 14 m never gets onto its top
//   5. a NON-owner sees the same raised ground, B does nothing, and the save route answers 403
//   6. 0 page errors
// ★ CLEANUP: the check restores every tile it touched to the edits it found (POST as owner), in a finally. It must never leave a
//   test mound in Alex's world. Owner key from /root/ather-games/.env, so this runs on the SERVER (one browser:
//   tools/coord.sh browser up), never on the EliteDesk (no key there, on purpose).
// Hooks: __wildsEdit (state, heightAt, edits: READ), __ather.tp / look / state (MOVEMENT + aim only, stated); real B, mouse, W.
//   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/wilds-edit-check.mts [https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
const url = process.argv[2] ?? 'https://ather.games'
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('OWNER_KEY not set: set -a; . /root/ather-games/.env; set +a'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
type Edits = Record<string, Record<string, number>>
const H = (p: Page, x: number, z: number) => p.evaluate((a: number, b: number) => (window as any).__wildsEdit.heightAt(a, b), x, z) as Promise<number>
const ST = (p: Page) => p.evaluate(() => (window as any).__wildsEdit?.state?.()) as Promise<{ owner: boolean; on: boolean; saved: number; failed: number; hit: { x: number; y: number; z: number } | null } | undefined>
async function open(tag: string, owner: boolean): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1000, height: 700 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('ather:mp:party') })
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'load', timeout: 60000 })
  return p
}
const enter = async (p: Page) => {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  return poll(async () => (await p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__wildsEdit)), 240000)
}
let before: Edits | null = null, owner: Page | null = null
try {
  owner = await open('owner', true)
  ok(await enter(owner), '1. owner: in the Wilds, editor hook up')
  ok(await poll(async () => !!(await ST(owner!))?.owner, 20000), '1. /api/owner says owner')
  before = await owner.evaluate(() => (window as any).__wildsEdit.edits()) as Edits
  await owner.mouse.click(500, 350)   // pointer lock (the canvas asks on click)
  ok(await poll(async () => owner!.evaluate(() => !!document.pointerLockElement), 15000), '   pointer locked')
  await owner.keyboard.press('KeyB')
  ok(await poll(async () => !!(await ST(owner!))?.on, 10000), '1. B turned the editor on')
  // aim ~8 m ahead, down at the ground; the ring's spot is the crosshair's
  const me = await owner.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, z: a.pz, yaw: a.yaw } })
  await owner.evaluate((y: number) => (window as any).__ather.look(y, -0.3), me.yaw)
  ok(await poll(async () => !!(await ST(owner!))?.hit, 10000), '   the crosshair finds ground (the ring)')
  const hit = (await ST(owner))!.hit!, h0 = await H(owner, hit.x, hit.z)
  for (let i = 0; i < 1; i++) await owner.keyboard.press('Equal')   // strength up to 2 m an application
  await owner.mouse.down()
  const raised = await poll(async () => (await H(owner!, hit.x, hit.z)) - h0 > 6.5, 60000)
  await owner.mouse.up()
  const h1 = await H(owner, hit.x, hit.z)
  ok(raised, `2. holding click raised the ground under the ring: ${h0.toFixed(1)} -> ${h1.toFixed(1)} m at (${hit.x.toFixed(0)}, ${hit.z.toFixed(0)})`)
  ok(await poll(async () => { const s = await ST(owner!); return !!s && s.saved > 0 && !s.failed }, 30000), '2. the edit SAVED (owner POST)')
  // 3 · reload keeps it
  await owner.keyboard.press('KeyB')
  ok(await enter(owner), '3. owner reloaded into the Wilds')
  ok(await poll(async () => (await H(owner!, hit.x, hit.z)) - h0 > 6, 60000), `3. after a reload the mound is still there (${(await H(owner, hit.x, hit.z)).toFixed(1)} m)`)
  // 4 · the walker cannot climb it: stand 14 m off, face it, hold W
  const dx = hit.x - me.x, dz = hit.z - me.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d
  const sx = hit.x - ux * 14, sz = hit.z - uz * 14, yaw = Math.atan2(-ux, -uz)
  await owner.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), sx, sz, yaw)
  await poll(async () => { const a = await owner!.evaluate(() => (window as any).__ather.state()); return Math.hypot(a.px - sx, a.pz - sz) < 1.5 }, 10000)
  await owner.mouse.click(500, 350); await owner.evaluate((y: number) => (window as any).__ather.look(y, 0), yaw)
  let closest = 99, maxUp = -99
  const g0 = await H(owner, sx, sz)
  await owner.keyboard.down('KeyW')
  const t0 = Date.now()
  while (Date.now() - t0 < 12000) {
    const a = await owner.evaluate(() => (window as any).__ather.state())
    closest = Math.min(closest, Math.hypot(a.px - hit.x, a.pz - hit.z)); maxUp = Math.max(maxUp, (a.py ?? 0) - g0)
    await owner.evaluate((y: number) => (window as any).__ather.look(y, 0), yaw)   // keep facing it
    await sleep(300)
  }
  await owner.keyboard.up('KeyW')
  ok(closest < 9, `4. the keeper walked up to the mound (closest ${closest.toFixed(1)} m)`)
  ok(closest > 2.5 && maxUp < h1 - h0 - 2.5, `4. but never onto its top (closest ${closest.toFixed(1)} m, rose ${maxUp.toFixed(1)} of ${(h1 - h0).toFixed(1)} m)`)
  // 5 · a non-owner sees it and cannot edit
  const guest = await open('guest', false)
  ok(await enter(guest), '5. non-owner: in the Wilds')
  ok(await poll(async () => (await H(guest, hit.x, hit.z)) - h0 > 6, 60000), `5. the non-owner sees the raised ground (${(await H(guest, hit.x, hit.z)).toFixed(1)} m)`)
  await guest.mouse.click(500, 350); await guest.keyboard.press('KeyB'); await sleep(1500)
  const gs = await ST(guest)
  ok(!!gs && !gs.owner && !gs.on, `5. B does nothing for a non-owner (owner ${gs?.owner}, on ${gs?.on})`)
  const code = await guest.evaluate(() => fetch('/shimmer/save-wilds-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tile: 'first-wilds', d: { 1: 600 } }) }).then(r => r.status))
  ok(code === 403, `5. the save route refuses a non-owner (${code})`)
  ok(errs.length === 0, `6. page errors: ${errs.length} ${errs.join(' | ')}`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally {
  // ★ put the world back exactly as found
  if (owner && before) {
    try {
      const now = await owner.evaluate(() => fetch('/shimmer/open/wilds-edits', { cache: 'no-store' }).then(r => r.json()).then(j => j.tiles ?? {})) as Edits
      const tiles = [...new Set([...Object.keys(now), ...Object.keys(before)])].filter(t => JSON.stringify(now[t] ?? {}) !== JSON.stringify(before![t] ?? {}))
      for (const t of tiles) {
        const st = await owner.evaluate((tile: string, d: unknown) => fetch('/shimmer/save-wilds-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tile, d }) }).then(r => r.status), t, before[t] ?? {})
        console.log(`   cleanup: ${t} restored (${st})`)
      }
      const after = await owner.evaluate(() => fetch('/shimmer/open/wilds-edits', { cache: 'no-store' }).then(r => r.json()).then(j => j.tiles ?? {})) as Edits
      ok(JSON.stringify(after) === JSON.stringify(before), `cleanup: the edit layer is back as found (${tiles.length} tile(s) restored)`)
    } catch (e) { ok(false, `cleanup threw: ${String(e).slice(0, 200)}`) }
  }
  await br.close()
}
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
