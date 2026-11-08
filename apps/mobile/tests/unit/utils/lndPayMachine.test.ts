import { HttpStatusError, RequestTimeoutError } from '@/utils/errors'
import { LndPaymentFailedError } from '@/utils/lndPayInvoice'
import {
  isLndPayOutcomeUnknown,
  LND_PAY_SEND_IDLE,
  type LndPaySendState,
  sendLndPayment,
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

describe('sendLndPayment', () => {
  async function outcomeOf(failure: Error) {
    try {
      await sendLndPayment(() => {
        throw failure
      })
      return false
    } catch (error) {
      return isLndPayOutcomeUnknown(error)
    }
  }

  it('treats a timeout or a dropped connection as an unknown outcome', async () => {
    await expect(outcomeOf(new RequestTimeoutError('timed out'))).resolves.toBe(
      true
    )
    await expect(outcomeOf(new Error('socket closed'))).resolves.toBe(true)
  })

  it.each([502, 503, 504])(
    'treats a %d from a gateway as an unknown outcome',
    async (status) => {
      await expect(
        outcomeOf(new HttpStatusError(status, `LND API error: ${status}`))
      ).resolves.toBe(true)
    }
  )

  it('treats an answer from LND as a known failure', async () => {
    await expect(
      outcomeOf(new HttpStatusError(500, 'LND API error: 500'))
    ).resolves.toBe(false)
    await expect(
      outcomeOf(new LndPaymentFailedError('no route'))
    ).resolves.toBe(false)
  })
})
