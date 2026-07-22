// Potion drink effects — run: npx tsx src/app/shimmer/engine/potion-effects.test.ts
import {
  drinkBuff, hasBuff, activeBuffList, pruneBuffs, potionEffectLine,
  gatherXpMult, bonusFind, kindredMult, speedMult, manaRegenMult, rinTune, suppressEncounters,
  BUFF_DEFS, POTION_BUFFS, MANA_POTIONS, HEAL_POTIONS,
  STARLIGHT_XP, DAWN_XP, DEEPSIGHT_FIND, DAWN_FIND, KINDRED_MULT, FLEETFOOT_SPEED, DAWN_SPEED, ATHER_REGEN,
  type ActiveBuffs,
} from './potion-effects'
import { POTION_DEFS } from './alchemy'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9

// every potion in POTION_DEFS has a drink effect — no more inert bottles
for (const id of Object.keys(POTION_DEFS)) {
  const covered = id in POTION_BUFFS || id in MANA_POTIONS || id in HEAL_POTIONS || id === 'harvest_brew'
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

console.log(`\npotion-effects: ${ok} ok, ${bad} failed`)
if (bad > 0) process.exit(1)
