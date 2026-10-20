import { connectToMint, restoreProofsFromSeed } from '@/api/ecash'
import { restoreProofsFromMints } from '@/services/ecash/restore'
import type {
  EcashAccountStore,
  EcashKeysetCounter,
  EcashMint,
  EcashProof
} from '@/types/models/Ecash'
import { withAdvancedKeysetCounter } from '@/utils/ecashKeysetCounters'

jest.mock<typeof import('@/api/ecash')>('@/api/ecash', () => ({
  __esModule: true,
  connectToMint: jest.fn(),
  getMintBalance: (mintUrl: string, proofs: EcashProof[]) =>
    proofs
      .filter((p) => p.mintUrl === mintUrl)
      .reduce((sum, p) => sum + p.amount, 0),
  restoreProofsFromSeed: jest.fn()
}))

const MINT_URL = 'https://mint.example'
const SEED = new Uint8Array(64)

function mint(url: string): EcashMint {
  return {
    balance: 0,
    isConnected: true,
    keysets: [{ active: true, id: 'ks1', unit: 'sat' }],
    url
  }
}

function proof(amount: number): EcashProof {
  return { C: 'c', amount, id: 'ks1', mintUrl: MINT_URL, secret: `s${amount}` }
}

type AccountState = {
  counters: EcashKeysetCounter[]
  mints: EcashMint[]
  proofs: EcashProof[]
}

function createStore() {
  const state: AccountState = { counters: [], mints: [], proofs: [] }
  const store: EcashAccountStore = {
    addMint: (added) => {
      state.mints = [...state.mints, added]
    },
    addProofs: (added) => {
      state.proofs = [...state.proofs, ...added]
    },
    advanceKeysetCounter: (keysetId, nextCounter) => {
      state.counters = withAdvancedKeysetCounter(
        state.counters,
        keysetId,
        nextCounter
      )
    },
    getCounters: () => state.counters,
    getMints: () => state.mints,
    getProofs: () => state.proofs,
    updateMintBalance: jest.fn()
  }
  return { state, store }
}

describe('restoreProofsFromMints', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('connects new mints, adds proofs and advances the keyset counter', async () => {
    jest.mocked(connectToMint).mockResolvedValue(mint(MINT_URL))
    jest
      .mocked(restoreProofsFromSeed)
      .mockResolvedValue({ lastCounter: 4, proofs: [proof(2), proof(8)] })
    const { state, store } = createStore()

    const summary = await restoreProofsFromMints(
      'acc',
      [` ${MINT_URL} `, MINT_URL, ''],
      SEED,
      store
    )

    expect(summary).toStrictEqual({
      mintsFailed: 0,
      mintsScanned: 1,
      proofsFound: 2,
      totalAmount: 10
    })
    expect(state.counters).toStrictEqual([{ counter: 5, keysetId: 'ks1' }])
    expect(store.updateMintBalance).toHaveBeenCalledWith(MINT_URL, 10)
  })

  it('counts a failing mint and continues', async () => {
    jest.mocked(connectToMint).mockRejectedValue(new Error('offline'))
    const { store } = createStore()

    const summary = await restoreProofsFromMints('acc', [MINT_URL], SEED, store)

    expect(summary.mintsFailed).toBe(1)
    expect(summary.proofsFound).toBe(0)
  })

  it('reuses a listed mint and leaves counters alone without a last counter', async () => {
    jest
      .mocked(restoreProofsFromSeed)
      .mockResolvedValue({ lastCounter: undefined, proofs: [proof(4)] })
    const { state, store } = createStore()
    store.addMint(mint(MINT_URL))
    state.counters = [{ counter: 9, keysetId: 'other' }]

    const summary = await restoreProofsFromMints('acc', [MINT_URL], SEED, store)

    expect(connectToMint).not.toHaveBeenCalled()
    expect(summary.proofsFound).toBe(1)
    expect(state.counters).toStrictEqual([{ counter: 9, keysetId: 'other' }])
  })

  it('keeps other keyset counters when advancing the active one', async () => {
    jest
      .mocked(restoreProofsFromSeed)
      .mockResolvedValue({ lastCounter: 1, proofs: [proof(4)] })
    const { state, store } = createStore()
    store.addMint(mint(MINT_URL))
    state.counters = [{ counter: 9, keysetId: 'other' }]

    await restoreProofsFromMints('acc', [MINT_URL], SEED, store)

    expect(state.counters).toStrictEqual([
      { counter: 9, keysetId: 'other' },
      { counter: 2, keysetId: 'ks1' }
    ])
  })
})
