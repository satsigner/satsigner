import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import {
  annotateTransactionsWithWalletOwnership,
  getTransactionRunningBalances
} from '@/utils/walletOwnership'

function makeAddress(
  address: string,
  keychain: 'internal' | 'external' = 'internal'
): Account['addresses'][number] {
  return {
    address,
    keychain,
    label: '',
    summary: {
      balance: 0,
      satsInMempool: 0,
      transactions: 0,
      utxos: 0
    },
    transactions: [],
    utxos: []
  }
}

function makeTx(
  overrides: Partial<Transaction> & {
    id?: string
    vout: Transaction['vout']
  }
): Transaction {
  return {
    id: 'tx1',
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 100_000,
    type: 'send',
    vin: [],
    ...overrides
  }
}

const OWN_ADDRESSES = [makeAddress('bc1qdecoy'), makeAddress('bc1qchange')]

describe('annotateTransactionsWithWalletOwnership', () => {
  it('tags internal outputs as change and fixes received for BDK-style sent', () => {
    const annotated = annotateTransactionsWithWalletOwnership(
      [
        makeTx({
          fee: 1_000,
          received: 10_000,
          sent: 100_000,
          vout: [
            { address: 'bc1qpay', script: '', value: 40_000 },
            { address: 'bc1qdecoy', script: '', value: 40_000 },
            { address: 'bc1qchange', script: '', value: 19_000 }
          ]
        })
      ],
      OWN_ADDRESSES
    )

    expect(annotated[0]?.received).toBe(59_000)
    expect(annotated[0]?.sent).toBe(100_000)
    expect(annotated[0]?.vout[1]?.kind).toBe('change')
    expect(annotated[0]?.vout[2]?.kind).toBe('change')
    expect(annotated[0]?.vout[0]?.kind).toBeUndefined()
  })

  it('reconstructs Core-style net payment sent so delta is payment + fee', () => {
    const annotated = annotateTransactionsWithWalletOwnership(
      [
        makeTx({
          fee: 1_000,
          // Core listtransactions: sent ≈ external payment only
          received: 19_000,
          sent: 40_000,
          vout: [
            { address: 'bc1qpay', script: '', value: 40_000 },
            { address: 'bc1qdecoy', script: '', value: 40_000 },
            { address: 'bc1qchange', script: '', value: 19_000 }
          ]
        })
      ],
      OWN_ADDRESSES
    )

    expect(annotated[0]?.received).toBe(59_000)
    expect(annotated[0]?.sent).toBe(100_000)
    // Card amount = sent - received = payment + fee
    expect(annotated[0]!.sent - annotated[0]!.received).toBe(41_000)
  })

  it('does not inflate sent for coinjoin-like txs with large external outputs', () => {
    const annotated = annotateTransactionsWithWalletOwnership(
      [
        makeTx({
          fee: 1_000,
          received: 90_000,
          sent: 100_000,
          vout: [
            { address: 'bc1qother1', script: '', value: 500_000 },
            { address: 'bc1qother2', script: '', value: 409_000 },
            { address: 'bc1qchange', script: '', value: 90_000 }
          ]
        })
      ],
      [makeAddress('bc1qchange')]
    )

    expect(annotated[0]?.received).toBe(90_000)
    expect(annotated[0]?.sent).toBe(100_000)
  })
})

describe('getTransactionRunningBalances', () => {
  it('accumulates chronologically regardless of input order', () => {
    const receive = makeTx({
      id: 'recv',
      received: 100_000,
      sent: 0,
      timestamp: new Date('2024-01-01'),
      type: 'receive',
      vout: [{ address: 'bc1qchange', script: '', value: 100_000 }]
    })
    const send = makeTx({
      fee: 1_000,
      id: 'send',
      received: 19_000,
      sent: 40_000,
      timestamp: new Date('2024-01-02'),
      vout: [
        { address: 'bc1qpay', script: '', value: 40_000 },
        { address: 'bc1qdecoy', script: '', value: 40_000 },
        { address: 'bc1qchange', script: '', value: 19_000 }
      ]
    })

    const annotated = annotateTransactionsWithWalletOwnership(
      [send, receive],
      OWN_ADDRESSES
    )
    const balances = getTransactionRunningBalances(annotated)

    expect(balances.get('recv')).toBe(100_000)
    // 100_000 - (100_000 - 59_000) = 59_000 after stonewall send
    expect(balances.get('send')).toBe(59_000)
  })
})
