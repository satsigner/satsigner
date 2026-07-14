import {
  getCommittedTransactionOutputSats,
  getFundingMinerFeeSats,
  getOutputMaxAllowedSats,
  getProjectedMinerFeeSats,
  getTransactionRemainingBalance,
  isTransactionUnderfunded,
  shouldDeferUnderfundedWarning
} from '@/utils/transactionFunding'

describe('getTransactionRemainingBalance', () => {
  it('returns inputs minus outputs and fee', () => {
    expect(getTransactionRemainingBalance(100_000, 80_000, 500)).toBe(19_500)
  })
})

describe('isTransactionUnderfunded', () => {
  it('is true when outputs and fee exceed inputs', () => {
    expect(isTransactionUnderfunded(50_000, 49_000, 2_000)).toBe(true)
  })

  it('is false when inputs cover outputs and fee', () => {
    expect(isTransactionUnderfunded(50_000, 40_000, 1_000)).toBe(false)
  })
})

describe('getOutputMaxAllowedSats', () => {
  it('returns the max this output can be given other outputs', () => {
    expect(
      getOutputMaxAllowedSats({
        minerFeeSats: 1_000,
        outputAmountSats: 60_000,
        outputsTotalSats: 120_000,
        totalInputSats: 100_000
      })
    ).toBe(39_000)
  })

  it('never returns a negative max', () => {
    expect(
      getOutputMaxAllowedSats({
        minerFeeSats: 5_000,
        outputAmountSats: 20_000,
        outputsTotalSats: 30_000,
        totalInputSats: 10_000
      })
    ).toBe(0)
  })
})

describe('getCommittedTransactionOutputSats', () => {
  it('includes stonewall preview output amounts', () => {
    expect(getCommittedTransactionOutputSats(50_000, [4_687, 1_000])).toBe(
      55_687
    )
  })
})

describe('getFundingMinerFeeSats', () => {
  it('uses the projected fee when no stonewall fee is available', () => {
    expect(
      getFundingMinerFeeSats({
        projectedMinerFeeSats: 1_500
      })
    ).toBe(1_500)
  })

  it('uses the stonewall fee when privacy selection is active', () => {
    expect(
      getFundingMinerFeeSats({
        projectedMinerFeeSats: 2_500,
        stonewallMinerFeeSats: 678
      })
    ).toBe(678)
  })
})

describe('getProjectedMinerFeeSats', () => {
  it('returns 0 when there are no inputs', () => {
    expect(
      getProjectedMinerFeeSats({
        committedOutputSats: 50_000,
        feeRate: 2,
        fundingOutputs: [
          { amount: 50_000, label: '', localId: '1', to: 'bc1q' }
        ],
        inputs: [],
        totalInputSats: 0
      })
    ).toBe(0)
  })

  it('includes change output vsize when inputs cover committed outputs and fee', () => {
    const input = {
      address: 'bc1qinput',
      txid: 'aa'.repeat(32),
      value: 200_000,
      vout: 0
    }
    const fundingOutputs = [
      { amount: 50_000, label: '', localId: '1', to: 'bc1qpay' }
    ]

    const feeWithoutChange = getProjectedMinerFeeSats({
      committedOutputSats: 50_000,
      feeRate: 1,
      fundingOutputs,
      inputs: [input],
      totalInputSats: 200_000
    })

    expect(feeWithoutChange).toBeGreaterThan(0)
  })
})

describe('shouldDeferUnderfundedWarning', () => {
  it('defers while uri auto-select is pending', () => {
    expect(
      shouldDeferUnderfundedWarning({
        defaultAutoSelectAlgorithm: 'privacy',
        inputsCount: 0,
        isAutoSelectPending: true,
        isSelectingUtxos: false,
        outputsCount: 1,
        selectedAlgorithm: 'user'
      })
    ).toBe(true)
  })

  it('does not defer uri auto-select pending once inputs are selected', () => {
    expect(
      shouldDeferUnderfundedWarning({
        defaultAutoSelectAlgorithm: 'privacy',
        inputsCount: 2,
        isAutoSelectPending: true,
        isSelectingUtxos: false,
        outputsCount: 1,
        selectedAlgorithm: 'user'
      })
    ).toBe(false)
  })

  it('defers while utxo selection is running', () => {
    expect(
      shouldDeferUnderfundedWarning({
        defaultAutoSelectAlgorithm: 'privacy',
        inputsCount: 0,
        isAutoSelectPending: false,
        isSelectingUtxos: true,
        outputsCount: 1,
        selectedAlgorithm: 'user'
      })
    ).toBe(true)
  })

  it('defers when outputs exist but auto-select has not populated inputs yet', () => {
    expect(
      shouldDeferUnderfundedWarning({
        defaultAutoSelectAlgorithm: 'privacy',
        inputsCount: 0,
        isAutoSelectPending: false,
        isSelectingUtxos: false,
        outputsCount: 1,
        selectedAlgorithm: 'user'
      })
    ).toBe(true)
  })

  it('does not defer once inputs are selected', () => {
    expect(
      shouldDeferUnderfundedWarning({
        defaultAutoSelectAlgorithm: 'privacy',
        inputsCount: 2,
        isAutoSelectPending: false,
        isSelectingUtxos: false,
        outputsCount: 1,
        selectedAlgorithm: 'privacy'
      })
    ).toBe(false)
  })

  it('does not defer for user mode with no auto-select default', () => {
    expect(
      shouldDeferUnderfundedWarning({
        defaultAutoSelectAlgorithm: 'user',
        inputsCount: 0,
        isAutoSelectPending: false,
        isSelectingUtxos: false,
        outputsCount: 1,
        selectedAlgorithm: 'user'
      })
    ).toBe(false)
  })
})
