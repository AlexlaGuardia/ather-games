'use client'

/**
 * keeper-panel.tsx — the frame the keeper's screens live in.
 *
 * ── WHY A FRAME EXISTS AT ALL (Alex, 2026-08-12: "expand it to have tabs") ─────────────────────
 * The satchel used to be the only thing behind `I`, so it could be its own window. It is now one
 * of three: satchel · gear · grimoire (five until 2026-09-04 — see `KEEPER_TABS` for what folded
 * where). Screens that each drew their own window would be that many different-sized windows
 * sharing one keystroke.
 *
 * ── ★ THE FRAME IS A FIXED SIZE, AND THAT IS THE WHOLE POINT ──────────────────────────────────
 * `BagPanel` is shrink-to-fit: its width is the widest thing inside it. That is why every hint
 * sentence is kept in the DOM at once behind `invisible` rather than `hidden` (see the HINT
 * comment there) — so the widest one sets the width ONCE, at mount, and no swap can move a slot
 * out from under the cursor. That comment calls a resizing panel "the interface flinching away
 * from the click," and it is right.
 *
 * Tabs make that strictly worse. A grimoire page and an 8-column satchel are nowhere near the
 * same width, so a content-sized frame would resize *after* the cursor has already committed to
 * a target — the same flinch, on every tab switch, at a much larger amplitude. So:
 *
 *   THE FRAME IS SIZED HERE, ONCE. NO TAB'S CONTENT MAY SET IT.
 *
 * Every body scrolls INSIDE the frame instead of growing it. If you add a sixth tab and find
 * yourself reaching for `w-fit` or a wider `max-w` to make it fit, you are re-introducing the
 * bug — make the content fit the frame, or change the frame for everyone deliberately.
 *
 * The size is stated in one place (`FRAME`) rather than guessed per tab. It is not measured at
 * runtime on purpose: a measured frame is a frame that changes when content changes, which is
 * the thing being prevented.
 */

import type { ReactNode } from 'react'
import { HearthFrame, H as HT, hearthDisplay } from '../ui/hearth'

import { KEEPER_TABS, type KeeperTab } from './keeper-tabs'
export { KEEPER_TABS, type KeeperTab }

/**
 * ★ "Gear" and "Satchel" are plain UI words; "Grimoire" is canon — and that asymmetry is deliberate.
 *
 * `Grimoire` is a ruled canon instrument (`CANON/glossary.md`): a keeper-MADE device, the first
 * instrument for studying spirits, with two ruled faces (what a spirit *is*, and who *yours* are).
 * A tab named after it is naming a real object in the world, which is why it is spelled the way
 * canon spells it.
 *
 * The other two labels assert nothing about an in-world object, so they cannot become accidental
 * canon. The canon words live INSIDE Gear — glove, bracelet, gathering focus — where the objects
 * are. (The retired Runes tab was labelled the same way for the same reason; "runebook" appears
 * nowhere in CANON and a keeper's rune-instrument, should one be ruled, is Magii's call.)
 */

/** One place for the frame's dimensions. See the header: no tab may override these. */
const FRAME = {
  box: 'w-[min(94vw,720px)]',
  /** Bodies scroll inside this; they never grow it. Capped against short laptop screens too. */
  body: 'h-[min(58vh,400px)]',
  /**
   * ★ THE CHEST MODE IS TALLER, AND IT IS STILL SIZED HERE (2026-08-15, the 48-slot chest).
   *
   * This does not reopen the rule above — content still may not size the frame; there are simply
   * TWO frames now and both are stated in this object. The chest earns the second one: at six rows
   * it is 48 cells above the satchel's 24, and the whole reason those two grids share one panel is
   * that you drag between them. A grid whose bottom rows are below the fold turns every put-away
   * into a scroll-and-aim, which is exactly the friction the shift-click shortcut exists to remove.
   *
   * Still bounded and still scrolls past its cap — a phone gets the scroll rather than a panel
   * taller than the screen.
   */
  tallBody: 'h-[min(78vh,560px)]',
} as const

export function KeeperFrame({ tab, setTab, title, tall, hint, onClose, children }: {
  tab: KeeperTab
  setTab: (t: KeeperTab) => void
  /** Overrides the tab rail entirely — used by the chest, which is a mode, not a tab. */
  title?: string
  /** Take the taller of the two frame sizes. See `FRAME.tallBody` for who may ask and why. */
  tall?: boolean
  hint?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  // ── ★ THE CARVED HEARTH (rollout Phase 5, 2026-09-22). The shared keeper frame wears the hearth,
  // so the bag, the chest/bank/rack, gear and the grimoire change skin in this one edit — the same
  // reason it was the place the gx plate landed in August. What the frame PROMISES did not change:
  // fixed width, fixed-height body that scrolls (never grows), the hint pinned below the scroll so
  // it can never be scrolled away mid-drag, a visible way out. The plaque names the screen; the tab
  // rail stays on the parchment, one row, sideways-scrolling. Tabs still switch on pointerDown,
  // matching the slots: every press in this panel acts on the way down.
  const plaque = title ?? KEEPER_TABS.find(t => t.id === tab)?.label ?? 'Satchel'
  return (
    <HearthFrame title={plaque} maxWidth={720} onClose={onClose} backdropClass="z-30 bg-black/40"
                 bodyClass={`${tall ? FRAME.tallBody : FRAME.body} overflow-x-hidden px-4 ${title ? 'pt-6' : 'pt-3'} pb-3`}
                 head={title ? undefined : (
                   <nav className="flex items-end gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                     {KEEPER_TABS.map(t => {
                       const live = t.id === tab
                       return (
                         <button key={t.id} type="button" onPointerDown={() => setTab(t.id)} aria-current={live ? 'page' : undefined}
                                 className="shrink-0 px-3.5 pt-1.5 pb-2 rounded-t-[10px] text-[13px] font-bold transition-all min-h-[36px]"
                                 style={live
                                   ? { background: HT.paperHi, color: HT.ink, boxShadow: `0 -1px 3px rgba(58,39,22,.18), inset 0 -3px 0 ${HT.ember}` }
                                   : { background: HT.tabIdle, color: HT.inkSoft, transform: 'translateY(2px)' }}>
                           {t.label}
                         </button>
                       )
                     })}
                   </nav>
                 )}
                 footer={hint}>
      {children}
    </HearthFrame>
  )
}

/**
 * ★ ONE SPELLING OF A SECTION HEAD (2026-09-04, the chrome pass). Before this, the panel's bodies
 * headed their sections three ways — a bare `gx-label`, a hand-rolled `uppercase tracking-[0.16em]`
 * div, and the hairline-with-a-note the passive and the gathering focuses used — and the last one
 * was the only one that read as a game menu. Two spellings of one role is the ratchet defect
 * `hud-type.test.ts` exists for, one level down. So the head is a component: dim caps label, an
 * accent hairline that fades, and an optional note on the right (a count, a hint, never a sentence).
 * The note is dim prose; when it carries a NUMBER, wrap that number in `gx-value` at the call site
 * so the label/value contrast the layer asks for is there to read.
 */
export function SectionHead({ label, note }: { label: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="shrink-0 text-[14px] font-semibold" style={{ ...hearthDisplay, color: HT.ink }}>{label}</span>
      <span className="h-px min-w-4 flex-1" style={{ background: HT.rule }} />
      {note !== undefined && <span className="shrink-0 text-[12px] tabular-nums" style={{ color: HT.inkFaint }}>{note}</span>}
    </div>
  )
}

/**
 * What a tab shows when its system exists but the player has nothing in it yet, versus when the
 * system itself is not wired. These are different sentences on purpose — "you have none" is a
 * game state a player can act on; "not built yet" is ours, and dressing the second as the first
 * is how a missing feature hides as an empty one.
 */
export function TabEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-8 text-center text-[14px] italic leading-relaxed" style={{ ...hearthDisplay, color: HT.inkFaint }}>
      {children}
    </div>
  )
}
