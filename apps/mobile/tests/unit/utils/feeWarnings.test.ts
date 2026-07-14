import {
  getFeePercentage,
  getFeeRateInputMax,
  getFeeRateSliderMax,
  isElevatedFeeRate,
  isHighMinerFee
} from '@/utils/feeWarnings'

describe('getFeePercentage', () => {
  it('uses total inputs minus fee when outputs are not provided', () => {
    expect(
      getFeePercentage({
        minerFeeSats: 10_000,
        totalInputSats: 110_000
      })
    ).toBeCloseTo(0.1)
  })

  it('uses explicit total outputs when provided', () => {
    expect(
      getFeePercentage({
        minerFeeSats: 5_000,
        totalOutputSats: 50_000
      })
    ).toBe(0.1)
  })
})

describe('isHighMinerFee', () => {
  it('is true at 10% of total value out', () => {
    expect(
      isHighMinerFee({
        minerFeeSats: 10_000,
        totalInputSats: 110_000
      })
    ).toBe(true)
  })

  it('is false below 10% of total value out', () => {
    expect(
      isHighMinerFee({
        minerFeeSats: 9_999,
        totalInputSats: 110_000
      })
    ).toBe(false)
  })
})

describe('getFeeRateSliderMax', () => {
  it('uses at least 128 sat/vB', () => {
    expect(getFeeRateSliderMax(1)).toBe(128)
  })

  it('scales with the recommended next-block fee', () => {
    expect(getFeeRateSliderMax(40)).toBe(160)
  })
})

describe('getFeeRateInputMax', () => {
  it('allows manual entry up to at least 1024 sat/vB', () => {
    expect(getFeeRateInputMax(1)).toBe(1024)
  })
})

describe('isElevatedFeeRate', () => {
  it('is true when fee rate is at least 2x the recommendation', () => {
    expect(isElevatedFeeRate(20, 10)).toBe(true)
  })

  it('is false when fee rate is below 2x the recommendation', () => {
    expect(isElevatedFeeRate(19, 10)).toBe(false)
  })
})
