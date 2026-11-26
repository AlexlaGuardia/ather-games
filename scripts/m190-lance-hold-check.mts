// M190 (Alex 11-26: "the guns ... the size in the hands ... now they are floating in front", the Lance only): THE LANCE IN HAND.
// SETUP (stated): a fresh anonymous context, loadout = Lance primary, Spitter secondary; real R draws. Reads __fpGun (read only).
// PASS, at 390x844 and 1280x760 =
//   1. the Lance is drawn (key starts 'lance')
//   2. its hip hold sits where the tuned guns' do: held z > -0.42 m (the 11-18 base put it at -0.5, a hand out in front)
//   3. its in-hand size is the tuned family's: VM.S >= 1.1 (the base drew it at 0.55, half size)
//   4. the Spitter after it keeps its own tuned hold (S 1.2, HIP_Z -0.385): the Lance's numbers do not leak
//   5. 0 page errors.  Screenshots into --out.
//   npx tsx scripts/m190-lance-hold-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m190-lance')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const [tag, w, h] of [['390', 390, 844], ['desk', 1280, 760]] as const) {
    const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h })
    const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    await p.evaluateOnNewDocument('window.__name = (f) => f')
    await p.evaluateOnNewDocument(() => {
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['lance', 'spitter'], primary: 'lance', secondary: 'spitter', kael: true,
        vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
    })
    const G = () => p.evaluate(() => { const g = (window as any).__fpGun; return g ? { shown: g.shown(), key: String(g.key()), pos: g.pos() as number[], vm: g.vm ? g.vm() : null } : null })
    const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(150) } return false }
    const tapR = async () => { await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(500) }
    await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fpGun, { timeout: 240000 }); await sleep(4000)
    await p.mouse.click(Math.round(w / 2), Math.round(h / 2)); await sleep(800)
    for (const gun of ['lance', 'spitter']) {
      await tapR(); await poll(async () => { const g = await G(); return !!g?.shown && g.key.startsWith(gun) })
      await sleep(1500); const g = await G(); await p.screenshot({ path: `${out}/${tag}-${gun}-hip.png` })
      console.log(`   ${tag} ${gun}: ${JSON.stringify(g)}`)
      if (gun === 'lance') {
        ok(!!g?.shown && g.key.startsWith('lance'), `1. ${tag}: the Lance is drawn (${g?.key})`)
        ok(!!g && g.pos[2] > -0.42, `2. ${tag}: Lance held at z ${g?.pos[2]?.toFixed(3)} (> -0.42; the base was -0.5)`)
        ok(!!g?.vm && g.vm.S >= 1.1, `3. ${tag}: Lance in-hand size S ${g?.vm?.S ?? 'n/a (no vm hook)'} (>= 1.1; the base was 0.55)`)
      } else ok(!!g?.shown && g.key.startsWith('spitter') && g.vm?.S === 1.2 && g.vm?.HIP_Z === -0.385, `4. ${tag}: the Spitter keeps its own hold (${JSON.stringify(g?.vm)})`)
    }
    ok(errs.length === 0, `5. ${tag}: 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
    await p.close()
  }
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
