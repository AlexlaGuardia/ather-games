'use client'
// MoveBook.tsx — the keeper's BOOK: moves indexed by RUNE.
//
// The birth rune sets who you are; it does not hand you a moveset (Alex, 2026-08-03). So the book
// opens on YOUR RUNE'S PAGE — the moves canon has written for it — and the matrix underneath shows
// where that rune sits in the world's grid.
//
// ⚠ ★ BOTH OF THIS HEADER'S "[OPEN] GAP" CLAIMS WERE RULED ON 2026-08-03 AND THIS NOTE MISSED IT
// FOR NINE DAYS (corrected 2026-08-12). Same trap as the duplicate piece layer and #305: a comment
// written in planning tense outlived the ruling it was waiting on, and the next reader parks again.
//
//  1. **A scroll teaches a MOVE, never a RUNE — RULED.** The Passage under Rune Hold is the move
//     economy; the runes you hold are the FILTER on what a scroll can teach you (a Water keeper who
//     buys a Metalergy scroll owns a beautiful piece of paper). It stocks passives and tacticals —
//     ULTIMATES ARE NOT FOR SALE. So the book MAY claim a move as known once acquisition is built.
//     It still doesn't, because nothing grants one yet: the catalogue is now a build gap, not a
//     canon one, and `keeper-moves.knownMoves()` is already the honest answer for what you can run.
//  2. **The lane law is CANON — RULED.** Element row + state column is how a keeper reaches a second
//     rune ("focused practice using your birth rune"). The `isOwner` gate on the lane block was
//     explicitly conditioned on this landing, so it is now free to come off; left in place only
//     because play3d is an owner-only route today and flipping it changes nothing anyone can see.
//
// ── ★ UPDATED 2026-08-14 — THE GREAT REGISTRATION CLOSED MOST OF THIS (24 → 61 moves) ───────────
// This block used to say "the 8 empty runes all carry their moves on the SPIRIT KITS shelf" and name
// Hydro + Mist as P1 authoring debt. Canon registered 37 School techniques that were sitting unplaced
// in `runes.md`, so **exactly ONE page is empty now: Manalic**, and Hydro's page is filled (Pressure
// Lance). Scatter's runes (Static/Dust/Vapor) do now appear in moves, and that is not a contradiction
// of the lost state — the birth screen still never offers them, which is where the canon lives.
//
// ⚠ THE DEBT DID NOT VANISH, IT MOVED, AND THIS PANEL IS WHERE A PLAYER MEETS IT. A page being full
// is not the same as a page being usable: for **Enchant · Lightning · Tempest · Gem · Magma · Mist**
// every move on the page either needs a SECOND rune or is a signature (canon won't sell those), so a
// fresh keeper reads a full page and can hold none of it. That is what `MoveRow`'s "ALSO NEEDS" line
// is for — it renders the real reason instead of an empty box, and it is the honest face of the gap
// until canon authors solo moves for those six or the ruled tutorial hands out a second rune.

import React from 'react'
import { RUNES, ELEMENTS } from './birth/runes.data'
import { MOVES_BY_RUNE, lanesFor, learnableMoves, type KeeperMove, type MoveTier } from './keeper-moves'
import { isBuilt } from './cast'

const MONO = 'ui-monospace, monospace'

// canon state axis, in the order runes.md lays the grid out
const STATES = ['Solid', 'Compact', 'Expanding', 'Ignite', 'Flow', 'Scatter', 'Bind'] as const

const TIER: Record<MoveTier, { label: string; tint: string }> = {
  passive:  { label: 'PASSIVE',  tint: '#8fb4d9' },
  tactical: { label: 'TACTICAL', tint: '#7fe3c8' },
  ultimate: { label: 'SIGNATURE', tint: '#e8c46a' },
  combo:    { label: 'COMBO',    tint: '#d79ae0' },
}

function MoveRow({ m, glow, ownedRune }: { m: KeeperMove; glow: string; ownedRune: string }) {
  const t = TIER[m.tier]
  // runes this move needs BEYOND the one whose page we're on — the reason it isn't yours yet
  const extra = m.runes.filter((r) => r !== ownedRune)
  return (
    <div style={{ padding: '6px 8px', borderRadius: 7, background: '#ffffff08', border: '1px solid #ffffff12', marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: `700 11px ${MONO}`, color: '#eafff6' }}>{m.name}</span>
        <span style={{ font: `800 8px ${MONO}`, letterSpacing: '.12em', color: t.tint, opacity: 0.9 }}>{t.label}</span>
      </div>
      <div style={{ font: `400 9px ${MONO}`, color: '#9fb8b2', lineHeight: 1.45, marginTop: 3 }}>{m.effect}</div>
      {(extra.length > 0 || m.needs) && (
        <div style={{ font: `700 8px ${MONO}`, color: '#c9a86a', marginTop: 4, letterSpacing: '.06em' }}>
          ALSO NEEDS {extra.map((r) => RUNES.find((x) => x.id === r)?.name ?? r).join(' + ')}
          {extra.length > 0 && m.needs ? ' · ' : ''}
          {m.needs ? m.needs.toUpperCase() : ''}
        </div>
      )}
      {/* Two different absences, and conflating them is how "my key does nothing" happens.
          NOT YET LEARNED = canon acquisition is unruled (an [OPEN] gap).
          NOT BUILT YET   = canon HAS written this move; the sim can't run it. A build debt, ours. */}
      <div style={{ font: `700 8px ${MONO}`, color: glow, opacity: 0.55, marginTop: 3, letterSpacing: '.1em' }}>
        NOT YET LEARNED{!isBuilt(m.id) ? ' · NOT BUILT YET' : ''}
      </div>
    </div>
  )
}

// runeId is nullable on purpose — a keeper who hasn't chosen at the birth rite has no page yet.
export default function MoveBook({ runeId, isOwner }: { runeId: string | null; isOwner: boolean }) {
  const rune = RUNES.find((r) => r.id === runeId)
  if (!rune) {
    return (
      <div style={panel}>
        <div style={{ font: `400 10px ${MONO}`, color: '#9fb8b2', textAlign: 'center' }}>
          No birth rune yet — the book opens once you are born of one.
        </div>
      </div>
    )
  }

  const page = MOVES_BY_RUNE[rune.id] ?? []
  const lanes = lanesFor(rune.id)
  const reachable = learnableMoves([rune.id])
  const el = ELEMENTS.find((e) => e.id === rune.element)

  return (
    <div style={panel}>
      {/* ── your rune ── */}
      <div style={{ font: `800 9px ${MONO}`, letterSpacing: '.18em', color: '#8fd9c4', textAlign: 'center', marginBottom: 8 }}>THE BOOK</div>

      <div style={{ textAlign: 'center', padding: '8px 6px 10px', borderRadius: 9, background: `${rune.glow}0e`, border: `1px solid ${rune.glow}44`, marginBottom: 10 }}>
        <div style={{ font: `800 15px ${MONO}`, color: rune.glow, letterSpacing: '.06em' }}>{rune.name}</div>
        <div style={{ font: `700 8px ${MONO}`, color: '#9fb8b2', letterSpacing: '.14em', marginTop: 3 }}>
          {el?.name.toUpperCase()} · {rune.state.toUpperCase()}
        </div>
        <div style={{ font: `400 9px ${MONO}`, color: '#cfeee2', marginTop: 6, lineHeight: 1.5 }}>{rune.essence}</div>
      </div>

      {/* ── the page: moves written for this rune ── */}
      <div style={label}>{page.length ? `WRITTEN FOR ${rune.name.toUpperCase()}` : `${rune.name.toUpperCase()}'S PAGE`}</div>
      {page.length ? (
        page.map((m) => <MoveRow key={m.id} m={m} glow={rune.glow} ownedRune={rune.id} />)
      ) : (
        <div style={{ padding: '10px 8px', borderRadius: 7, background: '#ffffff06', border: '1px dashed #ffffff20', marginBottom: 6 }}>
          <div style={{ font: `700 10px ${MONO}`, color: '#c9a86a' }}>This page is empty.</div>
          <div style={{ font: `400 9px ${MONO}`, color: '#9fb8b2', lineHeight: 1.5, marginTop: 4 }}>
            No move has been written for {rune.name} yet. The rune is real; its techniques are not recorded.
          </div>
        </div>
      )}

      {/* ── the matrix + lanes (OWNER ONLY — compatibility law is unruled) ── */}
      {isOwner && (
        <>
          <div style={{ ...label, marginTop: 12 }}>THE GRID <span style={{ color: '#c9a86a', letterSpacing: '.06em' }}>· dev · lanes unruled</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${STATES.length}, 1fr)`, gap: 2, marginBottom: 8 }}>
            <div />
            {STATES.map((s) => (
              <div key={s} style={{ font: `800 7px ${MONO}`, color: '#7d918c', letterSpacing: '.06em', textAlign: 'center', paddingBottom: 2 }}>
                {s.slice(0, 4).toUpperCase()}
              </div>
            ))}
            {ELEMENTS.map((e) => (
              <React.Fragment key={e.id}>
                <div style={{ font: `800 8px ${MONO}`, color: e.accent, letterSpacing: '.1em', alignSelf: 'center' }}>{e.name.toUpperCase()}</div>
                {STATES.map((s) => {
                  const r = RUNES.find((x) => x.element === e.id && x.state === s)
                  if (!r) return <div key={s} style={{ height: 20, borderRadius: 4, background: '#ffffff05' }} />
                  const isSelf = r.id === rune.id
                  const onLane = lanes.reach.includes(r.id)
                  const hasMoves = (MOVES_BY_RUNE[r.id] ?? []).length > 0
                  return (
                    <div key={s} title={`${r.name} — ${hasMoves ? `${MOVES_BY_RUNE[r.id].length} move(s)` : 'no moves written'}`}
                      style={{
                        height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        font: `800 8px ${MONO}`, letterSpacing: '.02em',
                        background: isSelf ? `${r.glow}33` : onLane ? '#ffffff10' : '#ffffff05',
                        border: isSelf ? `1px solid ${r.glow}` : onLane ? '1px solid #ffffff22' : '1px solid transparent',
                        color: isSelf ? r.glow : onLane ? '#cfeee2' : '#5d6c68',
                        // a rune with no written move reads as hollow — the coverage gap, on screen
                        opacity: hasMoves ? 1 : 0.55,
                      }}>
                      {r.name.slice(0, 4)}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
          <div style={{ font: `400 8px ${MONO}`, color: '#7d918c', lineHeight: 1.5, marginBottom: 10 }}>
            Lit = your element row + state column. Hollow = no move written for that rune yet.
          </div>

          <div style={label}>ON YOUR LANES <span style={{ color: '#c9a86a', letterSpacing: '.06em' }}>· {reachable.length}</span></div>
          {reachable.length ? (
            reachable.map((m) => <MoveRow key={m.id} m={m} glow={rune.glow} ownedRune={rune.id} />)
          ) : (
            <div style={{ font: `400 9px ${MONO}`, color: '#9fb8b2', padding: '6px 2px' }}>
              Nothing reachable — no move on this rune&apos;s row or column has been written.
            </div>
          )}
        </>
      )}

      <div style={{ font: `400 8px ${MONO}`, color: '#6f817d', lineHeight: 1.5, marginTop: 10, borderTop: '1px solid #ffffff12', paddingTop: 7 }}>
        A rune is a word. A move is someone else&apos;s idea about it, bought as a scroll in the Passage.
      </div>
    </div>
  )
}

const panel: React.CSSProperties = {
  width: 268, maxHeight: '70vh', overflowY: 'auto',
  background: 'rgba(11,21,19,0.96)', border: '1px solid #2f5c4f', borderRadius: 11, padding: 10,
}

const label: React.CSSProperties = {
  font: `800 8px ${MONO}`, letterSpacing: '.16em', color: '#8fd9c4', marginBottom: 6,
}
