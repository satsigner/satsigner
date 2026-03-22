import {
  clearHandlers,
  getHandlers,
  processMessage,
  registerHandler
} from '@/hooks/useNostrHandlersRegistry'
import type {
  MessageHandler,
  MessageHandlerContext
} from '@/types/nostrMessageHandlers'

import { accountIds, nostrKeys, nostrMessages } from '../utils/nostr_samples'

// Mock dependencies
jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: {
    getState: jest.fn(() => ({
      accounts: [],
      importLabels: jest.fn(),
      updateAccountNostr: jest.fn()
    }))
  }
}))

jest.mock<typeof import('@/store/nostr')>('@/store/nostr', () => ({
  useNostrStore: {
    getState: jest.fn(() => ({
      addMember: jest.fn()
    }))
  }
}))

jest.mock<typeof import('sonner-native')>('sonner-native', () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn()
  }
}))

describe('handler registry', () => {
  beforeEach(() => {
    clearHandlers()
  })

  const createMockContext = (
    overrides: Partial<MessageHandlerContext> = {}
  ): MessageHandlerContext => ({
    account: {
      addresses: [],
      createdAt: new Date(),
      id: accountIds.primary,
      keyCount: 1,
      keys: [],
      keysRequired: 1,
      labels: {},
      name: 'Test Account',
      network: 'testnet',
      nostr: {
        autoSync: true,
        commonNpub: nostrKeys.alice.npub,
        commonNsec: nostrKeys.alice.nsec,
        deviceNpub: nostrKeys.bob.npub,
        deviceNsec: nostrKeys.bob.nsec,
        dms: [],
        lastUpdated: new Date(),
        relays: ['wss://relay.damus.io'],
        syncStart: new Date(),
        trustedMemberDevices: []
      },
      policyType: 'singlesig',
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      },
      syncStatus: 'synced',
      transactions: [],
      utxos: []
    },
    eventContent: nostrMessages.directMessage as unknown as Record<
      string,
      unknown
    >,
    lastDataExchangeEOSE: 0,
    onPendingDM: () => {},
    syncStartSec: 0,
    unwrappedEvent: {
      content: JSON.stringify(nostrMessages.directMessage),
      id: 'event-123',
      pubkey: nostrKeys.bob.publicKeyHex
    },
    ...overrides
  })

  describe('registerHandler', () => {
    it('registers a handler', () => {
      const mockHandler: MessageHandler = {
        canHandle: () => true,
        handle: jest.fn()
      }

      registerHandler(mockHandler)

      expect(getHandlers()).toHaveLength(1)
      expect(getHandlers()[0]).toBe(mockHandler)
    })

    it('registers multiple handlers in order', () => {
      const handler1: MessageHandler = {
        canHandle: () => false,
        handle: jest.fn()
      }
      const handler2: MessageHandler = {
        canHandle: () => true,
        handle: jest.fn()
      }
      const handler3: MessageHandler = {
        canHandle: () => true,
        handle: jest.fn()
      }

      registerHandler(handler1)
      registerHandler(handler2)
      registerHandler(handler3)

      const handlers = getHandlers()
      expect(handlers).toHaveLength(3)
      expect(handlers[0]).toBe(handler1)
      expect(handlers[1]).toBe(handler2)
      expect(handlers[2]).toBe(handler3)
    })
  })

  describe('clearHandlers', () => {
    it('removes all handlers', () => {
      registerHandler({ canHandle: () => true, handle: jest.fn() })
      registerHandler({ canHandle: () => true, handle: jest.fn() })

      expect(getHandlers()).toHaveLength(2)

      clearHandlers()

      expect(getHandlers()).toHaveLength(0)
    })
  })

  describe('processMessage', () => {
    it('returns false when no handlers are registered', async () => {
      const context = createMockContext()
      const result = await processMessage(context)
      expect(result).toBe(false)
    })

    it('returns false when no handler can handle the message', async () => {
      const handler: MessageHandler = {
        canHandle: () => false,
        handle: jest.fn()
      }
      registerHandler(handler)

      const context = createMockContext()
      const result = await processMessage(context)

      expect(result).toBe(false)
      expect(handler.handle).not.toHaveBeenCalled()
    })

    it('calls handle on first matching handler and returns true', async () => {
      const handler1: MessageHandler = {
        canHandle: () => false,
        handle: jest.fn()
      }
      const handler2: MessageHandler = {
        canHandle: () => true,
        handle: jest.fn()
      }
      const handler3: MessageHandler = {
        canHandle: () => true,
        handle: jest.fn()
      }

      registerHandler(handler1)
      registerHandler(handler2)
      registerHandler(handler3)

      const context = createMockContext()
      const result = await processMessage(context)

      expect(result).toBe(true)
      expect(handler1.handle).not.toHaveBeenCalled()
      expect(handler2.handle).toHaveBeenCalledWith(context)
      expect(handler3.handle).not.toHaveBeenCalled()
    })

    it('passes context to canHandle', async () => {
      const canHandleMock = jest.fn().mockReturnValue(true)
      const handler: MessageHandler = {
        canHandle: canHandleMock,
        handle: jest.fn()
      }
      registerHandler(handler)

      const context = createMockContext()
      await processMessage(context)

      expect(canHandleMock).toHaveBeenCalledWith(context)
    })

    it('handles async handle functions', async () => {
      let handlerCompleted = false
      const handler: MessageHandler = {
        canHandle: () => true,
        handle: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          handlerCompleted = true
        }
      }
      registerHandler(handler)

      const context = createMockContext()
      await processMessage(context)

      expect(handlerCompleted).toBe(true)
    })
  })

  describe('getHandlers', () => {
    it('returns a copy of handlers array', () => {
      const handler: MessageHandler = {
        canHandle: () => true,
        handle: jest.fn()
      }
      registerHandler(handler)

      const handlers1 = getHandlers()
      const handlers2 = getHandlers()

      expect(handlers1).not.toBe(handlers2)
      expect(handlers1).toStrictEqual(handlers2)
    })

    it('modifications to returned array do not affect registry', () => {
      const handler: MessageHandler = {
        canHandle: () => true,
        handle: jest.fn()
      }
      registerHandler(handler)

      const handlers = getHandlers()
      handlers.pop()

      expect(getHandlers()).toHaveLength(1)
    })
  })
})
