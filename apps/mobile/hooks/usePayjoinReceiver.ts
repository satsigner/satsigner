import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { isNativeAvailable } from 'react-native-payjoin'

import {
  clearReceiverSessionsForAccount,
  createReceivePayjoinSession,
  finalizeReceiverPayjoin,
  pollReceiverSession,
  tryResumeReceiverSession
} from '@/api/payjoin'
import { useBlockchainStore } from '@/store/blockchain'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { useSettingsStore } from '@/store/settings'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { type PayjoinSession } from '@/types/payjoin'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { appendParamsToPayjoinUri } from '@/utils/payjoinUri'
import { buildPayjoinWalletCallbacks } from '@/utils/payjoinWallet'

type UsePayjoinReceiverParams = {
  accountId: string
  account?: Account
  address?: string
  amountSats?: number
  label?: string
  utxos: Utxo[]
  /** Sign callback from BDK wallet when available. */
  signPsbt?: (psbtBase64: string) => Promise<string> | string
}

function isRecoverableReceiverError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('receiver session not found') ||
    lower.includes('missing ohttp') ||
    lower.includes('recreate') ||
    lower.includes('expired') ||
    lower.includes('expir') ||
    lower.includes('gone') ||
    lower.includes('not found') ||
    lower.includes('unavailable')
  )
}

function usePayjoinReceiver({
  accountId,
  account,
  address,
  amountSats,
  label,
  utxos,
  signPsbt
}: UsePayjoinReceiverParams) {
  const payjoinEnabled = useSettingsStore((s) => s.payjoinEnabled)
  const networkName = useBlockchainStore((s) => s.network)
  const [session, setSession] = useState<PayjoinSession | null>(null)
  const [negotiating, setNegotiating] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const pollingRef = useRef(false)
  const recreateRef = useRef(false)
  const startingRef = useRef(false)

  const canUsePayjoin =
    payjoinEnabled &&
    isNativeAvailable() &&
    !!address &&
    account?.policyType === 'singlesig'

  const buildCallbacks = useCallback(() => {
    const store = usePayjoinSessionsStore.getState()
    return buildPayjoinWalletCallbacks({
      hasSeenInput: (outpoint) => store.hasSeenInput(outpoint),
      markInputSeen: (outpoint) => store.markInputSeen(outpoint),
      network: bitcoinjsNetwork(networkName),
      ownedAddresses: [
        ...(account?.addresses ?? []).map((a) => a.address),
        address
      ].filter((value): value is string => !!value),
      signPsbt: (psbtBase64) => {
        if (!signPsbt) {
          return psbtBase64
        }
        return signPsbt(psbtBase64)
      },
      utxos
    })
  }, [account?.addresses, address, networkName, signPsbt, utxos])

  const createFreshSession = useCallback(async () => {
    if (!address) {
      return null
    }
    clearReceiverSessionsForAccount(accountId)
    const created = await createReceivePayjoinSession({
      accountId,
      address,
      amountSats,
      label
    })
    setSession(created)
    return created
  }, [accountId, address, amountSats, label])

  const startSession = useCallback(async () => {
    if (!canUsePayjoin || !address) {
      setSession(null)
      return
    }
    if (startingRef.current) {
      return
    }
    startingRef.current = true

    try {
      const existing = usePayjoinSessionsStore
        .getState()
        .getActiveReceiverSession(accountId)

      if (
        existing &&
        existing.address === address &&
        existing.expiresAt > Date.now()
      ) {
        // Resume native memory before rewriting BIP21 extras. Skipping resume
        // left a dead nativeState that polls then surfaced as "expired".
        const resumed = await tryResumeReceiverSession(existing)
        if (!resumed) {
          await createFreshSession()
          return
        }

        const labelMatches =
          (resumed.label ?? undefined) === (label ?? undefined)
        const amountMatches =
          (resumed.amountSats ?? undefined) === (amountSats ?? undefined)

        if (!labelMatches || !amountMatches) {
          try {
            const uri = appendParamsToPayjoinUri(resumed.uri, {
              amountSats,
              label,
              pjos: resumed.pjos
            })
            const updated: PayjoinSession = {
              ...resumed,
              amountSats,
              label,
              uri,
              updatedAt: Date.now()
            }
            usePayjoinSessionsStore.getState().upsertSession(updated)
            setSession(updated)
            return
          } catch {
            // Fall through to recreate if URI rewrite fails.
          }
          await createFreshSession()
          return
        }

        setSession(resumed)
        return
      }

      await createFreshSession()
    } catch {
      setSession(null)
    } finally {
      startingRef.current = false
    }
  }, [accountId, address, amountSats, canUsePayjoin, createFreshSession, label])

  const renewAfterFailure = useCallback(
    async (failedSession: PayjoinSession | null, message: string) => {
      console.warn('[payjoin] receiver renewing session', message)
      if (failedSession?.id) {
        usePayjoinSessionsStore.getState().removeSession(failedSession.id)
      }
      if (recreateRef.current) {
        return
      }
      recreateRef.current = true
      setRenewing(true)
      try {
        await createFreshSession()
      } finally {
        recreateRef.current = false
        setRenewing(false)
      }
    },
    [createFreshSession]
  )

  const pollOnce = useCallback(async () => {
    if (
      !session?.nativeState ||
      pollingRef.current ||
      session.status === 'expired' ||
      session.status === 'completed'
    ) {
      return
    }
    // Dead sessions: renew instead of leaving the UI stuck on "expired".
    if (session.status === 'error') {
      await renewAfterFailure(session, session.error ?? 'error status')
      return
    }

    pollingRef.current = true
    try {
      const { session: updated, originalPsbtBase64 } =
        await pollReceiverSession({
          callbacks: buildCallbacks(),
          session
        })

      if (updated.status === 'error') {
        const message = updated.error ?? 'payjoin poll error'
        if (isRecoverableReceiverError(message)) {
          await renewAfterFailure(updated, message)
          return
        }
        setSession(updated)
        return
      }

      setSession(updated)
      if (originalPsbtBase64 && updated.status === 'proposal_received') {
        setNegotiating(true)
        try {
          const finalized = await finalizeReceiverPayjoin({
            callbacks: buildCallbacks(),
            session: updated
          })
          setSession(finalized)
        } finally {
          setNegotiating(false)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (isRecoverableReceiverError(message)) {
        await renewAfterFailure(session, message)
        return
      }
      const failed = {
        ...session,
        error: message,
        status: 'error' as const,
        updatedAt: Date.now()
      }
      usePayjoinSessionsStore.getState().upsertSession(failed)
      setSession(failed)
    } finally {
      pollingRef.current = false
    }
  }, [buildCallbacks, renewAfterFailure, session])

  useEffect(() => {
    void startSession()
  }, [startSession])

  useEffect(() => {
    if (
      !session ||
      !canUsePayjoin ||
      session.status === 'expired' ||
      session.status === 'completed'
    ) {
      return
    }

    // Immediately renew stuck error sessions when Receive is open.
    if (session.status === 'error') {
      void pollOnce()
      return
    }

    if (!session.nativeState) {
      void startSession()
      return
    }

    const interval = setInterval(() => {
      void pollOnce()
    }, 4000)

    function onAppState(next: AppStateStatus) {
      if (next === 'active') {
        void pollOnce()
      }
    }
    const sub = AppState.addEventListener('change', onAppState)

    return () => {
      clearInterval(interval)
      sub.remove()
    }
  }, [canUsePayjoin, pollOnce, session, startSession])

  const statusLabelKey = !canUsePayjoin
    ? null
    : renewing
      ? 'receive.payjoin.status.renewing'
      : negotiating || session?.status === 'negotiating'
        ? 'receive.payjoin.status.negotiating'
        : session?.status === 'completed'
          ? 'receive.payjoin.status.completed'
          : session?.status === 'expired' || session?.status === 'error'
            ? 'receive.payjoin.status.expired'
            : session?.status === 'waiting' || session?.status === 'ready'
              ? 'receive.payjoin.status.ready'
              : 'receive.payjoin.status.ready'

  return {
    canUsePayjoin,
    negotiating,
    payjoinUri:
      canUsePayjoin &&
      session?.status !== 'error' &&
      session?.status !== 'expired'
        ? session?.uri
        : undefined,
    restartSession: startSession,
    session,
    statusLabelKey
  }
}

export { usePayjoinReceiver }
