import { toast } from 'sonner-native'

import { RESTORE_ROLLBACK_INCOMPLETE_TOAST_DURATION_MS } from '@/constants/backup'
import { t } from '@/locales'
import { showRecoverResultToast } from '@/utils/recoverToast'

const mockToastError = jest.mocked(toast.error)
const mockToastSuccess = jest.mocked(toast.success)

describe('showRecoverResultToast', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('confirms a successful restore', () => {
    showRecoverResultToast({ success: true })

    expect(mockToastSuccess).toHaveBeenCalledWith(
      t('settings.developer.recoverSuccess')
    )
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('reports a failed restore whose rollback succeeded', () => {
    showRecoverResultToast({ error: 'boom', success: false })

    expect(mockToastError).toHaveBeenCalledWith(
      t('settings.developer.recoverOverwriteError')
    )
  })

  it('keeps a distinct warning on screen when the rollback was incomplete', () => {
    showRecoverResultToast({
      error: 'boom',
      rollbackIncomplete: true,
      success: false
    })

    expect(mockToastError).toHaveBeenCalledWith(
      t('settings.developer.recoverRollbackIncomplete'),
      { duration: RESTORE_ROLLBACK_INCOMPLETE_TOAST_DURATION_MS }
    )
    expect(t('settings.developer.recoverRollbackIncomplete')).not.toBe(
      t('settings.developer.recoverOverwriteError')
    )
  })
})
