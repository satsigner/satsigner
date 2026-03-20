import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import { nostrSyncService, resetInstance } from '@/utils/nostrSyncService'

// Mock dependencies
jest.mock('@/api/nostr', () => ({
  NostrAPI: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    subscribeToKind1059: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    closeAllSubscriptions: jest.fn().mockResolvedValue(undefined),
    setLoadingCallback: jest.fn()
  }))
}))

jest.mock('@/constants/nostr', () => ({
  ...jest.requireActual('@/constants/nostr'),
  PROTOCOL_SUBSCRIPTION_LIMIT: 1500
}))

jest.mock('@/storage/mmkv', () => {
  const storage: Record<string, string> = {}
  return {
    __esModule: true,
    default: {
      setItem: jest.fn((name: string, value: string) => {
        storage[name] = value
      }),
      getItem: jest.fn((name: string) => storage[name] ?? null),
      removeItem: jest.fn((name: string) => {
        delete storage[name]
      })
    }
  }
})

jest.mock('@/utils/nostr', () => ({
  generateColorFromNpub: jest.fn().mockResolvedValue('#ff5500')
}))

const mockAccount: Account = {
  id: 'test-account-1',
  name: 'Test Account',
  network: 'bitcoin',
  policyType: 'singlesig',
  keyCount: 1,
  keysRequired: 1,
  keys: [],
  addresses: [],
  transactions: [],
  utxos: [],
  labels: {},
  createdAt: new Date(),
  syncStatus: 'unsynced',
  summary: {
    balance: 0,
    numberOfAddresses: 0,
    numberOfTransactions: 0,
    numberOfUtxos: 0,
    satsInMempool: 0
  },
  nostr: {
    autoSync: true,
    relays: ['wss://relay.damus.io'],
    commonNsec: 'nsec1test',
    commonNpub: 'npub1test',
    deviceNsec: 'nsec1device',
    deviceNpub: 'npub1device',
    dms: [],
    lastUpdated: new Date(),
    syncStart: new Date(),
    trustedMemberDevices: []
  }
}

describe('nostrSyncService', () => {
  let mockProcessor: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    resetInstance()
    mockProcessor = jest.fn()

    useNostrStore.setState({
      members: {},
      processedMessageIds: {},
      processedEvents: {},
      lastProtocolEOSE: {},
      lastDataExchangeEOSE: {},
      trustedDevices: {},
      syncStatus: {},
      activeSubscriptions: new Set(),
      syncingAccounts: {},
      transactionToShare: null
    })
  })

  afterEach(() => {
    nostrSyncService.stopAll()
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  describe('singleton pattern', () => {
    it('exports a single shared service object', () => {
      expect(nostrSyncService).toBeDefined()
      expect(typeof nostrSyncService.startSync).toBe('function')
    })

    it('after reset, state is cleared and service is still usable', () => {
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)
      nostrSyncService.startSync(mockAccount)
      expect(
        nostrSyncService.getActiveSubscriptionCount()
      ).toBeGreaterThanOrEqual(0)
      resetInstance()
      expect(nostrSyncService.getActiveSubscriptionCount()).toBe(0)
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)
      expect(nostrSyncService.getActiveAccountIds()).toEqual([])
    })
  })

  describe('startSync', () => {
    it('returns immediately (non-blocking)', () => {
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)

      const startTime = Date.now()
      nostrSyncService.startSync(mockAccount)
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(10)
    })

    it('emits status events during sync', async () => {
      const statusEvents: string[] = []
      nostrSyncService.on('status', (e: { status: string }) =>
        statusEvents.push(e.status)
      )
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)

      nostrSyncService.startSync(mockAccount)

      await jest.runAllTimersAsync()

      expect(statusEvents).toContain('connecting')
    })

    it('skips if autoSync is disabled', async () => {
      const disabledAccount = {
        ...mockAccount,
        nostr: { ...mockAccount.nostr, autoSync: false }
      }
      nostrSyncService.setMessageProcessor(disabledAccount.id, mockProcessor)

      nostrSyncService.startSync(disabledAccount)

      await jest.runAllTimersAsync()

      expect(nostrSyncService.hasActiveSubscription(disabledAccount.id)).toBe(
        false
      )
    })

    it('skips if no relays configured', async () => {
      const noRelaysAccount = {
        ...mockAccount,
        nostr: { ...mockAccount.nostr, relays: [] }
      }
      nostrSyncService.setMessageProcessor(noRelaysAccount.id, mockProcessor)

      nostrSyncService.startSync(noRelaysAccount)

      await jest.runAllTimersAsync()

      expect(nostrSyncService.hasActiveSubscription(noRelaysAccount.id)).toBe(
        false
      )
    })

    it('skips if already subscribing', async () => {
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)

      nostrSyncService.startSync(mockAccount)
      nostrSyncService.startSync(mockAccount)

      await jest.runAllTimersAsync()

      expect(nostrSyncService.getActiveSubscriptionCount()).toBeLessThanOrEqual(
        1
      )
    })
  })

  describe('stopSync', () => {
    it('stops sync and emits idle status', async () => {
      const statusEvents: string[] = []
      nostrSyncService.on('status', (e: { status: string }) =>
        statusEvents.push(e.status)
      )
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)

      nostrSyncService.startSync(mockAccount)
      await jest.runAllTimersAsync()

      nostrSyncService.stopSync(mockAccount.id)

      expect(statusEvents).toContain('idle')
      expect(nostrSyncService.hasActiveSubscription(mockAccount.id)).toBe(false)
    })

    it('cancels pending retry', async () => {
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)

      const { NostrAPI } = require('@/api/nostr')
      NostrAPI.mockImplementation(() => ({
        connect: jest.fn().mockRejectedValue(new Error('Network error')),
        setLoadingCallback: jest.fn()
      }))

      nostrSyncService.startSync(mockAccount)
      await jest.runAllTimersAsync()

      nostrSyncService.stopSync(mockAccount.id)

      jest.advanceTimersByTime(60000)

      expect(nostrSyncService.hasActiveSubscription(mockAccount.id)).toBe(false)
    })
  })

  describe('stopAll', () => {
    it('stops all subscriptions', async () => {
      const account2 = { ...mockAccount, id: 'test-account-2' }
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)
      nostrSyncService.setMessageProcessor(account2.id, mockProcessor)

      nostrSyncService.startSync(mockAccount)
      nostrSyncService.startSync(account2)
      await jest.runAllTimersAsync()

      nostrSyncService.stopAll()

      expect(nostrSyncService.getActiveSubscriptionCount()).toBe(0)
    })
  })

  describe('fetchOnce', () => {
    it('returns immediately (non-blocking)', () => {
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)

      const startTime = Date.now()
      nostrSyncService.fetchOnce(mockAccount)
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(10)
    })

    it('does not create persistent subscription', async () => {
      nostrSyncService.setMessageProcessor(mockAccount.id, mockProcessor)

      nostrSyncService.fetchOnce(mockAccount)
      await jest.runAllTimersAsync()

      expect(nostrSyncService.hasActiveSubscription(mockAccount.id)).toBe(false)
    })
  })

  describe('hasActiveSubscription', () => {
    it('returns false for unknown account', () => {
      expect(nostrSyncService.hasActiveSubscription('unknown')).toBe(false)
    })
  })

  describe('getActiveAccountIds', () => {
    it('returns empty array when no subscriptions', () => {
      expect(nostrSyncService.getActiveAccountIds()).toEqual([])
    })
  })
})

describe('nostrSyncService export', () => {
  it('exports an object with EventEmitter methods and sync methods', () => {
    expect(nostrSyncService).toBeDefined()
    expect(typeof nostrSyncService.on).toBe('function')
    expect(typeof nostrSyncService.emit).toBe('function')
    expect(typeof nostrSyncService.startSync).toBe('function')
    expect(typeof nostrSyncService.stopSync).toBe('function')
  })
})
