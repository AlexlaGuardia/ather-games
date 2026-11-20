// arrival-programs-check (BETA M44 first-visit warm-up): NO shader program compiles after the arrival veil lifts, on a FIRST visit
// plot -> Moonwell Glade, then Glade -> a Wilds waymark, then home. Reads ProgramKeeper's __programs probe at the frame the veil
// drops below half opacity and 12 s later; any program in the second list and not the first compiled in plain sight (a hitch).
// --nowarm is the CONTROL: the same run with the warm proxies (warm-proxies.tsx) left out must show late programs, or this check
// cannot see what it claims to (11-20 devwin: 7 late without, 0 with).
//   npx tsx scripts/arrival-programs-check.mts [origin] [--nowarm] [--out file]
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const NOWARM = process.argv.includes('--nowarm'), origin = process.argv.slice(2).find(a => a.startsWith('http')) ?? 'https://ather.games'
const oi = process.argv.indexOf('--out'), out = oi > 0 ? process.argv[oi + 1] : '/tmp/arrival-programs.json'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 720 })
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const w = window as any; if (location.search.includes('nowarm')) w.__noWarm = true; w.__lifts = []; let veil: HTMLElement | null = null, lastOp = 0
  const tick = () => {
    if (!veil || !veil.isConnected) veil = Array.from(document.querySelectorAll<HTMLElement>('div')).find(d => d.style.background === 'rgb(246, 241, 228)' && d.style.transition.includes('opacity')) ?? null
    const op = veil ? parseFloat(veil.style.opacity || '0') : 0
    if (op <= 0.5 && lastOp > 0.5) w.__lifts.push({ t: performance.now(), keys: (w.__programs?.() ?? []).map((q: any) => q.key) })
    lastOp = op; requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
await p.goto(`${origin}/shimmer/open/ather?hour=13&home=1${NOWARM ? '&nowarm=1' : ''}`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof (window as any).__ather?.travel === 'function' && !!(window as any).__programs && (window as any).__ather.zone() === 'plot', { timeout: 240000 }); await sleep(6000)
const res: Record<string, unknown> = {}
const legs: [string, unknown, string][] = [['glade', { kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 0, made: 0 } }, 'wilds'], ['wilds', { kind: 'waymark', w: { id: 'veil-check', tile: 'first-wilds', x: -230, y: 0, z: 240, biome: 0, made: 0 } }, 'wilds'], ['home', { kind: 'home' }, 'plot']]
for (const [name, d, want] of legs) {
  const n0 = await p.evaluate(() => (window as any).__lifts.length)
  for (let i = 0; i < 10; i++) { await p.evaluate((x: unknown) => (window as any).__ather.travel(x), d); if (await p.evaluate((n: number) => (window as any).__lifts.length > n, n0).catch(() => false)) break; await sleep(4000); if ((await p.evaluate(() => (window as any).__lifts.length)) > n0) break }
  await sleep(12000)
  const lift = await p.evaluate((n: number) => (window as any).__lifts[n], n0) as { keys: string[] } | undefined
  const now = await p.evaluate(() => (window as any).__programs()) as { name: string; key: string }[], owners = await p.evaluate(() => (window as any).__programOwners())
  const at = new Set(lift?.keys ?? []), late = now.filter(q => !at.has(q.key))
  res[name] = { atLift: lift?.keys.length, now: now.length, late, owners: owners.filter((o: any) => late.some(l => l.key === o.key)) }
  console.log(`${name}: zone ${await p.evaluate(() => (window as any).__ather.zone())} programs at lift ${lift?.keys.length} -> ${now.length} 12 s later; LATE ${late.length}: ${late.map(l => l.name || l.key.split(',')[0]).join(', ')}`)
}
fs.writeFileSync(out, JSON.stringify(res)); await b.close()
const lateN = Object.values(res).reduce((t: number, r: any) => t + (r.late?.length ?? 0), 0), legsOk = Object.values(res).every((r: any) => r.atLift > 0)
if (!legsOk) { console.log('arrival-programs-check: FAIL (a leg never saw the veil lift)'); process.exit(1) }
if (NOWARM) { console.log(lateN > 0 ? `arrival-programs-check --nowarm: control OK (${lateN} late without the warm-up)` : 'arrival-programs-check --nowarm: CONTROL FAILED (no late programs even without the warm-up: the check is blind)'); process.exit(lateN > 0 ? 0 : 1) }
console.log(lateN === 0 ? 'arrival-programs-check: PASS (0 programs compiled after the veil lifted)' : `arrival-programs-check: FAIL (${lateN} late programs)`); process.exit(lateN === 0 ? 0 : 1)
