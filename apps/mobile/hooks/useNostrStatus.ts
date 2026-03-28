import { useEffect, useState } from 'react'

import { type NostrSyncStatus, useNostrStore } from '@/store/nostr'
import {
  nostrSyncService,
  type SyncStatusEvent
} from '@/utils/nostrSyncService'

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
    isConnecting: status.status === 'connecting',
    isError: status.status === 'error',
    isIdle: status.status === 'idle',
    isSyncing: status.status === 'syncing',
    lastError: status.lastError,
    lastSyncAt: status.lastSyncAt,
    messagesProcessed: status.messagesProcessed,
    messagesReceived: status.messagesReceived,
    status: status.status
  }
}

export { useNostrStatus }
export default useNostrStatus
