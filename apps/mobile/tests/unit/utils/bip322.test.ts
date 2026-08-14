import { address as bjsAddress } from 'bitcoinjs-lib'
import bs58check from 'bs58check'

import {
  bip322MessageHash,
  buildToSpendTx,
  signMessageBip322Taproot,
  verifyMessageBip322Taproot
} from '@/utils/bip322'
import { bitcoinjsNetwork } from '@/utils/bitcoin'

import { bip322Taproot, bip322TxHashes } from './bip322_samples'

function privateKeyFromWif(wif: string): Buffer {
  const decoded = bs58check.decode(wif)
  // decoded = [version byte][32-byte key][optional 0x01 compressed flag]
  return Buffer.from(decoded.slice(1, 33))
}

describe('bip322 utils (P2TR)', () => {
  describe('verifyMessageBip322Taproot', () => {
    it('verifies the official BIP-322 taproot test vector (no-prefix form)', () => {
      expect(
        verifyMessageBip322Taproot(
          bip322Taproot.address,
          bip322Taproot.message,
          bip322Taproot.signatureNoPrefix,
          'bitcoin'
        )
      ).toBe(true)
    })

    it('verifies the official BIP-322 taproot test vector (smp-prefixed form)', () => {
      expect(
        verifyMessageBip322Taproot(
          bip322Taproot.address,
          bip322Taproot.message,
          bip322Taproot.signatureWithPrefix,
          'bitcoin'
        )
      ).toBe(true)
    })

    it('rejects the vector signature against the wrong message', () => {
      expect(
        verifyMessageBip322Taproot(
          bip322Taproot.address,
          'a different message',
          bip322Taproot.signatureNoPrefix,
          'bitcoin'
        )
      ).toBe(false)
    })

    it('rejects a non-taproot address', () => {
      expect(
        verifyMessageBip322Taproot(
          'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l',
          bip322Taproot.message,
          bip322Taproot.signatureNoPrefix,
          'bitcoin'
        )
      ).toBe(false)
    })

    it('rejects a malformed base64 signature', () => {
      expect(
        verifyMessageBip322Taproot(
          bip322Taproot.address,
          bip322Taproot.message,
          'not-base64!!',
          'bitcoin'
        )
      ).toBe(false)
    })
  })

  describe('signMessageBip322Taproot round-trip', () => {
    const privateKey = privateKeyFromWif(bip322Taproot.privateKeyWif)

    it('produces a signature that verifies against the same address/message', () => {
      const signature = signMessageBip322Taproot(
        privateKey,
        bip322Taproot.address,
        bip322Taproot.message,
        'bitcoin'
      )
      expect(
        verifyMessageBip322Taproot(
          bip322Taproot.address,
          bip322Taproot.message,
          signature,
          'bitcoin'
        )
      ).toBe(true)
    })

    it('produces a signature that fails verification for a different message', () => {
      const signature = signMessageBip322Taproot(
        privateKey,
        bip322Taproot.address,
        bip322Taproot.message,
        'bitcoin'
      )
      expect(
        verifyMessageBip322Taproot(
          bip322Taproot.address,
          'tampered message',
          signature,
          'bitcoin'
        )
      ).toBe(false)
    })

    it('throws when signing for a non-taproot address', () => {
      expect(() =>
        signMessageBip322Taproot(
          privateKey,
          'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l',
          bip322Taproot.message,
          'bitcoin'
        )
      ).toThrow('Taproot')
    })
  })

  describe('transaction-building helpers', () => {
    for (const vector of bip322TxHashes) {
      it(`matches the official message_hash and to_spend txid (message: ${JSON.stringify(vector.message)})`, () => {
        expect(bip322MessageHash(vector.message).toString('hex')).toBe(
          vector.messageHash
        )

        const scriptPubKey = bjsAddress.toOutputScript(
          vector.address,
          bitcoinjsNetwork('bitcoin')
        )
        const toSpendTx = buildToSpendTx(scriptPubKey, vector.message)
        expect(toSpendTx.getId()).toBe(vector.toSpendTxHash)
      })
    }
  })
})
