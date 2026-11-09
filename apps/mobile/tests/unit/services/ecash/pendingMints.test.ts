import { checkMintQuote, mintProofs } from '@/api/ecash'
import {
  ECASH_MAX_FAILED_MINT_ATTEMPTS,
  ECASH_MINT_QUOTE_EXPIRY_GRACE_MS,
  ECASH_PENDING_MINT_MAX_AGE_MS,
  ECASH_PENDING_MINT_TIMEOUT_MS
} from '@/constants/ecash'
import { MS_PER_SECOND } from '@/constants/time'
import { settlePendingMints } from '@/services/ecash/pendingMints'
import { restoreProofsFromMints } from '@/services/ecash/restore'
import { getEcashSeed } from '@/services/ecash/walletOptions'
import { useEcashStore } from '@/store/ecash'
import type {
  EcashProof,
  EcashTransaction,
  MintQuoteState
} from '@/types/models/Ecash'

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

jest.mock<typeof import('@/services/ecash/restore')>(
  '@/services/ecash/restore',
  () => ({
    __esModule: true,
    restoreProofsFromMints: jest.fn()
  })
)

const MINT_URL = 'https://mint.example'
const ACTIVE_ACCOUNT = 'active'
const OTHER_ACCOUNT = 'other'
const INVOICE_LIFETIME_SECONDS = 600
const SEED = new Uint8Array(64)

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

function expirySecondsAgo(ms: number) {
  return Math.floor((Date.now() - ms) / MS_PER_SECOND)
}

function transactionOf(accountId: string, quoteId: string) {
  return useEcashStore
    .getState()
    .transactions[accountId]?.find(({ id }) => id === quoteId)
}

function mintQuoteIdsOf(accountId: string) {
  return useEcashStore.getState().quotes[accountId].mint.map((q) => q.quote)
}

async function results() {
  const settlements = await settlePendingMints()
  return settlements.map(({ result }) => result)
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
    jest.mocked(getEcashSeed).mockReset()
    jest.mocked(restoreProofsFromMints).mockReset()
  })

  it('mints a paid invoice into the account that created it', async () => {
    addPendingMint(OTHER_ACCOUNT, 'paid')
    jest.mocked(checkMintQuote).mockResolvedValue('PAID')
    jest
      .mocked(mintProofs)
      .mockResolvedValue({ proofs: [proof(21)], totalAmount: 21 })

    await expect(results()).resolves.toStrictEqual(['minted'])

    const state = useEcashStore.getState()
    expect(state.proofs[OTHER_ACCOUNT]).toStrictEqual([proof(21)])
    expect(state.proofs[ACTIVE_ACCOUNT]).toStrictEqual([])
    expect(mintQuoteIdsOf(OTHER_ACCOUNT)).toStrictEqual([])
    expect(state.mints[OTHER_ACCOUNT][0].balance).toBe(21)
    expect(transactionOf(OTHER_ACCOUNT, 'paid')?.status).toBe('completed')
  })

  it('leaves an unpaid invoice pending before its deadline', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'unpaid')
    jest.mocked(checkMintQuote).mockResolvedValue('UNPAID')

    await expect(results()).resolves.toStrictEqual(['waiting'])

    expect(transactionOf(ACTIVE_ACCOUNT, 'unpaid')?.status).toBe('pending')
    expect(mintProofs).not.toHaveBeenCalled()
  })

  it('expires an unpaid invoice past its deadline and drops its quote', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'stale', {
      expiry: expirySecondsAgo(ECASH_MINT_QUOTE_EXPIRY_GRACE_MS + MS_PER_SECOND)
    })
    jest.mocked(checkMintQuote).mockResolvedValue('UNPAID')

    await expect(results()).resolves.toStrictEqual(['expired'])

    expect(transactionOf(ACTIVE_ACCOUNT, 'stale')?.status).toBe('expired')
    expect(mintQuoteIdsOf(ACTIVE_ACCOUNT)).toStrictEqual([])
  })

  it('fails an issued invoice on an account without a seed', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'issued')
    jest.mocked(checkMintQuote).mockResolvedValue('ISSUED')

    await expect(results()).resolves.toStrictEqual(['failed'])

    expect(transactionOf(ACTIVE_ACCOUNT, 'issued')?.status).toBe('failed')
    expect(mintProofs).not.toHaveBeenCalled()
    expect(restoreProofsFromMints).not.toHaveBeenCalled()
  })

  it('recovers an issued invoice from the seed', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'lost')
    jest.mocked(checkMintQuote).mockResolvedValue('ISSUED')
    jest.mocked(getEcashSeed).mockResolvedValue(SEED)
    jest.mocked(restoreProofsFromMints).mockResolvedValue({
      mintsFailed: 0,
      mintsIncomplete: 0,
      mintsScanned: 1,
      proofsFound: 1,
      totalAmount: 21
    })

    await expect(results()).resolves.toStrictEqual(['minted'])

    expect(restoreProofsFromMints).toHaveBeenCalledWith(
      ACTIVE_ACCOUNT,
      [MINT_URL],
      SEED,
      expect.any(Object)
    )
    expect(transactionOf(ACTIVE_ACCOUNT, 'lost')?.status).toBe('completed')
    expect(mintProofs).not.toHaveBeenCalled()
  })

  it('tries the recovery again when the mint could not be restored', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'lostOffline')
    jest.mocked(checkMintQuote).mockResolvedValue('ISSUED')
    jest.mocked(getEcashSeed).mockResolvedValue(SEED)
    jest.mocked(restoreProofsFromMints).mockResolvedValue({
      mintsFailed: 1,
      mintsIncomplete: 0,
      mintsScanned: 1,
      proofsFound: 0,
      totalAmount: 0
    })

    await expect(results()).resolves.toStrictEqual(['waiting'])

    expect(transactionOf(ACTIVE_ACCOUNT, 'lostOffline')?.status).toBe('pending')
  })

  it('rests and retries a recovery whose scan skipped a keyset', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'lostPartly')
    jest.mocked(checkMintQuote).mockResolvedValue('ISSUED')
    jest.mocked(getEcashSeed).mockResolvedValue(SEED)
    jest.mocked(restoreProofsFromMints).mockResolvedValue({
      mintsFailed: 0,
      mintsIncomplete: 1,
      mintsScanned: 1,
      proofsFound: 0,
      totalAmount: 0
    })

    await expect(results()).resolves.toStrictEqual(['waiting'])
    await expect(results()).resolves.toStrictEqual([])

    expect(transactionOf(ACTIVE_ACCOUNT, 'lostPartly')?.status).toBe('pending')
    expect(restoreProofsFromMints).toHaveBeenCalledTimes(1)
  })

  it('scans a mint once for several lost invoices on it', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'lostA')
    addPendingMint(ACTIVE_ACCOUNT, 'lostB')
    jest.mocked(checkMintQuote).mockResolvedValue('ISSUED')
    jest.mocked(getEcashSeed).mockResolvedValue(SEED)
    jest.mocked(restoreProofsFromMints).mockReturnValue(
      new Promise((resolve) => {
        setTimeout(() =>
          resolve({
            mintsFailed: 0,
            mintsIncomplete: 0,
            mintsScanned: 1,
            proofsFound: 2,
            totalAmount: 42
          })
        )
      })
    )

    await expect(results()).resolves.toStrictEqual(['minted', 'minted'])

    expect(restoreProofsFromMints).toHaveBeenCalledTimes(1)
  })

  it('asks an unreachable mint again on the next run', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'offline')
    jest.mocked(checkMintQuote).mockRejectedValue(new Error('offline'))

    await expect(results()).resolves.toStrictEqual(['waiting'])
    await expect(results()).resolves.toStrictEqual(['waiting'])

    expect(checkMintQuote).toHaveBeenCalledTimes(2)
    expect(transactionOf(ACTIVE_ACCOUNT, 'offline')?.status).toBe('pending')
  })

  it('rests an unreachable mint once the invoice is past its deadline', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'offlineStale', {
      expiry: expirySecondsAgo(ECASH_MINT_QUOTE_EXPIRY_GRACE_MS + MS_PER_SECOND)
    })
    jest.mocked(checkMintQuote).mockRejectedValue(new Error('offline'))

    await expect(results()).resolves.toStrictEqual(['waiting'])
    await expect(results()).resolves.toStrictEqual([])

    expect(checkMintQuote).toHaveBeenCalledTimes(1)
  })

  it('never expires an invoice only because its mint stays unreachable', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'offlineForDays', {
      expiry: expirySecondsAgo(
        ECASH_MINT_QUOTE_EXPIRY_GRACE_MS +
          ECASH_PENDING_MINT_MAX_AGE_MS +
          MS_PER_SECOND
      )
    })
    jest.mocked(checkMintQuote).mockRejectedValue(new Error('offline'))

    await expect(results()).resolves.toStrictEqual(['waiting'])

    expect(transactionOf(ACTIVE_ACCOUNT, 'offlineForDays')?.status).toBe(
      'pending'
    )
    expect(mintQuoteIdsOf(ACTIVE_ACCOUNT)).toStrictEqual(['offlineForDays'])
  })

  it('never expires a paid invoice whose minting fails', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'paidStale', {
      expiry: expirySecondsAgo(
        ECASH_MINT_QUOTE_EXPIRY_GRACE_MS +
          ECASH_PENDING_MINT_MAX_AGE_MS +
          MS_PER_SECOND
      )
    })
    jest.mocked(checkMintQuote).mockResolvedValue('PAID')
    jest.mocked(mintProofs).mockRejectedValue(new Error('mint error'))

    await expect(results()).resolves.toStrictEqual(['waiting'])

    expect(transactionOf(ACTIVE_ACCOUNT, 'paidStale')?.status).toBe('pending')
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

  it('reports and rests a quote after repeated mint failures', async () => {
    addPendingMint(ACTIVE_ACCOUNT, 'broken')
    jest.mocked(checkMintQuote).mockResolvedValue('PAID')
    jest.mocked(mintProofs).mockRejectedValue(new Error('mint error'))

    const runs = Array.from({ length: ECASH_MAX_FAILED_MINT_ATTEMPTS + 1 })
    const outcomes: string[][] = []
    for (const _run of runs) {
      outcomes.push(await results())
    }

    expect(outcomes.at(-2)).toStrictEqual(['mintFailed'])
    expect(outcomes.at(-1)).toStrictEqual([])
    expect(mintProofs).toHaveBeenCalledTimes(ECASH_MAX_FAILED_MINT_ATTEMPTS)
    expect(transactionOf(ACTIVE_ACCOUNT, 'broken')?.status).toBe('pending')
  })

  it('does not let a hung mint hold up the other invoices', async () => {
    jest.useFakeTimers()
    addPendingMint(ACTIVE_ACCOUNT, 'hung')
    addPendingMint(ACTIVE_ACCOUNT, 'quick')
    jest
      .mocked(checkMintQuote)
      .mockImplementation((_account, _mintUrl, quoteId) =>
        quoteId === 'hung'
          ? Promise.withResolvers<MintQuoteState>().promise
          : Promise.resolve('PAID')
      )
    jest
      .mocked(mintProofs)
      .mockResolvedValue({ proofs: [proof(21)], totalAmount: 21 })

    const running = settlePendingMints()
    await jest.advanceTimersByTimeAsync(ECASH_PENDING_MINT_TIMEOUT_MS)
    const settlements = await running
    jest.useRealTimers()

    expect(
      settlements.map(({ pendingMint, result }) => [
        pendingMint.quoteId,
        result
      ])
    ).toStrictEqual([
      ['quick', 'minted'],
      ['hung', 'waiting']
    ])
  })
})
