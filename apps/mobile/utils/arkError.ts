import { t } from '@/locales'

// Thrown before an Ark wallet operation starts, while the same operation is
// still running for the account. Nothing was sent, so it is safe to retry.
export class ArkOperationBusyError extends Error {
  name = 'ArkOperationBusyError'

  constructor() {
    super(t('ark.error.operationStillRunning'))
  }
}
