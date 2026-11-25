import { MS_PER_SECOND } from '@/constants/time'
import { t } from '@/locales'
import type { Account, SyncProgress } from '@/types/models/Account'
import { formatRelativeTime } from '@/utils/date'

// A last-sync time this far past the clock is not trusted.
const CLOCK_SKEW_TOLERANCE_MS = 60_000

type SyncProgressLabelParams = Partial<
  Pick<SyncProgress, 'scope' | 'tasksDone' | 'totalTasks' | 'unit'>
>

/** Toolbar copy for a running sync: addresses checked or blocks scanned. */
function syncProgressLabel({
  tasksDone,
  totalTasks,
  unit
}: SyncProgressLabelParams): string {
  if (tasksDone === undefined || totalTasks === undefined || totalTasks === 0) {
    return t('account.syncing')
  }
  if (unit === 'addresses') {
    // Padding the count to the total's digits keeps the label one width,
    // so the sync ticker doesn't resize as it counts up.
    const total = String(totalTasks)
    return t('account.syncProgressAddresses', {
      current: String(tasksDone).padStart(total.length, '0'),
      total
    })
  }
  const pct = Math.min(100, Math.round((tasksDone / totalTasks) * 100))
  return t('account.syncProgressBlocks', {
    current: tasksDone.toLocaleString(),
    pct,
    tip: totalTasks.toLocaleString()
  })
}

function syncScopeLabel(scope: SyncProgress['scope']): string | null {
  if (!scope) {
    return null
  }
  return t(`account.sync.check.${scope}`)
}

/** Labels the sync toolbar rotates through while a sync runs. */
function syncTickerLabels(progress: SyncProgressLabelParams): string[] {
  const scopeLabel = syncScopeLabel(progress.scope)
  const progressLabel = syncProgressLabel(progress)
  return scopeLabel ? [progressLabel, scopeLabel] : [progressLabel]
}

function relativeTimeLabel(timeMs: number) {
  // formatRelativeTime wraps chart labels in parentheses — strip for prose.
  return formatRelativeTime(Math.floor(timeMs / MS_PER_SECOND)).replaceAll(
    /^\(|\)$/g,
    ''
  )
}

/** "Last synced 2 days ago", or why there is no such time. */
function lastSyncedLabel(
  lastSyncedAt: Account['lastSyncedAt'],
  nowMs: number
): string {
  if (!lastSyncedAt) {
    return t('account.neverSynced')
  }
  const syncedMs = new Date(lastSyncedAt).getTime()
  if (Number.isNaN(syncedMs) || syncedMs > nowMs + CLOCK_SKEW_TOLERANCE_MS) {
    return t('account.sync.status.unsynced')
  }
  return t('account.lastSynced', { time: relativeTimeLabel(syncedMs) })
}

/** "Last full check 3 days ago" for the sync details. */
function lastFullCheckLabel(
  lastFullCheckAt: Account['lastFullCheckAt'],
  nowMs: number
): string {
  const syncedMs = lastFullCheckAt
    ? new Date(lastFullCheckAt).getTime()
    : Number.NaN
  if (Number.isNaN(syncedMs) || syncedMs > nowMs + CLOCK_SKEW_TOLERANCE_MS) {
    return t('account.sync.details.neverFullCheck')
  }
  return t('account.sync.details.lastFullCheck', {
    time: relativeTimeLabel(syncedMs)
  })
}

export {
  lastFullCheckLabel,
  lastSyncedLabel,
  syncProgressLabel,
  syncTickerLabels
}
