import type { Address } from '@/types/models/Address'
import type { Transaction } from '@/types/models/Transaction'
import {
  buildAutomaticTagContext,
  getAutomaticTagsByTxid
} from '@/utils/automaticTags'

const OWN = 'tb1qown'
const STRANGER = 'tb1qstranger'
const FINAL_SEQUENCE = 0xff_ff_ff_ff
const RBF_SEQUENCE = 0xff_ff_ff_fd

function makeAddress(address: string): Address {
  return {
    address,
    label: '',
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions: [],
    utxos: []
  }
}

function makeInput(txid: string, vout: number, sequence = FINAL_SEQUENCE) {
  return {
    previousOutput: { txid, vout },
    scriptSig: '',
    sequence,
    witness: []
  }
}

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    blockHeight: 100,
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

const funding = makeTx({
  id: 'funding',
  received: 30_000,
  vin: [makeInput('outside', 0)],
  vout: [
    { address: OWN, script: '', value: 10_000 },
    { address: OWN, script: '', value: 10_000 },
    { address: OWN, script: '', value: 10_000 }
  ]
})

function tagsFor(tx: Transaction) {
  const account = {
    addresses: [makeAddress(OWN)],
    transactions: [funding, tx],
    utxos: []
  }
  return getAutomaticTagsByTxid(account).get(tx.id)
}

describe('getAutomaticTagsByTxid', () => {
  it('tags a plain payment with nothing', () => {
    expect(tagsFor(funding)).toStrictEqual([])
  })

  it('tags many own inputs into one own output as a consolidation', () => {
    const tx = makeTx({
      id: 'merge',
      received: 29_800,
      sent: 30_000,
      type: 'send',
      vin: [
        makeInput('funding', 0),
        makeInput('funding', 1),
        makeInput('funding', 2)
      ],
      vout: [{ address: OWN, script: '', value: 29_800 }]
    })
    expect(tagsFor(tx)).toStrictEqual(['consolidation'])
  })

  it('does not call a two-input self-send a consolidation', () => {
    const tx = makeTx({
      id: 'small-merge',
      received: 19_800,
      sent: 20_000,
      type: 'send',
      vin: [makeInput('funding', 0), makeInput('funding', 1)],
      vout: [{ address: OWN, script: '', value: 19_800 }]
    })
    expect(tagsFor(tx)).toStrictEqual([])
  })

  it('tags inputs from us and a stranger as a payjoin', () => {
    const tx = makeTx({
      id: 'payjoin',
      received: 60_000,
      sent: 10_000,
      vin: [makeInput('funding', 0), makeInput('stranger-coin', 0)],
      vout: [
        { address: OWN, script: '', value: 60_000 },
        { address: STRANGER, script: '', value: 40_000 }
      ]
    })
    expect(tagsFor(tx)).toStrictEqual(['payjoin'])
  })

  it('tags tiny unsolicited receives as dust', () => {
    const tx = makeTx({
      id: 'dust',
      received: 546,
      vin: [makeInput('outside', 1)],
      vout: [{ address: OWN, script: '', value: 546 }]
    })
    expect(tagsFor(tx)).toStrictEqual(['dust'])
  })

  it('tags rbf only while unconfirmed', () => {
    const pending = makeTx({
      blockHeight: undefined,
      id: 'pending',
      received: 50_000,
      vin: [makeInput('outside', 2, RBF_SEQUENCE)],
      vout: [{ address: OWN, script: '', value: 50_000 }]
    })
    const confirmed = { ...pending, blockHeight: 120, id: 'confirmed' }
    expect(tagsFor(pending)).toStrictEqual(['rbf'])
    expect(tagsFor(confirmed)).toStrictEqual([])
  })
})

describe('buildAutomaticTagContext', () => {
  it('collects own addresses and outpoints', () => {
    const context = buildAutomaticTagContext({
      addresses: [makeAddress(OWN)],
      transactions: [funding],
      utxos: []
    })
    expect(context.ownAddresses.has(OWN)).toBe(true)
    expect(context.ownedOutpoints.has('funding:2')).toBe(true)
  })
})
