import { connectToMint, restoreProofsFromSeed } from '@/api/ecash'
import {
  type EcashAccountStore,
  restoreProofsFromMints
} from '@/services/ecash/restore'
import type {
  EcashKeysetCounter,
  EcashMint,
  EcashProof
} from '@/types/models/Ecash'

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

function createStore() {
  const state = {
    counters: [] as EcashKeysetCounter[],
    mints: [] as EcashMint[],
    proofs: [] as EcashProof[]
  }
  const store: EcashAccountStore = {
    addMint: (added) => {
      state.mints = [...state.mints, added]
    },
    addProofs: (added) => {
      state.proofs = [...state.proofs, ...added]
    },
    getCounters: () => state.counters,
    getMints: () => state.mints,
    getProofs: () => state.proofs,
    updateCounters: (counters) => {
      state.counters = counters
    },
    updateMintBalance: jest.fn()
  }
  return { state, store }
}

describe('restoreProofsFromMints', () => {
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
})
