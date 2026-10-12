import { MIN_USABLE_CHECKPOINT_HEIGHT } from '@/constants/sync'
import { type Account } from '@/types/models/Account'

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
  return refreshing || syncStatus === 'syncing'
}

export { isTransactionHistoryLoading, shouldFullScan }
export type { AccountSyncHistory }
