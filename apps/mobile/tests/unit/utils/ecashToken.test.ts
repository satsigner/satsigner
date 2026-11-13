import { getEncodedTokenV3, getEncodedTokenV4 } from '@cashu/cashu-ts'

import { readEcashToken, toCheckedTokenStatus } from '@/utils/ecashToken'

const MINT_URL = 'https://mint.example'
const V1_KEYSET_ID = '009a1f293253e41e'
const V2_KEYSET_ID = `01${'ab'.repeat(32)}`

function proof(keysetId: string, amount: number, secret: string) {
  return {
    C: '02c020067db727d586bc3183aecf97fcb800c3f4cc4759f69c626c9db5d8f5b5d4',
    amount,
    id: keysetId,
    secret
  }
}

function tokenPayload(keysetId: string) {
  return {
    memo: 'thanks',
    mint: MINT_URL,
    proofs: [proof(keysetId, 8, 's-1'), proof(keysetId, 2, 's-2')],
    unit: 'sat'
  }
}

describe('readEcashToken', () => {
  it.each([
    ['v4', 'v1', getEncodedTokenV4, V1_KEYSET_ID],
    ['v4', 'v2', getEncodedTokenV4, V2_KEYSET_ID],
    ['v3', 'v1', getEncodedTokenV3, V1_KEYSET_ID],
    ['v3', 'v2', getEncodedTokenV3, V2_KEYSET_ID]
  ])(
    'reads a %s token with %s keyset ids without the mint keysets',
    (_version, _keysetVersion, encode, keysetId) => {
      expect(readEcashToken(encode(tokenPayload(keysetId)))).toStrictEqual({
        amount: 10,
        memo: 'thanks',
        mint: MINT_URL,
        proofAmounts: [8, 2]
      })
    }
  )

  it('returns null for text that is not a token', () => {
    expect(readEcashToken('cashuBnot-a-token')).toBeNull()
    expect(readEcashToken('cashuA')).toBeNull()
  })
})

describe('toCheckedTokenStatus', () => {
  it('marks a fully spent token as spent, not unspent', () => {
    expect(toCheckedTokenStatus({ isSpent: true, isValid: true })).toBe('spent')
  })

  it('marks an unspent token as unspent', () => {
    expect(toCheckedTokenStatus({ isSpent: false, isValid: true })).toBe(
      'unspent'
    )
  })

  it('marks a token it could not read as invalid', () => {
    expect(toCheckedTokenStatus({ isValid: false })).toBe('invalid')
  })
})
