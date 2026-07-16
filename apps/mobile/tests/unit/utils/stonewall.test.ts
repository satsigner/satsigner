import {
  buildSingleTxChartOutputs,
  buildStonewallMaterializationPlan,
  buildStonewallPreviewOutputs,
  CHART_REMAINING_BALANCE_LOCAL_ID,
  classifyChartOutput,
  getEphemeralChangeOutputLocalIds,
  getStonewallPaymentContext
} from '@/utils/stonewall'
import { splitStonewallOutputValues } from '@/utils/utxo'

describe('classifyChartOutput', () => {
  const own = new Set(['bc1qown', 'bc1qchange', 'bc1qdecoy'])

  it('marks fake-mix outputs', () => {
    expect(
      classifyChartOutput(
        {
          kind: 'fakeMix',
          label: 'Coffee',
          localId: 'stonewallFakeMix-0',
          to: 'bc1qdecoy'
        },
        own
      )
    ).toStrictEqual({
      isChange: false,
      isFakeMix: true,
      isSelfSend: false
    })
  })

  it('marks change outputs by kind even when address is wallet-owned', () => {
    expect(
      classifyChartOutput(
        {
          kind: 'change',
          label: 'Change',
          localId: 'stonewallChange-0',
          to: 'bc1qchange'
        },
        own
      )
    ).toStrictEqual({
      isChange: true,
      isFakeMix: false,
      isSelfSend: false
    })
  })

  it('marks self-sends to own addresses that are not change', () => {
    expect(
      classifyChartOutput(
        {
          label: 'Refund',
          localId: 'out-1',
          to: 'bc1qown'
        },
        own
      )
    ).toStrictEqual({
      isChange: false,
      isFakeMix: false,
      isSelfSend: true
    })
  })

  it('marks external recipients as spends', () => {
    expect(
      classifyChartOutput(
        {
          label: 'Merchant',
          localId: 'out-2',
          to: 'bc1qexternal'
        },
        own
      )
    ).toStrictEqual({
      isChange: false,
      isFakeMix: false,
      isSelfSend: false
    })
  })
})

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
      kind: 'change',
      localId: 'stonewallChange-0',
      to: 'bc1qchange1'
    })
    expect(outputs[2]).toMatchObject({
      amount: 2000,
      kind: 'change',
      localId: 'stonewallChange-1',
      to: 'bc1qchange2'
    })
  })

  it('applies label overrides to preview outputs', () => {
    const outputs = buildStonewallPreviewOutputs({
      changeAddress: 'bc1qchange1',
      changeValues: [1000],
      decoyAddress: 'bc1qdecoy',
      fakeMixLabel: 'Coffee shop',
      fakeMixValues: [500],
      fee: 678,
      labelOverrides: {
        'stonewallChange-0': 'Savings',
        'stonewallFakeMix-0': 'Decoy'
      }
    })

    expect(outputs[0].label).toBe('Decoy')
    expect(outputs[1].label).toBe('Savings')
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
          kind: 'change',
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

describe('getEphemeralChangeOutputLocalIds', () => {
  it('returns stonewall-managed and change-address output ids', () => {
    expect(
      getEphemeralChangeOutputLocalIds(
        [
          {
            kind: undefined,
            localId: 'payment',
            to: 'bc1qrecipient'
          },
          {
            kind: 'fakeMix',
            localId: 'stonewallFakeMix-0',
            to: 'bc1qdecoy'
          },
          {
            kind: 'change',
            localId: 'stonewallChange-0',
            to: 'bc1qchange'
          },
          {
            kind: undefined,
            localId: 'user-change',
            to: 'bc1qchange2'
          }
        ],
        ['bc1qchange', 'bc1qchange2', 'bc1qdecoy']
      )
    ).toStrictEqual(['stonewallFakeMix-0', 'stonewallChange-0', 'user-change'])
  })

  it('ignores undefined change addresses and payment outputs', () => {
    expect(
      getEphemeralChangeOutputLocalIds(
        [
          {
            kind: undefined,
            localId: 'payment',
            to: 'bc1qrecipient'
          }
        ],
        [undefined, undefined]
      )
    ).toStrictEqual([])
  })
})
