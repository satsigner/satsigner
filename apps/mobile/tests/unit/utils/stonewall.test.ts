import {
  buildSingleTxChartOutputs,
  buildStonewallMaterializationPlan,
  buildStonewallPreviewOutputs,
  CHART_REMAINING_BALANCE_LOCAL_ID,
  getStonewallPaymentContext
} from '@/utils/stonewall'
import { splitStonewallOutputValues } from '@/utils/utxo'

describe('buildStonewallPreviewOutputs', () => {
  it('returns empty when fee is null', () => {
    expect(
      buildStonewallPreviewOutputs({
        changeAddress: 'bc1qchange',
        changeValues: [1000],
        decoyAddress: 'bc1qdecoy',
        fakeMixValues: [500],
        fee: null,
        secondChangeAddress: 'bc1qchange2'
      })
    ).toStrictEqual([])
  })

  it('builds fake-mix and change preview outputs', () => {
    const outputs = buildStonewallPreviewOutputs({
      changeAddress: 'bc1qchange1',
      changeValues: [1000, 2000],
      decoyAddress: 'bc1qdecoy',
      fakeMixLabel: 'Coffee shop',
      fakeMixValues: [500],
      fee: 678,
      secondChangeAddress: 'bc1qchange2'
    })

    expect(outputs).toHaveLength(3)
    expect(outputs[0]).toMatchObject({
      amount: 500,
      kind: 'fakeMix',
      label: 'Coffee shop',
      localId: 'stonewallFakeMix-0',
      to: 'bc1qdecoy'
    })
    expect(outputs[1]).toMatchObject({
      amount: 1000,
      localId: 'stonewallChange-0',
      to: 'bc1qchange1'
    })
    expect(outputs[2]).toMatchObject({
      amount: 2000,
      localId: 'stonewallChange-1',
      to: 'bc1qchange2'
    })
  })
})

describe('buildStonewallMaterializationPlan', () => {
  it('returns fake mix and change outputs ready for the store', () => {
    const plan = buildStonewallMaterializationPlan({
      changeAddress: 'bc1qchange1',
      changeValues: [1_000],
      decoyAddress: 'bc1qdecoy',
      fakeMixLabel: 'Coffee shop',
      fakeMixValues: [500],
      fee: 678,
      secondChangeAddress: 'bc1qchange2'
    })

    expect(plan).toStrictEqual({
      fee: 678,
      outputs: [
        {
          amount: 500,
          kind: 'fakeMix',
          label: 'Coffee shop',
          to: 'bc1qdecoy'
        },
        {
          amount: 1_000,
          label: 'Change',
          to: 'bc1qchange1'
        }
      ]
    })
  })

  it('returns null when stonewall fee is unavailable', () => {
    expect(
      buildStonewallMaterializationPlan({
        changeAddress: 'bc1qchange1',
        changeValues: [],
        decoyAddress: 'bc1qdecoy',
        fakeMixLabel: '',
        fakeMixValues: [500],
        fee: null
      })
    ).toBeNull()
  })
})

describe('buildSingleTxChartOutputs', () => {
  it('appends remaining balance when no preview outputs exist', () => {
    const chartOutputs = buildSingleTxChartOutputs({
      changeAddress: 'bc1qchange',
      outputs: [
        {
          amount: 1000,
          label: 'pay',
          localId: 'out-1',
          to: 'bc1qrecipient'
        }
      ],
      previewOutputs: [],
      remainingBalance: 5000
    })

    expect(chartOutputs).toHaveLength(2)
    expect(chartOutputs[1]).toMatchObject({
      amount: 5000,
      localId: CHART_REMAINING_BALANCE_LOCAL_ID,
      to: 'bc1qchange'
    })
  })
})

describe('getStonewallPaymentContext', () => {
  it('excludes decoy outputs from payment amount', () => {
    const context = getStonewallPaymentContext({
      accountAddresses: [],
      decoyAddress: 'bc1qdecoy',
      localFeeRate: 2,
      nextBlockFee: 5,
      outputs: [
        {
          amount: 1000,
          label: 'pay',
          localId: 'out-1',
          to: 'bc1qrecipient'
        },
        {
          amount: 500,
          label: 'decoy',
          localId: 'out-2',
          to: 'bc1qdecoy'
        }
      ]
    })

    expect(context.userPaymentAmount).toBe(1000)
    expect(context.paymentOutputs).toHaveLength(1)
    expect(context.paymentLabel).toBe('pay')
    expect(context.effectiveFeeRate).toBe(2)
  })
})

describe('splitStonewallOutputValues', () => {
  it('splits change and fake-mix values', () => {
    expect(
      splitStonewallOutputValues([
        { scriptType: 'P2WPKH', type: 'fakeMix', value: 100 },
        { scriptType: 'P2WPKH', type: 'change', value: 200 },
        { scriptType: 'P2WPKH', type: 'change', value: 300 }
      ])
    ).toStrictEqual({
      changeValues: [200, 300],
      fakeMixValues: [100]
    })
  })
})
