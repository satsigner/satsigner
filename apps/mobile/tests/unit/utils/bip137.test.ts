import { signMessageBip137, verifyMessageBip137 } from '@/utils/bip137'

import { bip137Vectors } from './bip137_samples'

const privateKey = Buffer.from(bip137Vectors.privateKeyHex, 'hex')
const [, helloWorldCase] = bip137Vectors.cases

describe('bip137 utils', () => {
  describe('signMessageBip137', () => {
    for (const { message, p2pkh, p2shP2wpkh, p2wpkh } of bip137Vectors.cases) {
      it(`produces the reference signature for p2pkh (message: ${JSON.stringify(message)})`, () => {
        expect(signMessageBip137(privateKey, message, 'p2pkh')).toBe(p2pkh)
      })

      it(`produces the reference signature for p2sh-p2wpkh (message: ${JSON.stringify(message)})`, () => {
        expect(signMessageBip137(privateKey, message, 'p2sh-p2wpkh')).toBe(
          p2shP2wpkh
        )
      })

      it(`produces the reference signature for p2wpkh (message: ${JSON.stringify(message)})`, () => {
        expect(signMessageBip137(privateKey, message, 'p2wpkh')).toBe(p2wpkh)
      })
    }
  })

  describe('verifyMessageBip137', () => {
    for (const { message, p2pkh, p2shP2wpkh, p2wpkh } of bip137Vectors.cases) {
      it(`verifies a valid p2pkh signature (message: ${JSON.stringify(message)})`, () => {
        expect(
          verifyMessageBip137(
            bip137Vectors.addresses.p2pkh,
            message,
            p2pkh,
            'bitcoin'
          )
        ).toBe(true)
      })

      it(`verifies a valid p2sh-p2wpkh signature (message: ${JSON.stringify(message)})`, () => {
        expect(
          verifyMessageBip137(
            bip137Vectors.addresses.p2shP2wpkh,
            message,
            p2shP2wpkh,
            'bitcoin'
          )
        ).toBe(true)
      })

      it(`verifies a valid p2wpkh signature (message: ${JSON.stringify(message)})`, () => {
        expect(
          verifyMessageBip137(
            bip137Vectors.addresses.p2wpkh,
            message,
            p2wpkh,
            'bitcoin'
          )
        ).toBe(true)
      })
    }

    it('rejects a signature for the wrong message', () => {
      const { p2pkh } = helloWorldCase
      expect(
        verifyMessageBip137(
          bip137Vectors.addresses.p2pkh,
          'a different message',
          p2pkh,
          'bitcoin'
        )
      ).toBe(false)
    })

    it('rejects a signature for the wrong address', () => {
      const { message, p2pkh } = helloWorldCase
      expect(
        verifyMessageBip137(
          bip137Vectors.addresses.p2wpkh,
          message,
          p2pkh,
          'bitcoin'
        )
      ).toBe(false)
    })

    it('rejects a tampered signature', () => {
      const { message, p2pkh } = helloWorldCase
      const tampered = `${p2pkh.slice(0, -4)}AAAA`
      expect(
        verifyMessageBip137(
          bip137Vectors.addresses.p2pkh,
          message,
          tampered,
          'bitcoin'
        )
      ).toBe(false)
    })

    it('rejects a malformed base64 signature', () => {
      expect(
        verifyMessageBip137(
          bip137Vectors.addresses.p2pkh,
          'test',
          'not-base64!!',
          'bitcoin'
        )
      ).toBe(false)
    })
  })
})
