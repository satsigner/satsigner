import { useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import {
  clearReceiverSessionsForAccount,
  createReceivePayjoinSession,
  finalizeBoardReceiverPayjoin,
  finalizeReceiverPayjoin,
  isSenderPostInFlight,
  pollReceiverSession,
  resumePersistedReceiverSession
} from '@/api/payjoin'
import { isNativeAvailable } from '@/api/payjoinNative'
import { useBlockchainStore } from '@/store/blockchain'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { getPayjoinSessionTtlMs, useSettingsStore } from '@/store/settings'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import {
  type PayjoinBoardDestination,
  type PayjoinSession
} from '@/types/payjoin'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import {
  compactError,
  mailboxFromEndpoint,
  payjoinLog,
  payjoinWarn
} from '@/utils/payjoinLog'
import {
  receiverPollEffectKey,
  resolveReceiverPollMode
} from '@/utils/payjoinReceiverPoll'
import { resolveReceiverSessionOnStart } from '@/utils/payjoinReceiverStart'
import { withReceiverSessionBip21Params } from '@/utils/payjoinSessionParams'
import {
  isPayjoinFallback,
  isPayjoinSuccess
} from '@/utils/payjoinSessionStatus'
import { hasPayjoinParam } from '@/utils/payjoinUri'
import { walletCanContributeToPayjoin } from '@/utils/payjoinUtxos'
import { buildPayjoinWalletCallbacks } from '@/utils/payjoinWallet'

type UsePayjoinReceiverParams = {
  accountId: string
  account?: Account
  address?: string
  amountSats?: number
  /**
   * When set, this receive funds an Ark board: the receiver contributes no
   * inputs and the finalized proposal is cosigned with the ark server before
   * posting, so the onchain-wallet gating (singlesig + spendable utxos) does
   * not apply.
   */
  board?: PayjoinBoardDestination
  label?: string
  utxos: Utxo[]
  signPsbt?: (psbtBase64: string) => Promise<string> | string
}

const RECEIVER_POLL_INTERVAL_MS = 8_000
const START_SESSION_LOCK_MS = 45_000

function isMailboxExpiredError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('session expired') ||
    (lower.includes('protocol error') && lower.includes('expired'))
  )
}

function isNativeSessionMissingError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('receiver session not found') ||
    lower.includes('missing ohttp') ||
    (lower.includes('recreate') && !lower.includes('proposal')) ||
    lower.includes('session gone')
  )
}

function shouldReplaceMailbox(message: string): boolean {
  return isMailboxExpiredError(message)
}

/**
 * Errors that no amount of re-polling or re-finalizing can fix: the session
 * stays in `error` and the user must start a new receive.
 */
function isTerminalFinalizeError(message: string): boolean {
  return /no utxos to contribute|missing proposal state|missing directory post|missing board destination|proposal txid not stable/i.test(
    message
  )
}

function sessionNeedsFinalize(session: PayjoinSession): boolean {
  if (
    !!session.originalPsbtBase64 &&
    !isPayjoinSuccess(session.status) &&
    session.status !== 'expired' &&
    !isPayjoinFallback(session.status)
  ) {
    return true
  }
  return (
    session.status === 'proposal_received' ||
    session.status === 'negotiating' ||
    session.status === 'finalizing'
  )
}

function usePayjoinReceiver({
  accountId,
  account,
  address,
  amountSats,
  board,
  label,
  utxos,
  signPsbt
}: UsePayjoinReceiverParams) {
  const payjoinEnabled = useSettingsStore((s) => s.payjoinEnabled)
  const payjoinCoordinationMode = useSettingsStore(
    (s) => s.payjoinCoordinationMode
  )
  const networkName = useBlockchainStore((s) => s.selectedNetwork)
  const [session, setSession] = useState<PayjoinSession | null>(() => {
    const existing = usePayjoinSessionsStore
      .getState()
      .getActiveReceiverSession(accountId)
    if (existing && existing.expiresAt > Date.now()) {
      return existing
    }
    return null
  })
  const [negotiating, setNegotiating] = useState(false)
  const [starting, setStarting] = useState(false)
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null)

  const pollingRef = useRef(false)
  const startingRef = useRef(false)
  const startingStartedAtRef = useRef(0)
  const sessionRef = useRef<PayjoinSession | null>(session)
  const paramsRef = useRef({
    account,
    accountId,
    address,
    amountSats,
    board,
    canUsePayjoin: false,
    label,
    networkName,
    signPsbt,
    utxos
  })

  const canContribute = walletCanContributeToPayjoin(
    utxos,
    account?.transactions ?? []
  )
  // Directory mailbox path only. Manual (offline) coordination uses a separate
  // import/export UI and must not mint or poll directory sessions.
  // Board receives contribute no inputs, so the onchain-wallet gating
  // (singlesig policy + spendable utxos) does not apply to them.
  const canUsePayjoin =
    payjoinEnabled &&
    payjoinCoordinationMode === 'directory' &&
    isNativeAvailable() &&
    !!address &&
    (board ? true : account?.policyType === 'singlesig' && canContribute)

  paramsRef.current = {
    account,
    accountId,
    address,
    amountSats,
    board,
    canUsePayjoin,
    label,
    networkName,
    signPsbt,
    utxos
  }

  function setReceiverSession(next: PayjoinSession | null) {
    sessionRef.current = next
    setSession(next)
  }

  function persistSession(base: PayjoinSession) {
    const synced = withReceiverSessionBip21Params(base, {
      amountSats: paramsRef.current.amountSats,
      label: paramsRef.current.label
    })
    usePayjoinSessionsStore.getState().upsertSession(synced)
    sessionRef.current = synced
    return synced
  }

  function buildCallbacks() {
    const {
      account: currentAccount,
      address: currentAddress,
      networkName: currentNetwork,
      signPsbt: currentSignPsbt,
      utxos: currentUtxos
    } = paramsRef.current
    const store = usePayjoinSessionsStore.getState()
    return buildPayjoinWalletCallbacks({
      hasSeenInput: (outpoint) => store.hasSeenInput(outpoint),
      markInputSeen: (outpoint) => store.markInputSeen(outpoint),
      network: bitcoinjsNetwork(currentNetwork),
      ownedAddresses: [
        ...(currentAccount?.addresses ?? []).map((entry) => entry.address),
        currentAddress
      ].filter((value): value is string => !!value),
      signPsbt: (psbtBase64) => {
        if (!currentSignPsbt) {
          return psbtBase64
        }
        return currentSignPsbt(psbtBase64)
      },
      transactions: currentAccount?.transactions ?? [],
      utxos: currentUtxos
    })
  }

  async function createFreshSession() {
    const { accountId: id, address: receiveAddress } = paramsRef.current
    if (!receiveAddress) {
      return null
    }
    clearReceiverSessionsForAccount(id)
    const created = await createReceivePayjoinSession({
      accountId: id,
      address: receiveAddress,
      amountSats: paramsRef.current.amountSats,
      board: paramsRef.current.board,
      label: paramsRef.current.label,
      ttlMs: getPayjoinSessionTtlMs()
    })
    setReceiverSession(created)
    return created
  }

  async function startSession() {
    const {
      accountId: id,
      address: receiveAddress,
      canUsePayjoin: armed
    } = paramsRef.current
    if (!armed || !receiveAddress) {
      return
    }
    if (startingRef.current) {
      if (Date.now() - startingStartedAtRef.current < START_SESSION_LOCK_MS) {
        return
      }
      payjoinWarn('clearing stale startSession lock')
      startingRef.current = false
    }
    startingRef.current = true
    startingStartedAtRef.current = Date.now()
    setStarting(true)

    try {
      const resolved = await resolveReceiverSessionOnStart({
        accountId: id,
        amountSats: paramsRef.current.amountSats,
        hydrated: sessionRef.current,
        label: paramsRef.current.label
      })
      if (resolved.kind === 'session') {
        setReceiverSession(resolved.session)
        return
      }
      await createFreshSession()
    } catch (error) {
      payjoinWarn('receiver startSession failed', {
        error: compactError(error)
      })
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }

  async function replaceDeadSession(
    failedSession: PayjoinSession | null,
    message: string
  ) {
    const expired = isMailboxExpiredError(message)
    payjoinWarn(
      expired
        ? 'receiver mailbox expired — creating a new QR'
        : 'receiver native session lost — creating a new QR',
      {
        error: compactError(message),
        mailbox: mailboxFromEndpoint(failedSession?.pjEndpoint),
        sessionId: failedSession?.id
      }
    )
    if (failedSession?.id) {
      usePayjoinSessionsStore.getState().removeSession(failedSession.id)
    }
    setReceiverSession(null)
    if (
      !paramsRef.current.canUsePayjoin ||
      !paramsRef.current.address ||
      startingRef.current
    ) {
      return
    }
    startingRef.current = true
    setStarting(true)
    try {
      await createFreshSession()
    } catch (error) {
      payjoinWarn('replaceDeadSession create failed', {
        error: compactError(error)
      })
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }

  async function finalizeOnce(target: PayjoinSession) {
    if (!target.originalPsbtBase64 || !target.nativeState) {
      payjoinWarn('receiver finalize skipped — missing state', {
        hasNative: !!target.nativeState,
        hasOriginal: !!target.originalPsbtBase64,
        mailbox: mailboxFromEndpoint(target.pjEndpoint),
        sessionId: target.id
      })
      return
    }
    setNegotiating(true)
    try {
      payjoinLog('receiver finalize', {
        board: !!target.board,
        mailbox: mailboxFromEndpoint(target.pjEndpoint),
        sessionId: target.id,
        status: target.status
      })
      const finalized = target.board
        ? await finalizeBoardReceiverPayjoin({ session: target })
        : await finalizeReceiverPayjoin({
            callbacks: buildCallbacks(),
            session: target
          })
      if (
        finalized.status === 'error' &&
        finalized.originalPsbtBase64 &&
        finalized.nativeState
      ) {
        const message = finalized.error ?? 'unknown'
        if (isTerminalFinalizeError(message)) {
          payjoinWarn('receiver finalize terminal error', {
            error: compactError(message),
            mailbox: mailboxFromEndpoint(target.pjEndpoint),
            sessionId: target.id
          })
          setReceiverSession(persistSession(finalized))
          setNegotiating(false)
          return
        }
        payjoinWarn('receiver finalize failed, will retry', {
          error: compactError(message),
          mailbox: mailboxFromEndpoint(target.pjEndpoint),
          sessionId: target.id
        })
        setReceiverSession(
          persistSession({
            ...finalized,
            status: 'proposal_received',
            updatedAt: Date.now()
          })
        )
        return
      }
      payjoinLog('receiver finalize done', {
        mailbox: mailboxFromEndpoint(finalized.pjEndpoint),
        sessionId: finalized.id,
        status: finalized.status
      })
      setReceiverSession(persistSession(finalized))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Thrown terminal errors (e.g. a board proposal whose txid is not
      // stable) can never succeed on retry — surface them instead of looping.
      if (isTerminalFinalizeError(message)) {
        payjoinWarn('receiver finalize terminal error', {
          error: compactError(message),
          mailbox: mailboxFromEndpoint(target.pjEndpoint),
          sessionId: target.id
        })
        setReceiverSession(
          persistSession({
            ...target,
            error: message,
            status: 'error',
            updatedAt: Date.now()
          })
        )
        return
      }
      payjoinWarn('receiver finalize failed, will retry', {
        error: compactError(message),
        mailbox: mailboxFromEndpoint(target.pjEndpoint),
        sessionId: target.id
      })
      setReceiverSession(
        persistSession({
          ...target,
          error: message,
          status: 'proposal_received',
          updatedAt: Date.now()
        })
      )
    } finally {
      if (!sessionNeedsFinalize(sessionRef.current ?? target)) {
        setNegotiating(false)
      }
    }
  }

  async function pollOnce() {
    const { current } = sessionRef
    if (
      !current?.nativeState ||
      pollingRef.current ||
      current.status === 'expired' ||
      current.status === 'completed' ||
      current.status === 'error'
    ) {
      return
    }

    if (isSenderPostInFlight()) {
      payjoinLog('receiver poll paused — sender posting', {
        mailbox: mailboxFromEndpoint(current.pjEndpoint),
        sessionId: current.id
      })
      return
    }

    pollingRef.current = true
    try {
      if (sessionNeedsFinalize(current)) {
        await finalizeOnce(current)
        return
      }

      payjoinLog('receiver poll', {
        mailbox: mailboxFromEndpoint(current.pjEndpoint),
        sessionId: current.id,
        status: current.status
      })
      const { session: updated, originalPsbtBase64 } =
        await pollReceiverSession({
          callbacks: buildCallbacks(),
          session: current
        })

      setLastPolledAt(Date.now())

      if (originalPsbtBase64 || updated.status === 'proposal_received') {
        payjoinLog('receiver got proposal', {
          mailbox: mailboxFromEndpoint(updated.pjEndpoint),
          psbtChars: originalPsbtBase64?.length ?? 0,
          sessionId: updated.id,
          status: updated.status
        })
      }

      if (updated.status === 'error') {
        const message = updated.error ?? 'payjoin poll error'
        if (shouldReplaceMailbox(message)) {
          await replaceDeadSession(updated, message)
          return
        }
        if (isNativeSessionMissingError(message)) {
          payjoinWarn('receiver native handle missing — try resume', {
            error: compactError(message),
            mailbox: mailboxFromEndpoint(current.pjEndpoint),
            sessionId: current.id
          })
          const resumed = await resumePersistedReceiverSession(current)
          if (resumed) {
            setReceiverSession(
              persistSession({
                ...current,
                error: undefined,
                status: 'waiting',
                updatedAt: Date.now()
              })
            )
            return
          }
          await replaceDeadSession(
            current,
            'receiver native session lost after restart'
          )
          return
        }
        setReceiverSession(
          persistSession({
            ...current,
            error: undefined,
            nativeState: updated.nativeState ?? current.nativeState,
            status: 'waiting',
            updatedAt: Date.now()
          })
        )
        payjoinWarn('receiver poll soft-error, still waiting', {
          error: compactError(message),
          mailbox: mailboxFromEndpoint(current.pjEndpoint),
          sessionId: current.id
        })
        return
      }

      const synced = persistSession(updated)
      if (originalPsbtBase64 && synced.status === 'proposal_received') {
        setReceiverSession(synced)
        await finalizeOnce(synced)
        return
      }

      const uriUnchanged = synced.uri === current.uri
      const statusUnchanged = synced.status === current.status
      if (!uriUnchanged || !statusUnchanged) {
        setReceiverSession(synced)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLastPolledAt(Date.now())
      const lower = message.toLowerCase()
      if (
        lower.includes('already has a proposal') ||
        lower.includes('finalize instead of polling')
      ) {
        const withProposal = persistSession({
          ...current,
          status: 'proposal_received',
          updatedAt: Date.now()
        })
        setReceiverSession(withProposal)
        await finalizeOnce(withProposal)
        return
      }
      if (shouldReplaceMailbox(message)) {
        await replaceDeadSession(current, message)
        return
      }
      if (isNativeSessionMissingError(message)) {
        payjoinWarn('receiver native handle missing — try resume', {
          error: compactError(message),
          mailbox: mailboxFromEndpoint(current.pjEndpoint),
          sessionId: current.id
        })
        const resumed = await resumePersistedReceiverSession(current)
        if (resumed) {
          setReceiverSession(
            persistSession({
              ...current,
              error: undefined,
              status: 'waiting',
              updatedAt: Date.now()
            })
          )
          return
        }
        await replaceDeadSession(
          current,
          'receiver native session lost after restart'
        )
        return
      }
      payjoinWarn('receiver poll failed, retrying later', {
        error: compactError(message),
        mailbox: mailboxFromEndpoint(current.pjEndpoint),
        sessionId: current.id
      })
    } finally {
      pollingRef.current = false
    }
  }

  // Keep account-card BIP21 fields in sync when amount/label change.
  // Must not write the sessions store during render — index TotalTransactions
  // (and other subscribers) are often still mounted under the stack.
  useEffect(() => {
    const { current } = sessionRef
    if (
      !current ||
      current.status === 'completed' ||
      current.status === 'expired'
    ) {
      return
    }
    const synced = withReceiverSessionBip21Params(current, {
      amountSats,
      label
    })
    if (synced === current) {
      return
    }
    usePayjoinSessionsStore.getState().upsertSession(synced)
    sessionRef.current = synced
    setSession(synced)
  }, [amountSats, label, session?.id])

  const pollKey = receiverPollEffectKey(
    resolveReceiverPollMode({
      canUsePayjoin,
      session: session ?? undefined
    })
  )
  const armKey =
    canUsePayjoin && address ? `${accountId}|${address}` : 'disarmed'

  // Arm / resume mailbox when Payjoin becomes usable for this address.
  useEffect(() => {
    if (armKey === 'disarmed') {
      return
    }
    void startSession()
  }, [armKey])

  // Poll + foreground resume while a live mailbox exists.
  useEffect(() => {
    if (pollKey === 'off') {
      return
    }
    if (pollKey.startsWith('restart:')) {
      void startSession()
      return
    }
    if (pollKey.startsWith('retry_poll:')) {
      void pollOnce()
      return
    }

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
  }, [pollKey])

  const livePayjoinUri =
    !!session?.uri &&
    !!session.nativeState &&
    session.status !== 'expired' &&
    session.status !== 'error' &&
    hasPayjoinParam(session.uri)
      ? session.uri
      : undefined

  const statusLabelKey = !canUsePayjoin
    ? null
    : session && isPayjoinSuccess(session.status)
      ? 'receive.payjoin.status.completed'
      : session && isPayjoinFallback(session.status)
        ? null
        : session?.status === 'expired'
          ? 'receive.payjoin.status.expired'
          : session?.status === 'error'
            ? 'receive.payjoin.status.unavailable'
            : negotiating ||
                session?.status === 'negotiating' ||
                session?.status === 'proposal_received' ||
                session?.status === 'finalizing'
              ? 'receive.payjoin.status.negotiating'
              : starting || !livePayjoinUri
                ? 'receive.payjoin.status.initializing'
                : session?.error
                  ? 'receive.payjoin.status.polling'
                  : session?.status === 'waiting'
                    ? 'receive.payjoin.status.waiting'
                    : 'receive.payjoin.status.ready'

  return {
    canContribute,
    canUsePayjoin,
    lastPolledAt,
    negotiating,
    payjoinUri: livePayjoinUri,
    polling: pollingRef.current,
    restartSession: startSession,
    session,
    starting,
    statusLabelKey
  }
}

export { usePayjoinReceiver }
export { walletCanContributeToPayjoin } from '@/utils/payjoinUtxos'
