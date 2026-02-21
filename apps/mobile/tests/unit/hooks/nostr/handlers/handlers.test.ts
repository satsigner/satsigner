// Mock sonner-native - use module factory that returns mock directly
import { toast } from 'sonner-native'

import { deviceAnnouncementHandler } from '@/hooks/nostr/handlers/deviceAnnouncementHandler'
import { createDMHandler } from '@/hooks/nostr/handlers/dmHandler'
import { labelsHandler } from '@/hooks/nostr/handlers/labelsHandler'
import { createPSBTHandler } from '@/hooks/nostr/handlers/psbtHandler'
import { signMessageHandler } from '@/hooks/nostr/handlers/signMessageHandler'
import { txHandler } from '@/hooks/nostr/handlers/txHandler'
import { type MessageHandlerContext, type PendingDM } from '@/hooks/nostr/types'

import { accountIds, nostrKeys } from '../../../utils/nostr_samples'

jest.mock('sonner-native', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}))

// Create mock functions at module level so they persist
const mockImportLabels = jest.fn()
const mockUpdateAccountNostr = jest.fn()
const mockAddMember = jest.fn()

// Mock stores with persistent mock functions
jest.mock('@/store/accounts', () => ({
  useAccountsStore: {
    getState: () => ({
      accounts: [],
      importLabels: mockImportLabels,
      updateAccountNostr: mockUpdateAccountNostr
    })
  }
}))

jest.mock('@/store/nostr', () => ({
  useNostrStore: {
    getState: () => ({
      addMember: mockAddMember
    })
  }
}))

// Mock nostr-tools
jest.mock('nostr-tools', () => ({
  nip19: {
    npubEncode: jest.fn((pubkey: string) => `npub1${pubkey.slice(0, 8)}...`)
  }
}))

// Mock bip329
jest.mock('@/utils/bip329', () => ({
  JSONLtoLabels: jest.fn((jsonl: string) => {
    const lines = jsonl.split('\n').filter((l: string) => l.trim())
    return lines.map((line: string) => JSON.parse(line))
  })
}))

// Get mocked toast for assertions
const mockToast = toast as jest.Mocked<typeof toast>

describe('message handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockContext = (
    overrides: Partial<MessageHandlerContext> = {}
  ): MessageHandlerContext => ({
    account: {
      id: accountIds.primary,
      name: 'Test Account',
      network: 'testnet',
      policyType: 'singlesig',
      keys: [],
      keyCount: 1,
      keysRequired: 1,
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      },
      transactions: [],
      utxos: [],
      addresses: [],
      labels: {},
      createdAt: new Date(),
      syncStatus: 'synced',
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
      }
    },
    unwrappedEvent: {
      id: 'event-123',
      pubkey: nostrKeys.bob.privateKeyHex,
      content: '{}'
    },
    eventContent: {},
    lastDataExchangeEOSE: 0,
    syncStartSec: 0,
    ...overrides
  })

  describe('labelsHandler', () => {
    it('canHandle returns true for LabelsBip329 data_type', () => {
      const context = createMockContext({
        data: {
          data_type: 'LabelsBip329',
          data: '{"type":"tx","ref":"abc","label":"test"}'
        }
      })
      expect(labelsHandler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for other data_types', () => {
      const context = createMockContext({
        data: { data_type: 'PSBT', data: 'somedata' }
      })
      expect(labelsHandler.canHandle(context)).toBe(false)
    })

    it('canHandle returns false when no data', () => {
      const context = createMockContext({ data: undefined })
      expect(labelsHandler.canHandle(context)).toBe(false)
    })

    it('handle imports labels and shows toast on success', async () => {
      mockImportLabels.mockReturnValue(3)

      const context = createMockContext({
        data: {
          data_type: 'LabelsBip329',
          data: '{"type":"tx","ref":"abc","label":"test"}'
        }
      })

      await labelsHandler.handle(context)

      expect(mockImportLabels).toHaveBeenCalledWith(
        accountIds.primary,
        expect.any(Array)
      )
      expect(mockToast.success).toHaveBeenCalledWith('Imported 3 labels')
    })

    it('handle does not show toast when no labels imported', async () => {
      mockImportLabels.mockReturnValue(0)

      const context = createMockContext({
        data: {
          data_type: 'LabelsBip329',
          data: ''
        }
      })

      await labelsHandler.handle(context)

      expect(mockToast.success).not.toHaveBeenCalled()
    })

    it('handle does nothing when data is undefined', async () => {
      const context = createMockContext({ data: undefined })

      await labelsHandler.handle(context)

      expect(mockImportLabels).not.toHaveBeenCalled()
    })
  })

  describe('txHandler', () => {
    it('canHandle returns true for Tx data_type', () => {
      const context = createMockContext({
        data: { data_type: 'Tx', data: 'txhash123' }
      })
      expect(txHandler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for other data_types', () => {
      const context = createMockContext({
        data: { data_type: 'PSBT', data: 'somedata' }
      })
      expect(txHandler.canHandle(context)).toBe(false)
    })

    it('handle shows info toast with transaction info', async () => {
      const context = createMockContext({
        data: { data_type: 'Tx', data: 'abcdef123456' }
      })

      await txHandler.handle(context)

      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('New Tx Recieve from:')
      )
      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('abcdef123456'.slice(0, 12))
      )
    })
  })

  describe('signMessageHandler', () => {
    it('canHandle returns true for SignMessageRequest data_type', () => {
      const context = createMockContext({
        data: { data_type: 'SignMessageRequest', data: 'message to sign' }
      })
      expect(signMessageHandler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for other data_types', () => {
      const context = createMockContext({
        data: { data_type: 'Tx', data: 'somedata' }
      })
      expect(signMessageHandler.canHandle(context)).toBe(false)
    })

    it('handle shows info toast with sign request info', async () => {
      const context = createMockContext({
        data: { data_type: 'SignMessageRequest', data: 'Please sign this' }
      })

      await signMessageHandler.handle(context)

      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('New Sign message request Recieve from:')
      )
    })
  })

  describe('deviceAnnouncementHandler', () => {
    it('canHandle returns true when public_key_bech32 is present', () => {
      const context = createMockContext({
        eventContent: {
          public_key_bech32: nostrKeys.alice.npub
        }
      })
      expect(deviceAnnouncementHandler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false when public_key_bech32 is missing', () => {
      const context = createMockContext({
        eventContent: { description: 'some message' }
      })
      expect(deviceAnnouncementHandler.canHandle(context)).toBe(false)
    })

    it('handle adds member to store', async () => {
      const context = createMockContext({
        eventContent: {
          public_key_bech32: nostrKeys.alice.npub
        }
      })

      await deviceAnnouncementHandler.handle(context)

      expect(mockAddMember).toHaveBeenCalledWith(
        accountIds.primary,
        nostrKeys.alice.npub
      )
    })
  })

  describe('createPSBTHandler', () => {
    it('canHandle returns true for PSBT data_type', () => {
      const onPendingDM = jest.fn()
      const handler = createPSBTHandler(onPendingDM)

      const context = createMockContext({
        data: { data_type: 'PSBT', data: 'cHNidP8...' }
      })
      expect(handler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for other data_types', () => {
      const onPendingDM = jest.fn()
      const handler = createPSBTHandler(onPendingDM)

      const context = createMockContext({
        data: { data_type: 'Tx', data: 'somedata' }
      })
      expect(handler.canHandle(context)).toBe(false)
    })

    it('handle shows toast and calls onPendingDM', async () => {
      const onPendingDM = jest.fn()
      const handler = createPSBTHandler(onPendingDM)

      const context = createMockContext({
        eventContent: { created_at: 1704067200 },
        data: { data_type: 'PSBT', data: 'cHNidP8base64data' }
      })

      await handler.handle(context)

      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('New PSBT Recieve from:')
      )
      expect(onPendingDM).toHaveBeenCalledWith({
        unwrappedEvent: context.unwrappedEvent,
        eventContent: {
          created_at: 1704067200,
          description: 'cHNidP8base64data'
        }
      })
    })

    it('handle uses current time when created_at is missing', async () => {
      const onPendingDM = jest.fn()
      const handler = createPSBTHandler(onPendingDM)

      const context = createMockContext({
        eventContent: {},
        data: { data_type: 'PSBT', data: 'cHNidP8...' }
      })

      const beforeTime = Math.floor(Date.now() / 1000)
      await handler.handle(context)
      const afterTime = Math.floor(Date.now() / 1000)

      const call = onPendingDM.mock.calls[0][0] as PendingDM
      const createdAt = call.eventContent.created_at as number
      expect(createdAt).toBeGreaterThanOrEqual(beforeTime)
      expect(createdAt).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('createDMHandler', () => {
    it('canHandle returns true for messages with description and no data', () => {
      const onPendingDM = jest.fn()
      const handler = createDMHandler(onPendingDM)

      const context = createMockContext({
        eventContent: { description: 'Hello world' },
        data: undefined
      })
      expect(handler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for empty description', () => {
      const onPendingDM = jest.fn()
      const handler = createDMHandler(onPendingDM)

      const context = createMockContext({
        eventContent: { description: '' },
        data: undefined
      })
      expect(handler.canHandle(context)).toBe(false)
    })

    it('canHandle returns false for null description', () => {
      const onPendingDM = jest.fn()
      const handler = createDMHandler(onPendingDM)

      const context = createMockContext({
        eventContent: { description: null },
        data: undefined
      })
      expect(handler.canHandle(context)).toBe(false)
    })

    it('canHandle returns false when data is present', () => {
      const onPendingDM = jest.fn()
      const handler = createDMHandler(onPendingDM)

      const context = createMockContext({
        eventContent: { description: 'Hello' },
        data: { data_type: 'LabelsBip329', data: '{}' }
      })
      expect(handler.canHandle(context)).toBe(false)
    })

    it('handle calls onPendingDM with event and content', async () => {
      const onPendingDM = jest.fn()
      const handler = createDMHandler(onPendingDM)

      const context = createMockContext({
        eventContent: { description: 'Hello world', created_at: 1704067200 }
      })

      await handler.handle(context)

      expect(onPendingDM).toHaveBeenCalledWith({
        unwrappedEvent: context.unwrappedEvent,
        eventContent: context.eventContent
      })
    })
  })
})
