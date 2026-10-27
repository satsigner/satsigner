import {
  type NostrMsgHandler,
  type NostrMsgHandlerContext
} from '@/types/models/Nostr'

const handlers: NostrMsgHandler[] = []
const registryState = { initialized: false }

function registerHandler(handler: NostrMsgHandler): void {
  handlers.push(handler)
}

function isInitialized(): boolean {
  return registryState.initialized
}

function setInitialized(value: boolean): void {
  registryState.initialized = value
}

type NostrHandlerOutcome =
  | { status: 'handled' }
  | { status: 'unhandled' }
  | { error: unknown; status: 'failed' }

/**
 * Runs the first handler that accepts the message. A throwing handler is
 * reported as `failed` instead of aborting the caller's batch, so the event
 * stays unprocessed and is retried on the next sync.
 */
async function processMessage(
  context: NostrMsgHandlerContext
): Promise<NostrHandlerOutcome> {
  const handler = handlers.find((candidate) => candidate.canHandle(context))
  if (!handler) {
    return { status: 'unhandled' }
  }
  try {
    await handler.handle(context)
    return { status: 'handled' }
  } catch (error) {
    return { error, status: 'failed' }
  }
}

function clearHandlers(): void {
  handlers.length = 0
}

function getHandlers(): NostrMsgHandler[] {
  return [...handlers]
}

export type { NostrHandlerOutcome }
export {
  clearHandlers,
  getHandlers,
  isInitialized,
  processMessage,
  registerHandler,
  setInitialized
}
