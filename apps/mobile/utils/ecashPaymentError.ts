import { t } from '@/locales'
import type { EcashPaymentError } from '@/services/ecash/lightningPayment'

const PAYMENT_ERROR_KEYS = {
  insufficientForFees: 'ecash.error.insufficientForFees',
  insufficientProofs: 'ecash.error.insufficientProofs',
  mintsLackMpp: 'ecash.error.mintsLackMpp'
} as const

/** Localized message for a Lightning payment that could not be routed. */
function toPaymentErrorMessage(error: EcashPaymentError) {
  if (error.reason === 'mppPartialPayment') {
    return t('ecash.error.mppPartialPayment', {
      settled: error.settled,
      total: error.total
    })
  }
  return t(PAYMENT_ERROR_KEYS[error.reason])
}

export { toPaymentErrorMessage }
