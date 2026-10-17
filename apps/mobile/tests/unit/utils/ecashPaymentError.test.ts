import { EcashPaymentError } from '@/services/ecash/lightningPayment'
import { toPaymentErrorMessage } from '@/utils/ecashPaymentError'

jest.mock<typeof import('@/locales')>('@/locales', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key
}))

describe('toPaymentErrorMessage', () => {
  it.each([
    ['insufficientForFees', 'ecash.error.insufficientForFees'],
    ['insufficientProofs', 'ecash.error.insufficientProofs'],
    ['mintsLackMpp', 'ecash.error.mintsLackMpp']
  ] as const)('maps %s to its locale key', (reason, key) => {
    expect(toPaymentErrorMessage(new EcashPaymentError(reason))).toBe(key)
  })

  it('passes settled and total for a partial payment', () => {
    expect(
      toPaymentErrorMessage(
        new EcashPaymentError('mppPartialPayment', { settled: 1, total: 3 })
      )
    ).toBe('ecash.error.mppPartialPayment {"settled":1,"total":3}')
  })
})
