import { t } from '@/locales'
import { type SyncProgress } from '@/types/models/Account'

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
    return t('account.syncProgressAddresses', {
      current: tasksDone.toLocaleString(),
      total: totalTasks.toLocaleString()
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

export { syncProgressLabel, syncScopeLabel, syncTickerLabels }
export type { SyncProgressLabelParams }
