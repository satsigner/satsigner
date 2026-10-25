import {
  BIP125_REPLACEABLE_SEQUENCE_BELOW,
  DUST_LIMIT,
  SEQUENCE_FINAL,
  SEQUENCE_RBF
} from '@/constants/btc'
import { type Utxo } from '@/types/models/Utxo'
import {
  buildCpfpDraft,
  buildDraftFromReplacementPsbt,
  getBumpRecipients,
  getFeeReplacementOptions,
  getTransactionFeeRate,
  minimumChildFee,
  minimumReplacementFeeRate,
  parseFeeReplacementKind,
  pickCpfpUtxo,
  spendsUnconfirmedParent,
  transactionSignalsRbf
} from '@/utils/feeReplacement'

const PAYMENT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
const CHANGE = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const FRESH = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
const PREVIOUS_TXID = 'bb'.repeat(32)
const TXID = 'cc'.repeat(32)

function utxo(value: number, vout = 0, txid = TXID): Utxo {
  return {
    addressTo: CHANGE,
    keychain: 'internal',
    txid,
    value,
    vout
  }
}

type ReplaceableTransaction = Parameters<
  typeof getFeeReplacementOptions
>[0]['tx']

function transaction(
  overrides: Partial<ReplaceableTransaction> = {}
): ReplaceableTransaction {
  return {
    blockHeight: undefined,
    fee: 280,
    id: TXID,
    vin: [
      {
        previousOutput: { txid: PREVIOUS_TXID, vout: 1 },
        scriptSig: [],
        sequence: SEQUENCE_RBF,
        witness: []
      }
    ],
    vout: [
      { address: CHANGE, script: [], value: 40_000 },
      { address: PAYMENT, script: [], value: 50_000 }
    ],
    vsize: 140,
    ...overrides
  }
}

type ReplacementAccount = Parameters<
  typeof getFeeReplacementOptions
>[0]['account']

function account(
  overrides: Partial<ReplacementAccount> = {}
): ReplacementAccount {
  return {
    addresses: [{ address: CHANGE, keychain: 'internal' }],
    excludedUtxoOutpoints: [],
    policyType: 'singlesig',
    transactions: [],
    utxos: [utxo(40_000)],
    ...overrides
  }
}

const OWNED_PREVIOUS = new Set([`${PREVIOUS_TXID}:1`])

describe('transactionSignalsRbf', () => {
  it('signals when any sequence is below 0xff_ff_ff_fe', () => {
    expect(transactionSignalsRbf([{ sequence: SEQUENCE_RBF }])).toBe(true)
    expect(
      transactionSignalsRbf([
        { sequence: SEQUENCE_FINAL },
        { sequence: SEQUENCE_RBF }
      ])
    ).toBe(true)
  })

  it('does not signal when every sequence is final', () => {
    expect(transactionSignalsRbf([{ sequence: SEQUENCE_FINAL }])).toBe(false)
    expect(
      transactionSignalsRbf([{ sequence: BIP125_REPLACEABLE_SEQUENCE_BELOW }])
    ).toBe(false)
  })
})

describe('getFeeReplacementOptions', () => {
  it('offers every action for an unconfirmed outgoing transaction that signals RBF', () => {
    const { actions, assessment } = getFeeReplacementOptions({
      account: account(),
      backend: 'electrum',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction()
    })
    expect(assessment).toStrictEqual({
      canBumpOrCancel: true,
      canCpfp: true,
      signalsRbf: true,
      unconfirmed: true
    })
    expect(actions).toStrictEqual({ bump: true, cancel: true, cpfp: true })
  })

  it('offers only child-pays-for-parent for an incoming payment', () => {
    const { actions, assessment } = getFeeReplacementOptions({
      account: account(),
      backend: 'esplora',
      ownedOutpoints: new Set(),
      tx: transaction()
    })
    expect(assessment.canBumpOrCancel).toBe(false)
    expect(actions).toStrictEqual({ bump: false, cancel: false, cpfp: true })
  })

  it('offers nothing once the transaction is confirmed', () => {
    const { actions, assessment } = getFeeReplacementOptions({
      account: account(),
      backend: 'electrum',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction({ blockHeight: 100 })
    })
    expect(assessment.unconfirmed).toBe(false)
    expect(actions).toStrictEqual({ bump: false, cancel: false, cpfp: false })
  })

  it('keeps the flags but hides the actions for a watch-only account', () => {
    const { actions, assessment } = getFeeReplacementOptions({
      account: account({ policyType: 'watchonly' }),
      backend: 'electrum',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction()
    })
    expect(assessment.signalsRbf).toBe(true)
    expect(actions).toStrictEqual({ bump: false, cancel: false, cpfp: false })
  })

  it('hides the replacement for a multisig account', () => {
    const { actions } = getFeeReplacementOptions({
      account: account({ policyType: 'multisig' }),
      backend: 'electrum',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction()
    })
    expect(actions).toStrictEqual({ bump: false, cancel: false, cpfp: true })
  })

  it('hides the replacement while a child spends one of its outputs', () => {
    const child = {
      vin: [
        {
          previousOutput: { txid: TXID, vout: 0 },
          scriptSig: [],
          sequence: SEQUENCE_RBF,
          witness: []
        }
      ]
    }
    const { actions, assessment } = getFeeReplacementOptions({
      account: account({
        transactions: [{ ...transaction({ id: 'dd'.repeat(32) }), ...child }],
        utxos: []
      }),
      backend: 'electrum',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction()
    })
    expect(assessment.canBumpOrCancel).toBe(false)
    expect(actions).toStrictEqual({ bump: false, cancel: false, cpfp: false })
  })

  it('offers cancel but not bump when there is no payment to keep', () => {
    const { actions } = getFeeReplacementOptions({
      account: account(),
      backend: 'electrum',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction({
        vout: [{ address: CHANGE, script: [], value: 90_000 }]
      })
    })
    expect(actions).toStrictEqual({ bump: false, cancel: true, cpfp: true })
  })

  it('does not offer a bump that would drop an OP_RETURN output', () => {
    const { actions } = getFeeReplacementOptions({
      account: account(),
      backend: 'electrum',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction({
        vout: [
          { address: CHANGE, script: [], value: 40_000 },
          { address: '', script: [], value: 0 }
        ]
      })
    })
    expect(actions.bump).toBe(false)
  })

  it('hides the replacement on the Bitcoin Core wallet backend', () => {
    const { actions } = getFeeReplacementOptions({
      account: account(),
      backend: 'rpc',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction()
    })
    expect(actions).toStrictEqual({ bump: false, cancel: false, cpfp: true })
  })

  it('hides the replacement when the original fee is unknown', () => {
    const { actions } = getFeeReplacementOptions({
      account: account(),
      backend: 'electrum',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction({ fee: undefined })
    })
    expect(actions).toStrictEqual({ bump: false, cancel: false, cpfp: true })
  })

  it('offers nothing when the transaction size is unknown', () => {
    const { actions } = getFeeReplacementOptions({
      account: account(),
      backend: 'electrum',
      ownedOutpoints: OWNED_PREVIOUS,
      tx: transaction({ vsize: undefined })
    })
    expect(actions).toStrictEqual({ bump: false, cancel: false, cpfp: false })
  })

  it('drops child-pays-for-parent when the only output is excluded or spent', () => {
    expect(
      getFeeReplacementOptions({
        account: account({ excludedUtxoOutpoints: [`${TXID}:0`] }),
        backend: 'electrum',
        ownedOutpoints: OWNED_PREVIOUS,
        tx: transaction()
      }).actions.cpfp
    ).toBe(false)
    expect(
      getFeeReplacementOptions({
        account: account({ utxos: [] }),
        backend: 'electrum',
        ownedOutpoints: OWNED_PREVIOUS,
        tx: transaction()
      }).actions.cpfp
    ).toBe(false)
  })
})

describe('spendsUnconfirmedParent', () => {
  it('treats a missing block height as an unconfirmed parent', () => {
    expect(
      spendsUnconfirmedParent(
        [{ txid: PREVIOUS_TXID }],
        [{ blockHeight: undefined, id: PREVIOUS_TXID }]
      )
    ).toBe(true)
    expect(
      spendsUnconfirmedParent(
        [{ txid: PREVIOUS_TXID }],
        [{ blockHeight: 10, id: PREVIOUS_TXID }]
      )
    ).toBe(false)
  })

  it('ignores parents the account does not know', () => {
    expect(spendsUnconfirmedParent([{ txid: PREVIOUS_TXID }], [])).toBe(false)
  })
})

describe('fee rates', () => {
  it('derives the fee rate only when fee and size are known', () => {
    expect(getTransactionFeeRate({ fee: 280, vsize: 140 })).toBe(2)
    expect(
      getTransactionFeeRate({ fee: undefined, vsize: 140 })
    ).toBeUndefined()
    expect(getTransactionFeeRate({ fee: 280, vsize: 0 })).toBeUndefined()
  })

  it('raises the replacement above the original rate by the incremental relay fee', () => {
    expect(minimumReplacementFeeRate(2)).toBe(3)
    expect(minimumReplacementFeeRate(2.4)).toBe(4)
    expect(minimumReplacementFeeRate(undefined)).toBe(1)
  })

  it('sets the child fee so the package reaches the target rate', () => {
    expect(
      minimumChildFee({
        childVsize: 100,
        parentFee: 200,
        parentVsize: 100,
        targetFeeRate: 5
      })
    ).toBe(800)
  })

  it('keeps a relay-sized child when the parent is already above the target', () => {
    expect(
      minimumChildFee({
        childVsize: 110,
        parentFee: 50_000,
        parentVsize: 200,
        targetFeeRate: 2
      })
    ).toBe(110)
  })
})

describe('parseFeeReplacementKind', () => {
  it('accepts only the known kinds', () => {
    expect(parseFeeReplacementKind('bump')).toBe('bump')
    expect(parseFeeReplacementKind(['cancel'])).toBe('cancel')
    expect(parseFeeReplacementKind('cpfp')).toBe('cpfp')
    expect(parseFeeReplacementKind('other')).toBeUndefined()
    expect(parseFeeReplacementKind(undefined)).toBeUndefined()
  })
})

describe('getBumpRecipients', () => {
  it('keeps the payments and drops the change', () => {
    expect(
      getBumpRecipients(transaction().vout, new Set([CHANGE]))
    ).toStrictEqual([{ address: PAYMENT, amountSats: 50_000 }])
  })

  it('refuses outputs without an address', () => {
    expect(
      getBumpRecipients([{ address: '', value: 0 }], new Set([CHANGE]))
    ).toBeUndefined()
  })
})

describe('pickCpfpUtxo', () => {
  it('picks the largest spendable output of the transaction', () => {
    const picked = pickCpfpUtxo(
      account({
        excludedUtxoOutpoints: [`${TXID}:2`],
        utxos: [
          utxo(10_000, 0),
          utxo(30_000, 1),
          utxo(90_000, 2),
          utxo(80_000, 0, PREVIOUS_TXID)
        ]
      }),
      TXID
    )
    expect(picked?.vout).toBe(1)
  })

  it('returns nothing when the transaction has no spendable output', () => {
    expect(pickCpfpUtxo(account({ utxos: [] }), TXID)).toBeUndefined()
  })
})

describe('buildCpfpDraft', () => {
  const child = utxo(100_000)

  it('builds a child that spends one owned output to the destination', () => {
    const result = buildCpfpDraft({
      destination: FRESH,
      destinationLabel: 'CPFP',
      parentFee: 200,
      parentVsize: 100,
      targetFeeRate: 5,
      utxo: child
    })
    if (!result.ok) {
      throw new Error('expected a draft')
    }
    const [output] = result.draft.outputs
    expect(result.draft.inputs).toStrictEqual([child])
    expect(result.draft.outputs).toHaveLength(1)
    expect(output.to).toBe(FRESH)
    expect(output.label).toBe('CPFP')
    expect(output.amount + result.draft.fee).toBe(child.value)
    expect(result.draft.fee).toBeGreaterThan(5 * 100 - 200)
  })

  it('refuses a child whose output would be dust', () => {
    expect(
      buildCpfpDraft({
        destination: FRESH,
        destinationLabel: 'CPFP',
        parentFee: 0,
        parentVsize: 100,
        targetFeeRate: 5,
        utxo: utxo(DUST_LIMIT + 100)
      })
    ).toStrictEqual({ ok: false, reason: 'insufficient' })
  })

  it('refuses a child without a destination', () => {
    expect(
      buildCpfpDraft({
        destination: '',
        destinationLabel: 'CPFP',
        parentFee: 200,
        parentVsize: 100,
        targetFeeRate: 5,
        utxo: child
      })
    ).toStrictEqual({ ok: false, reason: 'no-destination' })
  })
})

describe('buildDraftFromReplacementPsbt', () => {
  it('maps the built transaction into a draft with owned keychains and labels', () => {
    const draft = buildDraftFromReplacementPsbt({
      addresses: [
        { address: CHANGE, keychain: 'internal' },
        { address: FRESH, keychain: 'external' }
      ],
      extracted: {
        fee: 500,
        inputs: [
          {
            address: CHANGE,
            script: '0014aa',
            txid: PREVIOUS_TXID,
            value: 90_500,
            vout: 1
          }
        ],
        outputs: [
          { address: PAYMENT, script: '0014bb', value: 50_000 },
          { address: FRESH, script: '0014cc', value: 40_000 }
        ]
      },
      feeRate: 4,
      labelByAddress: new Map([[PAYMENT, 'Rent']])
    })
    expect(draft).toStrictEqual({
      fee: 500,
      feeRate: 4,
      inputs: [
        {
          addressTo: CHANGE,
          keychain: 'internal',
          script: '0014aa',
          txid: PREVIOUS_TXID,
          value: 90_500,
          vout: 1
        }
      ],
      outputs: [
        { amount: 50_000, label: 'Rent', to: PAYMENT },
        { amount: 40_000, label: '', to: FRESH }
      ]
    })
  })
})
