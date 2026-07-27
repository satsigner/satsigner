import {
  resumePersistedReceiverSession,
  tryResumeReceiverSession
} from '@/api/payjoin'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { type PayjoinSession } from '@/types/payjoin'
import { receiverNativeStateIsDurable } from '@/utils/payjoinReceiverState'
import { withReceiverSessionBip21Params } from '@/utils/payjoinSessionParams'

type ReceiverStartBip21 = {
  amountSats?: number
  label?: string
}

type ReceiverStartResult =
  | { kind: 'session'; session: PayjoinSession }
  | { kind: 'create_fresh' }

function applyBip21(
  session: PayjoinSession,
  bip21: ReceiverStartBip21
): PayjoinSession {
  const synced = withReceiverSessionBip21Params(session, bip21)
  usePayjoinSessionsStore.getState().upsertSession(synced)
  return synced
}

async function recoverErrorOrExpiredSession(
  hydrated: PayjoinSession,
  bip21: ReceiverStartBip21
): Promise<PayjoinSession | null> {
  if (hydrated.status !== 'error' && hydrated.status !== 'expired') {
    return null
  }
  if (
    hydrated.status !== 'error' ||
    !hydrated.nativeState ||
    hydrated.expiresAt <= Date.now()
  ) {
    return null
  }

  if (hydrated.originalPsbtBase64) {
    return applyBip21(
      {
        ...hydrated,
        error: undefined,
        status: 'proposal_received',
        updatedAt: Date.now()
      },
      bip21
    )
  }

  const softOk = await resumePersistedReceiverSession(hydrated)
  if (!softOk) {
    return null
  }

  return applyBip21(
    {
      ...hydrated,
      error: undefined,
      status: 'waiting',
      updatedAt: Date.now()
    },
    bip21
  )
}

/**
 * Resume or soft-keep an active receiver mailbox. Returns create_fresh only
 * when there is no usable session left (never mint just because address drifted).
 */
async function resolveReceiverSessionOnStart(params: {
  accountId: string
  hydrated: PayjoinSession | null
  amountSats?: number
  label?: string
}): Promise<ReceiverStartResult> {
  const { accountId, amountSats, hydrated, label } = params
  const bip21 = { amountSats, label }

  if (
    hydrated &&
    hydrated.accountId === accountId &&
    (hydrated.status === 'error' || hydrated.status === 'expired')
  ) {
    const recovered = await recoverErrorOrExpiredSession(hydrated, bip21)
    if (recovered) {
      return { kind: 'session', session: recovered }
    }
    return { kind: 'create_fresh' }
  }

  const existing = usePayjoinSessionsStore
    .getState()
    .getActiveReceiverSession(accountId)
  if (!existing || existing.expiresAt <= Date.now()) {
    return { kind: 'create_fresh' }
  }

  const resumed = await tryResumeReceiverSession(existing)
  if (resumed) {
    return { kind: 'session', session: applyBip21(resumed, bip21) }
  }

  // Soft-keep only durable event-log blobs (Metro reload / brief native miss).
  // Legacy id-only nativeState cannot rehydrate after process death — minting
  // fresh avoids an infinite "session not found" poll loop on a dead mailbox.
  const kept = usePayjoinSessionsStore.getState().getSession(existing.id)
  if (
    kept &&
    kept.expiresAt > Date.now() &&
    receiverNativeStateIsDurable(kept.nativeState)
  ) {
    return { kind: 'session', session: applyBip21(kept, bip21) }
  }

  return { kind: 'create_fresh' }
}

export { resolveReceiverSessionOnStart }
export type { ReceiverStartResult }
