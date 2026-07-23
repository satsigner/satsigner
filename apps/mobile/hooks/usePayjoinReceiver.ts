import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { isNativeAvailable } from 'react-native-payjoin'

import {
  clearReceiverSessionsForAccount,
  createReceivePayjoinSession,
  finalizeReceiverPayjoin,
  isSenderPostInFlight,
  pollReceiverSession,
  resumePersistedReceiverSession,
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
import {
  compactError,
  mailboxFromEndpoint,
  payjoinLog,
  payjoinWarn
} from '@/utils/payjoinLog'
import { withReceiverSessionBip21Params } from '@/utils/payjoinSessionParams'
import { hasPayjoinParam } from '@/utils/payjoinUri'
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

const RECEIVER_POLL_INTERVAL_MS = 8_000

function walletCanContributeToPayjoin(utxos: Utxo[]): boolean {
  return utxos.some((utxo) => utxo.value > PAYJOIN_MIN_CONTRIBUTE_SATS)
}

/** Directory/PDK mailbox TTL elapsed — old pj= is dead; a new QR is required. */
function isMailboxExpiredError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('session expired') ||
    (lower.includes('protocol error') && lower.includes('expired'))
  )
}

/**
 * Native in-memory handle is gone (Metro reload / process death). The mailbox
 * may still be valid — do NOT auto-mint a new QR (that orphans a waiting sender).
 */
function isNativeSessionMissingError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('receiver session not found') ||
    lower.includes('missing ohttp') ||
    (lower.includes('recreate') && !lower.includes('proposal')) ||
    lower.includes('session gone')
  )
}

/** Only protocol mailbox expiry requires a new pj= URI. */
function shouldReplaceMailbox(message: string): boolean {
  return isMailboxExpiredError(message)
}

function sessionNeedsFinalize(session: PayjoinSession): boolean {
  // originalPsbt alone is enough — a soft-error / startSession resume used to
  // downgrade proposal_received → waiting and then we polled forever.
  if (
    !!session.originalPsbtBase64 &&
    session.status !== 'completed' &&
    session.status !== 'expired' &&
    session.status !== 'fallback'
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
  label,
  utxos,
  signPsbt
}: UsePayjoinReceiverParams) {
  const payjoinEnabled = useSettingsStore((s) => s.payjoinEnabled)
  const networkName = useBlockchainStore((s) => s.network)
  const [session, setSession] = useState<PayjoinSession | null>(() => {
    // Hydrate so the QR can show `pj=` immediately on remount / toggle-on.
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
  // Do not mirror every poll in React state — setPolling(true/false) every few
  // seconds re-rendered the whole receive screen while native HTTP blocked JS.
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null)
  const pollingRef = useRef(false)
  const startingRef = useRef(false)
  const startingStartedAtRef = useRef(0)
  const sessionRef = useRef<PayjoinSession | null>(session)
  const amountSatsRef = useRef(amountSats)
  const labelRef = useRef(label)
  amountSatsRef.current = amountSats
  labelRef.current = label

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
      amountSats: amountSatsRef.current,
      label: labelRef.current
    })
    setSession(created)
    sessionRef.current = created
    return created
  }, [accountId, address])

  const startSession = useCallback(async () => {
    if (!canUsePayjoin || !address) {
      // Keep the last URI on screen while Payjoin is toggled off — clearing here
      // made the QR snap back to a plain address and look like the toggle failed.
      return
    }
    if (startingRef.current) {
      // Fast refresh / thrown poll handlers can leave the lock stuck and the UI
      // on "Starting Payjoin session…" forever.
      if (Date.now() - startingStartedAtRef.current < 45_000) {
        return
      }
      payjoinWarn('clearing stale startSession lock')
      startingRef.current = false
    }
    startingRef.current = true
    startingStartedAtRef.current = Date.now()
    setStarting(true)

    try {
      const amountSatsNow = amountSatsRef.current
      const labelNow = labelRef.current
      const store = usePayjoinSessionsStore.getState()

      // Error/expired on the hydrated ref: soft-resume first so Metro reload
      // does not mint a new pj= and orphan a sender already waiting.
      // (getActiveReceiverSession excludes error/expired.)
      const hydrated = sessionRef.current
      if (
        hydrated &&
        hydrated.accountId === accountId &&
        (hydrated.status === 'error' || hydrated.status === 'expired')
      ) {
        if (
          hydrated.status === 'error' &&
          hydrated.nativeState &&
          hydrated.expiresAt > Date.now()
        ) {
          if (hydrated.originalPsbtBase64) {
            const restored = withReceiverSessionBip21Params(
              {
                ...hydrated,
                error: undefined,
                status: 'proposal_received',
                updatedAt: Date.now()
              },
              {
                amountSats: amountSatsNow,
                label: labelNow
              }
            )
            store.upsertSession(restored)
            setSession(restored)
            sessionRef.current = restored
            return
          }
          const softOk = await resumePersistedReceiverSession(hydrated)
          if (softOk) {
            const restored = withReceiverSessionBip21Params(
              {
                ...hydrated,
                error: undefined,
                status: 'waiting',
                updatedAt: Date.now()
              },
              {
                amountSats: amountSatsNow,
                label: labelNow
              }
            )
            store.upsertSession(restored)
            setSession(restored)
            sessionRef.current = restored
            return
          }
        }
        await createFreshSession()
        return
      }

      const existing = store.getActiveReceiverSession(accountId)

      // Prefer the active mailbox for this account — even if the unused-address
      // picker drifted (e.g. "generate another" then leave/reopen from the card).
      // Matching on address alone used to mint a new pj= on every status check.
      if (existing && existing.expiresAt > Date.now()) {
        const resumed = await tryResumeReceiverSession(existing)
        if (resumed) {
          const synced = withReceiverSessionBip21Params(resumed, {
            amountSats: amountSatsNow,
            label: labelNow
          })
          usePayjoinSessionsStore.getState().upsertSession(synced)
          setSession(synced)
          sessionRef.current = synced
          return
        }

        // Native resume failed but JS session kept (mailbox may still be live).
        // Soft-keep the same pj= — do not mint a replacement QR.
        const kept = usePayjoinSessionsStore.getState().getSession(existing.id)
        if (kept && kept.expiresAt > Date.now()) {
          const synced = withReceiverSessionBip21Params(kept, {
            amountSats: amountSatsNow,
            label: labelNow
          })
          usePayjoinSessionsStore.getState().upsertSession(synced)
          setSession(synced)
          sessionRef.current = synced
          return
        }

        // nativeState was missing — tryResume removed the dead session.
        await createFreshSession()
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
  }, [accountId, address, canUsePayjoin, createFreshSession])

  const replaceDeadSession = useCallback(
    async (failedSession: PayjoinSession | null, message: string) => {
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
      sessionRef.current = null
      setSession(null)
      // Mailbox is unusable either way — mint a fresh URI so Receive does not
      // look empty when the user returns. Sender must re-scan if they already had
      // the old pj=.
      if (!canUsePayjoin || !address || startingRef.current) {
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
    },
    [address, canUsePayjoin, createFreshSession]
  )

  const persistSession = useCallback((base: PayjoinSession) => {
    const synced = withReceiverSessionBip21Params(base, {
      amountSats: amountSatsRef.current,
      label: labelRef.current
    })
    usePayjoinSessionsStore.getState().upsertSession(synced)
    sessionRef.current = synced
    return synced
  }, [])

  const finalizeOnce = useCallback(
    async (session: PayjoinSession) => {
      if (!session.originalPsbtBase64 || !session.nativeState) {
        payjoinWarn('receiver finalize skipped — missing state', {
          hasNative: !!session.nativeState,
          hasOriginal: !!session.originalPsbtBase64,
          mailbox: mailboxFromEndpoint(session.pjEndpoint),
          sessionId: session.id
        })
        return
      }
      setNegotiating(true)
      try {
        payjoinLog('receiver finalize', {
          mailbox: mailboxFromEndpoint(session.pjEndpoint),
          sessionId: session.id,
          status: session.status
        })
        const finalized = await finalizeReceiverPayjoin({
          callbacks: buildCallbacks(),
          session
        })
        // Non-throwing errors (no utxos, etc.) used to set status=error, which
        // triggered startSession → waiting and abandoned the proposal.
        if (
          finalized.status === 'error' &&
          finalized.originalPsbtBase64 &&
          finalized.nativeState
        ) {
          const message = finalized.error ?? 'unknown'
          // Terminal contribute failures — retrying will never help.
          if (
            /no utxos to contribute|missing proposal state|missing directory post/i.test(
              message
            )
          ) {
            payjoinWarn('receiver finalize terminal error', {
              error: compactError(message),
              mailbox: mailboxFromEndpoint(session.pjEndpoint),
              sessionId: session.id
            })
            setSession(persistSession(finalized))
            setNegotiating(false)
            return
          }
          payjoinWarn('receiver finalize failed, will retry', {
            error: compactError(message),
            mailbox: mailboxFromEndpoint(session.pjEndpoint),
            sessionId: session.id
          })
          setSession(
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
        setSession(persistSession(finalized))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // Keep proposal state so the next tick retries finalize — do not renew.
        payjoinWarn('receiver finalize failed, will retry', {
          error: compactError(message),
          mailbox: mailboxFromEndpoint(session.pjEndpoint),
          sessionId: session.id
        })
        setSession(
          persistSession({
            ...session,
            error: message,
            status: 'proposal_received',
            updatedAt: Date.now()
          })
        )
      } finally {
        // Keep negotiating=true (and the receive spinner) while a proposal is
        // still pending finalize — clearing here made the loader flicker off.
        if (!sessionNeedsFinalize(sessionRef.current ?? session)) {
          setNegotiating(false)
        }
      }
    },
    [buildCallbacks, persistSession]
  )

  const pollOnce = useCallback(async () => {
    const current = sessionRef.current
    if (
      !current?.nativeState ||
      pollingRef.current ||
      current.status === 'expired' ||
      current.status === 'completed' ||
      current.status === 'error'
    ) {
      return
    }

    // Same-device Sample→Clown: leave the mailbox free while sender POSTs.
    if (isSenderPostInFlight()) {
      payjoinLog('receiver poll paused — sender posting', {
        mailbox: mailboxFromEndpoint(current.pjEndpoint),
        sessionId: current.id
      })
      return
    }

    pollingRef.current = true
    try {
      // Already holding the original — finalize; never poll (Rust errors and we
      // used to wrongly renew the mailbox the sender is posting to).
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
          // Keep the same pj= URI — resume in-memory handle after Metro reload.
          // Do NOT mark status=error (that stops polling and orphans the sender).
          payjoinWarn('receiver native handle missing — try resume', {
            error: compactError(message),
            mailbox: mailboxFromEndpoint(current.pjEndpoint),
            sessionId: current.id
          })
          const resumed = await resumePersistedReceiverSession(current)
          if (resumed) {
            setSession(
              persistSession({
                ...current,
                error: undefined,
                status: 'waiting',
                updatedAt: Date.now()
              })
            )
            return
          }
          setSession(
            persistSession({
              ...current,
              error: message,
              status: 'waiting',
              updatedAt: Date.now()
            })
          )
          return
        }
        // Transient protocol/network errors (incl. OHTTP AEAD): same mailbox.
        // Always update React — skipping setSession left the UI stuck on error.
        setSession(
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
        setSession(synced)
        await finalizeOnce(synced)
        return
      }

      // Pending mailbox check: persist native state without remounting receive UI
      // when the BIP21 URI / status the user sees did not change.
      const uriUnchanged = synced.uri === current.uri
      const statusUnchanged = synced.status === current.status
      if (!uriUnchanged || !statusUnchanged) {
        setSession(synced)
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
        setSession(withProposal)
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
          setSession(
            persistSession({
              ...current,
              error: undefined,
              status: 'waiting',
              updatedAt: Date.now()
            })
          )
          return
        }
        setSession(
          persistSession({
            ...current,
            error: message,
            status: 'waiting',
            updatedAt: Date.now()
          })
        )
        return
      }
      // Keep waiting — e.g. HTTP/2 SETTINGS preface / relay blips.
      payjoinWarn('receiver poll failed, retrying later', {
        error: compactError(message),
        mailbox: mailboxFromEndpoint(current.pjEndpoint),
        sessionId: current.id
      })
    } finally {
      pollingRef.current = false
    }
  }, [buildCallbacks, finalizeOnce, persistSession, replaceDeadSession])

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Session often starts before the user types an amount. QR/copy rewrite BIP21
  // locally; persist into the store so the account card is not "--".
  useEffect(() => {
    const current = sessionRef.current
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

  useEffect(() => {
    // Start immediately when Payjoin is armed so the QR picks up `pj=` without
    // a false "ready" gap. Heavy OHTTP work still blocks briefly on sync UniFFI.
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

    // Recover from a prior "native missing → error" mark without minting a new QR.
    // If we already have the sender original, finalize — do not soft-resume to waiting.
    if (session.status === 'error') {
      if (session.originalPsbtBase64 && session.nativeState) {
        void pollOnce()
        return
      }
      void startSession()
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
  }, [canUsePayjoin, session?.id, session?.nativeState, session?.status, startSession])

  const livePayjoinUri =
    !!session?.uri &&
    !!session.nativeState &&
    session.status !== 'expired' &&
    session.status !== 'error' &&
    hasPayjoinParam(session.uri)
      ? session.uri
      : undefined

  // Check terminal statuses before "initializing" — a failed create used to set
  // status=error with a placeholder pj=, and excluding that from hasPayjoinUri
  // left the UI stuck on "Starting Payjoin session…".
  const statusLabelKey = !canUsePayjoin
    ? null
    : session?.status === 'completed'
      ? 'receive.payjoin.status.completed'
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
    // Prefer the session URI whenever it has pj= — the receive screen gates on
    // the Payjoin toggle. Requiring canUsePayjoin here hid pj= while address
    // / UTXO readiness briefly lagged behind an already-created session.
    payjoinUri: livePayjoinUri,
    /** True while a mailbox poll is in flight (ref — does not re-render). */
    polling: pollingRef.current,
    restartSession: startSession,
    session,
    starting,
    statusLabelKey
  }
}

export { usePayjoinReceiver, walletCanContributeToPayjoin }
