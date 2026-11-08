import { RequestTimeoutError } from '@/utils/errors'
import {
  isLndPayOutcomeUnknown,
  LND_PAY_SEND_IDLE,
  type LndPaySendState,
  transitionLndPaySend
} from '@/utils/lndPayMachine'

const SENDING: LndPaySendState = { rail: 'lightning', status: 'sending' }

describe('transitionLndPaySend', () => {
  it('starts a send from idle', () => {
    expect(
      transitionLndPaySend(LND_PAY_SEND_IDLE, { rail: 'onchain', type: 'send' })
    ).toStrictEqual({ rail: 'onchain', status: 'sending' })
  })

  it('ignores a second send while one is in flight', () => {
    expect(
      transitionLndPaySend(SENDING, { rail: 'lightning', type: 'send' })
    ).toBe(SENDING)
  })

  it('locks the screen once the payment succeeded', () => {
    const sent = transitionLndPaySend(SENDING, { type: 'succeeded' })

    expect(sent).toStrictEqual({ rail: 'lightning', status: 'sent' })
    expect(
      transitionLndPaySend(sent, { rail: 'lightning', type: 'send' })
    ).toBe(sent)
  })

  it('returns to idle after a failure the user can retry', () => {
    expect(
      transitionLndPaySend(SENDING, { outcomeUnknown: false, type: 'failed' })
    ).toBe(LND_PAY_SEND_IDLE)
  })

  it('locks the screen when the outcome is unknown', () => {
    const unknown = transitionLndPaySend(SENDING, {
      outcomeUnknown: true,
      type: 'failed'
    })

    expect(unknown).toStrictEqual({ rail: 'lightning', status: 'unknown' })
    expect(
      transitionLndPaySend(unknown, { rail: 'lightning', type: 'send' })
    ).toBe(unknown)
  })

  it('ignores results that arrive outside a send', () => {
    expect(transitionLndPaySend(LND_PAY_SEND_IDLE, { type: 'succeeded' })).toBe(
      LND_PAY_SEND_IDLE
    )
  })
})

describe('isLndPayOutcomeUnknown', () => {
  it('treats only a request timeout as an unknown outcome', () => {
    expect(isLndPayOutcomeUnknown(new RequestTimeoutError('timed out'))).toBe(
      true
    )
    expect(isLndPayOutcomeUnknown(new Error('no route'))).toBe(false)
  })
})
