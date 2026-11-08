import { assertNever } from '@/utils/assertNever'
import { RequestTimeoutError } from '@/utils/errors'

type LndPayRail = 'lightning' | 'onchain'

/**
 * `sent` and `unknown` are terminal: a node that timed out may still pay, so
 * the screen must not offer another send in either.
 */
type LndPaySendState =
  | { status: 'idle' }
  | { status: 'sending'; rail: LndPayRail }
  | { status: 'sent'; rail: LndPayRail }
  | { status: 'unknown'; rail: LndPayRail }

type LndPaySendEvent =
  | { type: 'send'; rail: LndPayRail }
  | { type: 'succeeded' }
  | { type: 'failed'; outcomeUnknown: boolean }

const LND_PAY_SEND_IDLE: LndPaySendState = { status: 'idle' }

function transitionLndPaySend(
  state: LndPaySendState,
  event: LndPaySendEvent
): LndPaySendState {
  switch (event.type) {
    case 'send': {
      return state.status === 'idle'
        ? { rail: event.rail, status: 'sending' }
        : state
    }
    case 'succeeded': {
      return state.status === 'sending'
        ? { rail: state.rail, status: 'sent' }
        : state
    }
    case 'failed': {
      if (state.status !== 'sending') {
        return state
      }
      return event.outcomeUnknown
        ? { rail: state.rail, status: 'unknown' }
        : LND_PAY_SEND_IDLE
    }
    default: {
      return assertNever(event)
    }
  }
}

/** A timed-out request leaves the node free to finish the payment. */
function isLndPayOutcomeUnknown(error: unknown): boolean {
  return error instanceof RequestTimeoutError
}

export {
  isLndPayOutcomeUnknown,
  LND_PAY_SEND_IDLE,
  type LndPayRail,
  type LndPaySendState,
  transitionLndPaySend
}
