import { DUST_LIMIT } from '@/constants/btc'
import { type Utxo } from '@/types/models/Utxo'
import {
  assessAccountTransaction,
  buildCancelToSelfDraft,
  buildCpfpDraft,
  buildFeeBumpDraft,
  getPreviewReplacementFlags,
  getReplacementActions,
  minimumChildFee,
  minimumReplacementFee,
  parseFeeRateFloor,
  pickFreshReceiveAddress,
  resolveReplacementInputs,
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
  it('signals when any sequence is below 0xfffffffe', () => {
    expect(transactionSignalsRbf([{ sequence: 0xfffffffd }])).toBe(true)
    expect(
      transactionSignalsRbf([
        { sequence: 0xffffffff },
        { sequence: 0xfffffffd }
      ])
    ).toBe(true)
  })

  it('does not signal when every sequence is final', () => {
    expect(transactionSignalsRbf([{ sequence: 0xffffffff }])).toBe(false)
    expect(transactionSignalsRbf([{ sequence: 0xfffffffe }])).toBe(false)
  })
})

describe('assessAccountTransaction', () => {
  const previous = 'bb'.repeat(32)
  const txid = 'cc'.repeat(32)
  const vin = [
    {
      previousOutput: { txid: previous, vout: 1 },
      sequence: 0xfffffffd
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
        { previousOutput: { txid: previous, vout: 0 }, sequence: 0xffffffff }
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
        parentFee: 50000,
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
})

describe('replacement drafts', () => {
  const spend = utxo(100000, 0, PAYMENT)

  it('shrinks change to pay a higher fee and keeps the payment', () => {
    const result = buildFeeBumpDraft({
      changeAddress: FRESH,
      extraUtxos: [],
      internalAddresses: new Set([CHANGE]),
      originalFee: 200,
      originalVsize: 140,
      outputs: [
        { amount: 50000, label: 'Pay', to: PAYMENT },
        { amount: 49800, kind: 'change', label: 'Change', to: CHANGE }
      ],
      resolvedInputs: [spend],
      targetFeeRate: 1
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.draft.outputs).toStrictEqual([
      expect.objectContaining({ amount: 50000, to: PAYMENT })
    ])
    expect(result.draft.fee).toBeGreaterThan(200)
    expect(result.draft.rbf).toBe(true)
  })

  it('adds a wallet input when change cannot cover the bump', () => {
    const result = buildFeeBumpDraft({
      changeAddress: FRESH,
      extraUtxos: [utxo(20000, 1, CHANGE)],
      internalAddresses: new Set([CHANGE]),
      originalFee: 100,
      originalVsize: 110,
      outputs: [
        { amount: 99000, label: 'Pay', to: PAYMENT },
        { amount: 200, kind: 'change', label: 'Change', to: CHANGE }
      ],
      resolvedInputs: [utxo(99300, 0, PAYMENT)],
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

  it('refuses a bump that still cannot pay the fee', () => {
    const result = buildFeeBumpDraft({
      changeAddress: FRESH,
      extraUtxos: [],
      internalAddresses: new Set([CHANGE]),
      originalFee: 100,
      originalVsize: 110,
      outputs: [{ amount: 99000, label: 'Pay', to: PAYMENT }],
      resolvedInputs: [utxo(99100, 0, PAYMENT)],
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
    expect(result.draft.outputs[0].amount + result.draft.fee).toBe(100000)
  })

  it('builds a child that spends one owned output', () => {
    const result = buildCpfpDraft({
      destination: FRESH,
      destinationLabel: 'Child',
      parentFee: 200,
      parentVsize: 140,
      targetFeeRate: 8,
      utxo: utxo(50000, 1, CHANGE)
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

describe('resolveReplacementInputs', () => {
  it('rebuilds inputs from the parent output this account created', () => {
    const parent = 'ee'.repeat(32)
    const inputs = resolveReplacementInputs(
      [{ previousOutput: { txid: parent, vout: 0 }, sequence: 0xfffffffd }],
      [
        {
          id: parent,
          vout: [{ address: PAYMENT, value: 80000 }]
        }
      ],
      [{ address: PAYMENT, keychain: 'external' }]
    )
    expect(inputs?.[0]).toMatchObject({
      addressTo: PAYMENT,
      txid: parent,
      value: 80000,
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
