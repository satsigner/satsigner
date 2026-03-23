import { BOLTZ_CLEARNET_URL, BOLTZ_ONION_URL } from '@/api/boltz'
import { useSwapStore } from '@/store/swap'
import { type Swap } from '@/types/models/Swap'

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

const makeSwap = (overrides: Partial<Swap> = {}): Swap => ({
  id: 'swap-001',
  direction: 'btc-to-lightning',
  status: 'pending',
  amountSats: 10000,
  createdAt: '2024-01-01T00:00:00.000Z',
  sourceAccountId: 'account-btc',
  destinationAccountId: 'account-ln',
  ...overrides
})

describe('swap store', () => {
  beforeEach(() => {
    useSwapStore.setState({
      swaps: [],
      boltzUrl: BOLTZ_CLEARNET_URL
    })
  })

  describe('initial state', () => {
    it('starts with no swaps', () => {
      expect(useSwapStore.getState().swaps).toEqual([])
    })

    it('starts with clearnet Boltz URL', () => {
      expect(useSwapStore.getState().boltzUrl).toBe(BOLTZ_CLEARNET_URL)
    })
  })

  describe('addSwap', () => {
    it('adds a swap to the list', () => {
      const { addSwap } = useSwapStore.getState()
      const swap = makeSwap()

      addSwap(swap)

      expect(useSwapStore.getState().swaps).toHaveLength(1)
      expect(useSwapStore.getState().swaps[0]).toEqual(swap)
    })

    it('prepends new swaps (most recent first)', () => {
      const { addSwap } = useSwapStore.getState()

      addSwap(makeSwap({ id: 'swap-first' }))
      addSwap(makeSwap({ id: 'swap-second' }))

      const { swaps } = useSwapStore.getState()
      expect(swaps[0].id).toBe('swap-second')
      expect(swaps[1].id).toBe('swap-first')
    })

    it('stores both btc-to-lightning and lightning-to-btc swaps', () => {
      const { addSwap } = useSwapStore.getState()

      addSwap(makeSwap({ id: 'sub', direction: 'btc-to-lightning' }))
      addSwap(makeSwap({ id: 'rev', direction: 'lightning-to-btc' }))

      const { swaps } = useSwapStore.getState()
      expect(swaps).toHaveLength(2)
      expect(swaps.find((s) => s.id === 'sub')?.direction).toBe(
        'btc-to-lightning'
      )
      expect(swaps.find((s) => s.id === 'rev')?.direction).toBe(
        'lightning-to-btc'
      )
    })
  })

  describe('updateSwapStatus', () => {
    it('updates the status of a matching swap', () => {
      const { addSwap, updateSwapStatus } = useSwapStore.getState()
      addSwap(makeSwap({ id: 'swap-001', status: 'pending' }))

      updateSwapStatus('swap-001', 'transaction.mempool')

      const swap = useSwapStore.getState().swaps.find((s) => s.id === 'swap-001')
      expect(swap?.status).toBe('transaction.mempool')
    })

    it('does not affect other swaps', () => {
      const { addSwap, updateSwapStatus } = useSwapStore.getState()
      addSwap(makeSwap({ id: 'swap-001', status: 'pending' }))
      addSwap(makeSwap({ id: 'swap-002', status: 'pending' }))

      updateSwapStatus('swap-001', 'transaction.claimed')

      const other = useSwapStore
        .getState()
        .swaps.find((s) => s.id === 'swap-002')
      expect(other?.status).toBe('pending')
    })

    it('merges extra fields into the swap', () => {
      const { addSwap, updateSwapStatus } = useSwapStore.getState()
      addSwap(makeSwap({ id: 'swap-001' }))

      updateSwapStatus('swap-001', 'transaction.claimed', {
        txid: 'abc123txid'
      })

      const swap = useSwapStore.getState().swaps.find((s) => s.id === 'swap-001')
      expect(swap?.status).toBe('transaction.claimed')
      expect(swap?.txid).toBe('abc123txid')
    })

    it('preserves existing fields when merging', () => {
      const { addSwap, updateSwapStatus } = useSwapStore.getState()
      addSwap(
        makeSwap({
          id: 'swap-001',
          amountSats: 50000,
          address: 'bc1qxxx'
        })
      )

      updateSwapStatus('swap-001', 'invoice.set')

      const swap = useSwapStore.getState().swaps.find((s) => s.id === 'swap-001')
      expect(swap?.amountSats).toBe(50000)
      expect(swap?.address).toBe('bc1qxxx')
    })

    it('silently ignores unknown swap IDs', () => {
      const { addSwap, updateSwapStatus } = useSwapStore.getState()
      addSwap(makeSwap({ id: 'swap-001' }))

      expect(() =>
        updateSwapStatus('nonexistent', 'transaction.claimed')
      ).not.toThrow()

      expect(useSwapStore.getState().swaps).toHaveLength(1)
    })
  })

  describe('getSwapsByAccount', () => {
    beforeEach(() => {
      const { addSwap } = useSwapStore.getState()
      addSwap(
        makeSwap({
          id: 'swap-a',
          sourceAccountId: 'btc-account',
          destinationAccountId: 'ln-account'
        })
      )
      addSwap(
        makeSwap({
          id: 'swap-b',
          sourceAccountId: 'other-account',
          destinationAccountId: 'btc-account'
        })
      )
      addSwap(
        makeSwap({
          id: 'swap-c',
          sourceAccountId: 'other-account',
          destinationAccountId: 'other-account-2'
        })
      )
    })

    it('returns swaps where account is the source', () => {
      const swaps = useSwapStore.getState().getSwapsByAccount('btc-account')

      expect(swaps.some((s) => s.id === 'swap-a')).toBe(true)
    })

    it('returns swaps where account is the destination', () => {
      const swaps = useSwapStore.getState().getSwapsByAccount('btc-account')

      expect(swaps.some((s) => s.id === 'swap-b')).toBe(true)
    })

    it('excludes swaps not involving the account', () => {
      const swaps = useSwapStore.getState().getSwapsByAccount('btc-account')

      expect(swaps.some((s) => s.id === 'swap-c')).toBe(false)
    })

    it('returns empty array for unknown account', () => {
      expect(
        useSwapStore.getState().getSwapsByAccount('unknown-account')
      ).toEqual([])
    })
  })

  describe('setBoltzUrl', () => {
    it('updates the Boltz URL', () => {
      useSwapStore.getState().setBoltzUrl(BOLTZ_ONION_URL)

      expect(useSwapStore.getState().boltzUrl).toBe(BOLTZ_ONION_URL)
    })

    it('can switch back to clearnet', () => {
      useSwapStore.getState().setBoltzUrl(BOLTZ_ONION_URL)
      useSwapStore.getState().setBoltzUrl(BOLTZ_CLEARNET_URL)

      expect(useSwapStore.getState().boltzUrl).toBe(BOLTZ_CLEARNET_URL)
    })

    it('does not affect existing swaps when URL changes', () => {
      const { addSwap, setBoltzUrl } = useSwapStore.getState()
      addSwap(makeSwap({ id: 'swap-001' }))

      setBoltzUrl(BOLTZ_ONION_URL)

      expect(useSwapStore.getState().swaps).toHaveLength(1)
      expect(useSwapStore.getState().swaps[0].id).toBe('swap-001')
    })
  })
})
