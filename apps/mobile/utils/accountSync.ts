import {
  MIN_USABLE_CHECKPOINT_HEIGHT,
  SYNC_STALL_TIMEOUT_MS,
  SYNC_STALL_TIMEOUT_RPC_MS,
  SYNC_STALL_TIMEOUT_TOR_MS
} from '@/constants/sync'
import { type Account } from '@/types/models/Account'
import { type Server } from '@/types/settings/blockchain'
import { isOnionUrl } from '@/utils/serverPrivacy'

type SyncCheckpoint =
  | {
      height: number
    }
  | null
  | undefined

type AccountSyncHistory = {
  addresses: readonly unknown[]
  transactions: readonly unknown[]
}

type ShouldFullScanParams = {
  account: AccountSyncHistory
  checkpoint: SyncCheckpoint
  forceFullScan: boolean
}

/**
 * Decide Electrum/Esplora full scan vs incremental catch-up.
 * Used by account sync before calling the BDK adapter. Backend/URL/proxy
 * switches stay incremental when the account already has history.
 */
function shouldFullScan({
  account,
  checkpoint,
  forceFullScan
}: ShouldFullScanParams): boolean {
  if (forceFullScan) {
    return true
  }

  const hasHistory =
    account.transactions.length > 0 || account.addresses.length > 0
  if (hasHistory) {
    return false
  }

  if (!checkpoint) {
    return true
  }

  return checkpoint.height < MIN_USABLE_CHECKPOINT_HEIGHT
}

type TransactionHistoryLoadingParams = {
  refreshing: boolean
  syncStatus?: Account['syncStatus']
}

/**
 * Whether the account transaction history may still be arriving.
 * Used by the account activity list so an empty list during a sync reads as
 * loading instead of "No transactions".
 */
function isTransactionHistoryLoading({
  refreshing,
  syncStatus
}: TransactionHistoryLoadingParams): boolean {
  return refreshing || syncStatus === 'syncing' || syncStatus === 'queued'
}

/** How long a sync against this server may go without progress. */
function getSyncStallTimeoutMs(server: Pick<Server, 'backend' | 'url'>) {
  if (server.backend === 'rpc') {
    return SYNC_STALL_TIMEOUT_RPC_MS
  }
  return isOnionUrl(server.url)
    ? SYNC_STALL_TIMEOUT_TOR_MS
    : SYNC_STALL_TIMEOUT_MS
}

const IN_FLIGHT_SYNC_STATUSES = new Set<Account['syncStatus']>([
  'queued',
  'syncing',
  'timeout'
])

/**
 * A sync cannot still be running when the account is loaded from disk, so a
 * stored in-flight status falls back to what the last finished sync left.
 */
function toRestoredSyncStatus(
  syncStatus: Account['syncStatus'],
  lastSyncedAt: Account['lastSyncedAt']
): Account['syncStatus'] {
  if (!IN_FLIGHT_SYNC_STATUSES.has(syncStatus)) {
    return syncStatus
  }
  return lastSyncedAt ? 'synced' : 'unsynced'
}

export {
  getSyncStallTimeoutMs,
  isTransactionHistoryLoading,
  shouldFullScan,
  toRestoredSyncStatus
}
export type { AccountSyncHistory }
