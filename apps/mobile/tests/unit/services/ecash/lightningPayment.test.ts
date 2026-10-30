import { createMppMeltQuote, mintSupportsBolt11Mpp } from '@/api/ecash'
import {
  EcashPaymentError,
  payLightningInvoiceFromMints
} from '@/services/ecash/lightningPayment'
import type { EcashMint, EcashProof, MeltQuote } from '@/types/models/Ecash'

jest.mock<typeof import('@/api/ecash')>('@/api/ecash', () => ({
  __esModule: true,
  createMppMeltQuote: jest.fn(),
  getMintBalance: (mintUrl: string, proofs: EcashProof[]) =>
    proofs
      .filter((p) => p.mintUrl === mintUrl)
      .reduce((sum, p) => sum + p.amount, 0),
  mintSupportsBolt11Mpp: jest.fn()
}))

const MINT_A = 'https://a.example'
const MINT_B = 'https://b.example'
const MINT_C = 'https://c.example'

function mint(url: string): EcashMint {
  return { balance: 0, isConnected: true, keysets: [], url }
}

function proof(mintUrl: string, amount: number): EcashProof {
  return { C: 'c', amount, id: 'ks', mintUrl, secret: `${mintUrl}-${amount}` }
}

function quote(mintUrl: string, amount: number, fee = 1): MeltQuote {
  return {
    amount,
    expiry: 0,
    fee_reserve: fee,
    mintUrl,
    paid: false,
    quote: `${mintUrl}-${amount}`
  }
}

function params(proofs: EcashProof[]) {
  return {
    accountId: 'acc',
    addMeltQuote: jest.fn(),
    amountSats: 100,
    createAndRecordMeltQuote: jest.fn((mintUrl: string) =>
      Promise.resolve(quote(mintUrl, 100))
    ),
    getProofs: () => proofs,
    invoice: 'lnbc1',
    meltProofsAndUpdateStore: jest.fn().mockResolvedValue(undefined),
    mints: [mint(MINT_A), mint(MINT_B)],
    options: {},
    removeMeltQuote: jest.fn(),
    selectedMintUrl: null
  }
}

describe('payLightningInvoiceFromMints', () => {
  beforeEach(() => {
    jest.mocked(mintSupportsBolt11Mpp).mockResolvedValue(true)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('fails early when the total balance is too low', async () => {
    await expect(
      payLightningInvoiceFromMints(params([proof(MINT_A, 50)]))
    ).rejects.toMatchObject({ failure: { reason: 'insufficientProofs' } })
  })

  it('pays from a single mint that covers amount and fees', async () => {
    const p = params([proof(MINT_A, 150), proof(MINT_B, 20)])

    await payLightningInvoiceFromMints(p)

    expect(p.meltProofsAndUpdateStore).toHaveBeenCalledWith(
      MINT_A,
      quote(MINT_A, 100),
      [proof(MINT_A, 150)]
    )
    expect(createMppMeltQuote).not.toHaveBeenCalled()
  })

  it('reports a typed error when no mint supports MPP', async () => {
    jest.mocked(mintSupportsBolt11Mpp).mockResolvedValue(false)

    const error = await payLightningInvoiceFromMints(
      params([proof(MINT_A, 60), proof(MINT_B, 60)])
    ).catch((error: unknown) => error)

    expect(error).toBeInstanceOf(EcashPaymentError)
    expect(error).toMatchObject({ failure: { reason: 'mintsLackMpp' } })
  })

  it('shrinks an MPP slice after a fee miss and melts the planned amounts', async () => {
    jest
      .mocked(createMppMeltQuote)
      .mockImplementation((_account, mintUrl, _invoice, amount) =>
        Promise.resolve(quote(mintUrl, amount))
      )
    const proofs = [proof(MINT_A, 61), proof(MINT_B, 51)]
    const p = params(proofs)

    await payLightningInvoiceFromMints(p)

    expect(
      jest
        .mocked(createMppMeltQuote)
        .mock.calls.map((call) => [call[1], call[3]])
    ).toStrictEqual([
      [MINT_A, 61],
      [MINT_A, 60],
      [MINT_B, 40]
    ])
    expect(p.addMeltQuote).toHaveBeenCalledTimes(2)
    expect(p.meltProofsAndUpdateStore).toHaveBeenCalledTimes(2)
    expect(p.meltProofsAndUpdateStore).toHaveBeenNthCalledWith(
      1,
      MINT_A,
      quote(MINT_A, 60),
      [proofs[0]]
    )
    expect(p.meltProofsAndUpdateStore).toHaveBeenNthCalledWith(
      2,
      MINT_B,
      quote(MINT_B, 40),
      [proofs[1]]
    )
  })

  it('gives up on a mint after three fee-miss attempts', async () => {
    const FEE_TARGET = 62
    jest
      .mocked(createMppMeltQuote)
      .mockImplementation((_account, mintUrl, _invoice, amount) =>
        Promise.resolve(quote(mintUrl, amount, FEE_TARGET - amount))
      )
    const p = params([proof(MINT_A, 61), proof(MINT_B, 51)])

    await expect(payLightningInvoiceFromMints(p)).rejects.toMatchObject({
      failure: { reason: 'insufficientForFees' }
    })
    const mintACalls = jest
      .mocked(createMppMeltQuote)
      .mock.calls.filter((call) => call[1] === MINT_A)
    expect(mintACalls.map((call) => call[3])).toStrictEqual([61, 60, 59])
    expect(p.addMeltQuote).not.toHaveBeenCalled()
  })

  it('drops a covering quote that misses on fees and falls back to MPP', async () => {
    jest
      .mocked(createMppMeltQuote)
      .mockImplementation((_account, mintUrl, _invoice, amount) =>
        Promise.resolve(quote(mintUrl, amount))
      )
    const p = params([proof(MINT_A, 150), proof(MINT_B, 20)])
    p.createAndRecordMeltQuote.mockImplementation((mintUrl: string) =>
      Promise.resolve(quote(mintUrl, 100, 60))
    )

    await payLightningInvoiceFromMints(p)

    expect(p.removeMeltQuote).toHaveBeenCalledWith(`${MINT_A}-100`)
    expect(p.meltProofsAndUpdateStore).toHaveBeenCalledWith(
      MINT_A,
      quote(MINT_A, 100),
      [proof(MINT_A, 150)]
    )
  })

  it('reports insufficientForFees when the covering mint misses and no mint has MPP', async () => {
    jest.mocked(mintSupportsBolt11Mpp).mockResolvedValue(false)
    const p = params([proof(MINT_A, 150)])
    p.createAndRecordMeltQuote.mockImplementation((mintUrl: string) =>
      Promise.resolve(quote(mintUrl, 100, 60))
    )

    await expect(payLightningInvoiceFromMints(p)).rejects.toMatchObject({
      failure: { reason: 'insufficientForFees' }
    })
  })

  it('rethrows the quote creation error when nothing could be planned', async () => {
    jest.mocked(mintSupportsBolt11Mpp).mockResolvedValue(false)
    const p = params([proof(MINT_A, 150)])
    p.createAndRecordMeltQuote.mockRejectedValue(new Error('mint offline'))

    await expect(payLightningInvoiceFromMints(p)).rejects.toThrow(
      'mint offline'
    )
  })

  it('quotes every MPP part first, then melts all parts at once', async () => {
    const events: string[] = []
    jest
      .mocked(createMppMeltQuote)
      .mockImplementation((_account, mintUrl, _invoice, amount) => {
        events.push(`quote ${mintUrl}`)
        return Promise.resolve(quote(mintUrl, amount))
      })
    const p = params([proof(MINT_A, 61), proof(MINT_B, 51)])
    const { promise: allMeltsStarted, resolve: releaseMelts } =
      Promise.withResolvers<undefined>()
    p.meltProofsAndUpdateStore.mockImplementation((mintUrl: string) => {
      events.push(`melt ${mintUrl}`)
      const meltsStarted = events.filter((event) => event.startsWith('melt'))
      if (meltsStarted.length === 2) {
        releaseMelts(undefined)
      }
      return allMeltsStarted
    })

    await payLightningInvoiceFromMints(p)

    expect(events).toStrictEqual([
      `quote ${MINT_A}`,
      `quote ${MINT_A}`,
      `quote ${MINT_B}`,
      `melt ${MINT_A}`,
      `melt ${MINT_B}`
    ])
  })

  it('reports a partial payment when a later MPP melt fails', async () => {
    jest
      .mocked(createMppMeltQuote)
      .mockImplementation((_account, mintUrl, _invoice, amount) =>
        Promise.resolve(quote(mintUrl, amount))
      )
    const meltError = new Error('melt failed')
    const p = params([proof(MINT_A, 61), proof(MINT_B, 51)])
    p.meltProofsAndUpdateStore
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(meltError)

    await expect(payLightningInvoiceFromMints(p)).rejects.toMatchObject({
      cause: meltError,
      failure: { reason: 'mppPartialPayment', settled: 1, total: 2 }
    })
  })

  it('counts every settled part when a later MPP melt fails', async () => {
    jest
      .mocked(createMppMeltQuote)
      .mockImplementation((_account, mintUrl, _invoice, amount) =>
        Promise.resolve(quote(mintUrl, amount))
      )
    const meltError = new Error('melt failed')
    const p = params([proof(MINT_A, 40), proof(MINT_B, 35), proof(MINT_C, 30)])
    p.mints = [mint(MINT_A), mint(MINT_B), mint(MINT_C)]
    p.meltProofsAndUpdateStore
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(meltError)

    await expect(payLightningInvoiceFromMints(p)).rejects.toMatchObject({
      cause: meltError,
      failure: { reason: 'mppPartialPayment', settled: 2, total: 3 }
    })
  })

  it('reports a partial payment when the first MPP melt fails and a later one settles', async () => {
    jest
      .mocked(createMppMeltQuote)
      .mockImplementation((_account, mintUrl, _invoice, amount) =>
        Promise.resolve(quote(mintUrl, amount))
      )
    const meltError = new Error('melt failed')
    const p = params([proof(MINT_A, 61), proof(MINT_B, 51)])
    p.meltProofsAndUpdateStore.mockRejectedValueOnce(meltError)

    await expect(payLightningInvoiceFromMints(p)).rejects.toMatchObject({
      cause: meltError,
      failure: { reason: 'mppPartialPayment', settled: 1, total: 2 }
    })
  })

  it('rethrows the raw error and keeps the quotes when every MPP melt fails', async () => {
    jest
      .mocked(createMppMeltQuote)
      .mockImplementation((_account, mintUrl, _invoice, amount) =>
        Promise.resolve(quote(mintUrl, amount))
      )
    const meltError = new Error('melt failed')
    const p = params([proof(MINT_A, 61), proof(MINT_B, 51)])
    p.meltProofsAndUpdateStore.mockRejectedValue(meltError)

    await expect(payLightningInvoiceFromMints(p)).rejects.toBe(meltError)
    expect(p.addMeltQuote).toHaveBeenCalledTimes(2)
    expect(p.removeMeltQuote).not.toHaveBeenCalled()
  })
})
