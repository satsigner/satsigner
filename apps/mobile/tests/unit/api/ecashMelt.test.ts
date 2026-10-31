import { EcashMeltFailedError, meltProofs } from '@/api/ecash'
import type { EcashProof, MeltQuote } from '@/types/models/Ecash'

const mockSend = jest.fn()
const mockMeltProofs = jest.fn()

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
  }

  class MockWallet {
    mint: MockMint
    loadMint = jest.fn().mockResolvedValue(undefined)
    checkProofsStates = jest.fn((proofs: unknown[]) =>
      Promise.resolve(proofs.map(() => ({ state: CheckStateEnum.UNSPENT })))
    )
    send = mockSend
    meltProofs = mockMeltProofs

    constructor(mint: MockMint) {
      this.mint = mint
    }
  }

  return {
    CheckStateEnum,
    Mint: MockMint,
    Wallet: MockWallet,
    getDecodedToken: jest.fn(),
    getEncodedTokenV3: jest.fn(),
    getEncodedTokenV4: jest.fn()
  }
})

const MINT_URL = 'https://mint.example'

const QUOTE: MeltQuote = {
  amount: 90,
  expiry: 0,
  fee_reserve: 2,
  mintUrl: MINT_URL,
  paid: false,
  quote: 'quote-1'
}

const INPUTS: EcashProof[] = [
  { C: 'c1', amount: 64, id: 'ks', mintUrl: MINT_URL, secret: 'in1' },
  { C: 'c2', amount: 32, id: 'ks', mintUrl: MINT_URL, secret: 'in2' }
]

const SWAPPED_KEEP = [{ C: 'k', amount: 4, id: 'ks', secret: 'keep1' }]
const SWAPPED_SEND = [
  { C: 's1', amount: 64, id: 'ks', secret: 'send1' },
  { C: 's2', amount: 28, id: 'ks', secret: 'send2' }
]

describe('meltProofs', () => {
  beforeEach(() => {
    mockSend.mockResolvedValue({ keep: SWAPPED_KEEP, send: SWAPPED_SEND })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns the swapped keep proofs and the change after a paid melt', async () => {
    const change = [{ C: 'ch', amount: 1, id: 'ks', secret: 'change1' }]
    mockMeltProofs.mockResolvedValue({
      change,
      quote: { payment_preimage: 'preimage' }
    })

    const result = await meltProofs('acc', MINT_URL, QUOTE, INPUTS)

    expect(result).toStrictEqual({
      change: [{ ...change[0], mintUrl: MINT_URL }],
      keep: [{ ...SWAPPED_KEEP[0], mintUrl: MINT_URL }],
      paid: true,
      preimage: 'preimage'
    })
  })

  it('hands back the swapped proofs when the melt fails after the swap', async () => {
    const meltError = new Error('Lightning payment failed')
    mockMeltProofs.mockRejectedValue(meltError)

    const error = await meltProofs('acc', MINT_URL, QUOTE, INPUTS).catch(
      (error: unknown) => error
    )

    expect(error).toBeInstanceOf(EcashMeltFailedError)
    expect(error).toMatchObject({
      cause: meltError,
      keep: [{ ...SWAPPED_KEEP[0], mintUrl: MINT_URL }],
      message: 'Lightning payment failed',
      send: SWAPPED_SEND.map((proof) => ({ ...proof, mintUrl: MINT_URL }))
    })
  })

  it('does not wrap a failure before the swap', async () => {
    const swapError = new Error('mint offline')
    mockSend.mockRejectedValue(swapError)

    await expect(meltProofs('acc', MINT_URL, QUOTE, INPUTS)).rejects.toBe(
      swapError
    )
    expect(mockMeltProofs).not.toHaveBeenCalled()
  })
})
