import { checkMeltQuoteState } from '@/api/ecash'
import { settlePendingMelts } from '@/services/ecash/pendingMelts'
import { useEcashStore } from '@/store/ecash'
import type { EcashProof } from '@/types/models/Ecash'

jest.mock<Partial<typeof import('@/api/ecash')>>('@/api/ecash', () => ({
  __esModule: true,
  checkMeltQuoteState: jest.fn(),
  getMintBalance: (mintUrl: string, proofs: EcashProof[]) =>
    proofs
      .filter((p) => p.mintUrl === mintUrl)
      .reduce((sum, p) => sum + p.amount, 0)
}))

jest.mock<typeof import('@/services/ecash/walletOptions')>(
  '@/services/ecash/walletOptions',
  () => ({
    __esModule: true,
    getEcashCounters: jest.fn(() => []),
    getEcashSeed: jest.fn(),
    getEcashWalletOptions: jest.fn().mockResolvedValue({})
  })
)

const MINT_URL = 'https://mint.example'
const ACCOUNT = 'acc'

function proof(secret: string, amount: number): EcashProof {
  return { C: `c-${secret}`, amount, id: 'ks1', mintUrl: MINT_URL, secret }
}

const SPENDABLE = proof('spendable', 4)
const RESERVED = proof('reserved', 60)

function addPendingMelt(quoteId: string) {
  useEcashStore.getState().addTransaction(ACCOUNT, {
    amount: 60,
    id: quoteId,
    mintUrl: MINT_URL,
    quoteId,
    reservedProofs: [RESERVED],
    status: 'pending',
    timestamp: new Date().toISOString(),
    type: 'melt'
  })
}

function transactionOf(quoteId: string) {
  return useEcashStore
    .getState()
    .transactions[ACCOUNT]?.find(({ id }) => id === quoteId)
}

describe('settlePendingMelts', () => {
  beforeEach(() => {
    const store = useEcashStore.getState()
    store.clearAllData()
    store.addAccount({
      createdAt: '2026-01-01T00:00:00.000Z',
      hasSeed: false,
      id: ACCOUNT,
      name: ACCOUNT
    })
    store.addMint(ACCOUNT, {
      balance: 4,
      isConnected: true,
      keysets: [{ active: true, id: 'ks1', unit: 'sat' }],
      url: MINT_URL
    })
    store.addProofs(ACCOUNT, [SPENDABLE])
  })

  afterEach(() => {
    jest.mocked(checkMeltQuoteState).mockReset()
  })

  it('keeps a still pending payment reserved', async () => {
    addPendingMelt('inFlight')
    jest.mocked(checkMeltQuoteState).mockResolvedValue('pending')

    await expect(settlePendingMelts()).resolves.toStrictEqual(['waiting'])

    expect(useEcashStore.getState().proofs[ACCOUNT]).toStrictEqual([SPENDABLE])
    expect(transactionOf('inFlight')?.reservedProofs).toStrictEqual([RESERVED])
  })

  it('keeps the payment reserved while the mint is unreachable', async () => {
    addPendingMelt('offline')
    jest.mocked(checkMeltQuoteState).mockRejectedValue(new Error('offline'))

    await expect(settlePendingMelts()).resolves.toStrictEqual(['waiting'])

    expect(transactionOf('offline')?.status).toBe('pending')
  })

  it('settles a paid payment and drops its reserved proofs', async () => {
    addPendingMelt('paid')
    jest.mocked(checkMeltQuoteState).mockResolvedValue('paid')

    await expect(settlePendingMelts()).resolves.toStrictEqual(['paid'])

    const state = useEcashStore.getState()
    expect(state.proofs[ACCOUNT]).toStrictEqual([SPENDABLE])
    expect(transactionOf('paid')?.status).toBe('settled')
    expect(transactionOf('paid')?.reservedProofs).toBeUndefined()
  })

  it('returns the reserved proofs to the balance when the payment fails', async () => {
    addPendingMelt('failed')
    jest.mocked(checkMeltQuoteState).mockResolvedValue('unpaid')

    await expect(settlePendingMelts()).resolves.toStrictEqual(['released'])

    const state = useEcashStore.getState()
    expect(state.proofs[ACCOUNT]).toStrictEqual([SPENDABLE, RESERVED])
    expect(state.mints[ACCOUNT][0].balance).toBe(64)
    expect(transactionOf('failed')?.status).toBe('failed')
    expect(transactionOf('failed')?.reservedProofs).toBeUndefined()
  })
})
