import { ECASH_PAYMENT_ERROR_I18N_KEYS } from '@/constants/ecash'
import { t } from '@/locales'
import type { EcashPaymentError } from '@/services/ecash/lightningPayment'

/** Localized message for a Lightning payment that could not be routed. */
function toPaymentErrorMessage(error: EcashPaymentError) {
  if (error.reason === 'mppPartialPayment') {
    return t('ecash.error.mppPartialPayment', {
      settled: error.settled,
      total: error.total
    })
  }
  return t(ECASH_PAYMENT_ERROR_I18N_KEYS[error.reason])
}

export { toPaymentErrorMessage }
