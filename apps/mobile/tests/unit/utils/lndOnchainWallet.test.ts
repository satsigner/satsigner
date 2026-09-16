import { DUST_LIMIT } from '@/constants/btc'
import {
  buildNewAddressPath,
  buildSendCoinsBody,
  parseBitcoinUriAddress,
  validateLndOnchainSend
} from '@/utils/lndOnchainWallet'

const P2WPKH = 'bc1q8d968eg8ua3dk8mkql9d0vj35nzplsd4zmulus'

describe('lndOnchainWallet', () => {
  describe('buildNewAddressPath', () => {
    it('uses unused p2wpkh by default', () => {
      expect(buildNewAddressPath()).toBe('/v1/newaddress?type=2')
      expect(buildNewAddressPath(false)).toBe('/v1/newaddress?type=2')
    })

    it('uses a new p2wpkh when fresh', () => {
      expect(buildNewAddressPath(true)).toBe('/v1/newaddress?type=0')
    })
  })

  describe('buildSendCoinsBody', () => {
    it('omits sat_per_vbyte when unset', () => {
      expect(
        buildSendCoinsBody({ addr: P2WPKH, amountSat: 10_000 })
      ).toStrictEqual({
        addr: P2WPKH,
        amount: '10000'
      })
    })

    it('includes sat_per_vbyte when set', () => {
      expect(
        buildSendCoinsBody({
          addr: P2WPKH,
          amountSat: 10_000,
          satPerVbyte: 4
        }).sat_per_vbyte
      ).toBe('4')
    })
  })

  describe('parseBitcoinUriAddress', () => {
    it('accepts a raw address', () => {
      expect(parseBitcoinUriAddress(`  ${P2WPKH}  `)).toBe(P2WPKH)
    })

    it('strips a bitcoin URI', () => {
      expect(parseBitcoinUriAddress(`bitcoin:${P2WPKH}`)).toBe(P2WPKH)
    })

    it('returns null for empty or lightning input', () => {
      expect(parseBitcoinUriAddress('')).toBeNull()
      expect(parseBitcoinUriAddress('lnbc1invoice')).toBeNull()
    })
  })

  describe('validateLndOnchainSend', () => {
    const base = {
      address: P2WPKH,
      amountText: '1000',
      confirmedBalanceSat: 50_000,
      satPerVbyteText: ''
    }

    it('accepts a valid send with optional fee omitted', () => {
      expect(validateLndOnchainSend(base)).toStrictEqual({
        amountSat: 1000,
        ok: true,
        satPerVbyte: undefined
      })
    })

    it('rejects an invalid address', () => {
      expect(
        validateLndOnchainSend({ ...base, address: 'not-an-address' })
      ).toStrictEqual({ ok: false, reason: 'address' })
    })

    it('rejects dust and non-integer amounts', () => {
      expect(
        validateLndOnchainSend({
          ...base,
          amountText: String(DUST_LIMIT - 1)
        })
      ).toStrictEqual({ ok: false, reason: 'amount' })
      expect(
        validateLndOnchainSend({ ...base, amountText: '1.5' })
      ).toStrictEqual({ ok: false, reason: 'amount' })
    })

    it('rejects amount above confirmed balance', () => {
      expect(
        validateLndOnchainSend({ ...base, amountText: '50001' })
      ).toStrictEqual({ ok: false, reason: 'balance' })
    })

    it('rejects invalid fee and accepts a whole sat/vbyte', () => {
      expect(
        validateLndOnchainSend({ ...base, satPerVbyteText: '0' })
      ).toStrictEqual({ ok: false, reason: 'fee' })
      expect(
        validateLndOnchainSend({ ...base, satPerVbyteText: '3' })
      ).toStrictEqual({
        amountSat: 1000,
        ok: true,
        satPerVbyte: 3
      })
    })
  })
})
