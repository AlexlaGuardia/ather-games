// The birth gate must wait for the account (bug 11-15: after "Forget my birth rune" the ritual popped on every fast
// travel, twice). Simulates a signed-in keeper whose session lands LATE, with the rune saved only under the account's
// key: the gate must never show. Then a keeper with no rune anywhere: it must show (once).
// Usage: npx tsx scripts/birth-owner-check.mts [--url http://localhost:3203]
import puppeteer from 'puppeteer-core'
const argv = process.argv.slice(2), ui = argv.indexOf('--url'), url = ui >= 0 ? argv[ui + 1] : 'http://localhost:3203'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
for (const [label, seed, want] of [['born under the account, session lands late', true, false], ['never born', false, true]] as const) {
  const p = await b.newPage()
  await p.setRequestInterception(true)
  p.on('request', async r => {
    if (r.url().includes('/api/auth/session')) { await wait(2500); r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: { user_id: 'u_birthcheck' } }) }) }
    else r.continue()
  })
  await p.evaluateOnNewDocument((seed: boolean) => {
    localStorage.removeItem('ather:shimmer:birthRune')
    if (seed) localStorage.setItem('u:u_birthcheck:ather:shimmer:birthRune', 'tempest')
    else localStorage.removeItem('u:u_birthcheck:ather:shimmer:birthRune')
  }, seed)
  await p.setViewport({ width: 1100, height: 680 })
  await p.goto(`${url}/shimmer/open/continent`, { waitUntil: 'load', timeout: 240000 })
  // sample the gate across the late-session window and after it
  let seen = false
  for (let i = 0; i < 24; i++) { if (await p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))) seen = true; await wait(500) }
  const ok = seen === want
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: gate ${seen ? 'showed' : 'stayed shut'}`)
  await p.close()
}
await b.close()
process.exit(fails ? 1 : 0)
