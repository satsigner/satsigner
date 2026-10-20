import type { EcashPaymentFailure } from '@/types/models/Ecash'
import { toPaymentErrorMessage } from '@/utils/ecashPaymentError'

jest.mock<typeof import('@/locales')>('@/locales', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key
}))

const ROUTING_FAILURES: [EcashPaymentFailure, string][] = [
  [{ reason: 'insufficientForFees' }, 'ecash.error.insufficientForFees'],
  [{ reason: 'insufficientProofs' }, 'ecash.error.insufficientProofs'],
  [{ reason: 'mintsLackMpp' }, 'ecash.error.mintsLackMpp']
]

describe('toPaymentErrorMessage', () => {
  it.each(ROUTING_FAILURES)('maps %o to its locale key', (failure, key) => {
    expect(toPaymentErrorMessage(failure)).toBe(key)
  })

  it('passes settled and total for a partial payment', () => {
    expect(
      toPaymentErrorMessage({
        reason: 'mppPartialPayment',
        settled: 1,
        total: 3
      })
    ).toBe('ecash.error.mppPartialPayment {"settled":1,"total":3}')
  })
})
