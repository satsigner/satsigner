import { SEQUENCE_FINAL, SEQUENCE_RBF } from '@/constants/btc'
import { type Account } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import {
  addSentTransactionToAccount,
  buildSentTransactionLabels,
  getSentTransactionLabel,
  type SentTransaction
} from '@/utils/sentTransaction'

const TXID = 'b'.repeat(64)
const SPENT_TXID = 'a'.repeat(64)
const PAYEE = 'tb1qpayee'
const CHANGE = 'tb1qchange'
const OWN_RECEIVE = 'tb1qreceive'

function makeOutput(overrides: Partial<Output> = {}): Output {
  return {
    amount: 1000,
    label: '',
    localId: 'output',
    to: PAYEE,
    ...overrides
  }
}

function makeUtxo(overrides: Partial<Utxo> = {}): Utxo {
  return {
    keychain: 'external',
    label: '',
    txid: SPENT_TXID,
    value: 10_000,
    vout: 0,
    ...overrides
  }
}

function makeAddress(
  address: string,
  keychain: 'internal' | 'external'
): Account['addresses'][number] {
  return {
    address,
    keychain,
    label: '',
    network: 'signet',
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions: [],
    utxos: []
  }
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    addresses: [
      makeAddress(OWN_RECEIVE, 'external'),
      makeAddress(CHANGE, 'internal')
    ],
    createdAt: new Date('2024-01-01'),
    id: 'account',
    keyCount: 1,
    keys: [],
    keysRequired: 1,
    labels: {},
    name: 'Test',
    network: 'signet',
    policyType: 'singlesig',
    summary: {
      balance: 10_000,
      numberOfAddresses: 2,
      numberOfTransactions: 1,
      numberOfUtxos: 1,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: [makeUtxo()],
    ...overrides
  }
}

function makeSent(overrides: Partial<SentTransaction> = {}): SentTransaction {
  return {
    fee: 200,
    inputs: [makeUtxo()],
    outputs: [
      makeOutput({ amount: 1000, label: 'rent', localId: 'pay' }),
      makeOutput({
        amount: 8800,
        label: 'Change',
        localId: 'change',
        to: CHANGE
      })
    ],
    rbf: true,
    txid: TXID,
    ...overrides
  }
}

describe('getSentTransactionLabel', () => {
  it('joins the payment labels and leaves out the change', () => {
    expect(
      getSentTransactionLabel([
        { label: 'rent' },
        { label: 'Change' },
        { label: '' },
        { label: 'food' }
      ])
    ).toBe('rent,food')
  })
})

describe('buildSentTransactionLabels', () => {
  it('labels the payment, the transaction and the change', () => {
    expect(buildSentTransactionLabels(makeSent())).toStrictEqual([
      { label: 'rent', ref: `${TXID}:0`, type: 'output' },
      { label: 'rent', ref: PAYEE, type: 'addr' },
      { label: 'rent', ref: TXID, type: 'tx' },
      { label: '[change] rent', ref: `${TXID}:1`, type: 'output' },
      { label: '[change] rent', ref: CHANGE, type: 'addr' }
    ])
  })

  it('adds no change labels without a change output', () => {
    const labels = buildSentTransactionLabels(
      makeSent({ outputs: [makeOutput({ label: 'rent' })] })
    )
    expect(labels.map((label) => label.ref)).toStrictEqual([
      `${TXID}:0`,
      PAYEE,
      TXID
    ])
  })
})

describe('addSentTransactionToAccount', () => {
  it('returns nothing when the account already has the transaction', () => {
    const account = makeAccount({
      transactions: [
        {
          id: TXID,
          label: '',
          lockTimeEnabled: false,
          prices: {},
          received: 0,
          sent: 0,
          type: 'send'
        }
      ]
    })
    expect(addSentTransactionToAccount(account, makeSent())).toBeUndefined()
  })

  it('adds the transaction and swaps the spent coin for the change', () => {
    const updated = addSentTransactionToAccount(makeAccount(), makeSent())

    expect(updated?.transactions[0]).toMatchObject({
      fee: 200,
      id: TXID,
      label: 'rent',
      received: 8800,
      sent: 10_000,
      type: 'send'
    })
    expect(updated?.utxos).toStrictEqual([
      expect.objectContaining({
        addressTo: CHANGE,
        keychain: 'internal',
        txid: TXID,
        value: 8800,
        vout: 1
      })
    ])
    expect(updated?.summary.balance).toBe(10_000 - (10_000 - 8800))
    expect(updated?.summary.numberOfTransactions).toBe(2)
    expect(updated?.summary.numberOfUtxos).toBe(1)
  })

  it('keeps a self-send output as an unspent coin of the account', () => {
    const updated = addSentTransactionToAccount(
      makeAccount(),
      makeSent({
        outputs: [makeOutput({ amount: 9800, to: OWN_RECEIVE })]
      })
    )
    expect(updated?.utxos).toStrictEqual([
      expect.objectContaining({
        addressTo: OWN_RECEIVE,
        keychain: 'external',
        vout: 0
      })
    ])
  })

  it('marks the inputs as replaceable only when RBF is on', () => {
    const withRbf = addSentTransactionToAccount(makeAccount(), makeSent())
    const withoutRbf = addSentTransactionToAccount(
      makeAccount(),
      makeSent({ rbf: false })
    )
    expect(withRbf?.transactions[0].vin?.[0].sequence).toBe(SEQUENCE_RBF)
    expect(withoutRbf?.transactions[0].vin?.[0].sequence).toBe(SEQUENCE_FINAL)
  })
})
