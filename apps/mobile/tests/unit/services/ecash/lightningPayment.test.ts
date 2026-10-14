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
    createMeltQuote: jest.fn((mintUrl: string) =>
      Promise.resolve(quote(mintUrl, 100))
    ),
    getProofs: () => proofs,
    invoice: 'lnbc1',
    meltProofs: jest.fn().mockResolvedValue(undefined),
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
    ).rejects.toMatchObject({ reason: 'insufficientProofs' })
  })

  it('pays from a single mint that covers amount and fees', async () => {
    const p = params([proof(MINT_A, 150), proof(MINT_B, 20)])

    await payLightningInvoiceFromMints(p)

    expect(p.meltProofs).toHaveBeenCalledWith(MINT_A, quote(MINT_A, 100), [
      proof(MINT_A, 150)
    ])
    expect(createMppMeltQuote).not.toHaveBeenCalled()
  })

  it('splits the payment across MPP mints when no mint covers it', async () => {
    jest
      .mocked(createMppMeltQuote)
      .mockImplementation((_account, mintUrl, _invoice, amount) =>
        Promise.resolve(quote(mintUrl, amount))
      )
    const p = params([proof(MINT_A, 61), proof(MINT_B, 51)])

    await payLightningInvoiceFromMints(p)

    expect(p.addMeltQuote).toHaveBeenCalledTimes(2)
    expect(p.meltProofs).toHaveBeenCalledTimes(2)
  })

  it('reports a typed error when no mint supports MPP', async () => {
    jest.mocked(mintSupportsBolt11Mpp).mockResolvedValue(false)

    const error = await payLightningInvoiceFromMints(
      params([proof(MINT_A, 60), proof(MINT_B, 60)])
    ).catch((error: unknown) => error)

    expect(error).toBeInstanceOf(EcashPaymentError)
    expect(error).toMatchObject({ reason: 'mintsLackMpp' })
  })
})
