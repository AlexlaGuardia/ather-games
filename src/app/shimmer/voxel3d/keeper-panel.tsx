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

export type KeeperTab = 'satchel' | 'gear' | 'grimoire'

/**
 * Tab order is the keeper's own chain: what you CARRY → what you WEAR → what you KNOW.
 *
 * ★ THREE TABS, NOT FIVE (Alex, 2026-09-03 eve, the pinned inventory-menu conversation).
 *   · RUNES is gone — *"not convinced we need that runes tab."* Its move list was the same data the
 *     bind picker on Gear draws from, and the runes you hold are one chip row. The letters that
 *     briefly lived on it are carried things, so they moved to the Satchel with the bag.
 *   · TOOLS folded INTO Gear — canon's word for a Blade, Spike or Rinstick is *gathering focus*
 *     (`CANON/glossary.md` § Focus: *"two shapes, one class"*), the same class as the casting glove
 *     the Gear tab already equips. Two tabs for one class of object was the build asserting a
 *     distinction canon does not draw.
 *   · LOADOUT is renamed GEAR — Alex's word in both windows (*"from the gear tab they can add them
 *     in"*, *"the seats should show up in gear"*). The vessels are gear you own singly since
 *     `57a2ef9`; the label follows the model.
 *
 * ⚠ THE OLD `runes` / `tools` / `loadout` IDS ARE GONE FROM THE TYPE ON PURPOSE. A stale
 * `setTab('loadout')` anywhere is a compile error, not a tab that silently never opens.
 */
export const KEEPER_TABS: { id: KeeperTab; label: string }[] = [
  { id: 'satchel', label: 'Satchel' },
  { id: 'gear', label: 'Gear' },
  { id: 'grimoire', label: 'Grimoire' },
]

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
  return (
    // ★ The backdrop eats the context menu too. Right-click is a game verb inside this panel, and a
    // menu opened by a near-miss on a slot covers the grid and swallows the click that follows.
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55"
         onClick={onClose} onContextMenu={e => e.preventDefault()}>
      {/* ── ★ THE HOUSE PLATE (2026-08-26). This is the SHARED keeper frame, so every panel built on
         it inherits the frame in one edit — bag, grimoire, and the rest. `rounded-lg` goes because
         GAME_UI_LAYER.md names a 12px radius as the web-card tell; `gx-card` supplies the framed
         background, the accent border and the inset shadows, and `gx-chrome` kills the browser
         tells inside game chrome. `shadow-2xl` goes with it: the layer's inset shadow is the
         weight, and a web drop-shadow on top reads as a modal, not a plate. */}
      <div className={`${FRAME.box} gx-card gx-scan gx-chrome p-5`}
           onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-4">
          {title ? (
            // `gx-label`, not `uppercase tracking-[0.18em]`. This file spelled ONE role two ways —
            // .18em here and .16em on the tabs below — which is the pathology `hud-type.test.ts`
            // found in the fold HUD (one role, nine tracking values) appearing here in miniature.
            // ⚠ `//` and NOT `{/* */}`: this is a ternary BRANCH, a parenthesised expression, not
            // JSX children — a brace comment here is a syntax error. The sibling branch below was
            // already written this way and I should have read it before reaching for braces.
            // And a bare `/* */` is worse than either: in CHILDREN position JSX renders it as
            // visible TEXT. That shipped for one screenshot — tsc passed (valid JSX text) and
            // brew-check passed twice (the panel still worked), and a paragraph of this comment was
            // painted across the game. Only looking at the picture caught it.
            <h2 className="gx-label font-medium text-amber-200/90 text-sm">{title}</h2>
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
                          /* ★ BRUTAL STATE CONTRAST, asked for by name. `gx-btn` is the layer's
                             HUD switch (squared face, caps, tracking, accent border, physical
                             press); `gx-active`/`gx-inactive` carry the on/off.
                             ⚠ THE "NEVER DIM THE PLATE" LESSON DOES NOT APPLY HERE, and the
                             difference is worth stating rather than assuming. That rule was learned
                             on the tool sockets, which float over the LIT WORLD: dimming their
                             backing left four faint rings on grass. These tabs sit on `gx-card`'s
                             dark plate — a background we control — so dimming the whole control is
                             safe and is what the layer intends. Chrome over the scene, and chrome
                             inside a panel, are different problems. */
                          className={`gx-btn shrink-0 px-2.5 py-1 text-[11px] ${live ? 'gx-active' : 'gx-inactive'}`}>
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
                  className="gx-btn ml-auto -mt-1 -mr-1 h-6 w-6 shrink-0 leading-none">×</button>
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
    <div className="mb-1.5 flex items-center gap-2">
      <span className="gx-label shrink-0 text-[9px] text-amber-200/45">{label}</span>
      <span className="h-px min-w-4 flex-1 bg-gradient-to-r from-amber-200/25 to-transparent" />
      {note !== undefined && <span className="shrink-0 text-[9px] text-white/30">{note}</span>}
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
