import { useCallback } from 'react'

import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import { decompressMessage } from '@/utils/nostr'

function nostrSyncLog(...args: unknown[]) {
  if (__DEV__) console.log('[NostrSync]', ...args)
}

import { deviceAnnouncementHandler } from './handlers/deviceAnnouncementHandler'
import { createDMHandler } from './handlers/dmHandler'
import {
  isInitialized,
  processMessage,
  registerHandler,
  setInitialized
} from './handlers/index'
import { labelsHandler } from './handlers/labelsHandler'
import { createPSBTHandler } from './handlers/psbtHandler'
import { signMessageHandler } from './handlers/signMessageHandler'
import { txHandler } from './handlers/txHandler'
import {
  type MessageHandlerContext,
  type NostrMessageData,
  type PendingDM,
  type UnwrappedNostrEvent
} from './types'
import { getSyncStartSeconds, useNostrDMStorage } from './useNostrDMStorage'

function getEventContent(
  unwrappedEvent: UnwrappedNostrEvent
): Record<string, unknown> {
  try {
    return JSON.parse(unwrappedEvent.content)
  } catch {}
  try {
    return decompressMessage(unwrappedEvent.content) as Record<string, unknown>
  } catch {}
  return unwrappedEvent.content as unknown as Record<string, unknown>
}

// Module-level pending DMs collector (shared across all hook instances)
let sharedPendingDms: PendingDM[] = []

function collectPendingDM(dm: PendingDM): void {
  sharedPendingDms.push(dm)
}

function clearPendingDms(): void {
  sharedPendingDms = []
}

function getPendingDms(): PendingDM[] {
  return sharedPendingDms
}

// Initialize handlers once at module level
function initializeHandlers(): void {
  if (isInitialized()) return
  setInitialized(true)

  // Register handlers in priority order
  registerHandler(labelsHandler)
  registerHandler(txHandler)
  registerHandler(createPSBTHandler(collectPendingDM))
  registerHandler(signMessageHandler)
  registerHandler(createDMHandler(collectPendingDM))
  registerHandler(deviceAnnouncementHandler)
}

// Initialize handlers immediately when module is imported
initializeHandlers()

function useNostrMessageProcessor() {
  const dmStorage = useNostrDMStorage()

  const processEventBatch = useCallback(
    async (
      account: Account,
      messages: { id: string; content: unknown; created_at: number }[]
    ): Promise<void> => {
      nostrSyncLog('processEventBatch start', messages.length, 'messages')
      clearPendingDms()

      const processedEvents = useNostrStore.getState().processedEvents
      const lastDataExchangeEOSE =
        useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0
      const syncStartSec = getSyncStartSeconds(account)

      const YIELD_EVERY = 5
      let processed = 0
      for (let i = 0; i < messages.length; i++) {
        if (i > 0 && i % YIELD_EVERY === 0) {
          await new Promise((r) => setTimeout(r, 0))
        }
        const msg = messages[i]
        const unwrappedEvent = msg.content as UnwrappedNostrEvent
        const accountProcessedEvents = processedEvents[account.id]
        if (accountProcessedEvents?.[unwrappedEvent.id]) continue

        useNostrStore
          .getState()
          .addProcessedEvent(account.id, unwrappedEvent.id)
        const eventContent = getEventContent(unwrappedEvent)

        const data = eventContent.data as NostrMessageData | undefined

        const context: MessageHandlerContext = {
          account,
          unwrappedEvent,
          eventContent,
          data,
          lastDataExchangeEOSE,
          syncStartSec
        }

        await processMessage(context)
        processed++
      }

      const pendingDms = getPendingDms()
      if (pendingDms.length > 0) {
        await dmStorage.storeBatch(account, pendingDms)
      }
      nostrSyncLog('processEventBatch done', { processed, pendingDms: pendingDms.length })
    },
    [dmStorage]
  )

  const processEvent = useCallback(
    async (
      account: Account,
      unwrappedEvent: UnwrappedNostrEvent
    ): Promise<void> => {
      await processEventBatch(account, [
        {
          id: unwrappedEvent.id,
          content: unwrappedEvent,
          created_at: unwrappedEvent.created_at ?? 0
        }
      ])
    },
    [processEventBatch]
  )

  return {
    processEvent,
    processEventBatch
  }
}

export { getEventContent, useNostrMessageProcessor }
export default useNostrMessageProcessor
