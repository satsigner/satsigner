import { ECASH_PAYMENT_ERROR_I18N_KEYS } from '@/constants/ecash'
import { t } from '@/locales'
import type { EcashPaymentFailure } from '@/types/models/Ecash'

/** Localized message for a Lightning payment that could not be routed. */
function toPaymentErrorMessage(failure: EcashPaymentFailure) {
  if (failure.reason === 'mppPartialPayment') {
    return t('ecash.error.mppPartialPayment', {
      settled: failure.settled,
      total: failure.total
    })
  }
  return t(ECASH_PAYMENT_ERROR_I18N_KEYS[failure.reason])
}

export { toPaymentErrorMessage }
