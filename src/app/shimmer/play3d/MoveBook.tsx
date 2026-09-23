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
//     ULTIMATES ARE NOT FOR SALE.
//  2. **The lane law is CANON — RULED.** Element row + state column is how a keeper reaches a second
//     rune ("focused practice using your birth rune"). The `isOwner` gate on the lane block was
//     explicitly conditioned on this landing, so it is now free to come off; left in place only
//     because play3d is an owner-only route today and flipping it changes nothing anyone can see.
//
// ── ★★ 2026-08-17 — THE PANEL WAS THE LAST THING THAT DIDN'T KNOW THE PASSAGE SHIPPED ───────────
// The line above used to end *"the book MAY claim a move as known once acquisition is built. It
// still doesn't, because nothing grants one yet."* **That stopped being true when `scroll-market.ts`
// + `PassageRack.tsx` shipped** (retired 2026-09-03 into `PassagePanel.tsx`, the four shelves) — the rack rotates, prices, refuses with typed reasons, and writes
// a `Book` the cast layer reads. So the keeper buys a scroll, the rack's own button says **known**,
// the move binds to a cast key and FIRES — and this panel went on stamping **NOT YET LEARNED** on
// it, because `MoveRow` hardcoded that string and the component was never handed the book.
//
// ★ THE TELL WAS A HARDCODED STATUS. A row that cannot say anything else is not reporting state,
// it is asserting a belief the file held on the day it was written — the same shape as the `[OPEN]`
// claims above, one layer down. It read as a canon gap ("acquisition is unruled") when what it
// actually was, by then, was a panel that had not been re-wired. **The book now takes the `Book`
// and the runes held, and every row derives its own status.** Four states, canon's own words:
//   **KNOWN** (learned + runes carried) · **KNOWN, QUIET** (learned, rune since lost — `castable()`
//   keeps the knowledge and silences the move) · **A SCROLL YOU CAN READ** (readable, priced, in
//   the rack's rotation) · **LOCKED** (you do not carry the runes it is written in).
//   Signatures and runewords get their own line, because canon does not sell those at all.
// `NOT BUILT YET` stays orthogonal and rides along any of them: 13 of the 68 are archetype
// `unbuilt` with a `why`, and they are SHOWN rather than hidden — hiding a registered move is how
// a keeper concludes their book is short.
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
//
// ── ★ 2026-09-23 — RESTYLED ONTO THE CARVED HEARTH ──────────────────────────────────────────────
// The host now mounts this panel's output inside `HearthFrame` (ui/hearth.tsx), which supplies the
// wood frame, the "The book" plaque, and the close knob — so this file no longer owns its own dark
// chrome or its own ALL-CAPS "THE BOOK" header. Every colour below is either an `hk-*` utility class
// (ui/hearth.css) or genuine per-rune/per-element DATA (`rune.glow`, `e.accent`) read from
// `birth/runes.data.ts` — that palette is canon's, not this file's, and it stays as-is.

import React from 'react'
import { RUNES, ELEMENTS } from './birth/runes.data'
import { MOVES_BY_RUNE, lanesFor, learnableMoves, type KeeperMove, type MoveTier } from './keeper-moves'
import { isBuilt } from './cast'
import { canRead, hasLearned, priceOf, tradeable, EMPTY_BOOK, type Book } from './scroll-market'

// ★ The page is PARCHMENT now (2026-09-23, Carved Hearth column pass): the hearth's body face, a
// notch larger than the old 8-9px terminal mono, which was sized for light-on-dark. `DISPLAY` is for
// names (the rune's, each move's) — the same serif the frame's plaque speaks in.
const FACE = 'var(--font-hearth-body), system-ui, sans-serif'
const DISPLAY = 'var(--font-hearth-display), Georgia, serif'

// canon state axis, in the order runes.md lays the grid out
const STATES = ['Solid', 'Compact', 'Expanding', 'Ignite', 'Flow', 'Scatter', 'Bind'] as const

const TIER: Record<MoveTier, { label: string; tone: string }> = {
  passive:  { label: 'PASSIVE',  tone: 'hk-sky' },
  // A trait is runeless and always on — no socket, no gate, nothing to equip. Kept off the cool
  // "passive" tone on purpose: it reads as something the keeper simply HAS, next to the sky-blue of
  // a passive they run.
  trait:    { label: 'TRAIT',    tone: 'hk-soft' },
  tactical: { label: 'TACTICAL', tone: 'hk-moss' },
  ultimate: { label: 'SIGNATURE', tone: 'hk-ember' },
  combo:    { label: 'COMBO',    tone: 'hk-violet' },
}

/**
 * The four states a move can be in for THIS keeper, in canon's vocabulary.
 *
 * ★ `learned` and `readable` are independent on purpose and that is not an edge case: reading a
 * scroll does not rewrite what you are, so a keeper can know a move and later lose the rune it is
 * written in. `castable()` keeps the knowledge and silences the move rather than editing the book
 * behind the player's back — this panel says the same thing out loud instead of lying in either
 * direction ("forgotten" would be false; a plain "KNOWN" next to a dead key would be worse).
 */
export function statusOf(m: KeeperMove, book: Book, owned: readonly string[]) {
  const learned = hasLearned(book, m.id)
  const readable = canRead(m, owned)
  if (learned && readable) return { label: 'KNOWN', tone: 'hk-ember', lit: true }
  if (learned) return { label: 'KNOWN · QUIET WITHOUT ITS RUNE', tone: 'hk-soft', lit: false }
  if (!readable) return { label: 'LOCKED', tone: 'hk-rust', lit: false }
  // Readable and unlearned: the Passage is the only way in, and canon decides whether it stocks it.
  if (tradeable(m)) return { label: `A SCROLL YOU CAN READ · ✦ ${priceOf(m)}`, tone: 'hk-sky', lit: false }
  return {
    label: m.tier === 'combo' ? 'A RUNEWORD — TWO MAGES IN SYNC' : 'EARNED IN THE WORLD — NEVER SOLD',
    tone: 'hk-violet', lit: false,
  }
}

function MoveRow({ m, owned, book }: { m: KeeperMove; owned: readonly string[]; book: Book }) {
  const t = TIER[m.tier]
  // The runes this keeper does NOT carry — the real reason the move isn't theirs, which is not the
  // same as "every rune but this page's" once a second rune is developed.
  const extra = m.runes.filter((r) => !owned.includes(r))
  const st = statusOf(m, book, owned)
  return (
    <div className={`hk-plate${st.lit ? ' is-lit' : ''}`} style={{ padding: '6px 8px', marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="hk-ink" style={{ font: `600 14px ${DISPLAY}` }}>{m.name}</span>
        <span className={t.tone} style={{ font: `800 10px ${FACE}`, letterSpacing: '.12em', opacity: 0.9 }}>{t.label}</span>
      </div>
      <div className="hk-soft" style={{ font: `400 11px ${FACE}`, lineHeight: 1.45, marginTop: 3 }}>{m.effect}</div>
      {(extra.length > 0 || m.needs) && (
        <div className="hk-rust" style={{ font: `700 10px ${FACE}`, marginTop: 4, letterSpacing: '.06em' }}>
          ALSO NEEDS {extra.map((r) => RUNES.find((x) => x.id === r)?.name ?? r).join(' + ')}
          {extra.length > 0 && m.needs ? ' · ' : ''}
          {m.needs ? m.needs.toUpperCase() : ''}
        </div>
      )}
      {/* Two different absences, and conflating them is how "my key does nothing" happens.
          The STATUS   = where this keeper stands with the move (learned? runes carried? for sale?).
          NOT BUILT YET = canon HAS written this move; the sim can't run it. A build debt, ours —
          orthogonal to the status, so a KNOWN move can still be unbuilt and must say so. */}
      <div className={st.tone} style={{ font: `700 10px ${FACE}`, opacity: st.lit ? 0.95 : 0.6, marginTop: 3, letterSpacing: '.1em' }}>
        {st.lit ? '◆ ' : ''}{st.label}{!isBuilt(m.id) ? ' · NOT BUILT YET' : ''}
      </div>
    </div>
  )
}

/**
 * runeId is nullable on purpose — a keeper who hasn't chosen at the birth rite has no page yet.
 *
 * `book` and `owned` both default, and the defaults lean the safe way. An absent book is the EMPTY
 * one, so a caller that forgets it can never invent knowledge the keeper does not have — the panel
 * under-claims instead of lighting up a move whose key is dead. Absent `owned` falls back to the
 * birth rune alone, which is not a guess: the page belongs to that rune and a keeper always carries
 * the one they were born of. A second, developed rune is the thing a caller must actually pass.
 */
export default function MoveBook(
  { runeId, isOwner, book = EMPTY_BOOK, owned }:
  { runeId: string | null; isOwner: boolean; book?: Book; owned?: readonly string[] },
) {
  const rune = RUNES.find((r) => r.id === runeId)
  if (!rune) {
    return (
      <div className="hearth-scroll" style={panel}>
        <div className="hk-faint" style={{ font: `400 11px ${FACE}`, textAlign: 'center' }}>
          No birth rune yet — the book opens once you are born of one.
        </div>
      </div>
    )
  }

  const have = owned ?? [rune.id]
  const page = MOVES_BY_RUNE[rune.id] ?? []
  const lanes = lanesFor(rune.id)
  const reachable = learnableMoves([rune.id])
  const el = ELEMENTS.find((e) => e.id === rune.element)

  return (
    <div className="hearth-scroll" style={panel}>
      {/* ── your rune ── the plaque above already says "The book"; this is the page it opens to ── */}
      <div style={{ textAlign: 'center', padding: '8px 6px 10px', borderRadius: 10, border: `1.5px solid ${rune.glow}`, marginBottom: 10 }} className="hk-plate">
        {/* The rune's glow is a colour for a DARK plate; on parchment it is the plaque's EDGE and a swatch,
            never the text — as text it measured near-invisible (pale cyan on cream). */}
        <div className="hk-ink" style={{ font: `600 19px ${DISPLAY}` }}>
          <span aria-hidden className="hk-rule" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: rune.glow, marginRight: 7, verticalAlign: 'middle', borderWidth: 1, borderStyle: 'solid' }} />
          {rune.name}
        </div>
        <div className="hk-soft" style={{ font: `700 10px ${FACE}`, letterSpacing: '.14em', marginTop: 3 }}>
          {el?.name.toUpperCase()} · {rune.state.toUpperCase()}
        </div>
        <div className="hk-ink" style={{ font: `400 11px ${FACE}`, marginTop: 6, lineHeight: 1.5 }}>{rune.essence}</div>
      </div>

      {/* ── the page: moves written for this rune ── */}
      <div className="hk-label hk-soft" style={label}>{page.length ? `Written for ${rune.name}` : `${rune.name}'s page`}</div>
      {page.length ? (
        page.map((m) => <MoveRow key={m.id} m={m} owned={have} book={book} />)
      ) : (
        <div className="hk-fill hk-rule" style={{ padding: '10px 8px', borderRadius: 7, marginBottom: 6, borderWidth: 1, borderStyle: 'dashed' }}>
          <div className="hk-rust" style={{ font: `700 11px ${FACE}` }}>This page is empty.</div>
          <div className="hk-soft" style={{ font: `400 11px ${FACE}`, lineHeight: 1.5, marginTop: 4 }}>
            No move has been written for {rune.name} yet. The rune is real; its techniques are not recorded.
          </div>
        </div>
      )}

      {/* ── the matrix + lanes (OWNER ONLY — compatibility law is unruled) ── */}
      {isOwner && (
        <>
          <div className="hk-label hk-soft" style={{ ...label, marginTop: 12 }}>The grid <span className="hk-faint" style={{ letterSpacing: '.06em' }}>· dev · lanes unruled</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${STATES.length}, 1fr)`, gap: 2, marginBottom: 8 }}>
            <div />
            {STATES.map((s) => (
              <div key={s} className="hk-faint" style={{ font: `800 9px ${FACE}`, letterSpacing: '.06em', textAlign: 'center', paddingBottom: 2 }}>
                {s.slice(0, 4).toUpperCase()}
              </div>
            ))}
            {ELEMENTS.map((e) => (
              <React.Fragment key={e.id}>
                <div className="hk-ink" style={{ font: `800 11px ${FACE}`, letterSpacing: '.08em', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                  <span aria-hidden style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: e.accent, marginRight: 4, verticalAlign: 'middle' }} />
                  {e.name.toUpperCase()}
                </div>
                {STATES.map((s) => {
                  const r = RUNES.find((x) => x.element === e.id && x.state === s)
                  if (!r) return <div key={s} className="hk-fill" style={{ height: 20, borderRadius: 4 }} />
                  const isSelf = r.id === rune.id
                  const onLane = lanes.reach.includes(r.id)
                  const hasMoves = (MOVES_BY_RUNE[r.id] ?? []).length > 0
                  return (
                    <div key={s} title={`${r.name} — ${hasMoves ? `${MOVES_BY_RUNE[r.id].length} move(s)` : 'no moves written'}`}
                      className={isSelf ? undefined : onLane ? 'hk-fill-sky hk-sky hk-rule-sky' : 'hk-fill hk-faint'}
                      style={{
                        height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        font: `800 10px ${FACE}`, letterSpacing: '.02em',
                        ...(isSelf ? { background: `${r.glow}33`, border: `1px solid ${r.glow}`, color: r.glow }
                                   : onLane ? { borderWidth: 1, borderStyle: 'solid' } : {}),
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
          <div className="hk-faint" style={{ font: `400 10px ${FACE}`, lineHeight: 1.5, marginBottom: 10 }}>
            Lit = your element row + state column. Hollow = no move written for that rune yet.
          </div>

          <div className="hk-label hk-soft" style={label}>On your lanes <span className="hk-moss" style={{ letterSpacing: '.06em' }}>· {reachable.length}</span></div>
          {reachable.length ? (
            reachable.map((m) => <MoveRow key={m.id} m={m} owned={have} book={book} />)
          ) : (
            <div className="hk-soft" style={{ font: `400 11px ${FACE}`, padding: '6px 2px' }}>
              Nothing reachable — no move on this rune&apos;s row or column has been written.
            </div>
          )}
        </>
      )}

      <div className="hk-faint hk-rule" style={{ font: `400 10px ${FACE}`, lineHeight: 1.5, marginTop: 10, borderTopWidth: 1, borderTopStyle: 'solid', paddingTop: 7 }}>
        A rune is a word. A move is someone else&apos;s idea about it, bought as a scroll in the Passage.
      </div>
    </div>
  )
}

const panel: React.CSSProperties = {
  width: '100%', maxWidth: 268, maxHeight: '70vh', overflowY: 'auto', padding: '24px 12px 12px',
}

// Section heads in the hearth's display face, sentence case — so no caps tracking (it was 8px/.16em mono).
const label: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, marginBottom: 6,
}
