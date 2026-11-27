// M221: FONTS ARE SELF-HOSTED. On each page that wears a face, the face is served from our own
// origin (zero fonts.googleapis / fonts.gstatic requests), every @font-face src is same-origin,
// and a visible element's computed font-family leads with the expected family, which loads.
//   npx tsx scripts/m221-fonts-check.mts [origin]
import puppeteer from 'puppeteer-core'
import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
// sha256 of every committed woff2 -> its family folder (src/fonts/<folder>/)
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
const LOCAL = new Map<string, string>()
for (const d of readdirSync('src/fonts', { withFileTypes: true })) if (d.isDirectory())
  for (const f of readdirSync(`src/fonts/${d.name}`)) if (f.endsWith('.woff2')) LOCAL.set(sha(readFileSync(`src/fonts/${d.name}/${f}`)), d.name)
const origin = process.argv[2] ?? 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
// page, css variable that names the face, a selector to prefer (else: any visible element wearing it), weight to load
const CASES = [
  ['/', '--font-display', 'h1', 'cormorant-garamond'],
  ['/', '--font-body', 'body', 'inter'],
  ['/nolmir', '--font-game', '', 'chakra-petch'],   // /nolmir's root wears it under font-mono; no visible text resolves to it
  ['/nolmir/starforge', '--font-game', 'h1', 'chakra-petch'],
  ['/shimmer/open/ather?hour=14', '--font-hearth-display', '', 'fraunces'],
  ['/shimmer/open/ather?hour=14', '--font-hearth-body', '', 'nunito'],
] as const
const pages = new Map<string, Awaited<ReturnType<typeof br.newPage>>>()
const reqs = new Map<string, string[]>()
for (const [path] of CASES) {
  if (pages.has(path)) continue
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true })
  const r: string[] = []; reqs.set(path, r); p.on('request', q => r.push(q.url()))
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ather:shimmer:birthRune', 'star') } catch {} })
  await p.goto(`${origin}${path}`, { waitUntil: 'load', timeout: 240000 }); await sleep(path.includes('shimmer') ? 12000 : 8000)
  await p.evaluate('globalThis.__name = (f) => f')   // tsx keepNames wraps inner functions in __name
  pages.set(path, p)
  const google = r.filter(u => /fonts\.(googleapis|gstatic)\.com/.test(u))
  ok(google.length === 0, `${path}: 0 Google Fonts requests (${google.length})`)
  const faces = await p.evaluate(() => {
    const out: { family: string; src: string }[] = []
    for (const s of Array.from(document.styleSheets)) { let rules: CSSRuleList; try { rules = s.cssRules } catch { continue }
      for (const ru of Array.from(rules)) if (ru instanceof CSSFontFaceRule) out.push({ family: ru.style.getPropertyValue('font-family'), src: ru.style.getPropertyValue('src') }) }
    return out
  })
  const foreign = faces.filter(f => /url\(["']?https?:/.test(f.src) && !f.src.includes(origin))
  ok(faces.length > 0 && foreign.length === 0, `${path}: ${faces.length} @font-face rules, all src same-origin (${foreign.length} foreign)`)
}
for (const [path, v, sel, label] of CASES) {
  const p = pages.get(path)!
  const res = await p.evaluate(async (v: string, sel: string) => {
    const holder = Array.from(document.querySelectorAll('*')).find(e => getComputedStyle(e).getPropertyValue(v).trim()) as HTMLElement | undefined
    const fam = holder ? getComputedStyle(holder).getPropertyValue(v).trim() : ''
    const norm = (f: string) => f.split(',')[0].trim().replace(/^["']|["']$/g, '')
    const first = norm(fam)
    const visible = (e: Element) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (e.textContent ?? '').trim().length > 0 }
    let el: Element | undefined = sel ? document.querySelector(sel) ?? undefined : undefined
    if (!el) el = Array.from(document.querySelectorAll('body *')).find(e => visible(e) && norm(getComputedStyle(e).fontFamily) === first)
    const cf = el ? getComputedStyle(el).fontFamily : ''
    const w = el ? getComputedStyle(el).fontWeight : '400'
    const st = el ? getComputedStyle(el).fontStyle : 'normal'
    let loaded = 0; try { loaded = (await document.fonts.load(`${st} ${w} 20px "${first}"`)).length } catch {}
    const srcs: string[] = []
    for (const s of Array.from(document.styleSheets)) { let rules: CSSRuleList; try { rules = s.cssRules } catch { continue }
      for (const ru of Array.from(rules)) if (ru instanceof CSSFontFaceRule && norm(ru.style.getPropertyValue('font-family')) === first)
        for (const m of ru.style.getPropertyValue('src').matchAll(/url\(["']?([^"')]+)/g)) srcs.push(new URL(m[1], s.href ?? location.href).href) }
    const media = performance.getEntriesByType('resource').map(e => e.name).filter(n => /\.(woff2?|ttf|otf)(\?|$)/.test(n))
    return { srcs: [...new Set(srcs)], fam, first, tag: el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.textContent ?? '').trim().slice(0, 24)}"` : '(none)', cf, w, loaded, media }
  }, v, sel)
  console.log(`  ${path} ${v} = ${res.fam.slice(0, 80)}`)
  if (path === '/nolmir') console.log(`  (/nolmir: computed-family assert runs on /nolmir/starforge h1; here the face is checked by file)`)
  else ok(!!res.first && res.cf.split(',')[0].trim().replace(/^["']|["']$/g, '') === res.first, `${path}: ${label}: ${res.tag} computed font-family "${res.cf.slice(0, 70)}" leads with ${res.first}`)
  ok(res.loaded > 0, `${path}: ${label} face loads (weight ${res.w}, ${res.loaded} face(s))`)
  const served: string[] = []
  for (const u of res.srcs) { const b = new Uint8Array(await (await fetch(u)).arrayBuffer()); served.push(LOCAL.get(sha(b)) ?? `?${u.replace(origin, '')}`) }
  ok(served.length > 0 && served.every(x => x === label), `${path}: the ${res.first} face's ${served.length} file(s) are byte-identical to src/fonts/${label}/ (${[...new Set(served)].join(',')})`)
  const ours = res.media.filter(n => n.startsWith(origin))
  ok(res.media.length > 0 && ours.length === res.media.length, `${path}: font files from our origin: ${ours.length}/${res.media.length} e.g. ${(ours[0] ?? res.media[0] ?? '').replace(origin, '')}`)
}
await br.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
