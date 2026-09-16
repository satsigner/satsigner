import { getLargestMintBalance, getMintBalance } from '@/api/ecash'
import type { EcashProof } from '@/types/models/Ecash'

function proof(mintUrl: string, amount: number, secret: string): EcashProof {
  return {
    C: `C-${secret}`,
    amount,
    id: 'keyset',
    mintUrl,
    secret
  }
}

describe('getLargestMintBalance', () => {
  it('returns zero when no mints are given', () => {
    expect(getLargestMintBalance([], [proof('https://a', 5, 's')])).toBe(0)
  })

  it('returns the largest single-mint balance', () => {
    const proofs = [
      proof('https://a', 3, 'a1'),
      proof('https://b', 10, 'b1'),
      proof('https://a', 2, 'a2')
    ]
    expect(getMintBalance('https://a', proofs)).toBe(5)
    expect(getLargestMintBalance(['https://a', 'https://b'], proofs)).toBe(10)
  })
})
