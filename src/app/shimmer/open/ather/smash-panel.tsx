'use client'
// ── SMASH at the Thistledown Fair (BETA M233 s1; ★ M246 REDO 2026-11-27, Alex: "smash needs to get deleted"). E at the Smash
// tent opens its SIGN-UP panel (fair-signup.tsx): pick ONE of your party spirits and Enter. M246: she swings in the BELL SHOW
// (smash-bell-view.tsx, in the Clash ring): an intro card with a shout-out to you, she walks out with her back to the camera,
// unleashes her strongest move at the BIG BELL (smash-score.ts: her favourite, else her strongest known damaging move, from
// the Clash engine's move data + her stats), the bell gauges it and gives the SCORE; over 9000 it cracks. The score goes to
// the SEASON BOARD (/api/fair/smash, s1's rules: SMASH_TRIES a day, shared by every keeper). The old pole is retired.
// Labels: plain functional words (fair-smash-rules.ts SMASH_UI, smash-bell.ts BELL_UI), for @lark to rewrite.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { H } from '../../ui/hearth'
import { FairSignup } from './fair-signup'
import { spiritFormName } from '../../spirits/spirit'
import { speciesOf, gameDay } from './spirit-seeds'
import { useBook } from './spirit-panels'
import { partyIds, subscribeParty } from './spirit-party'
import { loadStats } from './spirit-stats'
import { bondedOf, knownOf } from './spirit-bond-move'
import { smashSwing } from './smash-score'
import { lobbyShow, type BellContestant } from './smash-bell'
import { SmashBellView } from './smash-bell-view'
import { SMASH_UI as L, type SmashBoard } from './fair-smash-rules'
import { useFairLobby, useAutoStart } from './fair-lobby-net'   // M233 s4 EVENT LOBBY
import { isLobby, takers, smashField, smashWinner, smashDone, LOBBY_UI, type LobbySpirit } from './fair-lobby'

const NONE: readonly string[] = []

export function SmashPanel({ onClose }: { onClose: () => void }) {
  const book = useBook()
  const party = useSyncExternalStore(subscribeParty, partyIds, () => NONE)
  const spirits = useMemo(() => party.flatMap(id => {
    const pot = book.pots[id], sp = pot?.bloomed ? speciesOf(pot.seed) : null
    return sp ? [{ id, sp, element: pot.element, name: spiritFormName(sp, pot.element), bonded: bondedOf(pot, gameDay(Date.now())), known: knownOf(pot, sp) }] : []
  }), [party, book])
  const [pick, setPick] = useState<string | null>(null)
  const [board, setBoard] = useState<SmashBoard | null>(null)
  const [hit, setHit] = useState<{ hit: number; move: string; by: string } | null>(null)
  const [show, setShow] = useState<BellContestant[] | null>(null)   // M246: the bell show (solo: her one swing)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const r = await fetch('/api/fair/smash', { cache: 'no-store' }); if (r.ok) setBoard(await r.json()) } catch { /* offline: the board stays blank */ }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (!pick && spirits.length) setPick(spirits[0].id) }, [pick, spirits])

  const chosen = spirits.find(s => s.id === pick) ?? null
  const canSwing = !!chosen && !!board?.signedIn && (board?.triesLeft ?? 0) > 0 && !show
  /** her swing: the score (smash-score.ts), posted to the board at once (a try spent); the show plays it */
  const swing = (): { hit: number; by: string; move: string } | null => {
    if (!chosen || !canSwing) return null
    const r = smashSwing(chosen.sp, loadStats()[chosen.id], chosen.element, { bonded: chosen.bonded, known: chosen.known })
    setMsg(null); setHit({ hit: r.score, move: r.move, by: chosen.name })
    fetch('/api/fair/smash', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hit: r.score, spirit: chosen.name }) })
      .then(async x => { const j = await x.json().catch(() => ({})); if (x.ok) setBoard(j as SmashBoard); else setMsg(String((j as { error?: string }).error ?? 'Could not reach the board.')) })
      .catch(() => setMsg('Could not reach the board.'))
    return { hit: r.score, by: chosen.name, move: r.move }
  }
  const soloSwing = () => {
    const r = swing(); if (!r || !chosen) return
    setShow([{ key: 'you', keeper: 'you', you: true, name: r.by, species: chosen.sp, element: chosen.element ?? 'base', score: r.hit, move: r.move }])
  }

  // ── M233 s4: THE EVENT LOBBY. Chordmates at the bell ready up; at the start each keeper's own spirit swings ONCE (her own try,
  // on the season board as ever) and says the hit; the highest wins, read the same by every keeper in the chord.
  const [ready, setReady] = useState(false)
  const swingRef = useRef(swing); swingRef.current = swing
  const mine = useMemo<LobbySpirit | null>(() => chosen ? { name: chosen.name, species: chosen.sp, element: chosen.element ?? 'base' } : null, [chosen])
  const lobby = useFairLobby('smash', mine, ready, () => { setReady(false); const r = swingRef.current(); if (r) lobby.sendHit(r.hit, r.by) })
  const inLobby = isLobby(lobby.list) || !!lobby.run
  useAutoStart(lobby, smashField)
  const [, setNowTick] = useState(0)
  useEffect(() => { if (!lobby.run) return; const t = setInterval(() => setNowTick(x => x + 1), 1000); return () => clearInterval(t) }, [lobby.run])
  const contestOver = !!lobby.run && smashDone(lobby.hits, lobby.run.seats, lobby.startedAt, Date.now())
  const champId = contestOver && lobby.run ? smashWinner(lobby.hits, lobby.run.seats) : null
  const champ = champId ? lobby.hits.find(h => h.id === champId) ?? null : null
  // M246: the lobby's bell show = the run's seats in seat order (the same for every keeper), each score as it is heard
  const [watchRun, setWatchRun] = useState<string | null>(null)
  useEffect(() => { if (lobby.run && watchRun !== lobby.run.run) setWatchRun(lobby.run.run) }, [lobby.run])   // eslint-disable-line react-hooks/exhaustive-deps
  const lobbyBell = lobby.run && watchRun === lobby.run.run ? lobbyShow(lobby.run, lobby.hits, lobby.me).map(c => (c.you && hit ? { ...c, move: hit.move } : c)) : null
  const [bellSeen, setBellSeen] = useState<string | null>(null)

  if (show) return <SmashBellView title={L.title} contestants={show} onExit={() => setShow(null)} />
  if (lobbyBell && lobby.run && bellSeen !== lobby.run.run) return <SmashBellView title={`${L.title} · ${LOBBY_UI.contest}`} contestants={lobbyBell} over={contestOver} onExit={() => setBellSeen(lobby.run!.run)} />
  return (
    <FairSignup title={L.title} dataPanel="smash" onClose={onClose} spirits={spirits} pick={pick} onPick={setPick}
      entrants={[{ who: 'you', you: true, spirit: chosen?.name ?? null }]} canEnter={canSwing} onEnter={soloSwing}
      lobby={inLobby ? { list: lobby.list, ready, onReady: () => setReady(r => !r), isHost: lobby.isHost, hostName: lobby.list.find(p => p.id === lobby.host)?.who ?? '',
        canStart: lobby.isHost && !lobby.run && takers(lobby.list).length >= 2, onStart: () => lobby.start(smashField), busy: !!lobby.run && !contestOver } : null}
      note={board?.signedIn ? <span data-smash-tries={board.triesLeft} style={{ fontSize: 12, color: H.inkFaint }}>{board.triesLeft > 0 ? L.tries(board.triesLeft) : L.noTries}</span> : null}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gap: 8, alignContent: 'start' }}>
          {board && !board.signedIn && <div style={{ fontSize: 12, color: H.inkFaint }}>{L.signIn}</div>}
          {hit && (
            <div data-smash-hit={hit.hit} style={{ fontSize: 20, fontWeight: 800, color: H.ink, fontVariantNumeric: 'tabular-nums' }}>
              {L.hit(hit.hit)} <span style={{ fontSize: 12, fontWeight: 600, color: H.inkSoft }}>{hit.by} · {hit.move}</span>
            </div>
          )}
          {msg && <div data-smash-msg style={{ fontSize: 12, color: H.rust }}>{msg}</div>}
          <div data-smash-best={board?.best ?? ''} style={{ fontSize: 13, fontWeight: 700, color: H.inkSoft }}>{L.best(board?.best ?? null)}</div>
        </div>
      </div>

      {lobby.run && (
        <div data-smash-contest={lobby.run.run} data-smash-over={contestOver ? '1' : '0'} data-smash-champion={champ ? `${champ.who}:${champ.hit}` : ''} style={{ marginTop: 10, display: 'grid', gap: 2, fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>{LOBBY_UI.contest}</div>
          {lobby.run.seats.map((id, i) => { const h = lobby.hits.find(x => x.id === id); return (
            <div key={`${id}:${i}`} data-contest-seat={lobby.run!.names[i] ?? ''} data-contest-hit={h?.hit ?? ''} style={{ display: 'flex', gap: 8, fontWeight: id === champId ? 900 : 600, color: H.ink }}>
              <span style={{ flex: 1 }}>{lobby.run!.names[i]}{h ? ` · ${h.spirit}` : ''}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{h ? h.hit : '...'}</span>
            </div>) })}
          {!contestOver && <div style={{ fontSize: 12, color: H.inkFaint }}>{LOBBY_UI.swingWait}</div>}
          {champ && <div style={{ fontSize: 15, fontWeight: 800, color: H.ember }}>{LOBBY_UI.winner(champ.who, champ.spirit, champ.hit)}</div>}
          {contestOver && <button data-smash-contest-done onClick={lobby.clearRun} style={{ justifySelf: 'start', marginTop: 4, padding: '4px 12px', borderRadius: 8, border: 'none', background: H.paperLo, color: H.ink, fontWeight: 700, cursor: 'pointer' }}>{L.close}</button>}
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: `1px solid ${H.rule}`, paddingTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{L.board}</div>
        {!board?.top.length && <div style={{ fontSize: 13, fontStyle: 'italic', color: H.inkFaint }}>{L.empty}</div>}
        <div style={{ display: 'grid', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
          {board?.top.map((r, i) => (
            <div key={`${r.who}:${i}`} data-smash-row={r.who} data-best={r.best} data-mine={r.mine ? '1' : '0'}
              style={{ display: 'flex', gap: 8, fontSize: 13, padding: '2px 6px', borderRadius: 6, background: r.mine ? 'rgba(200,100,42,.12)' : 'transparent', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ width: 22, color: H.inkFaint }}>{i + 1}.</span>
              <span style={{ fontWeight: 700, color: H.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.who} <span style={{ fontWeight: 400, color: H.inkFaint }}>· {r.spirit}</span></span>
              <span style={{ fontWeight: 800, color: H.ink }}>{r.best}</span>
            </div>
          ))}
        </div>
      </div>
    </FairSignup>
  )
}
