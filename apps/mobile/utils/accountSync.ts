import { MIN_USABLE_CHECKPOINT_HEIGHT } from '@/constants/sync'

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

export { shouldFullScan }
export type { AccountSyncHistory, ShouldFullScanParams, SyncCheckpoint }
