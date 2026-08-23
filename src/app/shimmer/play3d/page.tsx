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
import { setSaveOwner, saveKey, slotFor, stampOwner, ownedBy } from '@/lib/save-slot'
import BirthScreen from './birth/BirthScreen'
import { loadRuneInventory, saveRuneInventory, setBirthRune, EMPTY_INVENTORY } from './rune-inventory'

// R3F Canvas is client/WebGL-only — never SSR it. The import is also deferred until `ready`
// so Shimmer3D's module init (world registration, NPC remaps) sees the live data.
const Shimmer3D = dynamic(() => import('./Shimmer3D'), { ssr: false })

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
  // ── WHO IS PLAYING, BEFORE ANYTHING READS A SAVE (#682) ──────────────────────────────────────
  // This is the first thing that happens, because `saveKey()` answers with the anonymous slot until
  // it is told otherwise and every later reader trusts that answer.
  //
  // ⚠ A FAILED SESSION FETCH RESOLVES TO ANONYMOUS, DELIBERATELY. Offline, or the endpoint down,
  // means we cannot prove who this is — and the safe direction is a signed-in keeper seeing the
  // anonymous slot (confusing, reversible, and `useAccount` will have failed too so nothing pushes)
  // rather than guessing an identity and writing into somebody's garden. Never fail toward a name.
  let userId: string | null = null
  try {
    const res = await fetch('/api/auth/session', { cache: 'no-store' })
    const body = (await res.json()) as { session: { user_id: string } | null }
    userId = body.session?.user_id ?? null
  } catch { /* offline — anonymous, local-only */ }
  setSaveOwner(userId)

  const slot = saveKey()
  try {
    // Local wins when present — and now that the slot is keyed to the account, the premise that
    // guard was written under is TRUE again. It used to mean "this browser has a save, so it is
    // this player's"; with one shared slot that was false the moment a second account signed in,
    // which is #682. Keyed, it says "this ACCOUNT has a save here", which is the intended claim.
    if (localStorage.getItem(slot)) return
  } catch { return }                             // private mode — nothing to hydrate into

  // ── ⚠ CLAIM THE ANONYMOUS SLOT BEFORE DOING ANYTHING ELSE ────────────────────────────────────
  // Found while verifying the fix, and it is #682 rebuilt through this function's own front door.
  // Hydrating from the cloud leaves the browser's ANONYMOUS slot sitting there unclaimed. A second
  // account that signs in later with no cloud row of its own reaches adoption below, finds that
  // slot, and inherits the first keeper's garden — then pushes it up as its own.
  //
  // ★ STAMPED, NOT DELETED, AND THE DIFFERENCE IS THE WHOLE POINT. Deleting it would throw away a
  // garden that may be NEWER than the cloud copy we are about to hydrate — trading a rare leak for
  // guaranteed data loss, which is the trade this entire fix exists to refuse. Stamping costs
  // nothing, keeps every byte, and makes `ownedBy` answer "no" for everybody else.
  if (userId) {
    try {
      const anon = localStorage.getItem(slotFor(null))
      if (anon && ownedBy(anon, null)) localStorage.setItem(slotFor(null), stampOwner(anon, userId))
    } catch { /* private mode — nothing to claim */ }
  }

  // This account's own cloud copy comes first: it is unambiguously theirs.
  const cloud = await pullCloudSave('shimmer')
  if (cloud) {
    try {
      JSON.parse(cloud)                          // don't persist a blob the game can't read
      if (ownedBy(cloud, userId)) { localStorage.setItem(slot, cloud); return }
      // Stamped for someone else. The server should never have handed this over; refuse rather
      // than hydrate, and let the keeper start fresh instead of inheriting a stranger's garden.
      console.warn('[save] cloud copy is stamped for another account — refusing to hydrate it')
    } catch { /* unparseable / quota — fall through to adoption */ }
  }

  // ── FIRST SIGN-IN ADOPTION (BUILD_SYNC_SPEC.md:150) ──────────────────────────────────────────
  // No cloud copy and nothing in this account's slot: this is a first sign-in. If the browser holds
  // an anonymous garden, it belongs to the person now signing in — not adopting it is how a player
  // loses everything they built before making an account.
  //
  // ★ ADOPTION CONSUMES THE SLOT, and that is the load-bearing half. The anonymous garden can be
  // claimed EXACTLY ONCE. Without that, account A plays, account B signs in on the same browser,
  // finds the same anonymous slot and adopts A's pre-login world — #682 rebuilt out of the fix for
  // it. Moving it (rather than copying) is what makes "first" mean something.
  if (!userId) return
  try {
    const anon = localStorage.getItem(slotFor(null))
    if (!anon) return
    // ⚠ Only if it is not already spoken for. The claim above stamps it for the first account to
    // sign in on this browser, so a second account finds a slot that names someone else and walks
    // away — which is the difference between "adopt an unclaimed garden" and "take that one".
    if (!ownedBy(anon, userId)) return
    JSON.parse(anon)                             // only adopt something the game can read
    localStorage.setItem(slot, stampOwner(anon, userId))
    localStorage.removeItem(slotFor(null))
    console.info('[save] adopted this browser\'s anonymous garden into the account signing in')
  } catch { /* nothing adoptable */ }
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
