import { assertNever } from '@/utils/assertNever'
import { HttpStatusError } from '@/utils/errors'
import { LndPaymentFailedError } from '@/utils/lndPayInvoice'

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

/** The payment request left, but no answer says whether it paid. */
class LndPayOutcomeUnknownError extends Error {
  override name = 'LndPayOutcomeUnknownError'
}

/**
 * Sends a payment request. LND keeps paying after a dropped connection or a
 * timeout, so any failure other than an HTTP error or a reported payment
 * failure leaves the outcome unknown and must not invite a second send.
 */
async function sendLndPayment<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send()
  } catch (error) {
    if (
      error instanceof HttpStatusError ||
      error instanceof LndPaymentFailedError
    ) {
      throw error
    }
    throw new LndPayOutcomeUnknownError('LND payment outcome unknown', {
      cause: error
    })
  }
}

function isLndPayOutcomeUnknown(error: unknown): boolean {
  return error instanceof LndPayOutcomeUnknownError
}

export {
  isLndPayOutcomeUnknown,
  sendLndPayment,
  LND_PAY_SEND_IDLE,
  type LndPayRail,
  type LndPaySendState,
  transitionLndPaySend
}
