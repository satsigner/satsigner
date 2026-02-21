import { type MessageHandler, type PendingDM } from '../types'

function createDMHandler(onPendingDM: (dm: PendingDM) => void): MessageHandler {
  return {
    canHandle: (context) => {
      const { eventContent, data } = context
      // Plain DMs: has description but no data
      return (
        eventContent.description != null &&
        eventContent.description !== '' &&
        !data
      )
    },

    handle: async (context) => {
      const { unwrappedEvent, eventContent } = context

      // Plain DMs: include all. Both protocol and data-exchange subscriptions
      // use this handler; we no longer filter by tag so DMs from other
      // trusted devices always show in the chat.
      onPendingDM({ unwrappedEvent, eventContent })
    }
  }
}

export { createDMHandler }
