import {
  getSupportedSignMethods,
  signAddressMessage,
  verifyAddressMessage
} from '@/utils/message'

import { bip137Vectors } from './bip137Samples'
import { bip322Taproot } from './bip322Samples'

const [emptyMessageCase] = bip137Vectors.cases

describe('message dispatcher', () => {
  describe('getSupportedSignMethods', () => {
    it('returns only bip137 for P2PKH', () => {
      expect(getSupportedSignMethods('P2PKH')).toStrictEqual(['bip137'])
    })

    it('returns both bip137 and bip322 for P2WPKH and P2SH-P2WPKH', () => {
      expect(getSupportedSignMethods('P2WPKH')).toStrictEqual([
        'bip137',
        'bip322'
      ])
      expect(getSupportedSignMethods('P2SH-P2WPKH')).toStrictEqual([
        'bip137',
        'bip322'
      ])
    })

    it('returns only bip322 for P2TR', () => {
      expect(getSupportedSignMethods('P2TR')).toStrictEqual(['bip322'])
    })

    it('returns an empty list for unsupported or missing script versions', () => {
      expect(getSupportedSignMethods('P2WSH')).toStrictEqual([])
      expect(getSupportedSignMethods('P2SH-P2WSH')).toStrictEqual([])
      expect(getSupportedSignMethods('P2SH')).toStrictEqual([])
      expect(getSupportedSignMethods(undefined)).toStrictEqual([])
    })
  })

  describe('signAddressMessage', () => {
    it('signs P2WPKH with bip137 and matches the reference signature', () => {
      const privateKey = Buffer.from(bip137Vectors.privateKeyHex, 'hex')
      const { message, p2wpkh } = emptyMessageCase
      const signature = signAddressMessage(
        privateKey,
        bip137Vectors.addresses.p2wpkh,
        message,
        'P2WPKH',
        'bitcoin',
        'bip137'
      )
      expect(signature).toBe(p2wpkh)
    })

    it('also signs P2WPKH with bip322, verifiable via the dispatcher', () => {
      const privateKey = Buffer.from(bip137Vectors.privateKeyHex, 'hex')
      const { message } = emptyMessageCase
      const signature = signAddressMessage(
        privateKey,
        bip137Vectors.addresses.p2wpkh,
        message,
        'P2WPKH',
        'bitcoin',
        'bip322'
      )
      expect(
        verifyAddressMessage(
          bip137Vectors.addresses.p2wpkh,
          message,
          signature,
          'bitcoin'
        )
      ).toStrictEqual({ method: 'bip322', valid: true })
    })

    it('throws when the method is not supported for the script version', () => {
      const privateKey = Buffer.from(bip137Vectors.privateKeyHex, 'hex')
      expect(() =>
        signAddressMessage(
          privateKey,
          bip137Vectors.addresses.p2pkh,
          'hi',
          'P2PKH',
          'bitcoin',
          'bip322'
        )
      ).toThrow('not supported')
    })

    it('throws for an unsupported script version', () => {
      const privateKey = Buffer.from(bip137Vectors.privateKeyHex, 'hex')
      expect(() =>
        signAddressMessage(
          privateKey,
          bip137Vectors.addresses.p2pkh,
          'hi',
          'P2WSH',
          'bitcoin',
          'bip137'
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

    it('routes a P2WPKH bip137-shaped signature to BIP-137', () => {
      const { message, p2wpkh } = emptyMessageCase
      const result = verifyAddressMessage(
        bip137Vectors.addresses.p2wpkh,
        message,
        p2wpkh,
        'bitcoin'
      )
      expect(result).toStrictEqual({ method: 'bip137', valid: true })
    })

    it('routes a P2WPKH bip322-shaped signature to BIP-322', () => {
      const privateKey = Buffer.from(bip137Vectors.privateKeyHex, 'hex')
      const { message } = emptyMessageCase
      const bip322Signature = signAddressMessage(
        privateKey,
        bip137Vectors.addresses.p2wpkh,
        message,
        'P2WPKH',
        'bitcoin',
        'bip322'
      )
      const result = verifyAddressMessage(
        bip137Vectors.addresses.p2wpkh,
        message,
        bip322Signature,
        'bitcoin'
      )
      expect(result).toStrictEqual({ method: 'bip322', valid: true })
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
