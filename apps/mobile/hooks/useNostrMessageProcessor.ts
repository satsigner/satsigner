import {
  NOSTR_EVENT_FAILURE_TRACK_MAX,
  NOSTR_EVENT_FUTURE_TOLERANCE_SEC,
  NOSTR_EVENT_MAX_HANDLER_ATTEMPTS,
  NOSTR_PROCESSOR_CHUNK_SIZE
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import {
  getProcessedNostrEventIds,
  markNostrEventsProcessed,
  type NostrProcessedEvent
} from '@/db/nostrProcessedEvents'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import {
  type NostrMessage,
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
import {
  getSyncStartSeconds,
  isSenderAllowed,
  storeNostrDmBatch
} from './useNostrDMStorage'
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

type NostrBatchMessage = Pick<NostrMessage, 'content' | 'created_at' | 'id'> &
  Partial<Pick<NostrMessage, 'wrapId'>>

/**
 * processed: stored from an allowed sender, advances the EOSE cursor.
 * ignored: marked processed but never moves the cursor (untrusted device
 * announcement, malformed payload, handler given up).
 * deferred: not marked and no cursor effect (untrusted sender, future date),
 * so a later sync (e.g. after trusting the device) picks it up again.
 * failed: not marked; the cursor stays below it so the next sync retries.
 */
type NostrBatchResult = {
  deferred: NostrProcessedEvent[]
  failed: NostrProcessedEvent[]
  ignored: NostrProcessedEvent[]
  processed: NostrProcessedEvent[]
}

type NostrEventOutcome = keyof NostrBatchResult

type PendingDmEntry = { dm: NostrPendingDM; eventId: string }

const handlerFailureCounts = new Map<string, number>()

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

// Handlers receive onPendingDM through the per-batch context, so hot-reloads
// of this file cannot disconnect the callback from the pending-DM accumulator.
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

// setImmediate yields to the JS event loop without creating an OS timer.
function yieldToJS(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

function nowSeconds(): number {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function toProcessedEvent(message: NostrBatchMessage): NostrProcessedEvent {
  return {
    createdAt: Math.min(
      message.created_at,
      nowSeconds() + NOSTR_EVENT_FUTURE_TOLERANCE_SEC
    ),
    id: message.id
  }
}

/** Counts a handler failure; after the last attempt the event is given up. */
function registerHandlerFailure(eventId: string): NostrEventOutcome {
  const attempts = (handlerFailureCounts.get(eventId) ?? 0) + 1
  if (attempts >= NOSTR_EVENT_MAX_HANDLER_ATTEMPTS) {
    handlerFailureCounts.delete(eventId)
    return 'ignored'
  }
  handlerFailureCounts.set(eventId, attempts)
  if (handlerFailureCounts.size > NOSTR_EVENT_FAILURE_TRACK_MAX) {
    const [oldest] = handlerFailureCounts.keys()
    handlerFailureCounts.delete(oldest)
  }
  return 'failed'
}

function resetHandlerFailures(): void {
  handlerFailureCounts.clear()
}

/** Rumor ids plus the ids of the gift wraps that carried them. */
function toProcessedRows(messages: NostrBatchMessage[]): NostrProcessedEvent[] {
  return messages.flatMap((message) => {
    const row = toProcessedEvent(message)
    return message.wrapId ? [row, { ...row, id: message.wrapId }] : [row]
  })
}

function buildHandlerContext(
  account: Account,
  unwrappedEvent: NostrUnwrappedEvent,
  onPendingDM: (dm: NostrPendingDM) => void
): NostrMsgHandlerContext | null {
  const eventContent = getEventContent(unwrappedEvent)
  const messageData = NostrMessageDataSchema.safeParse(eventContent.data)
  if (eventContent.data && !messageData.success) {
    return null
  }
  return {
    account,
    data: messageData.data,
    eventContent,
    lastDataExchangeEOSE:
      useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0,
    onPendingDM,
    syncStartSec: getSyncStartSeconds(account),
    unwrappedEvent
  }
}

function tryStoreDms(
  accountId: string,
  entries: PendingDmEntry[]
): { deferredIds: Set<string>; stored: boolean } {
  try {
    const { deferredIds } = storeNostrDmBatch(
      accountId,
      entries.map((entry) => entry.dm)
    )
    return { deferredIds: new Set(deferredIds), stored: true }
  } catch {
    return { deferredIds: new Set(), stored: false }
  }
}

async function handleBatchMessage(
  account: Account,
  message: NostrBatchMessage,
  onPendingDM: (dm: NostrPendingDM) => void
): Promise<NostrEventOutcome> {
  const { content } = message
  if (!isUnwrappedEvent(content)) {
    return 'ignored'
  }
  if (message.created_at > nowSeconds() + NOSTR_EVENT_FUTURE_TOLERANCE_SEC) {
    return 'deferred'
  }
  const context = buildHandlerContext(account, content, onPendingDM)
  if (!context) {
    return 'ignored'
  }
  // Device announcements are how untrusted devices become known; anything
  // else from them waits until the user trusts that device.
  const senderAllowed = isSenderAllowed(account, content.pubkey)
  if (!senderAllowed && !deviceAnnouncementHandler.canHandle(context)) {
    return 'deferred'
  }
  const outcome = await processMessage(context)
  if (outcome.status === 'failed') {
    return registerHandlerFailure(message.id)
  }
  return senderAllowed ? 'processed' : 'ignored'
}

function settleDmOutcome(
  outcome: NostrEventOutcome,
  eventId: string,
  dmWrite: ReturnType<typeof tryStoreDms>,
  dmEventIds: Set<string>
): NostrEventOutcome {
  if (!dmEventIds.has(eventId) || outcome !== 'processed') {
    return outcome
  }
  if (!dmWrite.stored) {
    return 'failed'
  }
  return dmWrite.deferredIds.has(eventId) ? 'deferred' : outcome
}

/**
 * Runs the handlers for a batch of unwrapped device-sync rumors. An event is
 * marked processed (SQLite, scope = account id) only after its handler and
 * the batch DM write succeeded; failed and deferred events stay unprocessed
 * so a later sync picks them up again.
 */
async function processNostrEventBatch(
  account: Account,
  messages: NostrBatchMessage[]
): Promise<NostrBatchResult> {
  const alreadyProcessed = getProcessedNostrEventIds(
    account.id,
    messages.map((message) => message.id)
  )
  const seen = new Set<string>()
  const outcomes: { message: NostrBatchMessage; outcome: NostrEventOutcome }[] =
    []
  const pendingDms: PendingDmEntry[] = []

  for (const [index, message] of messages.entries()) {
    if (index > 0 && index % NOSTR_PROCESSOR_CHUNK_SIZE === 0) {
      await yieldToJS()
    }
    if (alreadyProcessed.has(message.id) || seen.has(message.id)) {
      continue
    }
    seen.add(message.id)
    const outcome = await handleBatchMessage(account, message, (dm) =>
      pendingDms.push({ dm, eventId: message.id })
    )
    outcomes.push({ message, outcome })
  }

  const dmWrite = tryStoreDms(account.id, pendingDms)
  const dmEventIds = new Set(pendingDms.map((entry) => entry.eventId))
  const result: NostrBatchResult = {
    deferred: [],
    failed: [],
    ignored: [],
    processed: []
  }
  const toMark: NostrBatchMessage[] = []
  for (const { message, outcome } of outcomes) {
    const settled = settleDmOutcome(outcome, message.id, dmWrite, dmEventIds)
    result[settled].push(toProcessedEvent(message))
    if (settled === 'processed' || settled === 'ignored') {
      toMark.push(message)
    }
  }

  markNostrEventsProcessed(account.id, toProcessedRows(toMark))
  return result
}

function useNostrMessageProcessor() {
  function processEventBatch(account: Account, messages: NostrBatchMessage[]) {
    return processNostrEventBatch(account, messages)
  }

  function processEvent(account: Account, unwrappedEvent: NostrUnwrappedEvent) {
    return processNostrEventBatch(account, [
      {
        content: unwrappedEvent,
        created_at: unwrappedEvent.created_at ?? 0,
        id: unwrappedEvent.id
      }
    ])
  }

  return { processEvent, processEventBatch }
}

export {
  getEventContent,
  processNostrEventBatch,
  resetHandlerFailures,
  useNostrMessageProcessor
}
export type { NostrBatchMessage, NostrBatchResult }
