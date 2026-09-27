import { useCallback, useMemo } from 'react'

import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import {
  NostrMessageDataSchema,
  type NostrMsgHandlerContext,
  type NostrPendingDM,
  type NostrUnwrappedEvent,
  NostrUnwrappedEventSchema
} from '@/types/models/Nostr'
import { decompressMessage } from '@/utils/nostr'
import { isRecord } from '@/utils/object'

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
  unwrappedEvent: NostrUnwrappedEvent
): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(unwrappedEvent.content)
    if (isRecord(parsed)) {
      return parsed
    }
  } catch {
    // JSON parse failed, try decompression
  }
  try {
    const decoded = decompressMessage(unwrappedEvent.content)
    if (isRecord(decoded)) {
      return decoded
    }
  } catch {
    // Decompression failed, fall through to safe fallback
  }
  return { raw: unwrappedEvent.content }
}

/**
 * Subscription messages carry the unwrapped rumor as untyped content; only
 * rumors matching the unwrapped event schema are processed.
 */
function isUnwrappedEvent(value: unknown): value is NostrUnwrappedEvent {
  return NostrUnwrappedEventSchema.safeParse(value).success
}

// Initialize handlers once at module level.
// Handlers no longer hold a closure over collectPendingDM — they receive
// onPendingDM through the per-batch context, so hot-reloads of this file
// cannot disconnect the callback from the pending-DM accumulator.
function initializeHandlers(): void {
  if (isInitialized()) {
    return
  }
  setInitialized(true)

  registerHandler(labelsHandler)
  registerHandler(txHandler)
  registerHandler(psbtHandler)
  registerHandler(signMessageHandler)
  registerHandler(dmHandler)
  registerHandler(deviceAnnouncementHandler)
}

initializeHandlers()

// Yields to the JS event loop without creating a timer.
// setImmediate in React Native runs after the current event loop turn,
// avoiding the overhead of creating a real OS timer like setTimeout.
function yieldToJS(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
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
      if (messages.length === 0) {
        return
      }

      // requestIdleCallback replaces deprecated InteractionManager.runAfterInteractions.
      // It is frame-tick driven: it pauses while the app is backgrounded and does
      // not wait for UI-thread animations to finish.
      await new Promise<void>((resolve) => {
        requestIdleCallback(() => resolve())
      })

      // Each batch gets its own local accumulator — no module-level state,
      // so concurrent batches and hot-reloads cannot interfere.
      const pendingDms: NostrPendingDM[] = []
      const lastDataExchangeEOSE = getLastDataExchangeEOSE(account.id) || 0
      const syncStartSec = getSyncStartSeconds(account)

      for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
        // Yield between chunks so the JS thread stays responsive.
        if (i > 0) {
          await yieldToJS()
        }

        const chunk = messages.slice(i, i + CHUNK_SIZE)
        for (const msg of chunk) {
          if (!isUnwrappedEvent(msg.content)) {
            continue
          }
          const unwrappedEvent = msg.content

          // Re-read processedEvents each chunk so deduplication stays accurate
          // across concurrent batches that may have added events since we started.
          const accountProcessedEvents =
            useNostrStore.getState().processedEvents[account.id]
          if (accountProcessedEvents?.[unwrappedEvent.id]) {
            continue
          }

          addProcessedEvent(account.id, unwrappedEvent.id)

          const eventContent = getEventContent(unwrappedEvent)
          const messageData = NostrMessageDataSchema.safeParse(
            eventContent.data
          )
          if (eventContent.data && !messageData.success) {
            continue
          }

          const context: NostrMsgHandlerContext = {
            account,
            data: messageData.data,
            eventContent,
            lastDataExchangeEOSE,
            onPendingDM: (dm) => pendingDms.push(dm),
            syncStartSec,
            unwrappedEvent
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
      unwrappedEvent: NostrUnwrappedEvent
    ): Promise<void> => {
      await processEventBatch(account, [
        {
          content: unwrappedEvent,
          created_at: unwrappedEvent.created_at ?? 0,
          id: unwrappedEvent.id
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
