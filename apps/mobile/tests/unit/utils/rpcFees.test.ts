import { feesFromBtcPerKb } from '@/utils/rpcFees'

describe('feesFromBtcPerKb', () => {
  it('converts BTC/kB to sat/vB fee tiers', () => {
    // 0.00001 BTC/kB = 1 sat/vB
    expect(feesFromBtcPerKb(0.00001)).toStrictEqual({
      high: 1,
      low: 1,
      medium: 1,
      none: 1
    })
  })

  it('scales medium and low from the high rate', () => {
    // 0.0002 BTC/kB = 20 sat/vB
    expect(feesFromBtcPerKb(0.0002)).toStrictEqual({
      high: 20,
      low: 10,
      medium: 15,
      none: 1
    })
  })
})
