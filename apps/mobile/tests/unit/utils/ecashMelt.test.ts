import type { EcashMeltResult, EcashProof } from '@/types/models/Ecash'
import { proofsAfterMeltResult, toEcashMeltStatus } from '@/utils/ecashMelt'

const MINT_URL = 'https://mint.example'

function proof(secret: string, amount: number): EcashProof {
  return { C: `c-${secret}`, amount, id: 'ks', mintUrl: MINT_URL, secret }
}

const OTHER = proof('other', 8)
const INPUT = proof('in', 64)
const KEEP = proof('keep', 4)
const SEND = proof('send', 60)
const CHANGE = proof('change', 1)

describe('toEcashMeltStatus', () => {
  it.each([
    ['PAID', 'paid'],
    ['PENDING', 'pending'],
    ['UNPAID', 'unpaid']
  ] as const)('maps %s to %s', (state, status) => {
    expect(toEcashMeltStatus(state)).toBe(status)
  })
})

describe('proofsAfterMeltResult', () => {
  it('replaces the inputs with keep and change after a paid melt', () => {
    const result: EcashMeltResult = {
      change: [CHANGE],
      keep: [KEEP],
      status: 'paid'
    }

    expect(
      proofsAfterMeltResult([OTHER, INPUT], [INPUT], result)
    ).toStrictEqual([OTHER, KEEP, CHANGE])
  })

  it.each(['pending', 'unpaid'] as const)(
    'keeps the send proofs after a %s melt',
    (status) => {
      const result: EcashMeltResult = { keep: [KEEP], send: [SEND], status }

      expect(
        proofsAfterMeltResult([OTHER, INPUT], [INPUT], result)
      ).toStrictEqual([OTHER, KEEP, SEND])
    }
  )
})
