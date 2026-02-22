import { NostrSyncService, nostrSyncService } from '@/services/nostr/NostrSyncService'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'

// Mock dependencies
jest.mock('@/api/nostr', () => ({
  NostrAPI: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    subscribeToKind1059: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    closeAllSubscriptions: jest.fn().mockResolvedValue(undefined),
    setLoadingCallback: jest.fn()
  })),
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

describe('NostrSyncService', () => {
  let service: NostrSyncService
  let mockProcessor: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    // Reset the singleton for each test
    NostrSyncService.resetInstance()
    service = NostrSyncService.getInstance()
    mockProcessor = jest.fn()

    // Reset store state
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
    service.stopAll()
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  describe('singleton pattern', () => {
    it('returns the same instance', () => {
      const instance1 = NostrSyncService.getInstance()
      const instance2 = NostrSyncService.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('creates new instance after reset', () => {
      const instance1 = NostrSyncService.getInstance()
      NostrSyncService.resetInstance()
      const instance2 = NostrSyncService.getInstance()
      expect(instance1).not.toBe(instance2)
    })
  })

  describe('startSync', () => {
    it('returns immediately (non-blocking)', () => {
      service.setMessageProcessor(mockAccount.id, mockProcessor)

      const startTime = Date.now()
      service.startSync(mockAccount)
      const elapsed = Date.now() - startTime

      // Should return immediately (< 10ms)
      expect(elapsed).toBeLessThan(10)
    })

    it('emits status events during sync', async () => {
      const statusEvents: string[] = []
      service.on('status', (e) => statusEvents.push(e.status))
      service.setMessageProcessor(mockAccount.id, mockProcessor)

      service.startSync(mockAccount)

      // Allow promises to resolve
      await jest.runAllTimersAsync()

      expect(statusEvents).toContain('connecting')
    })

    it('skips if autoSync is disabled', async () => {
      const disabledAccount = {
        ...mockAccount,
        nostr: { ...mockAccount.nostr, autoSync: false }
      }
      service.setMessageProcessor(disabledAccount.id, mockProcessor)

      service.startSync(disabledAccount)

      await jest.runAllTimersAsync()

      expect(service.hasActiveSubscription(disabledAccount.id)).toBe(false)
    })

    it('skips if no relays configured', async () => {
      const noRelaysAccount = {
        ...mockAccount,
        nostr: { ...mockAccount.nostr, relays: [] }
      }
      service.setMessageProcessor(noRelaysAccount.id, mockProcessor)

      service.startSync(noRelaysAccount)

      await jest.runAllTimersAsync()

      expect(service.hasActiveSubscription(noRelaysAccount.id)).toBe(false)
    })

    it('skips if already subscribing', async () => {
      service.setMessageProcessor(mockAccount.id, mockProcessor)

      // Start two syncs immediately
      service.startSync(mockAccount)
      service.startSync(mockAccount)

      await jest.runAllTimersAsync()

      // Should only have one subscription
      expect(service.getActiveSubscriptionCount()).toBeLessThanOrEqual(1)
    })
  })

  describe('stopSync', () => {
    it('stops sync and emits idle status', async () => {
      const statusEvents: string[] = []
      service.on('status', (e) => statusEvents.push(e.status))
      service.setMessageProcessor(mockAccount.id, mockProcessor)

      service.startSync(mockAccount)
      await jest.runAllTimersAsync()

      service.stopSync(mockAccount.id)

      expect(statusEvents).toContain('idle')
      expect(service.hasActiveSubscription(mockAccount.id)).toBe(false)
    })

    it('cancels pending retry', async () => {
      service.setMessageProcessor(mockAccount.id, mockProcessor)

      // Simulate an error that would trigger retry
      const { NostrAPI } = require('@/api/nostr')
      NostrAPI.mockImplementation(() => ({
        connect: jest.fn().mockRejectedValue(new Error('Network error')),
        setLoadingCallback: jest.fn()
      }))

      service.startSync(mockAccount)
      await jest.runAllTimersAsync()

      // Stop should cancel any pending retry
      service.stopSync(mockAccount.id)

      // Advance timers - retry should not occur
      jest.advanceTimersByTime(60000)

      expect(service.hasActiveSubscription(mockAccount.id)).toBe(false)
    })
  })

  describe('stopAll', () => {
    it('stops all subscriptions', async () => {
      const account2 = { ...mockAccount, id: 'test-account-2' }
      service.setMessageProcessor(mockAccount.id, mockProcessor)
      service.setMessageProcessor(account2.id, mockProcessor)

      service.startSync(mockAccount)
      service.startSync(account2)
      await jest.runAllTimersAsync()

      service.stopAll()

      expect(service.getActiveSubscriptionCount()).toBe(0)
    })
  })

  describe('fetchOnce', () => {
    it('returns immediately (non-blocking)', () => {
      service.setMessageProcessor(mockAccount.id, mockProcessor)

      const startTime = Date.now()
      service.fetchOnce(mockAccount)
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(10)
    })

    it('does not create persistent subscription', async () => {
      service.setMessageProcessor(mockAccount.id, mockProcessor)

      service.fetchOnce(mockAccount)
      await jest.runAllTimersAsync()

      // fetchOnce should not create a persistent subscription
      expect(service.hasActiveSubscription(mockAccount.id)).toBe(false)
    })
  })

  describe('hasActiveSubscription', () => {
    it('returns false for unknown account', () => {
      expect(service.hasActiveSubscription('unknown')).toBe(false)
    })
  })

  describe('getActiveAccountIds', () => {
    it('returns empty array when no subscriptions', () => {
      expect(service.getActiveAccountIds()).toEqual([])
    })
  })
})

describe('nostrSyncService export', () => {
  it('exports a singleton instance', () => {
    expect(nostrSyncService).toBeInstanceOf(NostrSyncService)
  })
})
