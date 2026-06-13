'use client'

import { useState, useEffect, useCallback } from 'react'

interface Friend {
  user_id: string
  username: string
  character_id: string
  status: string
  incoming: boolean
}

interface FriendsPanelProps {
  onClose: () => void
  onVisitGarden?: (friendUserId: string) => void
  onInviteToGarden?: (friendUserId: string) => void
}

export default function FriendsPanel({ onClose, onVisitGarden, onInviteToGarden }: FriendsPanelProps) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [searchName, setSearchName] = useState('')
  const [searchResult, setSearchResult] = useState<string | null>(null)
  const [tab, setTab] = useState<'friends' | 'requests'>('friends')

  const loadFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/friends')
      const data = await res.json()
      setFriends(data.friends || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadFriends() }, [loadFriends])

  const accepted = friends.filter(f => f.status === 'accepted')
  const pending = friends.filter(f => f.status === 'pending')
  const incomingRequests = pending.filter(f => f.incoming)
  const outgoingRequests = pending.filter(f => !f.incoming)

  const handleAdd = async () => {
    if (!searchName.trim()) return
    setSearchResult(null)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', username: searchName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSearchResult(`Request sent to ${data.sent_to}`)
        setSearchName('')
        loadFriends()
      } else {
        setSearchResult(data.error || 'Failed')
      }
    } catch {
      setSearchResult('Network error')
    }
  }

  const handleAccept = async (friendUserId: string) => {
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', friendUserId }),
    })
    loadFriends()
  }

  const handleRemove = async (friendUserId: string) => {
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', friendUserId }),
    })
    loadFriends()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[14px] text-[#d4a843] font-display tracking-wider uppercase">Community Gate</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => setTab('friends')}
          className={`px-3 py-1.5 rounded text-[12px] font-display transition-colors ${
            tab === 'friends' ? 'bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/30' : 'text-text-dim hover:text-text border border-transparent'
          }`}
        >
          Friends ({accepted.length})
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`px-3 py-1.5 rounded text-[12px] font-display transition-colors ${
            tab === 'requests' ? 'bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/30' : 'text-text-dim hover:text-text border border-transparent'
          }`}
        >
          Requests {incomingRequests.length > 0 && <span className="ml-1 text-[#d4a843]">({incomingRequests.length})</span>}
        </button>
      </div>

      {/* Add friend */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchName}
          onChange={e => setSearchName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))}
          placeholder="Add by username..."
          className="flex-1 px-3 py-1.5 bg-[#0a0a18] border border-white/10 rounded text-[13px] text-text placeholder:text-text-faint/30 focus:outline-none focus:border-[#d4a843]/40"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!searchName.trim()}
          className="px-3 py-1.5 rounded bg-[#d4a843]/15 text-[#d4a843] text-[12px] font-display border border-[#d4a843]/25 hover:bg-[#d4a843]/25 disabled:opacity-30 transition-colors"
        >
          Add
        </button>
      </div>
      {searchResult && <p className="text-[12px] text-text-faint">{searchResult}</p>}

      {/* Friends list */}
      {tab === 'friends' && (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {loading && <p className="text-[12px] text-text-faint">Loading...</p>}
          {!loading && accepted.length === 0 && (
            <p className="text-[12px] text-text-faint/50 italic">No friends yet. Add someone by username!</p>
          )}
          {accepted.map(f => (
            <div key={f.user_id} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/5">
              <div>
                <span className="text-[13px] text-text font-display">{f.username}</span>
                <span className="text-[11px] text-text-faint/40 ml-2 capitalize">{f.character_id}</span>
              </div>
              <div className="flex gap-1.5">
                {onVisitGarden && (
                  <button
                    onClick={() => onVisitGarden(f.user_id)}
                    className="px-2 py-1 rounded text-[11px] text-[#d4a843] bg-[#d4a843]/10 hover:bg-[#d4a843]/20 border border-[#d4a843]/20 transition-colors"
                  >
                    Visit
                  </button>
                )}
                {onInviteToGarden && (
                  <button
                    onClick={() => onInviteToGarden(f.user_id)}
                    className="px-2 py-1 rounded text-[11px] text-text-dim bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    Invite
                  </button>
                )}
                <button
                  onClick={() => handleRemove(f.user_id)}
                  className="px-2 py-1 rounded text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requests tab */}
      {tab === 'requests' && (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {incomingRequests.length > 0 && (
            <>
              <p className="text-[11px] text-text-faint/50 uppercase tracking-wider font-display">Incoming</p>
              {incomingRequests.map(f => (
                <div key={f.user_id} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <span className="text-[13px] text-text font-display">{f.username}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleAccept(f.user_id)}
                      className="px-2 py-1 rounded text-[11px] text-green-400 bg-green-400/10 hover:bg-green-400/20 border border-green-400/20 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRemove(f.user_id)}
                      className="px-2 py-1 rounded text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
          {outgoingRequests.length > 0 && (
            <>
              <p className="text-[11px] text-text-faint/50 uppercase tracking-wider font-display mt-3">Sent</p>
              {outgoingRequests.map(f => (
                <div key={f.user_id} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <span className="text-[13px] text-text font-display">{f.username}</span>
                  <span className="text-[11px] text-text-faint/40 italic">Pending</span>
                </div>
              ))}
            </>
          )}
          {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
            <p className="text-[12px] text-text-faint/50 italic">No pending requests.</p>
          )}
        </div>
      )}
    </div>
  )
}
