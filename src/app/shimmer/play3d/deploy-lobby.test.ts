/**
 * THE DEPARTURES LOBBY (2026-09-29): who stands on the pad, when the leader may launch, and the wiring that makes a
 * leader's launch take the party. Run: `npx tsx src/app/shimmer/play3d/deploy-lobby.test.ts`
 */
import { readFileSync } from 'node:fs'
import { lobbySeats, launchBlock, whereLabel, STATION_ZONE } from './lobby-seats'
import type { LobbyState } from '@/lib/party-lobby'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const me = { id: 'u_me', name: 'Me', look: 'p_me' }
const mem = (id: string, zone: string, ready = false) => ({ id, name: id.slice(2), zone, ready, trusted: true, look: 'p_' + id })

// A. alone: you, leading yourself, ready, here
const solo = lobbySeats(me, null)
ok(solo.length === 1 && solo[0].you && solo[0].leader && solo[0].here, 'alone: one seat, yours, and you lead it')
ok(launchBlock(solo) === null, 'alone: nothing blocks a launch')

// B. a party: you stand in the middle, whoever you are
const st: LobbyState = { code: 'ABCDE', leader: 'u_lead', mission: 'survival', launch_gen: 0,
  members: [mem('u_lead', STATION_ZONE), mem('u_me', STATION_ZONE), mem('u_far', 'play3d:rune-hold')] }
const seats = lobbySeats(me, st)
ok(seats[0].you && seats.length === 3, '★ you stand in the middle slot (first), mates either side')
ok(seats.find((s) => s.id === 'u_lead')!.leader && !seats[0].leader, 'the leader is marked, and it is not you here')
ok(!seats.find((s) => s.id === 'u_far')!.here && seats.find((s) => s.id === 'u_far')!.where === 'in the Rune Hold', 'a mate elsewhere is faint and says where')

// C. the leader's launch waits for mates IN THE STATION only
const asLead = lobbySeats({ id: 'u_lead', name: 'lead', look: 'p_lead' }, st)
ok(launchBlock(asLead) === 'Waiting on me', `★ the leader waits on a mate at the Station who is not ready (${launchBlock(asLead)})`)
const readyNow = lobbySeats({ id: 'u_lead', name: 'lead', look: 'p_lead' }, { ...st, members: [mem('u_lead', STATION_ZONE), mem('u_me', STATION_ZONE, true), mem('u_far', 'play3d:rune-hold')] })
ok(launchBlock(readyNow) === null, '★ a mate elsewhere never blocks the launch (they are told, not waited on)')

// D. place words
ok(whereLabel('voxel:wilds') === 'in the Ather' && whereLabel(STATION_ZONE) === 'at the Station' && whereLabel('play3d:the-hold') === 'in the Breach', 'where a mate is reads as a place')

// E. the host's wiring
const p3 = readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8')
ok(p3.includes('onLaunch={(m) => { if (partied) lobby.launch(m.id); else launchMission(m, null) }}'), '★ a party launches THROUGH the lobby, so every mate (the leader too) takes one path in')
ok(p3.includes("if (zoneIdRef.current !== 'travelers-station') { setHarvestToast(`${leader} set off for ${card.name}"), 'a mate away from the Station is told, never yanked')
ok(p3.includes('if (hs.over) { if (!coop.link) beginHold(); return }'), 'in a party, going again is the leader\'s call from the lobby')
ok(p3.includes("toZone: 'travelers-station', toX: ship.arrival.x, toY: ship.arrival.z") && p3.includes('reopenLobby.current = true'), '★ a finished run brings you back to the Station with the lobby open')
const zones = readFileSync(new URL('../world/zones.ts', import.meta.url), 'utf8')
ok(!zones.includes("toZone: 'the-hold', toX: HOLD_MAP.start.x, toY: HOLD_MAP.start.z, direction: 'right', label: 'THE BREACH'"), '★ no gangway walks you straight into the Breach: the clerk is the way aboard')

ok(!/ownerOnly: true \}\)\n    else if \(card\.id === 'boss'\)/.test(p3) && !p3.includes("locked: owner ? null : 'Not open yet'"), '★ the Breach and the Slack are open to every keeper (09-29), no owner gate on the way aboard')

console.log(`deploy-lobby: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
