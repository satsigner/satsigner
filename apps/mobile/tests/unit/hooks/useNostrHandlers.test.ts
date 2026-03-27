// Mock sonner-native - use module factory that returns mock directly
import { toast } from 'sonner-native'

import { deviceAnnouncementHandler } from '@/hooks/useNostrDeviceAnnouncementHandler'
import { dmHandler } from '@/hooks/useNostrDMHandler'
import { labelsHandler } from '@/hooks/useNostrLabelsHandler'
import { psbtHandler } from '@/hooks/useNostrPsbtHandler'
import { signMessageHandler } from '@/hooks/useNostrSignMessageHandler'
import { txHandler } from '@/hooks/useNostrTxHandler'
import {
  type MessageHandlerContext,
  type PendingDM
} from '@/types/nostrMessageHandlers'

import { accountIds, nostrKeys } from '../utils/nostr_samples'

jest.mock<typeof import('sonner-native')>('sonner-native', () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn()
  }
}))

// Create mock functions at module level so they persist
const mockImportLabels = jest.fn()
const mockUpdateAccountNostr = jest.fn()
const mockAddMember = jest.fn()

// Mock stores with persistent mock functions
jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: {
    getState: () => ({
      accounts: [],
      importLabels: mockImportLabels,
      updateAccountNostr: mockUpdateAccountNostr
    })
  }
}))

jest.mock<typeof import('@/store/nostr')>('@/store/nostr', () => ({
  useNostrStore: {
    getState: () => ({
      addMember: mockAddMember
    })
  }
}))

// Mock nostr-tools
jest.mock<typeof import('nostr-tools')>('nostr-tools', () => ({
  nip19: {
    npubEncode: jest.fn((pubkey: string) => `npub1${pubkey.slice(0, 8)}...`)
  }
}))

// Mock bip329
jest.mock<typeof import('@/utils/bip329')>('@/utils/bip329', () => ({
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
    eventContent: {},
    lastDataExchangeEOSE: 0,
    onPendingDM: jest.fn(),
    syncStartSec: 0,
    unwrappedEvent: {
      content: '{}',
      id: 'event-123',
      pubkey: nostrKeys.bob.privateKeyHex
    },
    ...overrides
  })

  describe('labelsHandler', () => {
    it('canHandle returns true for LabelsBip329 data_type', () => {
      const context = createMockContext({
        data: {
          data: '{"type":"tx","ref":"abc","label":"test"}',
          data_type: 'LabelsBip329'
        }
      })
      expect(labelsHandler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for other data_types', () => {
      const context = createMockContext({
        data: { data: 'somedata', data_type: 'PSBT' }
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
          data: '{"type":"tx","ref":"abc","label":"test"}',
          data_type: 'LabelsBip329'
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
          data: '',
          data_type: 'LabelsBip329'
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
        data: { data: 'txhash123', data_type: 'Tx' }
      })
      expect(txHandler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for other data_types', () => {
      const context = createMockContext({
        data: { data: 'somedata', data_type: 'PSBT' }
      })
      expect(txHandler.canHandle(context)).toBe(false)
    })

    it('handle shows info toast with transaction info', async () => {
      const context = createMockContext({
        data: { data: 'abcdef123456', data_type: 'Tx' }
      })

      await txHandler.handle(context)

      expect(mockToast.info).toHaveBeenCalledWith(
        'New Transaction',
        expect.objectContaining({
          description: expect.stringContaining('abcdef123456')
        })
      )
    })
  })

  describe('signMessageHandler', () => {
    it('canHandle returns true for SignMessageRequest data_type', () => {
      const context = createMockContext({
        data: { data: 'message to sign', data_type: 'SignMessageRequest' }
      })
      expect(signMessageHandler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for other data_types', () => {
      const context = createMockContext({
        data: { data: 'somedata', data_type: 'Tx' }
      })
      expect(signMessageHandler.canHandle(context)).toBe(false)
    })

    it('handle shows info toast with sign request info', async () => {
      const context = createMockContext({
        data: { data: 'Please sign this', data_type: 'SignMessageRequest' }
      })

      await signMessageHandler.handle(context)

      expect(mockToast.info).toHaveBeenCalledWith(
        'New Sign Request',
        expect.objectContaining({
          description: expect.stringContaining('Please sign this')
        })
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

  describe('psbtHandler', () => {
    it('canHandle returns true for PSBT data_type', () => {
      const context = createMockContext({
        data: { data: 'cHNidP8...', data_type: 'PSBT' }
      })
      expect(psbtHandler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for other data_types', () => {
      const context = createMockContext({
        data: { data: 'somedata', data_type: 'Tx' }
      })
      expect(psbtHandler.canHandle(context)).toBe(false)
    })

    it('handle shows toast and calls onPendingDM via context', async () => {
      const onPendingDM = jest.fn()
      const context = createMockContext({
        data: { data: 'cHNidP8base64data', data_type: 'PSBT' },
        eventContent: { created_at: 1704067200 },
        onPendingDM
      })

      await psbtHandler.handle(context)

      expect(mockToast.info).toHaveBeenCalledWith(
        'New PSBT',
        expect.objectContaining({
          description: expect.stringContaining('cHNidP8base64data')
        })
      )
      expect(onPendingDM).toHaveBeenCalledWith({
        eventContent: {
          created_at: 1704067200,
          description: 'cHNidP8base64data'
        },
        skipToast: true,
        unwrappedEvent: context.unwrappedEvent
      })
    })

    it('handle uses current time when created_at is missing', async () => {
      const onPendingDM = jest.fn()
      const context = createMockContext({
        data: { data: 'cHNidP8...', data_type: 'PSBT' },
        eventContent: {},
        onPendingDM
      })

      const beforeTime = Math.floor(Date.now() / 1000)
      await psbtHandler.handle(context)
      const afterTime = Math.floor(Date.now() / 1000)

      const call = onPendingDM.mock.calls[0][0] as PendingDM
      const createdAt = call.eventContent.created_at as number
      expect(createdAt).toBeGreaterThanOrEqual(beforeTime)
      expect(createdAt).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('dmHandler', () => {
    it('canHandle returns true for messages with description and no data', () => {
      const context = createMockContext({
        data: undefined,
        eventContent: { description: 'Hello world' }
      })
      expect(dmHandler.canHandle(context)).toBe(true)
    })

    it('canHandle returns false for empty description', () => {
      const context = createMockContext({
        data: undefined,
        eventContent: { description: '' }
      })
      expect(dmHandler.canHandle(context)).toBe(false)
    })

    it('canHandle returns false for null description', () => {
      const context = createMockContext({
        data: undefined,
        eventContent: { description: null }
      })
      expect(dmHandler.canHandle(context)).toBe(false)
    })

    it('canHandle returns false when data is present', () => {
      const context = createMockContext({
        data: { data: '{}', data_type: 'LabelsBip329' },
        eventContent: { description: 'Hello' }
      })
      expect(dmHandler.canHandle(context)).toBe(false)
    })

    it('handle calls onPendingDM via context with event and content', async () => {
      const onPendingDM = jest.fn()
      const context = createMockContext({
        eventContent: { created_at: 1704067200, description: 'Hello world' },
        onPendingDM
      })

      await dmHandler.handle(context)

      expect(onPendingDM).toHaveBeenCalledWith({
        eventContent: context.eventContent,
        unwrappedEvent: context.unwrappedEvent
      })
    })
  })
})
