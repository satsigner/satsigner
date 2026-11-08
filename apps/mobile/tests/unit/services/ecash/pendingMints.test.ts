import { checkMintQuote, mintProofs } from '@/api/ecash'
import {
  ECASH_MAX_FAILED_MINT_ATTEMPTS,
  ECASH_MINT_QUOTE_EXPIRY_GRACE_MS
} from '@/constants/ecash'
import { MS_PER_SECOND } from '@/constants/time'
import { settlePendingMints } from '@/services/ecash/pendingMints'
import { useEcashStore } from '@/store/ecash'
import type { EcashProof, EcashTransaction } from '@/types/models/Ecash'

jest.mock<Partial<typeof import('@/api/ecash')>>('@/api/ecash', () => ({
  __esModule: true,
  checkMintQuote: jest.fn(),
  getMintBalance: (mintUrl: string, proofs: EcashProof[]) =>
    proofs
      .filter((p) => p.mintUrl === mintUrl)
      .reduce((sum, p) => sum + p.amount, 0),
  mintProofs: jest.fn()
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
const ACTIVE_ACCOUNT = 'active'
const OTHER_ACCOUNT = 'other'
const INVOICE_LIFETIME_SECONDS = 600

function proof(amount: number): EcashProof {
  return { C: 'c', amount, id: 'ks1', mintUrl: MINT_URL, secret: `s${amount}` }
}

function addAccount(id: string) {
  const store = useEcashStore.getState()
  store.addAccount({
    createdAt: '2026-01-01T00:00:00.000Z',
    hasSeed: false,
    id,
    name: id
  })
  store.addMint(id, {
    balance: 0,
    isConnected: true,
    keysets: [{ active: true, id: 'ks1', unit: 'sat' }],
    url: MINT_URL
  })
}

function addPendingMint(
  accountId: string,
  quoteId: string,
  overrides: Partial<EcashTransaction> = {}
) {
  const expiry =
    Math.floor(Date.now() / MS_PER_SECOND) + INVOICE_LIFETIME_SECONDS
  const store = useEcashStore.getState()
  store.addMintQuote(accountId, {
    expiry,
    mintUrl: MINT_URL,
    paid: false,
    quote: quoteId,
    request: `lnbc-${quoteId}`
  })
  store.addTransaction(accountId, {
    amount: 21,
    expiry,
    id: quoteId,
    mintUrl: MINT_URL,
    quoteId,
    status: 'pending',
    timestamp: new Date().toISOString(),
    type: 'mint',
    ...overrides
  })
}

function transactionOf(accountId: string, quoteId: string) {
  return useEcashStore
    .getState()
    .transactions[accountId]?.find(({ id }) => id === quoteId)
}

describe('settlePendingMints', () => {
  beforeEach(() => {
    useEcashStore.getState().clearAllData()
    addAccount(ACTIVE_ACCOUNT)
    addAccount(OTHER_ACCOUNT)
    useEcashStore.getState().setActiveAccountId(ACTIVE_ACCOUNT)
  })

  afterEach(() => {
    jest.mocked(checkMintQuote).mockReset()
    jest.mocked(mintProofs).mockReset()
  })

  it('mints a paid invoice into the account that created it', async () => {
    addPendingMint(OTHER_ACCOUNT, 'paid')
    jest.mocked(checkMintQuote).mockResolvedValue('PAID')
    jest
      .mocked(mintProofs)
      .mockResolvedValue({ proofs: [proof(21)], totalAmount: 21 })

    const settlements = await settlePendingMints()

    expect(settlements.map(({ result }) => result)).toStrictEqual(['minted'])
    const state = useEcashStore.getState()
    expect(state.proofs[OTHER_ACCOUNT]).toStrictEqual([proof(21)])
    expect(state.proofs[ACTIVE_ACCOUNT]).toStrictEqual([])
    expect(state.quotes[OTHER_ACCOUNT].mint).toStrictEqual([])
    expect(state.mints[OTHER_ACCOUNT][0].balance).toBe(21)
    expect(transactionOf(OTHER_ACCOUNT, 'paid')?.status).toBe('completed')
  })

  it('leaves an unpaid invoice pending before its deadline', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'unpaid')
    jest.mocked(checkMintQuote).mockResolvedValue('UNPAID')

    const settlements = await settlePendingMints()

    expect(settlements.map(({ result }) => result)).toStrictEqual(['waiting'])
    expect(transactionOf(ACTIVE_ACCOUNT, 'unpaid')?.status).toBe('pending')
    expect(mintProofs).not.toHaveBeenCalled()
  })

  it('expires an unpaid invoice past its deadline', async () => {
    const pastGrace =
      Date.now() - ECASH_MINT_QUOTE_EXPIRY_GRACE_MS - MS_PER_SECOND
    addPendingMint(ACTIVE_ACCOUNT, 'stale', {
      expiry: Math.floor(pastGrace / MS_PER_SECOND)
    })
    jest.mocked(checkMintQuote).mockResolvedValue('UNPAID')

    await settlePendingMints()

    expect(transactionOf(ACTIVE_ACCOUNT, 'stale')?.status).toBe('expired')
  })

  it('fails an invoice whose proofs the mint issued elsewhere', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'issued')
    jest.mocked(checkMintQuote).mockResolvedValue('ISSUED')

    await settlePendingMints()

    expect(transactionOf(ACTIVE_ACCOUNT, 'issued')?.status).toBe('failed')
    expect(mintProofs).not.toHaveBeenCalled()
  })

  it('asks an unreachable mint again on the next run', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'offline')
    jest.mocked(checkMintQuote).mockRejectedValue(new Error('offline'))

    const settlements = await settlePendingMints()

    expect(settlements.map(({ result }) => result)).toStrictEqual(['waiting'])
    expect(transactionOf(ACTIVE_ACCOUNT, 'offline')?.status).toBe('pending')
  })

  it('mints a quote once when runs overlap', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'overlap')
    jest.mocked(checkMintQuote).mockResolvedValue('PAID')
    jest
      .mocked(mintProofs)
      .mockResolvedValue({ proofs: [proof(21)], totalAmount: 21 })

    await Promise.all([settlePendingMints(), settlePendingMints()])

    expect(mintProofs).toHaveBeenCalledTimes(1)
  })

  it('stops minting a quote after repeated failures', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'broken')
    jest.mocked(checkMintQuote).mockResolvedValue('PAID')
    jest.mocked(mintProofs).mockRejectedValue(new Error('mint error'))

    const runs = Array.from({ length: ECASH_MAX_FAILED_MINT_ATTEMPTS + 1 })
    for (const _run of runs) {
      await settlePendingMints()
    }

    expect(mintProofs).toHaveBeenCalledTimes(ECASH_MAX_FAILED_MINT_ATTEMPTS)
    expect(transactionOf(ACTIVE_ACCOUNT, 'broken')?.status).toBe('pending')
  })
})
