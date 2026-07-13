import {
  getOutputMaxAllowedSats,
  getTransactionRemainingBalance,
  isTransactionUnderfunded
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
