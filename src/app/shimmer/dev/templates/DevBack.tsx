'use client'

/**
 * THE WAY BACK. Every dev page and editor leads to the index.
 *
 * ★★★ WHY THIS EXISTS (2026-09-02, hub lane). Alex, after the index shipped: *"lets make sure its
 * easily navigable.. so each page and editor leads back to the main dev page."* He was describing a
 * hole that measured **zero**: of the twenty-two registered dev pages, not one linked back to
 * `/shimmer/dev`. The index made them reachable in one direction only — you could get in, and then
 * the browser Back button was the entire navigation model.
 *
 * The thirty editors were already fine: they live inside the hub, whose header carries a
 * "Shimmer Dev" button. This is for the pages that own their own route.
 *
 * ── ⚠ IT GATES A LINK, NOT A ROUTE ───────────────────────────────────────────────────────────
 * Four registered pages are NOT owner-gated — `/vault/dev`, `/shimmer/arena`, `/shimmer/voxel3d/tex`
 * answer 200 to anybody (see `proxy.ts`). Hard-coding a visible "Shimmer Dev" link onto a page a
 * player can open advertises the dev surface to players. So this probes `/api/owner` and renders
 * nothing for a non-owner, matching the convention `VoxelWorld.tsx:1304` already states outright:
 * **a hidden link is not a permission.** The index itself stays 403 at the proxy either way; this
 * only decides whether a player is shown a door they cannot open.
 *
 * ── WHY TOP-RIGHT, AND WHY FIXED ─────────────────────────────────────────────────────────────
 * Every looking-glass on this surface puts its control panel at `absolute m-3` top-LEFT, and most
 * of them are a full-bleed canvas with no document flow to sit in. Fixed top-right is the one
 * corner that is free on all twenty-two, and `z-50` clears the panels (`z-10`) without covering
 * any of them.
 *
 * ── ★ MOUNTED BY LAYOUT, NOT BY TWENTY-TWO EDITS ─────────────────────────────────────────────
 * `shimmer/dev/layout.tsx` wraps every page under that route, so a dev page written next week gets
 * the way back by EXISTING — the same reasoning `dev-pages.test.ts` gives for making registration
 * discovered rather than remembered. The six registered pages outside that tree carry a one-line
 * layout of their own. `dev-back.test.ts` asserts the coverage from `DEV_PAGES`, so a new page in a
 * new tree is red until it is covered.
 */
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const INDEX = '/shimmer/dev'

export default function DevBack({ label = 'Shimmer Dev' }: { label?: string }) {
  const [isOwner, setIsOwner] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    let alive = true
    fetch('/api/owner', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { owner: false }))
      .then(d => { if (alive && d.owner) setIsOwner(true) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Self-suppressing, so a layout can render it blindly over every child including the index.
  // A back-link on the page it points at is clutter, and the hub header already owns that button.
  if (pathname === INDEX) return null
  if (!isOwner) return null

  return (
    <a
      href="/shimmer/dev"
      title="Back to the dev index — every editor and page"
      className="fixed top-3 right-3 z-50 rounded border border-white/15 bg-black/70 px-2.5 py-1
                 font-mono text-[11px] text-white/50 backdrop-blur-sm transition-colors
                 hover:border-white/30 hover:text-white/90"
    >
      ← {label}
    </a>
  )
}
