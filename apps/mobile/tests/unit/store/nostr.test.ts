import { useNostrStore } from '@/store/nostr'

import {
  accountIds,
  nostrKeys,
  psbts,
  timestamps
} from '../utils/nostr_samples'

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
      await addMember(accountIds.primary, nostrKeys.alice.npub)

      const members = getMembers(accountIds.primary)
      expect(members).toHaveLength(1)
      expect(members[0]).toEqual({
        npub: nostrKeys.alice.npub,
        color: '#ff5500'
      })
    })

    it('adds multiple members', async () => {
      const { addMember, getMembers } = useNostrStore.getState()
      await addMember(accountIds.primary, nostrKeys.alice.npub)
      await addMember(accountIds.primary, nostrKeys.bob.npub)

      const members = getMembers(accountIds.primary)
      expect(members).toHaveLength(2)
      expect(members.map((m) => m.npub)).toContain(nostrKeys.alice.npub)
      expect(members.map((m) => m.npub)).toContain(nostrKeys.bob.npub)
    })

    it('prevents duplicate members', async () => {
      const { addMember, getMembers } = useNostrStore.getState()
      await addMember(accountIds.primary, nostrKeys.alice.npub)
      await addMember(accountIds.primary, nostrKeys.alice.npub)

      expect(getMembers(accountIds.primary)).toHaveLength(1)
    })

    it('removes member', async () => {
      const { addMember, removeMember, getMembers } = useNostrStore.getState()
      await addMember(accountIds.primary, nostrKeys.alice.npub)
      await addMember(accountIds.primary, nostrKeys.bob.npub)

      removeMember(accountIds.primary, nostrKeys.alice.npub)

      const members = getMembers(accountIds.primary)
      expect(members).toHaveLength(1)
      expect(members[0].npub).toBe(nostrKeys.bob.npub)
    })

    it('returns empty array for unknown account', () => {
      expect(
        useNostrStore.getState().getMembers(accountIds.nonexistent)
      ).toEqual([])
    })

    it('isolates members between accounts', async () => {
      const { addMember, getMembers } = useNostrStore.getState()
      await addMember(accountIds.primary, nostrKeys.alice.npub)
      await addMember(accountIds.secondary, nostrKeys.bob.npub)

      expect(getMembers(accountIds.primary)).toHaveLength(1)
      expect(getMembers(accountIds.secondary)).toHaveLength(1)
      expect(getMembers(accountIds.primary)[0].npub).toBe(nostrKeys.alice.npub)
      expect(getMembers(accountIds.secondary)[0].npub).toBe(nostrKeys.bob.npub)
    })
  })

  describe('processed messages and events', () => {
    it('tracks processed message IDs without duplicates', () => {
      const { addProcessedMessageId, getProcessedMessageIds } =
        useNostrStore.getState()
      const messageIds = ['msg-abc123', 'msg-def456', 'msg-ghi789']

      for (const id of messageIds) {
        addProcessedMessageId(accountIds.primary, id)
      }
      addProcessedMessageId(accountIds.primary, messageIds[0]) // duplicate

      expect(getProcessedMessageIds(accountIds.primary)).toEqual(messageIds)
    })

    it('tracks processed event IDs without duplicates', () => {
      const { addProcessedEvent, getProcessedEvents } = useNostrStore.getState()
      const eventIds = ['evt-111', 'evt-222', 'evt-333']

      for (const id of eventIds) {
        addProcessedEvent(accountIds.primary, id)
      }
      addProcessedEvent(accountIds.primary, eventIds[0]) // duplicate

      expect(getProcessedEvents(accountIds.primary)).toEqual(eventIds)
    })

    it('clears processed message IDs', () => {
      const {
        addProcessedMessageId,
        clearProcessedMessageIds,
        getProcessedMessageIds
      } = useNostrStore.getState()

      addProcessedMessageId(accountIds.primary, 'msg-1')
      addProcessedMessageId(accountIds.primary, 'msg-2')
      clearProcessedMessageIds(accountIds.primary)

      expect(getProcessedMessageIds(accountIds.primary)).toEqual([])
    })

    it('clears processed events', () => {
      const { addProcessedEvent, clearProcessedEvents, getProcessedEvents } =
        useNostrStore.getState()

      addProcessedEvent(accountIds.primary, 'evt-1')
      clearProcessedEvents(accountIds.primary)

      expect(getProcessedEvents(accountIds.primary)).toEqual([])
    })

    it('isolates processed data between accounts', () => {
      const { addProcessedMessageId, getProcessedMessageIds } =
        useNostrStore.getState()

      addProcessedMessageId(accountIds.primary, 'msg-primary')
      addProcessedMessageId(accountIds.secondary, 'msg-secondary')

      expect(getProcessedMessageIds(accountIds.primary)).toEqual([
        'msg-primary'
      ])
      expect(getProcessedMessageIds(accountIds.secondary)).toEqual([
        'msg-secondary'
      ])
    })
  })

  describe('EOSE timestamps', () => {
    it('sets and gets protocol EOSE timestamp', () => {
      const { setLastProtocolEOSE, getLastProtocolEOSE } =
        useNostrStore.getState()

      setLastProtocolEOSE(accountIds.primary, timestamps.recent)

      expect(getLastProtocolEOSE(accountIds.primary)).toBe(timestamps.recent)
    })

    it('sets and gets data exchange EOSE timestamp', () => {
      const { setLastDataExchangeEOSE, getLastDataExchangeEOSE } =
        useNostrStore.getState()

      setLastDataExchangeEOSE(accountIds.primary, timestamps.genesis)

      expect(getLastDataExchangeEOSE(accountIds.primary)).toBe(
        timestamps.genesis
      )
    })

    it('returns undefined for unknown account', () => {
      const { getLastProtocolEOSE, getLastDataExchangeEOSE } =
        useNostrStore.getState()

      expect(getLastProtocolEOSE(accountIds.nonexistent)).toBeUndefined()
      expect(getLastDataExchangeEOSE(accountIds.nonexistent)).toBeUndefined()
    })

    it('updates timestamps independently', () => {
      const {
        setLastProtocolEOSE,
        setLastDataExchangeEOSE,
        getLastProtocolEOSE,
        getLastDataExchangeEOSE
      } = useNostrStore.getState()

      setLastProtocolEOSE(accountIds.primary, timestamps.genesis)
      setLastDataExchangeEOSE(accountIds.primary, timestamps.recent)

      expect(getLastProtocolEOSE(accountIds.primary)).toBe(timestamps.genesis)
      expect(getLastDataExchangeEOSE(accountIds.primary)).toBe(
        timestamps.recent
      )
    })
  })

  describe('trusted devices', () => {
    it('adds and removes trusted devices', () => {
      const { addTrustedDevice, removeTrustedDevice, getTrustedDevices } =
        useNostrStore.getState()

      addTrustedDevice(accountIds.primary, nostrKeys.alice.npub)
      addTrustedDevice(accountIds.primary, nostrKeys.bob.npub)

      expect(getTrustedDevices(accountIds.primary)).toEqual([
        nostrKeys.alice.npub,
        nostrKeys.bob.npub
      ])

      removeTrustedDevice(accountIds.primary, nostrKeys.alice.npub)

      expect(getTrustedDevices(accountIds.primary)).toEqual([
        nostrKeys.bob.npub
      ])
    })

    it('prevents duplicate trusted devices', () => {
      const { addTrustedDevice, getTrustedDevices } = useNostrStore.getState()

      addTrustedDevice(accountIds.primary, nostrKeys.alice.npub)
      addTrustedDevice(accountIds.primary, nostrKeys.alice.npub)

      expect(getTrustedDevices(accountIds.primary)).toHaveLength(1)
    })

    it('returns empty array for unknown account', () => {
      expect(
        useNostrStore.getState().getTrustedDevices(accountIds.nonexistent)
      ).toEqual([])
    })
  })

  describe('syncing state', () => {
    it('sets and checks syncing state', () => {
      const { setSyncing, isSyncing } = useNostrStore.getState()

      expect(isSyncing(accountIds.primary)).toBe(false)

      setSyncing(accountIds.primary, true)
      expect(isSyncing(accountIds.primary)).toBe(true)

      setSyncing(accountIds.primary, false)
      expect(isSyncing(accountIds.primary)).toBe(false)
    })

    it('returns false for unknown account', () => {
      expect(useNostrStore.getState().isSyncing(accountIds.nonexistent)).toBe(
        false
      )
    })

    it('tracks syncing state per account', () => {
      const { setSyncing, isSyncing } = useNostrStore.getState()

      setSyncing(accountIds.primary, true)
      setSyncing(accountIds.secondary, false)

      expect(isSyncing(accountIds.primary)).toBe(true)
      expect(isSyncing(accountIds.secondary)).toBe(false)
    })
  })

  describe('transaction sharing', () => {
    it('sets and clears transaction data', () => {
      const { setTransactionToShare } = useNostrStore.getState()
      const txData = {
        transaction: 'Please sign this transaction',
        transactionData: { combinedPsbt: psbts.simple }
      }

      setTransactionToShare(txData)
      expect(useNostrStore.getState().transactionToShare).toEqual(txData)

      setTransactionToShare(null)
      expect(useNostrStore.getState().transactionToShare).toBeNull()
    })

    it('overwrites previous transaction data', () => {
      const { setTransactionToShare } = useNostrStore.getState()

      setTransactionToShare({
        transaction: 'First transaction',
        transactionData: { combinedPsbt: psbts.simple }
      })

      setTransactionToShare({
        transaction: 'Second transaction',
        transactionData: { combinedPsbt: psbts.multisig }
      })

      expect(useNostrStore.getState().transactionToShare?.transaction).toBe(
        'Second transaction'
      )
    })
  })

  describe('clearNostrState', () => {
    it('resets all state for account', async () => {
      const store = useNostrStore.getState()

      // Set up state
      await store.addMember(accountIds.primary, nostrKeys.alice.npub)
      store.addProcessedMessageId(accountIds.primary, 'msg-1')
      store.addProcessedEvent(accountIds.primary, 'evt-1')
      store.setLastProtocolEOSE(accountIds.primary, timestamps.recent)
      store.setLastDataExchangeEOSE(accountIds.primary, timestamps.recent)
      store.addTrustedDevice(accountIds.primary, nostrKeys.bob.npub)

      // Clear state
      store.clearNostrState(accountIds.primary)

      // Verify all cleared
      expect(store.getMembers(accountIds.primary)).toEqual([])
      expect(store.getProcessedMessageIds(accountIds.primary)).toEqual([])
      expect(store.getProcessedEvents(accountIds.primary)).toEqual([])
      expect(store.getLastProtocolEOSE(accountIds.primary)).toBe(0)
      expect(store.getLastDataExchangeEOSE(accountIds.primary)).toBe(0)
      expect(store.getTrustedDevices(accountIds.primary)).toEqual([])
    })

    it('does not affect other accounts', async () => {
      const store = useNostrStore.getState()

      await store.addMember(accountIds.primary, nostrKeys.alice.npub)
      await store.addMember(accountIds.secondary, nostrKeys.bob.npub)

      store.clearNostrState(accountIds.primary)

      expect(store.getMembers(accountIds.primary)).toEqual([])
      expect(store.getMembers(accountIds.secondary)).toHaveLength(1)
    })
  })
})
