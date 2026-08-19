import { address as bjsAddress } from 'bitcoinjs-lib'
import bs58check from 'bs58check'

import {
  bip322MessageHash,
  buildToSpendTx,
  signMessageBip322,
  signMessageBip322SegwitV0,
  signMessageBip322Taproot,
  verifyMessageBip322,
  verifyMessageBip322SegwitV0,
  verifyMessageBip322Taproot
} from '@/utils/bip322'
import { bitcoinjsNetwork } from '@/utils/bitcoin'

import { bip322P2wpkh, bip322Taproot, bip322TxHashes } from './bip322Samples'

function privateKeyFromWif(wif: string): Buffer {
  const decoded = bs58check.decode(wif)
  // decoded = [version byte][32-byte key][optional 0x01 compressed flag]
  return Buffer.from(decoded.slice(1, 33))
}

describe('bip322 utils - P2TR', () => {
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

    it('produces an "smp"-prefixed, 65-byte SIGHASH_ALL signature (matching Sparrow)', () => {
      const signature = signMessageBip322Taproot(
        privateKey,
        bip322Taproot.address,
        bip322Taproot.message,
        'bitcoin'
      )
      expect(signature.startsWith('smp')).toBe(true)
      const witnessBytes = Buffer.from(signature.slice(3), 'base64')
      // varint(1 item) + varint(65-byte item) + 65-byte sig (64-byte
      // schnorr sig + trailing 0x01 SIGHASH_ALL byte)
      expect(witnessBytes).toHaveLength(1 + 1 + 65)
      expect(witnessBytes[0]).toBe(1)
      expect(witnessBytes[1]).toBe(65)
      expect(witnessBytes.at(-1)).toBe(1)
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

describe('bip322 utils - P2WPKH / P2SH-P2WPKH', () => {
  const privateKey = privateKeyFromWif(bip322P2wpkh.privateKeyWif)

  describe('verifyMessageBip322SegwitV0', () => {
    it('verifies the official P2WPKH test vector (empty message)', () => {
      expect(
        verifyMessageBip322SegwitV0(
          bip322P2wpkh.address,
          '',
          bip322P2wpkh.signatures[''],
          'bitcoin'
        )
      ).toBe(true)
    })

    it('verifies the official P2WPKH test vector ("Hello World")', () => {
      expect(
        verifyMessageBip322SegwitV0(
          bip322P2wpkh.address,
          'Hello World',
          bip322P2wpkh.signatures['Hello World'],
          'bitcoin'
        )
      ).toBe(true)
    })

    it('rejects the vector signature against the wrong message', () => {
      expect(
        verifyMessageBip322SegwitV0(
          bip322P2wpkh.address,
          'a different message',
          bip322P2wpkh.signatures[''],
          'bitcoin'
        )
      ).toBe(false)
    })

    it('rejects a malformed base64 signature', () => {
      expect(
        verifyMessageBip322SegwitV0(
          bip322P2wpkh.address,
          'test',
          'not-base64!!',
          'bitcoin'
        )
      ).toBe(false)
    })
  })

  describe('sign/verify round trip', () => {
    it('p2WPKH: a produced signature verifies against the same address/message', () => {
      const signature = signMessageBip322SegwitV0(
        privateKey,
        bip322P2wpkh.address,
        'satsigner round trip',
        'bitcoin'
      )
      expect(
        verifyMessageBip322SegwitV0(
          bip322P2wpkh.address,
          'satsigner round trip',
          signature,
          'bitcoin'
        )
      ).toBe(true)
    })

    it('produces an "smp"-prefixed signature (matching Sparrow)', () => {
      const signature = signMessageBip322SegwitV0(
        privateKey,
        bip322P2wpkh.address,
        'satsigner round trip',
        'bitcoin'
      )
      expect(signature.startsWith('smp')).toBe(true)
    })

    it('p2SH-P2WPKH: a produced signature verifies against the same address/message', () => {
      const signature = signMessageBip322SegwitV0(
        privateKey,
        bip322P2wpkh.p2shAddress,
        'satsigner round trip',
        'bitcoin'
      )
      expect(
        verifyMessageBip322SegwitV0(
          bip322P2wpkh.p2shAddress,
          'satsigner round trip',
          signature,
          'bitcoin'
        )
      ).toBe(true)
    })

    it('rejects a P2WPKH signature verified against the wrong address', () => {
      const signature = signMessageBip322SegwitV0(
        privateKey,
        bip322P2wpkh.address,
        'satsigner round trip',
        'bitcoin'
      )
      expect(
        verifyMessageBip322SegwitV0(
          bip322Taproot.address,
          'satsigner round trip',
          signature,
          'bitcoin'
        )
      ).toBe(false)
    })
  })

  describe('low-R signing', () => {
    // With low-S already enforced by the underlying curve, a DER signature
    // (including the 1-byte SIGHASH_ALL suffix) is exactly 71 bytes
    // (6-byte ASN.1 overhead + 32-byte r + 32-byte s + 1) when r is also
    // low; a high-R signature needs one extra padding byte (72).
    const LOW_R_DER_LENGTH = 71

    it('always produces a compact (low-R) DER signature', () => {
      const messages = [
        'a',
        'ab',
        'abc',
        'test',
        'test 1',
        'test 12',
        'test 123',
        'grind me please',
        ''
      ]
      for (const message of messages) {
        const signature = signMessageBip322SegwitV0(
          privateKey,
          bip322P2wpkh.address,
          message,
          'bitcoin'
        )
        const witnessBytes = Buffer.from(signature.slice(3), 'base64')
        // varint(2 items) + varint(sig length) + sig + varint(33) + pubkey
        const [, derLength] = witnessBytes
        expect(derLength).toBeLessThanOrEqual(LOW_R_DER_LENGTH)
        expect(
          verifyMessageBip322SegwitV0(
            bip322P2wpkh.address,
            message,
            signature,
            'bitcoin'
          )
        ).toBe(true)
      }
    })
  })
})

describe('bip322 utils - dispatcher', () => {
  const privateKey = privateKeyFromWif(bip322P2wpkh.privateKeyWif)
  const taprootPrivateKey = privateKeyFromWif(bip322Taproot.privateKeyWif)

  it('routes P2WPKH sign+verify through the segwit-v0 path', () => {
    const signature = signMessageBip322(
      privateKey,
      bip322P2wpkh.address,
      'dispatch test',
      'bitcoin'
    )
    expect(
      verifyMessageBip322(
        bip322P2wpkh.address,
        'dispatch test',
        signature,
        'bitcoin'
      )
    ).toBe(true)
  })

  it('routes P2TR sign+verify through the taproot path', () => {
    const signature = signMessageBip322(
      taprootPrivateKey,
      bip322Taproot.address,
      'dispatch test',
      'bitcoin'
    )
    expect(
      verifyMessageBip322(
        bip322Taproot.address,
        'dispatch test',
        signature,
        'bitcoin'
      )
    ).toBe(true)
  })

  it('throws when signing for an unsupported address type', () => {
    expect(() =>
      signMessageBip322(
        privateKey,
        'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', // P2WSH
        'dispatch test',
        'bitcoin'
      )
    ).toThrow('not supported')
  })

  it('returns false when verifying for an unsupported address type', () => {
    expect(
      verifyMessageBip322(
        'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', // P2WSH
        'dispatch test',
        bip322P2wpkh.signatures[''],
        'bitcoin'
      )
    ).toBe(false)
  })
})
