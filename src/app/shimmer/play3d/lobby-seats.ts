// lobby-seats.ts — the Departures lobby's rules, apart from its look (2026-09-29): who stands where on the pad, when the
// leader may launch, and how a mate's place reads. Pure, so the oracle runs them without a canvas or a font.
import type { LobbyState } from '@/lib/party-lobby'

export const STATION_ZONE = 'play3d:travelers-station'
/** where a mate is, in a word a keeper reads */
export function whereLabel(zone: string): string {
  if (zone === STATION_ZONE) return 'at the Station'
  if (zone === 'play3d:rune-hold') return 'in the Rune Hold'
  if (zone === 'play3d:the-hold') return 'in the Breach'
  if (zone === 'play3d:stillwind-edge') return 'at the Slack'
  if (zone.startsWith('voxel')) return 'in the Ather'
  if (zone.startsWith('play3d:')) return 'elsewhere in Rune Hold'
  return 'away'
}

export interface Seat { id: string; name: string; look: string; you: boolean; leader: boolean; ready: boolean; here: boolean; where: string }

/**
 * Who stands on the pad, you first. A pure function so the launch rule and the stage read one list.
 */
export function lobbySeats(you: { id: string; name: string; look: string }, lobby: LobbyState | null): Seat[] {
  if (!lobby || lobby.members.length === 0) return [{ id: you.id, name: you.name, look: you.look, you: true, leader: true, ready: true, here: true, where: 'at the Station' }]
  const seats = lobby.members.map((m) => ({
    id: m.id, name: m.name, look: m.look || m.id, you: m.id === you.id, leader: m.id === lobby.leader,
    ready: m.ready, here: m.zone === STATION_ZONE, where: whereLabel(m.zone),
  }))
  // you in the middle, the way the lobby you are copying stands you
  const mine = seats.find((s) => s.you)
  const rest = seats.filter((s) => !s.you)
  return mine ? [mine, ...rest] : seats
}

/** The leader may launch when every OTHER mate standing in the Station is ready. Mates elsewhere stay where they are. */
export function launchBlock(seats: Seat[]): string | null {
  const waiting = seats.filter((s) => !s.you && s.here && !s.ready)
  if (waiting.length) return `Waiting on ${waiting.map((s) => s.name).join(' and ')}`
  return null
}

