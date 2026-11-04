import { toast } from 'sonner-native'

import { RESTORE_ROLLBACK_INCOMPLETE_TOAST_DURATION_MS } from '@/constants/backup'
import { t } from '@/locales'
import type { RecoverResult } from '@/utils/recoverBackup'

export function showRecoverResultToast(result: RecoverResult): void {
  if (result.success) {
    toast.success(t('settings.developer.recoverSuccess'))
    return
  }
  if (result.rollbackIncomplete) {
    toast.error(t('settings.developer.recoverRollbackIncomplete'), {
      duration: RESTORE_ROLLBACK_INCOMPLETE_TOAST_DURATION_MS
    })
    return
  }
  toast.error(t('settings.developer.recoverOverwriteError'))
}
