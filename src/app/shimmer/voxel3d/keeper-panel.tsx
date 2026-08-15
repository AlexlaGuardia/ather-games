'use client'

/**
 * keeper-panel.tsx — the frame the keeper's screens live in.
 *
 * ── WHY A FRAME EXISTS AT ALL (Alex, 2026-08-12: "expand it to have tabs") ─────────────────────
 * The satchel used to be the only thing behind `I`, so it could be its own window. It is now one
 * of five: satchel · runes · grimoire · tools · loadout. Five screens that each drew their own
 * window would be five different-sized windows sharing one keystroke.
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

export type KeeperTab = 'satchel' | 'runes' | 'grimoire' | 'tools' | 'loadout'

/**
 * Tab order is the keeper's own chain, not alphabetical and not arbitrary:
 * what you CARRY → what you ARE → what you KNOW → what you WORK with → what you BRING.
 * `rune-inventory.ts` states the mechanical half of that chain (owned runes → known moves →
 * a loadout slot → a cast archetype), so runes sit left of loadout for the same reason.
 */
export const KEEPER_TABS: { id: KeeperTab; label: string }[] = [
  { id: 'satchel', label: 'Satchel' },
  { id: 'runes', label: 'Runes' },
  { id: 'grimoire', label: 'Grimoire' },
  { id: 'tools', label: 'Tools' },
  { id: 'loadout', label: 'Loadout' },
]

/**
 * ★ "Runes", not "Runebook" — and that is a canon decision, not a style one.
 *
 * `Grimoire` is a ruled canon instrument (`CANON/glossary.md`): a keeper-MADE device, the first
 * instrument for studying spirits, with two ruled faces (what a spirit *is*, and who *yours* are).
 * A tab named after it is naming a real object in the world, which is why it is spelled the way
 * canon spells it.
 *
 * There is no canon counterpart for runes — "runebook" appears nowhere in CANON, and runes do not
 * behave like something a keeper catalogues in a device: one is innate at birth and the others are
 * *trained through practice* (`glossary.md` § Rune System). So this tab is labelled with the plain
 * UI word for its contents, which asserts nothing about an in-world instrument and therefore cannot
 * become accidental canon. If a keeper's rune-instrument should exist, that is Magii's ruling and
 * this label changes after it lands — not before.
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
  return (
    // ★ The backdrop eats the context menu too. Right-click is a game verb inside this panel, and a
    // menu opened by a near-miss on a slot covers the grid and swallows the click that follows.
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55"
         onClick={onClose} onContextMenu={e => e.preventDefault()}>
      <div className={`${FRAME.box} rounded-lg border border-white/15 bg-neutral-950/95 p-5 shadow-2xl`}
           onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-4">
          {title ? (
            <h2 className="font-medium uppercase tracking-[0.18em] text-amber-200/90 text-sm">{title}</h2>
          ) : (
            // The rail scrolls sideways rather than wrapping: a wrapped rail changes the frame's
            // HEIGHT on a narrow screen, which is the same flinch one axis over. Phone is a primary
            // device here, so this path is the common one, not the edge case.
            <nav className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none]
                            [&::-webkit-scrollbar]:hidden">
              {KEEPER_TABS.map(t => {
                const live = t.id === tab
                return (
                  <button key={t.id} type="button" onPointerDown={() => setTab(t.id)}
                          aria-current={live ? 'page' : undefined}
                          className={`shrink-0 rounded px-2.5 py-1 text-[11px] uppercase tracking-[0.16em]
                                      transition-colors ${live
                            ? 'bg-amber-300/15 text-amber-200/90'
                            : 'text-white/35 hover:text-white/70'}`}>
                    {t.label}
                  </button>
                )
              })}
            </nav>
          )}
          {/* ★ A VISIBLE WAY OUT. I and Escape both close this and neither is discoverable from
              inside it — a player who does not already know the key is stuck looking at their bag
              with the mouse free and no button to press, which reads as the game having hung.
              `pointerDown` rather than click, matching the slots: every other press in this panel
              acts on the way down, and a close that waited for the release would feel heavier than
              the thing it closes. */}
          <button type="button" onPointerDown={onClose} title="close (I or Esc)"
                  className="ml-auto -mt-1 -mr-1 h-6 w-6 shrink-0 rounded border border-white/15
                             text-white/40 leading-none transition-colors
                             hover:border-white/40 hover:text-white/80">×</button>
        </div>
        <div className={`${tall ? FRAME.tallBody : FRAME.body} overflow-y-auto overflow-x-hidden`}>{children}</div>
        {/* The hint sits BELOW the body, outside the scroll, so it is always readable and can never
            be scrolled away mid-drag. */}
        {hint && <div className="mt-3 border-t border-white/10 pt-2.5">{hint}</div>}
      </div>
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
    <div className="flex h-full items-center justify-center px-8 text-center text-[11px] leading-relaxed text-white/30">
      {children}
    </div>
  )
}
