import type {
  EcashMeltResult,
  EcashProof,
  EcashTransaction
} from '@/types/models/Ecash'
import {
  listPendingMelts,
  proofsAfterMeltResult,
  toEcashMeltStatus
} from '@/utils/ecashMelt'

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

  it('returns the send proofs after an unpaid melt', () => {
    const result: EcashMeltResult = {
      keep: [KEEP],
      send: [SEND],
      status: 'unpaid'
    }

    expect(
      proofsAfterMeltResult([OTHER, INPUT], [INPUT], result)
    ).toStrictEqual([OTHER, KEEP, SEND])
  })

  it('leaves the reserved send proofs out after a pending melt', () => {
    const result: EcashMeltResult = {
      keep: [KEEP],
      send: [SEND],
      status: 'pending'
    }

    expect(
      proofsAfterMeltResult([OTHER, INPUT], [INPUT], result)
    ).toStrictEqual([OTHER, KEEP])
  })
})

describe('listPendingMelts', () => {
  function melt(overrides: Partial<EcashTransaction>): EcashTransaction {
    return {
      amount: 60,
      id: 'melt-1',
      mintUrl: MINT_URL,
      quoteId: 'quote-1',
      reservedProofs: [SEND],
      status: 'pending',
      timestamp: '2026-01-01T00:00:00.000Z',
      type: 'melt',
      ...overrides
    }
  }

  it('lists pending melts with their reserved proofs', () => {
    const pending = listPendingMelts({
      accounts: [{ id: 'acc' }],
      transactions: {
        acc: [
          melt({}),
          melt({ id: 'settled', status: 'settled' }),
          melt({ id: 'mint', type: 'mint' })
        ]
      }
    })

    expect(pending).toStrictEqual([
      {
        accountId: 'acc',
        mintUrl: MINT_URL,
        quoteId: 'quote-1',
        reservedProofs: [SEND],
        transactionId: 'melt-1'
      }
    ])
  })

  it('lists a melt without reserved proofs with none', () => {
    const [pending] = listPendingMelts({
      accounts: [{ id: 'acc' }],
      transactions: { acc: [melt({ reservedProofs: undefined })] }
    })

    expect(pending.reservedProofs).toStrictEqual([])
  })
})
