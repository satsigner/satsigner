import { useCallback, useMemo } from 'react'
import { InteractionManager } from 'react-native'

import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import {
  type MessageHandlerContext,
  type NostrMessageData,
  type PendingDM,
  type UnwrappedNostrEvent
} from '@/types/nostrMessageHandlers'
import { decompressMessage } from '@/utils/nostr'

import { deviceAnnouncementHandler } from './useNostrDeviceAnnouncementHandler'
import { dmHandler } from './useNostrDMHandler'
import { getSyncStartSeconds, useNostrDMStorage } from './useNostrDMStorage'
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

// Yields to the JS event loop without creating a timer.
// setImmediate in React Native runs after the current event loop turn,
// avoiding the overhead of creating a real OS timer like setTimeout.
function yieldToJS(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

const CHUNK_SIZE = 20

function useNostrMessageProcessor() {
  const dmStorage = useNostrDMStorage()
  const addProcessedEvent = useNostrStore((state) => state.addProcessedEvent)
  const getLastDataExchangeEOSE = useNostrStore(
    (state) => state.getLastDataExchangeEOSE
  )

  const processEventBatch = useCallback(
    async (
      account: Account,
      messages: { id: string; content: unknown; created_at: number }[]
    ): Promise<void> => {
      if (messages.length === 0) return

      // Defer until any in-progress interactions (animations, transitions)
      // have finished so we don't block the UI thread during navigation.
      await new Promise<void>((resolve) =>
        InteractionManager.runAfterInteractions(resolve)
      )

      // Each batch gets its own local accumulator — no module-level state,
      // so concurrent batches and hot-reloads cannot interfere.
      const pendingDms: PendingDM[] = []
      const lastDataExchangeEOSE = getLastDataExchangeEOSE(account.id) || 0
      const syncStartSec = getSyncStartSeconds(account)

      for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
        // Yield between chunks so the JS thread stays responsive.
        if (i > 0) await yieldToJS()

        const chunk = messages.slice(i, i + CHUNK_SIZE)
        for (const msg of chunk) {
          const unwrappedEvent = msg.content as UnwrappedNostrEvent

          // Re-read processedEvents each chunk so deduplication stays accurate
          // across concurrent batches that may have added events since we started.
          const accountProcessedEvents =
            useNostrStore.getState().processedEvents[account.id]
          if (accountProcessedEvents?.[unwrappedEvent.id]) continue

          addProcessedEvent(account.id, unwrappedEvent.id)

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
      }

      if (pendingDms.length > 0) {
        await dmStorage.storeBatch(account, pendingDms)
      }
    },
    [addProcessedEvent, dmStorage, getLastDataExchangeEOSE]
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
