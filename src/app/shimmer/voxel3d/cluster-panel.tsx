'use client'
// The cluster rows of the Gardens menu (cluster phase 4, 2026-09-23) — fold, ask a friend in, say yes,
// sign up, take back your own corner. WHAT is allowed is decided in cluster-menu.ts (pure, tested);
// the server enforces it again (lib/accounts/clusters.ts). This file only draws it and posts.
//
// ⛔ Canon's guards, as absences: no row acts on another keeper; the only exit is your own corner;
// nothing shows who folded the cluster (guard 3 — the absence of a title is the defence).
import { useCallback, useEffect, useState } from 'react'
import type { ClusterView, Quarter } from '@/lib/accounts/clusters'
import { H as HT, HearthChoice, HearthIdle, HearthLabel, HearthButton } from '../ui/hearth'
import { loadRuneInventory } from '../play3d/rune-inventory'
import { clusterMenu, type Friend, type Invite } from './cluster-menu'

interface ClusterRecord { cluster: ClusterView | null; quarter: Quarter | null; invites: Invite[] }

export function ClusterRows({ seed, tier, friends, enter, onClose }: {
  seed: number; tier: number; friends: Friend[] | null
  /** Walk into the cluster (the host's real-record open). */
  enter: () => void
  onClose: () => void
}) {
  const [rec, setRec] = useState<ClusterRecord | null | 'signed-out'>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const take = (j: unknown): ClusterRecord => {
    const r = j as Partial<ClusterRecord>
    return { cluster: r.cluster ?? null, quarter: r.quarter ?? null, invites: Array.isArray(r.invites) ? r.invites : [] }
  }
  useEffect(() => {
    let live = true
    fetch('/api/cluster', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (live) setRec(take(j)) })
      .catch(() => { if (live) setRec('signed-out') })
    return () => { live = false }
  }, [])

  const post = useCallback(async (body: object, done?: string) => {
    setBusy(true); setNote(null)
    try {
      const r = await fetch('/api/cluster', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setNote((j as { error?: string }).error ?? 'that did not go through'); return }
      setRec(take(j)); if (done) setNote(done)
    } catch { setNote('offline — try again in a moment') } finally { setBusy(false) }
  }, [])

  if (rec === null) return <HearthIdle>looking…</HearthIdle>
  if (rec === 'signed-out') return <HearthIdle>Sign in to fold a cluster with friends.</HearthIdle>

  const hasEnchant = loadRuneInventory().owned.includes('enchant')
  const m = clusterMenu(rec.cluster, rec.quarter, rec.invites, friends ?? [], hasEnchant)

  return (
    <div data-panel-section="cluster">
      {m.canFold && (
        <HearthChoice label="Fold a cluster" meta="your garden, one corner of four"
                      onClick={() => { if (!busy) void post({ action: 'fold', quarter: 'ne', enchant: true, seed, tier }, 'Folded. Ask a friend in and the Green opens between you.') }} />
      )}
      {m.foldNeedsEnchant && m.invites.length === 0 && (
        <HearthIdle sub="A friend who holds it can fold one and ask you in. Joining takes only a yes.">Folding a cluster takes Enchant.</HearthIdle>
      )}

      {m.invites.map(inv => (
        <div key={`${inv.cluster_id}:${inv.quarter}`} className="mb-2">
          <HearthChoice disabled label={inv.keepers.join(', ') || 'a cluster'} meta="asks you in" />
          <div className="flex gap-2 items-center">
            <HearthButton small primary disabled={busy || inv.waiting > 0}
                          onClick={() => void post({ action: 'answer', cluster_id: inv.cluster_id, quarter: inv.quarter, yes: true, seed, tier }, 'You signed up. Your corner is in.')}>
              Sign up
            </HearthButton>
            <HearthButton small disabled={busy}
                          onClick={() => void post({ action: 'answer', cluster_id: inv.cluster_id, quarter: inv.quarter, yes: false, seed, tier })}>
              Decline
            </HearthButton>
            {inv.waiting > 0 && <span className="text-[12px] italic" style={{ color: HT.inkFaint }}>waiting on {inv.waiting} more yes</span>}
          </div>
        </div>
      ))}

      {m.mode !== 'none' && (
        <>
          {m.keepers.map(k => <HearthChoice key={k.name} disabled label={k.name} meta={k.you ? 'you' : undefined} />)}
          {m.canWalk
            ? <HearthChoice accent label="Walk the cluster" meta={`${m.keepers.length} gardens`} onClick={() => { enter(); onClose() }} />
            : <HearthIdle sub="Ask a friend in and the Green opens between you.">Your fold is held open.</HearthIdle>}

          {m.pending.map(p => (
            <div key={p.quarter} className="mb-2">
              <HearthChoice disabled label={p.invitee} meta={p.waiting ? `waiting on ${p.waiting} yes` : 'waiting on them'} />
              <div className="flex gap-2">
                {!p.youSaidYes && (
                  <HearthButton small primary disabled={busy} onClick={() => void post({ action: 'consent', quarter: p.quarter })}>Say yes</HearthButton>
                )}
                <HearthButton small disabled={busy} onClick={() => void post({ action: 'withdraw', quarter: p.quarter })}>Withdraw</HearthButton>
              </div>
            </div>
          ))}

          {m.askable.length > 0 && m.nextOpen && (
            <>
              <div className="mt-3"><HearthLabel>Ask a friend in</HearthLabel></div>
              <div className="flex flex-wrap gap-2">
                {m.askable.map(f => (
                  <HearthButton key={f.username} small disabled={busy}
                                onClick={() => void post({ action: 'offer', username: f.username, quarter: m.nextOpen }, `Asked ${f.username}. Everyone already in says yes, then they sign up.`)}>
                    {f.username}
                  </HearthButton>
                ))}
              </div>
            </>
          )}

          <div className="mt-4">
            {!confirmLeave
              ? <HearthButton small disabled={busy} onClick={() => setConfirmLeave(true)}>Take back your corner</HearthButton>
              : (
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-[12px]" style={{ color: HT.inkSoft }}>Your corner comes home. The rest stand.</span>
                  <HearthButton small primary disabled={busy} onClick={() => { setConfirmLeave(false); void post({ action: 'takeBack' }, 'Your corner is yours alone again.') }}>Take it back</HearthButton>
                  <HearthButton small disabled={busy} onClick={() => setConfirmLeave(false)}>Keep it</HearthButton>
                </div>
              )}
          </div>
        </>
      )}
      {note && <div className="mt-2 text-[12px] italic" style={{ color: HT.inkFaint }}>{note}</div>}
    </div>
  )
}
