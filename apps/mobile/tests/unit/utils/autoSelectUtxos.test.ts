import { AUTO_SELECT_FROM_URI_SEARCH_PARAM } from '@/constants/autoSelectUtxos'
import { DUST_LIMIT, SATS_PER_BITCOIN } from '@/constants/btc'
import {
  getBitcoinUriAmountSats,
  isAutoSelectFromUriSearchParam,
  isUriPaymentAmount,
  shouldApplyDefaultAutoSelectFromUri,
  shouldAutoSelectUtxosFromBitcoinUri,
  shouldAutoSelectUtxosFromParsedAmount
} from '@/utils/autoSelectUtxos'

describe('autoSelectUtxos helpers', () => {
  describe('isUriPaymentAmount', () => {
    it('returns false below dust limit', () => {
      expect(isUriPaymentAmount(DUST_LIMIT - 1)).toBe(false)
      expect(isUriPaymentAmount(1)).toBe(false)
    })

    it('returns true at or above dust limit', () => {
      expect(isUriPaymentAmount(DUST_LIMIT)).toBe(true)
      expect(isUriPaymentAmount(50_000)).toBe(true)
    })
  })

  describe('isAutoSelectFromUriSearchParam', () => {
    it('matches the auto-select navigation flag', () => {
      expect(
        isAutoSelectFromUriSearchParam(AUTO_SELECT_FROM_URI_SEARCH_PARAM)
      ).toBe(true)
      expect(isAutoSelectFromUriSearchParam(undefined)).toBe(false)
    })
  })

  describe('shouldAutoSelectUtxosFromParsedAmount', () => {
    it('returns true for payment amounts at or above dust', () => {
      expect(
        shouldAutoSelectUtxosFromParsedAmount(DUST_LIMIT / SATS_PER_BITCOIN)
      ).toBe(true)
    })

    it('returns false for missing or dust amounts', () => {
      expect(shouldAutoSelectUtxosFromParsedAmount(undefined)).toBe(false)
      expect(shouldAutoSelectUtxosFromParsedAmount(1 / SATS_PER_BITCOIN)).toBe(
        false
      )
    })
  })

  describe('getBitcoinUriAmountSats', () => {
    it('parses amount from a valid bitcoin URI', () => {
      expect(
        getBitcoinUriAmountSats(
          'bitcoin:bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26?amount=0.001'
        )
      ).toBe(100_000)
    })
  })

  describe('shouldAutoSelectUtxosFromBitcoinUri', () => {
    it('returns true when URI includes a payment amount', () => {
      expect(
        shouldAutoSelectUtxosFromBitcoinUri(
          'bitcoin:bc1qrc9ty0xfv908ja5r6xmzpnnr2ug6sfu0tl8j26?amount=0.001'
        )
      ).toBe(true)
    })
  })

  describe('shouldApplyDefaultAutoSelectFromUri', () => {
    it('waits for decoy address in privacy mode', () => {
      expect(
        shouldApplyDefaultAutoSelectFromUri({
          algorithm: 'privacy',
          decoyAddress: undefined,
          outputsLength: 1
        })
      ).toBe(false)
    })

    it('applies when privacy prerequisites are ready', () => {
      expect(
        shouldApplyDefaultAutoSelectFromUri({
          algorithm: 'privacy',
          decoyAddress: 'tb1qexample',
          outputsLength: 1
        })
      ).toBe(true)
    })
  })
})
