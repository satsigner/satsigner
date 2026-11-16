import {
  SAMPLE_DUST_LABELS,
  SAMPLE_RECEIVE_BUCKETS,
  SAMPLE_SELF_TRANSFER_LABELS,
  SAMPLE_SEND_BUCKETS
} from '@/constants/sampleLabels'
import type { Account } from '@/types/models/Account'
import type { Address } from '@/types/models/Address'
import type { Transaction } from '@/types/models/Transaction'
import type { Utxo } from '@/types/models/Utxo'
import { buildSampleWalletLabels } from '@/utils/sampleWalletLabels'

const OWN_RECEIVE = 'tb1qown-receive'
const OWN_CHANGE = 'tb1qown-change'
const STRANGER = 'tb1qstranger'

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx',
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    type: 'receive',
    vin: [],
    vout: [],
    ...overrides
  }
}

function makeAddress(overrides: Partial<Address>): Address {
  return {
    address: OWN_RECEIVE,
    index: 0,
    keychain: 'external',
    label: '',
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions: [],
    utxos: [],
    ...overrides
  }
}

function makeUtxo(overrides: Partial<Utxo>): Utxo {
  return {
    keychain: 'external',
    txid: 'tx',
    value: 10_000,
    vout: 0,
    ...overrides
  }
}

const transactions = [
  makeTx({
    blockHeight: 1,
    id: 'salary',
    received: 50_000,
    vout: [{ address: OWN_RECEIVE, script: '', value: 50_000 }]
  }),
  makeTx({
    blockHeight: 2,
    id: 'coffee',
    received: 20_000,
    sent: 50_000,
    type: 'send',
    vout: [
      { address: STRANGER, script: '', value: 29_000 },
      { address: OWN_CHANGE, script: '', value: 20_000 }
    ]
  }),
  makeTx({
    blockHeight: 3,
    id: 'consolidation',
    received: 19_800,
    sent: 20_000,
    type: 'send',
    vout: [{ address: OWN_RECEIVE, script: '', value: 19_800 }]
  }),
  makeTx({
    blockHeight: 4,
    id: 'dust',
    received: 546,
    vout: [{ address: OWN_RECEIVE, script: '', value: 546 }]
  })
]

const account = {
  addresses: [
    makeAddress({ transactions: ['salary', 'consolidation', 'dust'] }),
    makeAddress({
      address: OWN_CHANGE,
      index: 3,
      keychain: 'internal',
      transactions: ['coffee']
    }),
    makeAddress({ address: 'tb1qunused', index: 7 })
  ],
  transactions,
  utxos: [
    makeUtxo({ txid: 'consolidation', value: 19_800 }),
    makeUtxo({ keychain: 'internal', txid: 'coffee', value: 20_000, vout: 1 }),
    makeUtxo({ txid: 'dust', value: 546 })
  ]
} satisfies Pick<Account, 'addresses' | 'transactions' | 'utxos'>

function labelFor(ref: string) {
  return buildSampleWalletLabels('segwit', account).find(
    (label) => label.ref === ref
  )?.label
}

describe('buildSampleWalletLabels', () => {
  it('labels every transaction, UTXO and address', () => {
    const labels = buildSampleWalletLabels('segwit', account)
    const refs = new Set(labels.map(({ ref }) => ref))
    for (const { id } of account.transactions) {
      expect(refs.has(id)).toBe(true)
    }
    for (const { txid, vout } of account.utxos) {
      expect(refs.has(`${txid}:${vout}`)).toBe(true)
    }
    for (const { address } of account.addresses) {
      expect(refs.has(address)).toBe(true)
    }
  })

  it('tells receives, sends, self-transfers and dust apart', () => {
    expect(labelFor('salary')).toBe(SAMPLE_RECEIVE_BUCKETS[2].stories[0])
    expect(labelFor('coffee')).toBe(SAMPLE_SEND_BUCKETS[2].stories[0])
    expect(labelFor('consolidation')).toBe(
      `${SAMPLE_SELF_TRANSFER_LABELS[0]} #selfsend`
    )
    expect(labelFor('dust')).toBe(SAMPLE_DUST_LABELS[0])
  })

  it('marks change and dust UTXOs', () => {
    expect(labelFor('coffee:1')).toBe(
      `↩️ change from: ${SAMPLE_SEND_BUCKETS[2].stories[0]}`
    )
    expect(labelFor('dust:0')).toBe(SAMPLE_DUST_LABELS[0])
  })

  it('names addresses by keychain, index and first story', () => {
    expect(labelFor(OWN_RECEIVE)).toBe(
      `📥 Invoice address 0 - ${SAMPLE_RECEIVE_BUCKETS[2].stories[0]}`
    )
    expect(labelFor(OWN_CHANGE)).toBe(
      `↩️ Change address 3 - ${SAMPLE_SEND_BUCKETS[2].stories[0]}`
    )
    expect(labelFor('tb1qunused')).toBe('📥 Invoice address 7')
  })

  it('picks stories that fit the amount', () => {
    const tiny = { ...transactions[0], id: 'tiny', received: 3000 }
    const big = { ...transactions[0], id: 'big', received: 185_000 }
    const labels = buildSampleWalletLabels('segwit', {
      ...account,
      transactions: [tiny, big]
    })
    const byRef = new Map(labels.map(({ label, ref }) => [ref, label]))
    expect(byRef.get('tiny')).toBe(SAMPLE_RECEIVE_BUCKETS[0].stories[0])
    expect(byRef.get('big')).toBe(SAMPLE_RECEIVE_BUCKETS[4].stories[0])
  })

  it('keeps the self-send tag off UTXOs and addresses', () => {
    const labels = buildSampleWalletLabels('segwit', account)
    const tagged = labels.filter(({ label }) => label.includes('#selfsend'))
    expect(tagged.map(({ ref }) => ref)).toStrictEqual(['consolidation'])
  })

  it('returns no labels for other samples', () => {
    expect(buildSampleWalletLabels('legacy', account)).toStrictEqual([])
  })
})
