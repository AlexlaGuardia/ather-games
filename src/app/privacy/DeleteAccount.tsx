'use client'

import { useState } from 'react'
import { useAccount } from '@/lib/accounts/use-account'

// The working half of the privacy page. A policy that promises deletion and then asks you
// to email someone is a promise the code does not keep, so the button is real and it runs
// the same delete the policy describes.
export default function DeleteAccount() {
  const { session, loading, deleteAccount } = useAccount()
  const [arming, setArming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return null

  if (done) {
    return (
      <p className="text-text-dim">
        Your account is deleted. Anything saved in this browser (your garden, your settings) is still
        here, because it never left the device. Clearing site data removes that too.
      </p>
    )
  }

  if (!session) {
    return (
      <p className="text-text-dim">
        You are not signed in, so there is no account to delete. Anything this site has saved is in
        this browser only, and clearing site data removes it.
      </p>
    )
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    const res = await deleteAccount()
    if (res.ok) setDone(true)
    else setError(res.error ?? 'Could not delete the account')
    setBusy(false)
  }

  return (
    <div>
      <p className="text-text-dim mb-4">
        Signed in{session.username ? <> as <span className="text-[#d4a843]">{session.username}</span></> : ' (no username claimed yet)'}.
        Deleting removes your account, your username, and your friend list from our server. It cannot be undone.
      </p>
      {!arming ? (
        <button
          onClick={() => setArming(true)}
          className="px-4 py-2 rounded-lg border border-red-400/30 text-red-400/80 text-sm hover:bg-red-400/10 hover:text-red-400 transition-colors"
        >
          Delete my account
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-text text-sm">Delete it for good?</span>
          <button
            onClick={run}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-red-500/15 border border-red-400/40 text-red-300 text-sm hover:bg-red-500/25 disabled:opacity-40 transition-colors"
          >
            {busy ? 'Deleting...' : 'Yes, delete it'}
          </button>
          <button
            onClick={() => setArming(false)}
            className="px-4 py-2 rounded-lg border border-white/10 text-text-dim text-sm hover:border-white/20 transition-colors"
          >
            Keep it
          </button>
        </div>
      )}
      {error && <p className="text-red-400/80 text-sm mt-3">{error}</p>}
    </div>
  )
}
