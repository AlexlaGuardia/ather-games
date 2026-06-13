'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCloudSave } from './use-cloud-save'

interface WalletData {
  marks: number
  totalEarned: number
  totalSpent: number
}

const EMPTY_WALLET: WalletData = { marks: 0, totalEarned: 0, totalSpent: 0 }

export function useWallet() {
  const { load, save, isSignedIn } = useCloudSave('wallet')
  const [wallet, setWallet] = useState<WalletData>(EMPTY_WALLET)
  const [loading, setLoading] = useState(true)
  const walletRef = useRef(wallet)
  const loadedRef = useRef(false)

  walletRef.current = wallet

  useEffect(() => {
    if (!isSignedIn || loadedRef.current) {
      setLoading(false)
      return
    }
    loadedRef.current = true
    load().then(data => {
      if (data) {
        const w = { ...EMPTY_WALLET, ...data }
        setWallet(w)
        walletRef.current = w
      }
      setLoading(false)
    })
  }, [isSignedIn, load])

  const earn = useCallback(
    (amount: number) => {
      if (amount <= 0) return
      const next: WalletData = {
        marks: walletRef.current.marks + amount,
        totalEarned: walletRef.current.totalEarned + amount,
        totalSpent: walletRef.current.totalSpent,
      }
      setWallet(next)
      walletRef.current = next
      if (isSignedIn) save(next)
    },
    [isSignedIn, save],
  )

  const spend = useCallback(
    (amount: number): boolean => {
      if (amount <= 0 || walletRef.current.marks < amount) return false
      const next: WalletData = {
        marks: walletRef.current.marks - amount,
        totalEarned: walletRef.current.totalEarned,
        totalSpent: walletRef.current.totalSpent + amount,
      }
      setWallet(next)
      walletRef.current = next
      if (isSignedIn) save(next)
      return true
    },
    [isSignedIn, save],
  )

  return { marks: wallet.marks, earn, spend, loading, isSignedIn }
}
