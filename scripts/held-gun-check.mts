// ── THE HELD GUN, SEEN BY THE PARTY (BETA M27 slice 4, play / Jin 2 16e8df5e, 11-19) ─────────────────────────────────────
// Two keepers in one party in the Wilds (party-zones-check's setup). PROD ONLY (the game socket is behind the tunnel). PASS =
//   1. A is in the Wilds and DRAWS (real R) before B arrives
//   2. B joins AFTER: within 5 s of seeing A, B hears A's gun AND draws it on A's rig (the newcomer is told at once)
//   3. A swaps (real R tap): B sees the other gun
//   4. A stows (R held): B sees empty hands, no gun on A's rig
//   5. 0 page errors
// Hooks READ only: __mp (status, peers, guns, gunsShown), __ather.stance; real R presses.
//   npx tsx scripts/held-gun-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'hg' + Math.random().toString(36).slice(2, 8)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
const mp = (p: Page, f: string) => p.evaluate((k: string) => (window as any).__mp?.[k]?.(), f)
const stance = (p: Page) => p.evaluate(() => (window as any).__ather?.stance?.()?.kind)
async function open(tag: string): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 800, height: 500 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:mp:party', c)
    localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['repeater', 'charred-rifle'], primary: 'charred-rifle', secondary: 'repeater', kael: true,
      vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
  }, CODE)
  return p
}
async function toWilds(p: Page, tag: string) {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => (await mp(p, 'status')) === 'live' && (await mp(p, 'zone')) === 'open:wilds', 240000), `${tag}: live in the Wilds`)
  await sleep(2000); await p.mouse.click(400, 250); await sleep(600)
}
const tapR = async (p: Page) => { await p.keyboard.down('KeyR'); await sleep(150); await p.keyboard.up('KeyR'); await sleep(900) }
try {
  // 1 · A arrives and draws, alone
  const a = await open('A'); await toWilds(a, 'A')
  await tapR(a)
  ok(await poll(async () => (await stance(a)) === 'weapon', 10000), '1. A drew (real R) before B came')
  const idA = await a.evaluate(() => localStorage.getItem('ather:mp:id'))
  // 2 · B joins after: told at once
  const b = await open('B'); await toWilds(b, 'B')
  ok(await poll(async () => (((await mp(b, 'peers')) ?? []) as { id: string }[]).some(q => q.id === idA), 60000), '2. B sees A')
  const t0 = Date.now()
  const told = await poll(async () => { const g = ((await mp(b, 'guns')) ?? {})[idA!]; return typeof g === 'string' }, 5000)
  const g1 = ((await mp(b, 'guns')) ?? {})[idA!] as string | null
  ok(told, `2. B hears A's gun within 5 s of arriving (${g1}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`)
  ok(await poll(async () => ((await mp(b, 'gunsShown')) ?? {})[idA!] === g1, 5000), `2. and draws it on A's rig (${((await mp(b, 'gunsShown')) ?? {})[idA!]})`)
  // 3 · A swaps
  await tapR(a)
  const swapped = await poll(async () => { const g = ((await mp(b, 'guns')) ?? {})[idA!]; return typeof g === 'string' && g !== g1 }, 6000)
  ok(swapped, `3. A swaps: B sees ${g1} -> ${((await mp(b, 'guns')) ?? {})[idA!]}`)
  // 4 · A stows (hold R)
  await a.keyboard.down('KeyR'); await sleep(900); await a.keyboard.up('KeyR'); await sleep(600)
  ok(await poll(async () => (await stance(a)) === 'stowed', 6000), '4. A stowed (R held)')
  ok(await poll(async () => ((await mp(b, 'guns')) ?? {})[idA!] === null && !((await mp(b, 'gunsShown')) ?? {})[idA!], 6000), "4. B sees A's hands empty, no gun on the rig")
  ok(errs.length === 0, `5. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
