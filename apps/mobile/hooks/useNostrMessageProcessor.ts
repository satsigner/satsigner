import { useCallback, useMemo } from 'react'

import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import { decompressMessage } from '@/utils/nostr'

import { deviceAnnouncementHandler } from './useNostrDeviceAnnouncementHandler'
import { dmHandler } from './useNostrDMHandler'
import {
  isInitialized,
  processMessage,
  registerHandler,
  setInitialized
} from './useNostrHandlersRegistry'
import { labelsHandler } from './useNostrLabelsHandler'
import { psbtHandler } from './useNostrPsbtHandler'
import { signMessageHandler } from './useNostrSignMessageHandler'
import { txHandler } from './useNostrTxHandler'
import {
  type MessageHandlerContext,
  type NostrMessageData,
  type PendingDM,
  type UnwrappedNostrEvent
} from '@/types/nostrMessageHandlers'
import { getSyncStartSeconds, useNostrDMStorage } from './useNostrDMStorage'

function getEventContent(
  unwrappedEvent: UnwrappedNostrEvent
): Record<string, unknown> {
  try {
    return JSON.parse(unwrappedEvent.content)
  } catch {
    // JSON parse failed, try decompression
  }
  try {
    const decoded = decompressMessage(unwrappedEvent.content)
    if (
      decoded !== null &&
      typeof decoded === 'object' &&
      !Array.isArray(decoded)
    ) {
      return decoded as Record<string, unknown>
    }
  } catch {
    // Decompression failed, fall through to safe fallback
  }
  return { raw: unwrappedEvent.content }
}

// Initialize handlers once at module level.
// Handlers no longer hold a closure over collectPendingDM — they receive
// onPendingDM through the per-batch context, so hot-reloads of this file
// cannot disconnect the callback from the pending-DM accumulator.
function initializeHandlers(): void {
  if (isInitialized()) return
  setInitialized(true)

  // Register handlers in priority order
  registerHandler(labelsHandler)
  registerHandler(txHandler)
  registerHandler(psbtHandler)
  registerHandler(signMessageHandler)
  registerHandler(dmHandler)
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
      // Each batch gets its own local accumulator — no module-level state,
      // so concurrent batches and hot-reloads cannot interfere.
      const pendingDms: PendingDM[] = []

      const processedEvents = useNostrStore.getState().processedEvents
      const lastDataExchangeEOSE =
        useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0
      const syncStartSec = getSyncStartSeconds(account)

      const YIELD_EVERY = 5
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
          syncStartSec,
          onPendingDM: (dm) => pendingDms.push(dm)
        }

        await processMessage(context)
      }

      if (pendingDms.length > 0) {
        await dmStorage.storeBatch(account, pendingDms)
      }
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

  return useMemo(
    () => ({
      processEvent,
      processEventBatch
    }),
    [processEvent, processEventBatch]
  )
}

export { getEventContent, useNostrMessageProcessor }
export default useNostrMessageProcessor
