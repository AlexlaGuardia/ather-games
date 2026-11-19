'use client'

// THE BIRTH RUNE, in the open world (Alex 11-15: "bringing the birth rune selection process over as well").
// CANON (game/shimmer-birth-rune.md, ruled 08-02): the birth rune is the keeper's innate rune; "the birth-rune ritual
// is the keeper choosing who they are, magically", the 20 runes of the canon matrix. That ritual already exists, so this
// is not a copy: it MOUNTS the voxel world's own BirthScreen (play3d/birth/BirthScreen.tsx: the four element wheels,
// the retinting void, the "Born of" beat) and saves to the same per-keeper key the voxel world reads (BIRTH_KEY), so a
// keeper is one person on both sides.
//
// BUILD (Jin): WHEN it happens. A keeper with no birth rune is born on first entry, before they play: the gate cannot
// be skipped (the voxel first-entry rule, HANDOFF-first-entry.md). Already born = the gate never shows. The Character
// tab shows the rune; changing it is a rebirth, which stays a voxel-world act (Options › Dev links there).

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { markBornWithoutStick } from './ather/rinsticks'
import { KeeperCreator } from './keeper-creator'
import { refreshLook } from './shared/look-store'
import BirthScreen from '../play3d/birth/BirthScreen'
import { loadRuneInventory } from '../play3d/rune-inventory'
import { saveOwnerResolved, SAVE_OWNER_EVENT } from '@/lib/save-slot'
import { stampEpochIfAbsent } from '@/lib/ather-epoch'
import { RosterPrompt } from './roster-prompt'

// ── the keeper's birth rune, as a store the open world can subscribe to ──────────────────────────────────────────
let birth: string | null | undefined
const subs = new Set<() => void>()
const read = () => { try { return loadRuneInventory().birth ?? null } catch { return null } }
const get = () => { if (typeof window === 'undefined') return null; if (birth === undefined) birth = read(); return birth }
/** Re-read after a birth (BirthScreen writes the key itself). */
export function refreshBirth() { birth = read(); subs.forEach(f => f()) }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const server = () => null
export const useBirth = () => useSyncExternalStore(subscribe, get, server)
export const getBirth = get

/** How long the "Born of <Rune>" beat holds before the world takes over. */
const BORN_HOLD_MS = 2800

/** Mount once per open-world page, outside the Canvas. Renders nothing for a keeper who is already born. */
export function BirthGate() {
  return <><BirthGateInner /><RosterPrompt /></>
}
function BirthGateInner() {
  const b = useBirth()
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState<number | null>(null)
  // BETA M29: rune -> LOOK -> born. The creator holds the gate open after the rune; Looks good (or Random + Looks good) closes it
  const [creating, setCreating] = useState(false), wantLook = useRef(false)
  useEffect(() => { setMounted(true) }, [])
  // a keeper born in another tab, or on the voxel side, closes the gate here too
  useEffect(() => { const s = (e: StorageEvent) => { if (e.key?.endsWith('birthRune')) refreshBirth() }; window.addEventListener('storage', s); return () => window.removeEventListener('storage', s) }, [])
  useEffect(() => { if (closing === null) return; const t = setTimeout(() => { refreshBirth(); setClosing(null); if (wantLook.current) { wantLook.current = false; setCreating(true) } }, BORN_HOLD_MS); return () => clearTimeout(t) }, [closing])
  // ★ WAIT FOR WHO IS PLAYING (bug, Alex 11-15: after "Forget my birth rune" the ritual popped on every fast travel, and
  // twice). The rune lives under the ACCOUNT's key, and on a fresh page load the account lands a few frames late
  // (SaveOwnerBoot): until then keeperKey() answers the anonymous key. The gate read that, found it empty, and opened;
  // a rune chosen in that window was written to the anonymous key, and when the account landed its own key was still
  // empty, so the gate opened AGAIN. It had hidden for weeks because an old unscoped copy of the rune sat in the
  // anonymous key; Forget cleared both. Now: nothing shows until the owner is known, and the owner landing re-reads.
  const [owner, setOwner] = useState(false)
  useEffect(() => {
    // M7: this keeper is current; say so, or /shimmer's resetIfStale deletes it (ather-epoch.ts › stampEpochIfAbsent)
    stampEpochIfAbsent()
    const on = () => { refreshBirth(); setOwner(saveOwnerResolved()) }
    on()
    window.addEventListener(SAVE_OWNER_EVENT, on)
    return () => window.removeEventListener(SAVE_OWNER_EVENT, on)
  }, [])
  if (creating) return <div data-panel="birth-look" onKeyDownCapture={e => e.stopPropagation()}><ReleaseLock /><KeeperCreator first onDone={() => setCreating(false)} /></div>
  if (!mounted || !owner || (b && closing === null)) return null
  return (
    <div data-panel="birth" onKeyDownCapture={e => e.stopPropagation()}>
      {/* the pointer is freed while you choose: a locked mouse cannot click a rune */}
      <ReleaseLock />
      <BirthScreen onChoose={() => { markBornWithoutStick(); refreshLook(); wantLook.current = true; setClosing(Date.now()) }} />   {/* M22: a new keeper earns the first rinstick */}
    </div>
  )
}
function ReleaseLock() {
  useEffect(() => { try { if (document.pointerLockElement) document.exitPointerLock() } catch { /* fine */ } }, [])
  return null
}
/** True while the gate is up (a page can freeze its walker on it). */
export const useBirthGateUp = () => useBirth() === null
