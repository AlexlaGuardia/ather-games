'use client'

/**
 * The Passage's panel — four shelves under Rune Hold, on one plate.
 *
 * ★ WHY A PANEL AND NOT A ROOM, TODAY. The Passage is a tile zone in `/shimmer/play3d` (`world/zones.ts`
 * › `the-passage`), and the voxel world's crossing OUT to Rune Hold is being painted by the hub lane as
 * this is written. Until a keeper can walk there, the shelves open through an owner-gated console door
 * (`/market`) so the economy can be TRIED — the same reason `/brew` exists beside the cauldron block.
 * ★ AND THE REAL HOST ALREADY EXISTS: the tile Passage's trader (`npcs3d.ts` › `passage-trader`) has
 * opened the scroll rack from `Shimmer3D.tsx` since August; it opens THIS panel now, and the rack-only
 * `PassageRack.tsx` is retired into the rack section below (its canon note travels with it).
 *
 * The shelves (`passage.ts` says what is canon and what is Jin's):
 *   RACK     · Knowledge Scrolls, daily, for Marks         (`scroll-market.ts` — dormant until now)
 *   TEACHER  · one combination, Coomday, free if readable
 *   MERCHANT · six rune-gems, E'xday, 30 on your lanes / 60 off
 *   COUNTER  · the prospecting ladder bought for Marks, E'xday — the one place this world EARNS Marks
 *
 * Reads the letters, the book and the wallet on every render; every trade persists and calls
 * `onChange` so the host refreshes the hotbar and the letters card. `dayOverride` is the owner's dev
 * dial (`/market <day>`) — the real clock is `weekdayAt(now)`.
 */
import { useState } from 'react'
import { countItem, type Inventory } from '../engine/inventory'
import { getMarks, addMarks, spendMarks } from '@/lib/wallet'
import { RUNES } from './birth/runes.data'
import { gold } from './tokens'
import { keeperBook, keeperLetters, saveBook } from './book'
import { saveLetters, VESSELS, type Vessel } from './gems'
import { buyVessel, ownedCount, loadStowed, VESSEL_PRICE, MAX_PER_KIND, BAND_FOR_VESSEL, TIER_MATERIAL } from './vessels'
import { eligibleMoves, ALL_BANDS } from './cast'
import { lettersOf } from './gems'
import { rawLoadout } from './loadout'
import { rackFor, buy, priceOf, canRead, msUntilRotation, cycleAt as rackCycleAt } from './scroll-market'
// ⚠ TWO RACKS IN ONE SHOP: `rackFor` above is the SCROLL rack (the word); this is the VESSEL rack
// (the paper). The prefix is what keeps them apart — see the note over the section in `passage.ts`.
import { LANE_FOR_KIND, laneRunes } from './cast'
import { moveById } from './keeper-moves'
import {
  WEEK, MARKET_DAY, TEACHING_DAY, SELL_PRICES, cycleAt, weekdayOf, daysUntil, gemTrayFor, gemPrice,
  buyGem, sell, teacherFor, takeLesson, type Weekday,
  vesselRackFor, buyFromVesselRack, type RackVessel,
} from './passage'

export function PassagePanel({ items, owned, birth, nowMs, dayOverride, onChange, onClose }: {
  items: React.RefObject<Inventory | null>
  owned: readonly string[]
  birth: string | null
  nowMs: number
  /** owner's dev dial — preview a weekday. Null = the real clock. */
  dayOverride: Weekday | null
  onChange: () => void
  onClose: () => void
}) {
  const [note, setNote] = useState<string | null>(null)
  const [, bump] = useState(0)
  const cycle = cycleAt(nowMs)
  const day: Weekday = dayOverride ?? weekdayOf(cycle)
  const marks = getMarks()
  const bag = items.current
  const letters = keeperLetters(owned, birth)
  const book = keeperBook(owned)
  const runeName = (id: string) => RUNES.find(r => r.id === id)?.name ?? id
  // The fallback is a TOKEN, not a literal — this file is CONVERTED in `tokens.test.ts`, born clean rather
  // than added to PENDING (the cheap lie that keeps a red light off a new file).
  const glow = (id: string) => RUNES.find(r => r.id === id)?.glow ?? gold.parchment
  const rerender = () => { bump(n => n + 1); onChange() }

  const rack = rackFor(1, rackCycleAt(nowMs))
  const rackMins = Math.max(1, Math.round(msUntilRotation(nowMs) / 60000))
  const tray = gemTrayFor(cycle)
  const teacher = teacherFor(cycle)
  const inDays = (d: Weekday) => { const n = daysUntil(cycle, d); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days` }

  const onBuyScroll = (id: string) => {
    const m = rack.find(x => x.id === id); if (!m) return
    const r = buy(book, marks, owned, m, rack)
    setNote(r.say)
    if (!r.ok) return
    if (!spendMarks(marks - r.marks)) { setNote('The Marks would not leave your hand.'); return }
    saveBook(r.book); rerender()
  }
  const onLesson = () => {
    const r = takeLesson(book, owned, teacher, day)
    setNote(r.say); if (!r.ok) return
    saveBook(r.book); rerender()
  }
  const onBuyGem = (rune: string) => {
    const r = buyGem(letters, marks, rune, tray, birth, day)
    setNote(r.say); if (!r.ok) return
    if (!spendMarks(marks - r.marks)) { setNote('The Marks would not leave your hand.'); return }
    saveLetters(r.letters); rerender()
  }
  const onBuyVessel = (kind: Vessel, word: string) => {
    const r = buyVessel(kind, marks, word)
    setNote(r.say); if (!r.ok) return
    if (!spendMarks(marks - r.marks)) { setNote('The Marks would not leave your hand.'); return }
    rerender()
  }
  /** Buy off the second-hand rack. Same shape as the cutter's handler — the shelf differs, not the till. */
  const onBuyFromRack = (slot: number, rack: readonly RackVessel[]) => {
    const r = buyFromVesselRack(marks, slot, rack)
    setNote(r.say); if (!r.ok) return
    if (!spendMarks(marks - r.marks)) { setNote('The Marks would not leave your hand.'); return }
    rerender()
  }
  const onSell = (itemId: string, n: number) => {
    if (!bag) return
    const r = sell(bag, itemId, n, day)
    setNote(r.say); if (!r.ok) return
    addMarks(r.marks); rerender()
  }

  const Shelf = ({ title, when, children }: { title: string; when: string; children: React.ReactNode }) => (
    <div className="mb-3 rounded border border-white/10 bg-white/[0.03] px-2.5 py-2">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[12px] text-white/80">{title}</span>
        <span className="gx-label text-[9px] text-white/30">{when}</span>
      </div>
      {children}
    </div>
  )
  const Row = ({ left, mid, price, action, disabled, label }: { left: React.ReactNode; mid?: React.ReactNode; price?: number; action: () => void; disabled?: boolean; label: string }) => (
    <div className="flex items-center gap-2 py-0.5">
      <span className="min-w-[110px] text-[11px]">{left}</span>
      {mid && <span className="text-[10px] text-white/40">{mid}</span>}
      {price !== undefined && <span className="gx-value ml-auto text-[10px] text-white/50">{price} M</span>}
      <button type="button" disabled={disabled} onPointerDown={action}
              className={`gx-btn rounded border px-2 py-0.5 text-[10px] ${price === undefined ? 'ml-auto' : ''} ${disabled ? 'gx-inactive border-white/10 text-white/40' : 'border-amber-200/40 text-amber-200/90 hover:bg-white/[0.06]'}`}>
        {label}
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onPointerDown={onClose}>
      <div onPointerDown={e => e.stopPropagation()}
           className="gx-card gx-scan gx-chrome w-[520px] max-h-[82vh] overflow-y-auto p-4 font-mono text-[11px]">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="gx-label text-[13px] font-semibold text-white/95">The Passage</span>
          <span className="gx-label text-[10px] text-white/40">{day}{dayOverride ? ' · dev preview' : ''}</span>
          <span className="gx-value ml-auto text-[11px] text-amber-200/80">{marks} Marks</span>
          <button onClick={onClose} className="gx-btn px-2 py-0.5 text-[10px]">esc</button>
        </div>
        <div className="mb-3 text-[10px] leading-snug text-white/35">
          Rotating spots. One leaves, another takes their place. Merchants ride on {MARKET_DAY} ({inDays(MARKET_DAY)}); the masters hold on {TEACHING_DAY} ({inDays(TEACHING_DAY)}). The week: {WEEK.join(' · ')}.
        </div>

        <Shelf title="The scroll racks" when={`every day · the word, bought · the traders change over in ${rackMins}m`}>
          {/* ★ THE UNREADABLE ROW IS THE FEATURE (ported from the retired PassageRack.tsx): canon rules
              "the same rack means something different to every keeper who walks past it". An unreadable
              scroll is DRAWN, dimmed, with the runes it is written in named — the rack as a map of where
              your identity could go next. Hiding it would make every keeper's Passage identical. */}
          <div className="mb-1.5 text-[10px] italic text-white/35">A scroll teaches a technique, never a rune. What you can read is what you already are.</div>
          {rack.map(m => {
            const readable = canRead(m, owned), known = book.learned.includes(m.id)
            return (
              <div key={m.id} style={{ opacity: readable ? 1 : 0.45 }}>
                <Row left={<span style={{ color: glow(m.runes[0] ?? '') }}>{m.name}</span>}
                     mid={`${m.tier} · ${readable ? '◆' : '◇'} ${m.runes.map(runeName).join(' + ') || 'no rune'}${readable ? '' : ' — you do not carry this'}${m.needs ? ` · needs ${m.needs}` : ''}`}
                     price={priceOf(m)} action={() => onBuyScroll(m.id)}
                     disabled={known} label={known ? 'known' : 'buy'} />
                <div className="pb-1 text-[10px] leading-snug text-white/35">{m.effect}</div>
              </div>
            )
          })}
        </Shelf>

        <Shelf title="The teacher's bench" when={`${TEACHING_DAY} · the word, given`}>
          <Row left={<span style={{ color: glow(teacher.runes[0] ?? '') }}>{teacher.name}</span>}
               mid={`${teacher.tier} · ${teacher.runes.map(runeName).join(' + ') || 'no rune'} · free if you can read it`}
               action={onLesson} disabled={day !== TEACHING_DAY || book.learned.includes(teacher.id)}
               label={day !== TEACHING_DAY ? `holds ${inDays(TEACHING_DAY)}` : book.learned.includes(teacher.id) ? 'known' : 'sit'} />
        </Shelf>

        <Shelf title="The merchants' tray" when={`${MARKET_DAY} · the letters, bought`}>
          {tray.map(rune => (
            <Row key={rune} left={<span style={{ color: glow(rune) }}>{runeName(rune)} gem</span>}
                 mid={owned.includes(rune) ? 'a rune you hold' : gemPrice(rune, birth) === 60 ? 'specialized — off your lanes' : 'on your lane'}
                 price={gemPrice(rune, birth)} action={() => onBuyGem(rune)}
                 disabled={day !== MARKET_DAY} label={day !== MARKET_DAY ? `rides ${inDays(MARKET_DAY)}` : 'buy'} />
          ))}
        </Shelf>

        <Shelf title="The counter" when={`${MARKET_DAY} · runestones, sold`}>
          {Object.entries(SELL_PRICES).map(([id, each]) => {
            const have = bag ? countItem(bag, id) : 0
            return (
              <Row key={id} left={<span className="text-white/70">{id.replace(/_/g, ' ')}</span>} mid={`you carry ${have}`}
                   price={each} action={() => onSell(id, 1)} disabled={day !== MARKET_DAY || have === 0}
                   label={day !== MARKET_DAY ? `buys ${inDays(MARKET_DAY)}` : 'sell one'} />
            )
          })}
        </Shelf>

        <Shelf title="The vessel shelf" when="every day · the paper, cut to order">
          {/* ★ MADE FOR ONE WORD (Alex, 2026-09-04): *"each vessel is unique that its made the word and none
              other."* So the shelf does not sell "a bracelet"; it cuts one for a word you already hold, with
              exactly that word's seats. Words that already have a vessel (worn or in the satchel) are not
              offered twice. Sold one at a time, never as a pair (Alex, 2026-09-03).
              ★ THE SHELF'S STOCK IS TIER 1 — goldwood. Vessels are not crafted (ruled 2026-09-04): the Passage
              is the BOUGHT door; tiers 2–3 are found and won in the world, never on a shelf. The cap counts
              what a keeper acquires; Greg's pair sits under it. */}
          {VESSELS.map(kind => {
            const have = ownedCount(kind)
            const full = have >= MAX_PER_KIND
            const band = BAND_FOR_VESSEL[kind]
            const taken = new Set([...loadStowed().filter(v => v.kind === kind).map(v => v.move), rawLoadout()[band] ?? null])
            const words = eligibleMoves([...owned], birth, ALL_BANDS[band]!, book)
              .filter(m => lettersOf(m, birth).length > 0 && !taken.has(m.id))
            if (!words.length) {
              return <Row key={kind} left={<span className="text-white/70">a {kind}</span>}
                          mid={full ? `you carry ${have} of ${MAX_PER_KIND}` : 'every word you hold already has one'}
                          action={() => {}} disabled label="nothing to cut" />
            }
            return words.map(m => {
              const seats = lettersOf(m, birth).length
              return (
                <Row key={`${kind}-${m.id}`} left={<span className="text-white/70">a {TIER_MATERIAL[kind][1]} {kind} for <span className="text-amber-200/90">{m.name}</span></span>}
                     mid={`${seats} seat${seats === 1 ? '' : 's'} · you carry ${have} of ${MAX_PER_KIND}`}
                     price={VESSEL_PRICE} action={() => onBuyVessel(kind, m.id)} disabled={full}
                     label={full ? 'all you can carry' : 'cut it'} />
              )
            })
          })}
        </Shelf>

        <Shelf title="The second-hand rack" when="every day · someone else's word">
          {/* ── ★★★ THE RACK IS A WALL OF OTHER PEOPLE'S PURPOSES (canon 2026-09-05) ──────────────
              *"Every vessel on it was cut for a word somebody meant to write."* The stock is rolled
              with NO reference to this keeper, so most rows are useless to them — that is the
              feature, and finding the one that fits is the hunt canon names. The cutter above
              serves the keeper who already knows what they want, at a higher price; this shelf is
              the other half of that trade.

              ⛔ A SLEEPER IS NEVER LABELLED. Canon calls it *"a fine vessel ... far above what the
              shelf is priced for"* — the shelf does not know it has one, so a badge saying SLEEPER
              would be the shopkeeper doing the player a favour, which is the exact sentence canon
              spends its paragraph refusing. What the row shows is the MATERIAL and the PRICE, and
              a keeper who has learned that pearlshell outranks goldwood reads the find themselves.
              That is what the word "hunt" has to mean or it means nothing.

              ★ BUT THE FIT IS STATED PLAINLY, because that is information, not a favour. A vessel
              cut for a word off your lanes can never be bound — a brick with a story — and letting
              a keeper spend Marks on one without saying so is a trap, not a hunt. It is still
              BUYABLE: a shop that refuses your Marks on your behalf is a curated aisle. */}
          {(() => {
            const rack = vesselRackFor(cycle)
            return rack.map((v, i) => {
              const m = v.word ? moveById(v.word) : null
              const mat = TIER_MATERIAL[v.kind][v.tier]
              const full = ownedCount(v.kind) >= MAX_PER_KIND
              // Can this keeper ever bind that word? The same test the found-vessel road uses: every
              // rune of the move has to sit on one of their lanes, or the paper is a brick.
              const lane = m ? LANE_FOR_KIND[ALL_BANDS[BAND_FOR_VESSEL[v.kind]]!] : null
              const onLane = m && lane ? m.runes.every(r => laneRunes(birth, lane).has(r)) : true
              const seats = m ? lettersOf(m, birth).length : 0
              return (
                <Row key={`rack-${i}`}
                     left={<span className="text-white/70">
                       a {mat} {v.kind}{' '}
                       {m ? <>for <span className={onLane ? 'text-amber-200/90' : 'text-white/35'}>{m.name}</span></>
                          : <span className="text-white/45">uncut</span>}
                     </span>}
                     mid={m
                       ? (onLane ? `${seats} seat${seats === 1 ? '' : 's'} · someone else's` : 'not your lanes — you could never bind it')
                       : 'blank paper · write on it when you have the word'}
                     price={v.price} action={() => onBuyFromRack(i, rack)} disabled={full}
                     label={full ? 'all you can carry' : 'take it'} />
              )
            })
          })()}
        </Shelf>

        {note && <div className="mt-2 rounded border border-amber-200/20 bg-amber-200/[0.06] px-2.5 py-1.5 text-[10px] text-amber-100/80">{note}</div>}
        <div className="mt-2 text-[10px] text-white/25">Ultimates are never on the shelves.</div>
      </div>
    </div>
  )
}
