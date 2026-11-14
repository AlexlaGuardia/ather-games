// ── The trade v1 loop end to end, in the real page (/shimmer/open/continent) ─────────────────────────────
// Run: npx tsx scripts/trade-flow.mts [--port 3204] [--shot out.png]
// Starts a fresh trial ledger, places the Darter at Millbrook, opens the Co. board with E, takes the first
// contract, waits for it to LOAD (stopped at the pickup), teleports to the drop, waits for the PAY, and checks
// the ledger: Marks up by the contract's pay (or a spoiled share of it), one deed, nothing held.
import puppeteer from 'puppeteer-core'
const args = process.argv.slice(2)
const flag = (n: string, d: string) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1] }
const port = flag('--port', '3204')
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1280, height: 760 })
  await p.evaluateOnNewDocument(() => { try { localStorage.removeItem('ather:trade:trial-ledger') } catch { /* */ } })
  await p.goto(`http://localhost:${port}/shimmer/open/continent?hour=13`, { waitUntil: 'load', timeout: 120000 })
  await p.waitForFunction('!!window.__drive', { timeout: 90000 })
  await p.keyboard.press('ShiftLeft')
  const ledger = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? 'null'))
  const placeAt = (id: string) => p.evaluate((i: string) => (window as unknown as { __drive: { place: (id: string, v: number) => void } }).__drive.place(i, 0), id)
  const where = () => p.evaluate(() => (window as unknown as { __drive: { state: () => { x: number; z: number } } }).__drive.state())
  // the town placement puts the car on the town's road, 10-20 m out: close enough to be "at" it
  await placeAt('millbrook')
  await p.waitForFunction(() => [...document.querySelectorAll('div')].some(d => d.textContent === 'E · Ather Trading Co. board'), { timeout: 30000 })
    .then(() => ok(true, ''), () => ok(false, 'never offered the board at Millbrook'))
  await new Promise(r => setTimeout(r, 2500))      // let the car settle, as a player who has stopped would
  await p.keyboard.press('KeyE')
  await p.waitForFunction(() => document.body.textContent?.includes('Millbrook board'), { timeout: 10000 }).then(() => ok(true, ''), () => ok(false, 'E did not open the Millbrook board'))
  const clicked = await p.evaluate(() => { const btn = [...document.querySelectorAll('button')].find(x => / M$/.test(x.textContent ?? '') && !(x as HTMLButtonElement).disabled); (btn as HTMLButtonElement | undefined)?.click(); return !!btn })
  ok(clicked, 'no contract could be taken at Millbrook')
  await new Promise(r => setTimeout(r, 800))
  let l = await ledger()
  ok(!!l?.active && l.active.from === 'millbrook', `taking a contract should hold it (${JSON.stringify(l?.active)})`)
  const pay = l?.active?.pay ?? 0, to = l?.active?.to
  // stopped at the pickup → loads
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{}').active?.loaded === true, { timeout: 20000 })
    .then(() => ok(true, ''), () => ok(false, 'never loaded at the pickup'))
  // drive (teleport) to the drop → pays
  if (to) await placeAt(to)
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{}').active === null, { timeout: 30000 })
    .then(() => ok(true, ''), async () => ok(false, `never paid at the drop ${to} (car at ${JSON.stringify(await where())})`))
  l = await ledger()
  ok(l?.deeds === 1, `one deed after a delivery (${l?.deeds})`)
  ok(l?.marks > 60 && l?.marks <= 60 + pay, `paid: 60 → ${l?.marks} (contract ${pay})`)
  const shot = flag('--shot', '')
  if (shot) await p.screenshot({ path: shot })
  console.log(`  millbrook → ${to}: paid ${l?.marks - 60} of ${pay} Marks, deeds ${l?.deeds}`)
} finally { await b.close() }
console.log(`trade-flow: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗', f)
process.exit(fails.length ? 1 : 0)
