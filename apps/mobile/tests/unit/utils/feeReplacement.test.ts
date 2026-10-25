import {
  BIP125_REPLACEABLE_SEQUENCE_BELOW,
  DUST_LIMIT,
  FINAL_SEQUENCE,
  RBF_SIGNAL_SEQUENCE
} from '@/constants/btc'
import { type Utxo } from '@/types/models/Utxo'
import {
  alignRemainderFee,
  assessAccountTransaction,
  buildCancelToSelfDraft,
  buildCpfpDraft,
  buildFeeBumpDraft,
  feeWithReplacementFloor,
  getPreviewReplacementFlags,
  getReplacementActions,
  minimumChildFee,
  minimumReplacementFee,
  parseFeeRateFloor,
  parseReplacementFeeFloor,
  pickFreshReceiveAddress,
  resolveReplacementInputs,
  selectConfirmedExtraUtxos,
  spendsUnconfirmedParent,
  transactionSignalsRbf
} from '@/utils/feeReplacement'

const PAYMENT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
const CHANGE = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const FRESH = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'

function utxo(value: number, vout = 0, address = CHANGE): Utxo {
  return {
    addressTo: address,
    keychain: 'external',
    txid: 'aa'.repeat(32),
    value,
    vout
  }
}

function owned(txid: string, vout: number): string {
  return `${txid}:${vout}`
}

describe('transactionSignalsRbf', () => {
  it('signals when any sequence is below 0xff_ff_ff_fe', () => {
    expect(transactionSignalsRbf([{ sequence: RBF_SIGNAL_SEQUENCE }])).toBe(
      true
    )
    expect(
      transactionSignalsRbf([
        { sequence: FINAL_SEQUENCE },
        { sequence: RBF_SIGNAL_SEQUENCE }
      ])
    ).toBe(true)
  })

  it('does not signal when every sequence is final', () => {
    expect(transactionSignalsRbf([{ sequence: FINAL_SEQUENCE }])).toBe(false)
    expect(
      transactionSignalsRbf([{ sequence: BIP125_REPLACEABLE_SEQUENCE_BELOW }])
    ).toBe(false)
  })
})

describe('assessAccountTransaction', () => {
  const previous = 'bb'.repeat(32)
  const txid = 'cc'.repeat(32)
  const vin = [
    {
      previousOutput: { txid: previous, vout: 1 },
      sequence: RBF_SIGNAL_SEQUENCE
    }
  ]

  it('allows a bump only when unconfirmed, signaled, and every input is ours', () => {
    const assessment = assessAccountTransaction({
      blockHeight: undefined,
      ownedOutpoints: new Set([owned(previous, 1)]),
      txid,
      unspentOutpoints: new Set([owned(txid, 0)]),
      vin,
      vout: [{ address: CHANGE }, { address: PAYMENT }]
    })
    expect(assessment.canBumpOrCancel).toBe(true)
    expect(assessment.canCpfp).toBe(true)
    expect(assessment.signalsRbf).toBe(true)
  })

  it('hides the bump for an incoming payment that does not spend our inputs', () => {
    const assessment = assessAccountTransaction({
      ownedOutpoints: new Set(),
      txid,
      unspentOutpoints: new Set([owned(txid, 0)]),
      vin: [
        {
          previousOutput: { txid: previous, vout: 0 },
          sequence: FINAL_SEQUENCE
        }
      ],
      vout: [{ address: PAYMENT }]
    })
    expect(assessment.canBumpOrCancel).toBe(false)
    expect(assessment.canCpfp).toBe(true)
    expect(assessment.signalsRbf).toBe(false)
  })

  it('offers nothing once the transaction is confirmed', () => {
    const assessment = assessAccountTransaction({
      blockHeight: 100,
      ownedOutpoints: new Set([owned(previous, 1)]),
      txid,
      unspentOutpoints: new Set([owned(txid, 0)]),
      vin,
      vout: [{ address: CHANGE }]
    })
    expect(assessment.unconfirmed).toBe(false)
    expect(assessment.canBumpOrCancel).toBe(false)
    expect(assessment.canCpfp).toBe(false)
  })

  it('drops child-pays-for-parent after the output is spent', () => {
    const assessment = assessAccountTransaction({
      ownedOutpoints: new Set([owned(previous, 1)]),
      txid,
      unspentOutpoints: new Set(),
      vin,
      vout: [{ address: CHANGE }]
    })
    expect(assessment.canCpfp).toBe(false)
    expect(assessment.canBumpOrCancel).toBe(true)
  })
})

describe('getReplacementActions', () => {
  const open = {
    allInputsOwned: true,
    canBumpOrCancel: true,
    canCpfp: true,
    hasUnspentOwnedOutput: true,
    signalsRbf: true,
    unconfirmed: true
  }

  it('hides actions for a watch-only account', () => {
    expect(getReplacementActions(open, 'watchonly')).toStrictEqual({
      bump: false,
      cancel: false,
      cpfp: false
    })
  })

  it('keeps actions for a multisig account this device can start', () => {
    expect(getReplacementActions(open, 'multisig').bump).toBe(true)
  })
})

describe('preview flags', () => {
  it('shows RBF from the draft signal and CPFP from an unconfirmed parent', () => {
    expect(
      getPreviewReplacementFlags({ rbf: true, spendsUnconfirmedParent: false })
    ).toStrictEqual({ showCpfp: false, showRbf: true })
    expect(
      getPreviewReplacementFlags({ rbf: false, spendsUnconfirmedParent: true })
    ).toStrictEqual({ showCpfp: true, showRbf: false })
  })

  it('treats a missing block height as an unconfirmed parent', () => {
    const parentId = 'dd'.repeat(32)
    expect(
      spendsUnconfirmedParent(
        [{ txid: parentId }],
        [{ blockHeight: undefined, id: parentId }]
      )
    ).toBe(true)
    expect(
      spendsUnconfirmedParent(
        [{ txid: parentId }],
        [{ blockHeight: 10, id: parentId }]
      )
    ).toBe(false)
  })
})

describe('fee floors', () => {
  it('raises the replacement by the incremental relay fee and the fee rate', () => {
    expect(minimumReplacementFee(1000, 100, 100)).toBe(1100)
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

  it('parses a fee-rate floor from the route', () => {
    expect(parseFeeRateFloor(undefined)).toBe(1)
    expect(parseFeeRateFloor('3.2')).toBe(4)
    expect(parseFeeRateFloor('0')).toBe(1)
  })

  it('keeps a replacement fee at the initial absolute floor', () => {
    expect(parseReplacementFeeFloor(undefined)).toBeUndefined()
    expect(parseReplacementFeeFloor('0')).toBeUndefined()
    expect(parseReplacementFeeFloor('250.9')).toBe(250)
    expect(feeWithReplacementFloor(180, undefined)).toBe(180)
    expect(feeWithReplacementFloor(180, 250)).toBe(250)
    expect(feeWithReplacementFloor(400, 250)).toBe(400)
  })
})

describe('replacement drafts', () => {
  const spend = utxo(100_000, 0, PAYMENT)

  it('shrinks change to pay a higher fee and keeps the payment', () => {
    const result = buildFeeBumpDraft({
      changeAddress: FRESH,
      extraUtxos: [],
      internalAddresses: new Set([CHANGE]),
      originalFee: 200,
      originalVsize: 140,
      outputs: [
        { amount: 50_000, label: 'Pay', to: PAYMENT },
        { amount: 49_800, kind: 'change', label: 'Change', to: CHANGE }
      ],
      resolvedInputs: [spend],
      targetFeeRate: 1
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.draft.outputs).toStrictEqual([
      expect.objectContaining({ amount: 50_000, to: PAYMENT })
    ])
    expect(result.draft.fee).toBeGreaterThan(200)
    expect(result.draft.rbf).toBe(true)
  })

  it('adds a wallet input when change cannot cover the bump', () => {
    const result = buildFeeBumpDraft({
      changeAddress: FRESH,
      extraUtxos: [utxo(20_000, 1, CHANGE)],
      internalAddresses: new Set([CHANGE]),
      originalFee: 100,
      originalVsize: 110,
      outputs: [
        { amount: 99_000, label: 'Pay', to: PAYMENT },
        { amount: 200, kind: 'change', label: 'Change', to: CHANGE }
      ],
      resolvedInputs: [utxo(99_300, 0, PAYMENT)],
      targetFeeRate: 50
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.draft.inputs).toHaveLength(2)
    expect(
      result.draft.outputs.some((output) => output.amount >= DUST_LIMIT)
    ).toBe(true)
  })

  it('adds only confirmed utxos that are not excluded', () => {
    const confirmedId = 'dd'.repeat(32)
    const unconfirmedId = 'ee'.repeat(32)
    const unknownId = 'ff'.repeat(32)
    const replacementId = '11'.repeat(32)
    const confirmed = { ...utxo(20_000, 1, CHANGE), txid: confirmedId }
    const unconfirmed = { ...utxo(30_000, 2, CHANGE), txid: unconfirmedId }
    const unknown = { ...utxo(40_000, 3, CHANGE), txid: unknownId }
    const excluded = { ...utxo(50_000, 4, CHANGE), txid: confirmedId }
    const sameTx = { ...utxo(60_000, 0, CHANGE), txid: replacementId }
    const spent = { ...utxo(70_000, 5, CHANGE), txid: confirmedId }
    expect(
      selectConfirmedExtraUtxos({
        excludedOutpoints: [`${confirmedId}:4`],
        replacementTxid: replacementId,
        spentOutpoints: new Set([`${confirmedId}:5`]),
        transactions: [
          { blockHeight: 10, id: confirmedId },
          { blockHeight: 0, id: unconfirmedId },
          { id: replacementId }
        ],
        utxos: [confirmed, unconfirmed, unknown, excluded, sameTx, spent]
      })
    ).toStrictEqual([confirmed])
  })

  it('refuses a bump that still cannot pay the fee', () => {
    const result = buildFeeBumpDraft({
      changeAddress: FRESH,
      extraUtxos: [],
      internalAddresses: new Set([CHANGE]),
      originalFee: 100,
      originalVsize: 110,
      outputs: [{ amount: 99_000, label: 'Pay', to: PAYMENT }],
      resolvedInputs: [utxo(99_100, 0, PAYMENT)],
      targetFeeRate: 80
    })
    expect(result).toStrictEqual({ ok: false, reason: 'insufficient' })
  })

  it('cancels to a single fresh address', () => {
    const result = buildCancelToSelfDraft({
      destination: FRESH,
      destinationLabel: 'Cancel',
      originalFee: 200,
      originalVsize: 140,
      resolvedInputs: [spend],
      targetFeeRate: 2
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.draft.outputs).toHaveLength(1)
    expect(result.draft.outputs[0].to).toBe(FRESH)
    expect(result.draft.outputs[0].amount + result.draft.fee).toBe(100_000)
  })

  it('builds a child that spends one owned output', () => {
    const result = buildCpfpDraft({
      destination: FRESH,
      destinationLabel: 'Child',
      parentFee: 200,
      parentVsize: 140,
      targetFeeRate: 8,
      utxo: utxo(50_000, 1, CHANGE)
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.draft.inputs).toHaveLength(1)
    expect(result.draft.outputs[0].to).toBe(FRESH)
    expect(result.draft.fee).toBeGreaterThan(result.draft.inputs[0].value / 100)
  })
})

describe('alignRemainderFee', () => {
  it('keeps a fee the preview can recompute from the rate', () => {
    const settled = alignRemainderFee({
      fee: 200,
      inputValue: 10_000,
      vsize: 141
    })
    expect(settled).toStrictEqual({
      amount: 9718,
      fee: 282,
      feeRate: 2
    })
    expect(settled && Math.round(settled.feeRate * 141)).toBe(settled?.fee)
  })

  it('refuses a remainder below the dust limit', () => {
    expect(
      alignRemainderFee({ fee: 200, inputValue: 600, vsize: 141 })
    ).toBeUndefined()
  })
})

describe('resolveReplacementInputs', () => {
  it('rebuilds inputs from the parent output this account created', () => {
    const parent = 'ee'.repeat(32)
    const inputs = resolveReplacementInputs(
      [
        {
          previousOutput: { txid: parent, vout: 0 },
          sequence: RBF_SIGNAL_SEQUENCE
        }
      ],
      [
        {
          id: parent,
          vout: [{ address: PAYMENT, value: 80_000 }]
        }
      ],
      [{ address: PAYMENT, keychain: 'external' }]
    )
    expect(inputs?.[0]).toMatchObject({
      addressTo: PAYMENT,
      txid: parent,
      value: 80_000,
      vout: 0
    })
  })

  it('returns nothing when a previous output is unknown', () => {
    expect(
      resolveReplacementInputs(
        [{ previousOutput: { txid: 'ff'.repeat(32), vout: 0 }, sequence: 1 }],
        [],
        []
      )
    ).toBeUndefined()
  })
})

describe('pickFreshReceiveAddress', () => {
  it('prefers the lowest-index unused external address', () => {
    expect(
      pickFreshReceiveAddress([
        {
          address: CHANGE,
          index: 0,
          keychain: 'internal',
          summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 }
        },
        {
          address: PAYMENT,
          index: 1,
          keychain: 'external',
          summary: { balance: 1, satsInMempool: 0, transactions: 2, utxos: 1 }
        },
        {
          address: FRESH,
          index: 4,
          keychain: 'external',
          summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 }
        }
      ])
    ).toBe(FRESH)
  })
})
