import { hex } from '@scure/base'
import * as bitcoinjs from 'bitcoinjs-lib'

import { SEQUENCE_LOCKTIME_NO_RBF, SEQUENCE_RBF } from '@/constants/btc'
import { type Account } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import {
  addSentTransactionToAccount,
  buildSentTransactionLabels,
  getSentOutputVouts,
  getSentTransactionLabel,
  matchOutputVouts,
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
    vouts: [0, 1],
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

  it('puts the output labels on the vouts of the sent transaction', () => {
    expect(
      buildSentTransactionLabels(makeSent({ vouts: [1, 0] })).filter(
        (label) => label.type === 'output'
      )
    ).toStrictEqual([
      { label: 'rent', ref: `${TXID}:1`, type: 'output' },
      { label: '[change] rent', ref: `${TXID}:0`, type: 'output' }
    ])
  })

  it('skips the output label of an output with no known vout', () => {
    const labels = buildSentTransactionLabels(
      makeSent({ vouts: [undefined, 0] })
    )
    expect(labels.map((label) => label.ref)).toStrictEqual([
      PAYEE,
      TXID,
      `${TXID}:0`,
      CHANGE
    ])
  })

  it('labels every change output of a Stonewall send', () => {
    const decoyChange = 'tb1qdecoychange'
    const labels = buildSentTransactionLabels(
      makeSent({
        outputs: [
          ...makeSent().outputs,
          makeOutput({ label: 'Change', localId: 'decoy', to: decoyChange })
        ],
        vouts: [0, 1, 2]
      })
    )
    expect(
      labels.filter((label) => label.label === '[change] rent')
    ).toStrictEqual([
      { label: '[change] rent', ref: `${TXID}:1`, type: 'output' },
      { label: '[change] rent', ref: CHANGE, type: 'addr' },
      { label: '[change] rent', ref: `${TXID}:2`, type: 'output' },
      { label: '[change] rent', ref: decoyChange, type: 'addr' }
    ])
  })

  it('adds no change labels without a change output', () => {
    const labels = buildSentTransactionLabels(
      makeSent({ outputs: [makeOutput({ label: 'rent' })], vouts: [0] })
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

  it('labels the change coin as the next sync will', () => {
    const sent = makeSent()
    const updated = addSentTransactionToAccount(makeAccount(), sent)
    const changeLabel = buildSentTransactionLabels(sent).find(
      (label) => label.ref === `${TXID}:1`
    )?.label

    expect(changeLabel).toBe('[change] rent')
    expect(updated?.utxos[0].label).toBe(changeLabel)
    expect(updated?.transactions[0].vout?.[1].label).toBe(changeLabel)
    expect(updated?.transactions[0].vout?.[0].label).toBe('rent')
  })

  it('keeps a self-send output as an unspent coin of the account', () => {
    const updated = addSentTransactionToAccount(
      makeAccount(),
      makeSent({
        outputs: [makeOutput({ amount: 9800, to: OWN_RECEIVE })],
        vouts: [0]
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

  it('records the change coin at its vout in the sent transaction', () => {
    const updated = addSentTransactionToAccount(
      makeAccount(),
      makeSent({ vouts: [1, 0] })
    )
    expect(updated?.utxos).toStrictEqual([
      expect.objectContaining({ addressTo: CHANGE, vout: 0 })
    ])
    expect(
      updated?.transactions[0].vout?.map((output) => output.address)
    ).toStrictEqual([CHANGE, PAYEE])
  })

  it('records no coin for a change output with no known vout', () => {
    const updated = addSentTransactionToAccount(
      makeAccount(),
      makeSent({ vouts: [0, undefined] })
    )
    expect(updated?.utxos).toStrictEqual([])
    expect(updated?.summary.balance).toBe(8800)
  })

  it('marks the inputs as replaceable only when RBF is on', () => {
    const withRbf = addSentTransactionToAccount(makeAccount(), makeSent())
    const withoutRbf = addSentTransactionToAccount(
      makeAccount(),
      makeSent({ rbf: false })
    )
    expect(withRbf?.transactions[0].vin?.[0].sequence).toBe(SEQUENCE_RBF)
    expect(withoutRbf?.transactions[0].vin?.[0].sequence).toBe(
      SEQUENCE_LOCKTIME_NO_RBF
    )
  })
})

describe('matchOutputVouts', () => {
  const PAY = 'pay-script'
  const OWN = 'change-script'

  it('follows the order of the sent transaction', () => {
    expect(
      matchOutputVouts(
        [
          { amount: 1000, script: PAY },
          { amount: 8800, script: OWN }
        ],
        [
          { script: OWN, value: 8800 },
          { script: PAY, value: 1000 }
        ]
      )
    ).toStrictEqual([1, 0])
  })

  it('gives equal outputs the lowest free vouts in builder order', () => {
    expect(
      matchOutputVouts(
        [
          { amount: 500, script: PAY },
          { amount: 500, script: PAY },
          { amount: 900, script: OWN }
        ],
        [
          { script: OWN, value: 900 },
          { script: PAY, value: 500 },
          { script: PAY, value: 500 }
        ]
      )
    ).toStrictEqual([1, 2, 0])
  })

  it('prefers the output with the same amount at a shared script', () => {
    expect(
      matchOutputVouts(
        [
          { amount: 700, script: PAY },
          { amount: 300, script: PAY }
        ],
        [
          { script: PAY, value: 300 },
          { script: PAY, value: 700 }
        ]
      )
    ).toStrictEqual([1, 0])
  })

  it('falls back to the script when a payjoin changed the amounts', () => {
    expect(
      matchOutputVouts(
        [
          { amount: 1000, script: PAY },
          { amount: 8800, script: OWN }
        ],
        [
          { script: 'receiver-input-script', value: 50_000 },
          { script: OWN, value: 8650 },
          { script: PAY, value: 51_000 }
        ]
      )
    ).toStrictEqual([2, 1])
  })

  it('leaves outputs with no match or no script unknown', () => {
    expect(
      matchOutputVouts(
        [
          { amount: 1000, script: 'substituted' },
          { amount: 8800, script: undefined }
        ],
        [{ script: PAY, value: 1000 }]
      )
    ).toStrictEqual([undefined, undefined])
  })
})

describe('getSentOutputVouts', () => {
  const PAYMENT_ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
  const CHANGE_ADDRESS =
    'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7'

  function buildShuffledTransaction() {
    const network = bitcoinjs.networks.testnet
    const transaction = new bitcoinjs.Transaction()
    transaction.addInput(new Uint8Array(32), 0)
    transaction.addOutput(
      bitcoinjs.address.toOutputScript(CHANGE_ADDRESS, network),
      8800n
    )
    transaction.addOutput(
      bitcoinjs.address.toOutputScript(PAYMENT_ADDRESS, network),
      1000n
    )
    return transaction
  }

  const outputs = [
    { amount: 1000, to: PAYMENT_ADDRESS },
    { amount: 8800, to: CHANGE_ADDRESS }
  ]

  it('reads the vouts from the signed transaction hex', () => {
    expect(
      getSentOutputVouts(outputs, {
        network: 'signet',
        signedTxHex: buildShuffledTransaction().toHex()
      })
    ).toStrictEqual([1, 0])
  })

  it('reads the vouts from the PSBT when there is no signed hex', () => {
    const psbt = new bitcoinjs.Psbt({ network: bitcoinjs.networks.testnet })
      .addInput({ hash: new Uint8Array(32), index: 0 })
      .addOutputs(
        buildShuffledTransaction().outs.map((output) => ({
          script: output.script,
          value: output.value
        }))
      )
    expect(
      getSentOutputVouts(outputs, {
        network: 'signet',
        psbtBase64: psbt.toBase64()
      })
    ).toStrictEqual([1, 0])
  })

  it('knows no vout when the transaction cannot be read', () => {
    expect(
      getSentOutputVouts(outputs, {
        network: 'signet',
        signedTxHex: hex.encode(new Uint8Array([1, 2, 3]))
      })
    ).toStrictEqual([undefined, undefined])
  })
})
