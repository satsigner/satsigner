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
import { PAYJOIN_MIN_CONTRIBUTE_SATS } from '@/constants/payjoin'
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

const RECEIVER_POLL_INTERVAL_MS = 4_000
const MAX_SESSION_RENEWALS = 2

function walletCanContributeToPayjoin(utxos: Utxo[]): boolean {
  return utxos.some((utxo) => utxo.value > PAYJOIN_MIN_CONTRIBUTE_SATS)
}

/** Native session is gone — recreate mailbox. Do NOT use for transient fetch/PSBT errors. */
function isDeadReceiverSessionError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('receiver session not found') ||
    lower.includes('missing ohttp') ||
    lower.includes('recreate') ||
    lower.includes('finalize instead of polling') ||
    lower.includes('already has a proposal') ||
    (lower.includes('expired') && !lower.includes('psbt')) ||
    lower.includes('session gone')
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
  const [polling, setPolling] = useState(false)
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null)
  const pollingRef = useRef(false)
  const recreateRef = useRef(false)
  const startingRef = useRef(false)
  const renewCountRef = useRef(0)
  const sessionRef = useRef<PayjoinSession | null>(null)

  const canContribute = walletCanContributeToPayjoin(utxos)

  const canUsePayjoin =
    payjoinEnabled &&
    isNativeAvailable() &&
    !!address &&
    account?.policyType === 'singlesig' &&
    canContribute

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
    sessionRef.current = created
    return created
  }, [accountId, address, amountSats, label])

  const startSession = useCallback(async () => {
    if (!canUsePayjoin || !address) {
      setSession(null)
      sessionRef.current = null
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
            sessionRef.current = updated
            return
          } catch {
            // Fall through to recreate if URI rewrite fails.
          }
          await createFreshSession()
          return
        }

        setSession(resumed)
        sessionRef.current = resumed
        return
      }

      await createFreshSession()
    } catch {
      setSession(null)
      sessionRef.current = null
    } finally {
      startingRef.current = false
    }
  }, [accountId, address, amountSats, canUsePayjoin, createFreshSession, label])

  const renewAfterFailure = useCallback(
    async (failedSession: PayjoinSession | null, message: string) => {
      if (renewCountRef.current >= MAX_SESSION_RENEWALS) {
        console.warn(
          '[payjoin] receiver renew skipped (cap reached)',
          message
        )
        return
      }
      if (!isDeadReceiverSessionError(message)) {
        console.warn('[payjoin] receiver keeping session after', message)
        return
      }
      console.warn('[payjoin] receiver renewing session', message)
      if (failedSession?.id) {
        usePayjoinSessionsStore.getState().removeSession(failedSession.id)
      }
      if (recreateRef.current) {
        return
      }
      recreateRef.current = true
      renewCountRef.current += 1
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
    const current = sessionRef.current
    if (
      !current?.nativeState ||
      pollingRef.current ||
      current.status === 'expired' ||
      current.status === 'completed'
    ) {
      return
    }

    pollingRef.current = true
    setPolling(true)
    try {
      console.log('[payjoin] receiver poll', {
        sessionId: current.id,
        status: current.status
      })
      const { session: updated, originalPsbtBase64 } =
        await pollReceiverSession({
          callbacks: buildCallbacks(),
          session: current
        })

      setLastPolledAt(Date.now())

      if (updated.status === 'error') {
        const message = updated.error ?? 'payjoin poll error'
        if (isDeadReceiverSessionError(message)) {
          await renewAfterFailure(updated, message)
          return
        }
        // Transient protocol/network errors: stay on the same mailbox URI.
        const recovered: PayjoinSession = {
          ...current,
          error: undefined,
          nativeState: updated.nativeState ?? current.nativeState,
          status: 'waiting',
          updatedAt: Date.now()
        }
        usePayjoinSessionsStore.getState().upsertSession(recovered)
        setSession(recovered)
        sessionRef.current = recovered
        console.warn('[payjoin] receiver poll soft-error, still waiting', message)
        return
      }

      setSession(updated)
      sessionRef.current = updated
      if (originalPsbtBase64 && updated.status === 'proposal_received') {
        setNegotiating(true)
        try {
          const finalized = await finalizeReceiverPayjoin({
            callbacks: buildCallbacks(),
            session: updated
          })
          setSession(finalized)
          sessionRef.current = finalized
        } finally {
          setNegotiating(false)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLastPolledAt(Date.now())
      if (isDeadReceiverSessionError(message)) {
        await renewAfterFailure(current, message)
        return
      }
      // Keep waiting — e.g. HTTP/2 SETTINGS preface / relay blips.
      console.warn('[payjoin] receiver poll failed, retrying later', message)
      const stillWaiting: PayjoinSession = {
        ...current,
        error: undefined,
        status: 'waiting',
        updatedAt: Date.now()
      }
      usePayjoinSessionsStore.getState().upsertSession(stillWaiting)
      setSession(stillWaiting)
      sessionRef.current = stillWaiting
    } finally {
      pollingRef.current = false
      setPolling(false)
    }
  }, [buildCallbacks, renewAfterFailure])

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    renewCountRef.current = 0
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

    if (!session.nativeState) {
      void startSession()
      return
    }

    // Kick one poll immediately so "Waiting for sender" is visibly active.
    void pollOnce()

    const interval = setInterval(() => {
      void pollOnce()
    }, RECEIVER_POLL_INTERVAL_MS)

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
    // Re-bind when the mailbox identity changes, not on every soft status tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pollOnce/startSession stable enough via refs
  }, [canUsePayjoin, session?.id, session?.nativeState, startSession])

  const statusLabelKey = !canUsePayjoin
    ? null
    : renewing
      ? 'receive.payjoin.status.renewing'
      : negotiating ||
          session?.status === 'negotiating' ||
          session?.status === 'proposal_received' ||
          session?.status === 'finalizing'
        ? 'receive.payjoin.status.negotiating'
        : session?.status === 'completed'
          ? 'receive.payjoin.status.completed'
          : session?.status === 'expired'
            ? 'receive.payjoin.status.expired'
            : session?.nativeState &&
                (session.status === 'waiting' ||
                  session.status === 'ready' ||
                  session.status === 'initializing' ||
                  session.status === 'error')
              ? 'receive.payjoin.status.waiting'
              : session
                ? 'receive.payjoin.status.ready'
                : 'receive.payjoin.status.ready'

  return {
    canContribute,
    canUsePayjoin,
    lastPolledAt,
    negotiating,
    payjoinUri:
      canUsePayjoin && session && session.status !== 'expired'
        ? session.uri
        : undefined,
    polling,
    restartSession: startSession,
    session,
    statusLabelKey
  }
}

export { usePayjoinReceiver, walletCanContributeToPayjoin }
