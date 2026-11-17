'use client'
// ── THE OPEN WORLD'S CLOUD SAVE, PAGE SIDE (BETA M12 step 5, docs/M12-cloud-save.md §4) ───────────────────────────────
// Signed-in keepers only; an anonymous keeper never touches the network here. The rules live in lib/open-cloud-core.ts.
//
// BOOT: take the write lease (which returns the server doc) → decideBoot → idle | push | adopt | hold.
// PLAY: every 30 s, push if the content changed since the last agreed state; a pagehide beacon catches the tab closing.
// 409 'stale' / 'lease' = another device writes now: stop pushing, keep local untouched, show "Continue here?".
//
// ★ ADOPTING NEVER WRITES UNDER A RUNNING PAGE. The game holds its state in memory and saves it again on its way out
//   (pagehide), which would put the old pack straight back over the adopted one. So adopt = stash the server doc in
//   sessionStorage and reload; the NEXT load applies it while this component renders, which is before the page renders
//   (the layout puts it ahead of {children}), so every reader sees the adopted state from its first read.
import { useEffect, useRef, useState } from 'react'
import { saveOwner, saveOwnerResolved, SAVE_OWNER_EVENT } from '@/lib/save-slot'
import { ATHER_EPOCH } from '@/lib/ather-epoch'
import { ensureRoster } from '@/lib/keeper-roster'
import { collectDoc, applyDoc, contentHash, decideBoot, writeBackup, readRec, writeRec, hasData, PENDING_KEY, type OpenDoc, type SyncRec } from '@/lib/open-cloud-core'

const PUSH_EVERY_MS = 30_000
const DEVICE_KEY = 'ather:device'   // per browser, never synced (in neither registry, and unscoped)

function deviceId(): string {
  try {
    let d = localStorage.getItem(DEVICE_KEY)
    if (!d) { d = 'd_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem(DEVICE_KEY, d) }
    return d
  } catch { return 'd_private' }
}

let pendingDone = false
/** Apply a stashed adoption before any reader runs. Runs once per page load, during the first client render. */
function applyPending(): void {
  if (pendingDone || typeof window === 'undefined') return
  pendingDone = true
  try {
    const raw = sessionStorage.getItem(PENDING_KEY); if (!raw) return
    const p = JSON.parse(raw) as { owner: string; doc: OpenDoc; rev: number }
    applyDoc(localStorage, p.owner, p.doc)
    writeRec(localStorage, p.owner, { rev: p.rev, hash: contentHash(p.doc) })
    sessionStorage.removeItem(PENDING_KEY)   // only after it landed: a throw mid-apply retries on the next load
    console.info(`[cloud] adopted the account's save (rev ${p.rev})`)
  } catch (e) { console.warn('[cloud] could not apply the adopted save; local kept', e) }
}

type Mode = 'off' | 'live' | 'other-device' | 'held'
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })

export function OpenCloudSync() {
  applyPending()
  const [mode, setMode] = useState<Mode>('off')
  const st = useRef<{ owner: string | null; rec: SyncRec | null; retired: OpenDoc['retired']; mode: Mode; adopting: boolean; busy: boolean }>(
    { owner: null, rec: null, retired: [], mode: 'off', adopting: false, busy: false })
  const set = (m: Mode) => { st.current.mode = m; setMode(m) }

  useEffect(() => {
    const dev = deviceId()
    const S = st.current

    const adopt = (owner: string, doc: OpenDoc, rev: number) => {
      S.adopting = true
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ owner, doc, rev })) }
      catch { applyDoc(localStorage, owner, doc); writeRec(localStorage, owner, { rev, hash: contentHash(doc) }) }   // too big for sessionStorage: apply now, reload at once
      location.reload()
    }
    const push = async (owner: string, base: number) => {
      if (S.busy) return
      const doc = collectDoc(localStorage, owner, ATHER_EPOCH, S.retired); if (!doc) return
      S.busy = true
      try {
        const r = await post('/api/saves/open', { base_rev: base, device: dev, doc })
        if (r.ok) { const { rev } = await r.json() as { rev: number }; S.rec = { rev, hash: contentHash(doc) }; writeRec(localStorage, owner, S.rec); return }
        const body = await r.json().catch(() => ({})) as { reason?: string; error?: string }
        if (r.status === 409 && (body.reason === 'stale' || body.reason === 'lease')) set('other-device')
        else if (r.status === 409 || r.status === 413 || r.status === 400) { set('held'); console.error(`[cloud] push refused (${r.status}): ${body.error ?? body.reason}; playing on local only`) }
        // 401 / 429 / 5xx / offline: local stays the truth, the next tick tries again
      } catch { /* offline */ } finally { S.busy = false }
    }
    /** boot, and "Continue here": take the lease, then decide */
    const boot = async (takeOver = false) => {
      const owner = saveOwner(); S.owner = owner
      if (!owner) { set('off'); return }
      ensureRoster(owner)   // also finishes an interrupted swap, so collect never sees a half-written live slot
      let server: { doc: OpenDoc | null; rev: number }
      try {
        const r = await post('/api/saves/open/lease', { device: dev })
        if (!r.ok) return   // signed out server-side, offline, rate-limited: local is the truth
        server = await r.json()
      } catch { return }
      S.retired = server.doc?.retired ?? []
      const local = collectDoc(localStorage, owner, ATHER_EPOCH, S.retired)
      S.rec = readRec(localStorage, owner)
      // "Continue here" after another device wrote: whatever this tab holds unpushed is the 'both moved' case
      const d = takeOver && server.doc && hasData(local) && contentHash(local) !== contentHash(server.doc) && contentHash(local) !== S.rec?.hash
        ? { do: 'adopt' as const, backup: true } : decideBoot(local, S.rec, server, ATHER_EPOCH)
      if (d.do === 'hold') { set('held'); console.warn(`[cloud] ${d.why}; not syncing`); return }
      set('live')
      if (d.do === 'idle') { S.rec = { rev: d.rev, hash: contentHash(local) }; writeRec(localStorage, owner, S.rec); return }
      if (d.do === 'push') { await push(owner, d.base); return }
      if (d.backup && !writeBackup(localStorage, owner, local!, server.rev)) { set('other-device'); console.error('[cloud] no room to back up this browser\'s save, so the account copy was NOT taken'); return }
      adopt(owner, server.doc!, server.rev)
    }
    ;(window as unknown as { __openCloud?: unknown }).__openCloud = { state: () => ({ ...S, dev }), boot }   // read-only probe for checks

    const tick = () => {
      if (S.mode !== 'live' || S.adopting || !S.owner || !S.rec) return
      const doc = collectDoc(localStorage, S.owner, ATHER_EPOCH, S.retired)
      if (doc && contentHash(doc) !== S.rec.hash) void push(S.owner, S.rec.rev)
    }
    const onHide = () => {
      if (S.mode !== 'live' || S.adopting || !S.owner || !S.rec) return
      const doc = collectDoc(localStorage, S.owner, ATHER_EPOCH, S.retired)
      if (!doc || contentHash(doc) === S.rec.hash) return
      const blob = new Blob([JSON.stringify({ base_rev: S.rec.rev, device: dev, doc })], { type: 'application/json' })
      navigator.sendBeacon?.('/api/saves/open', blob)   // the next boot re-agrees the rev (equal content = idle)
    }
    const onOwner = () => { if (saveOwner() !== S.owner) void boot() }
    if (saveOwnerResolved()) void boot()
    window.addEventListener(SAVE_OWNER_EVENT, onOwner)
    window.addEventListener('pagehide', onHide)
    const iv = setInterval(tick, PUSH_EVERY_MS)
    ;(window as unknown as { __openCloudTakeOver?: () => void }).__openCloudTakeOver = () => void boot(true)
    return () => { clearInterval(iv); window.removeEventListener(SAVE_OWNER_EVENT, onOwner); window.removeEventListener('pagehide', onHide) }
  }, [])

  if (mode !== 'other-device') return null
  return (
    <div data-panel="cloud-other-device" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] flex items-center gap-3 rounded-lg px-4 py-2 text-[13px]"
      style={{ background: 'rgba(20,16,12,0.92)', color: '#f3e6cf', boxShadow: '0 2px 12px rgba(0,0,0,0.5)', border: '1px solid rgba(243,230,207,0.25)' }}>
      <span>Playing on another device.</span>
      <button className="rounded px-3 py-1 font-semibold uppercase tracking-[0.12em] text-[11px]" style={{ background: '#e8b04a', color: '#1a120a' }}
        onClick={() => (window as unknown as { __openCloudTakeOver?: () => void }).__openCloudTakeOver?.()}>Continue here</button>
    </div>
  )
}
