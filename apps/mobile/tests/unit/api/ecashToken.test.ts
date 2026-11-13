import { getEncodedTokenV3, getEncodedTokenV4 } from '@cashu/cashu-ts'

import { receiveEcash, validateEcashToken } from '@/api/ecash'

const MINT_URL = 'https://mint.example'
const V1_KEYSET_ID = '009a1f293253e41e'
const V2_KEYSET_ID = `01${'ab'.repeat(32)}`
const OTHER_V2_KEYSET_ID = `01${'cd'.repeat(32)}`

const mockLoadMint = jest.fn()
const mockGetAllKeysetIds = jest.fn()
const mockReceive = jest.fn()
const mockCheckProofsStates = jest.fn()

jest.mock<typeof import('@cashu/cashu-ts')>('@cashu/cashu-ts', () => {
  const actual =
    jest.requireActual<typeof import('@cashu/cashu-ts')>('@cashu/cashu-ts')

  class MockMint {
    mintUrl: string
    constructor(url: string) {
      this.mintUrl = url
    }
  }

  class MockWallet {
    mint: MockMint
    loadMint = mockLoadMint
    keyChain = { getAllKeysetIds: mockGetAllKeysetIds }
    receive = mockReceive
    checkProofsStates = mockCheckProofsStates

    constructor(mint: MockMint) {
      this.mint = mint
    }
  }

  return { ...actual, Mint: MockMint, Wallet: MockWallet }
})

function tokenProofs(keysetId: string) {
  return [
    {
      C: '02c020067db727d586bc3183aecf97fcb800c3f4cc4759f69c626c9db5d8f5b5d4',
      amount: 8,
      id: keysetId,
      secret: 's-1'
    },
    {
      C: '03c020067db727d586bc3183aecf97fcb800c3f4cc4759f69c626c9db5d8f5b5d4',
      amount: 2,
      id: keysetId,
      secret: 's-2'
    }
  ]
}

function encodeToken(
  keysetId: string,
  encode: typeof getEncodedTokenV4 = getEncodedTokenV4
) {
  return encode({
    memo: 'thanks',
    mint: MINT_URL,
    proofs: tokenProofs(keysetId),
    unit: 'sat'
  })
}

describe('ecash token decoding at the mint', () => {
  beforeEach(() => {
    mockLoadMint.mockResolvedValue(undefined)
    mockGetAllKeysetIds.mockReturnValue([OTHER_V2_KEYSET_ID, V2_KEYSET_ID])
    mockReceive.mockResolvedValue([
      { C: 'new-1', amount: 8, id: V2_KEYSET_ID, secret: 'n-1' },
      { C: 'new-2', amount: 2, id: V2_KEYSET_ID, secret: 'n-2' }
    ])
    mockCheckProofsStates.mockImplementation((proofs: unknown[]) =>
      Promise.resolve(proofs.map(() => ({ state: 'UNSPENT' })))
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('receiveEcash', () => {
    it.each([
      ['v4', getEncodedTokenV4],
      ['v3', getEncodedTokenV3]
    ])(
      'redeems a %s token whose short v2 keyset ids map to the mint keysets',
      async (_version, encode) => {
        const result = await receiveEcash(
          'acc-v2',
          MINT_URL,
          encodeToken(V2_KEYSET_ID, encode)
        )

        expect(mockLoadMint).toHaveBeenCalledTimes(1)
        expect(mockReceive).toHaveBeenCalledWith(
          expect.objectContaining({
            mint: MINT_URL,
            proofs: tokenProofs(V2_KEYSET_ID)
          })
        )
        expect(result.memo).toBe('thanks')
        expect(result.totalAmount).toBe(10)
      }
    )

    it('redeems a token with v1 keyset ids', async () => {
      mockGetAllKeysetIds.mockReturnValue([V1_KEYSET_ID])

      await receiveEcash('acc-v1', MINT_URL, encodeToken(V1_KEYSET_ID))

      expect(mockReceive).toHaveBeenCalledWith(
        expect.objectContaining({ proofs: tokenProofs(V1_KEYSET_ID) })
      )
    })

    it('refuses a token whose v2 keyset the mint does not have', async () => {
      mockGetAllKeysetIds.mockReturnValue([OTHER_V2_KEYSET_ID])

      await expect(
        receiveEcash('acc-unknown', MINT_URL, encodeToken(V2_KEYSET_ID))
      ).rejects.toThrow('short keyset ID')
      expect(mockReceive).not.toHaveBeenCalled()
    })
  })

  describe('validateEcashToken', () => {
    it.each([
      ['v1', V1_KEYSET_ID],
      ['v2', V2_KEYSET_ID]
    ])(
      'asks the mint for the state of a token with %s keyset ids',
      async (_version, keysetId) => {
        mockGetAllKeysetIds.mockReturnValue([keysetId])

        const result = await validateEcashToken(
          encodeToken(keysetId),
          `acc-check-${keysetId}`,
          MINT_URL
        )

        expect(mockCheckProofsStates).toHaveBeenCalledWith(
          tokenProofs(keysetId)
        )
        expect(result).toStrictEqual({
          details: 'All proofs are unspent',
          isSpent: false,
          isValid: true
        })
      }
    )

    it('reports a spent v2 token as spent', async () => {
      mockCheckProofsStates.mockImplementation((proofs: unknown[]) =>
        Promise.resolve(proofs.map(() => ({ state: 'SPENT' })))
      )

      const result = await validateEcashToken(
        encodeToken(V2_KEYSET_ID),
        'acc-spent',
        MINT_URL
      )

      expect(result.isSpent).toBe(true)
      expect(result.isValid).toBe(true)
    })
  })
})
