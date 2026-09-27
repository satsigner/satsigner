import { toEcashToken } from '@/utils/ecashToken'

const MINT_URL = 'https://mint.example'

const PROOF = { C: 'C-1', amount: 8, id: 'ks-1', secret: 's-1' }

describe('toEcashToken', () => {
  it('tags every proof with the token mint', () => {
    const token = toEcashToken({
      memo: 'thanks',
      mint: MINT_URL,
      proofs: [PROOF],
      unit: 'sat'
    })

    expect(token).toStrictEqual({
      memo: 'thanks',
      mint: MINT_URL,
      proofs: [{ ...PROOF, mintUrl: MINT_URL }],
      unit: 'sat'
    })
  })

  it('keeps only the sat unit', () => {
    expect(
      toEcashToken({ mint: MINT_URL, proofs: [], unit: 'usd' }).unit
    ).toBeUndefined()
    expect(toEcashToken({ mint: MINT_URL, proofs: [] }).unit).toBeUndefined()
  })
})
