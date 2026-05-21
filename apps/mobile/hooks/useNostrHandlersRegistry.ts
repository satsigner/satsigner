import {
  type NostrMsgHandler,
  type NostrMsgHandlerContext
} from '@/types/models/Nostr'

const handlers: NostrMsgHandler[] = []
let handlersInitialized = false

function registerHandler(handler: NostrMsgHandler): void {
  handlers.push(handler)
}

function isInitialized(): boolean {
  return handlersInitialized
}

function setInitialized(value: boolean): void {
  handlersInitialized = value
}

async function processMessage(
  context: NostrMsgHandlerContext
): Promise<boolean> {
  for (const handler of handlers) {
    if (handler.canHandle(context)) {
      await handler.handle(context)
      return true
    }
  }
  return false
}

function clearHandlers(): void {
  handlers.length = 0
}

function getHandlers(): NostrMsgHandler[] {
  return [...handlers]
}

export {
  clearHandlers,
  getHandlers,
  isInitialized,
  processMessage,
  registerHandler,
  setInitialized
}
