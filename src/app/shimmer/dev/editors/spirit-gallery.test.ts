// M213 s1: the gallery roster against CANON. Run: npx tsx src/app/shimmer/dev/editors/spirit-gallery.test.ts
// Reads the stage-2 lock ledger (discovery order) and the canon base table, so a reorder or a stray name goes red here.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GALLERY, DISCOVERY, dialStep, galleryNo, FORM_ART_VER, STEEP_NONE, steepAdd, steepMeals, steepTotal } from './spirit-gallery'
import { accentOf } from '../../open/ather/spirit-accent'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, label: string) => { if (c) pass++; else fails.push(label) }

const LEDGER = '/root/athernyx/assets/stage2/grimoire-ledger.json'
const CANON = '/root/athernyx/CANON/world/spirits-species.md'
ok(existsSync(LEDGER), `ledger present (${LEDGER})`)
ok(existsSync(CANON), `canon base table present (${CANON})`)

ok(GALLERY.length === 134, `134 rows: 10 base + 40 forms + 84 awakened (got ${GALLERY.length})`)
GALLERY.forEach((r, i) => ok(r.num === i + 1, `row ${i} numbered ${i + 1} (got ${r.num})`))
ok(GALLERY.slice(0, 10).every(r => r.el === null) && GALLERY.slice(10).every(r => r.el !== null), 'base 10 first, then the 40 forms')
ok(new Set(GALLERY.map(r => r.name)).size === GALLERY.length, 'every name unique')
ok(new Set(DISCOVERY.map(([s, e]) => `${s}/${e}`)).size === 40, 'every species x element once')

if (existsSync(LEDGER)) {
  const locks = (JSON.parse(readFileSync(LEDGER, 'utf8')).locks as { n: number; name: string }[]).slice().sort((a, b) => a.n - b.n)
  ok(locks.length === 40, `ledger has 40 locks (got ${locks.length})`)
  locks.forEach((l, i) => ok(GALLERY[10 + i]?.name === l.name, `form #${String(11 + i).padStart(3, '0')} = ledger n${l.n} ${l.name} (got ${GALLERY[10 + i]?.name})`))
}
if (existsSync(CANON)) {
  const md = readFileSync(CANON, 'utf8'), start = md.indexOf('## The 10 Base Forms'), table = md.slice(start, md.indexOf('## ', start + 5))
  const names = [...table.matchAll(/^\| \*\*([A-Za-z]+)\*\* \|/gm)].map(m => m[1])
  ok(names.length === 10, `canon base table has 10 rows (got ${names.length})`)
  names.forEach((n, i) => ok(GALLERY[i]?.name === n, `base #${String(i + 1).padStart(3, '0')} = canon ${n} (got ${GALLERY[i]?.name})`))
}
const iconFile = (icon: string) => join(process.cwd(), 'public', icon.split('?')[0])
for (const r of GALLERY) ok(existsSync(iconFile(r.icon)), `${r.name}'s art exists: public${r.icon}`)
// M202 (11-27): each form's public art IS its locked stage-2 picture, byte for byte (the old copies were other pictures),
// and its URL carries the version that busts the year-long immutable cache.
if (existsSync(LEDGER)) {
  const locks = JSON.parse(readFileSync(LEDGER, 'utf8')).locks as { name: string; file: string }[]
  for (const r of GALLERY.slice(10, 50)) {   // the 40 second forms (the awakened rows' icons are our renders: checked below)
    const l = locks.find(x => x.name === r.name)
    const src = l && join('/root/athernyx/assets/stage2', l.file)
    ok(!!src && existsSync(src) && existsSync(iconFile(r.icon)) && readFileSync(src).equals(readFileSync(iconFile(r.icon))), `${r.name}'s public art is the locked ${l?.file}`)
    ok(r.icon.endsWith(`?v=${FORM_ART_VER}`), `${r.name}'s art url carries the cache version (${r.icon})`)
  }
}

ok(galleryNo(7) === '#007' && galleryNo(50) === '#050', 'number label')
ok(dialStep(0, -1) === 0 && dialStep(GALLERY.length - 1, 3) === GALLERY.length - 1 && dialStep(10, 2) === 12, 'dial held to its ends')

// M213 s2: the Steep mix preview feeds the game's own accentOf; none = no glow; the bar holds 10
ok(steepMeals(STEEP_NONE).length === 0 && accentOf(steepMeals(STEEP_NONE)) === null, 'no meals = no glow')
let mx = steepAdd(STEEP_NONE, 'storm', 6); mx = steepAdd(mx, 'water', 4)
ok(steepTotal(mx) === 10 && steepMeals(mx).join() === 'storm,storm,storm,storm,storm,storm,water,water,water,water', `6 storm + 4 water = her bar (${steepMeals(mx).join()})`)
ok(steepAdd(mx, 'mana', 1) === mx, 'a full bar takes no more')
ok(steepAdd(STEEP_NONE, 'earth', -1) === STEEP_NONE && steepAdd(steepAdd(STEEP_NONE, 'earth', 3), 'earth', -1).earth === 2, 'never below 0, take one away')
ok(steepAdd(steepAdd(STEEP_NONE, 'mana', 8), 'storm', 5).storm === 2, 'add is held to the room left')
{ const a = accentOf(steepMeals(mx)), b = accentOf(steepMeals(steepAdd(STEEP_NONE, 'storm', 10)))
  ok(!!a && a.locked && a.n === 10 && !!b && a.hex !== b.hex, `6 storm + 4 water glows its own mix (${a?.hex}) vs all storm (${b?.hex})`) }

// M244: the four awakened rows = the stage-3 ledger's locks 1-4 in order AND the canon's 'Locked so far' line (both read here)
{
  const L3 = '/root/athernyx/assets/stage3/grimoire-ledger-stage3.json'
  const locks = (JSON.parse(readFileSync(L3, 'utf8')).locks as { n: number; name: string; branch_name: string; second_form: string }[]).slice().sort((a, b) => a.n - b.n)
  const aw = GALLERY.filter(r => r.aw && r.el === 'mana' && r.sp === 'fox')
  ok(aw.length === 4 && aw.every((r, i) => r.num === 51 + i), `awakened rows #051-#054 (got ${aw.map(r => r.num)})`)
  locks.slice(0, 4).forEach((l, i) => ok(aw[i]?.name === l.name && aw[i]?.aw?.branch === l.branch_name.toLowerCase() && l.second_form === 'Vulnara', `awakened #${51 + i} = stage-3 n${l.n} ${l.name} ${l.branch_name} (got ${aw[i]?.name} ${aw[i]?.aw?.branch})`))
  const line = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('Locked so far') && x.includes('Vulnara')) ?? ''
  for (const r of aw) ok(line.includes(`**${r.name}** (${r.aw!.branch[0].toUpperCase()}${r.aw!.branch.slice(1)})`), `canon line names ${r.name} (${r.aw!.branch})`)
  // M244 sheet 5: Luminel's four = rows #067-#070, named word for word off the canon line ('Luminel (Mana):') and the stage-3 ledger
  const lw = GALLERY.filter(r => r.aw && r.sp === 'firefly' && r.el === 'mana'), ll = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Luminel (Mana):**')) ?? ''
  ok(lw.length === 4 && lw.every((r, i) => r.num === 67 + i && r.el === 'mana'), `Luminel's awakened rows #067-#070 (got ${lw.map(r => r.num)})`)
  ok(lw.map(r => r.name).join() === ll.replace(/.*\*\*Luminel \(Mana\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim()).join(), `Luminel's four = the canon line (${ll.slice(0, 90)})`)
  for (const r of lw) ok(locks.some(l => l.name === r.name && l.second_form === 'Luminel' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Luminel, ${r.aw!.branch}`)
  // M244 sheet 6: Luminarc's four = rows #071-#074, word for word off the canon line ('Luminarc (Storm):') and the stage-3 ledger
  const lr = GALLERY.filter(r => r.aw && r.sp === 'firefly' && r.el === 'storm'), lc = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Luminarc (Storm):**')) ?? ''
  ok(lr.length === 4 && lr.every((r, i) => r.num === 71 + i), `Luminarc's awakened rows #071-#074 (got ${lr.map(r => r.num)})`)
  ok(lr.map(r => r.name).join() === lc.replace(/.*\*\*Luminarc \(Storm\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim()).join(), `Luminarc's four = the canon line (${lc.slice(0, 90)})`)
  for (const r of lr) ok(locks.some(l => l.name === r.name && l.second_form === 'Luminarc' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Luminarc, ${r.aw!.branch}`)
  // M244 sheet 7: Luminore's four = rows #075-#078, word for word off the canon line ('Luminore (Earth):') and the stage-3 ledger
  const lo = GALLERY.filter(r => r.aw && r.sp === 'firefly' && r.el === 'earth'), lb = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Luminore (Earth):**')) ?? ''
  ok(lo.length === 4 && lo.every((r, i) => r.num === 75 + i), `Luminore's awakened rows #075-#078 (got ${lo.map(r => r.num)})`)
  ok(lo.map(r => r.name).join() === lb.replace(/.*\*\*Luminore \(Earth\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim()).join(), `Luminore's four = the canon line (${lb.slice(0, 90)})`)
  for (const r of lo) ok(locks.some(l => l.name === r.name && l.second_form === 'Luminore' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Luminore, ${r.aw!.branch}`)
  // M244 sheet 9: Luminix's four = rows #079-#082, word for word off the canon line ('Luminix (Water):') and the stage-3 ledger
  const lx = GALLERY.filter(r => r.aw && r.sp === 'firefly' && r.el === 'water'), lxl = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Luminix (Water):**')) ?? ''
  ok(lx.length === 4 && lx.every((r, i) => r.num === 79 + i), `Luminix's awakened rows #079-#082 (got ${lx.map(r => r.num)})`)
  ok(lx.map(r => r.name).join() === lxl.replace(/.*\*\*Luminix \(Water\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim()).join(), `Luminix's four = the canon line (${lxl.slice(0, 90)})`)
  for (const r of lx) ok(locks.some(l => l.name === r.name && l.second_form === 'Luminix' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Luminix, ${r.aw!.branch}`)
  // M244 sheet 8: Mystowl's four (owl) = the four rows after every firefly line (#083-#086; Croakarc's follow since sheet 9b); word for word off the canon line ('Mystowl (Mana):') + the ledger
  const my = GALLERY.filter(r => r.aw && r.sp === 'owl' && r.el === 'mana'), ml = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Mystowl (Mana):**')) ?? '', lastFly = Math.max(...GALLERY.filter(r => r.aw && r.sp === 'firefly').map(r => r.num))
  ok(my.length === 4 && my.every((r, i) => r.el === 'mana' && r.num === lastFly + 1 + i && r.num === 83 + i), `Mystowl's awakened rows straight after the fireflies (#${lastFly + 1}-; got ${my.map(r => r.num)})`)
  ok(my.map(r => r.name).join() === ml.replace(/.*\*\*Mystowl \(Mana\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim()).join(), `Mystowl's four = the canon line (${ml.slice(0, 90)})`)
  for (const r of my) ok(locks.some(l => l.name === r.name && l.second_form === 'Mystowl' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Mystowl, ${r.aw!.branch}`)
  // M244 sheet 9b: Croakarc's four (frog, Storm) = rows #087-#090, after the owls; word for word off the canon line ('Croakarc (Storm):') + the ledger
  const ck = GALLERY.filter(r => r.aw && r.sp === 'frog' && r.el === 'storm'),   // sheet 11: Croakara's (frog, Mana) follow
    ckl = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Croakarc (Storm):**')) ?? ''
  ok(ck.length === 4 && ck.every((r, i) => r.el === 'storm' && r.num === 87 + i), `Croakarc's awakened rows #087-#090 (got ${ck.map(r => r.num)})`)
  ok(ck.map(r => r.name).join() === ckl.replace(/.*\*\*Croakarc \(Storm\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim()).join(), `Croakarc's four = the canon line (${ckl.slice(0, 90)})`)
  for (const r of ck) ok(locks.some(l => l.name === r.name && l.second_form === 'Croakarc' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Croakarc, ${r.aw!.branch}`)
  ok(aw.every(r => r.icon.startsWith('/open/spirits/') && !r.icon.includes('stage3')), 'awakened icons are our renders, not the private art')
  // M244 sheet 2: Vulnarc's four (#055-#058, art pending lock) = the canon's 'Named — Vulnyx › Vulnarc (Storm)' line, word for word
  const st = GALLERY.filter(r => r.aw && r.el === 'storm' && r.sp === 'fox'), named = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('Named') && x.includes('Vulnarc (Storm)')) ?? ''
  ok(st.length === 4 && st.every((r, i) => r.num === 55 + i), `Vulnarc's awakened rows #055-#058 (got ${st.map(r => r.num)})`)
  for (const r of st) ok(named.includes(`**${r.name}** (${r.aw!.branch[0].toUpperCase()}${r.aw!.branch.slice(1)}`), `canon names ${r.name} (${r.aw!.branch})`)
  ok(st.every(r => r.icon.startsWith('/open/spirits/') && !r.icon.includes('stage3')), 'Vulnarc awakened icons are our renders')
  // M244 sheet 3: Vulnore's four (#059-#062) = the canon's 'Named — Vulnyx › Vulnore (Earth)' line + the stage-3 ledger locks 9-12
  const ea = GALLERY.filter(r => r.aw && r.el === 'earth' && r.sp === 'fox'), en = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('Named') && x.includes('Vulnore (Earth)')) ?? ''
  ok(ea.length === 4 && ea.every((r, i) => r.num === 59 + i), `Vulnore's awakened rows #059-#062 (got ${ea.map(r => r.num)})`)
  for (const r of ea) ok(en.includes(`**${r.name}** (${r.aw!.branch[0].toUpperCase()}${r.aw!.branch.slice(1)}`), `canon names ${r.name} (${r.aw!.branch})`)
  ea.forEach((r, i) => { const l = locks.find(x => x.n === 9 + i); ok(!!l && l.name === r.name && l.second_form === 'Vulnore' && l.branch_name.toLowerCase() === r.aw!.branch, `#${r.num} = stage-3 lock n${9 + i} ${l?.name} (got ${r.name})`) })
  ok(ea.every(r => r.icon.startsWith('/open/spirits/') && !r.icon.includes('stage3')), 'Vulnore awakened icons are our renders')
  // M244 sheet 4: Vulnix's four (#063-#066) = the canon's 'Named — Vulnyx › Vulnix (Water)' line + the stage-3 ledger locks 13-16
  const wa = GALLERY.filter(r => r.aw && r.el === 'water' && r.sp === 'fox'), wn = readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('Named') && x.includes('Vulnix (Water)')) ?? ''
  ok(wa.length === 4 && wa.every((r, i) => r.num === 63 + i), `Vulnix's awakened rows #063-#066 (got ${wa.map(r => r.num)})`)
  for (const r of wa) ok(wn.includes(`**${r.name}** (${r.aw!.branch[0].toUpperCase()}${r.aw!.branch.slice(1)}`), `canon names ${r.name} (${r.aw!.branch})`)
  wa.forEach((r, i) => { const l = locks.find(x => x.n === 13 + i); ok(!!l && l.name === r.name && l.second_form === 'Vulnix' && l.branch_name.toLowerCase() === r.aw!.branch, `#${r.num} = stage-3 lock n${13 + i} ${l?.name} (got ${r.name})`) })
  ok(wa.every(r => r.icon.startsWith('/open/spirits/') && !r.icon.includes('stage3') && existsSync(`public${r.icon.split('?')[0]}`)), 'Vulnix awakened icons are our renders (on disk)')
}
console.log(`spirit-gallery: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
