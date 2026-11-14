import { FULLY_CONFIRMED_COUNT } from '@/constants/btc'
import { Colors } from '@/styles'
import {
  getConfirmations,
  getConfirmationsColor,
  getConfirmationsColorStyle
} from '@/utils/confirmations'

describe('confirmations utils', () => {
  describe('getConfirmationsColor', () => {
    it('uses red for unconfirmed transactions', () => {
      expect(getConfirmationsColor(0)).toBe(Colors.mainRed)
      expect(getConfirmationsColor(-1)).toBe(Colors.mainRed)
    })

    it('uses warning while confirmations are below six', () => {
      expect(getConfirmationsColor(1)).toBe(Colors.warning)
      expect(getConfirmationsColor(FULLY_CONFIRMED_COUNT - 1)).toBe(
        Colors.warning
      )
    })

    it('uses grey once the transaction has six or more confirmations', () => {
      expect(getConfirmationsColor(FULLY_CONFIRMED_COUNT)).toBe(
        Colors.gray[300]
      )
      expect(getConfirmationsColor(FULLY_CONFIRMED_COUNT + 10)).toBe(
        Colors.gray[300]
      )
    })
  })

  describe('getConfirmationsColorStyle', () => {
    it('returns a stable style object for the same confirmation tier', () => {
      expect(getConfirmationsColorStyle(0)).toBe(getConfirmationsColorStyle(-1))
      expect(getConfirmationsColorStyle(1)).toBe(
        getConfirmationsColorStyle(FULLY_CONFIRMED_COUNT - 1)
      )
      expect(getConfirmationsColorStyle(FULLY_CONFIRMED_COUNT)).toBe(
        getConfirmationsColorStyle(FULLY_CONFIRMED_COUNT + 1)
      )
    })
  })
})

describe('getConfirmations', () => {
  it('counts the block a transaction was mined in as its first confirmation', () => {
    expect(getConfirmations(330_000, 330_000)).toBe(1)
    expect(getConfirmations(330_000, 330_005)).toBe(6)
  })

  it('has no count while the tip is unknown', () => {
    expect(getConfirmations(330_000, 0)).toBeNull()
  })

  it('has no count while the known tip is behind the block', () => {
    expect(getConfirmations(330_000, 329_999)).toBeNull()
  })
})

describe('getConfirmationsColorStyle without a count', () => {
  it('shows a mined transaction as confirmed, never as unconfirmed', () => {
    expect(getConfirmationsColorStyle(null)).toBe(
      getConfirmationsColorStyle(FULLY_CONFIRMED_COUNT)
    )
  })
})
