import { HTTP_STATUS } from '@/constants/http'
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

// A proxy in front of LND answers these while LND itself may still pay.
const GATEWAY_STATUSES = new Set<number>([
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  HTTP_STATUS.GATEWAY_TIMEOUT
])

function isAnswerFromLnd(error: unknown): boolean {
  if (error instanceof LndPaymentFailedError) {
    return true
  }
  return error instanceof HttpStatusError && !GATEWAY_STATUSES.has(error.status)
}

/** The payment request left, but no answer says whether it paid. */
class LndPayOutcomeUnknownError extends Error {
  override name = 'LndPayOutcomeUnknownError'
}

/**
 * Sends a payment request. LND keeps paying after a dropped connection, a
 * timeout or a gateway error, so any failure LND did not answer itself leaves
 * the outcome unknown and must not invite a second send.
 */
async function sendLndPayment<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send()
  } catch (error) {
    if (isAnswerFromLnd(error)) {
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
