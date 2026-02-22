import { useEffect, useState } from 'react'

import { nostrSyncService, type SyncStatusEvent } from '@/services/nostr'
import { useNostrStore, type NostrSyncStatus } from '@/store/nostr'

/**
 * Read-only hook for accessing Nostr sync status for an account.
 * Subscribes to status change events from NostrSyncService.
 */
function useNostrStatus(accountId: string) {
  const storeStatus = useNostrStore((state) => state.getSyncStatus(accountId))
  const [status, setStatus] = useState<NostrSyncStatus>(storeStatus)

  useEffect(() => {
    // Update local state when store changes
    setStatus(storeStatus)
  }, [storeStatus])

  useEffect(() => {
    const handleStatusChange = (event: SyncStatusEvent) => {
      if (event.accountId === accountId) {
        setStatus(useNostrStore.getState().getSyncStatus(accountId))
      }
    }

    nostrSyncService.on('status', handleStatusChange)
    return () => {
      nostrSyncService.off('status', handleStatusChange)
    }
  }, [accountId])

  return {
    status: status.status,
    lastError: status.lastError,
    lastSyncAt: status.lastSyncAt,
    messagesReceived: status.messagesReceived,
    messagesProcessed: status.messagesProcessed,
    isConnecting: status.status === 'connecting',
    isSyncing: status.status === 'syncing',
    isError: status.status === 'error',
    isIdle: status.status === 'idle'
  }
}

export { useNostrStatus }
export default useNostrStatus
