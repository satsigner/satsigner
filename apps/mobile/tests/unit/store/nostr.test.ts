import { useNostrStore } from '@/store/nostr'

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

jest.mock('@/api/nostr', () => ({ NostrAPI: jest.fn() }))

describe('nostr store', () => {
  const accountId = 'test-account-1'

  beforeEach(() => {
    useNostrStore.setState({
      members: {},
      processedMessageIds: {},
      processedEvents: {},
      lastProtocolEOSE: {},
      lastDataExchangeEOSE: {},
      trustedDevices: {},
      activeSubscriptions: new Set(),
      syncingAccounts: {},
      transactionToShare: null
    })
  })

  describe('member management', () => {
    it('adds member with generated color', async () => {
      const { addMember, getMembers } = useNostrStore.getState()
      await addMember(accountId, 'npub1member123')
      const members = getMembers(accountId)
      expect(members).toHaveLength(1)
      expect(members[0]).toEqual({ npub: 'npub1member123', color: '#ff5500' })
    })

    it('prevents duplicate members', async () => {
      const { addMember, getMembers } = useNostrStore.getState()
      await addMember(accountId, 'npub1member123')
      await addMember(accountId, 'npub1member123')
      expect(getMembers(accountId)).toHaveLength(1)
    })

    it('removes member', async () => {
      const { addMember, removeMember, getMembers } = useNostrStore.getState()
      await addMember(accountId, 'npub1member123')
      removeMember(accountId, 'npub1member123')
      expect(getMembers(accountId)).toHaveLength(0)
    })

    it('returns empty array for unknown account', () => {
      expect(useNostrStore.getState().getMembers('unknown')).toEqual([])
    })
  })

  describe('processed messages and events', () => {
    it('tracks processed message IDs', () => {
      const { addProcessedMessageId, getProcessedMessageIds } =
        useNostrStore.getState()
      addProcessedMessageId(accountId, 'msg-1')
      addProcessedMessageId(accountId, 'msg-2')
      addProcessedMessageId(accountId, 'msg-1') // duplicate
      expect(getProcessedMessageIds(accountId)).toEqual(['msg-1', 'msg-2'])
    })

    it('tracks processed event IDs', () => {
      const { addProcessedEvent, getProcessedEvents } = useNostrStore.getState()
      addProcessedEvent(accountId, 'evt-1')
      addProcessedEvent(accountId, 'evt-2')
      addProcessedEvent(accountId, 'evt-1') // duplicate
      expect(getProcessedEvents(accountId)).toEqual(['evt-1', 'evt-2'])
    })

    it('clears processed message IDs', () => {
      const {
        addProcessedMessageId,
        clearProcessedMessageIds,
        getProcessedMessageIds
      } = useNostrStore.getState()
      addProcessedMessageId(accountId, 'msg-1')
      clearProcessedMessageIds(accountId)
      expect(getProcessedMessageIds(accountId)).toEqual([])
    })

    it('clears processed events', () => {
      const { addProcessedEvent, clearProcessedEvents, getProcessedEvents } =
        useNostrStore.getState()
      addProcessedEvent(accountId, 'evt-1')
      clearProcessedEvents(accountId)
      expect(getProcessedEvents(accountId)).toEqual([])
    })
  })

  describe('EOSE timestamps', () => {
    it('sets and gets protocol EOSE timestamp', () => {
      const { setLastProtocolEOSE, getLastProtocolEOSE } =
        useNostrStore.getState()
      setLastProtocolEOSE(accountId, 1704067200)
      expect(getLastProtocolEOSE(accountId)).toBe(1704067200)
    })

    it('sets and gets data exchange EOSE timestamp', () => {
      const { setLastDataExchangeEOSE, getLastDataExchangeEOSE } =
        useNostrStore.getState()
      setLastDataExchangeEOSE(accountId, 1704067200)
      expect(getLastDataExchangeEOSE(accountId)).toBe(1704067200)
    })

    it('returns undefined for unknown account', () => {
      const { getLastProtocolEOSE, getLastDataExchangeEOSE } =
        useNostrStore.getState()
      expect(getLastProtocolEOSE('unknown')).toBeUndefined()
      expect(getLastDataExchangeEOSE('unknown')).toBeUndefined()
    })
  })

  describe('trusted devices', () => {
    it('adds and removes trusted devices', () => {
      const { addTrustedDevice, removeTrustedDevice, getTrustedDevices } =
        useNostrStore.getState()
      addTrustedDevice(accountId, 'npub1device1')
      addTrustedDevice(accountId, 'npub1device2')
      addTrustedDevice(accountId, 'npub1device1') // duplicate
      expect(getTrustedDevices(accountId)).toEqual([
        'npub1device1',
        'npub1device2'
      ])
      removeTrustedDevice(accountId, 'npub1device1')
      expect(getTrustedDevices(accountId)).toEqual(['npub1device2'])
    })

    it('returns empty array for unknown account', () => {
      expect(useNostrStore.getState().getTrustedDevices('unknown')).toEqual([])
    })
  })

  describe('syncing state', () => {
    it('sets and checks syncing state', () => {
      const { setSyncing, isSyncing } = useNostrStore.getState()
      expect(isSyncing(accountId)).toBe(false)
      setSyncing(accountId, true)
      expect(isSyncing(accountId)).toBe(true)
      setSyncing(accountId, false)
      expect(isSyncing(accountId)).toBe(false)
    })

    it('returns false for unknown account', () => {
      expect(useNostrStore.getState().isSyncing('unknown')).toBe(false)
    })
  })

  describe('transaction sharing', () => {
    it('sets and clears transaction data', () => {
      const { setTransactionToShare } = useNostrStore.getState()
      const txData = {
        message: 'Test',
        transactionData: { combinedPsbt: 'cHNidP8...' }
      }
      setTransactionToShare(txData)
      expect(useNostrStore.getState().transactionToShare).toEqual(txData)
      setTransactionToShare(null)
      expect(useNostrStore.getState().transactionToShare).toBeNull()
    })
  })

  describe('clearNostrState', () => {
    it('resets all state for account', async () => {
      const store = useNostrStore.getState()
      await store.addMember(accountId, 'npub1member1')
      store.addProcessedMessageId(accountId, 'msg-1')
      store.addProcessedEvent(accountId, 'evt-1')
      store.setLastProtocolEOSE(accountId, 1704067200)
      store.setLastDataExchangeEOSE(accountId, 1704067200)
      store.addTrustedDevice(accountId, 'npub1device1')

      store.clearNostrState(accountId)

      expect(store.getMembers(accountId)).toEqual([])
      expect(store.getProcessedMessageIds(accountId)).toEqual([])
      expect(store.getProcessedEvents(accountId)).toEqual([])
      expect(store.getLastProtocolEOSE(accountId)).toBe(0)
      expect(store.getLastDataExchangeEOSE(accountId)).toBe(0)
      expect(store.getTrustedDevices(accountId)).toEqual([])
    })
  })
})
