import { utxoAmountTextSize } from '@/utils/utxoAmountTextSize'

describe('utxoAmountTextSize', () => {
  it('uses larger size for short amounts and smaller for long ones', () => {
    expect(utxoAmountTextSize(539)).toBe('3xl')
    expect(utxoAmountTextSize(143_565)).toBe('2xl')
    expect(utxoAmountTextSize(12_345_678)).toBe('xl')
  })
})
