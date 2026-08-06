import { type PayjoinSession } from '@/types/payjoin'
import { isPayjoinTerminal } from '@/utils/payjoinSessionStatus'

export type ReceiverPollMode =
  | { kind: 'off' }
  | { kind: 'restart'; sessionId: string }
  | { kind: 'retry_poll'; sessionId: string }
  | { kind: 'poll'; sessionId: string }

export function resolveReceiverPollMode(params: {
  canUsePayjoin: boolean
  session: PayjoinSession | undefined
}): ReceiverPollMode {
  const { canUsePayjoin, session } = params
  if (!canUsePayjoin || !session) {
    return { kind: 'off' }
  }
  if (
    session.status === 'fallback' ||
    session.status === 'cancelled' ||
    session.status === 'expired' ||
    session.status === 'completed'
  ) {
    return { kind: 'off' }
  }
  if (session.status === 'error') {
    if (session.originalPsbtBase64 && session.nativeState) {
      return { kind: 'retry_poll', sessionId: session.id }
    }
    return { kind: 'off' }
  }
  if (isPayjoinTerminal(session.status)) {
    return { kind: 'off' }
  }
  if (!session.nativeState) {
    return { kind: 'restart', sessionId: session.id }
  }
  return { kind: 'poll', sessionId: session.id }
}

export function receiverPollEffectKey(mode: ReceiverPollMode): string {
  if (mode.kind === 'off') {
    return 'off'
  }
  return `${mode.kind}:${mode.sessionId}`
}
