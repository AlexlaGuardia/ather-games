'use client'
// GARDEN CLUSTERS, THE CLIENT (Alex 11-15). The record is the server's (/api/cluster: consent-only joining, the four
// landlord guards in src/lib/accounts/clusters.ts); WHAT a keeper may do is decided by the pure model the voxel world
// already uses (voxel3d/cluster-menu.ts); this file fetches, uploads your own garden for your mates, builds the Frame
// (cluster.ts) and draws the menu in the Carved Hearth frame with the red close.
//
// ⚠ Neutral words: clusters are [OPEN] in CANON_GAPS (they reverse ather-rework §3), so no retired name ships.
// ⚠ Folding needed Enchant in the voxel world. The open world has no runes yet, so starting a link takes only the
//   keeper's own say-so here; joining has always been consent alone.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { HearthFrame, HearthButton, HearthLabel, H } from '../../ui/hearth'
import { clusterMenu, type Invite, type Friend } from '../../voxel3d/cluster-menu'
import type { ClusterView, Quarter as Q } from '@/lib/accounts/clusters'
import { clusterFrame, type Frame, type Mate, type Quarter } from './cluster'
import { readGarden, gardenText } from './garden-snapshot'

interface Remote { view: ClusterView | null; quarter: Q | null; invites: Invite[]; friends: Friend[]; gardens: Partial<Record<Q, { name: string | null; data: string }>>; signedIn: boolean }
const EMPTY: Remote = { view: null, quarter: null, invites: [], friends: [], gardens: {}, signedIn: false }

async function getJson<T>(url: string): Promise<T | null> { try { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? await r.json() as T : null } catch { return null } }

/** The keeper's cluster: the record, the frame round their own plot, and the verbs. Polls gently while open. */
export function useCluster(owned: readonly string[]) {
  const [rem, setRem] = useState<Remote>(EMPTY)
  const [busy, setBusy] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    const [c, g, f, who] = await Promise.all([
      getJson<{ cluster: ClusterView | null; quarter: Q | null; invites: Invite[] }>('/api/cluster'),
      getJson<{ gardens: Remote['gardens'] }>('/api/cluster/garden'),
      getJson<{ friends: Friend[] }>('/api/friends'),
      getJson<{ session: { user_id: string } | null }>('/api/auth/session'),
    ])
    setRem({ view: c?.cluster ?? null, quarter: c?.quarter ?? null, invites: c?.invites ?? [], friends: f?.friends ?? [], gardens: g?.gardens ?? {}, signedIn: !!who?.session })
  }, [])
  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id) }, [refresh])
  // your garden, for your mates: uploaded when you stand in a cluster and it changes
  const key = [...owned].sort().join('|')
  useEffect(() => {
    if (!rem.quarter) return
    const t = setTimeout(() => { fetch('/api/cluster/garden', { method: 'POST', body: gardenText(owned) }).catch(() => {}) }, 1500)
    return () => clearTimeout(t)
  }, [key, rem.quarter]) // eslint-disable-line react-hooks/exhaustive-deps
  // ?cluster=preview: a stand-in friend in the opposite quarter, so the linked world can be walked (and checked)
  // without a second account. Nothing is sent anywhere; it is a picture of what linking opens.
  const [preview, setPreview] = useState(false)
  useEffect(() => { setPreview(new URLSearchParams(location.search).get('cluster') === 'preview') }, [])
  const frame: Frame = useMemo(() => {
    if (preview) return clusterFrame('ne', [{ quarter: 'ne', name: 'you', owned: [...owned] }, { quarter: 'sw', name: 'a friend (preview)', owned: ['3,3', '4,3', '5,3', '3,4', '4,4', '5,4', '3,5', '4,5', '5,5', '4,2'] }])
    if (!rem.view || !rem.quarter) return clusterFrame(null, [])
    const mates: Mate[] = rem.view.members.map(m => {
      const g = rem.gardens[m.quarter], snap = g ? readGarden(g.data) : null   // somebody else's data: checked again here
      return { quarter: m.quarter as Quarter, name: m.username ?? 'a keeper', owned: m.quarter === rem.quarter ? [...owned] : snap?.owned ?? [] }
    })
    return clusterFrame(rem.quarter as Quarter, mates)
  }, [rem, key, preview]) // eslint-disable-line react-hooks/exhaustive-deps
  const act = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(action)
    try {
      const r = await fetch('/api/cluster', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, seed: 0, tier: 0, enchant: true, ...body }) })
      const j = await r.json().catch(() => ({})) as { error?: string }
      await refresh()
      return r.ok ? null : j.error ?? 'That did not work'
    } finally { setBusy(null) }
  }, [refresh])
  const menu = useMemo(() => clusterMenu(rem.view, rem.quarter, rem.invites, rem.friends, true), [rem])
  return { frame, menu, act, busy, signedIn: rem.signedIn, refresh }
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 10px', borderRadius: 10, background: 'rgba(255,250,235,0.55)', border: `1px solid ${H.rule}` }

export function ClusterPanel({ c, onClose }: { c: ReturnType<typeof useCluster>; onClose: () => void }) {
  const { menu, act, busy, signedIn } = c
  const [err, setErr] = useState<string | null>(null)
  const run = async (a: string, b?: Record<string, unknown>) => setErr(await act(a, b))
  return (
    <HearthFrame title="Linked plots" maxWidth={460} onClose={onClose} fixed dataPanel="cluster"
      footer={<span className="text-[12px]">Alone, the clouds keep your plot to itself. Link with a friend and the ground between your plots opens, with a bridge from each.</span>}>
      <div style={{ padding: '26px 16px 14px', fontSize: 13, display: 'grid', gap: 10 }}>
        {!signedIn ? (
          <div style={{ color: H.inkSoft }}>Sign in on the front page to link your plot with friends.</div>
        ) : (
          <>
            {menu.mode === 'none' && (
              <div style={row}><span>Your plot stands alone.</span><HearthButton small primary onClick={() => run('fold', { quarter: 'ne' })}>{busy === 'fold' ? '…' : 'Open it to friends'}</HearthButton></div>
            )}
            {menu.keepers.length > 0 && (<>
              <HearthLabel>Linked</HearthLabel>
              {menu.keepers.map((k, i) => <div key={i} style={row}><span style={{ fontWeight: 700 }}>{k.name}{k.you ? ' (you)' : ''}</span></div>)}
            </>)}
            {menu.pending.length > 0 && (<>
              <HearthLabel>Asked</HearthLabel>
              {menu.pending.map(p => (
                <div key={p.quarter} style={row}>
                  <span>{p.invitee} · waiting on {p.waiting}</span>
                  {!p.youSaidYes ? <HearthButton small onClick={() => run('consent', { quarter: p.quarter })}>Say yes</HearthButton> : <span style={{ color: H.inkFaint }}>you said yes</span>}
                </div>
              ))}
            </>)}
            {menu.nextOpen && menu.askable.length > 0 && (<>
              <HearthLabel>Ask a friend in</HearthLabel>
              {menu.askable.map(f => <div key={f.username} style={row}><span>{f.username}</span><HearthButton small onClick={() => run('offer', { quarter: menu.nextOpen, username: f.username })}>Ask</HearthButton></div>)}
            </>)}
            {menu.nextOpen && menu.askable.length === 0 && menu.mode !== 'none' && <div style={{ color: H.inkSoft }}>No friends to ask yet. Add friends from the front page.</div>}
            {menu.invites.length > 0 && (<>
              <HearthLabel>Invited</HearthLabel>
              {menu.invites.map(iv => (
                <div key={iv.cluster_id + iv.quarter} style={row}>
                  <span>{iv.keepers.join(', ')}{iv.waiting ? ` · ${iv.waiting} still to say yes` : ''}</span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <HearthButton small primary disabled={iv.waiting > 0} onClick={() => run('answer', { cluster_id: iv.cluster_id, quarter: iv.quarter, yes: true })}>Join</HearthButton>
                    <HearthButton small onClick={() => run('answer', { cluster_id: iv.cluster_id, quarter: iv.quarter, yes: false })}>No</HearthButton>
                  </span>
                </div>
              ))}
            </>)}
            {menu.mode !== 'none' && <div style={{ textAlign: 'right' }}><HearthButton small onClick={() => run('takeBack')}>Leave</HearthButton></div>}
            {err && <div style={{ color: H.rust, fontWeight: 600 }}>{err}</div>}
          </>
        )}
      </div>
    </HearthFrame>
  )
}
