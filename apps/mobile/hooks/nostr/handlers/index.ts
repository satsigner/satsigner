import { type MessageHandler, type MessageHandlerContext } from '../types'

const handlers: MessageHandler[] = []
let handlersInitialized = false

function registerHandler(handler: MessageHandler): void {
  handlers.push(handler)
}

function isInitialized(): boolean {
  return handlersInitialized
}

function setInitialized(value: boolean): void {
  handlersInitialized = value
}

async function processMessage(
  context: MessageHandlerContext
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

function getHandlers(): MessageHandler[] {
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
