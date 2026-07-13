import { validateBoardAmount } from '@/utils/arkBoard'

describe('validateBoardAmount', () => {
  it('accepts an amount within balance and above the minimum', () => {
    const result = validateBoardAmount({
      amountSats: 50_000,
      availableSats: 100_000,
      minBoardAmountSats: 10_000
    })
    expect(result).toStrictEqual({ valid: true })
  })

  it('accepts an amount equal to the available balance', () => {
    const result = validateBoardAmount({
      amountSats: 100_000,
      availableSats: 100_000,
      minBoardAmountSats: 10_000
    })
    expect(result).toStrictEqual({ valid: true })
  })

  it('accepts an amount equal to the minimum', () => {
    const result = validateBoardAmount({
      amountSats: 10_000,
      availableSats: 100_000,
      minBoardAmountSats: 10_000
    })
    expect(result).toStrictEqual({ valid: true })
  })

  it('rejects a zero amount', () => {
    const result = validateBoardAmount({
      amountSats: 0,
      availableSats: 100_000,
      minBoardAmountSats: 10_000
    })
    expect(result).toStrictEqual({ reason: 'invalidAmount', valid: false })
  })

  it('rejects a negative amount', () => {
    const result = validateBoardAmount({
      amountSats: -1,
      availableSats: 100_000,
      minBoardAmountSats: 10_000
    })
    expect(result).toStrictEqual({ reason: 'invalidAmount', valid: false })
  })

  it('rejects a fractional amount', () => {
    const result = validateBoardAmount({
      amountSats: 10_000.5,
      availableSats: 100_000,
      minBoardAmountSats: 10_000
    })
    expect(result).toStrictEqual({ reason: 'invalidAmount', valid: false })
  })

  it('rejects an amount below the minimum', () => {
    const result = validateBoardAmount({
      amountSats: 9_999,
      availableSats: 100_000,
      minBoardAmountSats: 10_000
    })
    expect(result).toStrictEqual({ reason: 'belowMinimum', valid: false })
  })

  it('rejects an amount above the available balance', () => {
    const result = validateBoardAmount({
      amountSats: 100_001,
      availableSats: 100_000,
      minBoardAmountSats: 10_000
    })
    expect(result).toStrictEqual({ reason: 'insufficientFunds', valid: false })
  })

  it('skips the minimum check when the server minimum is unknown', () => {
    const result = validateBoardAmount({
      amountSats: 1,
      availableSats: 100_000
    })
    expect(result).toStrictEqual({ valid: true })
  })
})
