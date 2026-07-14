import {
  getArkAutoBoardStatus,
  getArkMinBoardAmount,
  validateBoardAmount
} from '@/utils/arkBoard'

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

describe('getArkMinBoardAmount', () => {
  it('returns undefined when the server minimum is unknown', () => {
    expect(getArkMinBoardAmount(undefined)).toBeUndefined()
  })

  it('floors the minimum at the dust limit', () => {
    expect(getArkMinBoardAmount(100)).toBe(546)
  })

  it('returns the server minimum when above the dust limit', () => {
    expect(getArkMinBoardAmount(10_000)).toBe(10_000)
  })
})

describe('getArkAutoBoardStatus', () => {
  const baseState = {
    boardFailed: false,
    confirmedSats: 0,
    isBoarding: false,
    minBoardAmountSats: 10_000,
    pendingSats: 0
  }

  it('reports failed when the board mutation errored', () => {
    const status = getArkAutoBoardStatus({
      ...baseState,
      boardFailed: true,
      confirmedSats: 20_000
    })
    expect(status).toBe('failed')
  })

  it('reports boarding while the board mutation is pending', () => {
    const status = getArkAutoBoardStatus({
      ...baseState,
      confirmedSats: 20_000,
      isBoarding: true
    })
    expect(status).toBe('boarding')
  })

  it('reports loading while the server minimum is unknown', () => {
    const status = getArkAutoBoardStatus({
      ...baseState,
      confirmedSats: 20_000,
      minBoardAmountSats: undefined
    })
    expect(status).toBe('loading')
  })

  it('reports readyToBoard when the confirmed balance reaches the minimum', () => {
    const status = getArkAutoBoardStatus({
      ...baseState,
      confirmedSats: 10_000
    })
    expect(status).toBe('readyToBoard')
  })

  it('applies the dust limit floor to a low server minimum', () => {
    const status = getArkAutoBoardStatus({
      ...baseState,
      confirmedSats: 500,
      minBoardAmountSats: 100
    })
    expect(status).toBe('belowMinimum')
  })

  it('reports waitingConfirmation when funds are pending', () => {
    const status = getArkAutoBoardStatus({
      ...baseState,
      pendingSats: 20_000
    })
    expect(status).toBe('waitingConfirmation')
  })

  it('reports belowMinimum when confirmed funds are under the minimum', () => {
    const status = getArkAutoBoardStatus({
      ...baseState,
      confirmedSats: 9_999
    })
    expect(status).toBe('belowMinimum')
  })

  it('reports waitingForFunds when there is no balance', () => {
    const status = getArkAutoBoardStatus(baseState)
    expect(status).toBe('waitingForFunds')
  })
})
