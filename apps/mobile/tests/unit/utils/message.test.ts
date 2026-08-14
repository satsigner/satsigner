import {
  getSupportedSignMethod,
  signAddressMessage,
  verifyAddressMessage
} from '@/utils/message'

import { bip137Vectors } from './bip137_samples'
import { bip322Taproot } from './bip322_samples'

const [emptyMessageCase] = bip137Vectors.cases

describe('message dispatcher', () => {
  describe('getSupportedSignMethod', () => {
    it('returns bip137 for P2PKH, P2WPKH, and P2SH-P2WPKH', () => {
      expect(getSupportedSignMethod('P2PKH')).toBe('bip137')
      expect(getSupportedSignMethod('P2WPKH')).toBe('bip137')
      expect(getSupportedSignMethod('P2SH-P2WPKH')).toBe('bip137')
    })

    it('returns bip322 for P2TR', () => {
      expect(getSupportedSignMethod('P2TR')).toBe('bip322')
    })

    it('returns null for unsupported or missing script versions', () => {
      expect(getSupportedSignMethod('P2WSH')).toBeNull()
      expect(getSupportedSignMethod('P2SH-P2WSH')).toBeNull()
      expect(getSupportedSignMethod('P2SH')).toBeNull()
      expect(getSupportedSignMethod(undefined)).toBeNull()
    })
  })

  describe('signAddressMessage', () => {
    it('routes P2WPKH to BIP-137 and matches the reference signature', () => {
      const privateKey = Buffer.from(bip137Vectors.privateKeyHex, 'hex')
      const { message, p2wpkh } = emptyMessageCase
      const signature = signAddressMessage(
        privateKey,
        bip137Vectors.addresses.p2wpkh,
        message,
        'P2WPKH',
        'bitcoin'
      )
      expect(signature).toBe(p2wpkh)
    })

    it('throws for an unsupported script version', () => {
      const privateKey = Buffer.from(bip137Vectors.privateKeyHex, 'hex')
      expect(() =>
        signAddressMessage(
          privateKey,
          bip137Vectors.addresses.p2pkh,
          'hi',
          'P2WSH',
          'bitcoin'
        )
      ).toThrow('not supported')
    })
  })

  describe('verifyAddressMessage', () => {
    it('routes a P2TR address to BIP-322 and reports the method used', () => {
      const result = verifyAddressMessage(
        bip322Taproot.address,
        bip322Taproot.message,
        bip322Taproot.signatureNoPrefix,
        'bitcoin'
      )
      expect(result).toStrictEqual({ method: 'bip322', valid: true })
    })

    it('routes a P2PKH address to BIP-137 and reports the method used', () => {
      const { message, p2pkh } = emptyMessageCase
      const result = verifyAddressMessage(
        bip137Vectors.addresses.p2pkh,
        message,
        p2pkh,
        'bitcoin'
      )
      expect(result).toStrictEqual({ method: 'bip137', valid: true })
    })

    it('returns method null for an unsupported address type', () => {
      const result = verifyAddressMessage(
        'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', // P2WSH
        'anything',
        bip322Taproot.signatureNoPrefix,
        'bitcoin'
      )
      expect(result).toStrictEqual({ method: null, valid: false })
    })
  })
})
