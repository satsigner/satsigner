import { FULLY_CONFIRMED_COUNT } from '@/constants/btc'
import { Colors } from '@/styles'
import {
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
