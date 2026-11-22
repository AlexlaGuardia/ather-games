// shared/sigil.ts (BETA M93 s1): every rune of the canon table moves exactly its stat effects in the right direction and shows its
// tags; same state refused; cap 3; the Charred Rifle has no socket; birth rune on the 1st cut halves reload mana, on the 2nd not; damage untouched.
//   npx tsx src/app/shimmer/open/shared/sigil.test.ts
import { existsSync, readFileSync } from 'fs'
import { RUNES, STAT_OF, LOWER_IS_BETTER, SIGIL_CAP, SIGIL_DIALS, blankSigil, canCut, cut, sigilEffects, statLevels, statMult, reloadManaWith, sigilSlots, tuneGun, type Sigil, type TunedStat } from './sigil'
import { RANGE_GUNS } from './gunplay'
import { ECON } from './vitals-economy'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('✗', m) } }
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e

const G = RANGE_GUNS.find(g => g.id === 'backbone')!
const sig = (...runes: string[]): Sigil => ({ gunId: 'backbone', runes })
const cutAll = (...ids: string[]) => ids.reduce((s, id) => cut(s, id), blankSigil('backbone'))

// field -> stat, and whether bigger is "more"
const FIELDS: [keyof typeof G | 'moveMult' | 'heatMult', TunedStat][] = [
  ['projSpeed', 'velocity'], ['projLife', 'range'], ['kickPitch', 'recoil'], ['kickYaw', 'recoil'],
  ['hipSpread', 'spread'], ['adsSpread', 'spread'], ['bloomPerShot', 'spread'], ['bloomMax', 'spread'],
  ['adsMove', 'handling'], ['reloadTime', 'reloadSpeed'], ['fireCd', 'fireRate'], ['moveMult', 'mobility'], ['heatMult', 'heat'],
]
const STATS = new Set(FIELDS.map(f => f[1]))

// ── the table is the shape canon says ──
ok(RUNES.length === 20 && new Set(RUNES.map(r => r.id)).size === 20, '20 distinct runes')
ok(SIGIL_CAP === 3, 'cap 3')
for (const r of RUNES) ok(r.effects[0].polarity === 1 && r.effects[1].polarity === 1 && r.effects[2].polarity === -1, `${r.id}: two + then one -`)
// every rune on its own: each stat effect moves its fields the right way; everything else is untouched; tags show
for (const r of RUNES) {
  const s = cutAll(r.id)
  ok(s.runes.length === 1, `${r.id} cuts into a blank sigil`)
  const t = tuneGun(G, s, null)
  const lvl = new Map<TunedStat, number>()
  for (const e of r.effects) { const st = STAT_OF[e.key]; if (st) lvl.set(st, (lvl.get(st) ?? 0) + e.polarity) }
  for (const [f, st] of FIELDS) {
    const before = f === 'moveMult' || f === 'heatMult' ? 1 : (G as any)[f] as number
    const after = (t as any)[f] as number
    const l = lvl.get(st) ?? 0
    if (l === 0) ok(near(after, before), `${r.id}: ${String(f)} untouched`)
    else {
      const good = l > 0, smaller = LOWER_IS_BETTER.has(st) ? good : !good
      ok(smaller ? after < before : after > before, `${r.id}: ${String(f)} ${good ? 'better' : 'worse'} (${before} -> ${after})`)
    }
  }
  const tags = sigilEffects(s)
  for (const e of r.effects) if (!STAT_OF[e.key]) ok(tags[e.key] === e.polarity, `${r.id}: tag ${e.key} = ${e.polarity}`)
  ok(Object.keys(tags).every(k => !STAT_OF[k as keyof typeof STAT_OF]), `${r.id}: tags hold no stat effect`)
  ok(t.damage === G.damage && t.crit === G.crit && t.clip === G.clip, `${r.id}: damage/crit/clip untouched`)
}
// every effect key in the table is either a mapped stat or a tag, and each stat is mapped to a real field
ok([...new Set(Object.values(STAT_OF))].every(s => STATS.has(s as TunedStat) || s === 'manaCost'), 'every mapped stat has a field (manaCost = reloadMana)')

// ── hand-checks against weapons.md ──
{
  const t = tuneGun(G, sig('manalic'))
  ok(t.projSpeed > G.projSpeed && t.kickPitch > G.kickPitch && t.kickYaw > G.kickYaw, 'Manalic: faster round, harder kick')
  ok(near(t.projSpeed, G.projSpeed * 1.1) && near(t.kickPitch, G.kickPitch * 1.1), 'Manalic: one 10% step each way')
  const e = tuneGun(G, sig('enchant'))
  ok(e.reloadMana < G.reloadMana && e.projLife < G.projLife && e.adsMove > G.adsMove, 'Enchant: reloads cost less, range shorter, handling better')
  const tp = tuneGun(G, sig('tempest')), hy = tuneGun(G, sig('hydro'))
  ok(tp.reloadMana > G.reloadMana && hy.reloadMana > G.reloadMana, 'Tempest/Hydro: reloads cost MORE')
  ok(hy.projSpeed > G.projSpeed, 'Hydro: faster round')
  ok(tuneGun(G, sig('lightning')).hipSpread > G.hipSpread && tuneGun(G, sig('vapor')).hipSpread > G.hipSpread, 'Lightning/Vapor: shot wanders (wider)')
  ok(tuneGun(G, sig('metalergy')).moveMult < 1 && tuneGun(G, sig('breeze')).moveMult > 1, 'Metalergy slows you; Breeze speeds you')
  ok(tuneGun(G, sig('metalergy')).kickPitch < G.kickPitch, 'Metalergy: recoil control = less kick')
  ok(tuneGun(G, sig('star')).heatMult > 1 && tuneGun(G, sig('freeze')).heatMult > 1, 'Star/Freeze: runs hotter')
  ok(tuneGun(G, sig('life')).reloadTime < G.reloadTime && tuneGun(G, sig('gem')).reloadTime > G.reloadTime, 'Life reloads faster; Gem slower')
  ok(tuneGun(G, sig('barrier')).fireCd > G.fireCd, 'Barrier: slower cycle')
  ok(tuneGun(G, sig('barrier')).kickPitch < G.kickPitch, 'Barrier: less kick')
  // recoil + recoilControl stack on one field
  ok(near(statLevels(sig('manalic', 'metalergy')).recoil!, 0), 'Manalic (-recoil) + Metalergy (+recoilControl) cancel')
}
// a tag-only rune's gun is otherwise identical
{
  const s = cutAll('illuminate'), t = tuneGun(G, s)
  ok(JSON.stringify({ ...t, moveMult: 0, heatMult: 0 }) === JSON.stringify({ ...G, moveMult: 0, heatMult: 0, reloadMana: G.reloadMana }), 'Illuminate (all tags) leaves every number alone')
  ok(sigilEffects(s).mark === 1 && sigilEffects(s).clearSight === 1 && sigilEffects(s).stealth === -1, 'Illuminate tags: mark+ clearSight+ stealth-')
  ok(sigilEffects(cutAll('gem')).sigilHold === 1 && near(tuneGun(G, cutAll('gem')).projSpeed, G.projSpeed), 'Gem sigilHold is a tag; nothing else multiplied')
  ok(sigilEffects(cutAll('fluid', 'dust')).stoppingPower === -1 && sigilEffects(cutAll('fluid', 'dust')).blind === 1, 'tags sum across runes')
}

// ── cut rules ──
{
  ok(canCut(blankSigil('backbone'), 'manalic').ok, 'a blank sigil takes a rune')
  const s1 = cutAll('manalic')
  const sameState = canCut(s1, 'stone')
  ok(!sameState.ok && !sameState.ok && (sameState as any).reason === 'same-state', 'Stone (Solid) refused after Manalic (Solid)')
  ok(cut(s1, 'stone') === s1, 'a refused cut returns the sigil unchanged')
  for (const a of RUNES) for (const b of RUNES) if (a.id !== b.id) ok(canCut(cut(blankSigil('backbone'), a.id), b.id).ok === (a.state !== b.state), `${a.id}->${b.id}: allowed iff states differ`)
  ok((canCut(s1, 'manalic') as any).reason === 'duplicate', 'the same rune twice refused')
  const s3 = cutAll('manalic', 'barrier', 'star')
  ok(s3.runes.length === 3, 'three different states cut')
  const four = canCut(s3, 'life')
  ok(!four.ok && (four as any).reason === 'cap' && cut(s3, 'life').runes.length === 3, '4th rune refused (cap 3)')
  ok(!canCut(blankSigil('x'), 'nope').ok && (canCut(blankSigil('backbone'), 'nope') as any).reason === 'unknown-rune', 'unknown rune refused')
}

// ── sockets ──
{
  const cr = RANGE_GUNS.find(g => g.id === 'charred-rifle')!
  ok(cr.noSigil === true && sigilSlots('charred-rifle') === 0, 'Charred Rifle: noSigil and 0 sockets')
  const r = canCut(blankSigil('charred-rifle'), 'manalic')
  ok(!r.ok && (r as any).reason === 'no-socket', 'Charred Rifle refuses a rune')
  ok(cut(blankSigil('charred-rifle'), 'manalic').runes.length === 0, 'cut leaves it blank')
  const t = tuneGun(cr, { gunId: 'charred-rifle', runes: ['manalic'] }, 'manalic')
  ok(t.projSpeed === cr.projSpeed && t.reloadMana === (cr.reloadMana ?? ECON.reloadMana), 'a socketless gun is never tuned, even by a forged sigil')
  for (const g of RANGE_GUNS) ok(sigilSlots(g.id) === (g.noSigil ? 0 : 1), `${g.id}: sockets agree with RangeGun.noSigil`)
}

// ── birth rune ──
{
  ok(reloadManaWith(sig('manalic', 'barrier'), 'manalic', 11) === 5.5, '1st rune = birth: halved')
  ok(reloadManaWith(sig('barrier', 'manalic'), 'manalic', 11) === 11, 'birth on the 2nd: not halved')
  ok(reloadManaWith(sig('barrier'), 'manalic', 11) === 11 && reloadManaWith(sig(), 'manalic', 11) === 11, 'no match / empty: not halved')
  ok(reloadManaWith(sig('manalic'), null, 11) === 11, 'no birth rune: not halved')
  ok(near(tuneGun(G, sig('manalic'), 'manalic').reloadMana, G.reloadMana / 2), 'tuneGun: birth on 1st halves reloadMana')
  ok(near(tuneGun(G, sig('barrier', 'manalic'), 'manalic').reloadMana, G.reloadMana), 'tuneGun: birth on 2nd does not')
  const en = tuneGun(G, sig('enchant'), 'enchant').reloadMana
  ok(near(en, G.reloadMana / 1.1 / 2), 'halving applies after the manaCost stat')
  ok(near(tuneGun({ ...G, reloadMana: undefined } as Omit<typeof G, 'reloadMana'> & { reloadMana?: number }, sig('barrier')).reloadMana, ECON.reloadMana), 'no gun reloadMana: ECON.reloadMana')
}

// ── clamps ──
{
  const wild = { ...SIGIL_DIALS, step: Object.fromEntries(Object.entries(SIGIL_DIALS.step).map(([k]) => [k, 5])) as typeof SIGIL_DIALS.step }
  const t = tuneGun(G, sig('manalic', 'static', 'star'), null, wild)
  ok(near(t.projSpeed / G.projSpeed, SIGIL_DIALS.max), 'huge step: ceiling holds (x1.6)')
  ok(near(t.kickPitch / G.kickPitch, SIGIL_DIALS.max) && near(t.fireCd / G.fireCd, SIGIL_DIALS.max), 'huge step: a worse-than-ceiling stat clamps too')
  ok(near(statMult('velocity', -3, wild), SIGIL_DIALS.min), 'huge step: floor holds (x0.5)')
  const worst = tuneGun(G, sig('life', 'enchant', 'metalergy'), null, wild)
  ok(worst.reloadTime > 0 && worst.projSpeed > 0 && worst.reloadMana > 0 && worst.moveMult >= SIGIL_DIALS.min, 'nothing reaches 0 or below')
  ok(near(statMult('recoil', 0), 1) && near(statMult('recoil', 3), 1 / 1.1 ** 3), 'default dials: 10% per level, lower-is-better inverts')
}
// ── damage ──
{
  const t = tuneGun(G, sig('manalic', 'barrier', 'star'), 'manalic')
  ok(t.damage === G.damage && t.crit === G.crit, 'damage/crit untouched by a full sigil')
}
// ── the canon table, read live: ids, states, effect labels and polarity all match weapons.md ──
const MD = '/root/athernyx/CANON/game/weapons.md'
if (existsSync(MD)) {
  const rows = readFileSync(MD, 'utf8').split('\n').filter(l => /^\| \*\*[A-Z][a-z]+\*\* \| [A-Z][a-z]+ \| \*\*/.test(l))
  ok(rows.length === 20, `weapons.md table has 20 rune rows (${rows.length})`)
  for (const row of rows) {
    const c = row.split('|').map(x => x.trim()), id = c[1].replace(/\*/g, '').toLowerCase(), r = RUNES.find(x => x.id === id)
    ok(!!r && r.state === c[2], `${id}: state ${c[2]}`)
    if (!r) continue
    for (let i = 0; i < 3; i++) ok(r.effects[i].label === c[3 + i].replace(/^\*\*(.+?)\*\*.*$/, '$1'), `${id}: effect ${i} label "${r.effects[i].label}"`)
  }
}

console.log(`sigil: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
