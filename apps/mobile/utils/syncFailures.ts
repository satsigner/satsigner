import { ElectrumUnreachableError } from '@/api/electrumReachability'
import { SYNC_FAILURE_TOAST_LIMIT } from '@/constants/sync'
import { MS_PER_MINUTE } from '@/constants/time'
import { t } from '@/locales'
import { SyncTimeoutError } from '@/services/syncQueue'

export type SyncFailure = {
  accountName: string
  error: unknown
}

type FailureCause = {
  key: string
  reason: string
  server?: string
}

export type SyncFailureNotice =
  | { accountName: string; kind: 'account'; reason: string; server?: string }
  | { count: number; kind: 'accounts'; reason: string; server?: string }

function failureCause(error: unknown): FailureCause {
  if (error instanceof ElectrumUnreachableError) {
    return {
      key: `unreachable:${error.server}`,
      reason: error.message,
      server: error.server
    }
  }
  if (error instanceof SyncTimeoutError) {
    const minutes = Math.round(error.timeoutMs / MS_PER_MINUTE)
    return {
      key: `stalled:${minutes}`,
      reason: t('account.sync.stalled', { minutes })
    }
  }
  const reason = error instanceof Error ? error.message : String(error)
  return { key: `error:${reason}`, reason }
}

/**
 * Groups sync failures by cause. A cause shared by more than
 * SYNC_FAILURE_TOAST_LIMIT accounts becomes one notice, since one dead server
 * fails every account that uses it; smaller groups keep a notice per account.
 */
export function summarizeSyncFailures(
  failures: SyncFailure[]
): SyncFailureNotice[] {
  const groups = new Map<
    string,
    { accountNames: string[]; cause: FailureCause }
  >()
  for (const { accountName, error } of failures) {
    const cause = failureCause(error)
    const group = groups.get(cause.key) ?? { accountNames: [], cause }
    if (!group.accountNames.includes(accountName)) {
      group.accountNames.push(accountName)
    }
    groups.set(cause.key, group)
  }
  return [...groups.values()].flatMap(
    ({ accountNames, cause }): SyncFailureNotice[] => {
      if (accountNames.length > SYNC_FAILURE_TOAST_LIMIT) {
        return [
          {
            count: accountNames.length,
            kind: 'accounts',
            reason: cause.reason,
            server: cause.server
          }
        ]
      }
      return accountNames.map((accountName) => ({
        accountName,
        kind: 'account',
        reason: cause.reason,
        server: cause.server
      }))
    }
  )
}
