'use client'
// The Passage's scroll rack — the face of `scroll-market.ts`.
//
// ★ NO RULES LIVE HERE. What is stocked, what it costs, what you may read and whether a purchase is
// allowed all come from the market module. This file draws rows and reports the refusal, which is
// the only way the rack's canon (ultimates unsellable, the rune as filter) has exactly one
// definition instead of one in the sim and one in the UI that agree until they don't.
//
// ── ★ THE UNREADABLE ROW IS THE FEATURE, NOT AN ERROR STATE ────────────────────────────────────
// The reflex is to hide what the keeper cannot read — a tidy rack of things you can afford to care
// about. Canon rules the opposite: *"the same rack means something different to every keeper who
// walks past it… this is what makes the market interesting rather than a vending machine."* So an
// unreadable scroll is DRAWN, dimmed, with the runes it is written in named. You see the Metalergy
// scroll you cannot read, and the market has told you what you are. Hiding it would make every
// keeper's Passage look identical and delete the sentence.
//
// ── the refusal speaks ─────────────────────────────────────────────────────────────────────────
// Every failed buy puts the trader's line on screen (`market.buy` always returns one). The 08-12
// lesson: a refusal nobody can read is the same as a dead click, and a dead click is the least
// visible bug a game can have.

import { useState } from 'react'
import { StationShell } from './ui'
import { RUNES } from './birth/runes.data'
import {
  rackFor, cycleAt, msUntilRotation, priceOf, canRead, hasLearned, buy, type Book,
} from './scroll-market'
import type { KeeperMove } from './keeper-moves'

const GOLD = '#ffe08a'
const runeName = (id: string) => RUNES.find((r) => r.id === id)?.name ?? id

export function PassageRack(p: {
  seed: number
  nowMs: number
  book: Book
  marks: number
  ownedRunes: readonly string[]
  /** Commit a purchase: spend the marks, keep the book, re-resolve the loadout. */
  onBuy: (book: Book, spent: number) => void
  onClose: () => void
}) {
  const [say, setSay] = useState<string>('Rotating stock. Nobody down here holds a claim.')
  const cycle = cycleAt(p.nowMs)
  const rack = rackFor(p.seed, cycle)
  const mins = Math.max(1, Math.round(msUntilRotation(p.nowMs) / 60000))

  const attempt = (m: KeeperMove) => {
    const r = buy(p.book, p.marks, p.ownedRunes, m, rack)
    setSay(r.say)
    if (r.ok) p.onBuy(r.book, p.marks - r.marks)
  }

  return (
    <StationShell
      accent={GOLD} border="#5c4a2a" bg="#171208" title="✦ THE PASSAGE"
      onClose={p.onClose}
      subtitle={
        <div style={{ marginBottom: 10 }}>
          <div style={{ font: '600 10px ui-monospace, monospace', color: '#c9b58a' }}>
            ✦ {p.marks} marks · the traders change over in {mins}m
          </div>
          {/* Canon's own line about the place, and a working instruction at the same time. */}
          <div style={{ font: '600 10px ui-monospace, monospace', color: '#7d6b4c', marginTop: 2, fontStyle: 'italic' }}>
            A scroll teaches a technique, never a rune. What you can read is what you already are.
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rack.map((m) => {
          const readable = canRead(m, p.ownedRunes)
          const owned = hasLearned(p.book, m.id)
          const price = priceOf(m)
          const afford = p.marks >= price
          const can = readable && !owned && afford
          return (
            <div key={m.id} style={{
              background: '#221a0d', border: `1px solid ${owned ? '#4a6a4a' : '#ffffff14'}`, borderRadius: 10,
              padding: '9px 11px', opacity: readable ? 1 : 0.45,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ font: '800 13px ui-monospace, monospace', color: '#f2e6cc' }}>{m.name}</span>
                <span style={{ font: '700 10px ui-monospace, monospace', color: '#9b8a66', letterSpacing: '0.08em' }}>
                  {m.tier.toUpperCase()}
                </span>
              </div>
              <div style={{ font: '600 10px ui-monospace, monospace', color: '#bda880', marginTop: 3 }}>{m.effect}</div>
              {/* The runes are named on EVERY row, not just the ones you fail — a keeper should be
                  able to read the rack as a map of where their identity could go next. */}
              <div style={{ font: '600 10px ui-monospace, monospace', color: readable ? '#8fd9c4' : '#c98a6a', marginTop: 4 }}>
                {readable ? '◆ ' : '◇ '}{m.runes.map(runeName).join(' + ')}
                {!readable && ' — you do not carry this'}
                {m.needs && ` · needs ${m.needs}`}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 7, alignItems: 'center' }}>
                <span style={{ flex: 1 }} />
                <span style={{ font: '700 11px ui-monospace, monospace', color: afford ? GOLD : '#8a7550' }}>✦ {price}</span>
                <button
                  onClick={() => attempt(m)}
                  disabled={owned}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none',
                    background: owned ? '#2a3a2a' : can ? '#6a5220' : '#302818',
                    color: owned ? '#8fd9c4' : can ? '#fff6e0' : '#ffffff55',
                    font: '800 12px ui-monospace, monospace', cursor: owned ? 'default' : 'pointer', touchAction: 'none',
                  }}
                >
                  {owned ? 'known' : 'buy'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {/* The trader's voice — the one place a refusal becomes visible. */}
      <div style={{ font: '600 11px ui-monospace, monospace', color: '#c9b58a', marginTop: 12, minHeight: 16 }}>
        “{say}”
      </div>
    </StationShell>
  )
}

export default PassageRack
