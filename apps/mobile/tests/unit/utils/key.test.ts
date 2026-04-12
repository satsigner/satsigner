import { type Key } from '@/types/models/Account'
import { extractPublicKeyFromKey, isSeedDropped } from '@/utils/key'

jest.mock<typeof import('@/utils/bip32')>('@/utils/bip32', () => ({
  getExtendedKeyFromDescriptor: (descriptor: string) => {
    if (descriptor === 'throw') {
      throw new Error('bad descriptor')
    }
    return `extracted-from-${descriptor}`
  }
}))

const makeKey = (secret: Key['secret'], overrides?: Partial<Key>): Key => ({
  creationType: 'generateMnemonic',
  index: 0,
  iv: '',
  secret,
  ...overrides
})

describe('isSeedDropped', () => {
  it('returns false when keyDetails is null', () => {
    expect(isSeedDropped(null)).toBe(false)
  })

  it('returns false when keyDetails secret is a string', () => {
    const key = makeKey('encrypted-string')
    expect(isSeedDropped(key)).toBe(false)
  })

  it('returns false when mnemonic exists on decryptedKey', () => {
    const keyDetails = makeKey('encrypted')
    const decryptedKey = makeKey({ mnemonic: 'word1 word2' })
    expect(isSeedDropped(keyDetails, decryptedKey)).toBe(false)
  })

  it('returns true when mnemonic missing on decryptedKey', () => {
    const keyDetails = makeKey('encrypted')
    const decryptedKey = makeKey({ extendedPublicKey: 'xpub...' })
    expect(isSeedDropped(keyDetails, decryptedKey)).toBe(true)
  })

  it('returns false when mnemonic exists on keyDetails', () => {
    const key = makeKey({ mnemonic: 'word1 word2' })
    expect(isSeedDropped(key)).toBe(false)
  })

  it('returns true when mnemonic missing on keyDetails', () => {
    const key = makeKey({ extendedPublicKey: 'xpub...' })
    expect(isSeedDropped(key)).toBe(true)
  })

  it('prefers decryptedKey over keyDetails', () => {
    const keyDetails = makeKey({ mnemonic: 'word1 word2' })
    const decryptedKey = makeKey({ extendedPublicKey: 'xpub...' })
    expect(isSeedDropped(keyDetails, decryptedKey)).toBe(true)
  })
})

describe('extractPublicKeyFromKey', () => {
  it('returns empty string when keyDetails is null', () => {
    expect(extractPublicKeyFromKey(null)).toBe('')
  })

  describe('when keyDetails.secret is a string (encrypted)', () => {
    const keyDetails = makeKey('encrypted-secret')

    it('returns empty string when no decryptedKey', () => {
      expect(extractPublicKeyFromKey(keyDetails)).toBe('')
    })

    it('returns empty string when decryptedKey secret is also a string', () => {
      const decryptedKey = makeKey('also-encrypted')
      expect(extractPublicKeyFromKey(keyDetails, decryptedKey)).toBe('')
    })

    it('returns extendedPublicKey from decryptedKey', () => {
      const decryptedKey = makeKey({ extendedPublicKey: 'xpub123' })
      expect(extractPublicKeyFromKey(keyDetails, decryptedKey)).toBe('xpub123')
    })

    it('extracts from externalDescriptor on decryptedKey', () => {
      const decryptedKey = makeKey({ externalDescriptor: 'desc1' })
      expect(extractPublicKeyFromKey(keyDetails, decryptedKey)).toBe(
        'extracted-from-desc1'
      )
    })

    it('returns empty string when descriptor extraction throws', () => {
      const decryptedKey = makeKey({ externalDescriptor: 'throw' })
      expect(extractPublicKeyFromKey(keyDetails, decryptedKey)).toBe('')
    })

    it('prefers extendedPublicKey over externalDescriptor', () => {
      const decryptedKey = makeKey({
        extendedPublicKey: 'xpub123',
        externalDescriptor: 'desc1'
      })
      expect(extractPublicKeyFromKey(keyDetails, decryptedKey)).toBe('xpub123')
    })
  })

  describe('when keyDetails.secret is an object', () => {
    it('returns extendedPublicKey directly', () => {
      const key = makeKey({ extendedPublicKey: 'xpubABC' })
      expect(extractPublicKeyFromKey(key)).toBe('xpubABC')
    })

    it('extracts from externalDescriptor', () => {
      const key = makeKey({ externalDescriptor: 'desc2' })
      expect(extractPublicKeyFromKey(key)).toBe('extracted-from-desc2')
    })

    it('returns empty string when descriptor extraction throws', () => {
      const key = makeKey({ externalDescriptor: 'throw' })
      expect(extractPublicKeyFromKey(key)).toBe('')
    })

    it('returns empty string when no public key or descriptor', () => {
      const key = makeKey({ mnemonic: 'word1 word2' })
      expect(extractPublicKeyFromKey(key)).toBe('')
    })
  })
})
