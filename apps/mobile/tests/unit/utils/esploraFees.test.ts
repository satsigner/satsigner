import {
  feesFromEsploraEstimates,
  feesFromUnknownEsploraEstimates,
  parseEsploraFeeEstimates
} from '@/utils/esploraFees'

describe('feesFromEsploraEstimates', () => {
  it('maps confirmation targets to fee tiers', () => {
    expect(
      feesFromEsploraEstimates({
        '1': 22.4,
        '144': 1.2,
        '3': 12.1,
        '6': 5.6
      })
    ).toStrictEqual({
      high: 22,
      low: 6,
      medium: 12,
      none: 1
    })
  })

  it('returns null without a near-term estimate', () => {
    expect(feesFromEsploraEstimates({ '144': 1 })).toBeNull()
  })
})

describe('parseEsploraFeeEstimates', () => {
  it('keeps finite numeric targets', () => {
    expect(
      parseEsploraFeeEstimates({
        '1': 10,
        '3': 'nope',
        nested: { x: 1 }
      })
    ).toStrictEqual({ '1': 10 })
  })

  it('returns null for non-objects', () => {
    expect(parseEsploraFeeEstimates(null)).toBeNull()
    expect(parseEsploraFeeEstimates([])).toBeNull()
  })
})

describe('feesFromUnknownEsploraEstimates', () => {
  it('maps a valid unknown payload', () => {
    expect(
      feesFromUnknownEsploraEstimates({
        '1': 22.4,
        '3': 12.1,
        '6': 5.6
      })
    ).toStrictEqual({
      high: 22,
      low: 6,
      medium: 12,
      none: 1
    })
  })
})
