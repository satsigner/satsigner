import {
  NOSTR_EOSE_TIMEOUT_MS,
  NOSTR_EVENT_FUTURE_TOLERANCE_SEC
} from '@/constants/nostr'
import { processNostrEventBatch } from '@/hooks/useNostrMessageProcessor'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import { NostrNoRelaysError } from '@/utils/errors'
import {
  computeEoseCursor,
  getNostrSyncDiagnostics,
  nostrSyncService,
  resetInstance
} from '@/utils/nostrSyncService'

type MockProcessor = (messages: unknown[]) => Promise<void>

type MockApi = {
  closeAllSubscriptions: jest.Mock
  connect: jest.Mock
  flushQueue: jest.Mock
  getPendingEventCount: jest.Mock
  getQueuedEventCount: jest.Mock
  relays: string[]
  setLoadingCallback: jest.Mock
  subscribeToKind1059: jest.Mock
}

const mockApis: MockApi[] = []
const mockApiSetup: { configure?: (api: MockApi) => void } = {}
const mockAccountsState: { accounts: Account[] } = { accounts: [] }

function mockCreateApi(relays: string[]): MockApi {
  const api: MockApi = {
    closeAllSubscriptions: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    getPendingEventCount: jest.fn().mockReturnValue(0),
    getQueuedEventCount: jest.fn().mockReturnValue(0),
    relays,
    setLoadingCallback: jest.fn(),
    subscribeToKind1059: jest.fn().mockResolvedValue(undefined)
  }
  mockApiSetup.configure?.(api)
  mockApis.push(api)
  return api
}

jest.mock<typeof import('@/api/nostr')>('@/api/nostr', () => ({
  NostrAPI: jest.fn((relays: string[]) => mockCreateApi(relays))
}))

jest.mock<typeof import('@/hooks/useNostrMessageProcessor')>(
  '@/hooks/useNostrMessageProcessor',
  () => ({
    processNostrEventBatch: jest.fn()
  })
)

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: { getState: () => mockAccountsState }
}))

jest.mock<typeof import('@/db/nostrProcessedEvents')>(
  '@/db/nostrProcessedEvents',
  () => ({
    ...jest.requireActual('@/db/nostrProcessedEvents'),
    clearNostrProcessedEvents: jest.fn(),
    markNostrEventsProcessed: jest.fn()
  })
)

jest.mock<typeof import('@/storage/mmkv')>('@/storage/mmkv', () => {
  const storage: Record<string, string> = {}
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((name: string) => storage[name] ?? null),
      removeItem: jest.fn((name: string) => {
        delete storage[name]
      }),
      setItem: jest.fn((name: string, value: string) => {
        storage[name] = value
      })
    }
  }
})

jest.mock<typeof import('@/utils/nostr')>('@/utils/nostr', () => ({
  generateColorFromNpub: jest.fn().mockReturnValue('#ff5500')
}))

const ACCOUNT_ID = 'test-account-1'
const COMMON_NPUB = 'npub1common'
const DEVICE_NPUB = 'npub1device'

function buildAccount(overrides: Partial<Account['nostr']> = {}): Account {
  return {
    addresses: [],
    createdAt: new Date(),
    id: ACCOUNT_ID,
    keyCount: 1,
    keys: [],
    keysRequired: 1,
    labels: {},
    name: 'Test Account',
    network: 'bitcoin',
    nostr: {
      autoSync: true,
      commonNpub: COMMON_NPUB,
      commonNsec: 'nsec1common',
      deviceNpub: DEVICE_NPUB,
      deviceNsec: 'nsec1device',
      dms: [],
      lastUpdated: new Date(),
      relays: ['wss://relay.damus.io'],
      syncStart: new Date(),
      trustedMemberDevices: [],
      ...overrides
    },
    policyType: 'singlesig',
    summary: {
      balance: 0,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'unsynced',
    transactions: [],
    utxos: []
  }
}

function setAccount(account: Account) {
  mockAccountsState.accounts = [account]
}

function apiFor(npub: string): MockApi {
  const api = mockApis.findLast(
    (candidate) => candidate.subscribeToKind1059.mock.calls[0]?.[1] === npub
  )
  if (!api) {
    throw new Error(`no subscription for ${npub}`)
  }
  return api
}

function subscription(api: MockApi) {
  const [[nsec, npub, processor, limit, since, onEose, options]] =
    api.subscribeToKind1059.mock.calls
  return {
    limit,
    npub,
    nsec,
    onEose: () => onEose(),
    options,
    processor: (messages: unknown[]): ReturnType<MockProcessor> =>
      processor(messages),
    since
  }
}

describe('nostrSyncService', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    resetInstance()
    mockApis.length = 0
    mockApiSetup.configure = undefined
    setAccount(buildAccount())
    jest.mocked(processNostrEventBatch).mockResolvedValue({
      failed: [],
      processed: []
    })
    useNostrStore.setState({
      lastDataExchangeEOSE: {},
      lastProtocolEOSE: {},
      syncStatus: {},
      syncingAccounts: {}
    })
  })

  afterEach(async () => {
    await nostrSyncService.stopAll()
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  describe('startSync', () => {
    it('opens one subscription per purpose for the latest stored account', async () => {
      await nostrSyncService.startSync(ACCOUNT_ID)

      expect(mockApis).toHaveLength(2)
      expect(subscription(apiFor(COMMON_NPUB)).nsec).toBe('nsec1common')
      expect(subscription(apiFor(DEVICE_NPUB)).nsec).toBe('nsec1device')
      expect(nostrSyncService.hasActiveSubscription(ACCOUNT_ID)).toBe(true)
      expect(useNostrStore.getState().getSyncStatus(ACCOUNT_ID).status).toBe(
        'syncing'
      )
    })

    it('skips accounts that are not ready', async () => {
      setAccount(buildAccount({ autoSync: false }))
      await nostrSyncService.startSync(ACCOUNT_ID)
      setAccount(buildAccount({ relays: [] }))
      await nostrSyncService.startSync(ACCOUNT_ID)

      expect(mockApis).toHaveLength(0)
      expect(nostrSyncService.hasActiveSubscription(ACCOUNT_ID)).toBe(false)
    })

    it('joins a start already in flight instead of opening another', async () => {
      await Promise.all([
        nostrSyncService.startSync(ACCOUNT_ID),
        nostrSyncService.startSync(ACCOUNT_ID)
      ])

      expect(mockApis).toHaveLength(2)
    })

    it('does not restart when only the account object changes', async () => {
      await nostrSyncService.startSync(ACCOUNT_ID)
      setAccount(
        buildAccount({
          dms: [
            {
              author: 'a',
              created_at: 1,
              description: 'hi',
              event: '',
              id: 'dm-1',
              label: 1
            }
          ]
        })
      )

      await nostrSyncService.startSync(ACCOUNT_ID)

      expect(mockApis).toHaveLength(2)
      for (const api of mockApis) {
        expect(api.closeAllSubscriptions).not.toHaveBeenCalled()
      }
    })

    it('replaces both subscriptions when the relays change', async () => {
      await nostrSyncService.startSync(ACCOUNT_ID)
      const [firstProtocol, firstData] = mockApis
      setAccount(buildAccount({ relays: ['wss://nos.lol'] }))

      await nostrSyncService.startSync(ACCOUNT_ID)

      expect(mockApis).toHaveLength(4)
      expect(firstProtocol.closeAllSubscriptions).toHaveBeenCalledTimes(1)
      expect(firstData.closeAllSubscriptions).toHaveBeenCalledTimes(1)
      expect(nostrSyncService.getLiveApis(ACCOUNT_ID)).toHaveLength(2)
    })

    it('closes the protocol subscription when the data one fails', async () => {
      mockApiSetup.configure = (api) => {
        api.subscribeToKind1059.mockImplementation((_nsec, npub) =>
          npub === DEVICE_NPUB
            ? Promise.reject(new NostrNoRelaysError('down'))
            : Promise.resolve()
        )
      }

      await nostrSyncService.startSync(ACCOUNT_ID)

      expect(apiFor(COMMON_NPUB).closeAllSubscriptions).toHaveBeenCalledWith()
      expect(nostrSyncService.hasActiveSubscription(ACCOUNT_ID)).toBe(false)
      expect(useNostrStore.getState().getSyncStatus(ACCOUNT_ID)).toMatchObject({
        lastError: 'noRelays',
        status: 'error'
      })
    })

    it('retries a failed start with backoff', async () => {
      mockApiSetup.configure = (api) => {
        api.subscribeToKind1059.mockRejectedValue(new NostrNoRelaysError('x'))
        mockApiSetup.configure = undefined
      }

      await nostrSyncService.startSync(ACCOUNT_ID)
      expect(nostrSyncService.hasActiveSubscription(ACCOUNT_ID)).toBe(false)

      await jest.runOnlyPendingTimersAsync()

      expect(nostrSyncService.hasActiveSubscription(ACCOUNT_ID)).toBe(true)
    })
  })

  describe('stopSync', () => {
    it('cancels a start that is still in flight', async () => {
      const releases: (() => void)[] = []
      function holdUntilReleased() {
        return new Promise<void>((resolve) => {
          releases.push(resolve)
        })
      }
      mockApiSetup.configure = (api) => {
        api.subscribeToKind1059.mockImplementation(holdUntilReleased)
      }

      const starting = nostrSyncService.startSync(ACCOUNT_ID)
      await nostrSyncService.stopSync(ACCOUNT_ID)
      for (const release of releases) {
        release()
      }
      await starting

      expect(nostrSyncService.hasActiveSubscription(ACCOUNT_ID)).toBe(false)
      expect(mockApis).toHaveLength(2)
      for (const api of mockApis) {
        expect(api.closeAllSubscriptions).toHaveBeenCalledWith()
      }
    })

    it('awaits cleanup and reports idle', async () => {
      await nostrSyncService.startSync(ACCOUNT_ID)

      await nostrSyncService.stopSync(ACCOUNT_ID)

      for (const api of mockApis) {
        expect(api.flushQueue).toHaveBeenCalledWith()
        expect(api.closeAllSubscriptions).toHaveBeenCalledWith()
      }
      expect(nostrSyncService.hasActiveSubscription(ACCOUNT_ID)).toBe(false)
      expect(useNostrStore.getState().getSyncStatus(ACCOUNT_ID).status).toBe(
        'idle'
      )
    })
  })

  describe('eose cursor', () => {
    it('passes the stored cursor as the catch-up since', async () => {
      useNostrStore.getState().setLastProtocolEOSE(ACCOUNT_ID, 1_700_000_000)

      await nostrSyncService.startSync(ACCOUNT_ID)

      const protocol = subscription(apiFor(COMMON_NPUB))
      expect(protocol.since).toBe(1_700_000_000)
      expect(protocol.options).toStrictEqual({ processedScope: ACCOUNT_ID })
    })

    it('advances to the newest processed event, not to now', async () => {
      jest.mocked(processNostrEventBatch).mockResolvedValue({
        failed: [],
        processed: [
          { createdAt: 1_700_000_100, id: 'a' },
          { createdAt: 1_700_000_200, id: 'b' }
        ]
      })
      await nostrSyncService.startSync(ACCOUNT_ID)
      const protocol = subscription(apiFor(COMMON_NPUB))

      await protocol.processor([{ content: {}, created_at: 0, id: 'a' }])
      protocol.onEose()

      expect(useNostrStore.getState().getLastProtocolEOSE(ACCOUNT_ID)).toBe(
        1_700_000_200
      )
    })

    it('waits for queued events before committing after EOSE', async () => {
      jest.mocked(processNostrEventBatch).mockResolvedValue({
        failed: [],
        processed: [{ createdAt: 1_700_000_300, id: 'c' }]
      })
      await nostrSyncService.startSync(ACCOUNT_ID)
      const api = apiFor(COMMON_NPUB)
      const protocol = subscription(api)

      api.getPendingEventCount.mockReturnValue(600)
      protocol.onEose()
      expect(
        useNostrStore.getState().getLastProtocolEOSE(ACCOUNT_ID)
      ).toBeUndefined()

      await protocol.processor([{ content: {}, created_at: 0, id: 'c' }])

      expect(useNostrStore.getState().getLastProtocolEOSE(ACCOUNT_ID)).toBe(
        1_700_000_300
      )
    })

    it('stays below an event whose handler failed', async () => {
      jest.mocked(processNostrEventBatch).mockResolvedValue({
        failed: [{ createdAt: 1_700_000_150, id: 'bad' }],
        processed: [{ createdAt: 1_700_000_200, id: 'good' }]
      })
      await nostrSyncService.startSync(ACCOUNT_ID)
      const data = subscription(apiFor(DEVICE_NPUB))

      await data.processor([{ content: {}, created_at: 0, id: 'good' }])
      data.onEose()

      expect(useNostrStore.getState().getLastDataExchangeEOSE(ACCOUNT_ID)).toBe(
        1_700_000_149
      )
    })
  })

  describe('untrusted or forged input', () => {
    const YEAR_2100 = 4_102_444_800

    it('a deferred rumor dated 2100 does not move the cursor', async () => {
      useNostrStore
        .getState()
        .setLastDataExchangeEOSE(ACCOUNT_ID, 1_700_000_000)
      jest.mocked(processNostrEventBatch).mockResolvedValue({
        deferred: [{ createdAt: YEAR_2100, id: 'forged' }],
        failed: [],
        ignored: [],
        processed: []
      })
      await nostrSyncService.startSync(ACCOUNT_ID)
      const data = subscription(apiFor(DEVICE_NPUB))

      await data.processor([{ content: {}, created_at: YEAR_2100, id: 'x' }])
      data.onEose()

      expect(useNostrStore.getState().getLastDataExchangeEOSE(ACCOUNT_ID)).toBe(
        1_700_000_000
      )
    })

    it('never advances the cursor past now', async () => {
      jest.setSystemTime(new Date(1_700_000_000_000))
      jest.mocked(processNostrEventBatch).mockResolvedValue({
        deferred: [],
        failed: [],
        ignored: [],
        processed: [{ createdAt: YEAR_2100, id: 'future' }]
      })
      await nostrSyncService.startSync(ACCOUNT_ID)
      const protocol = subscription(apiFor(COMMON_NPUB))

      await protocol.processor([{ content: {}, created_at: 0, id: 'future' }])
      protocol.onEose()

      expect(useNostrStore.getState().getLastProtocolEOSE(ACCOUNT_ID)).toBe(
        1_700_000_000 + NOSTR_EVENT_FUTURE_TOLERANCE_SEC
      )
    })

    it('keeps the cursor below a batch whose processor threw', async () => {
      useNostrStore.getState().setLastProtocolEOSE(ACCOUNT_ID, 1_700_000_500)
      jest
        .mocked(processNostrEventBatch)
        .mockRejectedValue(new Error('sqlite locked'))
      await nostrSyncService.startSync(ACCOUNT_ID)
      const protocol = subscription(apiFor(COMMON_NPUB))
      protocol.onEose()

      await expect(
        protocol.processor([
          { content: {}, created_at: 1_700_000_100, id: 'a' }
        ])
      ).rejects.toThrow('sqlite locked')

      expect(useNostrStore.getState().getLastProtocolEOSE(ACCOUNT_ID)).toBe(
        1_700_000_099
      )
    })
  })

  describe('resetInstance', () => {
    it('keeps a start from before the reset from registering', async () => {
      const releases: (() => void)[] = []
      function holdUntilReleased() {
        return new Promise<void>((resolve) => {
          releases.push(resolve)
        })
      }
      mockApiSetup.configure = (api) => {
        api.subscribeToKind1059.mockImplementation(holdUntilReleased)
      }
      const staleStart = nostrSyncService.startSync(ACCOUNT_ID)
      await resetInstance()
      mockApiSetup.configure = undefined
      await nostrSyncService.startSync(ACCOUNT_ID)

      for (const release of releases) {
        release()
      }
      await staleStart

      const [staleProtocol, staleData] = mockApis
      expect(staleProtocol.closeAllSubscriptions).toHaveBeenCalledWith()
      expect(staleData.closeAllSubscriptions).toHaveBeenCalledWith()
      expect(nostrSyncService.getLiveApis(ACCOUNT_ID)).toStrictEqual(
        mockApis.slice(2)
      )
    })
  })

  describe('computeEoseCursor', () => {
    it('never moves back without failures', () => {
      expect(
        computeEoseCursor(500, { newestProcessed: 100, oldestFailed: null })
      ).toBe(500)
    })

    it('moves below the oldest failed event', () => {
      expect(
        computeEoseCursor(500, { newestProcessed: 600, oldestFailed: 300 })
      ).toBe(299)
    })
  })

  describe('fetchOnce', () => {
    it('treats a relay timeout as an error and schedules a retry', async () => {
      const fetching = nostrSyncService.fetchOnce(ACCOUNT_ID)
      await jest.advanceTimersByTimeAsync(NOSTR_EOSE_TIMEOUT_MS)
      await fetching

      expect(useNostrStore.getState().getSyncStatus(ACCOUNT_ID)).toMatchObject({
        lastError: 'timeout',
        status: 'error'
      })
      expect(nostrSyncService.hasActiveSubscription(ACCOUNT_ID)).toBe(false)
      for (const api of mockApis) {
        expect(api.closeAllSubscriptions).toHaveBeenCalledWith()
      }
      expect(jest.getTimerCount()).toBeGreaterThan(0)
    })

    it('goes idle once every relay finished and the queue drained', async () => {
      const fetching = nostrSyncService.fetchOnce(ACCOUNT_ID)
      await jest.advanceTimersByTimeAsync(0)
      for (const api of mockApis) {
        subscription(api).onEose()
      }
      await fetching

      expect(useNostrStore.getState().getSyncStatus(ACCOUNT_ID).status).toBe(
        'idle'
      )
      expect(nostrSyncService.hasActiveSubscription(ACCOUNT_ID)).toBe(false)
    })
  })

  describe('getNostrSyncDiagnostics', () => {
    it('reports status, cursor ages, queue and subscription keys', async () => {
      jest.setSystemTime(new Date(1_700_000_100_000))
      useNostrStore.getState().setLastProtocolEOSE(ACCOUNT_ID, 1_700_000_000)
      await nostrSyncService.startSync(ACCOUNT_ID)
      apiFor(DEVICE_NPUB).getPendingEventCount.mockReturnValue(3)

      expect(getNostrSyncDiagnostics()).toStrictEqual([
        {
          accountId: ACCOUNT_ID,
          activeSubscriptionKeys: [
            `protocol:${ACCOUNT_ID}`,
            `dataExchange:${ACCOUNT_ID}`
          ],
          eoseCursorAges: { dataExchange: null, protocol: 100 },
          lastErrorCode: null,
          queueLength: 3,
          status: 'syncing'
        }
      ])
    })
  })
})
