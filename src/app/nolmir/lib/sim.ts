// The match sim. Deterministic: (crucible doc, seed) -> identical match every time.
// A replay is a seed. The terrarium just steps this at watch-speed.
//
// Match structure mirrors the FPS Crucible (and Pyramid Zero canon):
// ARENA — up to 4 teams of 3 spawn at separate gates; the portal is sealed;
// teams converge on it and thin each other out. When one team stands, the
// portal opens — stepping on it ASCENDS the survivors to the GAUNTLET, the
// host's guard hall, where they fight the defenses for the vault.
// The crucible harvests every fall, whoever dealt it.

import {
  CrucibleDoc,
  FloorDoc,
  Fighter,
  GuardState,
  TrapState,
  MatchMods,
  MatchResult,
  Shot,
  TILE,
} from './types'

const NO_MODS: MatchMods = { guardHpMult: 1, spikeDmgMult: 1, yieldMult: 1 }
import { mulberry32, randInt, Rng } from './rng'
import { distanceField, docFloors, findTiles, hasLineOfSight } from './crucible'
import { TeamDoc, TEAM_COMP, ROLE_STATS, pickTeams, retreatBelow, tierMults, challengerLevelMult } from './teams'
import { profileById } from './profiles'

const SPIKE_DAMAGE = 12
const SPIKE_COOLDOWN = 6
// guards scaled for the trinity era — challengers arrive whole now
// (healers sustain the arena, retreats save the wounded)
const GUARD_HP = 65
const GUARD_ATK = 7
// the WATCHER — a posted eye with a sting. Holds a sightline, never walks.
const WATCHER_HP = 40
const WATCHER_ATK = 5
const WATCHER_RANGE = 6
const WATCHER_COOLDOWN = 5 // ticks between bolts — slower than challenger fire
// sigil champions carry reach — amber bolts when prey keeps its distance
const CHAMPION_RANGE = 5
const CHAMPION_COOLDOWN = 6
// the skirmish rhythm — with an enemy in sight at range, melee close in
// short rushes with holds between (shooters plant and trade during holds).
// Reckless teams never hold: the kamikaze charge is a temperament, not a default.
const SKIRMISH_RANGE = 7
const SKIRMISH_PERIOD = 16
const GUARD_AGGRO = 7 // manhattan radius — constructs hunt what enters it
const GUARD_STEP = 2 // guards move every N ticks (slower than fighters)
const SHOOTER_RANGE = 6
const SHOOTER_COOLDOWN = 3 // ticks between shots
const MAX_TICKS = 3000
const TEAM_SIZE = 3
const MAX_TEAMS = 4
const ASCENT_MEND = 0.6 // the portal's light mends this share of missing hp (canon: ~60%)

// cohesion — the squad holds an invisible perimeter around its lead
const TEAM_LEASH = 4 // manhattan tiles a member may stray from the lead
const HEAL_RANGE = 5
const HEAL_COOLDOWN = 3 // ticks between mends
const HEAL_AMOUNT = 5
// past this tick the crucible starves the stalemate — mending withers so
// two cautious teams can't turtle forever (the machine wants drama)
const STARVE_TICK = Math.round(MAX_TICKS * 0.6)

// Yield curve — depth is the multiplier, across BOTH floors: the arena is
// the first half of the journey, the gauntlet the second. Door-deaths pay
// crumbs, vault's-reach deaths pay a feast. (Almost-beatable pays best.)
export function fallenYield(depth: number): number {
  return Math.round(10 * (1 + 9 * depth * depth))
}

export interface MatchState {
  doc: CrucibleDoc
  seed: number
  rng: Rng
  mods: MatchMods
  // the floor chain: arena -> mids -> gauntlet. Fighters carry their own
  // floor index — fights spill between rooms through open portals (canon).
  floors: FloorDoc[]
  dists: Int32Array[] // per-floor exit gradient (portal; vault on the last)
  sealedIdx: number // the portal on THIS floor keeps the last-team-standing rule
  // per-team gradient to the nearest living ENEMY on the sealed floor — the
  // melee-phase brain. Refreshed every few ticks while the portal is sealed.
  enemyFields: (Int32Array | null)[]
  fighters: Fighter[]
  guards: GuardState[] // every floor's constructs (tagged by floor)
  traps: TrapState[] // every floor's traps (tagged by floor)
  shots: Shot[] // recent tracers for the renderer
  teams: number
  teamDocs: TeamDoc[] // roster picks, by team index
  broken: boolean[] // lead fell — the perimeter is gone, the team scatters
  flashes: { floor: number; x: number; y: number; team: number; at: number }[] // lead-death rings
  portalOpen: boolean
  tick: number
  sfx: string[] // this tick's sound tags — the live renderer drains + plays them
  done: boolean
  result: MatchResult | null
}

// the renderer's window: the floor where the action front is — the deepest
// living fighter, falling back to the deepest anyone reached
// formation pace — an unbroken squad moves at its slowest living member's
// rate, so the trinity arrives TOGETHER. A broken team scatters at full
// individual speed (the perimeter died with the lead).
function squadPace(s: MatchState, f: Fighter): number {
  if (s.broken[f.team]) return f.speed
  let pace = f.speed
  for (const m of s.fighters) {
    if (m.alive && m.team === f.team && m.speed < pace) pace = m.speed
  }
  return pace
}

export function frontFloor(s: MatchState): number {
  let view = -1
  for (const f of s.fighters) if (f.alive && f.floor > view) view = f.floor
  if (view === -1) for (const f of s.fighters) if (f.floor > view) view = f.floor
  return Math.max(0, view)
}

const ENEMY_FIELD_REFRESH = 3 // ticks between hunt-gradient rebuilds

// Multi-source BFS from every living enemy of `team`. The sealed portal is
// PASSABLE for the gradient (or chokepoint maps split into unreachable
// halves and everyone freezes mid-aim) — movement still forbids standing
// on it, so approaches mill at the choke and shooters settle it.
function computeEnemyField(s: MatchState, team: number): Int32Array | null {
  const floor = s.floors[s.sealedIdx]
  const dist = new Int32Array(floor.w * floor.h).fill(-1)
  const queue: number[] = []
  for (const e of s.fighters) {
    if (!e.alive || e.team === team || e.floor !== s.sealedIdx) continue
    const idx = e.y * floor.w + e.x
    if (dist[idx] !== -1) continue
    dist[idx] = 0
    queue.push(idx)
  }
  if (queue.length === 0) return null
  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const x = idx % floor.w
    const y = (idx / floor.w) | 0
    const d = dist[idx]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= floor.w || ny >= floor.h) continue
      const nidx = ny * floor.w + nx
      if (dist[nidx] !== -1) continue
      const t = floor.tiles[nidx]
      if (t === TILE.WALL) continue
      dist[nidx] = d + 1
      queue.push(nidx)
    }
  }
  return dist
}

function makeGuards(floor: FloorDoc, floorIdx: number, mods: MatchMods): GuardState[] {
  return floor.pieces
    .filter((p) => p.kind === 'guard' || p.kind === 'watcher')
    .map((p) => {
      const watcher = p.kind === 'watcher'
      const hp = Math.round((watcher ? WATCHER_HP : GUARD_HP) * mods.guardHpMult)
      return {
        floor: floorIdx,
        x: p.x,
        y: p.y,
        homeX: p.x,
        homeY: p.y,
        hp,
        maxHp: hp,
        atk: watcher ? WATCHER_ATK : GUARD_ATK,
        alive: true,
        watcher,
        cooldown: 0,
      }
    })
}

function makeTraps(floor: FloorDoc, floorIdx: number): TrapState[] {
  return floor.pieces
    .filter((p) => p.kind === 'spike')
    .map((p) => ({ floor: floorIdx, x: p.x, y: p.y, cooldown: 0 }))
}

function livingTeams(s: MatchState): Set<number> {
  const t = new Set<number>()
  for (const f of s.fighters) if (f.alive) t.add(f.team)
  return t
}

export function createMatch(doc: CrucibleDoc, seed: number, mods: MatchMods = NO_MODS): MatchState {
  const rng = mulberry32(seed)
  const floors = docFloors(doc)
  const last = floors.length - 1
  const dists = floors.map((fl, k) => distanceField(fl, k === last ? TILE.VAULT : TILE.PORTAL))
  const floor = floors[0]
  const dist = dists[0]
  const gates = findTiles(floor, TILE.GATE)
    .filter((g) => dist[g.y * floor.w + g.x] > 0) // a gate that can't reach the portal spawns no one
    .slice(0, MAX_TEAMS)

  // who answers the beacon — seeded roster picks, tier-gated by host progress
  const teamDocs = pickTeams(rng, Math.max(1, mods.rosterTier ?? 1), gates.length)

  const fighters: Fighter[] = []
  let id = 0
  gates.forEach((gate, team) => {
    const spots: { x: number; y: number }[] = [gate]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
      if (spots.length >= TEAM_SIZE) break
      const nx = gate.x + dx
      const ny = gate.y + dy
      if (nx < 0 || ny < 0 || nx >= floor.w || ny >= floor.h) continue
      if (floor.tiles[ny * floor.w + nx] === TILE.WALL) continue
      if (dist[ny * floor.w + nx] === -1) continue
      spots.push({ x: nx, y: ny })
    }
    const spawnDist = Math.max(1, dist[gate.y * floor.w + gate.x])
    const doc = teamDocs[team]
    const tm = tierMults(doc?.tier ?? 1)
    // the challenger's level rides crucible heat — OFF by default (see teams.ts).
    // when off this is 1.0, so the stat block is identical to before slice 5.
    const lvlMult = challengerLevelMult(mods.heat ?? 0)
    for (let i = 0; i < Math.min(TEAM_SIZE, spots.length); i++) {
      const role = TEAM_COMP[i]
      const st = ROLE_STATS[role]
      // the SLOT defines combat (tank walls, healer mends); the curated comp's
      // PROFILE gives identity + art — the same creature you field as a guard
      const profileId = doc?.members?.[i] ?? profileById('lancer').id
      const hp = Math.round(randInt(rng, st.hpMin, st.hpMax) * tm.hp * lvlMult)
      fighters.push({
        id: id++,
        team,
        kind: st.ranged ? 'shooter' : 'melee',
        role,
        profileId,
        x: spots[i].x,
        y: spots[i].y,
        hp,
        maxHp: hp,
        atk: Math.round(randInt(rng, st.atkMin, st.atkMax) * tm.atk * lvlMult),
        range: st.ranged ? SHOOTER_RANGE : 1,
        speed: (st.speedMin + rng() * (st.speedMax - st.speedMin)) * tm.speed,
        alive: true,
        move: 0,
        floor: 0,
        spawnDist,
        stuck: 0,
        depth: 0,
      })
    }
  })

  const teams = gates.length

  // every floor's defenses stand from the first tick — and the host's three
  // sigil champions hold their posts around the vault on the last floor
  const guards = floors.flatMap((fl, k) => makeGuards(fl, k, mods))
  if (mods.champions?.length) {
    const vfloor = floors[last]
    const v = findTiles(vfloor, TILE.VAULT)[0]
    if (v) {
      const posts: { x: number; y: number }[] = []
      for (let ring = 1; ring <= 4 && posts.length < mods.champions.length; ring++) {
        for (let dy = -ring; dy <= ring && posts.length < mods.champions.length; dy++) {
          for (let dx = -ring; dx <= ring && posts.length < mods.champions.length; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue
            const nx = v.x + dx
            const ny = v.y + dy
            if (nx < 1 || ny < 1 || nx >= vfloor.w - 1 || ny >= vfloor.h - 1) continue
            if (vfloor.tiles[ny * vfloor.w + nx] !== TILE.FLOOR) continue
            if (guards.some((g) => g.floor === last && g.x === nx && g.y === ny)) continue
            if (posts.some((p) => p.x === nx && p.y === ny)) continue
            posts.push({ x: nx, y: ny })
          }
        }
      }
      mods.champions.forEach((c, i) => {
        const p = posts[i]
        if (!p) return
        guards.push({
          floor: last,
          x: p.x,
          y: p.y,
          homeX: p.x,
          homeY: p.y,
          hp: c.hp,
          maxHp: c.hp,
          atk: c.atk,
          alive: true,
          champion: c.name,
        })
      })
    }
  }

  return {
    doc,
    seed,
    rng,
    mods,
    floors,
    dists,
    sealedIdx: last - 1,
    enemyFields: [null, null, null, null],
    fighters,
    guards,
    traps: floors.flatMap((fl, k) => makeTraps(fl, k)),
    shots: [],
    teams,
    teamDocs,
    broken: [false, false, false, false],
    flashes: [],
    portalOpen: teams <= 1,
    tick: 0,
    sfx: [],
    done: false,
    result: null,
  }
}

// ---- the trinity — cohesion, mending, retreat ----

function leadOf(s: MatchState, team: number): Fighter | null {
  for (const f of s.fighters) {
    if (f.alive && f.team === team && f.role === 'lead') return f
  }
  return null
}

function healerOf(s: MatchState, team: number): Fighter | null {
  for (const f of s.fighters) {
    if (f.alive && f.team === team && f.role === 'healer') return f
  }
  return null
}

// the invisible perimeter: a member may step anywhere inside the leash,
// and outside it only on moves that close back toward the lead (soft edge —
// a fight can pull someone a tile or two wide, but never streaming away)
function withinLeash(s: MatchState, f: Fighter, nx: number, ny: number): boolean {
  if (f.role === 'lead' || s.broken[f.team]) return true
  const lead = leadOf(s, f.team)
  if (!lead || lead.floor !== f.floor) return true // the leash can't cross floors
  const d = Math.abs(nx - lead.x) + Math.abs(ny - lead.y)
  if (d <= TEAM_LEASH) return true
  return d < Math.abs(f.x - lead.x) + Math.abs(f.y - lead.y)
}

// a wounded fighter (per temperament) falls back toward their healer
function shouldRetreat(s: MatchState, f: Fighter): boolean {
  if (f.role === 'healer') return false
  if (s.broken[f.team]) return false // no formation left to fall back into
  const doc = s.teamDocs[f.team]
  if (!doc) return false
  const threshold = retreatBelow(doc.temperament)
  if (threshold <= 0 || f.hp > f.maxHp * threshold) return false
  const h = healerOf(s, f.team)
  return h !== null && h.floor === f.floor // no falling back through a portal
}

// the healer mends the most-wounded ally in reach — withering late-match
// so stalemates starve out
function tryHeal(s: MatchState, f: Fighter): boolean {
  if (f.role !== 'healer') return false
  if (s.tick % HEAL_COOLDOWN !== 0) return false
  const starve = s.tick <= STARVE_TICK ? 1 : Math.max(0, 1 - (s.tick - STARVE_TICK) / (MAX_TICKS - STARVE_TICK))
  // the host's hall drinks the light — no mending reaches the vault floor.
  // (earlier fights stay sustained and long; the hall is pure attrition)
  if (f.floor === s.floors.length - 1) return false
  const amount = Math.round(HEAL_AMOUNT * starve)
  if (amount <= 0) return false
  let target: Fighter | null = null
  let worst = 1
  for (const a of s.fighters) {
    if (!a.alive || a.team !== f.team || a.id === f.id || a.floor !== f.floor) continue
    if (a.hp >= a.maxHp) continue
    const d = Math.abs(a.x - f.x) + Math.abs(a.y - f.y)
    if (d > HEAL_RANGE) continue
    const ratio = a.hp / a.maxHp
    if (ratio < worst && hasLineOfSight(s.floors[f.floor], f.x, f.y, a.x, a.y)) {
      worst = ratio
      target = a
    }
  }
  if (!target) return false
  target.hp = Math.min(target.maxHp, target.hp + amount)
  s.shots.push({ floor: f.floor, x0: f.x, y0: f.y, x1: target.x, y1: target.y, team: f.team, at: s.tick, heal: true })
  return true
}

// lead falls -> the perimeter dies with them
function markFallen(s: MatchState, f: Fighter) {
  if (f.role === 'lead' && !s.broken[f.team]) {
    s.broken[f.team] = true
    s.flashes.push({ floor: f.floor, x: f.x, y: f.y, team: f.team, at: s.tick })
    s.sfx.push('break') // the anchor falls — the team scatters
  } else {
    s.sfx.push('death')
  }
}

// ---- targeting helpers ----

function adjacentLivingGuard(s: MatchState, floor: number, x: number, y: number): GuardState | null {
  for (const g of s.guards) {
    if (!g.alive || g.floor !== floor) continue
    if (Math.abs(g.x - x) + Math.abs(g.y - y) <= 1) return g
  }
  return null
}

function adjacentEnemy(s: MatchState, f: Fighter): Fighter | null {
  const floor = s.floors[f.floor]
  for (const e of s.fighters) {
    if (!e.alive || e.team === f.team || e.floor !== f.floor) continue
    const dx = e.x - f.x
    const dy = e.y - f.y
    const d = Math.abs(dx) + Math.abs(dy)
    if (d <= 1) return e
    // duel across the sealed hex — blades reach over the door nobody can open
    if (d === 2 && (dx === 0 || dy === 0) && !s.portalOpen && f.floor === s.sealedIdx) {
      const mx = f.x + dx / 2
      const my = f.y + dy / 2
      if (floor.tiles[my * floor.w + mx] === TILE.PORTAL) return e
    }
  }
  return null
}

function nearestEnemy(s: MatchState, f: Fighter, radius: number): Fighter | null {
  let best: Fighter | null = null
  let bestD = radius + 1
  for (const e of s.fighters) {
    if (!e.alive || e.team === f.team || e.floor !== f.floor) continue
    const d = Math.abs(e.x - f.x) + Math.abs(e.y - f.y)
    if (d < bestD) {
      best = e
      bestD = d
    }
  }
  return best
}

function nearestGuard(s: MatchState, f: Fighter, radius: number): GuardState | null {
  let best: GuardState | null = null
  let bestD = radius + 1
  for (const g of s.guards) {
    if (!g.alive || g.floor !== f.floor) continue
    const d = Math.abs(g.x - f.x) + Math.abs(g.y - f.y)
    if (d < bestD) {
      best = g
      bestD = d
    }
  }
  return best
}

function guardOn(s: MatchState, floor: number, x: number, y: number): boolean {
  return s.guards.some((g) => g.alive && g.floor === floor && g.x === x && g.y === y)
}

function fighterOn(s: MatchState, floor: number, x: number, y: number, exceptId: number): boolean {
  return s.fighters.some(
    (f) => f.alive && f.id !== exceptId && f.floor === floor && f.x === x && f.y === y,
  )
}

// ---- finishing ----

function finish(s: MatchState, winnerTeam: number | null) {
  s.done = true
  if (winnerTeam !== null) s.sfx.push('vault') // a challenger took the vault — the loss
  const fallen = s.fighters.filter((f) => !f.alive)
  let deepest = 0
  let deepestTeam = 0
  for (const f of s.fighters) {
    if (f.depth > deepest) {
      deepest = f.depth
      deepestTeam = f.team
    }
  }
  s.result = {
    seed: s.seed,
    victory: winnerTeam !== null,
    winnerTeam,
    deepestTeam,
    reachedGauntlet: s.fighters.some((f) => f.floor === s.floors.length - 1),
    fallen: fallen.length,
    deepest,
    manaYield: Math.round(fallen.reduce((sum, f) => sum + fallenYield(f.depth), 0) * s.mods.yieldMult),
    ticks: s.tick,
    teamNames: s.teamDocs.map((d) => d.name),
  }
}

// depth across the chain: each floor is an equal leg of the journey
function updateDepth(s: MatchState, f: Fighter) {
  const floor = s.floors[f.floor]
  const d = s.dists[f.floor][f.y * floor.w + f.x]
  if (d === -1) return
  const leg = Math.min(1, Math.max(0, 1 - d / f.spawnDist))
  f.depth = Math.max(f.depth, (f.floor + leg) / s.floors.length)
}

// ---- the ascent ----

// one fighter steps through a portal to the next floor. Open portals just
// carry you; the SEALED portal's light mends (~60% of missing hp) — that one
// is the true ascent into the host's hall.
function transit(s: MatchState, f: Fighter) {
  const from = f.floor
  const k = from + 1
  if (k >= s.floors.length) return
  const floor = s.floors[k]
  const dist = s.dists[k]
  const gates = findTiles(floor, TILE.GATE)
  const gate = gates[0] ?? { x: Math.floor(floor.w / 2), y: floor.h - 3 }

  const spots: { x: number; y: number }[] = [gate]
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
    const nx = gate.x + dx
    const ny = gate.y + dy
    if (nx < 0 || ny < 0 || nx >= floor.w || ny >= floor.h) continue
    if (floor.tiles[ny * floor.w + nx] === TILE.WALL) continue
    if (dist[ny * floor.w + nx] === -1) continue
    spots.push({ x: nx, y: ny })
  }
  const spot =
    spots.find((sp) => !fighterOn(s, k, sp.x, sp.y, f.id) && !guardOn(s, k, sp.x, sp.y)) ??
    spots[spots.length - 1]

  f.floor = k
  f.x = spot.x
  f.y = spot.y
  f.spawnDist = Math.max(1, dist[gate.y * floor.w + gate.x])
  if (from === s.sealedIdx) {
    f.hp = Math.min(f.maxHp, Math.round(f.hp + (f.maxHp - f.hp) * ASCENT_MEND))
  }
}

// ---- guards ----

function walkableForGuard(s: MatchState, floorIdx: number, x: number, y: number): boolean {
  const floor = s.floors[floorIdx]
  if (x < 0 || y < 0 || x >= floor.w || y >= floor.h) return false
  const t = floor.tiles[y * floor.w + x]
  if (t === TILE.WALL || t === TILE.VAULT || t === TILE.GATE || t === TILE.PORTAL) return false
  if (s.guards.some((g) => g.alive && g.floor === floorIdx && g.x === x && g.y === y)) return false
  if (s.fighters.some((f) => f.alive && f.floor === floorIdx && f.x === x && f.y === y)) return false
  return true
}

function stepGuards(s: MatchState): void {
  // ranged constructs act every tick — watchers sting, champions reach.
  // (champions still close and brawl via the melee loop below; the bolt is
  // for prey that keeps its distance)
  for (const g of s.guards) {
    if (!g.alive || (!g.watcher && !g.champion)) continue
    if ((g.cooldown ?? 0) > 0) {
      g.cooldown!--
      continue
    }
    const range = g.watcher ? WATCHER_RANGE : CHAMPION_RANGE
    const floor = s.floors[g.floor]
    let prey: Fighter | null = null
    let preyD = range + 1
    for (const f of s.fighters) {
      if (!f.alive || f.floor !== g.floor) continue
      const d = Math.abs(f.x - g.x) + Math.abs(f.y - g.y)
      if (d < preyD && hasLineOfSight(floor, g.x, g.y, f.x, f.y)) {
        prey = f
        preyD = d
      }
    }
    if (!prey) continue
    if (g.champion && preyD <= 1) continue // adjacent — the blade handles it
    g.fx = prey.x - g.x
    g.fy = prey.y - g.y
    g.cooldown = g.watcher ? WATCHER_COOLDOWN : CHAMPION_COOLDOWN
    const dmg = g.watcher ? g.atk : Math.max(1, Math.round(g.atk * 0.6))
    prey.hp -= dmg
    s.sfx.push('bolt') // a watcher's eye-shot or a champion's amber bolt
    s.shots.push({
      floor: g.floor, x0: g.x, y0: g.y, x1: prey.x, y1: prey.y,
      team: g.watcher ? -1 : -2, at: s.tick,
    })
    if (prey.hp <= 0) {
      prey.alive = false
      markFallen(s, prey)
    }
  }

  if (s.tick % GUARD_STEP !== 0) return
  for (const g of s.guards) {
    if (!g.alive || g.watcher) continue
    let prey: Fighter | null = null
    let preyD = GUARD_AGGRO + 1
    for (const f of s.fighters) {
      if (!f.alive || f.floor !== g.floor) continue
      const d = Math.abs(f.x - g.x) + Math.abs(f.y - g.y)
      if (d < preyD) {
        prey = f
        preyD = d
      }
    }
    if (prey && preyD <= 1) {
      // square up to the strike — aim is free-angle even though steps aren't
      g.fx = prey.x - g.x
      g.fy = prey.y - g.y
      s.sfx.push('hit')
      prey.hp -= g.atk
      if (prey.hp <= 0) {
        prey.alive = false
        markFallen(s, prey)
      }
      continue
    }
    const target = prey ? { x: prey.x, y: prey.y } : { x: g.homeX, y: g.homeY }
    if (target.x === g.x && target.y === g.y) continue
    const options: [number, number][] = [
      [Math.sign(target.x - g.x), 0],
      [0, Math.sign(target.y - g.y)],
    ].filter(([dx, dy]) => dx !== 0 || dy !== 0) as [number, number][]
    for (const [dx, dy] of options) {
      if (walkableForGuard(s, g.floor, g.x + dx, g.y + dy)) {
        g.x += dx
        g.y += dy
        g.fx = dx
        g.fy = dy
        break
      }
    }
  }
}

// ---- fighters ----

function tryShoot(s: MatchState, f: Fighter): boolean {
  if (f.kind !== 'shooter') return false
  if (s.tick % SHOOTER_COOLDOWN !== 0) return false
  // enemy fighters first, then guards
  const floor = s.floors[f.floor]
  const enemy = nearestEnemy(s, f, f.range)
  if (enemy && hasLineOfSight(floor, f.x, f.y, enemy.x, enemy.y)) {
    enemy.hp -= f.atk
    if (enemy.hp <= 0) {
      enemy.alive = false
      markFallen(s, enemy)
    }
    s.sfx.push('bolt')
    s.shots.push({ floor: f.floor, x0: f.x, y0: f.y, x1: enemy.x, y1: enemy.y, team: f.team, at: s.tick })
    return true
  }
  const g = nearestGuard(s, f, f.range)
  if (g && hasLineOfSight(floor, f.x, f.y, g.x, g.y)) {
    s.sfx.push('bolt')
    g.hp -= f.atk
    if (g.hp <= 0) g.alive = false
    s.shots.push({ floor: f.floor, x0: f.x, y0: f.y, x1: g.x, y1: g.y, team: f.team, at: s.tick })
    return true
  }
  return false
}

function moveFighter(s: MatchState, f: Fighter): void {
  const k = f.floor
  const floor = s.floors[k]
  const last = s.floors.length - 1
  // the portal on this floor is sealed only on the floor before the vault
  const portalSealed = k === s.sealedIdx && !s.portalOpen

  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(s.rng() * (i + 1))
    ;[dirs[i], dirs[j]] = [dirs[j], dirs[i]]
  }

  // a wounded fighter with a living healer falls back to them — greedy
  // steps toward the mender, leash still honored
  if (shouldRetreat(s, f)) {
    const h = healerOf(s, f.team)!
    if (Math.abs(h.x - f.x) + Math.abs(h.y - f.y) > 1) {
      for (const [dx, dy] of dirs) {
        const nx = f.x + dx
        const ny = f.y + dy
        const t = floor.tiles[ny * floor.w + nx]
        if (t === TILE.WALL) continue
        if (t === TILE.PORTAL) continue // never retreat THROUGH a portal
        if (t === TILE.VAULT && k !== last) continue
        if (Math.abs(nx - h.x) + Math.abs(ny - h.y) >= Math.abs(f.x - h.x) + Math.abs(f.y - h.y)) continue
        if (guardOn(s, k, nx, ny) || fighterOn(s, k, nx, ny, f.id)) continue
        if (!withinLeash(s, f, nx, ny)) continue
        f.x = nx
        f.y = ny
        updateDepth(s, f)
        return
      }
    }
    return // cornered or already beside the healer — hold
  }

  // the skirmish — an enemy in sight at range changes the walk. Shooters
  // plant and trade; melee close in rushes with holds between, unless the
  // squad is broken (panic) or the temperament is reckless (the charge).
  const sighted = nearestEnemy(s, f, SKIRMISH_RANGE)
  if (sighted && hasLineOfSight(floor, f.x, f.y, sighted.x, sighted.y)) {
    if (f.kind === 'shooter') {
      if (Math.abs(sighted.x - f.x) + Math.abs(sighted.y - f.y) <= f.range) return // planted, firing
    } else if (!s.broken[f.team] && s.teamDocs[f.team]?.temperament !== 'reckless') {
      const hold = s.teamDocs[f.team]?.temperament === 'cautious' ? 10 : 8
      const phase = (s.tick + f.team * 5) % SKIRMISH_PERIOD
      if (phase < hold && Math.abs(sighted.x - f.x) + Math.abs(sighted.y - f.y) > 2) return // holding
    }
  }

  // on the sealed floor, HUNT — descend the enemy gradient. Everywhere else
  // (and once the portal opens) run for the way up — or the vault.
  // The gradient never sees past this floor: the pathing horizon. Wrong
  // turns and dead ends are content.
  const hunting = portalSealed
  const dist = s.dists[k]
  const field = hunting ? (s.enemyFields[f.team] ?? dist) : dist

  const here = field[f.y * floor.w + f.x]
  let best: [number, number] | null = null
  let bestD = here === -1 ? Number.MAX_SAFE_INTEGER : here
  for (const [dx, dy] of dirs) {
    const nx = f.x + dx
    const ny = f.y + dy
    const t = floor.tiles[ny * floor.w + nx]
    if (t === TILE.WALL) continue
    if (t === TILE.PORTAL && portalSealed) continue // sealed until one team stands
    if (t === TILE.VAULT && k !== last) continue
    const d = field[ny * floor.w + nx]
    if (d === -1 || d >= bestD) continue
    if (guardOn(s, k, nx, ny) || fighterOn(s, k, nx, ny, f.id)) continue
    if (!withinLeash(s, f, nx, ny)) continue
    best = [nx, ny]
    bestD = d
  }
  if (!best) {
    // blocked forward — sidestep along equal distance (mills at chokes)
    for (const [dx, dy] of dirs) {
      const nx = f.x + dx
      const ny = f.y + dy
      const t = floor.tiles[ny * floor.w + nx]
      if (t === TILE.WALL) continue
      if (t === TILE.PORTAL && portalSealed) continue
      if (t === TILE.VAULT && k !== last) continue
      const d = field[ny * floor.w + nx]
      if (d === -1 || d > here) continue
      if (guardOn(s, k, nx, ny) || fighterOn(s, k, nx, ny, f.id)) continue
      if (!withinLeash(s, f, nx, ny)) continue
      best = [nx, ny]
      break
    }
  }
  if (!best) {
    // deadlocked (mutual blocks, sealed pockets) — after a few beats, twitch
    // to any open tile so the knot shakes loose (the twitch ignores the
    // leash — better a stray step than a frozen knot)
    f.stuck++
    if (f.stuck >= 4) {
      for (const [dx, dy] of dirs) {
        const nx = f.x + dx
        const ny = f.y + dy
        const t = floor.tiles[ny * floor.w + nx]
        if (t === TILE.WALL) continue
        if (t === TILE.PORTAL && portalSealed) continue
        if (t === TILE.VAULT && k !== last) continue
        if (guardOn(s, k, nx, ny) || fighterOn(s, k, nx, ny, f.id)) continue
        best = [nx, ny]
        break
      }
    }
    if (!best) return
  }

  f.stuck = 0
  f.x = best[0]
  f.y = best[1]
  updateDepth(s, f)

  const landed = floor.tiles[f.y * floor.w + f.x]
  if (landed === TILE.PORTAL && k < last) {
    transit(s, f)
    return
  }
  if (landed === TILE.VAULT && k === last) {
    finish(s, f.team)
    return
  }

  const trap = s.traps.find((t) => t.floor === k && t.x === f.x && t.y === f.y && t.cooldown === 0)
  if (trap) {
    trap.cooldown = SPIKE_COOLDOWN
    f.hp -= Math.round(SPIKE_DAMAGE * s.mods.spikeDmgMult)
    if (f.hp <= 0) {
      f.alive = false
      markFallen(s, f)
    }
  }
}

export function step(s: MatchState): void {
  if (s.done) return
  s.tick++
  s.sfx.length = 0 // this tick's tags only — bounds the non-draining paths

  for (const t of s.traps) if (t.cooldown > 0) t.cooldown--

  // rebuild the hunt gradients (sealed floor only) while the melee is on
  if (!s.portalOpen && s.tick % ENEMY_FIELD_REFRESH === 1) {
    for (let t = 0; t < s.teams; t++) s.enemyFields[t] = computeEnemyField(s, t)
  }

  stepGuards(s)

  for (const f of s.fighters) {
    if (!f.alive || s.done) continue

    // strike order: adjacent enemy, then a pinning guard, then the mend,
    // then ranged fire
    const foe = adjacentEnemy(s, f)
    if (foe) {
      s.sfx.push('hit')
      foe.hp -= f.atk
      if (foe.hp <= 0) {
        foe.alive = false
        markFallen(s, foe)
      }
      continue
    }
    const g = adjacentLivingGuard(s, f.floor, f.x, f.y)
    if (g) {
      s.sfx.push('hit')
      g.hp -= f.atk
      if (g.hp <= 0) g.alive = false
      else if (g.watcher) {
        continue // smashing the eye takes the tick, but a turret can't pin
      } else {
        f.hp -= g.atk
        if (f.hp <= 0) {
          f.alive = false
          markFallen(s, f)
        }
        continue // pinned — the trade was this tick's whole story
      }
    }
    if (tryHeal(s, f)) continue
    if (tryShoot(s, f)) continue

    f.move += squadPace(s, f)
    if (f.move < 1) continue
    f.move -= 1
    moveFighter(s, f)
  }
  if (s.done) return

  // trim old tracers + spent break-rings
  if (s.shots.length > 64) s.shots.splice(0, s.shots.length - 64)
  if (s.flashes.length > 8) s.flashes.splice(0, s.flashes.length - 8)

  // the portal unseals when one team stands
  const alive = livingTeams(s)
  if (!s.portalOpen && alive.size <= 1) s.portalOpen = true

  if (alive.size === 0) finish(s, null)
  else if (s.tick >= MAX_TICKS) finish(s, null)
}

// Run a whole match instantly (editor balancing, offline ledger accumulation).
export function runMatch(doc: CrucibleDoc, seed: number, mods: MatchMods = NO_MODS): MatchResult {
  const s = createMatch(doc, seed, mods)
  while (!s.done) step(s)
  return s.result!
}
