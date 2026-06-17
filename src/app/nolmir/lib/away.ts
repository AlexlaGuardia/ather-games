// NOLMIR — the homecoming settle. The full "what happened while you were away"
// for the Crucible economy: the forge hummed, supply lines drank their upkeep,
// and the beacon was answered by challengers on a 20-min wall-clock cadence
// (vaults fall, lines get cut). Shared by the Command Deck (the front door, where
// you now collect) AND the Crucible page so they agree EXACTLY — deterministic
// seeds + idempotent via host.lastSeenAt (whoever loads first banks the haul; the
// other opens an empty window and sees nothing).

import { demoCrucible, loadCrucible } from './crucible'
import { runMatch } from './sim'
import { loadHost, saveHost } from './host'
import {
  loadForge, saveForge, settleForge, forgeMods, forgeHeat, settleConnections, cutConnection,
  type ForgeState,
} from './starforge'
import { loadExpedMeta, championsOffPost } from './expedmeta'
import { unlockedTier } from './teams'
import { CrucibleDoc, HostState, LedgerEntry, MatchMods, TEAM_NAMES } from './types'
import { mulberry32, pick } from './rng'

// a match answers the beacon every 20 minutes, watched or not (matches are
// EVENTS, not a back-to-back blur). Beyond two days (144 marks) the beacon dims.
export const MATCH_INTERVAL = 20 * 60 * 1000
export const AWAY_CAP = 144

const TEAM_EPITHETS = ['Cohort', 'Wardens', 'Reavers', 'Pilgrims', 'Sworn', 'Hunters', 'Vanguard', 'Chorus', 'Tide', 'Kin']

export function teamName(seed: number, team: number): string {
  const rng = mulberry32((seed ^ 0x9e3779b9) + team * 0x85ebca6b)
  return `${TEAM_NAMES[team % TEAM_NAMES.length]} ${pick(rng, TEAM_EPITHETS)}`
}

export interface AwayDigest {
  matches: number
  mana: number
  exp: number
  vaultFalls: number
  best: LedgerEntry | null
}

export interface Homecoming {
  doc: CrucibleDoc
  forge: ForgeState
  host: HostState
  mods: MatchMods
  corelight: number
  away: AwayDigest | null
  awayMs: number
}

// Settle the whole Crucible homecoming and persist forge + host. Returns the
// pieces both surfaces need (the deck reads the digest; the Crucible page also
// uses doc/mods/corelight to render the live hub).
export function settleHomecoming(now: number): Homecoming {
  const doc = loadCrucible() ?? demoCrucible()
  // the forge hums whether or not you visit it
  let forge = settleForge(loadForge(now), now)
  const host = loadHost()
  const priorSeen = host.lastSeenAt ?? now
  // supply lines drink first — unpaid upkeep frays them
  const sc = settleConnections(forge, host.mana, now)
  forge = sc.forge
  host.mana = sc.mana
  const mods = forgeMods(forge)
  // a guard on a live expedition is off their crucible post
  if (championsOffPost(loadExpedMeta(), now)) mods.champions = undefined
  // louder crucibles draw harder challengers — roster tier rides heat
  mods.rosterTier = unlockedTier({ heat: forgeHeat(forge), exp: host.exp })
  mods.heat = forgeHeat(forge)

  // settle the matches that passed while gone — wall-clock aligned, deterministic
  // seeds, so a reload can't reroll history and live/away marks line up
  const ticks: number[] = []
  for (let at = (Math.floor(priorSeen / MATCH_INTERVAL) + 1) * MATCH_INTERVAL; at <= now; at += MATCH_INTERVAL) {
    ticks.push(at)
  }
  const missed = ticks.slice(-AWAY_CAP)
  let away: AwayDigest | null = null
  if (missed.length > 0) {
    const d: AwayDigest = { matches: missed.length, mana: 0, exp: 0, vaultFalls: 0, best: null }
    const heat = forgeHeat(forge)
    for (const at of missed) {
      const seed = Math.floor(at / 1000) >>> 0
      // past the heat ceiling, rarely, the beacon draws... nothing that fights
      if (heat > 250 && seed % 17 === 0) {
        const omen: LedgerEntry = {
          seed, victory: false, winnerTeam: null, deepestTeam: 0, reachedGauntlet: false,
          fallen: 0, deepest: 0, manaYield: 0, ticks: 0, at, teamName: '', omen: true,
        }
        host.ledger = [omen, ...host.ledger].slice(0, 100)
        continue
      }
      const r = runMatch(doc, seed, mods)
      const namedTeam = r.victory && r.winnerTeam !== null ? r.winnerTeam : r.deepestTeam
      const entry: LedgerEntry = { ...r, at, teamName: r.teamNames?.[namedTeam] ?? teamName(r.seed, namedTeam) }
      host.ledger = [entry, ...host.ledger].slice(0, 100)
      host.mana += r.manaYield
      host.exp += r.fallen * 5 + Math.round(r.deepest * 20)
      d.mana += r.manaYield
      d.exp += r.fallen * 5 + Math.round(r.deepest * 20)
      if (r.victory) {
        d.vaultFalls++
        // they take a Wonder and cut a line on the way out
        host.mana = Math.max(0, host.mana - Math.max(100, Math.round(host.mana * 0.15)))
        forge = cutConnection(forge, seed).forge
      }
      if (!d.best || entry.deepest > d.best.deepest) d.best = entry
    }
    away = d
  }

  saveForge(forge)
  host.lastSeenAt = now
  saveHost(host)
  return { doc, forge, host, mods, corelight: forge.corelight, away, awayMs: Math.max(0, now - priorSeen) }
}
