// Potion drink effects — run: npx tsx src/app/shimmer/engine/potion-effects.test.ts
import {
  drinkBuff, hasBuff, activeBuffList, pruneBuffs, potionEffectLine,
  gatherXpMult, bonusFind, kindredMult, speedMult, manaRegenMult, rinTune, suppressEncounters,
  BUFF_DEFS, POTION_BUFFS, MANA_POTIONS, HEAL_POTIONS,
  STARLIGHT_XP, DAWN_XP, DEEPSIGHT_FIND, DAWN_FIND, KINDRED_MULT, FLEETFOOT_SPEED, DAWN_SPEED, ATHER_REGEN,
  BED_POTIONS, POTION_BUFF_MS, HOLDING_MULT, potionBuffMs, potionBuffLine, type ActiveBuffs,
} from './potion-effects'
import { POTION_DEFS, elementForInfusion, INFUSION_BREWS } from './alchemy'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9

// ── every bottle in POTION_DEFS has a REASON TO EXIST — no more inert brews ─────────────────────
// This assert is why 9 of the 13 potions stopped being brew-for-XP dead ends. It is WIDENED here,
// not weakened: a bottle qualifies by having a drink effect OR by being one of the four elemental
// infusions, which are not drunk at all — canon puts them on a SPIRIT. An ordinary potion with no
// effect still fails exactly as it did before.
//
// ⚠ THE EXEMPTION IS EARNED BY `elementForInfusion`, NEVER BY THE ID'S SPELLING. Anything looser
// would let a future `foo_infusion` excuse itself from having any effect at all, which is precisely
// the hole this loop was written to close.
//
// ⚠ AND IT IS HONEST ABOUT BEING INCOMPLETE: applying an infusion (`addInfusion`, still zero
// callers) is #262 slice 3. Until that lands the four brews genuinely do nothing — which their
// effect line says out loud on the hotbar rather than implying a drink that goes nowhere.
for (const id of Object.keys(POTION_DEFS)) {
  const drinkable = id in POTION_BUFFS || id in MANA_POTIONS || id in HEAL_POTIONS || id === 'harvest_brew'
  // The third class (2026-09-17): a brew that goes on a BED. Earned by the table, never the spelling.
  const covered = drinkable || elementForInfusion(id) !== null || id in BED_POTIONS
  chk(`${id} does something when drunk`, covered)
  chk(`${id} has a menu effect line`, potionEffectLine(id) !== null)
}
// and every buff-potion id actually exists in the brew list
for (const pid of Object.keys(POTION_BUFFS)) chk(`${pid} is brewable`, pid in POTION_DEFS)

// drink → active → expire
const t0 = 1_000_000
const buffs: ActiveBuffs = {}
chk('non-potion drink returns null', drinkBuff(buffs, 'goldwood_plank', t0) === null)
chk('drinking moonvine grants fleetfoot', drinkBuff(buffs, 'moonvine_tonic', t0) === 'fleetfoot')
chk('fleetfoot active right after', hasBuff(buffs, 'fleetfoot', t0 + 1))
const dur = BUFF_DEFS.fleetfoot.durationMs
chk('active at the last instant', hasBuff(buffs, 'fleetfoot', t0 + dur - 1))
chk('expired once the timer passes', !hasBuff(buffs, 'fleetfoot', t0 + dur))
// refresh, not stack
drinkBuff(buffs, 'moonvine_tonic', t0 + dur - 1000)
chk('re-drinking refreshes the timer', hasBuff(buffs, 'fleetfoot', t0 + dur + 1000))

// multipliers compose
const b2: ActiveBuffs = {}
const now = 5_000
chk('baseline xp mult is 1', gatherXpMult(b2, now) === 1)
chk('baseline find is 0', bonusFind(b2, now) === 0)
chk('baseline speed is 1', speedMult(b2, now) === 1)
drinkBuff(b2, 'starlight_tincture', now)
chk('starlight lifts xp', close(gatherXpMult(b2, now + 1), STARLIGHT_XP))
drinkBuff(b2, 'dawn_cordial', now)
chk('starlight × dawn stack', close(gatherXpMult(b2, now + 1), STARLIGHT_XP * DAWN_XP))
drinkBuff(b2, 'deep_essence', now)
chk('deepsight + dawn find add', close(bonusFind(b2, now + 1), DEEPSIGHT_FIND + DAWN_FIND))
drinkBuff(b2, 'moonvine_tonic', now)
chk('fleetfoot × dawn speed', close(speedMult(b2, now + 1), FLEETFOOT_SPEED * DAWN_SPEED))
chk('kindred off by default', kindredMult(b2, now + 1) === 1)
drinkBuff(b2, 'bond_philter', now)
chk('kindred doubles assist', kindredMult(b2, now + 1) === KINDRED_MULT)
chk('regen off by default', manaRegenMult({}, now) === 1)
drinkBuff(b2, 'ather_infusion', now)
chk('ather flow lifts regen', manaRegenMult(b2, now + 1) === ATHER_REGEN)
chk('rin tune neutral without the brew', rinTune({}, now).bite === 1 && rinTune({}, now).window === 1)
drinkBuff(b2, 'glowfin_brew', now)
const tune = rinTune(b2, now + 1)
chk('anglers eye tunes the cast', tune.bite < 1 && tune.window > 1)
chk('dreamwalk off by default', !suppressEncounters({}, now))
drinkBuff(b2, 'dreamroot_elixir', now)
chk('dreamwalk calms the mist', suppressEncounters(b2, now + 1))

// HUD list + prune
const list = activeBuffList(b2, now + 1)
chk('all 8 buffs listed when live', list.length === 8)
chk('list sorted longest-remaining first', list.every((e, i, a) => i === 0 || a[i - 1].remainMs >= e.remainMs))
const pruned = pruneBuffs(b2, now + BUFF_DEFS.dawn.durationMs + 1)
chk('prune drops everything expired', Object.keys(pruned).length === 0)
const half = pruneBuffs(b2, now + BUFF_DEFS.fleetfoot.durationMs + 1)
chk('prune keeps the still-live', Object.keys(half).length > 0 && !('fleetfoot' in half))

// ── the four elemental infusions are a different verb ───────────────────────────────────────────
// ★ PINNED FROM BOTH SIDES. Permitting the exemption above without asserting what it covers would
// let the four quietly become drinkable buffs later with nothing to notice.
for (const [el, id] of Object.entries(INFUSION_BREWS)) {
  chk(`${id} is not a drinkable buff`, !(id in POTION_BUFFS), 'an infusion belongs on a spirit')
  chk(`${id} is not a mana potion`, !(id in MANA_POTIONS))
  chk(`${id} is not a heal potion`, !(id in HEAL_POTIONS))
  chk(`${id} reports its element`, elementForInfusion(id) === el)
}

// ── the holding philter: the same Kindred, held twice as long (2026-09-21) ─────────────────────
// Canon's Wakereed is steeped for HOLDING, so the bottle lengthens a span rather than adding a
// row. Pinned from both sides: the span IS longer, and it is the bond philter's × HOLDING_MULT
// (not a number someone fitted), and every line that names a clock names THIS bottle's.
{
  chk('holding philter grants kindred', POTION_BUFFS.holding_philter === 'kindred')
  chk('holding span = bond span × HOLDING_MULT', potionBuffMs('holding_philter') === potionBuffMs('bond_philter') * HOLDING_MULT)
  chk('HOLDING_MULT is a real lengthening', HOLDING_MULT > 1)
  chk('the bond philter keeps the buff\'s own span', potionBuffMs('bond_philter') === BUFF_DEFS.kindred.durationMs)
  for (const pid of Object.keys(POTION_BUFF_MS)) chk(`${pid} (a span override) is a buff potion`, pid in POTION_BUFFS)
  const h: ActiveBuffs = {}
  drinkBuff(h, 'holding_philter', now)
  chk('kindred live past the bond philter\'s clock', hasBuff(h, 'kindred', now + BUFF_DEFS.kindred.durationMs + 1))
  chk('kindred live at the last instant of the held span', hasBuff(h, 'kindred', now + potionBuffMs('holding_philter') - 1))
  chk('and gone after it', !hasBuff(h, 'kindred', now + potionBuffMs('holding_philter')))
  chk('kindred doubles assist under the holding philter too', kindredMult(h, now + 1) === KINDRED_MULT)
  const bondLine = potionBuffLine('bond_philter'), holdLine = potionBuffLine('holding_philter')
  chk('bond line names 8m', bondLine !== null && / 8m$/.test(bondLine), bondLine ?? '')
  chk('holding line names 16m', holdLine !== null && / 16m$/.test(holdLine), holdLine ?? '')
  chk('holding line carries the same effect words', holdLine !== null && holdLine.startsWith(BUFF_DEFS.kindred.effect))
  chk('the menu line is the bottle\'s line', potionEffectLine('holding_philter') === holdLine)
  chk('every BUFF_DEFS line is its effect at its own clock', (Object.values(BUFF_DEFS)).every(d => d.line === `${d.effect} · ${d.durationMs / 60_000}m`))
  // Drinking the shorter after the longer REFRESHES to the shorter — that is what refresh means,
  // and this pins it so nobody later "fixes" it into a max() without a test noticing.
  drinkBuff(h, 'bond_philter', now + 1000)
  chk('a later bond philter refreshes to its own span', !hasBuff(h, 'kindred', now + 1000 + BUFF_DEFS.kindred.durationMs + 1))
}

console.log(`\npotion-effects: ${ok} ok, ${bad} failed`)
if (bad > 0) process.exit(1)
