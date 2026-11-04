import { toast } from 'sonner-native'

import { t } from '@/locales'
import {
  type SyncFailure,
  type SyncFailureNotice,
  summarizeSyncFailures
} from '@/utils/syncFailures'

export type SyncErrorReporter = (accountName: string, error: unknown) => void

function showNotice(notice: SyncFailureNotice): void {
  if (notice.server) {
    toast.error(
      t('account.sync.serverUnreachable', { server: notice.server }),
      {
        description:
          notice.kind === 'accounts'
            ? t('account.sync.accountsNotSynced', { count: notice.count })
            : t('account.sync.accountNotSynced', { name: notice.accountName })
      }
    )
    return
  }
  if (notice.kind === 'accounts') {
    toast.error(t('account.sync.accountsFailed', { count: notice.count }), {
      description: notice.reason
    })
    return
  }
  toast.error(`${notice.accountName}: ${t('account.syncFailed')}`, {
    description: notice.reason
  })
}

export function showSyncFailureToasts(failures: SyncFailure[]): void {
  for (const notice of summarizeSyncFailures(failures)) {
    showNotice(notice)
  }
}

/** Default reporter for a single account sync: one toast right away. */
export const reportSyncFailure: SyncErrorReporter = (accountName, error) => {
  showSyncFailureToasts([{ accountName, error }])
}

/**
 * Collects failures from a run of account syncs so they can be shown
 * together once the run ends, instead of one toast per account.
 */
export function createSyncFailureBatch() {
  const failures: SyncFailure[] = []
  const report: SyncErrorReporter = (accountName, error) => {
    failures.push({ accountName, error })
  }
  function flush(): void {
    showSyncFailureToasts(failures.splice(0))
  }
  return { flush, report }
}
