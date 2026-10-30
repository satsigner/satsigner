import { EcashMeltFailedError, EcashSpentProofsError } from '@/api/ecash'
import { proofsAfterFailedMelt } from '@/services/ecash/meltFailure'
import type { EcashProof } from '@/types/models/Ecash'

const MINT_A = 'https://a.example'
const MINT_B = 'https://b.example'

function proof(mintUrl: string, amount: number, secret: string): EcashProof {
  return { C: `C-${secret}`, amount, id: 'ks', mintUrl, secret }
}

const melted = [proof(MINT_A, 64, 'a1'), proof(MINT_A, 32, 'a2')]
const otherMint = proof(MINT_B, 16, 'b1')
const current = [...melted, otherMint]

describe('proofsAfterFailedMelt', () => {
  it('keeps the swapped proofs when the melt fails after the swap', () => {
    const keep = [proof(MINT_A, 8, 'k1')]
    const send = [proof(MINT_A, 64, 's1'), proof(MINT_A, 16, 's2')]

    expect(
      proofsAfterFailedMelt(
        new EcashMeltFailedError(keep, send, new Error('route not found')),
        current,
        melted
      )
    ).toStrictEqual([otherMint, ...keep, ...send])
  })

  it('drops proofs the mint reports as spent', () => {
    expect(
      proofsAfterFailedMelt(new EcashSpentProofsError(['a1']), current, melted)
    ).toStrictEqual([melted[1], otherMint])
  })

  it('leaves the proofs alone for any other error', () => {
    expect(
      proofsAfterFailedMelt(new Error('mint offline'), current, melted)
    ).toBeNull()
  })
})

describe('melt failed error', () => {
  it('keeps the message and cause of the melt error', () => {
    const cause = new Error('route not found')
    const error = new EcashMeltFailedError([], [], cause)

    expect(error.message).toBe('route not found')
    expect(error.cause).toBe(cause)
  })
})
