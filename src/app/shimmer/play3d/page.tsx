'use client'
// Shimmer 3D — boot gate. Before the game mounts, fetch the LIVE on-disk world data
// (/shimmer/world-data parses tilemap.ts / heightmaps.json / node-placements.ts at request
// time) and overlay it on the compiled sources. This is what makes edit → Save → refresh
// live with no rebuild. Fetch failure falls back to compiled data — the game always mounts.
//
// ── ★ THE GATE ALSO OWNS BIRTH (2026-08-07) ──────────────────────────────────────────────────
// It used to own only the reset, and Shimmer3D decided birth for itself at mount. That decision
// raced its own cloud pull: the mount effect opened the ritual off the `birthPending` latch, then
// `loadWithCloudFallback` resolved a few hundred ms later and called `setBirthOpen(false)` +
// cleared the latch — leaving a save, no rune and no latch, which is exactly the "legacy returning
// keeper" shape that never re-opens birth. The keeper landed in the world unborn, and because it
// hung on a fetch it flapped between otherwise identical runs.
//
// The fix is not to reorder that race but to delete it. Two questions were tangled in one branch:
//   • does this character's SAVE survive?  — answered by the epoch, inside `pullCloudSave`
//   • is this keeper owed a BIRTH?         — answered by the rune keys, and by nothing else
// A cloud save is not evidence of a birth rune (the rune is a localStorage key, it never rode in
// the save blob), so the pull must not be allowed to answer the second question. Hydration now
// happens HERE, before the decision, and the decision is made once against settled storage. Same
// shape as voxel3d/page.tsx: born first, world second.
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { applyLiveWorldData, registerGardenWorld } from '../world/garden-world'
import { applyLiveRegionData } from '../world/region-maps'
import { invalidateWorldCaches } from './world-adapter'
import { resetIfStale } from '@/lib/ather-epoch'
import { pullCloudSave } from '@/lib/cloud-sync'
import BirthScreen from './birth/BirthScreen'
import { loadRuneInventory, saveRuneInventory, setBirthRune, EMPTY_INVENTORY } from './rune-inventory'

// R3F Canvas is client/WebGL-only — never SSR it. The import is also deferred until `ready`
// so Shimmer3D's module init (world registration, NPC remaps) sees the live data.
const Shimmer3D = dynamic(() => import('./Shimmer3D'), { ssr: false })

const SAVE_KEY = 'ather:save:shimmer'
/**
 * Vestigial: `birthOwed()` reads the rune directly now, so nothing consults this any more. Still
 * cleared on choose so an old latch left in a browser by a previous build doesn't sit there
 * forever looking meaningful to whoever greps for it next.
 */
const PENDING_KEY = 'ather:shimmer:birthPending'
/** One-shot handoff so the game can greet a keeper it did not watch being born. Read+cleared once. */
const JUST_BORN_KEY = 'ather:shimmer:justBorn'

/**
 * Pull this account's garden into a BLANK device. Local always wins when present — the cloud copy
 * is only ever read into emptiness, so a stale server save can never clobber live play. Refusal on
 * the epoch happens inside `pullCloudSave`; a save from a previous world resolves null here.
 *
 * Moved up from Shimmer3D so that by the time the game mounts, localStorage is the whole truth and
 * nothing it does later can revise who the player is.
 */
async function hydrateFromCloud(): Promise<void> {
  try {
    if (localStorage.getItem(SAVE_KEY)) return   // local wins, never overwrite live play
  } catch { return }                             // private mode — nothing to hydrate into
  const cloud = await pullCloudSave('shimmer')
  if (!cloud) return
  try {
    JSON.parse(cloud)                            // don't persist a blob the game can't read
    localStorage.setItem(SAVE_KEY, cloud)
  } catch { /* unparseable / quota — start fresh rather than half-load */ }
}

/**
 * Is this keeper still owed the ritual? Read AFTER reset + hydration, never before.
 *
 * ── ★ THE RUNE IS THE WHOLE ANSWER, AND THE EPOCH IS WHY (2026-08-07) ──────────────────────
 * This used to be `!hasRune && (!hasSave || pending)` — save-absence as the proxy for "new keeper",
 * with a `birthPending` latch patching the case the proxy got wrong (the starter kit persists a
 * save on first mount, so someone who backed out of the ritual already had one). Both the proxy and
 * its patch are gone, because within an epoch a save and a rune CANNOT legitimately disagree:
 * `ather-epoch.ts` clears `ather:save:shimmer` and `ather:shimmer:birthRune` together, so any save
 * present was written after the reset, and a keeper holding one with no rune was never born in this
 * world. The old third arm read that as a legacy returning keeper and waved them through.
 *
 * Measured on Alex's browser before this landed: an epoch-2 save with a level-8 party, no rune and
 * no latch — the exact shape, playing with a null birth rune (NEUTRAL affinity, empty cast book).
 * The race fixed above stops new keepers reaching that state; dropping this arm is what lets an
 * already-broken browser heal on its next load.
 *
 * The cross-device case comes out right too: a blank phone hydrates the garden from the cloud but
 * the rune never rode in the save blob, so it asks for one and keeps the garden. Being asked beats
 * spawning runeless, which is what the old rule did there.
 */
function birthOwed(): boolean {
  try {
    return !loadRuneInventory().birth
  } catch {
    return false   // private mode — just spawn rather than trap them in a ritual that can't persist
  }
}

type Phase = 'loading' | 'birth' | 'world'

export default function Play3DPage() {
  // Starts at 'loading', never at 'birth': localStorage is unreadable during SSR and the first
  // paint, so guessing would flash the ritual at an already-born keeper on every load.
  const [phase, setPhase] = useState<Phase>('loading')
  useEffect(() => {
    // ★ THE WORLD RESET HAS TO LAND HERE, NOT INSIDE THE GAME. Shimmer3D reads the save while it
    // renders, so a reset that runs in one of its own effects clears localStorage AFTER the old
    // character is already in memory — and the next autosave writes it straight back, then pushes
    // it to the cloud. Measured on 2026-08-07: a save marked PRE-RESET survived the wipe and
    // reappeared in `accounts.db` fifteen seconds later. Shimmer3D does not mount until the world
    // phase, so clearing here happens strictly before its first read.
    resetIfStale()
    const report = (m: string) => { try { navigator.sendBeacon('/shimmer/client-log', m) } catch { /* noop */ } }
    const onErr = (e: ErrorEvent) => report(`${e.message}\n${e.error?.stack ?? ''}`)
    const onRej = (e: PromiseRejectionEvent) => report(`unhandledrejection: ${e.reason?.message ?? e.reason}\n${e.reason?.stack ?? ''}`)
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    let alive = true
    Promise.all([
      fetch('/shimmer/world-data', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (!d.error) { applyLiveWorldData(d); invalidateWorldCaches() } })
        .catch(() => { /* compiled fallback */ }),
      // The region half: sculpt-fresh grids/nodes/burrows for the r-* maps, same contract —
      // save → refresh live with no rebuild. Failure falls back to compiled region data.
      fetch('/shimmer/region-data', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (!d.error) applyLiveRegionData(d.regions) })
        .catch(() => { /* compiled fallback */ }),
      // Third leg, and the ordering that matters: birth is decided only once this has settled.
      hydrateFromCloud(),
    ]).finally(() => {
      if (!alive) return
      registerGardenWorld()
      setPhase(birthOwed() ? 'birth' : 'world')
    })
    return () => { alive = false; window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej) }
  }, [])

  if (phase === 'loading') return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#0e0c1c', color: '#e9dfc8', font: '700 15px ui-monospace, monospace' }}>
      ✦ composing the garden…
    </div>
  )

  if (phase === 'birth') return (
    // No `onCancel`: first-entry birth is not escapable, and here there is nothing to escape TO —
    // the game is not mounted behind it. (Shimmer3D keeps its own escapable BirthScreen for the
    // in-game New Game flow, which genuinely does sit over a running world.)
    <BirthScreen
      onChoose={(id) => {
        // Birth is rune #1 of the inventory, not the whole character — the moves come from the book.
        saveRuneInventory(setBirthRune(EMPTY_INVENTORY, id))
        try {
          localStorage.removeItem(PENDING_KEY)   // birth is done; stop re-prompting
          localStorage.setItem(JUST_BORN_KEY, id)
        } catch { /* private mode */ }
        setPhase('world')
      }}
    />
  )

  return <Shimmer3D />
}
