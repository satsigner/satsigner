import * as SecureStore from 'expo-secure-store'

import { restoreProofsFromSeed } from '@/api/ecash'
import { getEcashMnemonic, storeEcashMnemonic } from '@/storage/encrypted'
import { mnemonicToSeed } from '@/utils/bip39'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStore: Record<string, string> = (SecureStore as any).__store

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const MOCK_KEYSETS = [
  { active: true, id: 'ks-active-1', unit: 'sat' },
  { active: false, id: 'ks-inactive-1', unit: 'sat' },
  { active: true, id: 'ks-eur-1', unit: 'eur' }
]

const mockRestore = jest.fn()
const mockLoadMint = jest.fn().mockResolvedValue(undefined)
const mockCheckProofsStates = jest.fn()
const mockGetKeys = jest.fn().mockResolvedValue(undefined)
const mockGetKeySets = jest.fn().mockResolvedValue({ keysets: MOCK_KEYSETS })

jest.mock<typeof import('@cashu/cashu-ts')>('@cashu/cashu-ts', () => {
  const CheckStateEnum = {
    PENDING: 'PENDING',
    SPENT: 'SPENT',
    UNSPENT: 'UNSPENT'
  }

  class MockMint {
    _mintUrl: string
    constructor(url: string) {
      this._mintUrl = url
    }
    getKeySets = mockGetKeySets
  }

  class MockWallet {
    mint: MockMint
    loadMint = mockLoadMint
    restore = mockRestore
    checkProofsStates = mockCheckProofsStates
    getKeys = mockGetKeys
    getMintInfo = jest.fn(() => ({ name: 'Test Mint' }))

    constructor(mint: MockMint) {
      this.mint = mint
    }
  }

  return {
    CheckStateEnum,
    Mint: MockMint,
    Wallet: MockWallet,
    getDecodedToken: jest.fn(),
    getEncodedTokenV3: jest.fn(() => 'cashuA...'),
    getEncodedTokenV4: jest.fn(() => 'cashuB...')
  }
})

describe('ecash seed recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key]
    }
    mockLoadMint.mockResolvedValue(undefined)
    mockGetKeySets.mockResolvedValue({ keysets: MOCK_KEYSETS })
    mockGetKeys.mockResolvedValue(undefined)
  })

  describe('mnemonic to seed conversion', () => {
    it('produces a 64-byte Uint8Array from a valid mnemonic', () => {
      const seed = mnemonicToSeed(TEST_MNEMONIC, '')

      expect(seed).toBeInstanceOf(Uint8Array)
      expect(seed).toHaveLength(64)
    })

    it('produces deterministic output for the same mnemonic', () => {
      const seed1 = mnemonicToSeed(TEST_MNEMONIC, '')
      const seed2 = mnemonicToSeed(TEST_MNEMONIC, '')

      expect(seed1).toStrictEqual(seed2)
    })

    it('produces different seeds for different mnemonics', () => {
      const seed1 = mnemonicToSeed(TEST_MNEMONIC, '')
      const seed2 = mnemonicToSeed(
        'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
        ''
      )

      expect(seed1).not.toStrictEqual(seed2)
    })

    it('produces different seeds with different passphrases', () => {
      const seedNoPass = mnemonicToSeed(TEST_MNEMONIC, '')
      const seedWithPass = mnemonicToSeed(TEST_MNEMONIC, 'secret')

      expect(seedNoPass).not.toStrictEqual(seedWithPass)
    })
  })

  describe('getSeedForAccount flow', () => {
    it('retrieves mnemonic from storage and converts to seed', async () => {
      await storeEcashMnemonic('acc-1', TEST_MNEMONIC)

      const mnemonic = await getEcashMnemonic('acc-1')
      expect(mnemonic).toBe(TEST_MNEMONIC)

      const seed = mnemonicToSeed(mnemonic!, '')
      expect(seed).toBeInstanceOf(Uint8Array)
      expect(seed).toHaveLength(64)
    })

    it('returns null when no mnemonic is stored', async () => {
      const mnemonic = await getEcashMnemonic('nonexistent')
      expect(mnemonic).toBeNull()
    })
  })

  describe('restoreProofsFromSeed', () => {
    const seed = mnemonicToSeed(TEST_MNEMONIC, '')
    const mintUrl = 'https://mint.example.com'

    it('returns empty proofs when restore finds nothing', async () => {
      mockRestore.mockResolvedValue({
        lastCounterWithSignature: undefined,
        proofs: []
      })

      const result = await restoreProofsFromSeed('acc-1', mintUrl, seed)

      expect(result.proofs).toStrictEqual([])
      expect(result.lastCounter).toBeUndefined()
    })

    it('filters out non-sat keysets', async () => {
      mockRestore.mockResolvedValue({
        lastCounterWithSignature: undefined,
        proofs: []
      })

      await restoreProofsFromSeed('acc-1', mintUrl, seed)

      const calledKeysetIds = mockRestore.mock.calls.map(
        (call: unknown[]) => (call[2] as { keysetId: string }).keysetId
      )
      expect(calledKeysetIds).not.toContain('ks-eur-1')
    })

    it('prioritizes active keysets over inactive ones', async () => {
      const callOrder: string[] = []
      mockRestore.mockImplementation(
        (_start: number, _batch: number, opts: { keysetId: string }) => {
          callOrder.push(opts.keysetId)
          return Promise.resolve({
            lastCounterWithSignature: undefined,
            proofs: []
          })
        }
      )

      await restoreProofsFromSeed('acc-1', mintUrl, seed)

      const activeIdx = callOrder.indexOf('ks-active-1')
      const inactiveIdx = callOrder.indexOf('ks-inactive-1')
      expect(activeIdx).toBeGreaterThanOrEqual(0)
      expect(inactiveIdx).toBeGreaterThanOrEqual(0)
      expect(activeIdx).toBeLessThan(inactiveIdx)
    })

    it('returns unspent proofs with mintUrl attached', async () => {
      const mockProofs = [
        { C: 'C1', amount: 64, id: 'ks-active-1', secret: 's1' },
        { C: 'C2', amount: 128, id: 'ks-active-1', secret: 's2' }
      ]

      mockRestore
        .mockResolvedValueOnce({
          lastCounterWithSignature: 10,
          proofs: mockProofs
        })
        // Two empty batches to stop the loop
        .mockResolvedValueOnce({ proofs: [] })
        .mockResolvedValueOnce({ proofs: [] })
        // Inactive keyset — no proofs
        .mockResolvedValueOnce({ proofs: [] })

      mockCheckProofsStates.mockResolvedValue([
        { state: 'UNSPENT' },
        { state: 'SPENT' }
      ])

      const result = await restoreProofsFromSeed('acc-1', mintUrl, seed)

      expect(result.proofs).toHaveLength(1)
      expect(result.proofs[0].amount).toBe(64)
      expect(result.proofs[0].mintUrl).toBe(mintUrl)
      expect(result.lastCounter).toBe(10)
    })

    it('tracks lastCounter across multiple batches', async () => {
      mockRestore
        // First batch: proofs found, counter at 20
        .mockResolvedValueOnce({
          lastCounterWithSignature: 20,
          proofs: [{ C: 'C1', amount: 64, id: 'ks-active-1', secret: 's1' }]
        })
        // Second batch: more proofs, counter at 45
        .mockResolvedValueOnce({
          lastCounterWithSignature: 45,
          proofs: [{ C: 'C2', amount: 32, id: 'ks-active-1', secret: 's2' }]
        })
        // Two empty batches to stop
        .mockResolvedValueOnce({ proofs: [] })
        .mockResolvedValueOnce({ proofs: [] })
        // Inactive keyset
        .mockResolvedValueOnce({ proofs: [] })

      mockCheckProofsStates.mockResolvedValue([
        { state: 'UNSPENT' },
        { state: 'UNSPENT' }
      ])

      const result = await restoreProofsFromSeed('acc-1', mintUrl, seed)

      expect(result.lastCounter).toBe(45)
      expect(result.proofs).toHaveLength(2)
    })

    it('continues scanning after gaps in proofs', async () => {
      mockRestore
        // First batch: proofs found
        .mockResolvedValueOnce({
          lastCounterWithSignature: 5,
          proofs: [{ C: 'C1', amount: 16, id: 'ks-active-1', secret: 's1' }]
        })
        // One empty batch (gap)
        .mockResolvedValueOnce({ proofs: [] })
        // More proofs found after gap
        .mockResolvedValueOnce({
          lastCounterWithSignature: 60,
          proofs: [{ C: 'C3', amount: 32, id: 'ks-active-1', secret: 's3' }]
        })
        // Two empty to stop
        .mockResolvedValueOnce({ proofs: [] })
        .mockResolvedValueOnce({ proofs: [] })
        // Inactive keyset
        .mockResolvedValueOnce({ proofs: [] })

      mockCheckProofsStates.mockResolvedValue([
        { state: 'UNSPENT' },
        { state: 'UNSPENT' }
      ])

      const result = await restoreProofsFromSeed('acc-1', mintUrl, seed)

      expect(result.proofs).toHaveLength(2)
      expect(result.lastCounter).toBe(60)
    })

    it('stops after MAX_EMPTY_BATCHES consecutive empty results', async () => {
      mockRestore
        // First batch: proofs found
        .mockResolvedValueOnce({
          lastCounterWithSignature: 5,
          proofs: [{ C: 'C1', amount: 16, id: 'ks-active-1', secret: 's1' }]
        })
        // Two consecutive empty batches → stop
        .mockResolvedValueOnce({ proofs: [] })
        .mockResolvedValueOnce({ proofs: [] })
        // Inactive keyset
        .mockResolvedValueOnce({ proofs: [] })

      mockCheckProofsStates.mockResolvedValue([{ state: 'UNSPENT' }])

      await restoreProofsFromSeed('acc-1', mintUrl, seed)

      // 1 initial + 2 empty (active) + 1 (inactive) = 4
      expect(mockRestore).toHaveBeenCalledTimes(4)
    })

    it('handles keyset failure gracefully and continues to next', async () => {
      mockRestore
        // Active keyset throws
        .mockRejectedValueOnce(new Error('Network error'))
        // Inactive keyset works
        .mockResolvedValueOnce({
          lastCounterWithSignature: 3,
          proofs: [
            { C: 'C-ok', amount: 256, id: 'ks-inactive-1', secret: 'sok' }
          ]
        })
        .mockResolvedValueOnce({ proofs: [] })
        .mockResolvedValueOnce({ proofs: [] })

      mockCheckProofsStates.mockResolvedValue([{ state: 'UNSPENT' }])

      const result = await restoreProofsFromSeed('acc-1', mintUrl, seed)

      expect(result.proofs).toHaveLength(1)
      expect(result.proofs[0].amount).toBe(256)
    })

    it('filters spent proofs from restore results', async () => {
      mockRestore
        .mockResolvedValueOnce({
          lastCounterWithSignature: 15,
          proofs: [
            { C: 'C1', amount: 64, id: 'ks-active-1', secret: 's1' },
            { C: 'C2', amount: 32, id: 'ks-active-1', secret: 's2' },
            { C: 'C3', amount: 16, id: 'ks-active-1', secret: 's3' }
          ]
        })
        .mockResolvedValueOnce({ proofs: [] })
        .mockResolvedValueOnce({ proofs: [] })
        .mockResolvedValueOnce({ proofs: [] })

      mockCheckProofsStates.mockResolvedValue([
        { state: 'UNSPENT' },
        { state: 'SPENT' },
        { state: 'UNSPENT' }
      ])

      const result = await restoreProofsFromSeed('acc-1', mintUrl, seed)

      expect(result.proofs).toHaveLength(2)
      expect(result.proofs[0].amount).toBe(64)
      expect(result.proofs[1].amount).toBe(16)
    })
  })
})
