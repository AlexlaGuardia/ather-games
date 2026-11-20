// THE GARDEN VILLAGE'S MOGLINS, plot side (2026-11-17, play / Jin 2 95f19652). ONE CONTRACT, two lanes (hub 11-17):
//   · HUB (settlements, network.ts) generates each season's Moglins INTO `MoglinRecord` below: name, home, grades, dream,
//     profession, and runs the talk / trust hoops. It imports this type; there is never a second copy.
//   · PLAY (this file + the workshop) keeps a recruited Moglin in the garden save, assigns it to a room, and turns its
//     grades into rates: the IDLE PRODUCT that lands in the room's store.
//   · LARK writes every Moglin line.
//
// Canon (game/ather-rework-2026-11.md): THE GARDEN VILLAGE (RULED 11-15): recruited from settlements by trust between
// free folk; every Moglin has GRADES THAT NEVER CHANGE and a DREAM / PROFESSION; cap 2, then 4, then 6; needs = a bed under
// a roof, food, water. WORKSHOP ROOMS (5) (RULED 11-17): idle gathering is a Moglin's PRODUCT, never a share of a keeper
// skill. Idle CARPENTER = DEADFALL (fallen tier-1 Goldwood only); idle SMITH gathers nothing, it burns deadfall into
// CHARCOAL, the deadfall reaching it by room-to-room TRADE. Grades come in CATEGORIES that set how well a Moglin does its
// trade (crafting speed, gathering yield, and the like). Jin's: categories, scale, rates, caps, which rooms pair.
// THE FARMER (play 11-18, hub-approved build call): a farmer in the Farm TENDS, never plants or harvests (the beds stay the
// keeper's skill). Its work is WATERING growing beds from the water tap's tanks (ather/water.ts; no free water, the fold
// holds none), as often as its YIELD grade says. No bed to water, or dry tanks = nothing banked.
//
// ★ PURE: no React, no DOM except the guarded load/save. Registered in GARDEN_KEY_SPECS (the village is the garden's).
import { gardenKey } from '@/lib/keeper-local'
import { putIn } from './garden-bank'
import { ROOM_STORE_SLOTS, roomStore, type Room, type RoomKind, type Works } from './rooms'
import type { Job } from './furniture'
import { stockJobs, RESERVE, OUT_CAP } from './station-queue'
import { phaseOf, water as waterBed, isArmed, type Farm } from './farming'
import { plumbingOf, draw, type WaterSave } from './water'
import { skillIn, migrateSkills, validSkills, type Skills } from './moglin-skills'

/** Canon's trades (ather-rework › Needs: "a farmer + a cook, then a carpenter + a stonemason, then specialists: alchemist,
 *  smith, jeweler, and more trades as they are ruled"). A new trade is canon's to rule, then one row here. */
export type Profession = 'farmer' | 'cook' | 'carpenter' | 'stonemason' | 'alchemist' | 'smith' | 'jeweler' | 'shopkeeper'   // shopkeeper: Moonwell's Mallow, talk + trust only, never a village job (hub 11-19)
export const PROFESSIONS: readonly Profession[] = ['farmer', 'cook', 'carpenter', 'stonemason', 'alchemist', 'smith', 'jeweler']
/** Which rooms a trade can work. The cook pairs with the Rinnshop too (catches readied for the hearth; a Moglin never
 *  rins, canon 8d3ada7). The farmer keeps the Farm room (it waters, never plants or harvests: see THE FARMER above); the jeweler shares the Stonery's bench. */
export const WORKS_IN: Readonly<Record<Profession, readonly RoomKind[]>> = {
  farmer: ['farm'], cook: ['cooking', 'rinnshop'], carpenter: ['carpentry'], stonemason: ['stonemason'],
  alchemist: ['alchemy'], smith: ['smith'], jeweler: ['stonemason'], shopkeeper: [],
}

/** GRADE CATEGORIES (Jin's; canon: fixed, never trained up, the Moglin's own gifts). 1 (fair) .. 5 (rare).
 *  craft = how fast its bench work goes · yield = how much its idle product brings in · trade = how briskly it hands
 *  goods to a neighbour's room. */
export type GradeCategory = 'craft' | 'yield' | 'trade'
export const GRADE_CATEGORIES: readonly GradeCategory[] = ['craft', 'yield', 'trade']
export type Grade = 1 | 2 | 3 | 4 | 5
export const GRADE_NAME: Record<Grade, string> = { 1: 'fair', 2: 'good', 3: 'fine', 4: 'gifted', 5: 'rare' }

/** ★ THE CONTRACT the settlement side generates into. Everything but `room` and `acc` is fixed at generation. */
export interface MoglinRecord {
  id: string
  name: string
  /** the settlement it came from (network.ts › Settlement id) */
  home: string
  /** M46: that settlement's NAME, kept at recruit so the garden card can say where it came from (absent on older saves) */
  homeName?: string
  /** LEGACY (pre-M46): kept readable; the skills below are what rooms read now (skillIn) */
  grades: Record<GradeCategory, Grade>
  /** M46: nine skills + luck (moglin-skills.ts). Absent on an old save until adoptVillage migrates it. */
  skills?: Skills
  luck?: Grade
  /** what it hopes for, in its own words (lark) */
  dream: string
  profession: Profession
  recruitedAt: number
  /** PLAY's: the room it works (Room.id), or none */
  room?: string
  /** PLAY's: idle product carried between ticks (fractions of an item) */
  acc?: number
}

/** Village cap by plot stage (canon 2 / 4 / 6; what gates each step is Jin's, not built yet: stage 0 for now). */
export const VILLAGE_CAP = [2, 4, 6] as const
export interface Village { v: 1; moglins: MoglinRecord[]; lastTick: number }
export const freshVillage = (now = Date.now()): Village => ({ v: 1, moglins: [], lastTick: now })

/** Take a Moglin in (the hub's recruit step ends here). Refuses past the cap or a repeat. */
export function welcome(v: Village, m: MoglinRecord, stage = 0): Village | null {
  if (v.moglins.length >= VILLAGE_CAP[Math.max(0, Math.min(2, stage))] || v.moglins.some(x => x.id === m.id)) return null
  return { ...v, moglins: [...v.moglins, { ...m, room: undefined, acc: 0 }] }
}
/** Canon's consent law: a Moglin can leave. Its room is simply unworked; nothing in the store goes with it. */
export const farewell = (v: Village, id: string): Village => ({ ...v, moglins: v.moglins.filter(m => m.id !== id) })

/** Put a Moglin to work in a room: its trade must fit, the room must stand, one Moglin to a room. Null when not. */
export function assign(v: Village, w: Works, moglinId: string, roomId: string | null, now = Date.now()): Village | null {
  const m = v.moglins.find(x => x.id === moglinId)
  if (!m) return null
  if (roomId === null) return { ...v, moglins: v.moglins.map(x => (x.id === moglinId ? { ...x, room: undefined, acc: 0 } : x)) }
  const r = w.rooms.find(x => x.id === roomId)
  if (!r || now < r.doneAt || !WORKS_IN[m.profession].includes(r.kind)) return null
  if (v.moglins.some(x => x.id !== moglinId && x.room === roomId)) return null
  return { ...v, moglins: v.moglins.map(x => (x.id === moglinId ? { ...x, room: roomId, acc: 0 } : x)) }
}

// ── THE IDLE PRODUCT ─────────────────────────────────────────────────────────────────────────────────────────────
/** Items an hour, by the yield grade. A fair carpenter brings in 3 deadfall an hour, a rare one 7. */
export const PER_HOUR = (g: Grade) => 2 + g
/** Away for a week is not a week of product: the most one tick credits (the room store's 16 slots cap it again). */
export const MAX_TICK_MS = 12 * 3_600_000
/** The deadfall a smith can burn reaches it by TRADE from the carpentry room's store (canon: room to room is a trade
 *  between neighbours, never labour): only while a carpenter keeps that room. */
const setStore = (w: Works, id: string, stacks: Room['store']): Works => ({ ...w, rooms: w.rooms.map(r => (r.id === id ? { ...r, store: stacks } : r)) })

/** What the farmer tends: the Farm's beds and the tap's water. Passed in and handed back (both live in their own saves). */
export interface Grounds { farm: Farm; water: WaterSave }
/** The next bed a farmer waters: growing, not yet watered (lowest bed first). -1 = none. */
export const bedToTend = (farm: Farm, now: number) => farm.beds.findIndex(b => !!b && !b.watered && phaseOf(b, now, isArmed(farm)) < 3)

/** Run the village forward to `now`: each working Moglin's idle product lands in its room's store; a farmer waters the
 *  Farm's beds (`grounds`, handed back changed, with `tended` = beds watered). Pure. */
export function tick(v: Village, w: Works, now = Date.now(), grounds?: Grounds): { village: Village; works: Works; made: Record<string, number>; grounds?: Grounds; tended: number } {
  const dt = Math.max(0, Math.min(MAX_TICK_MS, now - v.lastTick)), made: Record<string, number> = {}
  let works = w, g = grounds, tended = 0
  const moglins = v.moglins.map(m => {
    const r = m.room ? works.rooms.find(x => x.id === m.room) : undefined
    if (!r || now < r.doneAt) return m
    // Cook / alchemist bench work is the STATION STOCKPILE's (station-queue.ts, ticked by workshop.tsx): one ticker per room.
    let acc = (m.acc ?? 0) + (PER_HOUR(skillIn(m, r.kind, 'yield')) * dt) / 3_600_000
    let n = Math.floor(acc)
    if (n <= 0) return { ...m, acc }
    if (m.profession === 'farmer' && r.kind === 'farm') {
      if (!g) return { ...m, acc: 0 }
      const pl = plumbingOf(works.pieces)
      let did = 0
      while (did < n) {
        const i = bedToTend(g.farm, now)
        if (i < 0) break
        const d = draw(g.water, pl, now)
        if (!d.ok) break
        const f = waterBed(g.farm, i, now)
        if (!f.ok) break
        g = { farm: f.farm, water: d.sv }; did++
      }
      tended += did
      return { ...m, acc: did === n ? acc - n : 0 }   // nothing left to water, or dry tanks: no debt banked
    }
    if (m.profession === 'carpenter' && r.kind === 'carpentry') {
      const p = putIn(roomStore(r), ROOM_STORE_SLOTS, 'deadfall', n)
      n -= p.left; works = setStore(works, r.id, p.bank.stacks)
      if (n) made.deadfall = (made.deadfall ?? 0) + n
      acc = p.left > 0 ? 0 : acc - n   // a full store wastes nothing it could not take, and banks no debt either
      return { ...m, acc }
    }
    if (m.profession === 'smith' && r.kind === 'smith') {
      const carp = works.rooms.find(x => x.kind === 'carpentry' && v.moglins.some(o => o.room === x.id && o.profession === 'carpenter'))
      const fallen = carp ? roomStore(carp).stacks.reduce((a, s) => a + (s.id === 'deadfall' ? s.n : 0), 0) : 0
      const burn = Math.min(n, fallen)
      if (!carp || burn <= 0) return { ...m, acc: 0 }   // nothing to burn: an idle smith gathers nothing (canon)
      const p = putIn(roomStore(r), ROOM_STORE_SLOTS, 'charcoal', burn), done = burn - p.left
      if (done > 0) {
        let need = done
        const left = roomStore(carp).stacks.map(s => ({ ...s })).map(s => { if (s.id === 'deadfall' && need > 0) { const t = Math.min(need, s.n); s.n -= t; need -= t } return s }).filter(s => s.n > 0)
        works = setStore(setStore(works, carp.id, left), r.id, p.bank.stacks)
        made.charcoal = (made.charcoal ?? 0) + done
      }
      return { ...m, acc: done === n ? acc - n : 0 }
    }
    return { ...m, acc: 0 }   // a trade with no idle product yet (stonemason, jeweler): nothing accrues
  })
  return { village: { ...v, moglins, lastTick: now }, works, made, grounds: g, tended }
}

/** What a Moglin does in a room, in a line (the bench panel). */
export function dutyLine(m: MoglinRecord, kind: RoomKind): string {
  if (m.profession === 'carpenter' && kind === 'carpentry') return `Brings in deadfall, about ${PER_HOUR(skillIn(m, kind, 'yield'))} an hour.`
  if (m.profession === 'farmer' && kind === 'farm') return `Waters your growing beds, up to ${PER_HOUR(skillIn(m, kind, 'yield'))} an hour. Planting and harvesting are yours.`
  if (m.profession === 'smith' && kind === 'smith') return `Trades for deadfall from the carpentry room and burns it to charcoal, about ${PER_HOUR(skillIn(m, kind, 'yield'))} an hour.`
  if (stockJobs(kind).length && WORKS_IN[m.profession].includes(kind)) return `Works the room's stockpile from its store: keeps ${RESERVE} of each raw for you, makes up to ${OUT_CAP} of each product. Stock it and there is always something on.`
  return 'Keeps the room. Their trade has no work here yet.'
}

// ── save: garden-tied, registered in GARDEN_KEY_SPECS ─────────────────────────────────────────────────────────
export const VILLAGE_KEY = 'open.village.v1'
const okGrade = (g: unknown): g is Grade => g === 1 || g === 2 || g === 3 || g === 4 || g === 5
/** an old record gets its skills + luck once (stable: seeded by id); a good one is untouched */
const withSkills = (m: MoglinRecord): MoglinRecord => (validSkills(m.skills) && okGrade(m.luck) ? m : { ...m, ...migrateSkills(m) })
export function adoptVillage(raw: unknown, now = Date.now()): Village {
  const v = raw as Partial<Village> | null
  if (v?.v !== 1 || !Array.isArray(v.moglins)) return freshVillage(now)
  const moglins = v.moglins.filter((m): m is MoglinRecord => !!m && typeof m.id === 'string' && typeof m.name === 'string'
    && PROFESSIONS.includes(m.profession) && !!m.grades && GRADE_CATEGORIES.every(c => okGrade(m.grades[c])))
  return { v: 1, moglins: moglins.map(withSkills), lastTick: Number.isFinite(v.lastTick) ? Math.min(v.lastTick!, now) : now }
}
export function loadVillage(now = Date.now()): Village {
  try { return adoptVillage(JSON.parse(localStorage.getItem(gardenKey(VILLAGE_KEY)) ?? 'null'), now) } catch { return freshVillage(now) }
}
export function saveVillage(v: Village) { try { localStorage.setItem(gardenKey(VILLAGE_KEY), JSON.stringify(v)) } catch { /* private window */ } }
