import { type AddressSnapshot } from '@/api/addressSync'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { applyAddressSnapshot } from '@/utils/addressSync'

const ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const OTHER_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'

function tx(id: string, label = ''): Transaction {
  return {
    id,
    label,
    prices: {},
    received: 0,
    sent: 0,
    type: 'receive',
    vin: [],
    vout: []
  }
}

function utxo(txid: string, addressTo: string, label = ''): Utxo {
  return { addressTo, keychain: 'external', label, txid, value: 1000, vout: 0 }
}

function account(transactions: Transaction[], utxos: Utxo[]): Account {
  return {
    addresses: [],
    createdAt: new Date('2024-01-01'),
    id: 'acc-1',
    keyCount: 1,
    keys: [],
    keysRequired: 1,
    labels: {},
    name: 'Watch',
    network: 'bitcoin',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      dms: [],
      lastUpdated: new Date(),
      relays: [],
      syncStart: new Date(),
      trustedMemberDevices: []
    },
    policyType: 'watchonly',
    summary: {
      balance: 500,
      numberOfAddresses: 1,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions,
    utxos
  }
}

const snapshot: AddressSnapshot = {
  balance: { confirmed: 1000, unconfirmed: 200 },
  transactions: [tx('a'), tx('b')],
  txids: ['a', 'b'],
  utxos: [
    { txid: 'a', value: 1000, vout: 0 },
    { txid: 'b', value: 200, vout: 0 }
  ]
}

describe('applyAddressSnapshot', () => {
  const before = account(
    [tx('a'), tx('z')],
    [
      utxo('a', ADDRESS, 'cold storage'),
      utxo('spent', ADDRESS),
      utxo('other', OTHER_ADDRESS)
    ]
  )
  const after = applyAddressSnapshot(before, ADDRESS, 'bitcoin', snapshot)

  it('upserts transactions by id', () => {
    expect(after.transactions.map((t) => t.id)).toStrictEqual(['z', 'a', 'b'])
  })

  it('replaces the address utxos, keeping stored ones and their labels', () => {
    expect(after.utxos.map((u) => `${u.txid}:${u.label}`)).toStrictEqual([
      'other:',
      'a:cold storage',
      'b:'
    ])
    expect(after.utxos[2].script?.length).toBeGreaterThan(0)
  })

  it('adds the snapshot balance to the account summary', () => {
    expect(after.summary.balance).toBe(1500)
    expect(after.summary.satsInMempool).toBe(200)
  })

  it('records the address entry', () => {
    expect(after.addresses).toStrictEqual([
      {
        address: ADDRESS,
        label: '',
        summary: {
          balance: 1000,
          satsInMempool: 200,
          transactions: 2,
          utxos: 2
        },
        transactions: ['a', 'b'],
        utxos: ['a:0', 'b:0']
      }
    ])
  })
})
